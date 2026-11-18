import { render, screen } from '@testing-library/react';
import { RemoteBoundary } from './RemoteBoundary';

function Quebra(): never {
  throw new Error('remoto fora do ar');
}

describe('RemoteBoundary', () => {
  it('mostra o aviso quando o microfrontend falha, sem derrubar a página', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <p>header</p>
        <RemoteBoundary nome="mfe-catalogo">
          <Quebra />
        </RemoteBoundary>
      </div>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Esta parte da loja está indisponível');
    expect(screen.getByText('header')).toBeTruthy();
  });
});
