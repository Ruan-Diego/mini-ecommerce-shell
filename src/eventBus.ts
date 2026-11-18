import { criarEventBus } from '@ruan-diego/mini-event-contracts';

/** Bus único do shell, sobre window: é o mesmo objeto que todos os MFEs recebem em PropsRemoto. */
export const eventBus = criarEventBus();
