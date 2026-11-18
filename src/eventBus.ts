// Event bus entre microfrontends sobre CustomEvent no window.
// Os tipos definitivos vêm do pacote @ruan-diego/mini-event-contracts (Fase 0, repositório ui).

export type EventosMini = {
  'carrinho:adicionar-item': { produtoId: string; quantidade: number };
  'carrinho:atualizado': { quantidadeTotal: number; subtotal: number };
  'carrinho:limpo': Record<string, never>;
  'carrinho:abrir': Record<string, never>;
  'auth:alterado': { autenticado: boolean; nome?: string; papeis: string[] };
  navegar: { rota: string };
};

export type NomeEvento = keyof EventosMini;

export interface EventBus {
  emit<E extends NomeEvento>(evento: E, payload: EventosMini[E]): void;
  on<E extends NomeEvento>(evento: E, ouvinte: (payload: EventosMini[E]) => void): () => void;
}

export function criarEventBus(alvo: EventTarget = window): EventBus {
  return {
    emit(evento, payload) {
      alvo.dispatchEvent(new CustomEvent(evento, { detail: payload }));
    },
    on(evento, ouvinte) {
      const handler = (e: Event) => ouvinte((e as CustomEvent).detail);
      alvo.addEventListener(evento, handler);
      return () => alvo.removeEventListener(evento, handler);
    },
  };
}

export const eventBus = criarEventBus();
