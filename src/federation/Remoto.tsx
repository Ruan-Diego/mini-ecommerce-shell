import { useState } from 'react';
import { RemoteBoundary } from './RemoteBoundary';
import { carregarApp } from './remotos';
import type { NomeRemoto } from './manifesto';
import type { PropsRemoto } from '@ruan-diego/mini-event-contracts';

interface Props {
  nome: NomeRemoto;
  props: PropsRemoto;
  /** Parte montada em toda página: se falhar, some sem aviso (ver RemoteBoundary). */
  silencioso?: boolean;
}

/**
 * Monta o ./App de um microfrontend isolado num RemoteBoundary.
 *
 * O React.lazy guarda a promessa rejeitada: se o remoto estava fora do ar, remontar o mesmo
 * componente lazy re-lança o mesmo erro para sempre. Por isso cada "Tentar de novo" cria um
 * componente lazy novo (nova chamada ao loadRemote) e uma key nova para zerar o boundary.
 */
export function Remoto({ nome, props, silencioso }: Props) {
  const [tentativa, setTentativa] = useState(0);
  const [App, setApp] = useState(() => carregarApp(nome));

  function tentarDeNovo() {
    setApp(() => carregarApp(nome));
    setTentativa((t) => t + 1);
  }

  return (
    <RemoteBoundary key={tentativa} nome={`mfe-${nome}`} onTentarDeNovo={tentarDeNovo} silencioso={silencioso}>
      <App {...props} />
    </RemoteBoundary>
  );
}
