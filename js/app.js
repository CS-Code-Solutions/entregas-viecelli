let pedidosBase = {};
let emailSistema = 'entregas@viecelli.com.br';
let fotosGerais = [];
let fotosEvidencia = { t1: null, t2: null, m1: null };
let relatoriosSalvos = [];
let appInicializado = false;
let processandoEnvio = false;

function iniciarAplicacao() {
    if (appInicializado) return;
    appInicializado = true;

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

    carregarConfiguracoesFirestore();
    escutarPedidosFirestore();
    if (usuarioEhAdmin) {
        escutarRelatoriosFirestore();
    }
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
// SINCRONIZAÇÃO COM FIRESTORE (DADOS LEVES)
// ==========================================

async function carregarConfiguracoesFirestore() {
    try {
        const doc = await db.collection('configuracoes').doc('geral').get();
        if (doc.exists && doc.data().emailPadrao) {
            emailSistema = doc.data().emailPadrao;
        }
    } catch (e) {
        console.warn('Usando e-mail padrão local:', e);
    }
    const inputEmailAdmin = document.getElementById('emailPadraoAdmin');
    const spanAviso = document.getElementById('spanAvisoEmail');
    if (inputEmailAdmin) inputEmailAdmin.value = emailSistema;
    if (spanAviso) spanAviso.textContent = emailSistema;
}

function escutarPedidosFirestore() {
    db.collection('pedidos').onSnapshot((snapshot) => {
        pedidosBase = {};
        snapshot.forEach((doc) => {
            pedidosBase[doc.id] = doc.data();
        });
        atualizarTabelaPedidosAdmin();
    }, (error) => {
        console.error('Erro ao ler pedidos:', error);
    });
}

function escutarRelatoriosFirestore() {
    db.collection('relatorios')
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
                <button data-nr="${nrSeguro}" class="btn-remover-pedido text-red-500 hover:text-red-400">
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
            <td class="p-2">${Security.escaparHTML(item.cliente)}</td>
            <td class="p-2"><span class="px-2 py-0.5 rounded text-[9px] ${bClass}">${Security.escaparHTML(item.status)}</span></td>
        `;
        tbodyRel.appendChild(tr);
    });
}

async function adicionarPedidoBase() {
    if (!usuarioEhAdmin) {
        alert('Acesso restrito a administradores.');
        return;
    }

    const nr = document.getElementById('novoNrPedido').value.trim();
    const cli = Security.sanitizarTexto(document.getElementById('novoClientePedido').value, 120);
    const end = Security.sanitizarTexto(document.getElementById('novoEndPedido').value, 200);

    if (!Security.validarNumeroPedido(nr) || !cli || !end) {
        alert('Preencha um número de pedido válido, cliente e endereço.');
        return;
    }

    try {
        await db.collection('pedidos').doc(nr).set({
            cliente: cli,
            endereco: end,
            criadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('novoNrPedido').value = '';
        document.getElementById('novoClientePedido').value = '';
        document.getElementById('novoEndPedido').value = '';
        alert('Pedido cadastrado no banco de dados!');
    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        alert('Erro ao salvar pedido. Verifique suas permissões.');
    }
}

async function removerPedidoBase(nr) {
    if (!usuarioEhAdmin) return;
    if (!confirm(`Excluir o pedido #${nr}?`)) return;

    try {
        await db.collection('pedidos').doc(String(nr)).delete();
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        alert('Não foi possível excluir o pedido.');
    }
}

async function salvarEmailPadrao() {
    if (!usuarioEhAdmin) return;
    const novoEmail = document.getElementById('emailPadraoAdmin').value.trim();

    if (!Security.validarEmail(novoEmail)) {
        alert('Informe um e-mail válido.');
        return;
    }

    try {
        await db.collection('configuracoes').doc('geral').set({
            emailPadrao: novoEmail,
            atualizadoPor: usuarioAtual.uid,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        emailSistema = novoEmail;
        document.getElementById('spanAvisoEmail').textContent = emailSistema;
        alert('E-mail padrão atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar e-mail:', error);
        alert('Erro ao atualizar e-mail no banco.');
    }
}

async function buscarPedido() {
    const num = document.getElementById('inputNrPedido').value.trim();
    if (!Security.validarNumeroPedido(num)) {
        alert('Digite um número de pedido válido.');
        return;
    }

    if (pedidosBase[num]) {
        document.getElementById('inputCliente').value = pedidosBase[num].cliente;
        document.getElementById('inputEndereco').value = pedidosBase[num].endereco;
        return;
    }

    try {
        const doc = await db.collection('pedidos').doc(num).get();
        if (doc.exists) {
            const dados = doc.data();
            document.getElementById('inputCliente').value = dados.cliente || '';
            document.getElementById('inputEndereco').value = dados.endereco || '';
        } else {
            alert('Pedido não encontrado na base de dados.');
        }
    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        alert('Erro ao consultar o banco de dados.');
    }
}

// ==========================================
// NAVEGAÇÃO, TEMA E ASSINATURA LOCAL
// ==========================================

function alternarVisao() {
    if (!usuarioEhAdmin) return;
    const isAdmin = document.getElementById('viewAdmin').classList.contains('hidden');
    document.getElementById('viewUsuario').classList.toggle('hidden', isAdmin);
    document.getElementById('viewAdmin').classList.toggle('hidden', !isAdmin);
    document.getElementById('btnAlternarPerfil').innerHTML = isAdmin
        ? `<i class="fa-solid fa-mobile-screen mr-1"></i> App`
        : `<i class="fa-solid fa-user-gear mr-1"></i> Admin`;
}

function mudarAbaAdmin(abaId, btnElement) {
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
    const canvas = document.getElementById('canvasConfigAssinatura');
    localStorage.setItem('assinaturaMontadorLocal', canvas.toDataURL('image/png'));
    const nomeMont = Security.sanitizarTexto(document.getElementById('montadorNome').value, 100);
    if (nomeMont) localStorage.setItem('nomeMontadorLocal', nomeMont);
    alert('Assinatura guardada no dispositivo!');
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
        alert('Confirme que está de acordo com o Termo.');
        return;
    }
    mudarEtapa(4);
}

// ==========================================
// OTIMIZAÇÃO E GESTÃO DE FOTOS (MEMÓRIA RAM)
// ==========================================

function otimizarImagem(file, callback) {
    if (!Security.validarArquivoImagem(file)) {
        alert('Arquivo inválido. Selecione apenas imagens (JPG, PNG ou WebP) de até 10MB.');
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

            // Compressão JPEG 0.45 para manter o PDF leve no envio por e-mail
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
        if (fotosGerais.length >= 20) break;
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
                alert('Por favor, digite o motivo da não conformidade no item marcado como "NÃO".');
                return;
            }
            if (!fotosEvidencia[id] || !fotosEvidencia[id].src) {
                alert('Por favor, anexe uma foto de evidência para as opções marcadas como "NÃO".');
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
// GERAÇÃO DE PDF + ENVIO POR E-MAIL + FIRESTORE
// ==========================================

async function gerarPDF() {
    if (processandoEnvio) return;

    const nrPedido = document.getElementById('inputNrPedido').value.trim();
    const cliente = Security.sanitizarTexto(document.getElementById('inputCliente').value, 120);
    const endereco = Security.sanitizarTexto(document.getElementById('inputEndereco').value, 200);

    if (!Security.validarNumeroPedido(nrPedido) || !cliente || !endereco) {
        alert('Atenção: Preencha corretamente os dados do Pedido no Passo 1.');
        mudarEtapa(1);
        return;
    }

    const clienteNome = Security.sanitizarTexto(document.getElementById('clienteNome').value, 120);
    const clienteTel = Security.sanitizarTexto(document.getElementById('clienteTel').value, 40);
    const clienteEmail = document.getElementById('clienteEmail').value.trim();

    if (!clienteNome || !clienteTel || !Security.validarEmail(clienteEmail)) {
        alert('Atenção: Preencha o nome, telefone e um e-mail válido do Cliente no Passo 5.');
        return;
    }

    const montadorNome = Security.sanitizarTexto(document.getElementById('montadorNome').value, 120);
    if (!montadorNome) {
        alert('Atenção: Preencha o Nome do Montador no Passo 5.');
        return;
    }

    if (canvasEstaVazio('canvasCliente')) {
        alert('Atenção: A assinatura do Cliente é obrigatória!');
        return;
    }

    if (canvasEstaVazio('canvasMontador')) {
        alert('Atenção: A assinatura do Montador é obrigatória!');
        return;
    }

    processandoEnvio = true;
    const btnGerar = document.getElementById('btnGerarPDF');
    const textoOriginalBtn = btnGerar.innerHTML;
    btnGerar.disabled = true;
    btnGerar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Gerando e Enviando PDF...`;

    try {
        // 1. Popula dados no template do PDF de forma segura (.textContent)
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

        const status = document.querySelector('input[name="conformidade"]:checked').value;
        document.getElementById('pdf-status').textContent = status;

        document.getElementById('pdf-nomecli').textContent = clienteNome;
        document.getElementById('pdf-contatocli').textContent = `${clienteTel} | ${clienteEmail}`;
        document.getElementById('pdf-nomemont').textContent = montadorNome;

        document.getElementById('pdf-sig-cliente').src = document.getElementById('canvasCliente').toDataURL('image/png');
        document.getElementById('pdf-sig-montador').src = document.getElementById('canvasMontador').toDataURL('image/png');

        // 2. Monta páginas de fotos apenas em memória para o PDF
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

        window.scrollTo(0, 0);
        const pdfTemplate = document.getElementById('pdf-template');
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

        // 3. Gera o PDF em Base64 na memória (sem salvar fotos no Firebase)
        const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
        pdfTemplate.style.display = 'none';

        // 4. Envia o PDF em anexo para os 2 destinatários (Cliente + Empresa) via Google Apps Script
        const respostaEmail = await fetch(GAS_EMAIL_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
                pdfBase64: pdfBase64,
                nomeArquivo: nomeArquivo,
                emailCliente: clienteEmail,
                emailEmpresa: emailSistema,
                nomeCliente: clienteNome,
                pedido: nrPedido
            })
        });

        const resultadoEmail = await respostaEmail.json();
        if (!resultadoEmail.sucesso) {
            throw new Error(resultadoEmail.erro || 'Falha ao disparar e-mail.');
        }

        // 5. Salva APENAS os metadados leves em texto no Firebase Firestore (Zero imagens)
        await db.collection('relatorios').add({
            pedido: nrPedido,
            marca: cliente,
            endereco: endereco,
            clienteNome: clienteNome,
            clienteTel: clienteTel,
            clienteEmail: clienteEmail,
            montadorNome: montadorNome,
            checklist: {
                transporteAdequado: respT1,
                obsTransporte: obsT1,
                obraLimpa: respT2,
                obsObraLimpa: obsT2,
                moveisContrato: respM1,
                obsMoveis: obsM1,
                notaMontagem: Number(notaValor),
                obsMontagem: obsMontagem
            },
            status: status,
            qtdFotosAnexadasNoPdf: todasFotosPDF.length,
            dataEntrega: dataHoje,
            registradoPorUid: usuarioAtual.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Termo finalizado com sucesso!\n\n• Dados registrados no banco.\n• PDF com ${todasFotosPDF.length} foto(s) enviado por e-mail para:\n  - ${clienteEmail}\n  - ${emailSistema}`);

        // 6. Limpa todas as fotos da memória RAM e reseta o formulário
        limparFormularioCompleto();
        mudarEtapa(1);

    } catch (error) {
        console.error('Erro no processamento:', error);
        document.getElementById('pdf-template').style.display = 'none';
        alert('Ocorreu um erro ao enviar o PDF por e-mail ou salvar os dados. Verifique sua conexão e tente novamente.');
    } finally {
        processandoEnvio = false;
        btnGerar.disabled = false;
        btnGerar.innerHTML = textoOriginalBtn;
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
    limparCanvas('canvasCliente');

    document.getElementById('inputNrPedido').value = '';
    document.getElementById('inputCliente').value = '';
    document.getElementById('inputEndereco').value = '';
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteTel').value = '';
    document.getElementById('clienteEmail').value = '';
}
