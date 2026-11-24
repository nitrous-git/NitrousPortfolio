// Only the hero reel autoplays. Respect reduced motion, manual pause and visibility.
(() => {
    const video = document.querySelector('.hs-hero-video');
    const toggle = document.querySelector('.hs-motion-toggle');
    if (!video || !toggle) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let wantsPlayback = !motion.matches;
    let visible = true;
    let playRequest = 0;
    video.muted = true;

    function syncButton() {
        toggle.textContent = wantsPlayback && !video.paused ? 'Pause reel' : 'Play reel';
        toggle.setAttribute('aria-label', toggle.textContent);
    }

    async function syncPlayback() {
        const request = ++playRequest;
        if (!wantsPlayback || !visible || document.hidden) {
            video.pause();
            syncButton();
            return;
        }
        try {
            await video.play();
        } catch {
            if (request !== playRequest) return;
            wantsPlayback = false;
        }
        if (request === playRequest) syncButton();
    }

    video.addEventListener('playing', () => {
        video.classList.add('is-ready');
        syncButton();
    });
    video.addEventListener('pause', syncButton);
    video.addEventListener('error', () => {
        video.classList.remove('is-ready');
        wantsPlayback = false;
        toggle.hidden = true;
    });

    toggle.hidden = false;
    toggle.addEventListener('click', () => {
        wantsPlayback = !wantsPlayback || video.paused;
        syncPlayback();
    });
    motion.addEventListener('change', event => {
        wantsPlayback = !event.matches;
        syncPlayback();
    });
    document.addEventListener('visibilitychange', syncPlayback);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            syncPlayback();
        }, { threshold: 0 }).observe(video);
    }
    syncPlayback();
})();

// Lightweight ambient particles. No WebGL, dependencies, or page-height canvas.
(() => {
    const canvas = document.querySelector('.hs-particle-canvas');
    const region = document.querySelector('.hs-particle-region');
    const toggle = document.querySelector('.hs-particle-toggle');
    if (!canvas || !region || !toggle) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const palette = ['176, 154, 255', '124, 164, 230', '209, 196, 255'];
    let enabled = !motion.matches;
    let inView = true;
    let width = 0, height = 0;
    let stars = [];
    let frame = 0, previous = 0;
    let elapsed = 0;

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const newWidth = Math.round(rect.width);
        const newHeight = Math.round(rect.height);
        if (!newWidth || !newHeight) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        if (newWidth === width && newHeight === height &&
            canvas.width === Math.round(newWidth * dpr)) return;
        width = newWidth;
        height = newHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

        const count = Math.max(24, Math.min(105, Math.round(width * height / 14500)));
        stars = Array.from({ length: count }, () => {
            const depth = Math.random();
            return {
                x: Math.random(), y: Math.random(), depth,
                radius: .45 + depth * .95,
                opacity: .10 + depth * .20,
                phase: Math.random() * Math.PI * 2,
                color: palette[Math.floor(Math.random() * palette.length)]
            };
        });
        draw(0);
    }

    function draw(dt) {
        if (!width || !height) return;
        elapsed += dt;
        ctx.clearRect(0, 0, width, height);
        for (const star of stars) {
            // Distant stars drift more slowly; wrap without abrupt changes.
            star.x = (star.x + dt * (.8 + star.depth * 2.1) / width) % 1;
            star.y = (star.y + dt * (.4 + star.depth * 1.3) / height) % 1;
            const x = star.x * width, y = star.y * height;
            const twinkle = .83 + .17 * Math.sin(elapsed * .45 + star.phase);
            const edge = Math.min(1, x / 22, (width - x) / 22, y / 22, (height - y) / 22);
            // More visible in the side gutters; quieter directly beneath text.
            const center = Math.abs(star.x - .5) * 2;
            const alpha = star.opacity * twinkle * edge * (.70 + .30 * center);
            if (star.depth > .78) {
                ctx.fillStyle = 'rgba(' + star.color + ',' + alpha * .13 + ')';
                ctx.beginPath();
                ctx.arc(x, y, star.radius * 3.1, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(' + star.color + ',' + alpha + ')';
            ctx.beginPath();
            ctx.arc(x, y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function tick(now) {
        frame = 0;
        if (!enabled || !inView || document.hidden) return;
        if (!previous) previous = now;
        const dt = (now - previous) / 1000;
        // A slow 30 Hz field is enough for movement at 1–3 CSS pixels/sec.
        if (dt >= 1 / 30) {
            draw(Math.min(dt, .1));
            previous = now;
        }
        frame = requestAnimationFrame(tick);
    }

    function sync() {
        toggle.textContent = enabled ? 'Pause particles' : 'Play particles';
        if (enabled && inView && !document.hidden) {
            if (!frame) {
                previous = 0;
                frame = requestAnimationFrame(tick);
            }
        } else {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            previous = 0;
        }
    }

    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            sync();
        }).observe(region);
    }
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
        enabled = !enabled;
        sync();
    });
    motion.addEventListener('change', event => {
        enabled = !event.matches;
        sync();
    });
    document.addEventListener('visibilitychange', sync);
    sync();
})();
