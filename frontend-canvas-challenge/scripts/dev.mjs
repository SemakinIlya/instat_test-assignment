import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['run', 'dev', '-w', '@canvas/api'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev', '-w', '@canvas/web'], { stdio: 'inherit', shell: true }),
];

function shutdown(signal) {
  for (const child of children) child.kill(signal);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(signal));
