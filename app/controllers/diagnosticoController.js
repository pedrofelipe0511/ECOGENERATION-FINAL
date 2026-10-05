const { validationResult } = require('express-validator');
const { produtosModel } = require("../models/produtosModel");
const { diagnosticosModel } = require("../models/diagnosticosModel");
const { calcularDiagnostico } = require("../models/diagnosticoRegras");

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

    const { frequencia, duracao, prioridade, moradia } = req.body;
    const resultado = calcularDiagnostico(req.body);

    // ── SALVAR ───────────────────────────────────────────────
    let diagnosticoSalvo = true;
    try {
        await diagnosticosModel.create({
            id_usuario:      req.session.usuarioId ? parseInt(req.session.usuarioId) : null,
            frequencia,
            impacto:         duracao,
            preparacao:      resultado.preparacoes.join(', '),
            prioridade,
            tolerancia:      moradia,
            nivel_autonomia: resultado.perfil
        });
    } catch (erro) {
        console.log('Erro ao salvar diagnóstico:', erro);
        diagnosticoSalvo = false;
    }

    // ── PRODUTOS ─────────────────────────────────────────────
    // Primeiro a categoria ideal dentro do orçamento; se não houver nenhum
    // produto nela, qualquer categoria — mas sempre respeitando o orçamento.
    let produtosRecomendados = [];
    try {
        produtosRecomendados = await produtosModel.findRecomendados({
            categoria: resultado.categoria,
            precoMaximo: resultado.precoMaximo
        });
        if (produtosRecomendados.length === 0) {
            produtosRecomendados = await produtosModel.findRecomendados({ precoMaximo: resultado.precoMaximo });
        }
    } catch (erro) {
        console.log('Erro ao buscar produtos recomendados:', erro);
    }

    const nivelParaView = resultado.perfil === 'independente' ? 'alta'
                        : resultado.perfil === 'critico'      ? 'baixa'
                        : 'media';

    res.render('resultado', {
        nivel: nivelParaView,
        perfil: resultado.perfil,
        produtosRecomendados,
        prioridade,
        vulnerabilidade: resultado.vulnerabilidade,
        preparo: resultado.preparo,
        diagnosticoSalvo
    });
};

// Redireciona GET /resultado para o diagnóstico (evita erro no F5)
exports.redirecionarResultado = (req, res) => {
    res.redirect('/diagnostico');
};
