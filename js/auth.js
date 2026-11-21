const PERFIL_CACHE_KEY = 'viecelli_perfil_ui';
let usuarioAtual = null;
let usuarioEhAdmin = false;

(function initAuth() {
    const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';
    const isPaginaLogin = paginaAtual === 'login.html';

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            localStorage.removeItem(PERFIL_CACHE_KEY);
            if (!isPaginaLogin) {
                window.location.replace('login.html');
            }
            return;
        }

        usuarioAtual = user;

        if (isPaginaLogin) {
            window.location.replace('index.html');
            return;
        }

        // Verifica permissão de Administrador no Firestore (coleção 'usuarios/{uid}')
        try {
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            const dados = userDoc.exists ? userDoc.data() : {};
            usuarioEhAdmin = dados.role === 'admin';

            const perfilUI = {
                uid: user.uid,
                email: user.email,
                nome: dados.nome || user.email.split('@')[0],
                ehAdmin: usuarioEhAdmin
            };

            localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(perfilUI));
            if (window.AntiFlicker) {
                window.AntiFlicker.reveal(perfilUI);
            }

            if (typeof iniciarAplicacao === 'function') {
                iniciarAplicacao();
            }
        } catch (err) {
            console.error('Erro ao validar permissões:', err);
            if (window.AntiFlicker) {
                window.AntiFlicker.reveal({ ehAdmin: false });
            }
            if (typeof iniciarAplicacao === 'function') {
                iniciarAplicacao();
            }
        }
    });
})();

// Login na tela login.html
async function fazerLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('emailLogin').value.trim();
    const senha = document.getElementById('senhaLogin').value;
    const btnLogin = document.getElementById('btnLogin');
    const msgErro = document.getElementById('loginErro');

    if (!Security.validarEmail(email) || !senha) {
        exibirErroLogin('Informe um e-mail válido e sua senha.');
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Autenticando...';
    if (msgErro) msgErro.classList.add('hidden');

    try {
        await auth.signInWithEmailAndPassword(email, senha);
        // Redirecionamento ocorre automaticamente pelo onAuthStateChanged
    } catch (error) {
        console.error('Falha de autenticação:', error.code);
        exibirErroLogin('E-mail ou senha inválidos. Verifique suas credenciais.');
        btnLogin.disabled = false;
        btnLogin.textContent = 'Entrar no Sistema';
    }
}

function exibirErroLogin(texto) {
    const msgErro = document.getElementById('loginErro');
    if (msgErro) {
        msgErro.textContent = texto;
        msgErro.classList.remove('hidden');
    } else {
        alert(texto);
    }
}

// Encerramento seguro de sessão
async function fazerLogout() {
    try {
        localStorage.removeItem(PERFIL_CACHE_KEY);
        await auth.signOut();
        window.location.replace('login.html');
    } catch (error) {
        console.error('Erro ao sair:', error);
    }
}
