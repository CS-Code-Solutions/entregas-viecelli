(function () {
    const STORAGE_KEY = 'viecelli_perfil_ui';
    const THEME_KEY = 'viecelli_theme';
    const MAX_LOCK_TIME_MS = 3000;
    let isRevealed = false;

    const root = document.documentElement;
    const path = window.location.pathname;
    const paginaAtual = path.split('/').pop() || 'index.html';
    const isLoginOrPublic = root.hasAttribute('data-public-page') || paginaAtual === 'login.html';

    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme) {
            root.setAttribute('data-theme', savedTheme);
        }
    } catch (e) {}

    let cachedProfile = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) cachedProfile = JSON.parse(raw);
    } catch (e) {}

    // Oculta qualquer elemento ou container administrativo em 0ms para não-admins
    const dynamicCss = `
        html.af-not-admin .admin-only-item,
        html.af-not-admin #viewAdmin {
            display: none !important;
        }
        html.af-locked body {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
        html.af-ready body {
            opacity: 1 !important;
            visibility: visible !important;
            transition: opacity 0.15s ease-out;
        }
    `;

    const style = document.createElement('style');
    style.id = 'anti-flicker-style';
    style.textContent = dynamicCss;
    document.head.appendChild(style);

    if (cachedProfile && cachedProfile.uid) {
        root.classList.add('af-has-session');
        root.classList.add(cachedProfile.ehAdmin === true ? 'af-is-admin' : 'af-not-admin');
        isRevealed = true;
    } else if (!isLoginOrPublic) {
        root.classList.add('af-locked');
    }

    function reveal(perfilAtualizado) {
        if (perfilAtualizado && typeof perfilAtualizado.ehAdmin === 'boolean') {
            root.classList.toggle('af-is-admin', perfilAtualizado.ehAdmin);
            root.classList.toggle('af-not-admin', !perfilAtualizado.ehAdmin);
        }

        if (isRevealed) return;
        isRevealed = true;

        root.classList.remove('af-locked');
        root.classList.add('af-ready');
    }

    window.AntiFlicker = {
        reveal,
        isLocked: () => !isRevealed
    };

    setTimeout(() => {
        if (!isRevealed) reveal();
    }, MAX_LOCK_TIME_MS);
})();
