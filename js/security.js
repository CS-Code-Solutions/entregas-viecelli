const Security = {
    // Previne XSS ao montar HTML dinâmico
    escaparHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Sanitiza strings antes de gravar no Firestore
    sanitizarTexto(str, maxLen = 250) {
        if (!str) return '';
        return String(str)
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .trim()
            .slice(0, maxLen);
    },

    // Valida número de pedido (somente dígitos)
    validarNumeroPedido(nr) {
        return /^[0-9]{1,15}$/.test(String(nr).trim());
    },

    // Valida formato de e-mail
    validarEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
    },

    // Valida imagem anexada (tipo MIME e tamanho máximo de 10MB antes da compressão)
    validarArquivoImagem(file) {
        if (!file) return false;
        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        const maxBytes = 10 * 1024 * 1024;
        return tiposPermitidos.includes(file.type) && file.size <= maxBytes;
    },

    // Valida DataURL de imagem gerada localmente
    validarDataUrlImagem(dataUrl) {
        return typeof dataUrl === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
    }
};
