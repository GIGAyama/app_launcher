#!/usr/bin/env node
// ============================================================================
// GIGA Standard v5 §7 — 実測ツール（Chrome拡張 D型用）
//
// 「読むだけでは分からない」ものを実ブラウザで測る。測るのは4つ。
//   1. コントラスト比（§2-8）
//   2. タップ領域 44px（§2-9。疑似要素の当たり判定を含める）
//   3. CSP違反と JS エラー（§2-13）
//   4. 横スクロール（320px 幅）
//
// 【なぜ拡張機能をそのままブラウザに読ませないのか】
// popup.html は chrome.* API に依存するため、ただ開くと最初の1行で落ちて
// 何も描画されず「0件でした」という無意味な数字が出る。
// そこで chrome.* のダミーを差し込み、実際にアプリが動いた状態を測る。
//
// 【なぜ CSP をヘッダーで付けるのか】
// MV3 の拡張機能ページには既定で script-src 'self'; object-src 'self' が
// 効いている。これを再現しないと、インラインの onerror= が「動くもの」として
// 測られてしまい、本番と違う結果になる（実際にこれで1件見つかった）。
//
// 使い方:
//   node tools/measure.mjs            … 学校のフィルタリングを再現して測る（既定）
//   node tools/measure.mjs --online   … 外部への取得を許して測る
//   node tools/measure.mjs --selftest … 検査自身が壊れていないことを確かめる
//   node tools/measure.mjs --all      … 通っているものも比の低い順に並べて出す
//
// 【--selftest がなぜ要るか】
// 「0件でした」だけでは、基準を満たしているのか、検査が何も見ていないのかを
// 区別できない。わざと読めない色を差し込み、それが捕まることを確かめる。
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OFFLINE = !process.argv.includes('--online');
const SELFTEST = process.argv.includes('--selftest');
const SHOW_ALL = process.argv.includes('--all');

