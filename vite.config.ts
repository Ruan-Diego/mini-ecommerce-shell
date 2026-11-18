import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { manifestoDoAmbiente } from './src/federation/manifesto';

/**
 * Publica /remotes.json, que o shell lê em runtime para saber de onde carregar cada MFE.
 * - dev: gerado a cada requisição a partir de VITE_REMOTE_<NOME> (editar o .env vale no próximo F5);
 * - build: vira dist/remotes.json com os valores do momento do build. Para trocar a versão de um
 *   MFE em produção, edite esse arquivo publicado; não é preciso rebuild.
 */
function manifestoDeRemotos(): Plugin {
  let modo = 'development';
  const ler = () => JSON.stringify(manifestoDoAmbiente(loadEnv(modo, process.cwd(), 'VITE_REMOTE_')), null, 2);
  return {
    name: 'mini:manifesto-de-remotos',
    configResolved(config) {
      modo = config.mode;
    },
    configureServer(server) {
      server.middlewares.use('/remotes.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(ler());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'remotes.json', source: ler() });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    manifestoDeRemotos(),
    // Sem remotos estáticos: eles são registrados em runtime (src/federation/remotos.ts).
    federation({
      name: 'shell',
      remotes: {},
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: { target: 'chrome89' },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
