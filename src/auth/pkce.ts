/**
 * PKCE (RFC 7636): o navegador prova ao Keycloak que quem troca o `code` por token é o mesmo que iniciou o login,
 * sem precisar de segredo (o shell é um client público: qualquer segredo no JavaScript seria visível a todos).
 * 1) gera um `verificador` aleatório e guarda; 2) manda ao Keycloak só o `desafio` (SHA-256 do verificador);
 * 3) na troca do code, manda o verificador: o Keycloak confere que o hash bate. Quem roubar o code no meio do
 * caminho não tem o verificador e não consegue o token.
 */

/** Base64 "seguro para URL" (sem +, / ou =), como PKCE e JWT exigem. */
export function base64Url(bytes: Uint8Array): string {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** 64 bytes aleatórios viram 86 caracteres: dentro dos 43 a 128 que a RFC permite. */
export const gerarVerificador = () => aleatorio(64);

/** `state` amarra a volta do Keycloak ao login que nós iniciamos (barra CSRF no callback). */
export const gerarState = () => aleatorio(32);

/** code_challenge do método S256: base64url(SHA-256(verificador)). */
export async function desafioS256(verificador: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64Url(new Uint8Array(hash));
}
