const fs = require('fs');

// Tipos de imagem aceitos e a extensão gravada para cada um. A extensão do
// arquivo salvo vem SEMPRE desta tabela, nunca do nome enviado pelo usuário
// (assim um "foto.html" disfarçado de imagem não vira uma página no site).
const EXTENSAO_POR_TIPO = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

const tipoImagemPermitido = (mimetype) => Object.prototype.hasOwnProperty.call(EXTENSAO_POR_TIPO, mimetype);

// Apaga um arquivo do disco sem derrubar a requisição se ele não existir.
const removerArquivo = (caminho) => {
    try {
        if (caminho && fs.existsSync(caminho)) fs.unlinkSync(caminho);
    } catch (erro) {
        console.log('Não foi possível remover o arquivo:', erro.message);
    }
};

module.exports = { EXTENSAO_POR_TIPO, tipoImagemPermitido, removerArquivo };
