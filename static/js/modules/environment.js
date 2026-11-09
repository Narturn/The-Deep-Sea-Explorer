/**
 * environment.js - Hiệu ứng môi trường đại dương (Hạt phát sáng & Đèn pha rọi)
 */

const PARTICLE_COUNT = 18;

/**
 * Khởi tạo hiệu ứng đèn pha rọi theo chuột và hạt bioluminescence
 */
export function initEnvironment() {
    initSpotlight();
    initParticles();
}

/**
 * Hiệu ứng đèn pha theo chuột
 */
function initSpotlight() {
    let ticking = false;

    window.addEventListener('mousemove', (e) => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
                document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

/**
 * Sinh các hạt phát sáng ngẫu nhiên
 */
function initParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    // Kiểm tra prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement('div');
        particle.className = 'bioluminescence-particle';

        const size = Math.random() * 4 + 2; // 2px - 6px
        const left = Math.random() * 100;    // 0% - 100%
        const top = Math.random() * 100;     // 0% - 100%
        const delay = Math.random() * 6;     // 0s - 6s
        const duration = Math.random() * 4 + 5; // 5s - 9s

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.top = `${top}%`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;

        fragment.appendChild(particle);
    }

    container.appendChild(fragment);
}

/**
 * Cập nhật màu nền đại dương theo CSS Custom Property
 */
export function updateOceanBackground(colorRgb) {
    document.documentElement.style.setProperty('--ocean-bg-current', colorRgb);
}

