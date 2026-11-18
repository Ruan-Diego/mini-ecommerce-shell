import { render, screen } from '@testing-library/react';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { buscarManifesto, carregarApp, iniciarRemotos, registrarRemotos } from './remotos';
import { RemoteBoundary } from './RemoteBoundary';
import { criarEventBus } from '../eventBus';

vi.mock('@module-federation/runtime', () => ({ loadRemote: vi.fn(), registerRemotes: vi.fn() }));

const props = { basePath: '/', getToken: async () => null, eventBus: criarEventBus(new EventTarget()) };

beforeEach(() => {
  vi.mocked(loadRemote).mockReset();
  vi.mocked(registerRemotes).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.unstubAllGlobals());

describe('registrarRemotos', () => {
  it('registra cada remoto do manifesto como módulo ESM', () => {
    registrarRemotos({ catalogo: 'http://localhost:5174/remoteEntry.js' });
    expect(registerRemotes).toHaveBeenCalledWith(
      [
        {
          name: 'mfe_catalogo',
          entry: 'http://localhost:5174/remoteEntry.js',
          type: 'module',
          entryGlobalName: 'mfe_catalogo',
          shareScope: 'default',
        },
      ],
      { force: true },
    );
  });

  it('não chama o runtime com manifesto vazio', () => {
    registrarRemotos({});
    expect(registerRemotes).not.toHaveBeenCalled();
  });
});

describe('buscarManifesto e iniciarRemotos', () => {
  it('lê /remotes.json e registra o que veio', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ conta: 'http://localhost:5177/remoteEntry.js' })));
    vi.stubGlobal('fetch', fetchFalso);
    await iniciarRemotos();
    expect(fetchFalso).toHaveBeenCalledWith('/remotes.json', { cache: 'no-store' });
    expect(vi.mocked(registerRemotes).mock.calls[0][0]).toMatchObject([{ name: 'mfe_conta' }]);
  });

  it('com o manifesto fora do ar, devolve vazio sem rejeitar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(buscarManifesto()).resolves.toEqual({});
  });

  it('com HTTP 404, devolve vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('não achei', { status: 404 })));
    await expect(buscarManifesto()).resolves.toEqual({});
  });
});

describe('carregarApp', () => {
  it('monta o ./App do remoto com as props do shell', async () => {
    vi.mocked(loadRemote).mockResolvedValue({ default: ({ basePath }: { basePath: string }) => <p>catálogo em {basePath}</p> });
    const Catalogo = carregarApp('catalogo');
    render(
      <RemoteBoundary nome="mfe-catalogo">
        <Catalogo {...props} />
      </RemoteBoundary>,
    );
    expect(await screen.findByText('catálogo em /')).toBeInTheDocument();
    expect(loadRemote).toHaveBeenCalledWith('mfe_catalogo/App');
  });

  it('remoto não registrado ou fora do ar cai no aviso do RemoteBoundary', async () => {
    vi.mocked(loadRemote).mockResolvedValue(null);
    const Carrinho = carregarApp('carrinho');
    render(
      <RemoteBoundary nome="mfe-carrinho">
        <Carrinho {...props} />
      </RemoteBoundary>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta parte da loja está indisponível');
  });
});
