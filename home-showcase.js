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
