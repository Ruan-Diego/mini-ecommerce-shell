import { Component, Suspense, type ReactNode } from 'react';

interface Props {
  nome: string;
  children: ReactNode;
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
      return (
        <section className="remoto-indisponivel" role="alert">
          <p className="eyebrow">{this.props.nome}</p>
          <h2>Esta parte da loja está indisponível</h2>
          <p className="muted">O resto da página continua funcionando. Tente de novo em instantes.</p>
          <button className="btn btn-sec" type="button" onClick={() => this.setState({ erro: false })}>
            Tentar de novo
          </button>
        </section>
      );
    }
    return <Suspense fallback={<div className="skeleton" aria-busy="true" aria-label="Carregando" />}>{this.props.children}</Suspense>;
  }
}
