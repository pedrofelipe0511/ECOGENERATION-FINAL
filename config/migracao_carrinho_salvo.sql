-- ============================================================
-- Migração: carrinho salvo na conta do cliente
-- O carrinho continua na sessão (material PSW3), mas quem está logado
-- também tem uma cópia no banco: assim ele não se perde ao sair da conta,
-- ao trocar de aparelho ou quando o servidor reinicia.
-- Os itens saem daqui quando o pagamento é aprovado.
-- ============================================================

CREATE TABLE IF NOT EXISTS carrinho_itens (
  id_usuario     INT       NOT NULL,
  id_produto     INT       NOT NULL,
  quantidade     INT       NOT NULL DEFAULT 1,
  atualizado_em  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_produto),
  CONSTRAINT fk_carrinho_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_carrinho_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PARA DESFAZER:
-- DROP TABLE carrinho_itens;
-- ============================================================
