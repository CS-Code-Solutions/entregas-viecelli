(function () {
    const STORAGE_KEY = 'viecelli_perfil_ui';
    const THEME_KEY = 'viecelli_theme';
    const MAX_LOCK_TIME_MS = 3000;
    let isRevealed = false;

    const root = document.documentElement;
    const path = window.location.pathname;
    const paginaAtual = path.split('/').pop() || 'index.html';
    const isLoginOrPublic = root.hasAttribute('data-public-page') || paginaAtual === 'login.html';

    // 1. Aplica tema salvo antes do primeiro paint
    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme) {
            root.setAttribute('data-theme', savedTheme);
        }
    } catch (e) {}

    // 2. Lê perfil em cache
    let cachedProfile = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) cachedProfile = JSON.parse(raw);
    } catch (e) {}

    // 3. Injeta regras CSS imediatas para ocultar elementos restritos e bloquear tela sem sessão
    const dynamicCss = `
        html.af-not-admin .admin-only-item { display: none !important; }
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

    // 4. Liberação instantânea com cache ou trava preventiva em rota privada
    if (cachedProfile && cachedProfile.uid) {
        root.classList.add('af-has-session');
        root.classList.add(cachedProfile.ehAdmin ? 'af-is-admin' : 'af-not-admin');
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

    // Fail-safe de segurança
    setTimeout(() => {
        if (!isRevealed) reveal();
    }, MAX_LOCK_TIME_MS);
})();
