// Configuração do Multer para upload de imagens de produtos (usado pelo admin).
const multer = require('multer');
const path = require('path');
const { EXTENSAO_POR_TIPO, tipoImagemPermitido } = require('../helpers/imagens');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/imagens'));
  },
  filename: (req, file, cb) => {
    cb(null, `produto_${Date.now()}${EXTENSAO_POR_TIPO[file.mimetype]}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (tipoImagemPermitido(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas!'));
  }
});

module.exports = upload;
