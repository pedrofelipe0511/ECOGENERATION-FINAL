const crypto = require('crypto');
const { regenerarSessao, salvarSessao, CHAVES_USUARIO } = require('../../helpers/sessao');

// Compara textos em tempo constante (não revela quantos caracteres acertou).
const textosIguais = (a, b) => {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

// ===== LOGIN ADMIN =====
exports.loginForm = (req, res) => {
  res.render('admin-login', { titulo: 'Login Admin', erro: '' });
};

exports.loginSubmit = async (req, res, next) => {
  const { usuario, senha } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  // Sem credenciais configuradas, ninguém entra (nunca "undefined === undefined")
  if (!ADMIN_USER || !ADMIN_PASS) {
    console.log('ADMIN_USER/ADMIN_PASS não configurados no .env — login administrativo bloqueado.');
    return res.render('admin-login', { titulo: 'Login Admin', erro: 'Acesso administrativo indisponível no momento.' });
  }

  const credenciaisValidas = typeof usuario === 'string' && typeof senha === 'string' &&
    textosIguais(usuario, ADMIN_USER) && textosIguais(senha, ADMIN_PASS);

  if (!credenciaisValidas) {
    return res.render('admin-login', {
      titulo: 'Login Admin',
      erro: 'Usuário ou senha inválidos!'
    });
  }

  try {
    // Novo id de sessão no login (mantém o login de usuário comum, se houver)
    await regenerarSessao(req, CHAVES_USUARIO);
    req.session.adminLoggedIn = true;
    req.session.adminUser = usuario;
    req.session.flash = { status: 'success', text: 'Login administrativo realizado com sucesso!' };
    await salvarSessao(req);
    res.redirect('/admin');
  } catch (erro) {
    next(erro);
  }
};

// ===== LOGOUT ADMIN =====
exports.logout = async (req, res, next) => {
  try {
    await regenerarSessao(req, CHAVES_USUARIO);
    req.session.flash = { status: 'success', text: 'Você saiu da administração. Até logo!' };
    await salvarSessao(req);
    res.redirect('/');
  } catch (erro) {
    next(erro);
  }
};
