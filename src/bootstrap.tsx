import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { obterCliente } from './auth';
import { iniciarRemotos } from './federation/remotos';
import '@ruan-diego/mini-design-system/tokens.css';
import './styles/global.css';

/**
 * Se o Keycloak acabou de devolver o navegador para /auth/callback, termina o login (troca o code por tokens)
 * antes de montar a interface, e troca a URL pela rota de retorno (sem o code na barra nem no histórico).
 */
async function concluirLoginSeForCallback(): Promise<string | null> {
  const cliente = obterCliente();
  const url = new URL(window.location.href);
  if (!cliente.ehCallback(url)) return null;
  const resultado = await cliente.tratarCallback(url);
  const destino = resultado.tipo === 'ok' ? resultado.retorno : '/';
  window.history.replaceState(null, '', destino);
  return resultado.tipo === 'erro' ? resultado.mensagem : null;
}

const erroDeLogin = await concluirLoginSeForCallback();

// Registra os remotos lidos de /remotes.json antes de montar. iniciarRemotos nunca rejeita:
// sem manifesto ou sem remotos no ar, o shell sobe só com o layout.
await iniciarRemotos();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {erroDeLogin && (
        <p className="wrap" role="alert">
          Não foi possível entrar: {erroDeLogin}
        </p>
      )}
      <App />
    </BrowserRouter>
  </StrictMode>,
);
