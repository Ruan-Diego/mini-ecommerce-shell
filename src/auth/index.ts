import { useSyncExternalStore } from 'react';
import { criarConfig } from './config';
import { ClienteOidc, type EstadoAuth } from './oidc';

/** O que o resto do shell usa do cliente OIDC. Os testes trocam o cliente real por um que cumpra isto. */
export type ClienteAuth = Pick<
  ClienteOidc,
  'estadoAtual' | 'ouvir' | 'getToken' | 'iniciarLogin' | 'sair' | 'ehCallback' | 'tratarCallback'
>;

function criarClienteReal(): ClienteAuth {
  return new ClienteOidc({
    config: criarConfig(),
    fetch: (...args) => fetch(...args),
    armazenamento: sessionStorage,
    navegar: (url) => window.location.assign(url),
    origem: window.location.origin,
    agora: () => Date.now(),
    agendar: (acao, ms) => {
      const id = setTimeout(acao, ms);
      return () => clearTimeout(id);
    },
  });
}

// Criado sob demanda: importar este módulo (por exemplo nos testes) não toca em window nem em sessionStorage.
let cliente: ClienteAuth | null = null;

export function obterCliente(): ClienteAuth {
  return (cliente ??= criarClienteReal());
}

/** Só para testes: troca o singleton. */
export function definirCliente(novo: ClienteAuth | null) {
  cliente = novo;
}

/** Estado de login para o React: re-renderiza quando o cliente OIDC avisa que mudou. */
export function useAuth(): EstadoAuth {
  const c = obterCliente();
  return useSyncExternalStore(c.ouvir, c.estadoAtual);
}
