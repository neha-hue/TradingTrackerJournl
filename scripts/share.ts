/**
 * Puts the journal on a temporary public HTTPS URL so it can be opened from a phone,
 * using a Cloudflare quick tunnel (free, no account needed).
 *
 * Runs the Express server in production mode - it serves the built frontend, the API and
 * the uploaded screenshots from one origin on port 3001 - and points the tunnel at it.
 * One origin means the session cookie just works, with no CORS setup.
 *
 * Two things are deliberately different from `npm run dev`, because this URL is reachable
 * by anyone who has it:
 *   - the frontend is built with `--mode share`, which blanks VITE_AUTO_LOGIN_* so the
 *     password is not inlined into the public JS bundle
 *   - ALLOW_SIGNUP=false, so nobody can register an account on this machine
 *
 * Usage:  npm run share      (Ctrl+C stops both the server and the tunnel)
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = Number(process.env.PORT) || 3001;
const children: ChildProcess[] = [];

/**
 * winget installs cloudflared to Program Files but the PATH change only reaches shells
 * started afterwards, so a freshly installed binary is routinely missing from PATH here.
 * Look it up properly instead of assuming.
 */
function findCloudflared(): string | null {
  try {
    const found = execSync(process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared',
      { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')[0].trim();
    if (found) return found;
  } catch { /* not on PATH - fall through to the usual install locations */ }

  const candidates = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    '/usr/local/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared'
  ];
  return candidates.find(existsSync) ?? null;
}

function shutdown() {
  for (const c of children) { try { c.kill(); } catch { /* already gone */ } }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!existsSync('dist/index.html')) {
  console.error("No build found. Run 'npm run build:share' first.");
  process.exit(1);
}

const cloudflared = findCloudflared();
if (!cloudflared) {
  console.error('cloudflared not found. Install it with:');
  console.error('  winget install --id Cloudflare.cloudflared --source winget');
  process.exit(1);
}

console.log('Starting server on port ' + PORT + ' (sign-ups disabled)...');
// Run tsx's entry with this same node binary. Going through npx would mean spawning
// npx.cmd, which Windows refuses without shell:true (EINVAL) - this sidesteps that.
const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
  env: { ...process.env, ALLOW_SIGNUP: 'false', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'inherit']
});
children.push(server);
server.stdout!.on('data', d => process.stdout.write('  [server] ' + d));

// Give the server a moment to bind before the tunnel starts probing it.
setTimeout(() => {
  console.log('Opening Cloudflare tunnel...\n');
  const tunnel = spawn(cloudflared, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(tunnel);

  let announced = false;
  const recent: string[] = [];
  const watch = (buf: Buffer) => {
    const text = buf.toString();
    recent.push(text);
    if (recent.length > 20) recent.shift();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !announced) {
      announced = true;
      const line = '='.repeat(60);
      console.log(`\n${line}`);
      console.log('  Phone pe ye URL kholo:');
      console.log(`\n     ${match[0]}\n`);
      console.log('  Login: apna email + password daalo (auto-login yahan off hai).');
      console.log('  Ye URL har baar badalta hai, aur Ctrl+C karte hi band ho jaata hai.');
      console.log(`${line}\n`);
    }
  };
  tunnel.stdout!.on('data', watch);
  tunnel.stderr!.on('data', watch); // cloudflared prints the URL on stderr

  tunnel.on('exit', code => {
    console.error(`\nTunnel exited (code ${code}).`);
    // Without this the failure is a bare exit code and there is nothing to act on.
    if (!announced) {
      console.error('cloudflared said:\n' + recent.join('').split('\n').slice(-15).join('\n'));
    }
    shutdown();
  });
}, 2500);
