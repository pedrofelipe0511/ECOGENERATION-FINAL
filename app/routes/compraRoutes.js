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
// Kit recomendado pelo diagnóstico: 1 a 3 produtos comprados juntos
// (a mesma regra vale para ?item= na tela e item= no formulário)
const regrasItensKit = () => [
    check('item').toArray().isArray({ min: 1, max: 3 }),
    check('item.*').isInt({ min: 1 }),
];

router.get('/confirmar-kit', requireLogin, regrasItensKit(), compraController.confirmarKitForm);
router.post('/confirmar-kit', requireLogin,
    [
        ...regrasItensKit(),
        check('forma_pagamento').isIn(['pix', 'credito', 'debito']),
    ],
    compraController.confirmarKitSubmit
);
router.get('/compra-sucesso', requireLogin, compraController.compraSucesso);

module.exports = router;
