/**
 * stage.js - Quản lý Center Stage, bố trí các mốc tầng và đối tượng thám hiểm
 */

import { MAX_DEPTH_M, PIXELS_PER_METER } from './physics.js';
import { openInspector } from './inspector.js';

const numberFormatter = new Intl.NumberFormat('vi-VN');

let cachedLayers = [];
let cachedItems = [];
let lastIsMobile = null;
let resizeDebounceTimer = null;

/**
 * Tạo dữ liệu tầng đại dương chuyển sang Inspector Drawer
 */
export function createLayerInspectorItem(layer) {
    if (!layer) return null;
    const depthStr = `${numberFormatter.format(layer.depth_start_m)} m – ${numberFormatter.format(layer.depth_end_m)} m`;
    return {
        id: `layer-${layer.id}`,
        name: `${layer.vietnamese_name} (${layer.name})`,
        slug: `layer-${(layer.name || '').toLowerCase()}`,
        item_type: 'LAYER',
        layer_badge: `Tầng ${layer.sort_order}/5`,
        layer_name: layer.vietnamese_name,
        scientific_name: `${layer.name} Zone`,
        depth_m: layer.depth_start_m,
        depth_display: depthStr,
        short_description: layer.description || `Phạm vi tầng đại dương từ ${depthStr}.`,
        fact: `Mô tả khoa học: ${layer.description || 'Đang cập nhật đặc điểm chi tiết của tầng đại dương.'}\n\n• Phạm vi độ sâu: ${depthStr}\n• Thứ tự phân tầng: Tầng ${layer.sort_order}/5 của đại dương\n• Dải màu quang học: ${layer.color_start} → ${layer.color_end}`,
        color_start: layer.color_start,
        color_end: layer.color_end,
        image_url: '',
        detail_url: '',
    };
}

/**
 * Khởi tạo và kết xuất cấu trúc sân khấu hành trình
 */
export function initStage(layers, items) {
    const trackEl = document.getElementById('vertical-track');
    if (!trackEl) return;

    cachedLayers = layers || [];
    cachedItems = items || [];
    lastIsMobile = window.innerWidth < 768;

    renderStage(trackEl, cachedLayers, cachedItems, lastIsMobile);

    // Lắng nghe thay đổi kích thước màn hình để tự động sắp xếp lại bố cục
    window.addEventListener('resize', handleWindowResize);
}

/**
 * Xử lý resize có debounce
 */
function handleWindowResize() {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
        const currentIsMobile = window.innerWidth < 768;
        if (currentIsMobile !== lastIsMobile) {
            lastIsMobile = currentIsMobile;
            const trackEl = document.getElementById('vertical-track');
            if (trackEl) {
                renderStage(trackEl, cachedLayers, cachedItems, currentIsMobile);
            }
        }
    }, 150);
}

/**
 * Kết xuất toàn bộ Center Stage
 */
function renderStage(trackEl, layers, items, isMobile) {
    trackEl.innerHTML = '';

    // Chiều cao track chính xác theo tỷ lệ 1m = 4px
    const trackHeight = MAX_DEPTH_M * PIXELS_PER_METER;
    trackEl.style.height = `${trackHeight}px`;

    // 1. Tạo điểm khởi đầu tại 0m: Tầng Nắng rọi (Epipelagic)
    const layer0 = layers && layers.length > 0 ? layers[0] : null;
    const startPoint = createStartPointMarker(layer0);
    trackEl.appendChild(startPoint);

    // 2. Tạo các mốc ranh giới tầng đại dương (200m, 1.000m, 4.000m, 6.000m)
    if (layers && layers.length > 0) {
        layers.forEach((layer) => {
            if (layer.depth_start_m > 0) {
                const marker = createLayerBoundaryMarker(layer);
                trackEl.appendChild(marker);
            }
        });
    }

    // 3. Tạo điểm kết thúc tại Challenger Deep 10.928m
    const challengerMilestone = items ? items.find(
        (i) => i.depth_m === MAX_DEPTH_M && i.item_type === 'MILESTONE'
    ) : null;

    const challengerItem = challengerMilestone || {
        id: 'challenger-deep-endpoint',
        name: 'Challenger Deep',
        slug: 'challenger-deep',
        item_type: 'MILESTONE',
        depth_m: MAX_DEPTH_M,
        layer_name: 'Tầng Địa ngục',
        short_description: 'Nội dung thông tin về cột mốc Challenger Deep đang được cập nhật.',
        fact: '',
        image_url: '',
        detail_url: '',
        is_verified: false,
    };

    const endPoint = createEndpointMarker(
        MAX_DEPTH_M,
        'Challenger Deep – 10.928 m',
        'Điểm sâu nhất được ghi nhận tại rãnh Mariana – Điểm cuối hành trình',
        challengerItem
    );
    trackEl.appendChild(endPoint);

    // 4. Bố trí các đối tượng thám hiểm (ExplorerItem) có is_published=True
    // Loại trừ item đã gán riêng cho mốc kết thúc Challenger Deep nếu có
    const itemsToDisplay = items ? items.filter(
        (item) => !(challengerMilestone && item.id === challengerMilestone.id)
    ) : [];

    if (itemsToDisplay.length > 0) {
        const layoutResults = layoutExplorerItems(itemsToDisplay, isMobile, layers);
        layoutResults.forEach((layoutItem) => {
            const cardNode = createExplorerCardNode(layoutItem);
            trackEl.appendChild(cardNode);
        });
    }

    // 5. Khởi tạo Intersection Observer để tối ưu hiển thị hiệu ứng
    setupIntersectionObserver();
}

