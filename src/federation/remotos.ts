import { lazy, type ComponentType } from 'react';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { validarManifesto, type Manifesto, type NomeRemoto } from './manifesto';
import type { PropsRemoto } from '@ruan-diego/mini-event-contracts';

const nomeFederation = (nome: NomeRemoto) => `mfe_${nome}`;

/** Busca o manifesto publicado junto com o shell. Falha de rede ou JSON inválido vira manifesto vazio. */
export async function buscarManifesto(url = '/remotes.json'): Promise<Manifesto> {
  try {
    const resposta = await fetch(url, { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return validarManifesto(await resposta.json());
  } catch (erro) {
    console.error('[shell] não consegui ler o manifesto de remotos; os microfrontends ficam indisponíveis', erro);
    return {};
  }
}

/** Registra cada remoto do manifesto no runtime do Module Federation. */
export function registrarRemotos(manifesto: Manifesto): void {
  const remotos = Object.entries(manifesto).map(([nome, entry]) => {
    const name = nomeFederation(nome as NomeRemoto);
    return { name, entry, type: 'module', entryGlobalName: name, shareScope: 'default' };
  });
  if (remotos.length > 0) registerRemotes(remotos, { force: true });
}

/** Busca e registra os remotos. Nunca rejeita: sem remotos o shell sobe só com o layout. */
export async function iniciarRemotos(): Promise<void> {
  registrarRemotos(await buscarManifesto());
}

/**
 * Componente lazy do ./App de um remoto. Se o remoto não estiver registrado ou fora do ar,
 * o erro sobe para o RemoteBoundary, que mostra o aviso só naquela área.
 */
export function carregarApp(nome: NomeRemoto) {
  return lazy(async () => {
    const modulo = await loadRemote<{ default: ComponentType<PropsRemoto> }>(`${nomeFederation(nome)}/App`);
    if (!modulo?.default) throw new Error(`remoto ${nomeFederation(nome)} não expôs ./App`);
    return modulo;
  });
}
