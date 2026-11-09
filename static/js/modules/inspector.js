/**
 * inspector.js - Bảng thông tin tra cứu sinh vật và cột mốc (Inspector Drawer)
 */

let drawerEl = null;
let backdropEl = null;
let closeBtn = null;
let previousActiveElement = null;
let savedScrollY = 0;
let isOpen = false;

const numberFormatter = new Intl.NumberFormat('vi-VN');

/**
 * Khởi tạo Inspector Drawer
 */
export function initInspector() {
    drawerEl = document.getElementById('inspector-drawer');
    backdropEl = document.getElementById('inspector-backdrop');
    closeBtn = document.getElementById('inspector-close-btn');

    if (!drawerEl || !backdropEl) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeInspector);
    }

    backdropEl.addEventListener('click', closeInspector);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeInspector();
        }
    });
}

/**
 * Mở Inspector Drawer và hiển thị thông tin thực thể
 */
export function openInspector(item, triggerElement = null) {
    if (!drawerEl || !item) return;

    previousActiveElement = triggerElement || document.activeElement;

    // 1. Cập nhật nội dung Drawer
    populateDrawerContent(item);

    // 2. Khóa cuộn nền an toàn mà không làm mất vị trí hiện tại
    lockBackgroundScroll();

    // 3. Hiển thị Drawer và Backdrop
    drawerEl.classList.add('open');
    backdropEl.classList.add('open');
    drawerEl.setAttribute('aria-hidden', 'false');
    isOpen = true;

    // 4. Focus vào nút đóng để hỗ trợ bàn phím
    if (closeBtn) {
        closeBtn.focus();
    }
}

/**
 * Đóng Inspector Drawer và khôi phục cuộn
 */
export function closeInspector() {
    if (!drawerEl || !isOpen) return;

    drawerEl.classList.remove('open');
    backdropEl.classList.remove('open');
    drawerEl.setAttribute('aria-hidden', 'true');
    isOpen = false;

    // Giải phóng khóa cuộn nền và khôi phục vị trí cuộn chính xác
    unlockBackgroundScroll();

    // Trả lại focus cho phần tử đã kích hoạt trước đó
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
    }
}

/**
 * Đổ dữ liệu thực thể vào DOM Drawer
 */
function populateDrawerContent(item) {
    const typeBadgeEl = document.getElementById('inspector-type-badge');
    const layerBadgeEl = document.getElementById('inspector-layer-badge');
    const titleEl = document.getElementById('inspector-title');
    const scientificEl = document.getElementById('inspector-scientific');
    const depthValEl = document.getElementById('inspector-depth-val');
    const descEl = document.getElementById('inspector-description');
    const imageWrapperEl = document.getElementById('inspector-image-wrapper');
    const licenseBoxEl = document.getElementById('inspector-license-box');
    const detailLinkEl = document.getElementById('inspector-detail-link');

    // Thể loại & Tầng biển
    if (typeBadgeEl) {
        typeBadgeEl.textContent = item.item_type === 'CREATURE' ? 'Sinh vật biển' : 'Cột mốc';
    }
    if (layerBadgeEl) {
        layerBadgeEl.textContent = item.layer_name || 'Đại dương';
    }

    // Tên và tên khoa học
    if (titleEl) titleEl.textContent = item.name;
    if (scientificEl) {
        if (item.scientific_name) {
            scientificEl.textContent = item.scientific_name;
            scientificEl.style.display = 'block';
        } else {
            scientificEl.style.display = 'none';
        }
    }

    // Độ sâu
    if (depthValEl) {
        depthValEl.textContent = `${numberFormatter.format(item.depth_m)} m`;
    }

    // Mô tả ngắn
    if (descEl) {
        descEl.textContent = item.short_description || 'Chưa có mô tả chi tiết cho đối tượng này.';
    }

    // Hình ảnh minh họa
    if (imageWrapperEl) {
        if (item.image_url) {
            imageWrapperEl.innerHTML = `
                <img src="${item.image_url}" alt="${item.name}" class="inspector-image" loading="lazy"
                     onerror="this.parentElement.innerHTML = '<div class=\\'inspector-image-placeholder\\'>Không thể tải hình ảnh</div>'">
            `;
        } else {
            imageWrapperEl.innerHTML = `
                <div class="inspector-image-placeholder">
                    <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    <span>Hình ảnh đang được cập nhật</span>
                </div>
            `;
        }
    }

    // Giấy phép & Tác giả ảnh
    if (licenseBoxEl) {
        if (item.image_credit || item.image_license || item.image_source_url) {
            licenseBoxEl.style.display = 'flex';
            licenseBoxEl.innerHTML = `
                ${item.image_credit ? `<div class="inspector-license-row"><span class="inspector-license-label">Tác quyền:</span> <span>${item.image_credit}</span></div>` : ''}
                ${item.image_license ? `<div class="inspector-license-row"><span class="inspector-license-label">Giấy phép:</span> <span>${item.image_license}</span></div>` : ''}
                ${item.image_source_url ? `<div class="inspector-license-row"><span class="inspector-license-label">Nguồn:</span> <a href="${item.image_source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--hud-accent-cyan);">Xem nguồn gốc</a></div>` : ''}
            `;
        } else {
            licenseBoxEl.style.display = 'none';
        }
    }

    // Nút mở tài liệu tham khảo chi tiết
    if (detailLinkEl) {
        if (item.detail_url) {
            detailLinkEl.style.display = 'inline-flex';
            detailLinkEl.href = item.detail_url;
        } else {
            detailLinkEl.style.display = 'none';
        }
    }
}

/**
 * Khóa cuộn an toàn không làm trôi vị trí trang
 */
function lockBackgroundScroll() {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}

/**
 * Giải phóng khóa cuộn và khôi phục vị trí trang chính xác
 */
function unlockBackgroundScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
}