/**
 * Thuật toán bố trí Explorer Cards tự động theo 3 làn (Trái, Giữa, Phải)
 * Tự động đo kích thước, phát hiện va chạm và dịch chuyển card khi gần nhau
 * Giữ anchor tại depth_m * 4px và không đè lên ô giới thiệu tầng hay Fixed HUD
 */
export function layoutExplorerItems(items, isMobile, layers = []) {
    if (!items || items.length === 0) return [];

    // 1. Sắp xếp items theo depth_m tăng dần
    const sorted = [...items].sort((a, b) => a.depth_m - b.depth_m);

    // Kích thước card gọn gàng thực tế
    const CARD_HEIGHT = isMobile ? 135 : 140;
    const CARD_GAP = 16;

    // Khoảng đệm an toàn đỉnh: Tránh che ô giới thiệu Tầng Nắng rọi (90px + ~170px = ~260px) và Fixed HUD (72px)
    const START_CLEARANCE_Y = 280;

    // Danh sách tọa độ Y của các mốc ranh giới tầng đại dương để tránh card làn giữa đè lên badge
    const boundaryPositions = (layers || [])
        .filter((l) => l.depth_start_m > 0)
        .map((l) => l.depth_start_m * PIXELS_PER_METER);

    const collidesWithBoundaryBadge = (targetY) => {
        return boundaryPositions.some((bY) => {
            return targetY <= bY + 25 && targetY + CARD_HEIGHT >= bY - 25;
        });
    };

    // Trên mobile: Bố cục 1 cột căn giữa
    if (isMobile) {
        let lastBottom = START_CLEARANCE_Y;
        return sorted.map((item) => {
            const anchorY = item.depth_m * PIXELS_PER_METER;
            let rawTargetY = Math.max(anchorY, START_CLEARANCE_Y);

            if (collidesWithBoundaryBadge(rawTargetY)) {
                const nearB = boundaryPositions.find(
                    (bY) => rawTargetY <= bY + 25 && rawTargetY + CARD_HEIGHT >= bY - 25
                );
                if (nearB) rawTargetY = nearB + 35;
            }

            const displayY = Math.max(rawTargetY, lastBottom + CARD_GAP);
            lastBottom = displayY + CARD_HEIGHT;

            return {
                item,
                lane: 1, // Làn giữa
                anchorY,
                displayY,
                hasOffset: Math.abs(displayY - anchorY) > 6,
            };
        });
    }

    // Trên desktop: 3 làn song song [0: Trái, 1: Giữa, 2: Phải]
    const laneBottoms = [START_CLEARANCE_Y, START_CLEARANCE_Y, START_CLEARANCE_Y];

    return sorted.map((item, idx) => {
        const anchorY = item.depth_m * PIXELS_PER_METER;
        const rawTargetY = Math.max(anchorY, START_CLEARANCE_Y);
        const preferredLane = idx % 3;

        // Ưu tiên làn theo thứ tự xoay vòng [preferred, (preferred+1)%3, (preferred+2)%3]
        const laneCandidates = [preferredLane, (preferredLane + 1) % 3, (preferredLane + 2) % 3];

        let chosenLane = preferredLane;
        let displayY = rawTargetY;
        let placed = false;

        for (const lane of laneCandidates) {
            // Nếu là làn giữa, kiểm tra xem có va chạm với badge ranh giới tầng không
            if (lane === 1 && collidesWithBoundaryBadge(rawTargetY)) {
                continue;
            }

            if (rawTargetY >= laneBottoms[lane] + CARD_GAP) {
                chosenLane = lane;
                displayY = rawTargetY;
                placed = true;
                break;
            }
        }

        // Nếu cả 3 làn đều bận tại rawTargetY -> chọn làn có vị trí trống sớm nhất
        if (!placed) {
            let minBottom = Infinity;
            chosenLane = 0;

            for (const lane of laneCandidates) {
                let candidateY = laneBottoms[lane] + CARD_GAP;
                if (lane === 1 && collidesWithBoundaryBadge(candidateY)) {
                    const nearB = boundaryPositions.find(
                        (bY) => candidateY <= bY + 25 && candidateY + CARD_HEIGHT >= bY - 25
                    );
                    if (nearB) candidateY = nearB + 35;
                }

                if (candidateY < minBottom) {
                    minBottom = candidateY;
                    chosenLane = lane;
                    displayY = candidateY;
                }
            }
        }

        laneBottoms[chosenLane] = displayY + CARD_HEIGHT;

        return {
            item,
            lane: chosenLane,
            anchorY,
            displayY,
            hasOffset: Math.abs(displayY - anchorY) > 6,
        };
    });
}

