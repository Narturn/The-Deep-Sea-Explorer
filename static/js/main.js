/**
 * main.js - Entrypoint khởi tạo Frontend Core (Phase 5)
 * Đồng bộ dữ liệu, HUD, môi trường và Scroll Engine
 */

import { initHUD } from './modules/hud.js';
import { initEnvironment } from './modules/environment.js';
import { initStage } from './modules/stage.js';
import { initScrollEngine } from './modules/scroll_engine.js';

function bootstrap() {
    const layersElement = document.getElementById('ocean-layers-data');
    const itemsElement = document.getElementById('explorer-items-data');

    let layers = [];
    let items = [];

    if (layersElement) {
        try {
            layers = JSON.parse(layersElement.textContent);
        } catch (err) {
            console.error('[DeepSea] Lỗi parse ocean-layers-data:', err);
        }
    }

    if (itemsElement) {
        try {
            items = JSON.parse(itemsElement.textContent);
        } catch (err) {
            console.error('[DeepSea] Lỗi parse explorer-items-data:', err);
        }
    }

    // Đưa dữ liệu vào namespace toàn cục
    window.__DEEP_SEA_DATA__ = {
        layers,
        items,
        isLoaded: true,
    };

    // 1. Khởi tạo liên kết HUD DOM
    initHUD();

    // 2. Khởi tạo hiệu ứng môi trường (Đèn pha chuột + hạt phát sáng)
    initEnvironment();

    // 3. Khởi tạo Center Stage Canvas và các mốc ranh giới tầng
    initStage(layers, items);

    // 4. Khởi tạo Scroll Engine đồng bộ Scroll <-> Depth (0m - 10.928m)
    initScrollEngine(layers);

    console.log(`[DeepSea] Frontend Core đã sẵn sàng với ${layers.length} tầng đại dương và ${items.length} đối tượng.`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
