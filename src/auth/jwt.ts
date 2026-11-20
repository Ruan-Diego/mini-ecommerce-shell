/** Dados do usuário lidos do access token, só para a interface (nome, papéis). Quem valida o token é o backend. */
export interface Usuario {
  sub: string;
  nome?: string;
  email?: string;
  papeis: string[];
}

interface PayloadJwt {
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  exp?: number;
  realm_access?: { roles?: string[] };
}

/**
 * Lê o payload de um JWT SEM verificar a assinatura. Serve só para mostrar o nome e esconder o que o usuário não
 * pode usar; a segurança de verdade está no gateway e nos serviços, que validam a assinatura a cada requisição.
 */
export function decodificarPayload(token: string): PayloadJwt {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('JWT malformado');
  const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PayloadJwt;
}

export function usuarioDoToken(token: string): Usuario {
  const payload = decodificarPayload(token);
  if (!payload.sub) throw new Error('JWT sem sub');
  return {
    sub: payload.sub,
    nome: payload.name ?? payload.preferred_username,
    email: payload.email,
    papeis: payload.realm_access?.roles ?? [],
  };
}
