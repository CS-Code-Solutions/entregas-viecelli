let pedidosBase = {};
let emailSistema = 'entregas@viecelli.com.br';
const TERMO_ACEITE_PADRAO = [
    'Este documento formaliza a entrega do projeto executado, considerando os requisitos, cronograma e os critérios de aceitação previamente relacionados e acordados através de um contrato entre o cliente e a Viecelli Móveis S/A.',
    '• A partir da assinatura deste Termo, será considerada como encerrada a etapa de montagem.',
    '• Qualquer problema relacionado aos procedimentos, dentro do prazo, será resolvido sob garantia.',
    '• A garantia não é estendida a produtos/serviços de terceiros não contratados pela Viecelli.',
    'O Cliente declara que a Viecelli Móveis S/A entregou os produtos/serviços de acordo com os requisitos e prazos.'
].join('\n');
let termoAceiteEntrega = TERMO_ACEITE_PADRAO;
const VERSAO_LGPD_POLITICA = '1.0';
let fotosGerais = [];
let fotosEvidencia = { t1: null, t2: null, m1: null };
let relatoriosSalvos = [];
let usuariosViecelli = [];
let appInicializado = false;
let processandoEnvio = false;

// Armazena os dados do PDF montado para envio após conferência na pré-visualização
let rascunhoPDFAtual = null;

function iniciarAplicacao() {
    if (appInicializado) return;
    appInicializado = true;

    aplicarTextoTermoAceite(TERMO_ACEITE_PADRAO);
    renderizarOpcoesNota();
    setupCanvas('canvasCliente');
    setupCanvas('canvasMontador');
    setupCanvas('canvasConfigAssinatura');

    const nomeSalvo = localStorage.getItem('nomeMontadorLocal');
    if (nomeSalvo) {
        document.getElementById('montadorNome').value = nomeSalvo;
    }

    if (localStorage.getItem('viecelli_theme') === 'light') {
        document.body.classList.add('light-theme');
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.checked = true;
    }

    if (!usuarioEhAdmin) {
        const viewAdmin = document.getElementById('viewAdmin');
        const btnAdmin = document.getElementById('btnAlternarPerfil');
        if (viewAdmin) viewAdmin.remove();
        if (btnAdmin) btnAdmin.remove();
    }

    carregarConfiguracoesFirestore();
    escutarPedidosFirestore();

    if (usuarioEhAdmin) {
        escutarRelatoriosFirestore();
        escutarUsuariosFirestore();
    }
}

function aplicarTextoTermoAceite(texto) {
    const valorFinal = texto && String(texto).trim() ? String(texto) : TERMO_ACEITE_PADRAO;
    termoAceiteEntrega = valorFinal;

    const elUI = document.getElementById('textoTermoAceiteUI');
    if (elUI) elUI.textContent = valorFinal;

    const elPDF = document.getElementById('pdf-termo-texto');
    if (elPDF) elPDF.textContent = valorFinal;

    const inputAdmin = document.getElementById('termoAceiteAdmin');
    if (inputAdmin && document.activeElement !== inputAdmin) {
        inputAdmin.value = valorFinal;
    }
}

function abrirModalPrivacidade() {
    const modal = document.getElementById('modalPrivacidade');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalPrivacidade() {
    const modal = document.getElementById('modalPrivacidade');
    if (!modal) return;
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function renderizarOpcoesNota() {
    const container = document.getElementById('containerNotasMontagem');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        const label = document.createElement('label');
        label.className = 'bg-slate-800 px-2.5 py-1.5 rounded text-xs cursor-pointer border border-slate-700 flex items-center justify-center min-w-[32px] hover:bg-amber-500 hover:text-slate-900 transition-colors';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'notaMontagem';
        input.value = String(i);
        if (i === 10) input.checked = true;
        input.className = 'accent-amber-500 mr-1';

        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${i}`));
        container.appendChild(label);
    }
}

// ==========================================
// SINCRONIZAÇÃO COM FIRESTORE (COLEÇÕES VIECELLI)
// ==========================================

async function carregarConfiguracoesFirestore() {
    try {
        const doc = await db.collection('viecelli_config').doc('geral').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.emailPadrao) {
                emailSistema = data.emailPadrao;
            }
            aplicarTextoTermoAceite(data.termoAceiteEntrega);
        } else {
            aplicarTextoTermoAceite(TERMO_ACEITE_PADRAO);
        }
    } catch (e) {
        console.warn('Usando configurações padrão locais:', e);
        aplicarTextoTermoAceite(TERMO_ACEITE_PADRAO);
    }
    const inputEmailAdmin = document.getElementById('emailPadraoAdmin');
    const spanAviso = document.getElementById('spanAvisoEmail');
    if (inputEmailAdmin) inputEmailAdmin.value = emailSistema;
    if (spanAviso) spanAviso.textContent = emailSistema;
}

function escutarPedidosFirestore() {
    db.collection('viecelli_pedidos').onSnapshot((snapshot) => {
        pedidosBase = {};
        snapshot.forEach((doc) => {
            pedidosBase[doc.id] = doc.data();
        });
        if (usuarioEhAdmin) atualizarTabelaPedidosAdmin();
    }, (error) => {
        console.error('Erro ao ler pedidos:', error);
    });
}

function escutarRelatoriosFirestore() {
    if (!usuarioEhAdmin) return;
    db.collection('viecelli_relatorios')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            relatoriosSalvos = [];
            snapshot.forEach((doc) => {
                relatoriosSalvos.push({ id: doc.id, ...doc.data() });
            });
            atualizarTabelaRelatoriosAdmin();
        }, (error) => {
            console.error('Erro ao ler relatórios:', error);
        });
}

function escutarUsuariosFirestore() {
    if (!usuarioEhAdmin) return;
    db.collection('viecelli_usuarios').onSnapshot((snapshot) => {
        usuariosViecelli = [];
        snapshot.forEach((doc) => {
            usuariosViecelli.push({ uid: doc.id, ...doc.data() });
        });
        atualizarTabelaUsuariosAdmin();
    }, (error) => {
        console.error('Erro ao ler usuários:', error);
    });
}

function atualizarTabelaPedidosAdmin() {
    const tbodyPed = document.getElementById('tabelaPedidosBase');
    if (!tbodyPed) return;
    tbodyPed.innerHTML = '';

    for (const [nr, dados] of Object.entries(pedidosBase)) {
        const nrSeguro = Security.escaparHTML(nr);
        const cliSeguro = Security.escaparHTML(dados.cliente);
        const endSeguro = Security.escaparHTML(dados.endereco);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 font-bold text-amber-400">#${nrSeguro}</td>
            <td class="p-2 text-white text-[10px]">${cliSeguro}<br><span class="text-slate-500">${endSeguro}</span></td>
            <td class="p-2 text-right">
                <button data-nr="${nrSeguro}" class="btn-remover-pedido text-red-500 hover:text-red-400 p-1">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tr.querySelector('.btn-remover-pedido').addEventListener('click', () => removerPedidoBase(nr));
        tbodyPed.appendChild(tr);
    }
}

function atualizarTabelaRelatoriosAdmin() {
    const tbodyRel = document.getElementById('tabelaRelatorios');
    if (!tbodyRel) return;
    tbodyRel.innerHTML = '';

    relatoriosSalvos.forEach((item) => {
        const bClass = item.status === 'Completa'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 font-semibold">#${Security.escaparHTML(item.pedido)}</td>
            <td class="p-2">${Security.escaparHTML(item.marca || item.cliente)}</td>
            <td class="p-2"><span class="px-2 py-0.5 rounded text-[9px] ${bClass}">${Security.escaparHTML(item.status)}</span></td>
        `;
        tbodyRel.appendChild(tr);
    });
}