/**
 * Tạo thẻ hình ảnh ExplorerCard riêng biệt, gọn gàng cho từng đối tượng
 */
function createExplorerCardNode(layoutItem) {
    const { item, lane, anchorY, displayY, hasOffset } = layoutItem;
    const fragment = document.createDocumentFragment();
    const laneClass = lane === 0 ? 'lane-left' : lane === 1 ? 'lane-center' : 'lane-right';

    // 1. Mốc neo độ sâu thực tế & Đường nối khi card được dịch chuyển khỏi điểm neo
    if (hasOffset) {
        const anchorEl = document.createElement('div');
        anchorEl.className = `card-depth-anchor ${laneClass}`;
        anchorEl.style.top = `${anchorY}px`;
        anchorEl.innerHTML = `
            <span class="anchor-pin-dot"></span>
            <span class="anchor-pin-label">${numberFormatter.format(item.depth_m)} m</span>
        `;
        fragment.appendChild(anchorEl);

        const lineEl = document.createElement('div');
        lineEl.className = `card-connector-line ${laneClass}`;
        const topY = Math.min(anchorY, displayY);
        const heightY = Math.abs(displayY - anchorY);
        lineEl.style.top = `${topY}px`;
        lineEl.style.height = `${heightY}px`;
        fragment.appendChild(lineEl);
    }

    // 2. Thẻ hình ảnh đối tượng thám hiểm gọn gàng (Card chỉ cần ảnh, tên, độ sâu, loại đối tượng)
    const card = document.createElement('div');
    card.className = `explorer-card ${laneClass}`;
    card.id = `item-${item.slug}`;
    card.style.top = `${displayY}px`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute(
        'aria-label',
        `Xem thông tin ${item.name} (${item.item_type === 'CREATURE' ? 'Sinh vật' : 'Cột mốc'}) ở độ sâu ${numberFormatter.format(item.depth_m)} mét`
    );

    const isCreature = item.item_type === 'CREATURE';
    const typeLabel = isCreature ? 'Sinh vật' : 'Cột mốc';
    const typeClass = isCreature ? 'type-creature' : 'type-milestone';

    card.innerHTML = `
        <div class="card-thumb-wrapper">
            ${item.image_url ? `
                <img class="card-thumb-img" src="${item.image_url}" alt="${item.name}" loading="lazy"
                     onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                <div class="card-thumb-placeholder" style="display: none;">
                    <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    <span>${typeLabel}</span>
                </div>
            ` : `
                <div class="card-thumb-placeholder">
                    <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    <span>${typeLabel}</span>
                </div>
            `}
            <span class="card-type-tag ${typeClass}">${typeLabel}</span>
        </div>
        <div class="card-info">
            <div class="card-header">
                <h3 class="card-title" title="${item.name}">${item.name}</h3>
                <span class="card-depth-badge">${numberFormatter.format(item.depth_m)} m</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        openInspector(item, card);
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openInspector(item, card);
        }
    });

    fragment.appendChild(card);
    return fragment;
}

/**
 * Tạo mốc bắt đầu hành trình tại 0m tương tác mở thông tin Tầng Nắng rọi (Epipelagic)
 */
function createStartPointMarker(layer0) {
    const point = document.createElement('div');
    point.className = 'journey-endpoint start-point is-interactive';
    point.style.top = '90px';
    point.tabIndex = 0;
    point.setAttribute('role', 'button');
    point.setAttribute(
        'aria-label',
        layer0
            ? `Xem thông tin tầng ${layer0.vietnamese_name} (${layer0.name}) từ 0m đến ${layer0.depth_end_m}m`
            : 'Xem thông tin Tầng Nắng rọi (Epipelagic)'
    );

    const title = layer0 ? `${layer0.vietnamese_name} (${layer0.name})` : 'Tầng Nắng rọi (Epipelagic)';
    point.innerHTML = `
        <h2>${title}</h2>
        <p>0 m – Mặt biển • Bắt đầu hành trình thám hiểm xuống vùng biển sâu thẳm nhất hành tinh</p>
        <div class="endpoint-action-hint">✦ Nhấp để xem thông tin tầng đại dương</div>
    `;

    const layerItem = layer0 ? createLayerInspectorItem(layer0) : null;
    if (layerItem) {
        point.addEventListener('click', () => {
            openInspector(layerItem, point);
        });

        point.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openInspector(layerItem, point);
            }
        });
    }

    return point;
}

/**
 * Tạo phần tử mốc ranh giới tầng đại dương (200m, 1.000m, 4.000m, 6.000m) tương tác mở Inspector
 */
function createLayerBoundaryMarker(layer) {
    const marker = document.createElement('div');
    marker.className = 'layer-boundary-marker is-interactive';
    marker.style.top = `${layer.depth_start_m * PIXELS_PER_METER}px`;
    marker.tabIndex = 0;
    marker.setAttribute('role', 'button');
    marker.setAttribute(
        'aria-label',
        `Xem thông tin tầng ${layer.vietnamese_name} (${layer.name}) từ ${numberFormatter.format(layer.depth_start_m)}m đến ${numberFormatter.format(layer.depth_end_m)}m`
    );

    marker.innerHTML = `
        <div class="layer-boundary-line"></div>
        <div class="layer-boundary-badge">
            <span class="layer-boundary-depth">${numberFormatter.format(layer.depth_start_m)} m</span>
            <span class="layer-boundary-name">${layer.vietnamese_name} (${layer.name})</span>
            <span class="layer-boundary-hint" aria-hidden="true">✦ Xem tầng</span>
        </div>
        <div class="layer-boundary-line"></div>
    `;

    const layerItem = createLayerInspectorItem(layer);
    marker.addEventListener('click', () => {
        openInspector(layerItem, marker);
    });

    marker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openInspector(layerItem, marker);
        }
    });

    return marker;
}

/**
 * Tạo phần tử mốc kết thúc hành trình Challenger Deep tại 10.928m
 */
function createEndpointMarker(depthM, title, description, item = null) {
    const point = document.createElement('div');
    point.className = 'journey-endpoint is-interactive';
    point.style.top = `${depthM * PIXELS_PER_METER}px`;
    point.tabIndex = 0;
    point.setAttribute('role', 'button');
    point.setAttribute(
        'aria-label',
        `Xem chi tiết ${item ? item.name : 'Challenger Deep'} ở độ sâu ${numberFormatter.format(depthM)} mét`
    );

    point.innerHTML = `
        <h2>${title}</h2>
        <p>${description}</p>
        <div class="endpoint-action-hint">✦ Nhấp để xem thông tin chi tiết</div>
    `;

    if (item) {
        point.addEventListener('click', () => {
            openInspector(item, point);
        });

        point.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openInspector(item, point);
            }
        });
    }

    return point;
}

/**
 * Sử dụng IntersectionObserver để tối ưu hiển thị hiệu ứng khi cuộn tới gần
 */
function setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-viewport');
            } else {
                entry.target.classList.remove('in-viewport');
            }
        });
    }, {
        rootMargin: '200px 0px 200px 0px',
        threshold: 0.05,
    });

    document.querySelectorAll('.explorer-card, .layer-boundary-marker, .journey-endpoint').forEach((el) => {
        observer.observe(el);
    });
}


