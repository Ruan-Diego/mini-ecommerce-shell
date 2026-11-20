-- Dados de teste do E2E, aplicados no schema `catalogo`. Idempotente (INSERT IGNORE com ids fixos).
-- Por que SQL e não a API: ainda não existe endpoint para criar categoria, e /admin/** exige token de admin.
INSERT IGNORE INTO categoria (id, nome, slug, pai_id)
VALUES ('00000000-0000-4000-8000-0000000000c1', 'Esferas', 'esferas', NULL);

INSERT IGNORE INTO produto (id, sku, nome, slug, descricao, preco, categoria_id, ativo)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'E2E-001', 'Esfera E2E', 'esfera-e2e',
        'Produto fixo usado nos testes de ponta a ponta.', 100.00, '00000000-0000-4000-8000-0000000000c1', TRUE);

-- A imagem precisa ser uma URL http(s) absoluta (regra do domínio). O arquivo não precisa existir: o teste só
-- procura o produto pelo nome. REPLACE INTO para a seed continuar idempotente se a URL mudar.
REPLACE INTO imagem_produto (produto_id, posicao, url, texto_alternativo)
VALUES ('00000000-0000-4000-8000-0000000000a1', 0, 'http://localhost:5173/e2e-esfera.svg', 'Esfera E2E');
