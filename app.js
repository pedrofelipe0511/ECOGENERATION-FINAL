const express = require("express");
const path = require("path");
const dotenv = require("dotenv").config();

// Falha logo na inicialização se faltar configuração essencial:
// sem isso a sessão usaria um segredo previsível e os tokens não funcionariam.
const variaveisObrigatorias = ["SESSION_SECRET", "JWT_SECRET", "DB_HOST", "DB_USER", "DB_NAME"];
const variaveisAusentes = variaveisObrigatorias.filter((nome) => !process.env[nome]);
if (variaveisAusentes.length > 0) {
  console.error(`Configure no .env: ${variaveisAusentes.join(", ")}`);
  process.exit(1);
}

const pool = require("./config/pool_conexoes");
const session = require("express-session");
const app = express();
const emProducao = process.env.NODE_ENV === "production";

app.use('/simple-notify', express.static(path.join(__dirname, 'node_modules/simple-notify/dist')));
// ESSENCIAL para o Render (proxy reverso com HTTPS)
app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "app/public")));
app.use(express.static(path.join(__dirname, "app/admin/public")));

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "app/views/pages"),
  path.join(__dirname, "app/views/admin")
]);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: emProducao, // HTTPS no Render; HTTP no localhost
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ===== MIDDLEWARE DE FLASH MESSAGES =====
const flash = require('./app/middlewares/flash');
app.use(flash);

// Middleware global — disponibiliza dados da sessão para TODAS as views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.usuarioLogado = req.session && req.session.usuarioLogado;
  res.locals.usuarioNome = req.session && req.session.usuarioNome || '';
  res.locals.adminLoggedIn = req.session && req.session.adminLoggedIn;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rota = require("./app/routes/router");
app.use("/", rota);

// ===== 404 — nenhuma rota atendeu =====
app.use((req, res) => {
  res.status(404).render('404', {
    titulo: 'Página não encontrada',
    mensagem: 'A página que você tentou acessar não existe ou foi removida.'
  });
});

// ===== ERRO GLOBAL — exceções não tratadas nos controllers =====
app.use((erro, req, res, next) => {
  console.error(erro);
  if (res.headersSent) return next(erro);
  res.status(500).render('404', {
    titulo: 'Erro no servidor',
    codigo: 500,
    subtitulo: 'Algo deu errado',
    mensagem: 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.'
  });
});

const porta = process.env.APP_PORT || 3000;
app.listen(porta, (erro) => {
  // No Express 5 o callback também recebe erros (ex.: porta já em uso)
  if (erro) {
    console.error(`Não foi possível iniciar na porta ${porta}: ${erro.message}`);
    process.exit(1);
  }
  console.log(`Servidor online!\n http://localhost:${porta}`);
});
