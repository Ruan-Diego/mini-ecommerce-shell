import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { loadRemote } from '@module-federation/runtime';
import { App } from './App';

// Critério de pronto do shell #1: sem nenhum remoto disponível, o shell sobe e mostra o layout.
vi.mock('@module-federation/runtime', () => ({
  loadRemote: vi.fn().mockRejectedValue(new Error('remoteEntry.js inacessível')),
  registerRemotes: vi.fn(),
}));

describe('App sem remotos', () => {
  it('mostra header, footer e o aviso só na área do microfrontend', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta parte da loja está indisponível');
    expect(loadRemote).toHaveBeenCalledWith('mfe_catalogo/App');
  });
});
