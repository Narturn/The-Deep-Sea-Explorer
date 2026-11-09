/**
 * physics.js - Mô hình vật lý mô phỏng và nội suy môi trường đại dương
 */

export const MAX_DEPTH_M = 10928;
export const PIXELS_PER_METER = 4; // Tỷ lệ thử nghiệm: 1m = 4px

// Mốc màu gradient đại dương theo tài liệu đặc tả
const COLOR_CHECKPOINTS = [
    { depth: 0, r: 28, g: 167, b: 208 },      // #1ca7d0 (Mặt biển)
    { depth: 200, r: 13, g: 92, b: 138 },     // #0d5c8a (Đáy Epipelagic)
    { depth: 1000, r: 16, g: 28, b: 66 },     // #101c42 (Đáy Mesopelagic)
    { depth: 4000, r: 8, g: 11, b: 24 },      // #080b18 (Đáy Bathypelagic)
    { depth: 10928, r: 2, g: 4, b: 8 },       // #020408 (Challenger Deep)
];

/**
 * Tính áp suất thủy tĩnh gần đúng: P ≈ 1 + depth / 10 (atm)
 */
export function calculatePressure(depthM) {
    const clampedDepth = Math.max(0, Math.min(MAX_DEPTH_M, depthM));
    return 1 + (clampedDepth / 10);
}

/**
 * Nội suy nhiệt độ nước từ 24.0°C xuống 1.5°C theo các tầng nước
 */
export function calculateTemperature(depthM) {
    const clampedDepth = Math.max(0, Math.min(MAX_DEPTH_M, depthM));

    if (clampedDepth <= 200) {
        // Tầng Nắng rọi: 24.0°C -> 12.0°C
        const factor = clampedDepth / 200;
        return 24.0 - factor * (24.0 - 12.0);
    } else if (clampedDepth <= 1000) {
        // Tầng Chạng vạng (Thermocline): 12.0°C -> 4.0°C
        const factor = (clampedDepth - 200) / (1000 - 200);
        return 12.0 - factor * (12.0 - 4.0);
    } else {
        // Biển sâu: 4.0°C -> 1.5°C
        const factor = (clampedDepth - 1000) / (MAX_DEPTH_M - 1000);
        return 4.0 - factor * (4.0 - 1.5);
    }
}

/**
 * Nội suy màu nền mượt mà giữa các điểm mốc độ sâu
 */
export function interpolateOceanColor(depthM) {
    const clampedDepth = Math.max(0, Math.min(MAX_DEPTH_M, depthM));

    for (let i = 0; i < COLOR_CHECKPOINTS.length - 1; i++) {
        const cpStart = COLOR_CHECKPOINTS[i];
        const cpEnd = COLOR_CHECKPOINTS[i + 1];

        if (clampedDepth >= cpStart.depth && clampedDepth <= cpEnd.depth) {
            const range = cpEnd.depth - cpStart.depth;
            const factor = range > 0 ? (clampedDepth - cpStart.depth) / range : 0;

            const r = Math.round(cpStart.r + factor * (cpEnd.r - cpStart.r));
            const g = Math.round(cpStart.g + factor * (cpEnd.g - cpStart.g));
            const b = Math.round(cpStart.b + factor * (cpEnd.b - cpStart.b));

            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    return `rgb(2, 4, 8)`;
}

/**
 * Xác định tầng biển hiện tại dựa vào độ sâu và danh sách layers
 */
export function getActiveLayer(depthM, layers) {
    if (!layers || layers.length === 0) return null;

    for (const layer of layers) {
        if (layer.depth_end_m === MAX_DEPTH_M) {
            if (depthM >= layer.depth_start_m && depthM <= layer.depth_end_m) {
                return layer;
            }
        } else {
            if (depthM >= layer.depth_start_m && depthM < layer.depth_end_m) {
                return layer;
            }
        }
    }

    return layers[layers.length - 1];
}

