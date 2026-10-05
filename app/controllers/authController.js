const bcrypt = require("bcryptjs");
const { validationResult } = require('express-validator');
const { usuariosModel, STATUS_USUARIO } = require("../models/usuariosModel");
const { criarToken, verificarToken, impressaoSenha, getBaseUrl } = require('../helpers/tokens');
const { regenerarSessao, salvarSessao, CHAVES_ADMIN } = require('../helpers/sessao');
const { enviarEmail, criarTemplateAtivacaoConta, criarTemplateResetSenha } = require('../services/emailService');

// Hash usado quando o e-mail não existe: o bcrypt.compare roda do mesmo jeito,
// então o tempo de resposta não revela se o e-mail está cadastrado.
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-comparacao', 10);

const ehErroDeToken = (erro) => erro.name === 'TokenExpiredError' || erro.name === 'JsonWebTokenError';

const enviarEmailAtivacao = async ({ id_usuario, nome_usuario, email_usuario }) => {
    const token = criarToken({ id_usuario, tipo: 'ativacao' }, '24h');
    const html = criarTemplateAtivacaoConta({ nomeUsuario: nome_usuario, appBaseUrl: getBaseUrl(), token });
    await enviarEmail({ para: email_usuario, assunto: 'Ative sua conta EcoGeneration', html });
};

// ===== CADASTRO =====
exports.cadastroForm = (req, res) => {
    res.render('cadastro', { titulo: 'Cadastro', old: {}, errors: {} });
};

exports.cadastroSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('cadastro', { old: req.body, errors: errors.mapped() });
    }
    try {
        const existente = await usuariosModel.findByEmailAny(req.body.email);
        if (existente.length > 0) {
            const msg = existente[0].status_usuario === STATUS_USUARIO.INATIVO
                ? 'Este e-mail já está cadastrado, mas a conta ainda não foi ativada. Entre com seu e-mail e senha para receber um novo link de ativação.'
                : 'Este e-mail já está cadastrado.';
            return res.render('cadastro', { old: req.body, errors: { email: { msg } } });
        }
        const resultado = await usuariosModel.create({
            nome: req.body.nome,
            email: req.body.email,
            senha: req.body.senha,
            cpf: req.body.cpf,
            telefone: req.body.telefone,
            cep: req.body.cep,
            numero: req.body.numero,
            complemento: req.body.complemento
        });
        try {
            await enviarEmailAtivacao({
                id_usuario: resultado.insertId,
                nome_usuario: req.body.nome,
                email_usuario: req.body.email
            });
            req.session.flash = { status: 'success', text: 'Cadastro realizado! Verifique seu e-mail para ativar a conta.' };
        } catch (emailErro) {
            console.log(emailErro);
            req.session.flash = { status: 'warning', text: 'Cadastro criado, mas não foi possível enviar o e-mail de ativação. Entre com seu e-mail e senha para receber um novo link.' };
        }
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        console.log(erro);
        res.render('cadastro', { old: req.body, errors: { geral: { msg: 'Erro ao cadastrar. Tente novamente.' } } });
    }
};

// ===== LOGIN =====
exports.loginForm = (req, res) => {
    res.render('login', { errors: {}, old: {} });
};

exports.loginSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { errors: errors.mapped(), old: req.body });
    }
    const erroCredenciais = () => res.render('login', {
        errors: { geral: { msg: 'E-mail ou senha inválidos.' } },
        old: req.body
    });
    try {
        const usuarios = await usuariosModel.findByEmailAny(req.body.email);
        const usuario = usuarios[0];
        const senhaCorreta = await bcrypt.compare(req.body.senha, usuario ? usuario.senha_usuario : HASH_FICTICIO);

        // Mesma mensagem para e-mail inexistente, senha errada e conta excluída
        if (!usuario || !senhaCorreta || usuario.status_usuario === STATUS_USUARIO.EXCLUIDO) {
            return erroCredenciais();
        }

        // Senha correta, mas conta não ativada: reenvia o link de ativação
        if (usuario.status_usuario !== STATUS_USUARIO.ATIVO) {
            let msg = 'Sua conta ainda não foi ativada. Enviamos um novo link de ativação para o seu e-mail.';
            try {
                await enviarEmailAtivacao(usuario);
            } catch (emailErro) {
                console.log(emailErro);
                msg = 'Sua conta ainda não foi ativada e não conseguimos reenviar o link agora. Tente novamente em instantes.';
            }
            return res.render('login', { errors: { geral: { msg } }, old: req.body });
        }

        // Novo id de sessão a cada login (evita fixação de sessão)
        await regenerarSessao(req, CHAVES_ADMIN);
        req.session.usuarioLogado = true;
        req.session.usuarioId = usuario.id_usuario;
        req.session.usuarioNome = usuario.nome_usuario;
        req.session.flash = { status: 'success', text: `Bem-vindo(a) de volta, ${usuario.nome_usuario.split(' ')[0]}!` };
        await salvarSessao(req);
        res.redirect('/');
    } catch (erro) {
        console.log(erro);
        res.render('login', {
            errors: { geral: { msg: 'Erro ao fazer login. Tente novamente.' } },
            old: req.body
        });
    }
};

