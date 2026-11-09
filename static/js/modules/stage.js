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
 * Thuật toán phát hiện va chạm, gom cụm tự động và phân bố thẻ theo 3 làn
 * Áp dụng tổng quát cho mọi đối tượng động từ database mà không hardcode
 */
export function layoutExplorerItems(items, isMobile) {
    if (!items || items.length === 0) return [];

    // 1. Sắp xếp danh sách items tăng dần theo depth_m
    const sorted = [...items].sort((a, b) => a.depth_m - b.depth_m);

    // Hằng số kích thước hình học & khoảng cách an toàn
    const CLUSTER_WINDOW_M = 35; // Khoảng độ sâu (35m = 140px) để nhận diện vùng tập trung mật độ cao
    const MAX_ITEMS_PER_WINDOW = isMobile ? 2 : 3; // Ngưỡng dung lượng làn tối đa tại một vùng độ sâu
    const CARD_HEIGHT_ESTIMATE = isMobile ? 210 : 230;
    const CLUSTER_CARD_HEIGHT = isMobile ? 220 : 240;
    const CARD_GAP = 24;
    const MIN_STAGE_TOP = 170; // Tránh va chạm với HUD cố định (72px) và mốc 0m (90px)

    // 2. Gom các đối tượng quá gần nhau thành các nhóm lân cận (Proximity Groups)
    const proximityGroups = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (curr.depth_m - prev.depth_m <= CLUSTER_WINDOW_M) {
            currentGroup.push(curr);
        } else {
            proximityGroups.push(currentGroup);
            currentGroup = [curr];
        }
    }
    if (currentGroup.length > 0) {
        proximityGroups.push(currentGroup);
    }

    // 3. Phân loại: Nhóm vượt quá sức chứa của các làn -> Gom thành Cụm (Cluster); Còn lại -> Thẻ đơn
    const layoutUnits = [];
    proximityGroups.forEach((group) => {
        if (group.length > MAX_ITEMS_PER_WINDOW) {
            // Tự động gom thành cụm có thể mở rộng
            const avgDepth = Math.round(group.reduce((sum, it) => sum + it.depth_m, 0) / group.length);
            layoutUnits.push({
                isCluster: true,
                items: group,
                depth_m: avgDepth,
                anchorY: avgDepth * PIXELS_PER_METER,
            });
        } else {
            // Hiển thị từng thẻ độc lập
            group.forEach((item) => {
                layoutUnits.push({
                    isCluster: false,
                    item: item,
                    depth_m: item.depth_m,
                    anchorY: item.depth_m * PIXELS_PER_METER,
                });
            });
        }
    });

    // 4. Bố cục trên Mobile: 1 làn duy nhất căn giữa
    if (isMobile) {
        let lastBottom = MIN_STAGE_TOP;
        return layoutUnits.map((unit) => {
            const rawTargetY = Math.max(unit.anchorY, MIN_STAGE_TOP);
            const displayY = Math.max(rawTargetY, lastBottom + CARD_GAP);
            const height = unit.isCluster ? CLUSTER_CARD_HEIGHT : CARD_HEIGHT_ESTIMATE;
            lastBottom = displayY + height;

            return {
                ...unit,
                lane: 1, // Làn giữa
                displayY,
                hasOffset: Math.abs(displayY - unit.anchorY) > 8,
            };
        });
    }

    // 5. Bố cục trên Desktop: 3 làn song song [0: Trái, 1: Giữa, 2: Phải]
    const laneBottoms = [MIN_STAGE_TOP, MIN_STAGE_TOP, MIN_STAGE_TOP];

    return layoutUnits.map((unit, idx) => {
        const rawTargetY = Math.max(unit.anchorY, MIN_STAGE_TOP);
        // Cụm ưu tiên đặt ở làn giữa để cân đối thị giác, thẻ đơn ưu tiên xoay vòng 3 làn
        const preferredLane = unit.isCluster ? 1 : (idx % 3);
        const height = unit.isCluster ? CLUSTER_CARD_HEIGHT : CARD_HEIGHT_ESTIMATE;

        let chosenLane = preferredLane;
        let displayY = rawTargetY;

        // Thử đặt vào làn ưu tiên nếu không bị va chạm
        if (rawTargetY >= laneBottoms[preferredLane] + CARD_GAP) {
            chosenLane = preferredLane;
            displayY = rawTargetY;
        } else {
            // Thử các làn còn lại xem có làn nào trống tại đúng độ sâu rawTargetY không
            const candidates = unit.isCluster
                ? [1, 0, 2]
                : [(preferredLane + 1) % 3, (preferredLane + 2) % 3];

            let foundFree = false;
            for (const lane of candidates) {
                if (rawTargetY >= laneBottoms[lane] + CARD_GAP) {
                    chosenLane = lane;
                    displayY = rawTargetY;
                    foundFree = true;
                    break;
                }
            }

            // Nếu cả 3 làn đều bị chiếm tại độ sâu này -> chọn làn kết thúc sớm nhất để hạ thẻ xuống
            if (!foundFree) {
                let minBottom = laneBottoms[0];
                chosenLane = 0;
                for (let l = 1; l < 3; l++) {
                    if (laneBottoms[l] < minBottom) {
                        minBottom = laneBottoms[l];
                        chosenLane = l;
                    }
                }
                displayY = minBottom + CARD_GAP;
            }
        }

        laneBottoms[chosenLane] = displayY + height;

        return {
            ...unit,
            lane: chosenLane,
            displayY,
            hasOffset: Math.abs(displayY - unit.anchorY) > 8,
        };
    });
}

