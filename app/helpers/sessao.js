// Utilitários de sessão em forma de Promise, para usar com async/await.

// Gera um NOVO id de sessão (evita fixação de sessão no login/logout),
// copiando para a sessão nova apenas as chaves informadas.
const regenerarSessao = (req, chavesMantidas = []) => new Promise((resolve, reject) => {
    const mantidos = {};
    chavesMantidas.forEach((chave) => {
        if (req.session[chave] !== undefined && req.session[chave] !== null) {
            mantidos[chave] = req.session[chave];
        }
    });
    req.session.regenerate((erro) => {
        if (erro) return reject(erro);
        Object.assign(req.session, mantidos);
        resolve();
    });
});

const salvarSessao = (req) => new Promise((resolve, reject) => {
    req.session.save((erro) => (erro ? reject(erro) : resolve()));
});

// Chaves de cada tipo de login, para um não derrubar o outro.
const CHAVES_USUARIO = ['usuarioLogado', 'usuarioId', 'usuarioNome'];
const CHAVES_ADMIN = ['adminLoggedIn', 'adminUser'];

module.exports = { regenerarSessao, salvarSessao, CHAVES_USUARIO, CHAVES_ADMIN };
