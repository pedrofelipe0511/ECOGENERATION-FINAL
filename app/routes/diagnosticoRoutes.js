const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const requireLogin = require("../middlewares/requireLogin");
const diagnosticoController = require("../controllers/diagnosticoController");
const { OPCOES } = require("../models/diagnosticoRegras");

router.get('/diagnostico', requireLogin, diagnosticoController.form);
router.post('/diagnostico', requireLogin,
    [
        check('frequencia').isIn(OPCOES.frequencia),
        check('duracao').isIn(OPCOES.duracao),
        check('preparacao').toArray().isArray({ min: 1 }),
        check('preparacao.*').isIn(OPCOES.preparacao),
        check('prioridade').isIn(OPCOES.prioridade),
        check('moradia').isIn(OPCOES.moradia),
        check('orcamento').isIn(OPCOES.orcamento),
    ],
    diagnosticoController.calcular
);
router.get('/resultado', diagnosticoController.redirecionarResultado);

module.exports = router;
