import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { EstadoAuth } from '../auth/oidc';

interface Props {
  quantidadeCarrinho: number;
  onAbrirCarrinho: () => void;
  auth: EstadoAuth;
  onEntrar: () => void;
  onSair: () => void;
}

const categorias = ['Esferas', 'Anéis', 'Cápsulas', 'Blocos'];

export function Header({ quantidadeCarrinho, onAbrirCarrinho, auth, onEntrar, onSair }: Props) {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  function buscar(e: FormEvent) {
    e.preventDefault();
    navigate(`/produtos?busca=${encodeURIComponent(busca)}`);
  }

  return (
    <header className="wrap hdr">
      <Link className="logo" to="/">
        mini<span className="ac">.</span>
      </Link>
      <nav className="nav" aria-label="Categorias">
        {categorias.map((c) => (
          <Link key={c} to={`/produtos?categoria=${encodeURIComponent(c.toLowerCase())}`}>
            {c}
          </Link>
        ))}
      </nav>
      <form className="search" role="search" onSubmit={buscar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <label className="sr" htmlFor="busca">Buscar</label>
        <input id="busca" placeholder="Buscar objetos" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </form>
      {auth.autenticado ? (
        <>
          <Link className="iconbtn" to="/conta" aria-label="Minha conta">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </Link>
          {auth.usuario?.nome && <span className="muted" data-testid="nome-usuario">{auth.usuario.nome}</span>}
          <button className="btn-texto" type="button" onClick={onSair}>Sair</button>
        </>
      ) : (
        <button className="btn-texto" type="button" onClick={onEntrar}>Entrar</button>
      )}
      <button className="iconbtn" type="button" onClick={onAbrirCarrinho} aria-label={`Carrinho, ${quantidadeCarrinho} itens`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 8h14l-1 12H6z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
        {quantidadeCarrinho > 0 && <span className="badge">{quantidadeCarrinho}</span>}
      </button>
    </header>
  );
}
