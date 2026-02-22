#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n📦 Installing dependencies...\n');

const npmInstall = spawn('npm', ['install'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

npmInstall.on('error', (err) => {
  console.error('Failed to install dependencies:', err);
  process.exit(1);
});

npmInstall.on('close', (code) => {
  if (code !== 0) {
    console.error('npm install failed with code:', code);
    process.exit(code);
  }

  console.log('\n🚀 Starting...\n');


  // Start Vite dev server using local vite
  const vite = spawn('node', [join(__dirname, 'node_modules/vite/bin/vite.js'), '--host', '--open'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  vite.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  vite.on('close', (code) => {
    process.exit(code || 0);
  });
});
