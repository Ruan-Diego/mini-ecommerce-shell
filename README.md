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

### De onde vem cada remoto (sem rebuild)

O shell não conhece os remotos no build. Ao iniciar, ele lê `/remotes.json` e registra cada MFE no runtime do Module Federation (`src/federation/remotos.ts`):

```json
{ "catalogo": "http://localhost:5174/remoteEntry.js", "carrinho": "http://localhost:5175/remoteEntry.js" }
```

- **`pnpm dev`:** o JSON é montado a cada requisição a partir de `VITE_REMOTE_<NOME>` no `.env` (veja `.env.example`). Basta editar o `.env` e dar F5.
- **`pnpm build`:** gera `dist/remotes.json` com os valores do momento. Para apontar o shell publicado para outra versão de um MFE, edite esse arquivo no servidor. Não precisa de rebuild.
- Se o manifesto ou um remoto estiver fora do ar, o shell sobe com header e footer, e só a área do MFE mostra o aviso.

`react`, `react-dom` e `react-router-dom` são `shared` singleton: shell e MFEs usam a mesma instância.

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
pnpm lint        # ESLint com typescript-eslint, react-hooks e jsx-a11y
pnpm typecheck
pnpm test
pnpm build
```
