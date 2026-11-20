import { ClienteOidc, type Dependencias } from './oidc';
import { criarConfig } from './config';
import { base64Url, desafioS256 } from './pkce';

/** JWT de mentira (sem assinatura): o cliente só lê o payload para a interface. */
function jwtDe(payload: object): string {
  const parte = (o: object) => base64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${parte({ alg: 'none' })}.${parte(payload)}.assinatura`;
}

const ACESSO = jwtDe({ sub: 'u-1', name: 'Ana Souza', email: 'ana@mini.dev', realm_access: { roles: ['cliente'] } });
const ACESSO_NOVO = jwtDe({ sub: 'u-1', name: 'Ana Souza', realm_access: { roles: ['cliente', 'admin'] } });

function respostaDeToken(access = ACESSO, extras: object = {}) {
  return new Response(
    JSON.stringify({ access_token: access, refresh_token: 'refresh-1', id_token: 'id-1', expires_in: 300, ...extras }),
    { status: 200 },
  );
}

function montar() {
  const armazenado = new Map<string, string>();
  const agendados: { acao: () => void; ms: number; cancelado: boolean }[] = [];
  const fetchFalso = vi.fn<typeof fetch>();
  let agora = 1_000_000;
  const deps: Dependencias = {
    config: criarConfig({}),
    fetch: fetchFalso,
    armazenamento: {
      getItem: (k) => armazenado.get(k) ?? null,
      setItem: (k, v) => void armazenado.set(k, v),
      removeItem: (k) => void armazenado.delete(k),
    },
    navegar: vi.fn(),
    origem: 'http://localhost:5173',
    agora: () => agora,
    agendar: (acao, ms) => {
      const item = { acao, ms, cancelado: false };
      agendados.push(item);
      return () => void (item.cancelado = true);
    },
  };
  return { cliente: new ClienteOidc(deps), deps, armazenado, agendados, fetchFalso, avancar: (ms: number) => void (agora += ms) };
}

/** Faz o login até a volta do Keycloak e devolve o que o teste precisa para continuar. */
async function logar(m: ReturnType<typeof montar>) {
  await m.cliente.iniciarLogin('/checkout/endereco');
  const enviado = new URL(vi.mocked(m.deps.navegar).mock.calls[0][0]);
  m.fetchFalso.mockResolvedValueOnce(respostaDeToken());
  const url = new URL(`http://localhost:5173/auth/callback?code=codigo-1&state=${enviado.searchParams.get('state')}`);
  return { enviado, resultado: await m.cliente.tratarCallback(url) };
}

describe('ClienteOidc: login (authorization code com PKCE)', () => {
  it('manda o navegador ao Keycloak com PKCE S256, state e o redirect_uri do shell', async () => {
    const m = montar();

    await m.cliente.iniciarLogin('/checkout/endereco');

    const url = new URL(vi.mocked(m.deps.navegar).mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('http://localhost:8180/realms/mini/protocol/openid-connect/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'shell',
      redirect_uri: 'http://localhost:5173/auth/callback',
      scope: 'openid',
      code_challenge_method: 'S256',
    });
    // O desafio enviado é o SHA-256 do verificador que ficou guardado para a volta.
    const { verificador } = JSON.parse(m.armazenado.get('mini.auth.pendente')!);
    expect(url.searchParams.get('code_challenge')).toBe(await desafioS256(verificador));
    expect(url.searchParams.get('code_challenge')).not.toBe(verificador);
    expect(verificador.length).toBeGreaterThanOrEqual(43);
  });

  it('na volta, confere o state, troca o code pelo token mandando o verificador e guarda só em memória', async () => {
    const m = montar();

    const { resultado } = await logar(m);

    expect(resultado).toEqual({ tipo: 'ok', retorno: '/checkout/endereco' });
    const [endereco, opcoes] = m.fetchFalso.mock.calls[0];
    expect(endereco).toBe('http://localhost:8180/realms/mini/protocol/openid-connect/token');
    const corpo = new URLSearchParams(String(opcoes!.body));
    expect(Object.fromEntries(corpo)).toMatchObject({
      grant_type: 'authorization_code',
      client_id: 'shell',
      code: 'codigo-1',
      redirect_uri: 'http://localhost:5173/auth/callback',
    });
    expect(corpo.get('code_verifier')!.length).toBeGreaterThanOrEqual(43);
    expect(m.cliente.estadoAtual()).toEqual({
      autenticado: true,
      usuario: { sub: 'u-1', nome: 'Ana Souza', email: 'ana@mini.dev', papeis: ['cliente'] },
    });
    expect(await m.cliente.getToken()).toBe(ACESSO);
    // Nada de token no armazenamento, e o login pendente foi descartado (vale uma vez só).
    expect([...m.armazenado.values()].join('')).not.toContain(ACESSO);
    expect(m.armazenado.size).toBe(0);
  });

  it('recusa um state diferente e não chama o Keycloak', async () => {
    const m = montar();
    await m.cliente.iniciarLogin('/conta');

    const resultado = await m.cliente.tratarCallback(new URL('http://localhost:5173/auth/callback?code=x&state=falso'));

    expect(resultado.tipo).toBe('erro');
    expect(m.fetchFalso).not.toHaveBeenCalled();
    expect(m.cliente.estadoAtual().autenticado).toBe(false);
  });

  it('recusa uma volta sem login pendente (callback repetido ou aberto à mão)', async () => {
    const m = montar();

    const resultado = await m.cliente.tratarCallback(new URL('http://localhost:5173/auth/callback?code=x&state=y'));

    expect(resultado.tipo).toBe('erro');
    expect(m.fetchFalso).not.toHaveBeenCalled();
  });

  it('não aceita o mesmo callback duas vezes', async () => {
    const m = montar();
    const { enviado } = await logar(m);
    const url = new URL(`http://localhost:5173/auth/callback?code=codigo-1&state=${enviado.searchParams.get('state')}`);

    expect((await m.cliente.tratarCallback(url)).tipo).toBe('erro');
  });

  it('mostra o erro devolvido pelo Keycloak (ex.: login cancelado)', async () => {
    const m = montar();
    await m.cliente.iniciarLogin('/conta');

    const resultado = await m.cliente.tratarCallback(
      new URL('http://localhost:5173/auth/callback?error=access_denied&error_description=Login%20cancelado'),
    );

    expect(resultado).toEqual({ tipo: 'erro', mensagem: 'Login cancelado' });
  });

  it('vira erro quando o Keycloak recusa a troca do code', async () => {
    const m = montar();
    await m.cliente.iniciarLogin('/conta');
    const state = JSON.parse(m.armazenado.get('mini.auth.pendente')!).state;
    m.fetchFalso.mockResolvedValueOnce(new Response('{}', { status: 400 }));

    const resultado = await m.cliente.tratarCallback(new URL(`http://localhost:5173/auth/callback?code=x&state=${state}`));

    expect(resultado.tipo).toBe('erro');
    expect(m.cliente.estadoAtual().autenticado).toBe(false);
  });

  it('só reconhece /auth/callback como volta do login', () => {
    const { cliente } = montar();
    expect(cliente.ehCallback(new URL('http://localhost:5173/auth/callback?code=1'))).toBe(true);
    expect(cliente.ehCallback(new URL('http://localhost:5173/checkout'))).toBe(false);
  });
});

