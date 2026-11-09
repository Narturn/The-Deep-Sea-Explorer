/**
 * The Deep Sea Explorer - Client Data Initialization (Phase 4)
 * Đọc dữ liệu JSON an toàn từ server thông qua json_script
 */

(function () {
    'use strict';

    function loadInitialData() {
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
        } else {
            console.warn('[DeepSea] Không tìm thấy phần tử ocean-layers-data');
        }

        if (itemsElement) {
            try {
                items = JSON.parse(itemsElement.textContent);
            } catch (err) {
                console.error('[DeepSea] Lỗi parse explorer-items-data:', err);
            }
        } else {
            console.warn('[DeepSea] Không tìm thấy phần tử explorer-items-data');
        }

        // Lưu trữ vào namespace toàn cục để phục vụ các phase tiếp theo
        window.__DEEP_SEA_DATA__ = {
            layers: layers,
            items: items,
            isLoaded: true,
        };

        console.log(`[DeepSea] Đã nạp thành công ${layers.length} tầng đại dương và ${items.length} đối tượng thám hiểm.`);

        // Cập nhật hộp trạng thái placeholder trên giao diện
        const statusBox = document.getElementById('data-status-box');
        if (statusBox) {
            statusBox.innerHTML = `
                <p style="margin: 0; color: #047857; font-weight: 600;">✓ Kết nối dữ liệu thành công (Client Data Verified)</p>
                <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; color: #334155; font-size: 0.95rem;">
                    <li>Số tầng đại dương nhận được: <strong>${layers.length}</strong> tầng</li>
                    <li>Số đối tượng thám hiểm đã xuất bản: <strong>${items.length}</strong> đối tượng</li>
                </ul>
            `;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadInitialData);
    } else {
        loadInitialData();
    }
})();

