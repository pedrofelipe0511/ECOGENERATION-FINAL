const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const getSecret = () => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
    return process.env.JWT_SECRET;
};

const criarToken = (payload, expiresIn) => jwt.sign(payload, getSecret(), { expiresIn });
const verificarToken = (token) => jwt.verify(token, getSecret());

// "Impressão digital" do hash de senha atual. Vai no token de redefinição:
// quando a senha muda, a impressão muda e o link antigo deixa de valer
// (link de uso único sem precisar de coluna nova no banco).
const impressaoSenha = (hashSenha) =>
    crypto.createHash('sha256').update(String(hashSenha)).digest('hex').slice(0, 16);

const getBaseUrl = () => process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;

module.exports = { criarToken, verificarToken, impressaoSenha, getBaseUrl };
