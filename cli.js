#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🚀 Starting Gmail Treemax...\n');
console.log('📧 Opening in your browser...\n');

// Start Vite dev server
const vite = spawn('npx', ['vite', '--host', '--open'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

vite.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

vite.on('close', (code) => {
  process.exit(code || 0);
});
