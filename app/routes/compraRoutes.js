const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const requireLogin = require("../middlewares/requireLogin");
const compraController = require("../controllers/compraController");

router.get('/confirmar-compra/:id', requireLogin, compraController.confirmarCompraForm);
router.post('/confirmar-compra/:id', requireLogin,
    [
        check('id').isInt({ min: 1 }),
        // A integração de pagamento ainda não existe: só confere se a opção é válida
        check('forma_pagamento').isIn(['pix', 'credito', 'debito']),
    ],
    compraController.confirmarCompraSubmit
);
router.get('/compra-sucesso', requireLogin, compraController.compraSucesso);

module.exports = router;
