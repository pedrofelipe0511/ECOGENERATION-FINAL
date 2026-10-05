const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { EXTENSAO_POR_TIPO, tipoImagemPermitido } = require('../helpers/imagens');

const destination = path.join(__dirname, '../public/imagens/perfil');
fs.mkdirSync(destination, { recursive: true });

const storage = multer.diskStorage({
  destination,
  filename: (req, file, cb) => {
    cb(null, `perfil_${req.session.usuarioId}_${Date.now()}${EXTENSAO_POR_TIPO[file.mimetype]}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (tipoImagemPermitido(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'imagem'));
  }
});
