import { manifestoDoAmbiente, validarManifesto } from './manifesto';

describe('manifestoDoAmbiente', () => {
  it('usa VITE_REMOTE_<NOME> e cai no servidor local de cada MFE quando falta', () => {
    const manifesto = manifestoDoAmbiente({ VITE_REMOTE_CATALOGO: 'https://cdn.exemplo.dev/catalogo/1.4.0/remoteEntry.js' });
    expect(manifesto).toEqual({
      catalogo: 'https://cdn.exemplo.dev/catalogo/1.4.0/remoteEntry.js',
      carrinho: 'http://localhost:5175/remoteEntry.js',
      checkout: 'http://localhost:5176/remoteEntry.js',
      conta: 'http://localhost:5177/remoteEntry.js',
      admin: 'http://localhost:5178/remoteEntry.js',
    });
  });
});

describe('validarManifesto', () => {
  it('mantém só nomes conhecidos com URL http(s)', () => {
    expect(
      validarManifesto({
        catalogo: 'http://localhost:5174/remoteEntry.js',
        carrinho: 'javascript:alert(1)',
        checkout: 42,
        desconhecido: 'http://localhost:9999/remoteEntry.js',
      }),
    ).toEqual({ catalogo: 'http://localhost:5174/remoteEntry.js' });
  });

  it.each([null, 'texto', 3, []])('devolve vazio para %j', (dado) => {
    expect(validarManifesto(dado)).toEqual({});
  });
});
