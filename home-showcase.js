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

// Layered, glowing starfield. Cached sprites keep the per-frame work lightweight.
(() => {
    const canvas = document.querySelector('.hs-particle-canvas');
    const region = document.querySelector('.hs-particle-region');
    const toggle = document.querySelector('.hs-particle-toggle');
    if (!canvas || !region || !toggle) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const palette = ['176, 154, 255', '124, 174, 255', '220, 202, 255', '143, 110, 238'];
    const config = {
        density: 9000,       // CSS pixels squared per particle
        maxParticles: 190,
        brightness: 1.0,
        size: 1.0,
        speed: 1.0,
        glow: 1.0
    };
    let enabled = !motion.matches;
    let inView = true;
    let width = 0, height = 0;
    let stars = [];
    let frame = 0, previous = 0;
    let elapsed = 0;

    // Prerender smooth, additive-looking halos once, rather than blur every frame.
    const sprites = palette.map(color => {
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 64;
        const paint = sprite.getContext('2d');
        const halo = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
        halo.addColorStop(0, 'rgba(' + color + ',.85)');
        halo.addColorStop(.16, 'rgba(' + color + ',.55)');
        halo.addColorStop(.40, 'rgba(' + color + ',.18)');
        halo.addColorStop(1, 'rgba(' + color + ',0)');
        paint.fillStyle = halo;
        paint.fillRect(0, 0, 64, 64);
        return sprite;
    });

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const newWidth = Math.round(rect.width);
        const newHeight = Math.round(rect.height);
        if (!newWidth || !newHeight) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        if (newWidth === width && newHeight === height &&
            canvas.width === Math.round(newWidth * dpr) &&
            canvas.height === Math.round(newHeight * dpr)) return;
        width = newWidth;
        height = newHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

        const count = Math.max(38, Math.min(config.maxParticles, Math.round(width * height / config.density)));
        stars = Array.from({ length: count }, () => {
            const roll = Math.random();
            const tier = roll < .55 ? 0 : roll < .89 ? 1 : 2;
            const ranges = [
                { radius: [.8, 1.5], opacity: [.38, .60], speed: [1.0, 2.2], halo: 4.0 },
                { radius: [1.7, 2.7], opacity: [.55, .78], speed: [2.2, 4.0], halo: 4.2 },
                { radius: [3.0, 4.3], opacity: [.68, .92], speed: [3.0, 5.5], halo: 4.8 }
            ][tier];
            const range = ([min, max]) => min + Math.random() * (max - min);
            const angle = -.95 + Math.random() * 1.5;
            const speed = range(ranges.speed) * config.speed;
            return {
                x: Math.random(), y: Math.random(), tier,
                radius: range(ranges.radius) * config.size,
                opacity: range(ranges.opacity),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                halo: ranges.halo,
                phase: Math.random() * Math.PI * 2,
                color: Math.floor(Math.random() * palette.length)
            };
        });
        draw(0);
    }

    function draw(dt) {
        if (!width || !height) return;
        elapsed += dt;
        ctx.clearRect(0, 0, width, height);
        for (const star of stars) {
            star.x = (star.x + dt * star.vx / width + 1) % 1;
            star.y = (star.y + dt * star.vy / height + 1) % 1;
            const x = star.x * width, y = star.y * height;
            const twinkle = .87 + .13 * Math.sin(elapsed * (.35 + star.tier * .13) + star.phase);
            const edge = Math.max(0, Math.min(1, x / 24, (width - x) / 24, y / 24, (height - y) / 24));
            const center = Math.abs(star.x - .5) * 2;
            const alpha = Math.min(1, star.opacity * config.brightness * twinkle * edge * (.80 + .20 * center));
            const halo = star.radius * star.halo * config.glow;
            ctx.globalAlpha = alpha * (star.tier === 0 ? .45 : .85);
            ctx.drawImage(sprites[star.color], x - halo, y - halo, halo * 2, halo * 2);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgb(' + palette[star.color] + ')';
            ctx.beginPath();
            ctx.arc(x, y, star.radius, 0, Math.PI * 2);
            ctx.fill();
            // A soft luminous center on the nearest stars, not a flat opaque disk.
            if (star.tier === 2) {
                ctx.globalAlpha = alpha * .62;
                ctx.fillStyle = '#f2edff';
                ctx.beginPath();
                ctx.arc(x, y, star.radius * .38, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    function tick(now) {
        frame = 0;
        if (!enabled || !inView || document.hidden) return;
        if (!previous) previous = now;
        const dt = (now - previous) / 1000;
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
