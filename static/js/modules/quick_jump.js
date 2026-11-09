/**
 * quick_jump.js - Điều hướng nhảy nhanh (Quick Jump Navigation)
 */

import { MAX_DEPTH_M, PIXELS_PER_METER } from './physics.js';

let panelEl = null;
let triggerBtn = null;
let closeBtn = null;
let isOpen = false;

const numberFormatter = new Intl.NumberFormat('vi-VN');

/**
 * Khởi tạo menu Quick Jump
 */
export function initQuickJump(layers, items) {
    panelEl = document.getElementById('quick-jump-panel');
    triggerBtn = document.getElementById('quick-jump-trigger');
    closeBtn = document.getElementById('quick-jump-close');

    if (!panelEl || !triggerBtn) return;

    // Render danh sách các tầng và các đối tượng
    populateQuickJumpMenu(layers, items);

    // Sự kiện mở / đóng
    triggerBtn.addEventListener('click', toggleQuickJump);
    if (closeBtn) {
        closeBtn.addEventListener('click', closeQuickJump);
    }

    // Đóng khi click ngoài panel
    document.addEventListener('click', (e) => {
        if (isOpen && !panelEl.contains(e.target) && !triggerBtn.contains(e.target)) {
            closeQuickJump();
        }
    });

    // Đóng khi nhấn phím Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeQuickJump();
        }
    });
}

/**
 * Bật / tắt hiển thị Quick Jump panel
 */
export function toggleQuickJump() {
    if (isOpen) {
        closeQuickJump();
    } else {
        openQuickJump();
    }
}

export function openQuickJump() {
    if (!panelEl) return;
    panelEl.classList.add('open');
    panelEl.setAttribute('aria-hidden', 'false');
    triggerBtn.setAttribute('aria-expanded', 'true');
    isOpen = true;

    // Tự động focus vào nút đóng hoặc item đầu tiên
    const firstBtn = panelEl.querySelector('button');
    if (firstBtn) firstBtn.focus();
}

export function closeQuickJump() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    panelEl.setAttribute('aria-hidden', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    isOpen = false;
    triggerBtn.focus();
}

/**
 * Đổ dữ liệu các tầng đại dương và các đối tượng vào menu
 */
function populateQuickJumpMenu(layers, items) {
    const layersListEl = document.getElementById('quick-jump-layers-list');
    const itemsListEl = document.getElementById('quick-jump-items-list');
    const itemsSectionEl = document.getElementById('quick-jump-items-section');

    if (layersListEl && layers) {
        layersListEl.innerHTML = '';
        layers.forEach((layer) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-jump-item-btn';
            btn.innerHTML = `
                <span class="quick-jump-item-name">${layer.vietnamese_name}</span>
                <span class="quick-jump-item-depth">${numberFormatter.format(layer.depth_start_m)} m</span>
            `;
            btn.addEventListener('click', () => {
                jumpToDepth(layer.depth_start_m, layer.vietnamese_name);
            });
            li.appendChild(btn);
            layersListEl.appendChild(li);
        });

        // Bổ sung mốc đáy vực Challenger Deep 10.928m
        const liEnd = document.createElement('li');
        const btnEnd = document.createElement('button');
        btnEnd.type = 'button';
        btnEnd.className = 'quick-jump-item-btn';
        btnEnd.innerHTML = `
            <span class="quick-jump-item-name" style="color: var(--hud-accent-teal);">Challenger Deep</span>
            <span class="quick-jump-item-depth">${numberFormatter.format(MAX_DEPTH_M)} m</span>
        `;
        btnEnd.addEventListener('click', () => {
            jumpToDepth(MAX_DEPTH_M, 'Challenger Deep');
        });
        liEnd.appendChild(btnEnd);
        layersListEl.appendChild(liEnd);
    }

    if (itemsListEl) {
        itemsListEl.innerHTML = '';
        if (items && items.length > 0) {
            if (itemsSectionEl) itemsSectionEl.style.display = 'block';
            items.forEach((item) => {
                const li = document.createElement('li');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quick-jump-item-btn';
                btn.innerHTML = `
                    <span class="quick-jump-item-name">${item.name}</span>
                    <span class="quick-jump-item-depth">${numberFormatter.format(item.depth_m)} m</span>
                `;
                btn.addEventListener('click', () => {
                    jumpToDepth(item.depth_m, item.name);
                });
                li.appendChild(btn);
                itemsListEl.appendChild(li);
            });
        } else {
            if (itemsSectionEl) itemsSectionEl.style.display = 'none';
        }
    }
}

/**
 * Cuộn mượt đến độ sâu chỉ định và phát xung tín hiệu chạm đích
 */
export function jumpToDepth(depthM, targetName) {
    closeQuickJump();

    const clampedDepth = Math.max(0, Math.min(MAX_DEPTH_M, depthM));
    const targetScrollY = clampedDepth * PIXELS_PER_METER;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    window.scrollTo({
        top: targetScrollY,
        behavior: scrollBehavior,
    });

    // Hiển thị phản hồi trực quan khi chạm đích
    showArrivalFeedback(clampedDepth, targetName);
}

/**
 * Hiệu ứng nhịp xung chạm đích
 */
function showArrivalFeedback(depthM, targetName) {
    // Xóa indicator cũ nếu đang tồn tại
    const existing = document.querySelector('.destination-arrival-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'destination-arrival-indicator';
    indicator.textContent = `🎯 ${targetName} (${numberFormatter.format(depthM)} m)`;
    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.remove();
    }, 1300);
}

