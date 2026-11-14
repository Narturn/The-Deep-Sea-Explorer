/**
 * globe.js - Quản lý Quả địa cầu 3D (Globe.gl) và tương tác chọn địa điểm tại trang chủ Ocean Explorer
 */

const EARTH_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';
const DEFAULT_CAMERA_ALTITUDE = 2.15;
const FOCUS_CAMERA_ALTITUDE = 1.75;
const CAMERA_TRANSITION_MS = 750;

let isBootstrapped = false;
let globeInstance = null;
let locationsMap = new Map();
let markerElementsMap = new Map();
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
 * 3. Tạo phần tử DOM cho từng Marker trên bề mặt quả địa cầu
 */
function createMarkerElement(location) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'globe-marker';
    if (location.is_explorable) {
        btn.classList.add('is-explorable');
    }
    if (location.slug === currentSelectedSlug) {
        btn.classList.add('is-selected');
    }

    btn.dataset.locationSlug = location.slug;
    btn.setAttribute(
        'aria-label',
        `${location.vietnamese_name} (${location.name}) – Độ sâu tối đa ${location.max_depth_m}m`
    );
    btn.setAttribute('aria-pressed', location.slug === currentSelectedSlug ? 'true' : 'false');

    const pin = document.createElement('span');
    pin.className = 'globe-marker-pin';

    const tooltip = document.createElement('span');
    tooltip.className = 'globe-marker-tooltip';
    tooltip.textContent = `${location.vietnamese_name} (${location.name})`;

    btn.appendChild(pin);
    btn.appendChild(tooltip);

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        handleLocationSelect(location.slug, { moveCamera: true });
    });

    markerElementsMap.set(location.slug, btn);
    return btn;
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
            // Đánh dấu chấm tọa độ chuẩn trên bề mặt cầu
            .pointsData(locations)
            .pointLat((d) => d.latitude)
            .pointLng((d) => d.longitude)
            .pointAltitude(0.004)
            .pointRadius((d) => (d.is_explorable ? 0.42 : 0.32))
            .pointColor((d) => (d.is_explorable ? '#2dd4bf' : '#38bdf8'))
            .onPointClick((d) => {
                if (d && d.slug) {
                    handleLocationSelect(d.slug, { moveCamera: true });
                }
            })
            // Gắn 7 HTML markers tương tác rõ ràng tại đúng (latitude, longitude)
            .htmlElementsData(locations)
            .htmlLat((d) => d.latitude)
            .htmlLng((d) => d.longitude)
            .htmlAltitude(0.015)
            .htmlElement((d) => createMarkerElement(d));

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
 * 5. Cập nhật trạng thái Marker đang được chọn trên Quả địa cầu và hướng nhẹ camera tới tọa độ
 */
function updateActiveMarker(selectedLocation, shouldMoveCamera = true) {
    markerElementsMap.forEach((el, slug) => {
        const isSelected = slug === selectedLocation.slug;
        el.classList.toggle('is-selected', isSelected);
        el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    if (shouldMoveCamera && globeInstance && typeof globeInstance.pointOfView === 'function') {
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

