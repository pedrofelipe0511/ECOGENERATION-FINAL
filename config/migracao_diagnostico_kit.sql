-- ============================================================
-- Migração: diagnóstico com "kit recomendado"
-- Adiciona à tabela produtos as informações que o diagnóstico usa
-- para montar um kit e dizer, em linguagem simples, o que ele cobre.
-- O usuário final nunca vê estes números; só o admin cadastra.
--
-- tipo_energia:
--   'bateria'     -> guarda energia e tem tomada (estações, geradores):
--                    alimenta celular, luz, ventilador, Wi-Fi e notebook
--   'bateria_usb' -> guarda energia, só saídas USB (power banks, kits pequenos):
--                    alimenta celular e luz USB
--   'luz'         -> lâmpada/luminária com bateria própria
--   'ventilador'  -> ventilador com bateria própria
--   'painel'      -> só gera energia (não guarda); recarrega baterias
--   NULL          -> não entra no cálculo do kit
--
-- capacidade_energia:
--   baterias              -> capacidade em Wh (watt-hora, vem na caixa)
--   luz / ventilador      -> horas de autonomia
--   painel / NULL         -> não usado
-- ============================================================

ALTER TABLE produtos
  ADD COLUMN tipo_energia       VARCHAR(20)  DEFAULT NULL AFTER rota_produto,
  ADD COLUMN capacidade_energia DECIMAL(7,1) DEFAULT NULL AFTER tipo_energia;

-- Valores ESTIMADOS a partir do tipo e da descrição de cada produto ativo.
-- Conferir com as especificações reais e ajustar pelo painel do admin.
UPDATE produtos SET tipo_energia = 'bateria_usb', capacidade_energia = 37   WHERE id_produto = 4;   -- Powerbank Solar
UPDATE produtos SET tipo_energia = 'bateria_usb', capacidade_energia = 40   WHERE id_produto = 5;   -- Kit Energia Solar Portatil
UPDATE produtos SET tipo_energia = 'bateria_usb', capacidade_energia = 30   WHERE id_produto = 10;  -- Carregador USB Solar
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 150  WHERE id_produto = 14;  -- Estacao de Energia Solar Media
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 250  WHERE id_produto = 15;  -- Kit Energia Solar Medio
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 288  WHERE id_produto = 16;  -- Estacao de Energia Portatil 300W
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 245  WHERE id_produto = 21;  -- Ecoflow River 3 + Placa 60W
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 268  WHERE id_produto = 17;  -- Bluetti EB3A + Painel SP120L
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 512  WHERE id_produto = 22;  -- Estacao de Energia Solar Avancada
UPDATE produtos SET tipo_energia = 'bateria',     capacidade_energia = 1000 WHERE id_produto = 20;  -- Gerador Solar 600-1200W
UPDATE produtos SET tipo_energia = 'luz',         capacidade_energia = 6    WHERE id_produto = 8;   -- Lampada Solar
UPDATE produtos SET tipo_energia = 'luz',         capacidade_energia = 8    WHERE id_produto = 6;   -- Luminaria Solar Refletora
UPDATE produtos SET tipo_energia = 'luz',         capacidade_energia = 10   WHERE id_produto = 11;  -- Luminaria Solar Media
UPDATE produtos SET tipo_energia = 'ventilador',  capacidade_energia = 3    WHERE id_produto = 7;   -- Mini Ventilador USB
UPDATE produtos SET tipo_energia = 'ventilador',  capacidade_energia = 4    WHERE id_produto = 2;   -- Ventilador Solar
UPDATE produtos SET tipo_energia = 'ventilador',  capacidade_energia = 6    WHERE id_produto = 13;  -- Ventilador Solar Medio
UPDATE produtos SET tipo_energia = 'painel'                                 WHERE id_produto IN (3, 12, 9, 23, 19); -- painéis e kit on-grid

-- ============================================================
-- PARA DESFAZER (volta a tabela exatamente como era):
-- ALTER TABLE produtos DROP COLUMN capacidade_energia, DROP COLUMN tipo_energia;
-- ============================================================
