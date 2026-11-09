/**
 * stage.js - Quản lý Center Stage, bố trí các mốc tầng và đối tượng thám hiểm
 */

import { MAX_DEPTH_M, PIXELS_PER_METER } from './physics.js';
import { openInspector } from './inspector.js';

const numberFormatter = new Intl.NumberFormat('vi-VN');

/**
 * Khởi tạo và kết xuất cấu trúc sân khấu hành trình
 */
export function initStage(layers, items) {
    const trackEl = document.getElementById('vertical-track');
    if (!trackEl) return;

    // Chiều cao track chính xác theo tỷ lệ 1m = 4px
    const trackHeight = MAX_DEPTH_M * PIXELS_PER_METER;
    trackEl.style.height = `${trackHeight}px`;

    // Tập hợp ID các item đã được gắn trực tiếp vào marker để tránh render card trùng lặp
    const handledItemIds = new Set();

    // 1. Tạo điểm khởi đầu tại 0m: Tầng Nắng rọi (Epipelagic)
    const layer0 = layers && layers.length > 0 ? layers[0] : null;
    const startMilestone = items ? items.find((i) => i.depth_m === 0 && i.item_type === 'MILESTONE') : null;
    if (startMilestone) {
        handledItemIds.add(startMilestone.id);
    }
    const startPoint = createEndpointMarker(
        0,
        layer0 ? `${layer0.vietnamese_name} (${layer0.name})` : 'Tầng Nắng rọi (Epipelagic)',
        '0 m – Mặt biển • Bắt đầu hành trình thám hiểm xuống vùng biển sâu thẳm nhất hành tinh',
        startMilestone
    );
    trackEl.appendChild(startPoint);

    // 2. Tạo các mốc ranh giới tầng đại dương (hiển thị tầng bắt đầu tại độ sâu đó)
    if (layers && layers.length > 0) {
        layers.forEach((layer) => {
            // Đặt marker ranh giới tại mốc bắt đầu của các tầng (từ 200m trở đi)
            if (layer.depth_start_m > 0) {
                const milestone = items ? items.find(
                    (i) => i.depth_m === layer.depth_start_m && i.item_type === 'MILESTONE'
                ) : null;

                if (milestone) {
                    handledItemIds.add(milestone.id);
                }

                const marker = createLayerBoundaryMarker(
                    layer.depth_start_m,
                    layer.vietnamese_name,
                    layer.name,
                    milestone
                );
                trackEl.appendChild(marker);
            }
        });
    }

    // 3. Tạo điểm kết thúc tại Challenger Deep 10.928m
    const challengerMilestone = items ? items.find(
        (i) => i.depth_m === MAX_DEPTH_M && i.item_type === 'MILESTONE'
    ) : null;

    if (challengerMilestone) {
        handledItemIds.add(challengerMilestone.id);
    }

    // Khi có ExplorerItem loại MILESTONE được publish tại 10.928m, lấy dữ liệu từ database.
    // Nếu chưa có dữ liệu trong DB, hiển thị placeholder thông báo nội dung đang được cập nhật.
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

    // 4. Bố trí các đối tượng thám hiểm (ExplorerItem) nếu có (loại trừ các item đã gộp vào marker)
    if (items && items.length > 0) {
        items.forEach((item) => {
            if (!handledItemIds.has(item.id)) {
                const itemNode = createExplorerItemNode(item);
                trackEl.appendChild(itemNode);
            }
        });
    }

    // 5. Khởi tạo Intersection Observer để tối ưu hiển thị
    setupIntersectionObserver();
}

/**
 * Tạo phần tử mốc ranh giới tầng
 */
function createLayerBoundaryMarker(depthM, viName, enName, item = null) {
    const marker = document.createElement('div');
    marker.className = 'layer-boundary-marker';
    marker.style.top = `${depthM * PIXELS_PER_METER}px`;

    marker.innerHTML = `
        <div class="layer-boundary-line"></div>
        <div class="layer-boundary-badge">
            <span class="layer-boundary-depth">${numberFormatter.format(depthM)} m</span>
            <span class="layer-boundary-name">${viName} (${enName})</span>
        </div>
        <div class="layer-boundary-line"></div>
    `;

    // Nếu có đối tượng cột mốc gắn với ranh giới này, kích hoạt khả năng mở Inspector
    if (item) {
        marker.classList.add('is-interactive');
        marker.tabIndex = 0;
        marker.setAttribute('role', 'button');
        marker.setAttribute(
            'aria-label',
            `Xem chi tiết cột mốc ${item.name} ở độ sâu ${numberFormatter.format(depthM)} mét`
        );

        marker.addEventListener('click', () => {
            openInspector(item, marker);
        });

        marker.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openInspector(item, marker);
            }
        });
    }

    return marker;
}

/**
 * Tạo phần tử mốc đầu/cuối hành trình
 */
function createEndpointMarker(depthM, title, description, item = null) {
    const point = document.createElement('div');
    point.className = 'journey-endpoint';
    if (depthM === 0) {
        point.classList.add('start-point');
        point.style.top = '90px';
    } else {
        point.style.top = `${depthM * PIXELS_PER_METER}px`;
    }

    point.innerHTML = `
        <h2>${title}</h2>
        <p>${description}</p>
        ${item ? '<div class="endpoint-action-hint" style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--hud-accent-cyan);">✦ Nhấp để xem thông tin chi tiết</div>' : ''}
    `;

    if (item) {
        point.classList.add('is-interactive');
        point.tabIndex = 0;
        point.setAttribute('role', 'button');
        point.setAttribute(
            'aria-label',
            `Xem chi tiết ${item.name} ở độ sâu ${numberFormatter.format(depthM)} mét`
        );

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
 * Tạo phần tử hiển thị đối tượng thám hiểm
 */
function createExplorerItemNode(item) {
    const node = document.createElement('div');
    node.className = 'explorer-item-node';
    node.id = `item-${item.slug}`;
    node.style.top = `${item.depth_m * PIXELS_PER_METER}px`;
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Xem thông tin ${item.name} ở độ sâu ${numberFormatter.format(item.depth_m)} mét`);

    node.innerHTML = `
        <div class="explorer-item-header">
            <span class="explorer-item-name">${item.name}</span>
            <span class="explorer-item-depth">${numberFormatter.format(item.depth_m)} m</span>
        </div>
        ${item.scientific_name ? `<div class="explorer-item-scientific">${item.scientific_name}</div>` : ''}
        ${item.short_description ? `<p class="explorer-item-desc">${item.short_description}</p>` : ''}
    `;

    // Mở Inspector Drawer khi click hoặc ấn Enter/Space
    node.addEventListener('click', () => {
        openInspector(item, node);
    });

    node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openInspector(item, node);
        }
    });

    return node;
}

/**
 * Sử dụng IntersectionObserver để chỉ kích hoạt animation khi đối tượng sắp vào viewport
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

    document.querySelectorAll('.explorer-item-node, .layer-boundary-marker, .journey-endpoint').forEach((el) => {
        observer.observe(el);
    });
}

