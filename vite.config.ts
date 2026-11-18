import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const remotos = ['catalogo', 'carrinho', 'checkout', 'conta', 'admin'] as const;
const portas: Record<(typeof remotos)[number], number> = { catalogo: 5174, carrinho: 5175, checkout: 5176, conta: 5177, admin: 5178 };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const remotes = Object.fromEntries(
    remotos.map((r) => {
      const nome = `mfe_${r}`;
      const entry = env[`VITE_REMOTE_${r.toUpperCase()}`] ?? `http://localhost:${portas[r]}/remoteEntry.js`;
      return [nome, { type: 'module', name: nome, entry, entryGlobalName: nome, shareScope: 'default' }];
    }),
  );

  return {
    plugins: [
      react(),
      federation({
        name: 'shell',
        remotes,
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
  };
});
