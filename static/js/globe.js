/**
 * globe.js - Quản lý Quả địa cầu 3D (Globe.gl) và tương tác chọn địa điểm tại trang chủ Ocean Explorer
 */

const EARTH_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';
const DEFAULT_CAMERA_ALTITUDE = 2.15;
const FOCUS_CAMERA_ALTITUDE = 1.75;
const CAMERA_TRANSITION_MS = 750;

const MARKER_COLOR_DEFAULT = '#38bdf8';
const MARKER_COLOR_EXPLORABLE = '#2dd4bf';
const MARKER_COLOR_SELECTED = '#f59e0b';

const MARKER_RADIUS_DEFAULT = 0.62;
const MARKER_RADIUS_EXPLORABLE = 0.85;
const MARKER_RADIUS_SELECTED = 0.98;

const MARKER_ALTITUDE_DEFAULT = 0.008;
const MARKER_ALTITUDE_EXPLORABLE = 0.014;
const MARKER_ALTITUDE_SELECTED = 0.02;

let isBootstrapped = false;
let globeInstance = null;
let locationsMap = new Map();
let currentSelectedSlug = null;

/**
 * 1. Đọc và chuẩn bị dữ liệu địa điểm từ JSON do Django nhúng qua json_script
 */
export function prepareLocationsData() {
    const dataScript = document.getElementById('ocean-locations-data');
    if (!dataScript) return [];

    try {
        const rawData = JSON.parse(dataScript.textContent);
        if (!Array.isArray(rawData)) return [];

        return rawData
            .filter(
                (item) =>
                    item &&
                    typeof item.slug === 'string' &&
                    Number.isFinite(Number(item.latitude)) &&
                    Number.isFinite(Number(item.longitude))
            )
            .map((item) => ({
                id: item.id,
                name: item.name || '',
                vietnamese_name: item.vietnamese_name || item.name || '',
                slug: item.slug,
                region: item.region || '',
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
                max_depth_m: Number(item.max_depth_m) || 0,
                short_description: item.short_description || '',
                description: item.description || '',
                image_url: item.image_url || '',
                is_explorable: Boolean(item.is_explorable),
                explore_url: item.is_explorable && item.explore_url ? String(item.explore_url) : '',
                ecosystems: Array.isArray(item.ecosystems) ? item.ecosystems : [],
            }));
    } catch (err) {
        console.error('[OceanExplorer] Lỗi đọc dữ liệu ocean-locations-data:', err);
        return [];
    }
}

/**
 * 2. Kiểm tra trình duyệt/thiết bị có hỗ trợ WebGL hay không
 */
function isWebGLAvailable() {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(
            window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
    } catch {
        return false;
    }
}

/**
 * Hiển thị thông báo thay thế nếu WebGL hoặc thư viện Globe.gl không khả dụng
 */
function showWebGLFallback() {
    const fallbackEl = document.getElementById('globe-fallback-notice');
    if (fallbackEl) {
        fallbackEl.hidden = false;
    }
}

/**
 * Escape ký tự HTML để hiển thị an toàn trong tooltip của Globe.gl
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 3. Tính toán kích thước, độ nổi và màu sắc cho từng Marker 3D (pointsData)
 */
function getMarkerRadius(location) {
    if (location.slug === currentSelectedSlug) return MARKER_RADIUS_SELECTED;
    if (location.is_explorable) return MARKER_RADIUS_EXPLORABLE;
    return MARKER_RADIUS_DEFAULT;
}

function getMarkerAltitude(location) {
    if (location.slug === currentSelectedSlug) return MARKER_ALTITUDE_SELECTED;
    if (location.is_explorable) return MARKER_ALTITUDE_EXPLORABLE;
    return MARKER_ALTITUDE_DEFAULT;
}

function getMarkerColor(location) {
    if (location.slug === currentSelectedSlug) return MARKER_COLOR_SELECTED;
    if (location.is_explorable) return MARKER_COLOR_EXPLORABLE;
    return MARKER_COLOR_DEFAULT;
}

/**
 * Tạo nội dung HTML tooltip khi di chuột lên Marker 3D
 */
