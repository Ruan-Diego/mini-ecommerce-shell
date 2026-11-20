// Sobe a stack inteira para o E2E: infra (Docker Compose), os 4 serviços e o gateway (jars), os dados de teste,
// e o shell com os 3 microfrontends da compra (build + preview). Serve igual para a máquina local e para o CI.
//
// Os 8 repositórios ficam lado a lado (MINI_ROOT, por padrão a pasta acima do shell). Variáveis úteis:
//   MINI_ROOT   pasta que contém os repositórios
//   JAVA_HOME_21 JDK 21 para os jars (senão usa o `java` do PATH)
//   GATEWAY_PORT porta do gateway (padrão 8080); útil quando a 8080 já está ocupada
// Os logs ficam em e2e/.stack/*.log e os pids em e2e/.stack/pids.json (o parar.mjs usa).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const shell = resolve(aqui, '..', '..');
const raiz = resolve(process.env.MINI_ROOT ?? join(shell, '..'));
const repo = (nome) => join(raiz, `mini-ecommerce-${nome}`);
const pasta = join(aqui, '..', '.stack');
mkdirSync(pasta, { recursive: true });

const windows = process.platform === 'win32';
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 8080);
const API = `http://localhost:${GATEWAY_PORT}/api`;
const pids = {};

function java() {
  const home = process.env.JAVA_HOME_21;
  return home ? join(home, 'bin', windows ? 'java.exe' : 'java') : 'java';
}

/** No Windows, .bat e os shims do corepack/pnpm só rodam por um shell (o comando pode vir entre aspas). */
const precisaDeShell = (comando) => /gradlew.bat"?$|^(pnpm|corepack)$/.test(comando);

/** Roda um comando até o fim; qualquer falha derruba o script com a saída. */
function rodar(comando, args, opcoes = {}) {
  console.log(`$ ${comando} ${args.join(' ')}`);
  const r = spawnSync(comando, args, { stdio: 'inherit', shell: windows && precisaDeShell(comando), ...opcoes });
  if (r.status !== 0) throw new Error(`falhou (status ${r.status}, sinal ${r.signal}, erro ${r.error?.message}): ${comando} ${args.join(" ")}`);
}

/** Processo de longa duração: saída em arquivo de log, pid guardado para o parar.mjs. */
function emSegundoPlano(nome, comando, args, opcoes = {}) {
  const log = openSync(join(pasta, `${nome}.log`), 'w');
  const filho = spawn(comando, args, { stdio: ['ignore', log, log], detached: true, shell: windows && comando === 'corepack', windowsHide: true, ...opcoes });
  filho.unref();
  pids[nome] = filho.pid;
  writeFileSync(join(pasta, 'pids.json'), JSON.stringify(pids, null, 2));
  console.log(`> ${nome} (pid ${filho.pid})`);
}

async function esperar(nome, url, ms = 180_000, aceita = (r) => r.ok) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    try {
      if (aceita(await fetch(url))) return console.log(`✓ ${nome} no ar`);
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${nome} não respondeu em ${ms / 1000}s (${url}); veja e2e/.stack/${nome}.log`);
}

// O jar mais recente da pasta (sem o -plain): uma pasta build/ antiga pode ter jars de versões passadas.
const jar = (dir) => {
  const libs = join(dir, 'build', 'libs');
  const jars = readdirSync(libs).filter((f) => f.endsWith('.jar') && !f.endsWith('-plain.jar'));
  jars.sort((x, y) => statSync(join(libs, y)).mtimeMs - statSync(join(libs, x)).mtimeMs);
  return join(libs, jars[0]);
};

// 1) infra
const backend = repo('backend');
const gradlew = windows ? `"${join(backend, 'gradlew.bat')}"` : './gradlew';
rodar('docker', ['compose', '-f', join(backend, 'infra', 'docker-compose.yml'), 'up', '-d', '--wait']);

// 2) jars e serviços
const apps = [
  ['catalogo', join(backend, 'catalogo-service', 'bootstrap'), 8081],
  ['carrinho', join(backend, 'carrinho-service', 'bootstrap'), 8082],
  ['pedido', join(backend, 'pedido-service', 'bootstrap'), 8083],
  ['pagamento', join(backend, 'pagamento-service', 'bootstrap'), 8084],
  ['gateway', join(backend, 'gateway'), GATEWAY_PORT],
];
rodar(gradlew, ['--console=plain', '-x', 'test', ...apps.map(([n]) => (n === 'gateway' ? ':gateway:bootJar' : `:${n}-service:bootstrap:bootJar`))], { cwd: backend });
for (const [nome, dir] of apps) {
  // SERVER_PORT sobrepõe `server.port` do application.yml (só o gateway precisa disso).
  const env = nome === 'gateway' ? { ...process.env, SERVER_PORT: String(GATEWAY_PORT) } : process.env;
  emSegundoPlano(nome, java(), ['-jar', jar(dir)], { cwd: backend, env });
}
for (const [nome, , porta] of apps) await esperar(nome, `http://localhost:${porta}/actuator/health`);

// 3) dados de teste: um produto na vitrine (ainda não há endpoint para criar categoria) e o carrinho de teste vazio
const mysql = (schema, arquivoSql) =>
  rodar('docker', ['compose', '-f', join(backend, 'infra', 'docker-compose.yml'), 'exec', '-T', 'mysql', 'sh', '-c', `mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ${schema}`], {
    input: readFileSync(join(aqui, arquivoSql)),
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: false,
  });
mysql('catalogo', 'seed.sql');
mysql('carrinho', 'limpar-carrinho.sql');

// 4) microfrontends e shell: build e preview (as portas são as do manifesto padrão do shell)
const front = [
  ['catalogo', 5174],
  ['carrinho', 5175],
  ['checkout', 5176],
  ['shell', 5173],
];
// Cada MFE chama só o próprio serviço: catálogo e carrinho apontam para a rota deles; o checkout, que fala com
// pedido e pagamento, usa a base /api e escolhe o prefixo em cada chamada.
const apiDoMfe = { catalogo: `${API}/catalogo`, carrinho: `${API}/carrinho`, checkout: API, shell: API };
const pnpm = (dir, nome, ...args) =>
  rodar('corepack', ['pnpm@10', ...args], { cwd: dir, env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', VITE_API_URL: apiDoMfe[nome], VITE_SIMULAR_PIX: 'true' } });
for (const [nome] of front) pnpm(nome === 'shell' ? shell : repo(`mfe-${nome}`), nome, 'build');
for (const [nome, porta] of front) {
  const dir = nome === 'shell' ? shell : repo(`mfe-${nome}`);
  emSegundoPlano(nome, 'corepack', ['pnpm@10', 'preview'], { cwd: dir, env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });
  await esperar(nome, `http://localhost:${porta}/`, 60_000);
}
await esperar('keycloak', 'http://localhost:8180/realms/mini/.well-known/openid-configuration', 60_000);
console.log('\nStack pronta. Rode: pnpm e2e   (e, ao terminar, pnpm e2e:parar)');
