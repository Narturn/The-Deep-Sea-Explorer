/**
 * scroll_engine.js - Động cơ tính toán và đồng bộ vị trí cuộn (Scroll <-> Depth)
 */

import {
    MAX_DEPTH_M,
    PIXELS_PER_METER,
    calculatePressure,
    calculateTemperature,
    interpolateOceanColor,
    getActiveLayer,
} from './physics.js';
import { updateHUD } from './hud.js';
import { updateOceanBackground } from './environment.js';

let layersData = [];
let maxScrollableY = MAX_DEPTH_M * PIXELS_PER_METER;
let isTicking = false;

/**
 * Khởi tạo Scroll Engine
 */
export function initScrollEngine(layers) {
    layersData = layers || [];
    updateScrollBounds();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // Cập nhật trạng thái tức thì tại vị trí hiện tại của trang
    handleScrollUpdate();
}

/**
 * Cập nhật giới hạn cuộn để đồng bộ hệ quy chiếu
 */
function updateScrollBounds() {
    maxScrollableY = MAX_DEPTH_M * PIXELS_PER_METER;

    // Đảm bảo không gian cuộn cho phép mốc 10.928m đến đúng đỉnh viewport
    const stageEl = document.getElementById('ocean-stage');
    if (stageEl) {
        stageEl.style.paddingBottom = `${window.innerHeight}px`;
    }
}

/**
 * Xử lý sự kiện resize
 */
function onResize() {
    updateScrollBounds();
    handleScrollUpdate();
}

/**
 * Xử lý sự kiện scroll với requestAnimationFrame
 */
function onScroll() {
    if (!isTicking) {
        window.requestAnimationFrame(() => {
            handleScrollUpdate();
            isTicking = false;
        });
        isTicking = true;
    }
}

/**
 * Tính toán độ sâu và cập nhật toàn bộ hệ thống
 */
function handleScrollUpdate() {
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Tính tỷ lệ cuộn chuẩn hóa từ 0.0 đến 1.0
    const progress = Math.min(1, Math.max(0, scrollY / maxScrollableY));

    // Tính độ sâu hiện tại (m)
    let currentDepth = progress * MAX_DEPTH_M;

    // Đảm bảo ở điểm cuối hành trình đạt chính xác 10.928m
    if (scrollY >= maxScrollableY - 2) {
        currentDepth = MAX_DEPTH_M;
    } else if (scrollY <= 0) {
        currentDepth = 0;
    }

    // Tính toán các chỉ số môi trường
    const pressure = calculatePressure(currentDepth);
    const temperature = calculateTemperature(currentDepth);
    const activeLayer = getActiveLayer(currentDepth, layersData);
    const oceanColor = interpolateOceanColor(currentDepth);

    // Cập nhật HUD và Màu nền môi trường
    updateHUD(currentDepth, activeLayer, pressure, temperature);
    updateOceanBackground(oceanColor);
}

/**
 * Getter độ sâu hiện tại từ vị trí cuộn
 */
export function getCurrentDepth() {
    const scrollY = window.scrollY || 0;
    const progress = Math.min(1, Math.max(0, scrollY / maxScrollableY));
    return Math.round(progress * MAX_DEPTH_M);
}

