import type { EventBus } from '../eventBus';

/** Contrato que todo microfrontend recebe ao ser montado pelo shell. */
export interface PropsRemoto {
  basePath: string;
  getToken: () => Promise<string | null>;
  eventBus: EventBus;
}
