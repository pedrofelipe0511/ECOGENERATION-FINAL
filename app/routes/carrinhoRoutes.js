const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const carrinhoController = require("../controllers/carrinhoController");

// Carrinho de compras (fica na sessão). Alterações usam POST, nunca GET.
const regraId = check('id').isInt({ min: 1 }).toInt();

router.get('/carrinho', carrinhoController.listar);
router.post('/carrinho/adicionar',
    [regraId, check('qtde').optional().isInt({ min: 1, max: 10 }).toInt(), check('ir').optional().isIn(['carrinho'])],
    carrinhoController.adicionar
);
router.post('/carrinho/adicionar-kit',
    [check('item').toArray().isArray({ min: 1, max: 3 }), check('item.*').isInt({ min: 1 }).toInt()],
    carrinhoController.adicionarKit
);
router.post('/carrinho/diminuir', regraId, carrinhoController.diminuir);
router.post('/carrinho/remover', regraId, carrinhoController.remover);

module.exports = router;
