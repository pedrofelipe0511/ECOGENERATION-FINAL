-- ============================================================
-- Migração: pedidos + itens do pedido (integração com Mercado Pago)
-- Modelo do material (PSW3_015): um PEDIDO com data, total, status do
-- pedido e dados do pagamento, e os ITENS ligados a ele.
--
-- status_pedido:    aguardando_pagamento | pago | enviado | entregue | cancelado
-- status_pagamento: status devolvido pela API do Mercado Pago
--                   (pending, approved, in_process, rejected, cancelled...)
--                   ou 'nao_aplicavel' para compras anteriores à integração
-- ============================================================

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido        INT           NOT NULL AUTO_INCREMENT,
  id_usuario       INT           NOT NULL,
  data_pedido      DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
  total_pedido     DECIMAL(10,2) NOT NULL,
  status_pedido    VARCHAR(30)   NOT NULL DEFAULT 'aguardando_pagamento',
  status_pagamento VARCHAR(30)   NOT NULL DEFAULT 'pendente',
  id_pagamento     VARCHAR(40)   DEFAULT NULL,
  id_preferencia   VARCHAR(80)   DEFAULT NULL,
  PRIMARY KEY (id_pedido),
  KEY idx_pedidos_usuario (id_usuario),
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS itens_pedido (
  id_item          INT           NOT NULL AUTO_INCREMENT,
  id_pedido        INT           NOT NULL,
  id_produto       INT           NOT NULL,
  nome_produto     VARCHAR(100)  NOT NULL,
  imagem_produto   VARCHAR(100)  DEFAULT 'favicon2.png',
  preco_unitario   DECIMAL(10,2) NOT NULL,
  quantidade       INT           NOT NULL DEFAULT 1,
  PRIMARY KEY (id_item),
  KEY idx_itens_pedido (id_pedido),
  CONSTRAINT fk_itens_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos (id_pedido) ON DELETE CASCADE,
  CONSTRAINT fk_itens_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Compras antigas viram pedidos com o MESMO número (compra #12 -> pedido #12).
-- Compras de usuários que não existem mais ficam de fora.
INSERT INTO pedidos (id_pedido, id_usuario, data_pedido, total_pedido, status_pedido, status_pagamento)
SELECT c.id_compra, c.id_usuario, NULL, c.preco_produto,
       CASE WHEN c.status_compra IN ('enviado', 'entregue', 'cancelado') THEN c.status_compra ELSE 'pago' END,
       'nao_aplicavel'
FROM compras c
JOIN usuarios u ON u.id_usuario = c.id_usuario;

INSERT INTO itens_pedido (id_pedido, id_produto, nome_produto, imagem_produto, preco_unitario, quantidade)
SELECT c.id_compra, c.id_produto, c.nome_produto, c.imagem_produto, c.preco_produto, 1
FROM compras c
JOIN pedidos p ON p.id_pedido = c.id_compra;

-- ============================================================
-- PARA DESFAZER (a tabela compras não é alterada por esta migração):
-- DROP TABLE itens_pedido;
-- DROP TABLE pedidos;
-- ============================================================
