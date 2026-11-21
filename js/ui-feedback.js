const UIFeedback = {
    // Notificação flutuante não-bloqueante (Toast)
    toast(mensagem, tipo = 'info', duracao = 3800) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-16 right-4 left-4 sm:left-auto sm:w-96 z-[110] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }

        const estilos = {
            sucesso: {
                borda: 'border-emerald-500/60',
                iconeBg: 'bg-emerald-500/20 text-emerald-400',
                icone: 'fa-circle-check',
                titulo: 'Concluído'
            },
            erro: {
                borda: 'border-red-500/60',
                iconeBg: 'bg-red-500/20 text-red-400',
                icone: 'fa-circle-exclamation',
                titulo: 'Atenção'
            },
            alerta: {
                borda: 'border-amber-500/60',
                iconeBg: 'bg-amber-500/20 text-amber-400',
                icone: 'fa-triangle-exclamation',
                titulo: 'Aviso'
            },
            info: {
                borda: 'border-indigo-500/60',
                iconeBg: 'bg-indigo-500/20 text-indigo-400',
                icone: 'fa-circle-info',
                titulo: 'Informação'
            }
        };

        const cfg = estilos[tipo] || estilos.info;
        const toastEl = document.createElement('div');
        toastEl.className = `pointer-events-auto bg-slate-800 border ${cfg.borda} rounded-xl p-3.5 shadow-2xl flex items-start space-x-3 transform transition-all duration-300 translate-y-[-12px] opacity-0`;

        toastEl.innerHTML = `
            <div class="w-8 h-8 rounded-lg ${cfg.iconeBg} flex items-center justify-center shrink-0 mt-0.5">
                <i class="fa-solid ${cfg.icone} text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-white">${cfg.titulo}</p>
                <p class="text-[11px] text-slate-300 leading-snug mt-0.5 whitespace-pre-line"></p>
            </div>
            <button type="button" class="text-slate-400 hover:text-white text-xs p-1">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        toastEl.querySelector('p.whitespace-pre-line').textContent = mensagem;

        const fechar = () => {
            toastEl.classList.add('opacity-0', 'translate-y-[-12px]');
            setTimeout(() => toastEl.remove(), 250);
        };

        toastEl.querySelector('button').addEventListener('click', fechar);
        container.appendChild(toastEl);

        requestAnimationFrame(() => {
            toastEl.classList.remove('translate-y-[-12px]', 'opacity-0');
        });

        setTimeout(fechar, duracao);
    },

    // Modal elegante de aviso detalhado (substitui alert() importantes)
    alertaModal({ titulo = 'Aviso do Sistema', mensagem = '', tipo = 'sucesso', textoBotao = 'Entendi' }) {
        return new Promise((resolve) => {
            const estilos = {
                sucesso: {
                    iconeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                    icone: 'fa-check',
                    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white'
                },
                erro: {
                    iconeBg: 'bg-red-500/20 text-red-400 border-red-500/40',
                    icone: 'fa-xmark',
                    btnClass: 'bg-red-600 hover:bg-red-500 text-white'
                },
                alerta: {
                    iconeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                    icone: 'fa-exclamation',
                    btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }
            };

            const cfg = estilos[tipo] || estilos.sucesso;
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] opacity-0 transition-opacity duration-200';

            overlay.innerHTML = `
                <div class="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-95 transition-transform duration-200 text-center space-y-4">
                    <div class="w-12 h-12 rounded-full border ${cfg.iconeBg} flex items-center justify-center mx-auto text-lg">
                        <i class="fa-solid ${cfg.icone}"></i>
                    </div>
                    <div class="space-y-1.5">
                        <h3 class="text-base font-bold text-white"></h3>
                        <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line"></p>
                    </div>
                    <button type="button" id="btnModalAlertOk" class="w-full ${cfg.btnClass} font-bold py-2.5 rounded-xl text-xs transition shadow">
                        ${Security.escaparHTML(textoBotao)}
                    </button>
                </div>
            `;

            overlay.querySelector('h3').textContent = titulo;
            overlay.querySelector('p').textContent = mensagem;
            document.body.appendChild(overlay);

            const card = overlay.firstElementChild;
            requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                card.classList.remove('scale-95');
            });

            const fechar = () => {
                overlay.classList.add('opacity-0');
                card.classList.add('scale-95');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 200);
            };

            overlay.querySelector('#btnModalAlertOk').addEventListener('click', fechar);
        });
    },

    // Modal elegante de confirmação (substitui confirm())
    confirmar({
        titulo = 'Confirmar Ação',
        mensagem = 'Deseja prosseguir?',
        textoConfirmar = 'Confirmar',
        textoCancelar = 'Cancelar',
        perigoso = false
    }) {
        return new Promise((resolve) => {
            const btnConfirmarClass = perigoso
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950';

            const iconeClass = perigoso
                ? 'bg-red-500/20 text-red-400 border-red-500/40 fa-trash-can'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40 fa-circle-question';

            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] opacity-0 transition-opacity duration-200';

            overlay.innerHTML = `
                <div class="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-95 transition-transform duration-200 space-y-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl border ${iconeClass.split(' fa-')[0]} flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-${iconeClass.split(' fa-')[1]}"></i>
                        </div>
                        <h3 class="text-sm font-bold text-white leading-tight"></h3>
                    </div>
                    <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line"></p>
                    <div class="flex space-x-2 pt-2">
                        <button type="button" id="btnModalCancel" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl text-xs transition">
                            ${Security.escaparHTML(textoCancelar)}
                        </button>
                        <button type="button" id="btnModalConfirm" class="flex-1 ${btnConfirmarClass} font-bold py-2.5 rounded-xl text-xs transition shadow">
                            ${Security.escaparHTML(textoConfirmar)}
                        </button>
                    </div>
                </div>
            `;

            overlay.querySelector('h3').textContent = titulo;
            overlay.querySelector('p').textContent = mensagem;
            document.body.appendChild(overlay);

            const card = overlay.firstElementChild;
            requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                card.classList.remove('scale-95');
            });

            const finalizar = (resultado) => {
                overlay.classList.add('opacity-0');
                card.classList.add('scale-95');
                setTimeout(() => {
                    overlay.remove();
                    resolve(resultado);
                }, 200);
            };

            overlay.querySelector('#btnModalCancel').addEventListener('click', () => finalizar(false));
            overlay.querySelector('#btnModalConfirm').addEventListener('click', () => finalizar(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) finalizar(false);
            });
        });
    }
};
