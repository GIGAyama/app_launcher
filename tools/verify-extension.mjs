#!/usr/bin/env node
// ============================================================================
// 実物の Chrome に拡張機能として読み込ませて確かめる（§7-1 の 2〜4）
//
// measure.mjs は「表示」を測るために CSP をヘッダーで真似ていた。
// だが manifest.json の書き方そのものが正しいか（Chrome が受け付けるか）は、
// 本当に読み込ませないと分からない。
// content_security_policy の書き方を1文字間違えると、
// 拡張機能はビルドも静的解析も通ったうえで「読み込みエラー」になる。
//
// ここで確かめること:
//   1. Chrome が manifest を受け付け、拡張機能IDが振られるか
//   2. background の Service Worker が実際に起きるか
//   3. popup.html を拡張機能のオリジンで開いて JS エラー・CSP違反が出ないか
//   4. 同梱アイコン（icons/*.svg, icons/icon-*.png）が実際に読めるか
//   5. 右クリックメニューが作られるか
//
//   node tools/verify-extension.mjs
// ============================================================================

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'giga-portal-'));
const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ' … ' + detail : ''}`);
  if (!cond) fail.push(label);
};

// 拡張機能は昔の headless（chrome-headless-shell）では読み込まれない。
// channel:'chromium' を指定すると本体の Chromium が新しい headless で動き、
// 拡張機能を読み込めるようになる。画面のあるサーバーが要らない。
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--no-sandbox',
  ],
});

try {
  // 1. Service Worker が起きるか＝manifest が受理された証拠
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
  ok('manifest が受理され Service Worker が起動する', !!sw, sw ? sw.url() : '起動しなかった');
  if (!sw) throw new Error('拡張機能が読み込まれていない');

  const extId = new URL(sw.url()).host;
  console.log(`  （拡張機能ID: ${extId}）`);

  // 2. 右クリックメニューが作られたか
  const menuOk = await sw.evaluate(() => new Promise((resolve) => {
    // onInstalled は既に済んでいるので、作り直して重複エラーが出るかで見る
    chrome.contextMenus.create({ id: '__probe', title: 'probe', contexts: ['page'] }, () => {
      const err = chrome.runtime.lastError;
      chrome.contextMenus.remove('__probe', () => void chrome.runtime.lastError);
      resolve(!err);
    });
  })).catch((e) => String(e));
  ok('contextMenus API が使える', menuOk === true, String(menuOk));

  // 3. popup.html を拡張機能のオリジンで開く（本番と同じ CSP が効いた状態）
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) csp.push(t);
    else if (m.type() === 'error' && !/net::ERR_|Failed to load resource/i.test(t)) errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.waitForTimeout(1200);

  const tiles = await page.locator('.app-tile').count();
  ok('既定の9個が描画される', tiles === 9, `${tiles}個`);
  ok('CSP違反が出ない', csp.length === 0, csp.slice(0, 2).join(' / '));
  ok('JSエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));

  // 4. 同梱の絵が実際に読めるか（パスやファイル名の打ち間違いはここでしか出ない）
  const assets = [
    'icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png',
    'icons/fb-classroom.svg', 'icons/fb-drive.svg', 'icons/fb-docs.svg',
    'icons/fb-slides.svg', 'icons/fb-sheets.svg', 'icons/fb-forms.svg',
    'icons/fb-meet.svg', 'icons/fb-calendar.svg', 'icons/fb-translate.svg',
    'icons/fb-generic.svg',
  ];
  const missing = await page.evaluate(async (list) => {
    const bad = [];
    for (const f of list) {
      const r = await fetch(f).catch(() => null);
      if (!r || !r.ok) bad.push(f);
    }
    return bad;
  }, assets);
  ok('同梱アイコンがすべて読める', missing.length === 0, missing.join(', '));

  // 5. 代替アイコンの仕組みが本当に動くか。
  //    わざと開けない URL を入れて、SVG に切り替わることを見る。
  //    （インラインの onerror= だった頃は、ここが黙って効かなかった）
  const fellBack = await page.evaluate(async () => {
    const img = document.querySelector('.app-icon');
    // すでに1度切り替わっている場合は「無限に繰り返さない」ための印が付いている。
    // 仕組みそのものを試したいので、印を外してから壊れた URL を入れる。
    const already = /icons\/fb-.*\.svg$/.test(img.src);
    delete img.dataset.fellBack;
    await new Promise((res) => {
      img.addEventListener('load', res, { once: true });
      img.src = 'https://127.0.0.1:1/does-not-exist.png';
      setTimeout(res, 4000);
    });
    return { already, after: img.src, retryGuard: img.dataset.fellBack === '1' };
  });
  ok('画像が取れないとき同梱の絵に切り替わる',
    /icons\/fb-.*\.svg$/.test(fellBack.after), fellBack.after);
  ok('切り替えは1回だけで止まる（無限に読み直さない）', fellBack.retryGuard === true);
  console.log(`  （この環境では ssl.gstatic.com へ出られないため、`
    + `最初の描画の時点で ${fellBack.already ? 'すでに同梱の絵へ切り替わっていた' : '外部の絵が取れていた'}`
    + ' — 学校のフィルタリング下と同じ状態）');

  // 6. content.js と同じ形で iframe に埋め込んだときに動くか。
  //    web_accessible_resources を popup.html だけに絞ったので、
  //    popup.css / popup.js / lib/*.js が読めなくなっていないかを見る。
  //    （絞りすぎると Google のページの上でだけ真っ白になる。
  //      ツールバーから開く分には気づけない。）
  //    ⚠️ 埋め込み元のオリジンが *.google.com でないと、
  //    web_accessible_resources の matches に弾かれて当然入れない。
  //    about:blank に貼って「入れなかった」と判定すると、
  //    設定が正しいのに壊れていると読み違える。
  //    実物の google.com へは出られないので、その URL の応答だけを差し替える。
  const host = await ctx.newPage();
  await host.route('https://www.google.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>host</title><body><p>ページ本体</p>',
  }));
  await host.goto('https://www.google.com/');
  await host.evaluate((id) => new Promise((res) => {
    const f = document.createElement('iframe');
    f.id = 'giga-launcher-iframe';
    f.src = `chrome-extension://${id}/popup.html#embed=` + encodeURIComponent('https://www.google.com');
    f.style.cssText = 'width:360px;height:500px';
    f.addEventListener('load', () => setTimeout(res, 1200), { once: true });
    document.body.appendChild(f);
  }), extId);
  const inFrame = host.frames().find((f) => f.url().includes('popup.html'));
  const framed = inFrame ? await inFrame.evaluate(() => ({
    tiles: document.querySelectorAll('.app-tile').length,
    // CSS が当たっているか（当たっていなければ幅の指定が効かない）
    styled: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
    grid: getComputedStyle(document.querySelector('.app-grid')).display,
  })) : null;
  ok('Google のページに埋め込んでも中身が出る', !!framed && framed.tiles === 9,
    framed ? `${framed.tiles}個` : 'iframe の中に入れなかった');
  ok('埋め込み時に CSS が当たっている', !!framed && framed.styled && framed.grid === 'grid',
    framed ? `display:${framed.grid}` : '-');

  // 7. インライン script が本当に止まること（CSP が効いている証拠）
  const inlineBlocked = await page.evaluate(() => {
    window.__inlineRan = false;
    const s = document.createElement('script');
    s.textContent = 'window.__inlineRan = true;';
    document.head.appendChild(s);
    return window.__inlineRan === false;
  });
  ok('インライン script が CSP で止まる', inlineBlocked);
} catch (e) {
  console.error('  ✗ ' + e.message);
  fail.push(e.message);
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

console.log(fail.length ? `\n失敗 ${fail.length}件` : '\nすべて確認できた');
process.exit(fail.length ? 1 : 0);