function createPointTooltipHtml(location) {
    const viName = escapeHtml(location.vietnamese_name);
    const enName = escapeHtml(location.name);
    const depth = Number(location.max_depth_m || 0).toLocaleString('vi-VN');
    const badgeHtml = location.is_explorable
        ? '<span class="globe-point-tooltip-badge">Explore</span>'
        : '';

    return `
        <div class="globe-point-tooltip">
            <div class="globe-point-tooltip-header">
                <span class="globe-point-tooltip-title">${viName} (${enName})</span>
                ${badgeHtml}
            </div>
            <div class="globe-point-tooltip-meta">Độ sâu tối đa: ${depth} m</div>
        </div>
    `;
}

/**
 * 4. Khởi tạo duy nhất một thực thể Globe.gl với cấu hình nhẹ và ổn định
 */
function initGlobeInstance(canvasEl, locations) {
    if (globeInstance || !canvasEl) return globeInstance;

    if (!isWebGLAvailable() || typeof window.Globe !== 'function') {
        showWebGLFallback();
        return null;
    }

    try {
        const containerRect = canvasEl.getBoundingClientRect();
        const initialWidth = Math.max(containerRect.width || canvasEl.clientWidth || 500, 280);
        const initialHeight = Math.max(containerRect.height || canvasEl.clientHeight || 420, 280);

        const world = window.Globe()(canvasEl)
            .width(initialWidth)
            .height(initialHeight)
            .backgroundColor('rgba(0, 0, 0, 0)')
            .globeImageUrl(EARTH_TEXTURE_URL)
            .showAtmosphere(true)
            .atmosphereColor('#38bdf8')
            .atmosphereAltitude(0.14)
            // Render trực tiếp 7 marker trong không gian 3D WebGL (pointsData) để gắn chặt vào bề mặt Trái Đất
            .pointsData(locations)
            .pointLat((d) => d.latitude)
            .pointLng((d) => d.longitude)
            .pointAltitude((d) => getMarkerAltitude(d))
            .pointRadius((d) => getMarkerRadius(d))
            .pointColor((d) => getMarkerColor(d))
            .pointResolution(24)
            .pointsMerge(false)
            .pointsTransitionDuration(0)
            .pointLabel((d) => createPointTooltipHtml(d))
            .onPointClick((d) => {
                if (d && d.slug) {
                    handleLocationSelect(d.slug, { moveCamera: true });
                }
            })
            .onPointHover((hoverPoint) => {
                canvasEl.style.cursor = hoverPoint ? 'pointer' : 'grab';
            });

        // Giới hạn Pixel Ratio tối đa ở mức 2 để tiết kiệm tài nguyên GPU
        const renderer = typeof world.renderer === 'function' ? world.renderer() : null;
        if (renderer && typeof renderer.setPixelRatio === 'function') {
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        }

        // Cấu hình điều khiển xoay 360 độ và zoom mượt mà
        const controls = typeof world.controls === 'function' ? world.controls() : null;
        if (controls) {
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.rotateSpeed = 0.75;
            controls.zoomSpeed = 0.85;
            controls.minDistance = 145;
            controls.maxDistance = 460;
        }

        // Đặt góc nhìn khởi đầu bao quát khu vực Thái Bình Dương – Ấn Độ Dương
        world.pointOfView({ lat: 10, lng: 135, altitude: DEFAULT_CAMERA_ALTITUDE }, 0);

        // Tự động cập nhật kích thước khi cửa sổ trình duyệt thay đổi
        window.addEventListener('resize', () => {
            if (!globeInstance || !canvasEl) return;
            const rect = canvasEl.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                globeInstance.width(rect.width).height(rect.height);
            }
        });

        globeInstance = world;
        return globeInstance;
    } catch (err) {
        console.error('[OceanExplorer] Không thể khởi tạo Globe.gl:', err);
        showWebGLFallback();
        return null;
    }
}

/**
 * 5. Cập nhật trạng thái Marker 3D đang được chọn trên Quả địa cầu và hướng nhẹ camera tới tọa độ
 */
