/** Onde está o Keycloak e qual client o shell usa. Os padrões servem para o docker-compose local. */
export interface ConfigAuth {
  /** Endereço do Keycloak, sem barra no fim. */
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

export function criarConfig(env: Record<string, string | undefined> = import.meta.env): ConfigAuth {
  return {
    keycloakUrl: (env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180').replace(/\/+$/, ''),
    realm: env.VITE_KEYCLOAK_REALM ?? 'mini',
    clientId: env.VITE_KEYCLOAK_CLIENT_ID ?? 'shell',
  };
}

const base = (c: ConfigAuth) => `${c.keycloakUrl}/realms/${c.realm}/protocol/openid-connect`;

/** Endereços padrão do OpenID Connect no Keycloak (iguais em todo realm, por isso não há consulta de discovery). */
export const enderecoDeLogin = (c: ConfigAuth) => `${base(c)}/auth`;
export const enderecoDoToken = (c: ConfigAuth) => `${base(c)}/token`;
export const enderecoDeLogout = (c: ConfigAuth) => `${base(c)}/logout`;
