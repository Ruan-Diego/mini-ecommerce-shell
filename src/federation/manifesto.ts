/**
 * Manifesto dos remotos: de onde vem o remoteEntry.js de cada microfrontend.
 *
 * O shell lê /remotes.json em runtime (não no build). Assim, para apontar o shell para outra
 * versão de um MFE basta trocar o arquivo publicado, sem rebuild.
 * Em dev, o plugin do vite.config.ts monta esse JSON a partir das variáveis VITE_REMOTE_<NOME>.
 *
 * Este arquivo não importa nada do Module Federation: é usado também pelo vite.config.ts.
 */
export const NOMES_REMOTOS = ['catalogo', 'carrinho', 'checkout', 'conta', 'admin'] as const;

export type NomeRemoto = (typeof NOMES_REMOTOS)[number];

export type Manifesto = Partial<Record<NomeRemoto, string>>;

const PORTAS_PADRAO: Record<NomeRemoto, number> = {
  catalogo: 5174,
  carrinho: 5175,
  checkout: 5176,
  conta: 5177,
  admin: 5178,
};

/** Monta o manifesto a partir de VITE_REMOTE_<NOME>, com o servidor local de cada MFE como padrão. */
export function manifestoDoAmbiente(env: Record<string, string | undefined>): Manifesto {
  return Object.fromEntries(
    NOMES_REMOTOS.map((nome) => [
      nome,
      env[`VITE_REMOTE_${nome.toUpperCase()}`] || `http://localhost:${PORTAS_PADRAO[nome]}/remoteEntry.js`,
    ]),
  );
}

/** Aceita só nomes conhecidos com URL http(s); ignora o resto em vez de quebrar o shell. */
export function validarManifesto(dado: unknown): Manifesto {
  if (typeof dado !== 'object' || dado === null) return {};
  const manifesto: Manifesto = {};
  for (const nome of NOMES_REMOTOS) {
    const url = (dado as Record<string, unknown>)[nome];
    if (typeof url === 'string' && /^https?:\/\//.test(url)) manifesto[nome] = url;
  }
  return manifesto;
}
