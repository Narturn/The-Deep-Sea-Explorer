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

    // 1. Tạo mốc ranh giới 0m ngay dưới Fixed HUD (72px)
    const layer0 = layers && layers.length > 0 ? layers[0] : null;
    const surfaceMarker = createSurfaceBoundaryMarker(layer0);
    trackEl.appendChild(surfaceMarker);

    // 2. Tạo ô giới thiệu Tầng Nắng rọi tại 0m (Epipelagic)
    const startPoint = createStartPointMarker(layer0);
    trackEl.appendChild(startPoint);

    // 3. Tạo các mốc ranh giới tầng đại dương (200m, 1.000m, 4.000m, 6.000m)
    if (layers && layers.length > 0) {
        layers.forEach((layer) => {
            if (layer.depth_start_m > 0) {
                const marker = createLayerBoundaryMarker(layer);
                trackEl.appendChild(marker);
            }
        });
    }

    // 4. Tạo điểm kết thúc tại Challenger Deep 10.928m
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

    // 5. Bố trí các đối tượng thám hiểm (ExplorerItem) có is_published=True
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

    // 6. Khởi tạo Intersection Observer để tối ưu hiển thị hiệu ứng
    setupIntersectionObserver();
}

/**
 * Thuật toán bố trí Explorer Cards và Nhãn độ sâu:
 * - Giữ điểm neo thật tại chính xác depth_m * 4px.
 * - Nhãn độ sâu tự động tránh Fixed HUD, tránh ô giới thiệu tầng, tránh đè lên card và nhãn khác.
 * - Khi nhãn bị trùng hoặc vướng vật cản, tự động dịch chuyển và dùng đường nối về điểm neo thật.
 * - Cards sắp xếp theo 3 làn, phát hiện va chạm tự động.
 */
