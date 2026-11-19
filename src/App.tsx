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
      <DrawerDoCarrinho />
    </div>
  );
}

/**
 * Mini-carrinho (drawer), montado em toda página, fora do <main>: ele precisa estar ouvindo
 * `carrinho:adicionar-item` e `carrinho:abrir` mesmo quando o cliente está no catálogo.
 *
 * O mfe-carrinho expõe um só ./App, com as rotas relativas ao basePath: `index` é a página do carrinho e
 * `mini` é o drawer. Esta instância é a do drawer: `<Routes location>` faz o MFE enxergar `/carrinho/mini`
 * (e não a URL real do navegador), então ela só renderiza o drawer, enquanto a rota `/carrinho/*` do
 * <main> monta outra instância, que mostra a página. Cada tela existe em uma instância só, e nenhum
 * evento é tratado em dobro.
 *
 * `silencioso`: se o mfe-carrinho estiver fora do ar, o drawer some sem aviso nem esqueleto em todas as
 * páginas; o aviso aparece só na rota /carrinho. O badge continua funcionando (ele é do shell).
 */
function DrawerDoCarrinho() {
  return (
    <Routes location="/carrinho/mini">
      <Route path="/carrinho/*" element={<Remoto key="mini-carrinho" nome="carrinho" props={props('/carrinho')} silencioso />} />
    </Routes>
  );
}

const ehDoCatalogo = (pathname: string) => pathname === '/' || pathname === '/produtos' || pathname.startsWith('/produtos/');

/** Monta o catálogo só nas rotas dele; qualquer outra rota desconhecida é 404 do shell. */
function RotaDoCatalogo() {
  const { pathname } = useLocation();
  if (!ehDoCatalogo(pathname)) return <p className="wrap muted">Página não encontrada.</p>;
  return <Remoto key="catalogo" nome="catalogo" props={props('/')} />;
}
