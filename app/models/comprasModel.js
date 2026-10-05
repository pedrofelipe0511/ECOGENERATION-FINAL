const pool = require("../../config/pool_conexoes");

const comprasModel = {

    // Regra de negócio: só vende se houver estoque. A baixa do estoque e o
    // registro da compra acontecem numa TRANSAÇÃO — ou os dois são gravados,
    // ou nenhum. Retorna null quando o produto está esgotado ou indisponível.
    createComBaixaEstoque: async (id_usuario, id_produto) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();

            // O "estoque_produto > 0" no WHERE impede vender a mesma última
            // unidade para duas pessoas ao mesmo tempo.
            const [baixa] = await conexao.query(
                "UPDATE produtos SET estoque_produto = estoque_produto - 1 WHERE id_produto = ? AND status_produto = 1 AND estoque_produto > 0",
                [id_produto]
            );
            if (baixa.affectedRows === 0) {
                await conexao.rollback();
                return null;
            }

            const [[produto]] = await conexao.query(
                "SELECT nome_produto, preco_produto, imagem_produto FROM produtos WHERE id_produto = ?",
                [id_produto]
            );
            const [resultado] = await conexao.query(
                "INSERT INTO compras (id_usuario, id_produto, nome_produto, preco_produto, imagem_produto, status_compra) VALUES (?, ?, ?, ?, ?, ?)",
                [id_usuario, id_produto, produto.nome_produto, produto.preco_produto, produto.imagem_produto, 'confirmado']
            );

            await conexao.commit();
            return { id_compra: resultado.insertId, ...produto };
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Buscar todas as compras de um usuário
    findByUsuario: async (id_usuario) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM compras WHERE id_usuario = ? ORDER BY id_compra DESC",
                [id_usuario]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Buscar uma compra específica pelo ID
    findById: async (id) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM compras WHERE id_compra = ?",
                [id]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Atualizar status de uma compra (para admin)
    updateStatus: async (id, status) => {
        try {
            const [resultado] = await pool.query(
                "UPDATE compras SET status_compra = ? WHERE id_compra = ?",
                [status, id]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Buscar todas as compras (para admin)
    findAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT compras.*, usuarios.nome_usuario, usuarios.email_usuario FROM compras LEFT JOIN usuarios ON compras.id_usuario = usuarios.id_usuario ORDER BY compras.id_compra DESC"
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Contar todas as compras (para dashboard)
    countAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT COUNT(*) AS total FROM compras"
            );
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    }

}

module.exports = { comprasModel };
