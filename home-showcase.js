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
        density: 4000,       // CSS pixels squared per particle
        maxParticles: 420,
        brightness: 1.0,
        size: 1.0,
        speed: 3.0,              // ambient drift multiplier
        glow: 1.0,
        idleSwirl: .065,         // radians/sec near the vortex
        scrollSwirl: .65,        // additional signed rotation at full scroll velocity
        scrollParallax: .14,    // vertical motion relative to scroll velocity
        maxScrollSpeed: 2200,    // CSS pixels/sec
        maxTrail: 23            // CSS pixels
    };
    let enabled = !motion.matches;
    let inView = true;
    let width = 0, height = 0;
    let stars = [];
    let frame = 0, previous = 0;
    let elapsed = 0;
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

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

        const count = Math.max(70, Math.min(config.maxParticles, Math.round(width * height / config.density)));
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

    // A softened, differential vortex: no singularity or inward collapse.
    // Scrolling down drives clockwise rotation and upward parallax; up reverses both.
    function flowAt(star, scroll) {
        const cx = width * .60;
        const cy = height * .49;
        const dx = star.x * width - cx;
        const dy = star.y * height - cy;
        const scale = Math.max(160, Math.min(width, height) * .42);
        const falloff = 1 / Math.sqrt(1 + (dx * dx + dy * dy) / (scale * scale));
        const depth = .62 + star.tier * .23;
        const impulse = scroll / config.maxScrollSpeed;
        const omega = (config.idleSwirl + impulse * config.scrollSwirl) * falloff * depth;
        return {
            x: star.vx - dy * omega,
            y: star.vy + dx * omega - scroll * config.scrollParallax * depth
        };
    }

    function draw(dt) {
        if (!width || !height) return;
        elapsed += dt;
        ctx.clearRect(0, 0, width, height);
        const scroll = enabled ? scrollVelocity : 0;
        const activity = Math.min(1, Math.abs(scroll) / config.maxScrollSpeed);
        for (const star of stars) {
            // Midpoint integration limits orbit drift at high scroll speeds.
            const first = flowAt(star, scroll);
            const midpoint = {
                ...star,
                x: star.x + first.x * dt * .5 / width,
                y: star.y + first.y * dt * .5 / height
            };
            const velocity = flowAt(midpoint, scroll);
            star.x = ((star.x + dt * velocity.x / width) % 1 + 1) % 1;
            star.y = ((star.y + dt * velocity.y / height) % 1 + 1) % 1;
            const x = star.x * width, y = star.y * height;
            const twinkle = .87 + .13 * Math.sin(elapsed * (.35 + star.tier * .13) + star.phase);
            const edge = Math.max(0, Math.min(1, x / 24, (width - x) / 24, y / 24, (height - y) / 24));
            const center = Math.abs(star.x - .5) * 2;
            const alpha = Math.min(1, star.opacity * config.brightness * twinkle * edge * (.80 + .20 * center));
            const halo = star.radius * star.halo * config.glow;
            ctx.globalAlpha = alpha * (star.tier === 0 ? .45 : .85);
            ctx.drawImage(sprites[star.color], x - halo, y - halo, halo * 2, halo * 2);
            // Short, fading motion streaks during scrolling, with no persistent canvas trails.
            if (activity > .035 && star.tier > 0) {
                const magnitude = Math.hypot(velocity.x, velocity.y);
                if (magnitude > 1) {
                    const length = Math.min(config.maxTrail, magnitude * .065) * activity;
                    const tx = x - velocity.x / magnitude * length;
                    const ty = y - velocity.y / magnitude * length;
                    if (length > .4) {
                        const trail = ctx.createLinearGradient(tx, ty, x, y);
                        trail.addColorStop(0, 'rgba(' + palette[star.color] + ',0)');
                        trail.addColorStop(1, 'rgba(' + palette[star.color] + ',.85)');
                        ctx.globalAlpha = alpha * activity * .78;
                        ctx.strokeStyle = trail;
                        ctx.lineWidth = Math.max(.8, star.radius * .75);
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(x, y);
                        ctx.stroke();
                    }
                }
            }
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
        if (!previous) {
            previous = now;
            lastScrollY = window.scrollY;
        }
        const dt = (now - previous) / 1000;
        // 60 Hz on typical displays; cap simulation dt after a stall.
        if (dt >= 1 / 62) {
            const currentY = window.scrollY;
            const raw = (currentY - lastScrollY) / dt;
            lastScrollY = currentY;
            const target = Math.max(-config.maxScrollSpeed, Math.min(config.maxScrollSpeed, raw));
            const step = Math.min(dt, .05);
            // Responsive acceleration and smooth inertial decay when scrolling stops.
            const response = Math.abs(target) > Math.abs(scrollVelocity) ||
                target * scrollVelocity < 0 ? 11 : 4;
            scrollVelocity += (target - scrollVelocity) * (1 - Math.exp(-response * step));
            if (Math.abs(scrollVelocity) < .5) scrollVelocity = 0;
            draw(step);
            previous = now;
        }
        frame = requestAnimationFrame(tick);
    }

    function sync() {
        toggle.textContent = enabled ? 'Pause particles' : 'Play particles';
        if (enabled && inView && !document.hidden) {
            if (!frame) {
                previous = 0;
                lastScrollY = window.scrollY;
                scrollVelocity = 0;
                frame = requestAnimationFrame(tick);
            }
        } else {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            previous = 0;
            lastScrollY = window.scrollY;
            scrollVelocity = 0;
            draw(0); // remove motion streaks while paused
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
