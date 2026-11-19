import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { Remoto } from './federation/Remoto';
import type { PropsRemoto } from '@ruan-diego/mini-event-contracts';
import { eventBus } from './eventBus';

// Autenticação OIDC entra na Fase 3 (issue "Login OIDC com Keycloak").
const getToken = async () => null;
const props = (basePath: string): PropsRemoto => ({ basePath, getToken, eventBus });

export function App() {
  const navigate = useNavigate();
  const [quantidade, setQuantidade] = useState(0);

  useEffect(() => eventBus.on('carrinho:atualizado', (p) => setQuantidade(p.quantidadeTotal)), []);
  useEffect(() => eventBus.on('carrinho:limpo', () => setQuantidade(0)), []);
  // Um MFE não conhece as rotas dos outros: pede ao shell para navegar.
  useEffect(() => eventBus.on('navegar', ({ rota }) => navigate(rota)), [navigate]);

  return (
    <div className="app">
      <Header quantidadeCarrinho={quantidade} onAbrirCarrinho={() => eventBus.emit('carrinho:abrir', {})} />
      <p className="sr" aria-live="polite">
        {quantidade > 0 ? `Carrinho com ${quantidade} ${quantidade === 1 ? 'item' : 'itens'}` : ''}
      </p>
      <main>
        {/* key por MFE: sem ela o React reaproveitaria o mesmo <Remoto> ao trocar de rota. */}
        <Routes>
          <Route path="/carrinho/*" element={<Remoto key="carrinho" nome="carrinho" props={props('/carrinho')} />} />
          <Route path="/checkout/*" element={<Remoto key="checkout" nome="checkout" props={props('/checkout')} />} />
          <Route path="/conta/*" element={<Remoto key="conta" nome="conta" props={props('/conta')} />} />
          <Route path="/admin/*" element={<Remoto key="admin" nome="admin" props={props('/admin')} />} />
          {/* O catálogo é dono de /, /produtos e /produtos/:slug, e o MFE tem as próprias rotas relativas
              ao basePath '/'. Por isso a rota do shell é "*" (que não consome nenhum prefixo): com
              "/produtos/*" o shell consumiria "/produtos" e o MFE veria o caminho vazio (a Home). */}
          <Route path="*" element={<RotaDoCatalogo />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

const ehDoCatalogo = (pathname: string) => pathname === '/' || pathname === '/produtos' || pathname.startsWith('/produtos/');

/** Monta o catálogo só nas rotas dele; qualquer outra rota desconhecida é 404 do shell. */
function RotaDoCatalogo() {
  const { pathname } = useLocation();
  if (!ehDoCatalogo(pathname)) return <p className="wrap muted">Página não encontrada.</p>;
  return <Remoto key="catalogo" nome="catalogo" props={props('/')} />;
}
