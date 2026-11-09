/**
 * hud.js - Quản lý giao diện thanh điều khiển và trạng thái Fixed HUD
 */

import { MAX_DEPTH_M } from './physics.js';

let depthValueEl = null;
let layerBadgeEl = null;
let pressureValueEl = null;
let tempValueEl = null;
let progressFillEl = null;

const numberFormatter = new Intl.NumberFormat('vi-VN');

/**
 * Khởi tạo liên kết DOM của HUD
 */
export function initHUD() {
    depthValueEl = document.getElementById('depth-counter-value');
    layerBadgeEl = document.getElementById('hud-layer-badge');
    pressureValueEl = document.getElementById('env-pressure-value');
    tempValueEl = document.getElementById('env-temp-value');
    progressFillEl = document.getElementById('hud-progress-fill');
}

/**
 * Cập nhật các chỉ số trên HUD theo thời gian thực
 */
export function updateHUD(depthM, activeLayer, pressureAtm, tempCelsius) {
    if (depthValueEl) {
        depthValueEl.textContent = numberFormatter.format(Math.round(depthM));
    }

    if (layerBadgeEl && activeLayer) {
        layerBadgeEl.textContent = activeLayer.vietnamese_name;
    }

    if (pressureValueEl) {
        pressureValueEl.textContent = `${pressureAtm.toFixed(1)} atm`;
    }

    if (tempValueEl) {
        tempValueEl.textContent = `${tempCelsius.toFixed(1)}°C`;
    }

    if (progressFillEl) {
        const percent = Math.min(100, Math.max(0, (depthM / MAX_DEPTH_M) * 100));
        progressFillEl.style.width = `${percent}%`;
    }
}

