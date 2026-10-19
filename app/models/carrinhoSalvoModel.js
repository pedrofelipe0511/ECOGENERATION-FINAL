const pool = require("../../config/pool_conexoes");

// Cópia do carrinho no banco para quem está logado (tabela carrinho_itens).
// Guarda só produto e quantidade: preço, nome e imagem vêm sempre de produtos.
const carrinhoSalvoModel = {

    buscar: async (id_usuario) => {
        const [linhas] = await pool.query(
            "SELECT id_produto, quantidade FROM carrinho_itens WHERE id_usuario = ? ORDER BY atualizado_em, id_produto",
            [id_usuario]
        );
        return linhas;
    },

    // Troca o carrinho salvo inteiro pelo atual (numa transação)
    substituir: async (id_usuario, itens) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            await conexao.query("DELETE FROM carrinho_itens WHERE id_usuario = ?", [id_usuario]);
            if (itens.length) {
                await conexao.query(
                    "INSERT INTO carrinho_itens (id_usuario, id_produto, quantidade) VALUES ?",
                    [itens.map((i) => [id_usuario, i.id_produto, i.quantidade])]
                );
            }
            await conexao.commit();
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Pagamento aprovado: tira do carrinho salvo os produtos daquele pedido
    removerItensDoPedido: async (id_pedido) => {
        const [resultado] = await pool.query(
            `DELETE c FROM carrinho_itens c
             JOIN pedidos p ON p.id_usuario = c.id_usuario
             JOIN itens_pedido i ON i.id_pedido = p.id_pedido AND i.id_produto = c.id_produto
             WHERE p.id_pedido = ?`,
            [id_pedido]
        );
        return resultado.affectedRows;
    }
};

module.exports = { carrinhoSalvoModel };
