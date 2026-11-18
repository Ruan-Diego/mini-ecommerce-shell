import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { RemoteBoundary } from './federation/RemoteBoundary';
import type { PropsRemoto } from './federation/props';
import { eventBus } from './eventBus';
import { carregarApp } from './federation/remotos';

const Catalogo = carregarApp('catalogo');
const Carrinho = carregarApp('carrinho');
const Checkout = carregarApp('checkout');
const Conta = carregarApp('conta');
const Admin = carregarApp('admin');

// Autenticação OIDC entra na Fase 3 (issue "Login OIDC com Keycloak").
const getToken = async () => null;
const props = (basePath: string): PropsRemoto => ({ basePath, getToken, eventBus });

export function App() {
  const [quantidade, setQuantidade] = useState(0);

  useEffect(() => eventBus.on('carrinho:atualizado', (p) => setQuantidade(p.quantidadeTotal)), []);
  useEffect(() => eventBus.on('carrinho:limpo', () => setQuantidade(0)), []);

  return (
    <div className="app">
      <Header quantidadeCarrinho={quantidade} onAbrirCarrinho={() => eventBus.emit('carrinho:abrir', {})} />
      <main>
        <Routes>
          <Route path="/carrinho/*" element={<RemoteBoundary nome="mfe-carrinho"><Carrinho {...props('/carrinho')} /></RemoteBoundary>} />
          <Route path="/checkout/*" element={<RemoteBoundary nome="mfe-checkout"><Checkout {...props('/checkout')} /></RemoteBoundary>} />
          <Route path="/conta/*" element={<RemoteBoundary nome="mfe-conta"><Conta {...props('/conta')} /></RemoteBoundary>} />
          <Route path="/admin/*" element={<RemoteBoundary nome="mfe-admin"><Admin {...props('/admin')} /></RemoteBoundary>} />
          <Route path="/*" element={<RemoteBoundary nome="mfe-catalogo"><Catalogo {...props('/')} /></RemoteBoundary>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
