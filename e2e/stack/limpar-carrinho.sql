-- Começa cada rodada do E2E com o carrinho do cliente de teste vazio (sobras de rodadas que falharam no meio).
DELETE FROM item_carrinho;
DELETE FROM carrinho;
