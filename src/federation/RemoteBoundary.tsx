import { Component, Suspense, type ReactNode } from 'react';

interface Props {
  nome: string;
  children: ReactNode;
  /** Chamado em "Tentar de novo". Sem ele, o boundary só zera o próprio estado. */
  onTentarDeNovo?: () => void;
  /**
   * Para partes que ficam montadas em toda página (ex.: o drawer do carrinho): se falharem, não mostram
   * aviso nem esqueleto de carregamento, só registram o erro no console. O aviso fica para a rota do MFE.
   */
  silencioso?: boolean;
}

interface State {
  erro: boolean;
}

/** Isola cada microfrontend: se o remoto falhar ao carregar ou quebrar, só a área dele mostra o aviso. */
export class RemoteBoundary extends Component<Props, State> {
  state: State = { erro: false };

  static getDerivedStateFromError(): State {
    return { erro: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[shell] microfrontend ${this.props.nome} falhou`, error);
  }

  render() {
    if (this.state.erro) {
      if (this.props.silencioso) return null;
      return (
        <section className="remoto-indisponivel" role="alert">
          <p className="eyebrow">{this.props.nome}</p>
          <h2>Esta parte da loja está indisponível</h2>
          <p className="muted">O resto da página continua funcionando. Tente de novo em instantes.</p>
          <button className="btn btn-sec" type="button" onClick={() => (this.props.onTentarDeNovo ? this.props.onTentarDeNovo() : this.setState({ erro: false }))}>
            Tentar de novo
          </button>
        </section>
      );
    }
    const carregando = this.props.silencioso ? null : <div className="skeleton" aria-busy="true" aria-label="Carregando" />;
    return <Suspense fallback={carregando}>{this.props.children}</Suspense>;
  }
}
