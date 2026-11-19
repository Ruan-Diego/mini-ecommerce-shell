import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import type { PropsRemoto } from '@ruan-diego/mini-event-contracts';
import { loadRemote } from '@module-federation/runtime';
import { App } from './App';
import { eventBus } from './eventBus';

vi.mock('@module-federation/runtime', () => ({ loadRemote: vi.fn(), registerRemotes: vi.fn() }));

/** Cada remoto "no ar" vira um componente que mostra o próprio nome e o basePath recebido. */
function remotosNoAr(...noAr: string[]) {
  vi.mocked(loadRemote).mockImplementation(async (id: string) => {
    const nome = id.replace(/^mfe_/, '').replace(/\/App$/, '');
    if (!noAr.includes(nome)) throw new Error(`${id} fora do ar`);
    return { default: ({ basePath }: { basePath: string }) => <p>mfe {nome} em {basePath}</p> };
  });
}

function renderizar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(loadRemote).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('App', () => {
  // Critério de pronto do shell #1 e #2: derrubar um remoto não derruba o resto da página.
  it('sem nenhum remoto, mostra header, footer e o aviso só na área do microfrontend', async () => {
    remotosNoAr();
    renderizar('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta parte da loja está indisponível');
    expect(loadRemote).toHaveBeenCalledWith('mfe_catalogo/App');
  });

  it('monta o MFE da rota com o basePath certo', async () => {
    remotosNoAr('conta');
    renderizar('/conta/pedidos');
    expect(await screen.findByText('mfe conta em /conta')).toBeInTheDocument();
  });

  it('troca de MFE ao navegar entre rotas', async () => {
    remotosNoAr('catalogo', 'conta');
    renderizar('/');
    expect(await screen.findByText('mfe catalogo em /')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Minha conta' }));
    expect(await screen.findByText('mfe conta em /conta')).toBeInTheDocument();
    expect(screen.queryByText('mfe catalogo em /')).not.toBeInTheDocument();
  });

  it('o evento navegar leva para a rota de outro MFE', async () => {
    remotosNoAr('catalogo', 'carrinho');
    renderizar('/');
    await screen.findByText('mfe catalogo em /');
    act(() => eventBus.emit('navegar', { rota: '/carrinho' }));
    // Duas instâncias do carrinho: a página (rota /carrinho) e o drawer (sempre montado).
    await waitFor(() => expect(screen.getAllByText('mfe carrinho em /carrinho')).toHaveLength(2));
  });

  it('"Tentar de novo" carrega o remoto de novo quando ele volta', async () => {
    remotosNoAr();
    renderizar('/');
    await screen.findByRole('alert');
    remotosNoAr('catalogo');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('mfe catalogo em /')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Shell #3: as três telas do catálogo abrem dentro do shell.
  it.each(['/', '/produtos', '/produtos/esfera-aurora'])('a rota %s abre o mfe-catalogo', async (rota) => {
    remotosNoAr('catalogo');
    renderizar(rota);
    expect(await screen.findByText('mfe catalogo em /')).toBeInTheDocument();
  });

  it('a busca do header leva para /produtos?busca=', async () => {
    remotosNoAr('catalogo');
    let local = '';
    function Local() {
      const l = useLocation();
      local = l.pathname + l.search;
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
        <Local />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'esfera azul{Enter}');
    expect(local).toBe('/produtos?busca=esfera%20azul');
    expect(await screen.findByText('mfe catalogo em /')).toBeInTheDocument();
  });

  // Regressão: o remoto tem <Routes> próprias, relativas ao basePath. Um remoto simulado sem roteamento
  // não percebe se o shell consome o prefixo da URL (foi o que escondeu o bug de /produtos mostrar a Home).
  it.each([
    ['/', 'home'],
    ['/produtos', 'listagem'],
    ['/produtos/esfera-aurora', 'detalhe esfera-aurora'],
  ])('o roteamento interno do catálogo resolve %s para a tela %s', async (rota, tela) => {
    vi.mocked(loadRemote).mockImplementation(async () => ({
      default: function CatalogoComRotas() {
        return (
          <Routes>
            <Route index element={<p>tela home</p>} />
            <Route path="produtos" element={<p>tela listagem</p>} />
            <Route path="produtos/:slug" element={<Detalhe />} />
          </Routes>
        );
      },
    }));
    function Detalhe() {
      return <p>tela detalhe {useParams().slug}</p>;
    }
    renderizar(rota);
    expect(await screen.findByText(`tela ${tela}`)).toBeInTheDocument();
  });

  it('rota desconhecida não monta nenhum microfrontend de página (só o drawer do carrinho, que fica em toda página)', async () => {
    remotosNoAr('catalogo');
    renderizar('/qualquer-coisa');
    expect(await screen.findByText('Página não encontrada.')).toBeInTheDocument();
    expect(vi.mocked(loadRemote).mock.calls.map(([id]) => id)).toEqual(['mfe_carrinho/App']);
  });

  it('atualiza o badge e anuncia o carrinho com carrinho:atualizado e carrinho:limpo', async () => {
    remotosNoAr('catalogo');
    renderizar('/');
    await screen.findByText('mfe catalogo em /');
    act(() => eventBus.emit('carrinho:atualizado', { quantidadeTotal: 3, subtotal: 762 }));
    expect(screen.getByRole('button', { name: 'Carrinho, 3 itens' })).toHaveTextContent('3');
    expect(screen.getByText('Carrinho com 3 itens')).toBeInTheDocument();
    act(() => eventBus.emit('carrinho:limpo', {}));
    expect(screen.getByRole('button', { name: 'Carrinho, 0 itens' })).not.toHaveTextContent('0');
  });
});

// Shell #4: o mini-carrinho (drawer) fica montado em toda página; a página do carrinho é uma rota.
describe('Carrinho no shell', () => {
  /**
   * Carrinho simulado com as mesmas rotas do mfe-carrinho real: `index` é a página e `mini` é o drawer.
   * O catálogo simulado emite carrinho:adicionar-item pelo eventBus que recebe, como o real fará.
   */
  function carrinhoEMarketplace(opcoes: { carrinhoNoAr?: boolean } = {}) {
    const { carrinhoNoAr = true } = opcoes;
    vi.mocked(loadRemote).mockImplementation(async (id: string) => {
      if (id === 'mfe_catalogo/App') {
        return {
          default: ({ eventBus: bus }: PropsRemoto) => (
            <button type="button" onClick={() => bus.emit('carrinho:adicionar-item', { produtoId: 'p1', quantidade: 2 })}>
              comprar no catálogo
            </button>
          ),
        };
      }
      if (id === 'mfe_carrinho/App') {
        if (!carrinhoNoAr) throw new Error('carrinho fora do ar');
        return {
          default: ({ eventBus: bus }: PropsRemoto) => (
            <Routes>
              <Route index element={<p>página do carrinho</p>} />
              <Route path="mini" element={<Drawer bus={bus} />} />
            </Routes>
          ),
        };
      }
      throw new Error(`${id} fora do ar`);
    });
  }

  /** Só o drawer ouve o evento do catálogo e responde com o total, como o mini-carrinho real fará. */
  function Drawer({ bus }: { bus: PropsRemoto['eventBus'] }) {
    useEffect(
      () => bus.on('carrinho:adicionar-item', ({ quantidade }) => bus.emit('carrinho:atualizado', { quantidadeTotal: quantidade, subtotal: 100 * quantidade })),
      [bus],
    );
    return <p>drawer do carrinho</p>;
  }

  it('monta o drawer em qualquer página, sem mostrar a página do carrinho', async () => {
    carrinhoEMarketplace();
    renderizar('/');
    expect(await screen.findByText('drawer do carrinho')).toBeInTheDocument();
    expect(screen.queryByText('página do carrinho')).not.toBeInTheDocument();
  });

  it('em /carrinho mostra a página e o drawer, cada um uma vez', async () => {
    carrinhoEMarketplace();
    renderizar('/carrinho');
    expect(await screen.findByText('página do carrinho')).toBeInTheDocument();
    expect(await screen.findByText('drawer do carrinho')).toBeInTheDocument();
    expect(screen.getAllByText('página do carrinho')).toHaveLength(1);
    expect(screen.getAllByText('drawer do carrinho')).toHaveLength(1);
  });

  it('se o carrinho cair, o drawer some sem aviso e o resto da página continua', async () => {
    carrinhoEMarketplace({ carrinhoNoAr: false });
    renderizar('/');
    expect(await screen.findByRole('button', { name: 'comprar no catálogo' })).toBeInTheDocument();
    await waitFor(() => expect(loadRemote).toHaveBeenCalledWith('mfe_carrinho/App'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Carregando')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carrinho, 0 itens' })).toBeInTheDocument();
  });

  it('se o carrinho cair, a rota /carrinho mostra um único aviso (o do drawer é silencioso)', async () => {
    carrinhoEMarketplace({ carrinhoNoAr: false });
    renderizar('/carrinho');
    expect(await screen.findByRole('alert')).toHaveTextContent('mfe-carrinho');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('clicar no ícone do carrinho emite carrinho:abrir', async () => {
    carrinhoEMarketplace();
    const abriu = vi.fn();
    const sair = eventBus.on('carrinho:abrir', abriu);
    renderizar('/');
    await screen.findByText('drawer do carrinho');
    await userEvent.click(screen.getByRole('button', { name: 'Carrinho, 0 itens' }));
    expect(abriu).toHaveBeenCalledTimes(1);
    sair();
  });

  // Critério de pronto: adicionar no catálogo atualiza o badge, sem um MFE importar o outro.
  it('adicionar no catálogo atualiza o badge pelo event bus', async () => {
    carrinhoEMarketplace();
    renderizar('/');
    await screen.findByText('drawer do carrinho');
    await userEvent.click(await screen.findByRole('button', { name: 'comprar no catálogo' }));
    expect(await screen.findByRole('button', { name: 'Carrinho, 2 itens' })).toHaveTextContent('2');
    expect(screen.getByText('Carrinho com 2 itens')).toBeInTheDocument();
  });
});