function updateActiveMarker(selectedLocation, shouldMoveCamera = true) {
    if (!globeInstance) return;

    if (
        typeof globeInstance.pointAltitude === 'function' &&
        typeof globeInstance.pointRadius === 'function' &&
        typeof globeInstance.pointColor === 'function'
    ) {
        globeInstance
            .pointAltitude((d) => getMarkerAltitude(d))
            .pointRadius((d) => getMarkerRadius(d))
            .pointColor((d) => getMarkerColor(d));
    }

    if (shouldMoveCamera && typeof globeInstance.pointOfView === 'function') {
        globeInstance.pointOfView(
            {
                lat: selectedLocation.latitude,
                lng: selectedLocation.longitude,
                altitude: FOCUS_CAMERA_ALTITUDE,
            },
            CAMERA_TRANSITION_MS
        );
    }
}

/**
 * 6. Cập nhật trạng thái địa điểm đang chọn trên danh sách 7 địa điểm
 */
function updateLocationListState(selectedSlug) {
    const listEl = document.getElementById('ocean-locations-list');
    if (!listEl) return;

    const items = listEl.querySelectorAll('.ocean-location-item');
    items.forEach((itemEl) => {
        const isCurrent = itemEl.dataset.locationSlug === selectedSlug;
        itemEl.classList.toggle('is-active', isCurrent);

        const btn = itemEl.querySelector('.ocean-location-select-btn');
        if (btn) {
            btn.setAttribute('aria-current', isCurrent ? 'true' : 'false');
        }
    });
}

/**
 * 7. Cập nhật bảng thông tin chi tiết (Location Info Card) và danh sách Ecosystem
 */
function updateLocationInfoCard(selectedLocation) {
    const panelEl = document.getElementById('location-detail-panel');
    if (!panelEl || !selectedLocation) return;

    panelEl.classList.add('js-ready');

    const cards = panelEl.querySelectorAll('.location-detail-card');
    cards.forEach((cardEl) => {
        const isTarget = cardEl.dataset.locationSlug === selectedLocation.slug;
        cardEl.classList.toggle('is-active', isTarget);
        cardEl.hidden = !isTarget;
    });
}

/**
 * 8. Xử lý đồng bộ khi người dùng chọn một địa điểm từ Marker hoặc từ Danh sách
 */
export function handleLocationSelect(slug, options = { moveCamera: true }) {
    const location = locationsMap.get(slug);
    if (!location) return;

    currentSelectedSlug = location.slug;

    updateLocationListState(location.slug);
    updateLocationInfoCard(location);
    updateActiveMarker(location, Boolean(options.moveCamera));
}

/**
 * 9. Đăng ký sự kiện click chọn địa điểm trên danh sách bên cạnh quả địa cầu
 */
function bindLocationListEvents() {
    const listEl = document.getElementById('ocean-locations-list');
    if (!listEl || listEl.dataset.bound === 'true') return;

    listEl.dataset.bound = 'true';
    listEl.addEventListener('click', (event) => {
        const btn = event.target.closest('.ocean-location-select-btn');
        if (!btn) return;

        const slug = btn.dataset.locationSlug;
        if (slug) {
            handleLocationSelect(slug, { moveCamera: true });
        }
    });
}

/**
 * 10. Khởi chạy Ocean Explorer (Đảm bảo chỉ khởi tạo 1 lần duy nhất)
 */
function bootstrapOceanExplorer() {
    if (isBootstrapped) return;
    isBootstrapped = true;

    const locations = prepareLocationsData();
    if (locations.length === 0) return;

    locationsMap.clear();
    locations.forEach((loc) => {
        locationsMap.set(loc.slug, loc);
    });

    bindLocationListEvents();

    const canvasEl = document.getElementById('globe-canvas');
    initGlobeInstance(canvasEl, locations);

    // Chọn địa điểm đầu tiên theo thứ tự sort_order để hiển thị thông tin khởi đầu cân bằng
    handleLocationSelect(locations[0].slug, { moveCamera: false });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapOceanExplorer);
} else {
    bootstrapOceanExplorer();
}