export function layoutExplorerItems(items, isMobile, layers = []) {
    if (!items || items.length === 0) return [];

    // 1. Sắp xếp items theo depth_m tăng dần
    const sorted = [...items].sort((a, b) => a.depth_m - b.depth_m);

    // Kích thước card gọn gàng thực tế
    const CARD_HEIGHT = isMobile ? 135 : 140;
    const CARD_GAP = 16;

    // Khoảng đệm an toàn đỉnh: Tránh che ô giới thiệu Tầng Nắng rọi (130px + ~150px = ~280px)
    const START_CLEARANCE_Y = 295;

    // Danh sách tọa độ Y của các mốc ranh giới tầng đại dương để tránh card làn giữa đè lên badge
    const boundaryPositions = (layers || [])
        .filter((l) => l.depth_start_m > 0)
        .map((l) => l.depth_start_m * PIXELS_PER_METER);

    const collidesWithBoundaryBadge = (targetY) => {
        return boundaryPositions.some((bY) => {
            return targetY <= bY + 25 && targetY + CARD_HEIGHT >= bY - 25;
        });
    };

    // Bước 1: Tính toán vị trí displayY và lane cho từng Explorer Card
    let rawLayoutItems = [];

    if (isMobile) {
        let lastBottom = START_CLEARANCE_Y;
        rawLayoutItems = sorted.map((item) => {
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
                lane: 1, // Làn giữa trên mobile
                anchorY,
                displayY,
                hasOffset: Math.abs(displayY - anchorY) > 6,
            };
        });
    } else {
        // Trên desktop: 3 làn song song [0: Trái, 1: Giữa, 2: Phải]
        const laneBottoms = [START_CLEARANCE_Y, START_CLEARANCE_Y, START_CLEARANCE_Y];

        rawLayoutItems = sorted.map((item, idx) => {
            const anchorY = item.depth_m * PIXELS_PER_METER;
            const rawTargetY = Math.max(anchorY, START_CLEARANCE_Y);

            // Với các vật thể gần mặt biển (< 70m), ưu tiên hai làn Trái và Phải để giữ khoảng giữa thoáng cho ô giới thiệu
            const preferredLane = anchorY < START_CLEARANCE_Y
                ? (idx % 2 === 0 ? 0 : 2)
                : (idx % 3);

            const laneCandidates = [preferredLane, (preferredLane + 1) % 3, (preferredLane + 2) % 3];

            let chosenLane = preferredLane;
            let displayY = rawTargetY;
            let placed = false;

            for (const lane of laneCandidates) {
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

    // Bước 2: Tính toán vị trí nhãn độ sâu (labelY, labelLane) tránh va chạm HUD, ô giới thiệu, card và nhãn khác
    // Theo dõi các khoảng [top, bottom] của nhãn đã được đặt trên từng làn
    const placedLabelsByLane = { 0: [], 1: [], 2: [] };
    const LABEL_HEIGHT = 24;
    const LABEL_MIN_GAP = 6;
    const MIN_HUD_CLEARANCE_Y = 96; // Tránh Fixed HUD (72px) và Surface Marker (74px)

    return rawLayoutItems.map((layoutItem) => {
        const { item, lane, anchorY, displayY } = layoutItem;

        // Chọn làn cho nhãn:
        // Nếu ở gần mặt biển (anchorY < 290px) và ở Desktop, nếu card ở lane 1 (giữa) thì nhãn chuyển sang lane 0 (trái)
        // để tuyệt đối không đè lên ô giới thiệu tầng ở chính giữa
        let labelLane = lane;
        if (!isMobile && anchorY < 290 && lane === 1) {
            labelLane = 0;
        }

        // Bắt đầu vị trí nhãn tại anchorY thực tế
        let targetLabelY = anchorY;

        // 1. Không để nhãn đè lên Fixed HUD và mốc 0m surface marker
        if (targetLabelY < MIN_HUD_CLEARANCE_Y) {
            targetLabelY = MIN_HUD_CLEARANCE_Y;
        }

        // 2. Không để nhãn đè lên ô giới thiệu tầng (Vùng Y từ 120px đến 285px)
        if (isMobile) {
            // Trên mobile, ô giới thiệu chiếm 90% chiều rộng ở giữa
            if (targetLabelY >= 115 && targetLabelY <= 285) {
                targetLabelY = 290;
            }
        } else if (labelLane === 1) {
            // Trên desktop, chỉ làn giữa mới trùng ô giới thiệu
            if (targetLabelY >= 115 && targetLabelY <= 285) {
                targetLabelY = 290;
            }
        }

        // 3. Không để nhãn đè lên các Explorer Card khác đã bố trí trong cùng làn
        for (const other of rawLayoutItems) {
            if (other.item.id !== item.id && other.lane === labelLane) {
                const cardTop = other.displayY;
                const cardBottom = other.displayY + CARD_HEIGHT;
                // Nếu targetLabelY nằm trong card của item khác
                if (targetLabelY >= cardTop - 10 && targetLabelY <= cardBottom + 10) {
                    if (anchorY < cardTop) {
                        targetLabelY = Math.max(MIN_HUD_CLEARANCE_Y, cardTop - 14);
                    } else {
                        targetLabelY = cardBottom + 14;
                    }
                }
            }
        }

        // 4. Tránh trùng với các nhãn độ sâu khác đã đặt trong cùng làn
        const lanePlaced = placedLabelsByLane[labelLane] || [];
        let resolved = false;
        let attempts = 0;

        while (!resolved && attempts < 20) {
            attempts++;
            const myTop = targetLabelY - LABEL_HEIGHT / 2;
            const myBottom = targetLabelY + LABEL_HEIGHT / 2;

            const collision = lanePlaced.find((p) => {
                return myTop <= p.bottom + LABEL_MIN_GAP && myBottom >= p.top - LABEL_MIN_GAP;
            });

            if (collision) {
                targetLabelY = collision.bottom + LABEL_MIN_GAP + LABEL_HEIGHT / 2;
            } else {
                resolved = true;
            }
        }

        // Lưu vùng nhãn đã đặt vào danh sách theo làn
        const finalTop = targetLabelY - LABEL_HEIGHT / 2;
        const finalBottom = targetLabelY + LABEL_HEIGHT / 2;
        placedLabelsByLane[labelLane].push({ top: finalTop, bottom: finalBottom });

        // Cập nhật hasOffset nếu card bị dịch chuyển HOẶC nhãn bị dịch chuyển khỏi anchor
        const hasOffset = Math.abs(displayY - anchorY) > 6 || Math.abs(targetLabelY - anchorY) > 6;

        return {
            ...layoutItem,
            labelLane,
            labelY: targetLabelY,
            hasOffset,
        };
    });
}

/**
 * Tạo thẻ hình ảnh ExplorerCard riêng biệt, gọn gàng cho từng đối tượng
 */
function createExplorerCardNode(layoutItem) {
    const { item, lane, labelLane, anchorY, labelY, displayY, hasOffset } = layoutItem;
    const fragment = document.createDocumentFragment();
    const laneClass = lane === 0 ? 'lane-left' : lane === 1 ? 'lane-center' : 'lane-right';
    const labelLaneClass = labelLane === 0 ? 'lane-left' : labelLane === 1 ? 'lane-center' : 'lane-right';

    // 1. Mốc neo độ sâu thực tế & Nhãn độ sâu & Đường nối khi card hoặc nhãn bị dịch chuyển
    if (hasOffset) {
        // Điểm neo thực tế giữ chính xác tại anchorY = depth_m * 4px
        const pinEl = document.createElement('div');
        pinEl.className = `card-depth-pin ${labelLaneClass}`;
        pinEl.style.top = `${anchorY}px`;
        pinEl.innerHTML = `<span class="anchor-pin-dot" title="Tọa độ thực tế: ${numberFormatter.format(item.depth_m)} m"></span>`;
        fragment.appendChild(pinEl);

        // Nhãn độ sâu hiển thị tại labelY (được thuật toán dịch chuyển để tránh HUD, ô giới thiệu, card và nhãn khác)
        const labelEl = document.createElement('div');
        labelEl.className = `card-depth-anchor ${labelLaneClass}`;
        labelEl.style.top = `${labelY}px`;
        labelEl.innerHTML = `
            <span class="anchor-pin-label">${numberFormatter.format(item.depth_m)} m</span>
        `;
        fragment.appendChild(labelEl);

        // Đường nối liên tục từ điểm neo thực tế qua nhãn đến card
        const lineEl = document.createElement('div');
        lineEl.className = `card-connector-line ${labelLaneClass}`;
        const topY = Math.min(anchorY, labelY, displayY);
        const bottomY = Math.max(anchorY, labelY, displayY);
        const heightY = bottomY - topY;
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
 * Tạo mốc ranh giới 0m (Surface Boundary Marker) ngay dưới mép dưới Fixed HUD (72px)
 */
function createSurfaceBoundaryMarker(layer0) {
    const marker = document.createElement('div');
    marker.className = 'layer-boundary-marker surface-marker is-interactive';
    marker.style.top = '74px'; // Ngay bên dưới Fixed HUD 72px
    marker.tabIndex = 0;
    marker.setAttribute('role', 'button');
    marker.setAttribute(
        'aria-label',
        layer0
            ? `Xem thông tin tầng ${layer0.vietnamese_name} (${layer0.name}) từ 0 m`
            : 'Xem thông tin mốc 0 m Tầng Nắng rọi'
    );

    const layerName = layer0 ? `${layer0.vietnamese_name} (${layer0.name})` : 'Tầng Nắng rọi (Epipelagic)';
    marker.innerHTML = `
        <div class="layer-boundary-line"></div>
        <div class="layer-boundary-badge">
            <span class="layer-boundary-depth">0 m</span>
            <span class="layer-boundary-name">${layerName}</span>
            <span class="layer-boundary-hint" aria-hidden="true">✦ Xem tầng</span>
        </div>
        <div class="layer-boundary-line"></div>
    `;

    const layerItem = layer0 ? createLayerInspectorItem(layer0) : null;
    if (layerItem) {
        marker.addEventListener('click', () => {
            openInspector(layerItem, marker);
        });

        marker.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openInspector(layerItem, marker);
            }
        });
    }

    return marker;
}

/**
 * Tạo ô giới thiệu tầng khởi đầu tại 0m tương tác mở thông tin Tầng Nắng rọi (Epipelagic)
 */
function createStartPointMarker(layer0) {
    const point = document.createElement('div');
    point.className = 'journey-endpoint start-point is-interactive';
    point.style.top = '130px';
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


