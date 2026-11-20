import { enderecoDeLogin, enderecoDeLogout, enderecoDoToken, type ConfigAuth } from './config';
import { usuarioDoToken, type Usuario } from './jwt';
import { desafioS256, gerarState, gerarVerificador } from './pkce';

/** O que a interface precisa saber. É sempre um objeto novo a cada mudança (requisito do useSyncExternalStore). */
export interface EstadoAuth {
  autenticado: boolean;
  usuario: Usuario | null;
}

export type ResultadoDoCallback = { tipo: 'ok'; retorno: string } | { tipo: 'erro'; mensagem: string };

/** Tudo o que o cliente pede ao navegador, injetável para os testes não precisarem de rede nem de Keycloak. */
export interface Dependencias {
  config: ConfigAuth;
  fetch: typeof fetch;
  /** Guarda só o login em andamento (verificador PKCE, state, rota de retorno). Nunca o token. */
  armazenamento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Leva o navegador para outra página (window.location.assign). */
  navegar: (url: string) => void;
  /** window.location.origin: o redirect_uri é `${origem}/auth/callback`. */
  origem: string;
  agora: () => number;
  /** setTimeout que devolve a função que cancela. */
  agendar: (acao: () => void, ms: number) => () => void;
}

interface Tokens {
  acesso: string;
  renovacao?: string;
  id?: string;
  expiraEm: number;
}

interface LoginPendente {
  verificador: string;
  state: string;
  retorno: string;
}

const CHAVE_PENDENTE = 'mini.auth.pendente';
export const CAMINHO_DO_CALLBACK = '/auth/callback';
/** Renova o token se faltar menos que isto para expirar. */
const MARGEM_MS = 30_000;
/** A renovação silenciosa é agendada para este tempo antes de o token expirar. */
const ANTECEDENCIA_DA_RENOVACAO_MS = 60_000;
const ESPERA_MINIMA_MS = 5_000;

const SEM_SESSAO: EstadoAuth = { autenticado: false, usuario: null };

/**
 * Cliente OpenID Connect do shell: authorization code com PKCE contra o Keycloak.
 *
 * O token de acesso e o de renovação ficam SÓ em memória (variável privada), nunca em localStorage nem em
 * sessionStorage: um script injetado numa página não consegue lê-los de lá. O preço é que recarregar a página
 * (F5) apaga a sessão local; o cliente volta a entrar por uma rota protegida ou pelo botão Entrar, e o
 * Keycloak, que guarda a própria sessão em cookie, devolve o usuário sem pedir a senha de novo.
 */
export class ClienteOidc {
  private tokens: Tokens | null = null;
  private estado: EstadoAuth = SEM_SESSAO;
  private readonly ouvintes = new Set<() => void>();
  private cancelarRenovacao: (() => void) | null = null;
  private renovacaoEmCurso: Promise<void> | null = null;
  /** Depois de sair() o navegador já está indo ao logout do Keycloak: nenhum login novo pode atravessar. */
  private saindo = false;

  constructor(private readonly deps: Dependencias) {}

  // ---- estado observável (para o React) ----

  estadoAtual = (): EstadoAuth => this.estado;

