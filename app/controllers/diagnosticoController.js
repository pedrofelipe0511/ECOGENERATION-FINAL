const { validationResult } = require('express-validator');
const { produtosModel } = require("../models/produtosModel");
const { diagnosticosModel } = require("../models/diagnosticosModel");
const { calcularDiagnostico, montarKit } = require("../models/diagnosticoRegras");

// ===== TELA DO DIAGNÓSTICO =====
exports.form = (req, res) => {
    res.render('diagnostico', { titulo: 'Diagnóstico de Autonomia Energética' });
};

// ===== CALCULAR E SALVAR DIAGNÓSTICO =====
exports.calcular = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.flash = { status: 'error', text: 'Responda todas as perguntas do diagnóstico antes de continuar.' };
        return req.session.save(() => res.redirect('/diagnostico'));
    }

    const { frequencia, duracao, moradia, orcamento, aparelhos } = req.body;
    const resultado = calcularDiagnostico(req.body);

    // ── SALVAR ───────────────────────────────────────────────
    let diagnosticoSalvo = true;
    try {
        await diagnosticosModel.create({
            id_usuario:      req.session.usuarioId ? parseInt(req.session.usuarioId) : null,
            frequencia,
            impacto:         duracao,
            preparacao:      resultado.preparacoes.join(', '),
            prioridade:      aparelhos.join(', '), // aparelhos que a pessoa quer manter ligados
            tolerancia:      moradia,
            nivel_autonomia: resultado.perfil
        });
    } catch (erro) {
        console.log('Erro ao salvar diagnóstico:', erro);
        diagnosticoSalvo = false;
    }

    // ── KIT RECOMENDADO ──────────────────────────────────────
    let plano = { kit: null, alternativa: null, teto: null, aparelhos };
    try {
        const produtos = await produtosModel.findParaKit();
        plano = montarKit({ aparelhos, duracao, orcamento }, produtos);
    } catch (erro) {
        console.log('Erro ao montar o kit:', erro);
    }

    const nivelParaView = resultado.perfil === 'independente' ? 'alta'
                        : resultado.perfil === 'critico'      ? 'baixa'
                        : 'media';

    res.render('resultado', {
        nivel: nivelParaView,
        perfil: resultado.perfil,
        vulnerabilidade: resultado.vulnerabilidade,
        preparo: resultado.preparo,
        plano,
        diagnosticoSalvo
    });
};

// Redireciona GET /resultado para o diagnóstico (evita erro no F5)
exports.redirecionarResultado = (req, res) => {
    res.redirect('/diagnostico');
};
