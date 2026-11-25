#!/usr/bin/env bun
/**
 * 打包 app.html 的錢包程式：assets/vendor/cre8-wallet.js（window.CRE8W）。
 *
 *   bun scripts/build-vendor.ts
 *
 * 內容是 cre8-app 已上線的登入（Privy）、換 session、Kernel UserOp、首次加入、水龍頭、賣出、My mix 程式，
 * 加上 scripts/vendor/wallet-entry.tsx 把它們串成 app.html 用的幾個動作。cre8-app 不改：
 *   1. `git archive` 取 cre8-app 指定版本的 src 與 .env.production 到暫存資料夾（預設 origin/main）。
 *   2. 暫存資料夾的 node_modules 連到一份已安裝好的 cre8-app 套件（版本必須跟那個 commit 的 bun.lock 一致）。
 *   3. Bun.build 打成一個 IIFE；react／react-dom 指到頁面上的 window.React／window.ReactDOM（support.js 載入的 18.3.1）。
 *
 * 環境變數：
 *   CRE8_APP_DIR           cre8-app 的 git checkout（預設 ../cre8-app，相對於 cre8-web）
 *   CRE8_APP_REF           要打包的 cre8-app 版本（預設 origin/main；先 git fetch）
 *   CRE8_APP_NODE_MODULES  已安裝好的 cre8-app node_modules（預設 $CRE8_APP_DIR/node_modules）
 */
import { $ } from 'bun';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const appDir = resolve(root, process.env.CRE8_APP_DIR ?? '../cre8-app');
const ref = process.env.CRE8_APP_REF ?? 'origin/main';
const nodeModules = resolve(process.env.CRE8_APP_NODE_MODULES ?? join(appDir, 'node_modules'));
const out = join(root, 'assets/vendor/cre8-wallet.js');

if (!existsSync(join(appDir, '.git'))) throw new Error(`cre8-app checkout not found at ${appDir} (set CRE8_APP_DIR)`);
if (!existsSync(join(nodeModules, '@privy-io/react-auth'))) {
  throw new Error(`No installed cre8-app packages at ${nodeModules}. Run \`bun install --frozen-lockfile\` in a cre8-app checkout at ${ref}, or set CRE8_APP_NODE_MODULES.`);
}

const commit = (await $`git -C ${appDir} rev-parse ${ref}`.text()).trim();
const work = mkdtempSync(join(tmpdir(), 'cre8-wallet-'));
try {
  await $`git -C ${appDir} archive ${commit} src .env.production package.json | tar -x -C ${work}`;
  symlinkSync(nodeModules, join(work, 'node_modules'), 'dir');
  copyFileSync(join(root, 'scripts/vendor/wallet-entry.tsx'), join(work, 'src/__cre8web_wallet.tsx'));
  // wallet-entry 自己的純邏輯模組（node 直接測：scripts/test-sell-all.mjs），放在它旁邊。
  copyFileSync(join(root, 'scripts/vendor/web-sell-all.ts'), join(work, 'src/web-sell-all.ts'));

  // 套件版本要跟這個 commit 的 package.json 一致（@zerodev 與後端必須相同，否則 AA24）。
  const pkg = JSON.parse(readFileSync(join(work, 'package.json'), 'utf8'));
  for (const name of ['@privy-io/react-auth', '@zerodev/sdk', '@zerodev/ecdsa-validator', 'viem', 'zustand']) {
    const want = String(pkg.dependencies[name]).replace(/^[\^~]/, '');
    const have = JSON.parse(readFileSync(join(nodeModules, name, 'package.json'), 'utf8')).version;
    if (want !== have && !(String(pkg.dependencies[name]).startsWith('^') && have.split('.')[0] === want.split('.')[0])) {
      throw new Error(`${name}: cre8-app ${commit.slice(0, 7)} wants ${pkg.dependencies[name]}, installed ${have}`);
    }
  }

  // Vite 的 import.meta.env：讀那個 commit 的 .env.production（公開設定，不含憑證）。
  const env: Record<string, string | boolean> = { MODE: 'production', DEV: false, PROD: true, BASE_URL: '/' };
  for (const line of readFileSync(join(work, '.env.production'), 'utf8').split('\n')) {
    const m = /^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }

  const shim = (code: string) => ({ contents: code, loader: 'js' as const });
  const SHIMS: Record<string, string> = {
    react: 'module.exports = window.React;',
    'react-dom': 'module.exports = window.ReactDOM;',
    'react-dom/client': 'module.exports = { createRoot: (...a) => window.ReactDOM.createRoot(...a), hydrateRoot: (...a) => window.ReactDOM.hydrateRoot(...a) };',
    // React 18 UMD 沒有 jsx-runtime：用 createElement 做同一件事（key 從第三個參數放回 props）。
    'react/jsx-runtime': 'const R = window.React; const jsx = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k }); module.exports = { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: R.Fragment };',
    'react/jsx-dev-runtime': 'const R = window.React; const jsx = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k }); module.exports = { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: R.Fragment };',
  };

  const result = await Bun.build({
    entrypoints: [join(work, 'src/__cre8web_wallet.tsx')],
    target: 'browser',
    format: 'iife',
    minify: true,
    define: { 'import.meta.env': JSON.stringify(env), 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
    jsx: { runtime: 'automatic' },
    plugins: [{
      name: 'cre8-web',
      setup(build) {
        build.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, (a) => ({ path: a.path, namespace: 'cre8-shim' }));
        build.onLoad({ filter: /.*/, namespace: 'cre8-shim' }, (a) => shim(SHIMS[a.path]));
        // 同 cre8-app vite.config.ts：events 用瀏覽器版；Privy 的 Solana 選用依賴指到只會丟錯的替身（只用 EVM）。
        build.onResolve({ filter: /^events$/ }, () => ({ path: join(nodeModules, 'events/events.js') }));
        build.onResolve({ filter: /^@solana-program\/system$/ }, () => ({ path: join(work, 'src/lib/privy-solana-stub.ts') }));
      },
    }],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error('build failed');
  }
  const code = await result.outputs[0].text();
  const banner = `/*! cre8-wallet.js — built by cre8-web scripts/build-vendor.ts from cre8-app ${commit} (${new Date().toISOString().slice(0, 10)}). Bundles Privy, viem and ZeroDev (see their licenses). */\n`;
  writeFileSync(out, banner + code + '\n');
  console.log(`wrote ${out} (${(statSync(out).size / 1024 / 1024).toFixed(2)} MB) from cre8-app ${commit.slice(0, 7)}`);
  // 載入網址帶內容雜湊，重打包後瀏覽器一定抓新檔（不會用到快取的舊版）。
  const v = (await import('node:crypto')).createHash('sha256').update(banner + code + '\n').digest('hex').slice(0, 10);
  for (const page of ['app.html', 'waitlist.html']) {
    const file = join(import.meta.dir, '..', page);
    const html = readFileSync(file, 'utf8');
    const next = html.replace(/(assets\/vendor\/cre8-wallet\.js)(\?v=[0-9a-f]+)?'/, `$1?v=${v}'`);
    if (next === html && !html.includes(`cre8-wallet.js?v=${v}'`)) throw new Error(`${page}：找不到 cre8-wallet.js 的載入網址`);
    writeFileSync(file, next);
  }
  console.log(`cre8-wallet.js 版本 ${v} 已寫進 app.html、waitlist.html（記得重跑 build-pages 更新 /zh/waitlist）`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
