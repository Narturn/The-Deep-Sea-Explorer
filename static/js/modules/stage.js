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
        const layoutResults = layoutExplorerItems(itemsToDisplay, isMobile);
        layoutResults.forEach((layoutItem) => {
            const cardNode = createExplorerCardNode(layoutItem);
            trackEl.appendChild(cardNode);
        });
    }

    // 5. Khởi tạo Intersection Observer để tối ưu hiển thị hiệu ứng
    setupIntersectionObserver();
}

/**
 * Thuật toán phát hiện va chạm và phân bố thẻ sang các làn (trái, giữa, phải)
 */
function layoutExplorerItems(items, isMobile) {
    if (!items || items.length === 0) return [];

    // Sắp xếp items theo chiều tăng dần của depth_m
    const sorted = [...items].sort((a, b) => a.depth_m - b.depth_m);

    // Ước tính chiều cao trung bình của thẻ kèm khoảng đệm an toàn
    const CARD_HEIGHT = isMobile ? 210 : 230;
    const GAP = 24;

    // Trên mobile: dồn vào 1 làn căn giữa để phù hợp màn hình nhỏ
    if (isMobile) {
        let lastBottomY = -Infinity;
        return sorted.map((item) => {
            const anchorY = item.depth_m * PIXELS_PER_METER;
            const displayY = Math.max(anchorY, lastBottomY + GAP);
            lastBottomY = displayY + CARD_HEIGHT;
            return {
                item,
                lane: 1, // center
                anchorY,
                displayY,
                hasOffset: Math.abs(displayY - anchorY) > 8,
            };
        });
    }

    // Trên Desktop: 3 làn song song (0: Trái, 1: Giữa, 2: Phải)
    const laneBottoms = [-Infinity, -Infinity, -Infinity];

    return sorted.map((item, idx) => {
        const anchorY = item.depth_m * PIXELS_PER_METER;
        const preferredLane = idx % 3;

        let chosenLane = preferredLane;
        let displayY = anchorY;

        // Thử đặt vào làn ưu tiên nếu không bị va chạm
        if (anchorY >= laneBottoms[preferredLane] + GAP) {
            chosenLane = preferredLane;
            displayY = anchorY;
        } else {
            // Thử 2 làn còn lại xem có làn nào trống tại đúng độ sâu anchorY không
            const otherLane1 = (preferredLane + 1) % 3;
            const otherLane2 = (preferredLane + 2) % 3;

            if (anchorY >= laneBottoms[otherLane1] + GAP) {
                chosenLane = otherLane1;
                displayY = anchorY;
            } else if (anchorY >= laneBottoms[otherLane2] + GAP) {
                chosenLane = otherLane2;
                displayY = anchorY;
            } else {
                // Cả 3 làn đều bị chiếm tại anchorY -> chọn làn kết thúc sớm nhất để hạ thẻ xuống
                let minBottom = laneBottoms[0];
                chosenLane = 0;
                for (let l = 1; l < 3; l++) {
                    if (laneBottoms[l] < minBottom) {
                        minBottom = laneBottoms[l];
                        chosenLane = l;
                    }
                }
                displayY = minBottom + GAP;
            }
        }

        laneBottoms[chosenLane] = displayY + CARD_HEIGHT;

        return {
            item,
            lane: chosenLane,
            anchorY,
            displayY,
            hasOffset: Math.abs(displayY - anchorY) > 8,
        };
    });
}

/**
 * Tạo thẻ hình ảnh ExplorerCard và các mốc chỉ vị trí nếu bị dịch chuyển
 */
function createExplorerCardNode(layoutItem) {
    const { item, lane, anchorY, displayY, hasOffset } = layoutItem;
    const fragment = document.createDocumentFragment();

    const laneClass = lane === 0 ? 'lane-left' : lane === 1 ? 'lane-center' : 'lane-right';

    // 1. Khi thẻ bị dịch chuyển do va chạm với thẻ khác ở độ sâu gần nhau:
    // Tạo mốc neo độ sâu thực tế (anchor pin) và đường nối (connector line)
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
        lineEl.style.top = `${anchorY}px`;
        lineEl.style.height = `${displayY - anchorY}px`;
        fragment.appendChild(lineEl);
    }

    // 2. Thẻ hình ảnh đối tượng thám hiểm (Image Card)
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
                    <span>${item.name}</span>
                </div>
            ` : `
                <div class="card-thumb-placeholder">
                    <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    <span>${item.name}</span>
                </div>
            `}
            <span class="card-type-tag ${typeClass}">${typeLabel}</span>
        </div>
        <div class="card-info">
            <div class="card-header">
                <h3 class="card-title">${item.name}</h3>
                <span class="card-depth-badge">${numberFormatter.format(item.depth_m)} m</span>
            </div>
            ${item.scientific_name ? `<div class="card-scientific">${item.scientific_name}</div>` : ''}
            ${item.short_description ? `<p class="card-desc">${item.short_description}</p>` : ''}
            <div class="card-footer-hint">
                <span>✦ Nhấp để mở chi tiết</span>
                <span class="card-hint-arrow">→</span>
            </div>
        </div>
    `;

    // Click và bàn phím (Enter / Space) để mở Inspector
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


