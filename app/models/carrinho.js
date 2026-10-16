// Carrinho de compras (material PSW3 – carrinho de compras).
// Os itens ficam na SESSÃO de cada usuário (req.session.carrinho) — nunca numa
// variável do módulo, que seria compartilhada entre todos os visitantes.
// Preço, nome e imagem vêm sempre do banco (Model de produtos).
const { produtosModel } = require('./produtosModel');

const LIMITE_POR_ITEM = 10;

const buscarProduto = async (id) => {
    const resultados = await produtosModel.findById(id); // só produtos ativos
    return resultados && resultados[0] ? resultados[0] : null;
};

const carrinho = {

    itens: (sessao) => sessao.carrinho || [],

    // Adiciona "qtde" unidades. Devolve { erro } se não for possível.
    addItem: async (sessao, codProduto, qtde = 1) => {
        const produto = await buscarProduto(codProduto);
        if (!produto) return { erro: 'Este produto não está mais disponível.' };

        const itens = carrinho.itens(sessao);
        const existente = itens.find((i) => i.codproduto === produto.id_produto);
        const novaQtde = (existente ? existente.qtde : 0) + qtde;

        if (novaQtde > produto.estoque_produto) {
            return { erro: produto.estoque_produto > 0
                ? `Temos só ${produto.estoque_produto} unidade(s) de "${produto.nome_produto}" em estoque.`
                : `"${produto.nome_produto}" está esgotado no momento.` };
        }
        if (novaQtde > LIMITE_POR_ITEM) return { erro: `O limite é de ${LIMITE_POR_ITEM} unidades por produto.` };

        if (existente) {
            existente.qtde = novaQtde;
        } else {
            itens.push({
                codproduto: produto.id_produto,
                qtde: novaQtde,
                preco: Number(produto.preco_produto),
                produto: produto.nome_produto,
                imagem: produto.imagem_produto
            });
        }
        sessao.carrinho = itens;
        return { ok: true, produto };
    },

    // Diminui "qtde" unidades; se chegar a zero, tira o item do carrinho
    removeItem: (sessao, codProduto, qtde = 1) => {
        const itens = carrinho.itens(sessao);
        const item = itens.find((i) => i.codproduto === codProduto);
        if (!item) return;
        item.qtde -= qtde;
        sessao.carrinho = item.qtde > 0 ? itens : itens.filter((i) => i !== item);
    },

    // Remove o item inteiro
    excluirItem: (sessao, codProduto) => {
        sessao.carrinho = carrinho.itens(sessao).filter((i) => i.codproduto !== codProduto);
    },

    esvaziar: (sessao) => {
        sessao.carrinho = [];
    },

    getQtdeItens: (sessao) => carrinho.itens(sessao).reduce((total, i) => total + i.qtde, 0),

    // Confere o carrinho com o banco: atualiza preço/nome/imagem, tira produtos
    // que saíram da loja e ajusta quantidades maiores que o estoque.
    atualizarCarrinho: async (sessao) => {
        const avisos = [];
        const atualizados = [];
        for (const item of carrinho.itens(sessao)) {
            const produto = await buscarProduto(item.codproduto);
            if (!produto || produto.estoque_produto <= 0) {
                avisos.push(`"${item.produto}" saiu do carrinho porque não está mais disponível.`);
                continue;
            }
            let qtde = item.qtde;
            if (qtde > produto.estoque_produto) {
                qtde = produto.estoque_produto;
                avisos.push(`A quantidade de "${produto.nome_produto}" foi ajustada para ${qtde} (estoque disponível).`);
            }
            if (Number(produto.preco_produto) !== item.preco) {
                avisos.push(`O preço de "${produto.nome_produto}" foi atualizado.`);
            }
            atualizados.push({
                codproduto: produto.id_produto,
                qtde,
                preco: Number(produto.preco_produto),
                produto: produto.nome_produto,
                imagem: produto.imagem_produto
            });
        }
        sessao.carrinho = atualizados;
        const total = Math.round(atualizados.reduce((soma, i) => soma + i.preco * i.qtde, 0) * 100) / 100;
        return { itens: atualizados, total, avisos };
    }
};

module.exports = { carrinho, LIMITE_POR_ITEM };