// ===== ATIVAR CONTA =====
exports.ativarConta = async (req, res) => {
    try {
        const dados = verificarToken(req.query.token);
        if (dados.tipo !== 'ativacao') throw Object.assign(new Error('Token inválido'), { name: 'JsonWebTokenError' });
        const usuarios = await usuariosModel.findById(dados.id_usuario);
        const usuario = usuarios[0];

        // Conta excluída não pode ser reativada por um link antigo
        if (!usuario || usuario.status_usuario === STATUS_USUARIO.EXCLUIDO) {
            req.session.flash = { status: 'error', text: 'Link de ativação inválido.' };
        } else if (usuario.status_usuario === STATUS_USUARIO.ATIVO) {
            req.session.flash = { status: 'success', text: 'Sua conta já está ativa.' };
        } else {
            await usuariosModel.updateStatus(dados.id_usuario, STATUS_USUARIO.ATIVO);
            req.session.flash = { status: 'success', text: 'Conta ativada com sucesso! Você já pode entrar.' };
        }
    } catch (erro) {
        if (!ehErroDeToken(erro)) console.log(erro);
        req.session.flash = {
            status: 'error',
            text: erro.name === 'TokenExpiredError' ? 'O link de ativação expirou. Entre com seu e-mail e senha para receber um novo.'
                : ehErroDeToken(erro) ? 'Link de ativação inválido.'
                : 'Não foi possível ativar a conta agora. Tente novamente em instantes.'
        };
    }
    req.session.save(() => res.redirect('/login'));
};

// ===== RECUPERAR SENHA =====
exports.recuperarSenhaForm = (req, res) => res.render('recuperar-senha', { errors: {}, old: {} });

exports.recuperarSenhaSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('recuperar-senha', { old: req.body, errors: { geral: errors.array()[0] } });
    }
    const email = String(req.body.email || '').trim();
    try {
        const usuarios = await usuariosModel.findByEmailAny(email);
        const usuario = usuarios[0];

        // Só envia para conta ativa — mas a resposta é a mesma em qualquer caso,
        // para a página não revelar quais e-mails estão cadastrados.
        if (usuario && usuario.status_usuario === STATUS_USUARIO.ATIVO) {
            const token = criarToken({
                id_usuario: usuario.id_usuario,
                tipo: 'reset',
                h: impressaoSenha(usuario.senha_usuario)
            }, '1h');
            const html = criarTemplateResetSenha({ nomeUsuario: usuario.nome_usuario, appBaseUrl: getBaseUrl(), token });
            try {
                await enviarEmail({ para: email, assunto: 'Redefinição de senha EcoGeneration', html });
            } catch (emailErro) {
                console.log(emailErro);
            }
        }

        req.session.flash = { status: 'success', text: 'Se este e-mail estiver cadastrado com uma conta ativa, você receberá um link para redefinir a senha.' };
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        console.log(erro);
        return res.render('recuperar-senha', {
            old: req.body,
            errors: { geral: { msg: 'Não foi possível processar o pedido agora. Tente novamente em instantes.' } }
        });
    }
};

// Confere o token de redefinição: tipo certo, conta ativa e senha ainda não
// trocada desde que o link foi gerado. Devolve o id do usuário.
const validarTokenReset = async (token) => {
    const dados = verificarToken(token);
    const hashAtual = dados.tipo === 'reset' ? await usuariosModel.findPasswordById(dados.id_usuario) : null;
    const usuarios = hashAtual ? await usuariosModel.findById(dados.id_usuario) : [];
    if (!usuarios[0] || usuarios[0].status_usuario !== STATUS_USUARIO.ATIVO || dados.h !== impressaoSenha(hashAtual)) {
        throw Object.assign(new Error('Token inválido'), { name: 'JsonWebTokenError' });
    }
    return dados.id_usuario;
};

const linkResetInvalido = (req, res, erro) => {
    if (!ehErroDeToken(erro)) console.log(erro);
    req.session.flash = {
        status: 'error',
        text: erro.name === 'TokenExpiredError' ? 'O link de redefinição expirou. Informe seu e-mail novamente.'
            : ehErroDeToken(erro) ? 'Link de redefinição inválido ou já utilizado. Informe seu e-mail novamente.'
            : 'Não foi possível redefinir a senha agora. Tente novamente em instantes.'
    };
    req.session.save(() => res.redirect('/recuperar-senha'));
};

exports.resetarSenhaForm = async (req, res) => {
    try {
        await validarTokenReset(req.query.token);
        res.render('resetar-senha', { token: req.query.token, errors: {} });
    } catch (erro) {
        linkResetInvalido(req, res, erro);
    }
};

exports.resetarSenhaSubmit = async (req, res) => {
    const token = req.body.token;
    try {
        const idUsuario = await validarTokenReset(token);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('resetar-senha', { token, errors: { geral: errors.array()[0] } });
        }

        await usuariosModel.updatePassword(idUsuario, req.body.senha);
        req.session.flash = { status: 'success', text: 'Senha redefinida com sucesso. Faça login.' };
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        linkResetInvalido(req, res, erro);
    }
};

// ===== LOGOUT =====
exports.logout = async (req, res, next) => {
    try {
        // Sessão nova, sem os dados do usuário (mantém o login de admin, se houver)
        await regenerarSessao(req, CHAVES_ADMIN);
        req.session.flash = { status: 'success', text: 'Você saiu da sua conta. Até logo!' };
        await salvarSessao(req);
        res.redirect('/login');
    } catch (erro) {
        next(erro);
    }
};