describe('ClienteOidc: token e renovação silenciosa', () => {
  it('sem sessão, getToken devolve null', async () => {
    expect(await montar().cliente.getToken()).toBeNull();
  });

  it('agenda a renovação 60 segundos antes de o token expirar', async () => {
    const m = montar();

    await logar(m);

    expect(m.agendados).toHaveLength(1);
    expect(m.agendados[0].ms).toBe(300_000 - 60_000);
  });

  it('renova com o refresh token quando falta menos de 30 segundos e devolve o token novo', async () => {
    const m = montar();
    await logar(m);
    m.avancar(280_000);
    m.fetchFalso.mockResolvedValueOnce(respostaDeToken(ACESSO_NOVO));

    expect(await m.cliente.getToken()).toBe(ACESSO_NOVO);

    const corpo = new URLSearchParams(String(m.fetchFalso.mock.calls[1][1]!.body));
    expect(Object.fromEntries(corpo)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: 'shell' });
    expect(m.cliente.estadoAtual().usuario?.papeis).toEqual(['cliente', 'admin']);
    // Reagendou a próxima renovação e cancelou a anterior.
    expect(m.agendados).toHaveLength(2);
    expect(m.agendados[0].cancelado).toBe(true);
  });

  it('não renova enquanto o token tem folga', async () => {
    const m = montar();
    await logar(m);
    m.avancar(100_000);

    expect(await m.cliente.getToken()).toBe(ACESSO);
    expect(m.fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('duas chamadas ao mesmo tempo compartilham uma renovação só', async () => {
    const m = montar();
    await logar(m);
    m.avancar(290_000);
    m.fetchFalso.mockResolvedValueOnce(respostaDeToken(ACESSO_NOVO));

    const [a, b] = await Promise.all([m.cliente.getToken(), m.cliente.getToken()]);

    expect([a, b]).toEqual([ACESSO_NOVO, ACESSO_NOVO]);
    expect(m.fetchFalso).toHaveBeenCalledTimes(2); // 1 do login + 1 da renovação
  });

  it('se o Keycloak recusa a renovação, a sessão acaba e a interface é avisada', async () => {
    const m = montar();
    await logar(m);
    const ouvinte = vi.fn();
    m.cliente.ouvir(ouvinte);
    m.avancar(290_000);
    m.fetchFalso.mockResolvedValueOnce(new Response('{}', { status: 400 }));

    expect(await m.cliente.getToken()).toBeNull();

    expect(m.cliente.estadoAtual()).toEqual({ autenticado: false, usuario: null });
    expect(ouvinte).toHaveBeenCalled();
    expect(m.agendados.every((a) => a.cancelado)).toBe(true);
  });

  it('a renovação agendada roda sozinha', async () => {
    const m = montar();
    await logar(m);
    m.fetchFalso.mockResolvedValueOnce(respostaDeToken(ACESSO_NOVO));

    m.agendados[0].acao();
    await vi.waitFor(() => expect(m.cliente.estadoAtual().usuario?.papeis).toContain('admin'));
  });
});

describe('ClienteOidc: estado observável e logout', () => {
  it('avisa os ouvintes ao entrar e para de avisar depois de cancelar a inscrição', async () => {
    const m = montar();
    const ouvinte = vi.fn();
    const cancelar = m.cliente.ouvir(ouvinte);
    const antes = m.cliente.estadoAtual();

    await logar(m);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(m.cliente.estadoAtual()).not.toBe(antes); // objeto novo a cada mudança

    cancelar();
    m.cliente.sair();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('sair apaga a sessão e encerra a sessão do Keycloak com o id_token_hint', async () => {
    const m = montar();
    await logar(m);

    m.cliente.sair();

    expect(await m.cliente.getToken()).toBeNull();
    expect(m.cliente.estadoAtual().autenticado).toBe(false);
    const url = new URL(vi.mocked(m.deps.navegar).mock.calls[1][0]);
    expect(url.origin + url.pathname).toBe('http://localhost:8180/realms/mini/protocol/openid-connect/logout');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'shell',
      post_logout_redirect_uri: 'http://localhost:5173/',
      id_token_hint: 'id-1',
    });
  });
});
