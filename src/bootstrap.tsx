import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { iniciarRemotos } from './federation/remotos';
import './styles/tokens.css';
import './styles/global.css';

// Registra os remotos lidos de /remotes.json antes de montar. iniciarRemotos nunca rejeita:
// sem manifesto ou sem remotos no ar, o shell sobe só com o layout.
await iniciarRemotos();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
