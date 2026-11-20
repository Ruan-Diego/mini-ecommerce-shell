import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { obterCliente, useAuth } from './index';

interface Props {
  /** Se informado, além de logado o usuário precisa ter este papel (ex.: 'admin'). */
  papel?: string;
  children: ReactNode;
}

/**
 * Esconde uma rota de quem não pode usá-la. Sem login, leva ao Keycloak e volta para esta mesma rota.
 * Isto é só experiência de uso: quem protege os dados de verdade são o gateway e os serviços (JWT).
 */
export function RotaProtegida({ papel, children }: Props) {
  const { autenticado, usuario } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!autenticado) void obterCliente().iniciarLogin(pathname + search);
  }, [autenticado, pathname, search]);

  if (!autenticado) return <p className="wrap muted" role="status">Redirecionando para o login…</p>;
  if (papel && !usuario?.papeis.includes(papel)) {
    return (
      <p className="wrap" role="alert">
        Acesso negado. Esta área é restrita.
      </p>
    );
  }
  return <>{children}</>;
}
