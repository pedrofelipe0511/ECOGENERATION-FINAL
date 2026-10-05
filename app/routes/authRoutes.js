const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const authController = require("../controllers/authController");
const { validarCPF, validarCNPJ } = require("../helpers/validadores");
const { validarEmailReal } = require("../helpers/validarEmailReal");

router.get('/cadastro', authController.cadastroForm);
router.post('/cadastro',
    [
        check('nome').notEmpty().withMessage('Nome é obrigatório'),
        check('email').isEmail().withMessage('Email inválido')
            .bail() // só continua para a checagem de DNS se o formato já estiver ok
            .custom(validarEmailReal).withMessage('Este domínio de e-mail não existe ou não recebe mensagens'),
        check('senha').isLength({ min: 6, max: 72 }).withMessage('A senha deve ter entre 6 e 72 caracteres'),
        check('cpf').optional({ checkFalsy: true }).custom(validarCPF).withMessage('CPF inválido'),
        check('telefone').optional({ checkFalsy: true }).matches(/^\(\d{2}\)\s?\d{5}-\d{4}$/).withMessage('Telefone inválido. Formato: (XX) XXXXX-XXXX'),
        check('cep').optional({ checkFalsy: true }).matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido. Formato: 00000-000'),
        check('numero').optional({ checkFalsy: true }).isLength({ max: 10 }).withMessage('Número inválido'),
        check('complemento').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('Complemento inválido'),
        check('cnpj').optional({ checkFalsy: true }).custom(validarCNPJ).withMessage('CNPJ inválido'),
        check('rg').optional({ checkFalsy: true }).isLength({ min: 5 }).withMessage('RG deve ter no mínimo 5 caracteres'),
    ],
    authController.cadastroSubmit
);

router.get('/login', authController.loginForm);
router.get('/ativar-conta', authController.ativarConta);
router.get('/recuperar-senha', authController.recuperarSenhaForm);
router.post('/recuperar-senha',
    [
        check('email').isEmail().withMessage('Informe um e-mail válido')
            .bail()
            .custom(validarEmailReal).withMessage('Este domínio de e-mail não existe ou não recebe mensagens'),
    ],
    authController.recuperarSenhaSubmit
);
router.get('/resetar-senha', authController.resetarSenhaForm);
router.post('/resetar-senha',
    [
        check('senha').isLength({ min: 6, max: 72 }).withMessage('A senha deve ter entre 6 e 72 caracteres.'),
        check('confirmarSenha').custom((valor, { req }) => valor === req.body.senha).withMessage('As senhas digitadas não coincidem.'),
    ],
    authController.resetarSenhaSubmit
);
router.post('/login',
    [
        check('email').isEmail().withMessage('Email inválido'),
        check('senha').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
    ],
    authController.loginSubmit
);

router.get('/logout', authController.logout);

module.exports = router;