// 学校のフィルタリングで塞がれうる宛先。ここを塞いだ状態が「教室の既定値」である。
const BLOCKED = [
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'ssl.gstatic.com', 'www.google.com', 'lh3.googleusercontent.com',
];

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'popup.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // MV3 拡張機能ページの既定 CSP を再現する（これが無いと測る意味が変わる）
    if (ext === '.html') headers['Content-Security-Policy'] = "script-src 'self'; object-src 'self';";
    res.writeHead(200, headers);
    res.end(fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// --- ブラウザの中で走る計測本体 -------------------------------------------
const IN_PAGE = /* js */ `(() => {
  // ⚠️ 色は必ず 1px 実際に塗って読む（§7-2）。
  //    oklch() / color-mix() を数字で拾うと、どの要素も真っ黒と判定されて
  //    比が 1.0 付近になり、全部でたらめになる。
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    try { ctx.fillStyle = s; } catch { return [0, 0, 0, 0]; }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    return a === 0 ? [0, 0, 0, 0] : [d[0] / a, d[1] / a, d[2] / a, a];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const over = (fg, bg) => {
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 背景は「透けていない面」に当たるまで祖先をたどって重ねる。
  // グラデーションは backgroundColor が透明なので、backgroundImage の
  // 最初の色を拾う（見ないと「白の上の白＝比1.0」という誤報になる）。
  const bgOf = (el) => {
    let acc = [0, 0, 0, 0], node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      let c = parse(cs.backgroundColor);
      if (c[3] === 0 && cs.backgroundImage !== 'none') {
        const m = cs.backgroundImage.match(/(rgba?\\([^)]*\\)|#[0-9a-f]{3,8}|oklch\\([^)]*\\)|lab\\([^)]*\\))/i);
        if (m) c = parse(m[1]);
      }
      if (c[3] > 0) acc = acc[3] === 0 ? c : over(acc, c);
      if (acc[3] >= 0.999) return acc;
      node = node.parentElement;
    }
    return acc[3] === 0 ? [255, 255, 255, 1] : over(acc, [255, 255, 255, 1]);
  };

  const EMOJI = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}]/u;
  const sel = (el) => el.tagName.toLowerCase() +
    (el.id ? '#' + el.id : '') +
    (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');

  const contrast = [], all = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || !visible(el)) continue;
    // 使用不可の状態は WCAG の対象外。濃くすると「押せる」と誤解させる。
    if (el.closest('[disabled],[aria-disabled="true"]')) continue;
    // 絵文字はフォント自身の色で描かれ CSS の color が効かない → 誤報になる
    const stripped = text.replace(EMOJI, '').trim();
    if (!stripped) continue;
    const cs = getComputedStyle(el);
    const bg = bgOf(el);
    const fg = over(parse(cs.color), bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    const key = sel(el) + '|' + text.slice(0, 24);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { sel: sel(el), text: text.slice(0, 24), color: cs.color,
      bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')',
      size, weight, ratio: +r.toFixed(2), need };
    all.push(row);
    if (r < need) contrast.push(row);
  }

  // タップ領域。疑似要素で当たり判定だけ広げている形（§2-9）を汲む。
  const taps = [];
  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!visible(el) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    let w = r.width, h = r.height;
    for (const pseudo of ['::after', '::before']) {
      const p = getComputedStyle(el, pseudo);
      if (p.content === 'none' || p.position !== 'absolute') continue;
      const pw = Math.max(parseFloat(p.width) || 0, parseFloat(p.minWidth) || 0);
      const ph = Math.max(parseFloat(p.height) || 0, parseFloat(p.minHeight) || 0);
      w = Math.max(w, pw); h = Math.max(h, ph);
    }
    if (w < 44 || h < 44) taps.push({ sel: sel(el),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20),
      w: +w.toFixed(1), h: +h.toFixed(1) });
  }

  return {
    contrast, all, taps,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  };
})()`;

// ホバー・フォーカス時の色は、放っておくと一度も測られない。
// ところが「ボタンに乗せたときだけ白抜きになる」という形は多く、
// そこが基準未満でも普通の走査では見つからない。
// :hover / :focus のルールを .__probe というクラスに複製して、
// 実際に当てた状態で測れるようにする。
const HOVER_PROBE = /* js */ `(() => {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (!rule.selectorText || !/:hover|:focus(-visible)?/.test(rule.selectorText)) continue;
      const cloned = rule.selectorText
        .split(',')
        .map(s => s.trim().replace(/:hover|:focus-visible|:focus/g, '.__probe'))
        .join(',');
      out.push(cloned + '{' + rule.style.cssText + '}');
    }
  }
  const st = document.createElement('style');
  st.id = '__probe-styles';
  st.textContent = out.join('\\n');
  document.head.appendChild(st);
  // 実際に当たっている要素にだけ付ける
  let n = 0;
  for (const el of document.querySelectorAll('a,button,input,[role=button]')) { el.classList.add('__probe'); n++; }
  return n;
})()`;

// --- chrome.* のダミー ------------------------------------------------------
// 戻り値の見本を与えて本編まで進める（§7-3 と同じ考え方）。
const CHROME_STUB = /* js */ `
window.__gigaStore = { sync: {}, local: {} };
const area = (name) => ({
  get: async (keys) => {
    const s = window.__gigaStore[name];
    if (typeof keys === 'string') return { [keys]: s[keys] };
    if (Array.isArray(keys)) return Object.fromEntries(keys.map(k => [k, s[k]]).filter(e => e[1] !== undefined));
    return { ...s };
  },
  set: async (obj) => { Object.assign(window.__gigaStore[name], obj); },
  remove: async () => {}, clear: async () => {},
});
window.chrome = {
  runtime: { getURL: (p) => location.origin + '/' + p, id: 'measure', lastError: null },
  storage: { sync: area('sync'), local: area('local') },
  tabs: {
    query: async () => ([{ id: 1, windowId: 1, url: 'https://example.com/', title: 'テストページ - Example', favIconUrl: '' }]),
    update: async () => ({}), create: async () => ({}),
  },
  windows: { update: async () => ({}) },
  i18n: { getMessage: () => '' },
};
`;

const run = async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const results = {};

  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 400, height: 900 } });
    await ctx.addInitScript(CHROME_STUB);
    if (OFFLINE) {
      await ctx.route('**/*', (route) => {
        const h = new URL(route.request().url()).hostname;
        return BLOCKED.includes(h) ? route.abort('blockedbyclient') : route.continue();
      });
    }
    const page = await ctx.newPage();
    const errors = [], csp = [], blocked = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/Content Security Policy|Refused to/i.test(t)) csp.push(t);
      // 外部資産が塞がれること自体は「学校での既定の状態」であって不具合ではない。
      // 大事なのは、塞がれたあとに代わりの絵が出ているか（icons の数字を見る）。
      // ここを JS エラーと一緒に数えると、狙って再現した状態で常に赤くなる。
      else if (m.type() === 'error' && /net::ERR_|Failed to load resource/i.test(t)) blocked.push(t);
      else if (m.type() === 'error') errors.push(t);
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(`${base}/popup.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // 検査自身が動いていることの確認。読めない色をわざと差し込み、捕まるか見る。
    if (SELFTEST) {
      await page.evaluate(() => {
        const st = document.createElement('style');
        st.textContent = '#__canary{color:#f2f2f2;background:#fff;font-size:12px}';
        document.head.appendChild(st);
        const p = document.createElement('p');
        p.id = '__canary'; p.textContent = 'わざと読めなくした文字';
        document.body.appendChild(p);
        const b = document.createElement('button');
        b.id = '__canary-tap'; b.textContent = '小';
        b.style.cssText = 'width:12px;height:12px;padding:0;border:0';
        document.body.appendChild(b);
      });
    }

    const views = { launcher: '#launcher-view', addForm: '#add-form-view', settings: '#settings-view' };
    const per = {};
    for (const [name, id] of Object.entries(views)) {
      await page.evaluate((sel) => {
        for (const v of ['#launcher-view', '#add-form-view', '#settings-view']) {
          document.querySelector(v).classList.toggle('hidden', v !== sel);
        }
        // ホバーでしか出ない操作ボタンも測る（見えないから測らない、では見落とす）
        document.querySelectorAll('.item-actions').forEach(e => (e.style.display = 'flex'));
      }, id);
      per[name] = await page.evaluate(IN_PAGE);
    }

    // トーストは既定で hidden なので、そのままでは一度も測られない。
    // 「保存しました」「エラー」は児童がいちばん見る文字なので必ず測る。
    for (const kind of ['success', 'error']) {
      await page.evaluate((k) => {
        const t = document.getElementById('toast');
        t.className = 'toast ' + k;
        t.textContent = k === 'error' ? '正しい設定ファイルではありません' : '保存しました';
      }, kind);
      per['toast:' + kind] = await page.evaluate(IN_PAGE);
    }

    // ホバー／フォーカス状態を当てて測り直す
    await page.evaluate(() => {
      for (const v of ['#launcher-view', '#add-form-view', '#settings-view']) {
        document.querySelector(v).classList.remove('hidden');
      }
      document.querySelectorAll('.item-actions').forEach(e => (e.style.display = 'flex'));
    });
    await page.evaluate(HOVER_PROBE);
    per['hover/focus'] = await page.evaluate(IN_PAGE);

    // 320px 幅で横スクロールが出ないか
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(150);
    const narrow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    // 既定アイコンが実際に絵として出ているか（フィルタリング下での見え方）
    const icons = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.app-icon')];
      return { total: imgs.length, broken: imgs.filter(i => !i.complete || i.naturalWidth === 0).length };
    });

    results[scheme] = { per, narrow, icons, errors, csp, blocked };
    await ctx.close();
  }

  await browser.close();
  server.close();

  // --- 報告 ---
  let ng = 0;
  for (const [scheme, r] of Object.entries(results)) {
    console.log(`\n===== ${scheme} =====`);
    for (const [view, d] of Object.entries(r.per)) {
      console.log(`  [${view}] コントラスト未満 ${d.contrast.length}件 / タップ44px未満 ${d.taps.length}件`);
      for (const c of d.contrast) console.log(`    ✗ ${c.ratio} (要 ${c.need}) ${c.sel} "${c.text}" ${c.color} on ${c.bg} ${c.size}px/${c.weight}`);
      for (const t of d.taps) console.log(`    ✗ ${t.w}×${t.h} ${t.sel} "${t.label}"`);
      if (SHOW_ALL) {
        for (const c of [...d.all].sort((a, b) => a.ratio - b.ratio).slice(0, 6)) {
          console.log(`      ${c.ratio >= c.need ? '·' : '✗'} ${c.ratio} ${c.sel} "${c.text}" ${c.color} on ${c.bg}`);
        }
      }
      ng += d.contrast.length + d.taps.length;
    }
    console.log(`  320px 横スクロール: ${r.narrow.scrollW > r.narrow.clientW ? 'あり ✗ (' + r.narrow.scrollW + '>' + r.narrow.clientW + ')' : 'なし ✓'}`);
    if (r.narrow.scrollW > r.narrow.clientW) ng++;
    console.log(`  アイコン: ${r.icons.broken}/${r.icons.total} 枚が表示できていない${OFFLINE ? '（フィルタリング再現時）' : ''}`);
    if (r.icons.broken) ng++;
    console.log(`  CSP違反: ${r.csp.length}件 / JSエラー: ${r.errors.length}件`);
    console.log(`  外部資産の取得失敗: ${r.blocked.length}件${OFFLINE ? '（塞いで測っているので想定どおり）' : ' ← --online なのに落ちている'}`);
    for (const c of r.csp) console.log(`    ! ${c.slice(0, 160)}`);
    for (const e of r.errors) console.log(`    ! ${e.slice(0, 160)}`);
    ng += r.csp.length + r.errors.length;
    // 外へ出られる状態で落ちているなら、それは本当の不具合
    if (!OFFLINE) ng += r.blocked.length;
  }
  console.log(`\n合計 NG: ${ng}件`);
  process.exit(ng ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(2); });
