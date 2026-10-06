const pool = require("../../config/pool_conexoes");

const produtosModel = {

    findAll: async (limit = null) => {
        try {
            let query = "SELECT * FROM produtos WHERE status_produto = 1";
            const params = [];
            if (limit && Number.isInteger(limit)) {
                query += " LIMIT ?";
                params.push(limit);
            }
            const [resultado] = await pool.query(query, params);
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findPaginated: async (page = 1, perPage = 8) => {
        try {
            const offset = (page - 1) * perPage;
            const [resultado] = await pool.query(
                "SELECT * FROM produtos WHERE status_produto = 1 LIMIT ? OFFSET ?",
                [perPage, offset]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    countAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT COUNT(*) as total FROM produtos WHERE status_produto = 1"
            );
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    },

    findById: async (id) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM produtos WHERE status_produto = 1 AND id_produto = ?",
                [id]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findByCategoria: async (categoria, limit = null) => {
        try {
            let query = "SELECT * FROM produtos WHERE categoria_produto = ? AND status_produto = 1";
            const params = [categoria];
            if (limit && Number.isInteger(limit)) {
                query += " LIMIT ?";
                params.push(limit);
            }
            const [resultado] = await pool.query(query, params);
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Produtos que podem entrar no kit do diagnóstico: ativos, com estoque
    // e com o tipo de energia cadastrado pelo admin
    findParaKit: async () => {
        try {
            const [resultado] = await pool.query(
                `SELECT id_produto, nome_produto, preco_produto, imagem_produto, tipo_energia, capacidade_energia
                 FROM produtos
                 WHERE status_produto = 1 AND estoque_produto > 0 AND tipo_energia IS NOT NULL
                 ORDER BY preco_produto ASC`
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Produtos para o resultado do diagnóstico: só itens com estoque, dentro do
    // orçamento (precoMaximo null = sem teto) e, se informada, da categoria.
    findRecomendados: async ({ categoria = null, precoMaximo = null, limite = 4 } = {}) => {
        try {
            let query = "SELECT * FROM produtos WHERE status_produto = 1 AND estoque_produto > 0";
            const params = [];
            if (categoria) {
                query += " AND categoria_produto = ?";
                params.push(categoria);
            }
            if (precoMaximo !== null) {
                query += " AND preco_produto <= ?";
                params.push(precoMaximo);
            }
            query += " ORDER BY preco_produto ASC LIMIT ?";
            params.push(limite);
            const [resultado] = await pool.query(query, params);
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findByRota: async (rota) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM produtos WHERE rota_produto = ? AND status_produto = 1",
                [rota]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findByRotaList: async (rotas = []) => {
        try {
            if (!Array.isArray(rotas) || rotas.length === 0) {
                return [];
            }

            const placeholders = rotas.map(() => '?').join(',');
            const query = `SELECT * FROM produtos WHERE rota_produto IN (${placeholders}) AND status_produto = 1 ORDER BY FIELD(rota_produto, ${placeholders})`;
            const params = [...rotas, ...rotas];
            const [resultado] = await pool.query(query, params);
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findByQuery: async (busca, limit = null) => {
        try {
            const termo = `%${busca}%`;
            let query = `SELECT * FROM produtos WHERE status_produto = 1 AND (
                nome_produto LIKE ? OR descricao_produto LIKE ? OR categoria_produto LIKE ? OR rota_produto LIKE ?
            )`;
            const params = [termo, termo, termo, termo];

            if (limit && Number.isInteger(limit)) {
                query += ' LIMIT ?';
                params.push(limit);
            }

            const [resultado] = await pool.query(query, params);
            return resultado;
        } catch (erro) {
            throw erro;
        }
    }

}

module.exports = { produtosModel };
