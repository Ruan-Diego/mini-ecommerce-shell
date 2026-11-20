import type { ClienteAuth } from './index';
import type { EstadoAuth } from './oidc';

/** Cliente de auth para testes de interface: estado fixo (ou alterável com `mudar`) e chamadas espiáveis. */
export function criarClienteFalso(inicial: EstadoAuth = { autenticado: false, usuario: null }) {
  let estado = inicial;
  const ouvintes = new Set<() => void>();
  const cliente = {
    estadoAtual: () => estado,
    ouvir: (o: () => void) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    getToken: vi.fn(async () => (estado.autenticado ? 'token-falso' : null)),
    iniciarLogin: vi.fn<(retorno: string) => Promise<void>>(async () => {}),
    sair: vi.fn(),
    ehCallback: () => false,
    tratarCallback: vi.fn(),
    mudar(novo: EstadoAuth) {
      estado = novo;
      ouvintes.forEach((o) => o());
    },
  } satisfies ClienteAuth & { mudar: (e: EstadoAuth) => void };
  return cliente;
}

export const logado = (papeis: string[] = ['cliente'], nome = 'Cliente Teste'): EstadoAuth => ({
  autenticado: true,
  usuario: { sub: 'u1', nome, papeis },
});
