import { expect, test, type Page } from '@playwright/test';

/**
 * Compra de ponta a ponta contra a stack real: catálogo → carrinho → login no Keycloak → endereço → frete →
 * pagamento → confirmação. O produto "Esfera E2E" (R$ 100,00) vem do seed (e2e/stack/seed.sql).
 *
 * Cartões do gateway fake: o último dígito PAR aprova e o ÍMPAR recusa. Os dois abaixo passam no Luhn.
 */
const CLIENTE = { usuario: 'cliente@mini.dev', senha: 'cliente' }; // usuário de teste do realm local
const CARTAO_APROVADO = '5555 5555 5555 4444';
const CARTAO_RECUSADO = '4111 1111 1111 1111';

async function adicionarEIrParaOCheckout(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adicionar Esfera E2E ao carrinho' }).first().click();
  // O drawer do mini-carrinho abre sozinho ao adicionar.
  await page.getByRole('button', { name: 'Finalizar compra' }).click();
}

async function entrarNoKeycloak(page: Page) {
  await expect(page).toHaveURL(/localhost:8180\/realms\/mini/);
  await page.locator('#username').fill(CLIENTE.usuario);
  await page.locator('#password').fill(CLIENTE.senha);
  await page.locator('#kc-login').click();
}

async function preencherEndereco(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Endereço de entrega' })).toBeVisible();
  await page.getByLabel('Destinatário').fill('Ana Souza');
  await page.getByLabel('CEP').fill('01310100');
  await page.getByLabel('Rua').fill('Avenida Paulista');
  await page.getByLabel('Número').fill('1000');
  await page.getByLabel('Bairro').fill('Bela Vista');
  await page.getByLabel('Cidade').fill('São Paulo');
  await page.getByLabel('UF').fill('SP');
  await page.getByRole('button', { name: 'Continuar' }).click();
}

/** Da home até a tela de pagamento, com a compra de 1 unidade (R$ 100,00 + frete padrão de R$ 19,90). */
async function irAtePagamento(page: Page) {
  await adicionarEIrParaOCheckout(page);
  await entrarNoKeycloak(page); // sem login, o shell leva ao Keycloak e volta para /checkout/endereco
  await expect(page).toHaveURL(/\/checkout\/endereco$/);
  await preencherEndereco(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Escolha do frete' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Padrão/ })).toBeChecked(); // a mais barata vem marcada
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pagar R\$\s*119,90/ })).toBeVisible();
}

async function preencherCartao(page: Page, numero: string) {
  await page.getByLabel('Número do cartão').fill(numero);
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade (MM/AA)').fill('12/39');
  await page.getByLabel('CVV').fill('123');
}

const badge = (page: Page, quantidade: number) => page.getByRole('button', { name: `Carrinho, ${quantidade} itens` });

test('compra com cartão aprovado termina em Pedido confirmado e zera o carrinho', async ({ page }) => {
  await irAtePagamento(page);
  await preencherCartao(page, CARTAO_APROVADO);
  await page.getByRole('button', { name: /Pagar/ }).click();

  await expect(page).toHaveURL(/\/checkout\/confirmado\/.+/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pedido confirmado' })).toBeVisible();
  await expect(page.getByText(/Obrigado pela compra/)).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Resumo do pedido' })).toContainText('1× Esfera E2E');
  await expect(page.getByRole('complementary', { name: 'Resumo do pedido' })).toContainText('119,90');
  await expect(page.getByText('Cartão · aprovado')).toBeVisible();
  await expect(badge(page, 0)).toBeVisible(); // carrinho:limpo
});

test('cartão recusado mostra o motivo e mantém o formulário; trocar de cartão conclui a compra', async ({ page }) => {
  await irAtePagamento(page);
  await preencherCartao(page, CARTAO_RECUSADO);
  await page.getByRole('button', { name: /Pagar/ }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Pagamento recusado' })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout\/pagamento$/);
  await expect(page.getByLabel('Nome impresso no cartão')).toHaveValue('ANA SOUZA'); // formulário mantido

  await page.getByLabel('Número do cartão').fill(CARTAO_APROVADO);
  await page.getByRole('button', { name: /Pagar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pedido confirmado' })).toBeVisible();
});

test('Pix: gera o código, simula o pagamento e chega em Pedido confirmado', async ({ page }) => {
  await irAtePagamento(page);
  await page.getByRole('tab', { name: 'Pix' }).click();
  await page.getByRole('button', { name: /Pagar/ }).click();

  await expect(page).toHaveURL(/\/checkout\/pix\/.+/);
  await expect(page.getByRole('heading', { level: 1, name: 'Aguardando pagamento via Pix' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code do Pix' })).toBeVisible();
  await expect(page.getByLabel('Pix copia e cola')).not.toBeEmpty();
  await expect(page.getByRole('timer')).toContainText(/^(29|30):\d{2}$/);

  await page.getByRole('button', { name: 'Simular pagamento' }).click(); // webhook do gateway fake
  await expect(page).toHaveURL(/\/checkout\/confirmado\/.+/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Pedido confirmado' })).toBeVisible();
  await expect(page.getByText('Pix · aprovado')).toBeVisible();
});
