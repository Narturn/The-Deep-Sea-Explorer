/**
 * main.js - Entrypoint khởi tạo The Deep Sea Explorer (Phase 6)
 * Đồng bộ dữ liệu, HUD, môi trường, Scroll Engine, Quick Jump và Inspector Drawer
 */

import { initHUD } from './modules/hud.js';
import { initEnvironment } from './modules/environment.js';
import { initStage } from './modules/stage.js';
import { initScrollEngine } from './modules/scroll_engine.js';
import { initQuickJump } from './modules/quick_jump.js';
import { initInspector } from './modules/inspector.js';

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

    // 3. Khởi tạo Inspector Drawer
    initInspector();

    // 4. Khởi tạo Center Stage Canvas và các mốc ranh giới tầng
    initStage(layers, items);

    // 5. Khởi tạo Quick Jump Navigation
    initQuickJump(layers, items);

    // 6. Khởi tạo Scroll Engine đồng bộ Scroll <-> Depth (0m - 10.928m)
    initScrollEngine(layers);

    console.log(`[DeepSea] Ứng dụng đã sẵn sàng với ${layers.length} tầng đại dương và ${items.length} đối tượng.`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