  ouvir = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  };

  private definirEstado(novo: EstadoAuth) {
    this.estado = novo;
    this.ouvintes.forEach((ouvinte) => ouvinte());
  }

  // ---- login ----

  private get redirectUri() {
    return `${this.deps.origem}${CAMINHO_DO_CALLBACK}`;
  }

  /** Leva o navegador ao Keycloak. `retorno` é a rota do shell para onde voltar depois do login. */
  async iniciarLogin(retorno: string): Promise<void> {
    if (this.saindo) return;
    const verificador = gerarVerificador();
    const state = gerarState();
    const pendente: LoginPendente = { verificador, state, retorno };
    this.deps.armazenamento.setItem(CHAVE_PENDENTE, JSON.stringify(pendente));

    const parametros = new URLSearchParams({
      response_type: 'code',
      client_id: this.deps.config.clientId,
      redirect_uri: this.redirectUri,
      scope: 'openid',
      state,
      code_challenge: await desafioS256(verificador),
      code_challenge_method: 'S256',
    });
    this.deps.navegar(`${enderecoDeLogin(this.deps.config)}?${parametros}`);
  }

  ehCallback(url: URL): boolean {
    return url.pathname === CAMINHO_DO_CALLBACK;
  }

  /**
   * Termina o login quando o Keycloak devolve o navegador para /auth/callback: confere o `state`, troca o
   * `code` por tokens (mandando o verificador PKCE) e guarda tudo em memória. Devolve a rota de retorno.
   * Qualquer problema vira `erro` (nunca lança) e o login pendente é descartado: cada tentativa vale uma vez.
   */
  async tratarCallback(url: URL): Promise<ResultadoDoCallback> {
    const pendente = this.lerPendente();
    this.deps.armazenamento.removeItem(CHAVE_PENDENTE);

    const erro = url.searchParams.get('error');
    if (erro) return { tipo: 'erro', mensagem: url.searchParams.get('error_description') ?? erro };
    const code = url.searchParams.get('code');
    if (!pendente || !code || url.searchParams.get('state') !== pendente.state) {
      return { tipo: 'erro', mensagem: 'Resposta de login inválida ou expirada. Tente entrar de novo.' };
    }
    try {
      await this.pedirTokens({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        code_verifier: pendente.verificador,
      });
      return { tipo: 'ok', retorno: pendente.retorno };
    } catch (e) {
      return { tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Não foi possível concluir o login.' };
    }
  }

  private lerPendente(): LoginPendente | null {
    try {
      const texto = this.deps.armazenamento.getItem(CHAVE_PENDENTE);
      return texto ? (JSON.parse(texto) as LoginPendente) : null;
    } catch {
      return null;
    }
  }

  // ---- token ----

  /** Chamado pelos microfrontends (via PropsRemoto.getToken). Renova antes de devolver se estiver perto de expirar. */
  getToken = async (): Promise<string | null> => {
    if (!this.tokens) return null;
    if (this.tokens.expiraEm - this.deps.agora() < MARGEM_MS) {
      await this.renovar();
    }
    return this.tokens?.acesso ?? null;
  };

  /** Troca o refresh token por tokens novos. Chamadas simultâneas esperam a mesma renovação. */
  renovar(): Promise<void> {
    this.renovacaoEmCurso ??= this.renovarAgora().finally(() => {
      this.renovacaoEmCurso = null;
    });
    return this.renovacaoEmCurso;
  }

  private async renovarAgora(): Promise<void> {
    const renovacao = this.tokens?.renovacao;
    if (!renovacao) {
      this.limparSessao();
      return;
    }
    try {
      await this.pedirTokens({ grant_type: 'refresh_token', refresh_token: renovacao });
    } catch {
      // Refresh token recusado ou expirado: a sessão acabou. A interface volta a mostrar "Entrar".
      this.limparSessao();
    }
  }

  private async pedirTokens(corpo: Record<string, string>): Promise<void> {
    const resposta = await this.deps.fetch(enderecoDoToken(this.deps.config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.deps.config.clientId, ...corpo }),
    });
    if (!resposta.ok) throw new Error(`o Keycloak recusou o pedido de token (HTTP ${resposta.status})`);
    const json = (await resposta.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
    };
    const usuario = usuarioDoToken(json.access_token);
    this.tokens = {
      acesso: json.access_token,
      renovacao: json.refresh_token,
      id: json.id_token ?? this.tokens?.id,
      expiraEm: this.deps.agora() + json.expires_in * 1000,
    };
    this.agendarRenovacao(json.expires_in * 1000);
    this.definirEstado({ autenticado: true, usuario });
  }

  /** Renovação silenciosa: pede token novo um pouco antes de o atual expirar, sem o cliente perceber. */
  private agendarRenovacao(validadeMs: number) {
    this.cancelarRenovacao?.();
    const espera = Math.max(validadeMs - ANTECEDENCIA_DA_RENOVACAO_MS, ESPERA_MINIMA_MS);
    this.cancelarRenovacao = this.deps.agendar(() => void this.renovar(), espera);
  }

  private limparSessao() {
    this.cancelarRenovacao?.();
    this.cancelarRenovacao = null;
    this.tokens = null;
    if (this.estado.autenticado) this.definirEstado(SEM_SESSAO);
  }

  // ---- logout ----

  /** Apaga a sessão local e encerra a sessão do Keycloak (que também limpa o cookie dele). */
  sair(): void {
    this.saindo = true;
    const idToken = this.tokens?.id;
    this.limparSessao();
    const parametros = new URLSearchParams({
      client_id: this.deps.config.clientId,
      post_logout_redirect_uri: `${this.deps.origem}/`,
    });
    if (idToken) parametros.set('id_token_hint', idToken);
    this.deps.navegar(`${enderecoDeLogout(this.deps.config)}?${parametros}`);
  }
}
