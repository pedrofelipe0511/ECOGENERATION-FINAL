const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const requireLogin = require("../middlewares/requireLogin");
const userController = require("../controllers/userController");
const profileUpload = require('../middlewares/profileUpload');

router.get('/perfil', requireLogin, userController.perfil);
router.post('/perfil', requireLogin, (req, res, next) => {
	profileUpload.single('imagem')(req, res, (erro) => {
		if (erro) {
			req.session.flash = { status: 'error', text: 'Imagem inválida ou maior que 5 MB.' };
			return res.redirect('/perfil');
		}
		next();
	});
},
	// As regras vêm DEPOIS do upload: o corpo multipart só existe após o Multer
	[
		check('nome').trim().notEmpty().withMessage('Informe seu nome.')
			.isLength({ max: 100 }).withMessage('O nome deve ter no máximo 100 caracteres.'),
		check('telefone').trim().optional({ checkFalsy: true })
			.matches(/^\(\d{2}\)\s?\d{5}-\d{4}$/).withMessage('Telefone inválido. Formato: (XX) XXXXX-XXXX'),
		check('cep').trim().optional({ checkFalsy: true })
			.matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido. Formato: 00000-000'),
		check('numero').trim().optional({ checkFalsy: true })
			.isLength({ max: 10 }).withMessage('O número deve ter no máximo 10 caracteres.'),
		check('complemento').trim().optional({ checkFalsy: true })
			.isLength({ max: 100 }).withMessage('O complemento deve ter no máximo 100 caracteres.'),
		check('senha').optional({ checkFalsy: true })
			.isLength({ min: 6, max: 72 }).withMessage('A nova senha deve ter entre 6 e 72 caracteres.'),
		check('confirmarSenha').custom((valor, { req }) => (valor || '') === (req.body.senha || ''))
			.withMessage('A confirmação da nova senha não confere.'),
	],
	userController.atualizarPerfil
);
router.post('/excluir-conta', requireLogin, userController.excluirConta);

module.exports = router;