/**
 * Tạo phần tử DOM (Thẻ đơn hoặc Cụm mở rộng) dựa trên kết quả layout
 */
function createExplorerCardNode(layoutUnit) {
    if (layoutUnit.isCluster) {
        return createClusterCardNode(layoutUnit);
    }
    return createSingleCardNode(layoutUnit);
}

/**
 * Tạo Thẻ đơn ExplorerCard
 */
function createSingleCardNode(layoutItem) {
    const { item, lane, anchorY, displayY, hasOffset } = layoutItem;
    const fragment = document.createDocumentFragment();
    const laneClass = lane === 0 ? 'lane-left' : lane === 1 ? 'lane-center' : 'lane-right';

    // 1. Khi thẻ bị dịch chuyển khỏi điểm neo để tránh va chạm:
    // Giữ mốc neo tại chính xác depth_m * 4px và vẽ đường nối đến vị trí hiển thị
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
 * Tạo Thẻ cụm mở rộng (Cluster Card) khi có nhiều đối tượng tập trung tại một vùng độ sâu
 */
function createClusterCardNode(layoutUnit) {
    const { items, depth_m, lane, anchorY, displayY, hasOffset } = layoutUnit;
    const fragment = document.createDocumentFragment();
    const laneClass = lane === 0 ? 'lane-left' : lane === 1 ? 'lane-center' : 'lane-right';

    // 1. Mốc neo độ sâu thực tế & đường nối nếu cụm bị dịch chuyển
    if (hasOffset) {
        const anchorEl = document.createElement('div');
        anchorEl.className = `card-depth-anchor ${laneClass}`;
        anchorEl.style.top = `${anchorY}px`;
        anchorEl.innerHTML = `
            <span class="anchor-pin-dot" style="background: var(--hud-accent-teal); box-shadow: 0 0 10px var(--hud-accent-teal);"></span>
            <span class="anchor-pin-label" style="color: var(--hud-accent-teal); border-color: rgba(45, 212, 191, 0.4);">~${numberFormatter.format(depth_m)} m</span>
        `;
        fragment.appendChild(anchorEl);

        const lineEl = document.createElement('div');
        lineEl.className = `card-connector-line ${laneClass}`;
        const topY = Math.min(anchorY, displayY);
        const heightY = Math.abs(displayY - anchorY);
        lineEl.style.top = `${topY}px`;
        lineEl.style.height = `${heightY}px`;
        lineEl.style.borderLeftColor = 'rgba(45, 212, 191, 0.45)';
        fragment.appendChild(lineEl);
    }

    // 2. Thẻ cụm (Cluster Card)
    const clusterCard = document.createElement('div');
    clusterCard.className = `explorer-cluster-card ${laneClass}`;
    clusterCard.style.top = `${displayY}px`;

    // Đếm số lượng sinh vật và cột mốc trong cụm
    const creatureCount = items.filter((it) => it.item_type === 'CREATURE').length;
    const milestoneCount = items.length - creatureCount;
    const countSummary = [
        creatureCount > 0 ? `${creatureCount} sinh vật` : '',
        milestoneCount > 0 ? `${milestoneCount} cột mốc` : '',
    ].filter(Boolean).join(' • ');

    // Hiển thị tối đa 3 item xem trước trong chế độ thu gọn
    const previewItems = items.slice(0, 3);
    const hiddenCount = items.length - previewItems.length;

    clusterCard.innerHTML = `
        <div class="cluster-card-header">
            <div class="cluster-header-title-row">
                <div class="cluster-badge-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <div class="cluster-header-titles">
                    <span class="cluster-title">Cụm đối tượng thám hiểm</span>
                    <span class="cluster-depth">~${numberFormatter.format(depth_m)} m • ${countSummary}</span>
                </div>
                <span class="cluster-total-pill">${items.length}</span>
            </div>
        </div>

        <div class="cluster-preview-list">
            ${previewItems.map((it) => `
                <div class="cluster-mini-item" data-id="${it.id}" role="button" tabindex="0" aria-label="Xem ${it.name}">
                    <div class="cluster-mini-thumb">
                        ${it.image_url
                            ? `<img src="${it.image_url}" alt="${it.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                               <div class="cluster-mini-placeholder" style="display: none;">●</div>`
                            : `<div class="cluster-mini-placeholder">●</div>`}
                    </div>
                    <div class="cluster-mini-info">
                        <span class="cluster-mini-name">${it.name}</span>
                        <span class="cluster-mini-type">${it.item_type === 'CREATURE' ? 'Sinh vật' : 'Cột mốc'} • ${numberFormatter.format(it.depth_m)} m</span>
                    </div>
                    <span class="cluster-mini-arrow">→</span>
                </div>
            `).join('')}
        </div>

        <div class="cluster-expanded-container" style="display: none;">
            <div class="cluster-expanded-list">
                ${items.map((it) => `
                    <div class="cluster-expanded-item" data-id="${it.id}" role="button" tabindex="0" aria-label="Xem ${it.name}">
                        <div class="cluster-mini-thumb">
                            ${it.image_url
                                ? `<img src="${it.image_url}" alt="${it.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                   <div class="cluster-mini-placeholder" style="display: none;">●</div>`
                                : `<div class="cluster-mini-placeholder">●</div>`}
                        </div>
                        <div class="cluster-mini-info">
                            <span class="cluster-mini-name">${it.name}</span>
                            <span class="cluster-mini-type">${it.item_type === 'CREATURE' ? 'Sinh vật' : 'Cột mốc'} • ${numberFormatter.format(it.depth_m)} m</span>
                        </div>
                        <span class="cluster-mini-arrow">→</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <button class="cluster-toggle-btn" type="button" aria-expanded="false">
            <span class="toggle-btn-label">▾ Xem tất cả ${items.length} đối tượng</span>
        </button>
    `;

    // Gắn sự kiện click mở Inspector cho từng đối tượng trong cụm
    const attachItemClickListeners = (container) => {
        container.querySelectorAll('[data-id]').forEach((el) => {
            const itemId = parseInt(el.getAttribute('data-id'), 10);
            const targetItem = items.find((it) => it.id === itemId);
            if (targetItem) {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openInspector(targetItem, el);
                });
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        openInspector(targetItem, el);
                    }
                });
            }
        });
    };

    const previewList = clusterCard.querySelector('.cluster-preview-list');
    const expandedContainer = clusterCard.querySelector('.cluster-expanded-container');
    const toggleBtn = clusterCard.querySelector('.cluster-toggle-btn');
    const toggleLabel = clusterCard.querySelector('.toggle-btn-label');

    attachItemClickListeners(previewList);
    attachItemClickListeners(expandedContainer);

    // Xử lý nút mở rộng / thu gọn danh sách cụm
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            expandedContainer.style.display = 'none';
            previewList.style.display = 'flex';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleLabel.textContent = `▾ Xem tất cả ${items.length} đối tượng`;
            clusterCard.classList.remove('is-expanded');
        } else {
            expandedContainer.style.display = 'block';
            previewList.style.display = 'none';
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleLabel.textContent = `▴ Thu gọn danh sách`;
            clusterCard.classList.add('is-expanded');
        }
    });

    fragment.appendChild(clusterCard);
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

    document.querySelectorAll('.explorer-card, .explorer-cluster-card, .layer-boundary-marker, .journey-endpoint').forEach((el) => {
        observer.observe(el);
    });
}


