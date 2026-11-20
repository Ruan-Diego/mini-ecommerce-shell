import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@ruan-diego/mini-design-system';

interface Props {
  /** Nome de quem está logado, para dizer com qual conta a pessoa entrou. */
  nome?: string;
  /** Sai da conta atual, para entrar com uma que tenha o papel. */
  onTrocarConta: () => void;
}

/**
 * Página 403 do shell: aparece no lugar do MFE quando a pessoa está logada mas não tem o papel da rota
 * (hoje, admin). O MFE nem é carregado. Isto é experiência de uso; quem protege os dados é o gateway, que
 * responde 403 às rotas /api/*\/admin/** para quem não é admin.
 */
export function AcessoNegado({ nome, onTrocarConta }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null);

  // Leva o foco ao título, para o leitor de tela anunciar a página nova (a navegação não recarrega a página).
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <section className="acesso-negado" aria-labelledby="acesso-negado-titulo">
      <p className="acesso-negado-codigo" aria-hidden="true">403</p>
      <h1 id="acesso-negado-titulo" ref={titulo} tabIndex={-1}>
        Acesso negado
      </h1>
      <p>
        Esta área é só para administradores.
        {nome ? ` Você entrou como ${nome}, e essa conta não tem esse acesso.` : ''}
      </p>
      <div className="acesso-negado-acoes">
        <Link className="btn btn-pri" to="/">
          Voltar para a loja
        </Link>
        <Button variante="secundario" onClick={onTrocarConta}>
          Entrar com outra conta
        </Button>
      </div>
    </section>
  );
}