function atualizarTabelaUsuariosAdmin() {
    const tbodyUsers = document.getElementById('tabelaUsuariosAdmin');
    if (!tbodyUsers) return;
    tbodyUsers.innerHTML = '';

    usuariosViecelli.forEach((u) => {
        const isProprioUsuario = usuarioAtual && u.uid === usuarioAtual.uid;
        const isAdminRole = u.role === 'admin';
        const badgeClass = isAdminRole
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40';
        const roleLabel = isAdminRole ? 'Admin' : 'Montador';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2">
                <div class="font-semibold text-white">${Security.escaparHTML(u.nome || 'Sem nome')}</div>
                <div class="text-[10px] text-slate-400">${Security.escaparHTML(u.email || u.uid)}</div>
            </td>
            <td class="p-2">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}">${roleLabel}</span>
            </td>
            <td class="p-2 text-right space-x-2">
                ${isProprioUsuario
                    ? '<span class="text-[9px] text-slate-500 italic">Você</span>'
                    : `
                        <button class="btn-alternar-role text-slate-300 hover:text-amber-400 p-1" title="Alterar Perfil (Admin / Montador)">
                            <i class="fa-solid fa-repeat"></i>
                        </button>
                        <button class="btn-remover-usuario text-red-500 hover:text-red-400 p-1" title="Revogar Acesso">
                            <i class="fa-solid fa-user-xmark"></i>
                        </button>
                    `
                }
            </td>
        `;

        if (!isProprioUsuario) {
            tr.querySelector('.btn-alternar-role').addEventListener('click', () => alternarPerfilUsuario(u));
            tr.querySelector('.btn-remover-usuario').addEventListener('click', () => removerUsuarioViecelli(u));
        }

        tbodyUsers.appendChild(tr);
    });
}

// ==========================================
// GESTÃO DE USUÁRIOS (SOMENTE ADMIN)
// ==========================================

async function cadastrarUsuarioViecelli() {
    if (!usuarioEhAdmin) {
        UIFeedback.toast('Acesso restrito a administradores.', 'erro');
        return;
    }

    const nome = Security.sanitizarTexto(document.getElementById('novoUsuarioNome').value, 120);
    const email = document.getElementById('novoUsuarioEmail').value.trim();
    const senha = document.getElementById('novoUsuarioSenha').value;
    const role = document.getElementById('novoUsuarioRole').value;
    const btnSalvar = document.getElementById('btnCadastrarUsuario');

    if (!nome || !Security.validarEmail(email)) {
        UIFeedback.toast('Preencha o nome e um e-mail válido.', 'alerta');
        return;
    }

    if (!senha || senha.length < 6) {
        UIFeedback.toast('A senha deve ter no mínimo 6 caracteres.', 'alerta');
        return;
    }

    if (role !== 'admin' && role !== 'montador') {
        UIFeedback.toast('Selecione um perfil de acesso válido.', 'alerta');
        return;
    }

    btnSalvar.disabled = true;
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Criando acesso...`;

    try {
        const secondaryAuth = obterAuthSecundario();
        const credencial = await secondaryAuth.createUserWithEmailAndPassword(email, senha);
        const novoUid = credencial.user.uid;

        await secondaryAuth.signOut();

        await db.collection('viecelli_usuarios').doc(novoUid).set({
            nome: nome,
            email: email,
            role: role,
            criadoPor: usuarioAtual.uid,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('novoUsuarioNome').value = '';
        document.getElementById('novoUsuarioEmail').value = '';
        document.getElementById('novoUsuarioSenha').value = '';
        document.getElementById('novoUsuarioRole').value = 'montador';

        UIFeedback.toast(`Usuário "${nome}" cadastrado como ${role === 'admin' ? 'Administrador' : 'Montador'}!`, 'sucesso');
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 'auth/email-already-in-use') {
            UIFeedback.alertaModal({
                titulo: 'E-mail já existente',
                mensagem: 'Este e-mail já está cadastrado no Firebase Authentication.\n\nCaso seja um usuário de outro módulo, vincule o UID dele diretamente na coleção "viecelli_usuarios" no Console do Firebase.',
                tipo: 'alerta'
            });
        } else if (error.code === 'auth/weak-password') {
            UIFeedback.toast('Senha muito fraca. Utilize pelo menos 6 caracteres.', 'alerta');
        } else {
            UIFeedback.toast('Não foi possível criar o usuário.', 'erro');
        }
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginal;
    }
}

async function alternarPerfilUsuario(usuario) {
    if (!usuarioEhAdmin || !usuario || usuario.uid === usuarioAtual.uid) return;

    const novoRole = usuario.role === 'admin' ? 'montador' : 'admin';
    const labelNovo = novoRole === 'admin' ? 'Administrador' : 'Montador';

    const confirmado = await UIFeedback.confirmar({
        titulo: 'Alterar Nível de Acesso',
        mensagem: `Deseja alterar o perfil de "${usuario.nome}" para ${labelNovo}?`,
        textoConfirmar: 'Alterar Perfil'
    });

    if (!confirmado) return;

    try {
        await db.collection('viecelli_usuarios').doc(usuario.uid).update({
            role: novoRole,
            atualizadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        UIFeedback.toast(`Perfil atualizado para ${labelNovo}.`, 'sucesso');
    } catch (error) {
        console.error('Erro ao alterar perfil:', error);
        UIFeedback.toast('Erro ao atualizar perfil do usuário.', 'erro');
    }
}

async function removerUsuarioViecelli(usuario) {
    if (!usuarioEhAdmin || !usuario || usuario.uid === usuarioAtual.uid) return;

    const confirmado = await UIFeedback.confirmar({
        titulo: 'Revogar Acesso',
        mensagem: `Deseja remover o acesso de "${usuario.nome}" ao sistema Viecelli?`,
        textoConfirmar: 'Revogar Acesso',
        perigoso: true
    });

    if (!confirmado) return;

    try {
        await db.collection('viecelli_usuarios').doc(usuario.uid).delete();
        UIFeedback.toast('Acesso revogado com sucesso.', 'sucesso');
    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        UIFeedback.toast('Não foi possível remover o acesso.', 'erro');
    }
}

// ==========================================
// PEDIDOS E CONFIGURAÇÕES (SOMENTE ADMIN)
// ==========================================

async function adicionarPedidoBase() {
    if (!usuarioEhAdmin) {
        UIFeedback.toast('Acesso restrito a administradores.', 'erro');
        return;
    }

    const nr = document.getElementById('novoNrPedido').value.trim();
    const cli = Security.sanitizarTexto(document.getElementById('novoClientePedido').value, 120);
    const end = Security.sanitizarTexto(document.getElementById('novoEndPedido').value, 200);

    if (!Security.validarNumeroPedido(nr) || !cli || !end) {
        UIFeedback.toast('Preencha um número de pedido válido, cliente e endereço.', 'alerta');
        return;
    }

    try {
        await db.collection('viecelli_pedidos').doc(nr).set({
            cliente: cli,
            endereco: end,
            criadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('novoNrPedido').value = '';
        document.getElementById('novoClientePedido').value = '';
        document.getElementById('novoEndPedido').value = '';
        UIFeedback.toast(`Pedido #${nr} cadastrado no banco de dados!`, 'sucesso');
    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        UIFeedback.toast('Erro ao salvar pedido. Verifique suas permissões.', 'erro');
    }
}

async function removerPedidoBase(nr) {
    if (!usuarioEhAdmin) return;

    const confirmado = await UIFeedback.confirmar({
        titulo: 'Excluir Pedido',
        mensagem: `Tem certeza que deseja remover o pedido #${nr} do pré-cadastro?`,
        textoConfirmar: 'Excluir',
        perigoso: true
    });

    if (!confirmado) return;

    try {
        await db.collection('viecelli_pedidos').doc(String(nr)).delete();
        UIFeedback.toast(`Pedido #${nr} removido.`, 'sucesso');
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        UIFeedback.toast('Não foi possível excluir o pedido.', 'erro');
    }
}

async function salvarEmailPadrao() {
    if (!usuarioEhAdmin) return;
    const novoEmail = document.getElementById('emailPadraoAdmin').value.trim();

    if (!Security.validarEmail(novoEmail)) {
        UIFeedback.toast('Informe um endereço de e-mail válido.', 'alerta');
        return;
    }

    try {
        await db.collection('viecelli_config').doc('geral').set({
            emailPadrao: novoEmail,
            atualizadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        emailSistema = novoEmail;
        document.getElementById('spanAvisoEmail').textContent = emailSistema;
        UIFeedback.toast('E-mail padrão atualizado com sucesso!', 'sucesso');
    } catch (error) {
        console.error('Erro ao atualizar e-mail:', error);
        UIFeedback.toast('Erro ao atualizar e-mail no banco.', 'erro');
    }
}

async function salvarTermoAceiteAdmin() {
    if (!usuarioEhAdmin) return;
    const textarea = document.getElementById('termoAceiteAdmin');
    const textoSanitizado = Security.sanitizarTexto(textarea ? textarea.value : '', 3000);

    if (!textoSanitizado) {
        UIFeedback.toast('Informe o texto do Termo de Aceite de Entrega.', 'alerta');
        return;
    }

    try {
        await db.collection('viecelli_config').doc('geral').set({
            termoAceiteEntrega: textoSanitizado,
            atualizadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        aplicarTextoTermoAceite(textoSanitizado);
        UIFeedback.toast('3. Termo de Aceite de Entrega atualizado!', 'sucesso');
    } catch (error) {
        console.error('Erro ao salvar termo de aceite:', error);
        UIFeedback.toast('Erro ao salvar o termo no banco.', 'erro');
    }
}

async function buscarPedido() {
    const num = document.getElementById('inputNrPedido').value.trim();
    if (!Security.validarNumeroPedido(num)) {
        UIFeedback.toast('Digite um número de pedido válido.', 'alerta');
        return;
    }

    if (pedidosBase[num]) {
        document.getElementById('inputCliente').value = pedidosBase[num].cliente;
        document.getElementById('inputEndereco').value = pedidosBase[num].endereco;
        UIFeedback.toast(`Pedido #${num} carregado!`, 'sucesso', 2200);
        return;
    }

    try {
        const doc = await db.collection('viecelli_pedidos').doc(num).get();
        if (doc.exists) {
            const dados = doc.data();
            document.getElementById('inputCliente').value = dados.cliente || '';
            document.getElementById('inputEndereco').value = dados.endereco || '';
            UIFeedback.toast(`Pedido #${num} carregado!`, 'sucesso', 2200);
        } else {
            UIFeedback.toast('Pedido não encontrado na base de dados.', 'alerta');
        }
    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        UIFeedback.toast('Erro ao consultar o banco de dados.', 'erro');
    }
}

// ==========================================
// NAVEGAÇÃO, TEMA E ASSINATURA LOCAL
// ==========================================

function alternarVisao() {
    if (!usuarioEhAdmin) {
        UIFeedback.toast('Acesso restrito a administradores.', 'erro');
        return;
    }
    const viewAdmin = document.getElementById('viewAdmin');
    if (!viewAdmin) return;

    const isAdmin = viewAdmin.classList.contains('hidden');
    document.getElementById('viewUsuario').classList.toggle('hidden', isAdmin);
    viewAdmin.classList.toggle('hidden', !isAdmin);
    document.getElementById('btnAlternarPerfil').innerHTML = isAdmin
        ? `<i class="fa-solid fa-mobile-screen mr-1"></i> App`
        : `<i class="fa-solid fa-user-gear mr-1"></i> Admin`;
}

function mudarAbaAdmin(abaId, btnElement) {
    if (!usuarioEhAdmin) return;

    document.querySelectorAll('.aba-conteudo').forEach((el) => el.classList.add('hidden'));
    document.getElementById(abaId).classList.remove('hidden');

    document.querySelectorAll('.aba-btn').forEach((btn) => {
        btn.classList.replace('bg-slate-700', 'hover:bg-slate-700/50');
        btn.classList.replace('text-white', 'text-slate-400');
    });

    if (btnElement) {
        btnElement.classList.replace('hover:bg-slate-700/50', 'bg-slate-700');
        btnElement.classList.replace('text-slate-400', 'text-white');
    }
}

function toggleMenu() {
    document.getElementById('sideMenu').classList.toggle('-translate-x-full');
    document.getElementById('sideMenuOverlay').classList.toggle('hidden');
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    localStorage.setItem('viecelli_theme', isLight ? 'light' : 'dark');
}

function abrirConfigAssinatura() {
    document.getElementById('modalConfig').classList.remove('hidden');
    document.getElementById('modalConfig').classList.add('flex');
    redimensionarCanvas('canvasConfigAssinatura');
}

function fecharModalConfig() {
    document.getElementById('modalConfig').classList.remove('flex');
    document.getElementById('modalConfig').classList.add('hidden');
}

function salvarAssinaturaLocal() {
    if (canvasEstaVazio('canvasConfigAssinatura')) {
        UIFeedback.toast('Desenhe sua assinatura antes de guardar.', 'alerta');
        return;
    }
    const canvas = document.getElementById('canvasConfigAssinatura');
    localStorage.setItem('assinaturaMontadorLocal', canvas.toDataURL('image/png'));
    const nomeMont = Security.sanitizarTexto(document.getElementById('montadorNome').value, 100);
    if (nomeMont) localStorage.setItem('nomeMontadorLocal', nomeMont);
    UIFeedback.toast('Assinatura guardada no dispositivo!', 'sucesso');
    fecharModalConfig();
}

function carregarAssinaturaSalvaAuto() {
    const assinaturaSalva = localStorage.getItem('assinaturaMontadorLocal');
    if (!assinaturaSalva || !Security.validarDataUrlImagem(assinaturaSalva)) return;

    const canvas = document.getElementById('canvasMontador');
    if (!canvas) return;

    redimensionarCanvas('canvasMontador');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function () {
        limparCanvas('canvasMontador');
        const rect = canvas.getBoundingClientRect();
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = assinaturaSalva;
}

function mudarEtapa(etapaDestino) {
    const ids = ['etapa1', 'etapa2', 'etapa3', 'etapa4', 'etapa5'];
    for (let i = 1; i <= 5; i++) {
        document.getElementById(ids[i - 1]).classList.add('hidden');
        document.getElementById(`dot${i}`).classList.replace('bg-amber-500', 'bg-slate-700');
    }
    document.getElementById(ids[etapaDestino - 1]).classList.remove('hidden');
    document.getElementById(`dot${etapaDestino}`).classList.replace('bg-slate-700', 'bg-amber-500');

    const titulos = [
        'Passo 1 de 5: Pedido',
        'Passo 2 de 5: Imagens',
        'Passo 3 de 5: Termo',
        'Passo 4 de 5: Checklist',
        'Passo 5 de 5: Assinaturas'
    ];
    document.getElementById('labelEtapa').textContent = titulos[etapaDestino - 1];

    if (etapaDestino === 5) {
        redimensionarCanvas('canvasCliente');
        redimensionarCanvas('canvasMontador');
        setTimeout(carregarAssinaturaSalvaAuto, 100);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function avancarEtapa3() {
    if (!document.getElementById('checkTermo').checked) {
        UIFeedback.toast('Confirme que está de acordo com o Termo de Aceite.', 'alerta');
        return;
    }
    mudarEtapa(4);
}

// ==========================================
// OTIMIZAÇÃO E GESTÃO DE FOTOS (MEMÓRIA RAM)
// ==========================================

function otimizarImagem(file, callback) {
    if (!Security.validarArquivoImagem(file)) {
        UIFeedback.toast('Arquivo inválido. Selecione imagens JPG, PNG ou WebP de até 10MB.', 'erro');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 900;

            if (width > height && width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function adicionarFotosGerais(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        if (fotosGerais.length >= 20) {
            UIFeedback.toast('Limite máximo de 20 fotos atingido.', 'alerta');
            break;
        }
        otimizarImagem(files[i], function (dataUrl) {
            fotosGerais.push({ src: dataUrl, titulo: '', desc: '' });
            atualizarListaFotos();
        });
    }
    event.target.value = '';
}

function atualizarListaFotos() {
    const lista = document.getElementById('listaFotosGerais');
    document.getElementById('contadorFotosGerais').textContent = `${fotosGerais.length} / 20 fotos`;
    lista.innerHTML = '';

    fotosGerais.forEach((foto, index) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-900 border border-slate-700 p-2 rounded-lg flex space-x-3 items-start';

        card.innerHTML = `
            <div class="w-16 h-16 shrink-0 relative rounded overflow-hidden">
                <img src="${foto.src}" class="w-full h-full object-cover">
                <button type="button" class="btn-del-foto absolute top-0 right-0 bg-red-600 text-white rounded-bl w-4 h-4 flex items-center justify-center text-[8px]">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="flex-1 space-y-1.5">
                <input type="text" placeholder="Título (ex: Fachada)" value="${Security.escaparHTML(foto.titulo)}" class="input-titulo-foto w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white">
                <input type="text" placeholder="Descrição (opcional)" value="${Security.escaparHTML(foto.desc)}" class="input-desc-foto w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white">
            </div>
        `;

        card.querySelector('.btn-del-foto').addEventListener('click', () => {
            fotosGerais.splice(index, 1);
            atualizarListaFotos();
        });
        card.querySelector('.input-titulo-foto').addEventListener('input', (e) => {
            fotosGerais[index].titulo = Security.sanitizarTexto(e.target.value, 80);
        });
        card.querySelector('.input-desc-foto').addEventListener('input', (e) => {
            fotosGerais[index].desc = Security.sanitizarTexto(e.target.value, 160);
        });

        lista.appendChild(card);
    });
}

// ==========================================
// CHECKLIST E EVIDÊNCIAS
// ==========================================

function toggleObs(key, isNegative) {
    const evidenceBox = document.getElementById('evidence_box_' + key);
    const inputObs = document.getElementById('input_obs_' + key);

    if (isNegative) {
        evidenceBox.classList.remove('hidden');
        inputObs.placeholder = 'Motivo da não conformidade (obrigatório)';
    } else {
        evidenceBox.classList.add('hidden');
        inputObs.placeholder = 'Observação (opcional)';
        fotosEvidencia[key] = null;
        document.getElementById(`input_file_${key}`).value = '';
        const preview = document.getElementById(`preview_evidencia_${key}`);
        preview.innerHTML = '';
        preview.classList.add('hidden');
    }
}

function carregarEvidencia(key, event) {
    const file = event.target.files[0];
    if (!file) return;
    otimizarImagem(file, function (dataUrl) {
        fotosEvidencia[key] = { src: dataUrl, titulo: '', desc: '' };
        renderizarEvidenciaUI(key);
    });
}

function renderizarEvidenciaUI(key) {
    const container = document.getElementById(`preview_evidencia_${key}`);
    const data = fotosEvidencia[key];
    if (!data) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 p-2 rounded-lg flex space-x-3 items-start mt-2">
            <div class="w-14 h-14 shrink-0 relative rounded overflow-hidden">
                <img src="${data.src}" class="w-full h-full object-cover">
                <button type="button" class="btn-rem-evidencia absolute top-0 right-0 bg-red-600 text-white rounded-bl w-4 h-4 flex items-center justify-center text-[8px]">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="flex-1 space-y-1.5">
                <input type="text" placeholder="Título da Foto (opcional)" value="${Security.escaparHTML(data.titulo)}" class="input-ev-titulo w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white">
                <input type="text" placeholder="Descrição da Foto (opcional)" value="${Security.escaparHTML(data.desc)}" class="input-ev-desc w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white">
            </div>
        </div>
    `;

    container.querySelector('.btn-rem-evidencia').addEventListener('click', () => removerEvidencia(key));
    container.querySelector('.input-ev-titulo').addEventListener('input', (e) => {
        fotosEvidencia[key].titulo = Security.sanitizarTexto(e.target.value, 80);
    });
    container.querySelector('.input-ev-desc').addEventListener('input', (e) => {
        fotosEvidencia[key].desc = Security.sanitizarTexto(e.target.value, 160);
    });
}

function removerEvidencia(key) {
    fotosEvidencia[key] = null;
    document.getElementById(`input_file_${key}`).value = '';
    renderizarEvidenciaUI(key);
}

function avancarEtapa4() {
    const checks = ['t1', 't2', 'm1'];
    for (const id of checks) {
        const isNao = document.querySelector(`input[name="${id}"][value="NÃO"]`).checked;
        if (isNao) {
            const obsValue = document.getElementById(`input_obs_${id}`).value.trim();
            if (!obsValue) {
                UIFeedback.toast('Informe o motivo da não conformidade no item marcado como "NÃO".', 'alerta');
                return;
            }
            if (!fotosEvidencia[id] || !fotosEvidencia[id].src) {
                UIFeedback.toast('Anexe uma foto de evidência para cada item marcado como "NÃO".', 'alerta');
                return;
            }
        }
    }
    mudarEtapa(5);
}

function toggleConformidade(valor) {
    document.getElementById('aviso5dias').classList.toggle('hidden', valor !== 'Parcial');
}

// ==========================================
// CANVAS DE ASSINATURA
// ==========================================

function redimensionarCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
}

function setupCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    function start(e) {
        isDrawing = true;
        ctx.beginPath();
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function stop() {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function limparCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function canvasEstaVazio(id) {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some((color) => color !== 0);
}

// ==========================================
// PRÉ-VISUALIZAÇÃO DO PDF + ENVIO POR E-MAIL
// ==========================================

async function prepararPreviaPDF() {
    if (processandoEnvio) return;

    const nrPedido = document.getElementById('inputNrPedido').value.trim();
    const cliente = Security.sanitizarTexto(document.getElementById('inputCliente').value, 120);
    const endereco = Security.sanitizarTexto(document.getElementById('inputEndereco').value, 200);

    if (!Security.validarNumeroPedido(nrPedido) || !cliente || !endereco) {
        UIFeedback.toast('Preencha corretamente os dados do Pedido no Passo 1.', 'alerta');
        mudarEtapa(1);
        return;
    }

    const clienteNome = Security.sanitizarTexto(document.getElementById('clienteNome').value, 120);
    const clienteTel = Security.sanitizarTexto(document.getElementById('clienteTel').value, 40);
    const clienteEmail = document.getElementById('clienteEmail').value.trim();

    if (!clienteNome || !clienteTel || !Security.validarEmail(clienteEmail)) {
        UIFeedback.toast('Preencha nome, telefone e um e-mail válido do Cliente.', 'alerta');
        return;
    }

    const montadorNome = Security.sanitizarTexto(document.getElementById('montadorNome').value, 120);
    if (!montadorNome) {
        UIFeedback.toast('Preencha o Nome do Montador.', 'alerta');
        return;
    }

    if (canvasEstaVazio('canvasCliente')) {
        UIFeedback.toast('A assinatura do Cliente é obrigatória.', 'alerta');
        return;
    }

    if (canvasEstaVazio('canvasMontador')) {
        UIFeedback.toast('A assinatura do Montador é obrigatória.', 'alerta');
        return;
    }

    const checkLGPD = document.getElementById('checkLGPDCliente');
    if (!checkLGPD || !checkLGPD.checked) {
        UIFeedback.toast('Confirme o consentimento LGPD e a ciência da Política de Privacidade.', 'alerta');
        return;
    }

    const btnGerar = document.getElementById('btnGerarPDF');
    const textoOriginalBtn = btnGerar.innerHTML;
    btnGerar.disabled = true;
    btnGerar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Montando Prévia...`;

    try {
        document.getElementById('pdf-num').textContent = nrPedido;
        document.getElementById('pdf-cli').textContent = cliente;
        document.getElementById('pdf-end').textContent = endereco;

        const dataHoje = new Date().toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        document.getElementById('pdf-data').textContent = dataHoje;

        const respT1 = document.querySelector('input[name="t1"]:checked').value;
        const obsT1 = Security.sanitizarTexto(document.getElementById('input_obs_t1').value, 300);
        document.getElementById('pdf-t1').textContent = respT1;
        document.getElementById('pdf-obs-t1').textContent = obsT1 ? `Motivo/Obs: ${obsT1}` : '';

        const respT2 = document.querySelector('input[name="t2"]:checked').value;
        const obsT2 = Security.sanitizarTexto(document.getElementById('input_obs_t2').value, 300);
        document.getElementById('pdf-t2').textContent = respT2;
        document.getElementById('pdf-obs-t2').textContent = obsT2 ? `Motivo/Obs: ${obsT2}` : '';

        const respM1 = document.querySelector('input[name="m1"]:checked').value;
        const obsM1 = Security.sanitizarTexto(document.getElementById('input_obs_m1').value, 300);
        document.getElementById('pdf-m1').textContent = respM1;
        document.getElementById('pdf-obs-m1').textContent = obsM1 ? `Motivo/Obs: ${obsM1}` : '';

        const notaElement = document.querySelector('input[name="notaMontagem"]:checked');
        const notaValor = notaElement ? notaElement.value : '10';
        const obsMontagem = Security.sanitizarTexto(document.getElementById('obs_montagem').value, 300);
        document.getElementById('pdf-nota').textContent = notaValor;
        document.getElementById('pdf-obs-nota').textContent = obsMontagem ? `Obs: ${obsMontagem}` : '';

        document.getElementById('pdf-termo-texto').textContent = termoAceiteEntrega;

        const status = document.querySelector('input[name="conformidade"]:checked').value;
        document.getElementById('pdf-status').textContent = status;

        document.getElementById('pdf-nomecli').textContent = clienteNome;
        document.getElementById('pdf-contatocli').textContent = `${clienteTel} | ${clienteEmail}`;
        document.getElementById('pdf-nomemont').textContent = montadorNome;

        document.getElementById('pdf-sig-cliente').src = document.getElementById('canvasCliente').toDataURL('image/png');
        document.getElementById('pdf-sig-montador').src = document.getElementById('canvasMontador').toDataURL('image/png');

        const todasFotosPDF = [];
        fotosGerais.forEach((f) => todasFotosPDF.push({ src: f.src, titulo: f.titulo, desc: f.desc }));

        ['t1', 't2', 'm1'].forEach((key) => {
            if (fotosEvidencia[key]) {
                todasFotosPDF.push({
                    src: fotosEvidencia[key].src,
                    titulo: fotosEvidencia[key].titulo ? `[Evidência] ${fotosEvidencia[key].titulo}` : '[Evidência]',
                    desc: fotosEvidencia[key].desc || ''
                });
            }
        });

        const pdfFotosContainer = document.getElementById('pdf-fotos-container');
        pdfFotosContainer.innerHTML = '';

        if (todasFotosPDF.length > 0) {
            let htmlPaginas = '';
            for (let i = 0; i < todasFotosPDF.length; i += 4) {
                const chunk = todasFotosPDF.slice(i, i + 4);
                const numPaginaFoto = Math.floor(i / 4) + 1;

                htmlPaginas += `
                    <div style="page-break-before: always;" class="pdf-page">
                        <div class="pdf-header">
                            <div>
                                <h1 class="pdf-title">REGISTO FOTOGRÁFICO E EVIDÊNCIAS</h1>
                                <p style="color: #666; margin-top:2px;">Viecelli Móveis S/A - Página ${numPaginaFoto}</p>
                            </div>
                            <div style="font-weight:bold; font-size: 16px; color: #f59e0b;">VIECELLI</div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 10px;">
                `;

                chunk.forEach((f) => {
                    if (!Security.validarDataUrlImagem(f.src)) return;
                    htmlPaginas += `
                        <div style="width: 48%; border: 1px solid #cbd5e1; padding: 8px; border-radius: 8px; text-align: center; background: #fafafa; box-sizing: border-box; margin-bottom: 10px;">
                            <div style="height: 250px; background: #f1f5f9; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                                <img src="${f.src}" style="max-width: 100%; max-height: 250px; width: auto; height: auto; display: block;">
                            </div>
                            <div style="text-align: left; padding: 0 2px;">
                                <div style="font-weight: bold; font-size: 11px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Security.escaparHTML(f.titulo) || 'Sem Título'}</div>
                                <div style="font-size: 10px; color: #475569; margin-top: 2px; line-height: 1.25; height: 25px; overflow: hidden;">${Security.escaparHTML(f.desc) || ''}</div>
                            </div>
                        </div>
                    `;
                });

                htmlPaginas += `</div></div>`;
            }
            pdfFotosContainer.innerHTML = htmlPaginas;
        }

        const pdfTemplate = document.getElementById('pdf-template');
        const anteriorDisplay = pdfTemplate.style.display;
        pdfTemplate.style.display = 'block';

        const imgs = document.querySelectorAll('#pdf-content img');
        await Promise.all(Array.from(imgs).map((img) => {
            if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        const element = document.getElementById('pdf-content');
        const nomeArquivo = `Aceite_Obra_${nrPedido}_${cliente}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const opt = {
            margin: [0, 0, 0, 0],
            filename: nomeArquivo,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        const pdfWorker = html2pdf().set(opt).from(element);
        const pdfBase64 = await pdfWorker.outputPdf('datauristring');
        const pdfBlobUrl = await pdfWorker.outputPdf('bloburl');
        pdfTemplate.style.display = anteriorDisplay || 'none';

        rascunhoPDFAtual = {
            pdfBase64,
            pdfBlobUrl,
            nomeArquivo,
            nrPedido,
            cliente,
            endereco,
            clienteNome,
            clienteTel,
            clienteEmail,
            montadorNome,
            respT1,
            obsT1,
            respT2,
            obsT2,
            respM1,
            obsM1,
            notaValor,
            obsMontagem,
            status,
            qtdFotos: todasFotosPDF.length,
            dataHoje,
            lgpdAceito: true,
            lgpdVersao: VERSAO_LGPD_POLITICA,
            lgpdDataAceiteISO: new Date().toISOString()
        };

        abrirModalPreviaPDF(rascunhoPDFAtual);
    } catch (error) {
        console.error('Erro ao gerar prévia do PDF:', error);
        document.getElementById('pdf-template').style.display = 'none';
        UIFeedback.toast('Não foi possível montar a pré-visualização do PDF.', 'erro');
    } finally {
        btnGerar.disabled = false;
        btnGerar.innerHTML = textoOriginalBtn;
    }
}

function abrirModalPreviaPDF(dados) {
    const modal = document.getElementById('modalPreviaPDF');
    const iframe = document.getElementById('iframePreviaPDF');
    const resumo = document.getElementById('resumoPreviaPDF');

    resumo.innerHTML = `
        <span class="font-bold text-amber-400">Pedido #${Security.escaparHTML(dados.nrPedido)}</span> •
        <span>${Security.escaparHTML(dados.cliente)}</span> •
        <span>${dados.qtdFotos} foto(s)</span> •
        <span>Destino: <strong class="text-white">${Security.escaparHTML(dados.clienteEmail)}</strong> e <strong class="text-white">${Security.escaparHTML(emailSistema)}</strong></span>
    `;

    iframe.src = dados.pdfBlobUrl;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalPreviaPDF() {
    if (processandoEnvio) return;
    const modal = document.getElementById('modalPreviaPDF');
    const iframe = document.getElementById('iframePreviaPDF');
    iframe.src = 'about:blank';
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function baixarPreviaPDF() {
    if (!rascunhoPDFAtual || !rascunhoPDFAtual.pdfBlobUrl) return;
    const link = document.createElement('a');
    link.href = rascunhoPDFAtual.pdfBlobUrl;
    link.download = rascunhoPDFAtual.nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    UIFeedback.toast('Download do PDF iniciado.', 'info', 2500);
}

async function confirmarEnvioPDF() {
    if (!rascunhoPDFAtual || processandoEnvio) return;

    if (!GAS_EMAIL_WEBHOOK_URL || GAS_EMAIL_WEBHOOK_URL.includes('SEU_ID_DE_IMPLANTACAO')) {
        UIFeedback.alertaModal({
            titulo: 'URL do Apps Script não configurada',
            mensagem: 'Configure a constante GAS_EMAIL_WEBHOOK_URL no arquivo js/firebase-config.js com a URL terminada em /exec gerada no Google Apps Script.',
            tipo: 'alerta'
        });
        return;
    }

    processandoEnvio = true;
    const btnEnviar = document.getElementById('btnConfirmarEnvioPDF');
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Encaminhando...`;

    try {
        const d = rascunhoPDFAtual;

        const respostaEmail = await fetch(GAS_EMAIL_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
                pdfBase64: d.pdfBase64,
                nomeArquivo: d.nomeArquivo,
                emailCliente: d.clienteEmail,
                emailEmpresa: emailSistema,
                nomeCliente: d.clienteNome,
                pedido: d.nrPedido
            })
        });

        if (!respostaEmail.ok) {
            throw new Error(`HTTP ${respostaEmail.status}`);
        }

        const resultadoEmail = await respostaEmail.json();
        if (!resultadoEmail.sucesso) {
            throw new Error(resultadoEmail.erro || 'Falha ao disparar e-mail.');
        }

        await db.collection('viecelli_relatorios').add({
            pedido: d.nrPedido,
            marca: d.cliente,
            endereco: d.endereco,
            clienteNome: d.clienteNome,
            clienteTel: d.clienteTel,
            clienteEmail: d.clienteEmail,
            montadorNome: d.montadorNome,
            checklist: {
                transporteAdequado: d.respT1,
                obsTransporte: d.obsT1,
                obraLimpa: d.respT2,
                obsObraLimpa: d.obsT2,
                moveisContrato: d.respM1,
                obsMoveis: d.obsM1,
                notaMontagem: Number(d.notaValor),
                obsMontagem: d.obsMontagem
            },
            lgpd: {
                aceito: d.lgpdAceito === true,
                versao: d.lgpdVersao || VERSAO_LGPD_POLITICA,
                dataAceiteISO: d.lgpdDataAceiteISO || new Date().toISOString()
            },
            status: d.status,
            qtdFotosAnexadasNoPdf: d.qtdFotos,
            dataEntrega: d.dataHoje,
            registradoPorUid: usuarioAtual.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const emailDestinoCliente = d.clienteEmail;
        const qtdFotosEnviadas = d.qtdFotos;
        rascunhoPDFAtual = null;

        processandoEnvio = false;
        fecharModalPreviaPDF();

        await UIFeedback.alertaModal({
            titulo: 'Termo Encaminhado com Sucesso!',
            mensagem: `• Dados registrados no banco de dados.\n• PDF com ${qtdFotosEnviadas} foto(s) enviado por e-mail para:\n  - ${emailDestinoCliente}\n  - ${emailSistema}`,
            tipo: 'sucesso',
            textoBotao: 'Concluir'
        });

        limparFormularioCompleto();
        mudarEtapa(1);
    } catch (error) {
        console.error('Erro no envio do PDF:', error);
        processandoEnvio = false;
        UIFeedback.alertaModal({
            titulo: 'Falha ao Encaminhar PDF',
            mensagem: `Não foi possível concluir o envio (${error.message || 'erro de rede'}).\n\nA pré-visualização continua aberta na tela para você tentar novamente ou baixar o PDF.`,
            tipo: 'erro',
            textoBotao: 'Voltar à Prévia'
        });
    } finally {
        processandoEnvio = false;
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = textoOriginal;
    }
}

function limparFormularioCompleto() {
    fotosGerais = [];
    fotosEvidencia = { t1: null, t2: null, m1: null };
    document.getElementById('pdf-fotos-container').innerHTML = '';
    atualizarListaFotos();

    ['t1', 't2', 'm1'].forEach((key) => {
        document.getElementById(`input_obs_${key}`).value = '';
        const radioSim = document.querySelector(`input[name="${key}"][value="SIM"]`);
        if (radioSim) radioSim.checked = true;
        toggleObs(key, false);
    });

    document.getElementById('obs_montagem').value = '';
    document.getElementById('checkTermo').checked = false;
    const checkLGPD = document.getElementById('checkLGPDCliente');
    if (checkLGPD) checkLGPD.checked = false;
    limparCanvas('canvasCliente');

    document.getElementById('inputNrPedido').value = '';
    document.getElementById('inputCliente').value = '';
    document.getElementById('inputEndereco').value = '';
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteTel').value = '';
    document.getElementById('clienteEmail').value = '';
}
