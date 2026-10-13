// Runs the importer's tests (pytest) with its own Python environment,
// importador/.venv, created on first use with importador/requirements-dev.txt.
// Part of "npm test" (v0.6).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const win = process.platform === 'win32';
const venv = join('importador', '.venv');
const python = join(venv, win ? 'Scripts/python.exe' : 'bin/python');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

if (!existsSync(python)) {
  console.log('Preparando o Python do importador (importador/.venv)…');
  const base = win ? ['py', ['-3', '-m', 'venv', venv]] : ['python3', ['-m', 'venv', venv]];
  if (run(...base) !== 0) process.exit(1);
  if (run(python, ['-m', 'pip', 'install', '--quiet', '-r', join('importador', 'requirements-dev.txt')]) !== 0) process.exit(1);
}
process.exit(run(python, ['-m', 'pytest', 'importador', '-q', '-p', 'no:cacheprovider']));
