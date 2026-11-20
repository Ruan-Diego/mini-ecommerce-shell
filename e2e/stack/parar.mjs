// Para o que o subir.mjs deixou rodando (jars e previews). A infra do Docker Compose continua de pé:
// para derrubá-la, `docker compose -f <backend>/infra/docker-compose.yml down`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const arquivo = join(dirname(fileURLToPath(import.meta.url)), '..', '.stack', 'pids.json');
if (!existsSync(arquivo)) {
  console.log('Nada para parar.');
  process.exit(0);
}
for (const [nome, pid] of Object.entries(JSON.parse(readFileSync(arquivo, 'utf8')))) {
  const r =
    process.platform === 'win32'
      ? spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
      : spawnSync('kill', ['-TERM', `-${pid}`], { stdio: 'ignore' });
  console.log(`${r.status === 0 ? 'parou' : 'já não estava rodando'}: ${nome} (${pid})`);
}
