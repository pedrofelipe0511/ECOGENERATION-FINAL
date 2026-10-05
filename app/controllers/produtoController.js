const { produtosModel } = require("../models/produtosModel");

// ===== PAGINA INICIAL =====
exports.home = async (req, res) => {
    try {
        const rotasDestaque = ["ventilador", "powerbank", "lampadasolar"];
        let produtosDestaque = await produtosModel.findByRotaList(rotasDestaque);
        if (!Array.isArray(produtosDestaque) || produtosDestaque.length === 0) {
            produtosDestaque = await produtosModel.findAll(3);
        }
        res.render("index", { titulo: "Pagina inicial", produtosDestaque });
    } catch (erro) {
        console.log(erro);
        res.render("index", { titulo: "Pagina inicial", produtosDestaque: [] });
    }
};

// ===== ECOLOJA (loja paginada) =====
exports.ecoloja = async (req, res) => {
    try {
        const PER_PAGE = 8;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const total = await produtosModel.countAll();
        const totalPages = Math.ceil(total / PER_PAGE);
        const currentPage = Math.min(page, totalPages || 1);
        const produtos = await produtosModel.findPaginated(currentPage, PER_PAGE);

        res.render("ecoloja", {
            titulo: "EcoLoja",
            produtos,
            currentPage,
            totalPages
        });
    } catch (erro) {
        console.log(erro);
        res.status(500).render("ecoloja", {
            titulo: "EcoLoja",
            produtos: [],
            currentPage: 1,
            totalPages: 0
        });
    }
};

// ===== DETALHE DO PRODUTO (por id) =====
exports.detalhePorId = async (req, res) => {
    try {
        const resultados = await produtosModel.findById(req.params.id);
        if (!resultados || resultados.length === 0) {
            return res.status(404).render('404', { titulo: 'Produto não encontrado' });
        }
        const produto = resultados[0];
        res.render('produto', { titulo: produto.nome_produto, produto });
    } catch (erro) {
        console.log(erro);
        res.status(500).send('Erro interno do servidor');
    }
};

// ===== DETALHE DO PRODUTO (por rota amigável, ex: /ventilador) =====
exports.detalhePorRota = async (req, res) => {
    try {
        const rota = req.path.replace(/^\//, '');
        const resultados = await produtosModel.findByRota(rota);
        if (!resultados || resultados.length === 0) {
            return res.status(404).render('404', { titulo: 'Produto não encontrado' });
        }
        const produto = resultados[0];
        res.render('produto', { titulo: produto.nome_produto, produto });
    } catch (erro) {
        console.log(erro);
        res.status(500).send('Erro interno do servidor');
    }
};

// ===== BUSCA DE PRODUTOS =====
exports.busca = async (req, res) => {
    try {
        const termo = req.query.q ? req.query.q.trim() : '';
        if (!termo) {
            return res.render('ecoloja', {
                titulo: 'Resultados da busca',
                produtos: [],
                currentPage: 1,
                totalPages: 0
            });
        }

        const produtos = await produtosModel.findByQuery(termo);
        res.render('ecoloja', {
            titulo: `Busca: ${termo}`,
            produtos,
            currentPage: 1,
            totalPages: 0
        });
    } catch (erro) {
        console.log(erro);
        res.render('ecoloja', {
            titulo: 'Resultados da busca',
            produtos: [],
            currentPage: 1,
            totalPages: 0
        });
    }
};

// ===== PÁGINAS ESTÁTICAS =====
exports.sobreNos = (req, res) => res.render("sobre-nos", { titulo: "Sobre Nós" });
exports.calculadoraTelaInicial = (req, res) => res.render("diagnosticotela-inicial", { titulo: "Diagnóstico" });
