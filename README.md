# mini-ecommerce-shell

Host dos microfrontends do **Mini E-commerce**: layout global, rotas, autenticação e event bus. Carrega cada MFE em runtime com Module Federation.

React 19 · TypeScript · Vite · `@module-federation/vite` · React Router 7

## Rotas

| Rota | Microfrontend | Porta em dev |
| --- | --- | --- |
| `/`, `/produtos`, `/produtos/:slug` | [mfe-catalogo](https://github.com/Ruan-Diego/mini-ecommerce-mfe-catalogo) | 5174 |
| `/carrinho` | [mfe-carrinho](https://github.com/Ruan-Diego/mini-ecommerce-mfe-carrinho) | 5175 |
| `/checkout/*` | [mfe-checkout](https://github.com/Ruan-Diego/mini-ecommerce-mfe-checkout) | 5176 |
| `/conta/*` | [mfe-conta](https://github.com/Ruan-Diego/mini-ecommerce-mfe-conta) | 5177 |
| `/admin/*` | [mfe-admin](https://github.com/Ruan-Diego/mini-ecommerce-mfe-admin) | 5178 |

A URL de cada remoto vem de `VITE_REMOTE_<NOME>` (veja `.env.example`), então dá para apontar para outra versão de um MFE sem mexer no código do shell.

## Contrato com os microfrontends

- Cada MFE expõe `./App`, que recebe `{ basePath, getToken, eventBus }`.
- Os MFEs só se falam por eventos (`src/eventBus.ts`, depois `@ruan-diego/mini-event-contracts`).
- Cada remoto roda dentro de um `RemoteBoundary`: se ele falhar, só a área dele mostra "Esta parte da loja está indisponível".

## Rodando

```bash
cp .env.example .env
pnpm install
pnpm dev                       # http://localhost:5173
```

Em cada MFE que quiser ver integrado: `pnpm build && pnpm preview`.

```bash
pnpm test
pnpm build
```
