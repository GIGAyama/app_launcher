#!/usr/bin/env node
// ============================================================================
// 品質ゲート
//
// 構成は GIGA Standard v5 §P4 の形に合わせてある。
//   scripts/lib/project-quality.mjs … 全リポジトリ共通の正本（あれば読む）
//   scripts/lib/giga-v5-checks.mjs  … Part I の検査（このリポジトリの型に合わせたもの）
//   scripts/check-project.mjs       … 両者を合成する ← これ
// 正本の更新を丸ごと差し替えで受けられるよう、混ぜずに分けている。
//
// 使い方:
//   node scripts/check-project.mjs
//   node scripts/check-project.mjs --selftest   ← 検査自身が動いているかを確かめる
//
// 【--selftest がなぜ必要か】
// 「0件でした」は、基準を満たしている場合にも、検査が何も見ていない場合にも出る。
// わざと壊した中身を各検査に食わせ、ちゃんと反応することを確かめる。
// 実際、この確認をしたことで検査そのものの不具合が見つかっている。
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CHECKS } from './lib/giga-v5-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--selftest');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'quality.config.json'), 'utf8'));

const TEXT = /\.(js|mjs|css|html|json|md|yml)$/;

// git が知っているファイルだけを見る。
// node_modules や作業中の一時ファイルを数えても意味がない。
const listFiles = () => {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const ignore = (cfg.ignore || []).map(g => new RegExp('^' + g.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')));
  const files = {};
  for (const rel of out) {
    if (ignore.some(re => re.test(rel))) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const bytes = fs.statSync(abs).size;
    const text = TEXT.test(rel) ? fs.readFileSync(abs, 'utf8') : '';
    files[rel] = { text, bytes, lines: text ? text.split('\n').length : 0 };
  }
  return files;
};

// 共通の正本があれば合成する。無い環境でもゲート自体は動くようにしておく。
const loadShared = async () => {
  const p = path.join(ROOT, 'scripts/lib/project-quality.mjs');
  if (!fs.existsSync(p)) return null;
  const mod = await import(p);
  return mod.CHECKS || null;
};

const run = (checks, files) => {
  const findings = [];
  for (const c of checks) {
    let got = [];
    try { got = c.run(files, cfg) || []; }
    catch (e) { got = [{ id: c.id, file: '(検査自身)', message: '例外: ' + e.message }]; }
    findings.push(...got);
  }
  return findings;
};

// --- わざと壊す。各検査がその形を捕まえられるかを見る -----------------------
const BREAKAGE = {
  LEGAL_FILES: (f) => { delete f['LICENSE']; },
  INLINE_EVENT_HANDLER: (f) => { f['popup.js'] = { text: 'el.innerHTML = "<img src=x onerror=\'y()\'>";', bytes: 40, lines: 1 }; },
  INNERHTML_INTERPOLATION: (f) => { f['popup.js'] = { text: 'el.innerHTML = `<b>${app.name}</b>`;', bytes: 30, lines: 1 }; },
  POSTMESSAGE_STAR: (f) => { f['popup.js'] = { text: "window.parent.postMessage({a:1}, '*');", bytes: 30, lines: 1 }; },
  STORAGE_WIPE: (f) => { f['popup.js'] = { text: 'localStorage.clear();', bytes: 20, lines: 1 }; },
  CSP_DECLARED: (f) => {
    const j = JSON.parse(f['manifest.json'].text);
    j.content_security_policy.extension_pages = "script-src 'self' 'unsafe-inline'; object-src 'self'; style-src 'self'; img-src 'self'";
    f['manifest.json'] = { text: JSON.stringify(j), bytes: 100, lines: 1 };
  },
  CDN_EXECUTABLE: (f) => { f['popup.html'] = { text: '<script src="https://unpkg.com/react"></script>', bytes: 40, lines: 1 }; },
  VIEWPORT: (f) => { f['popup.html'] = { text: '<meta name="viewport" content="width=device-width, user-scalable=no">', bytes: 60, lines: 1 }; },
  VIEWPORT_100VH: (f) => { f['popup.css'] = { text: '.a { height: 100vh; }', bytes: 20, lines: 1 }; },
  REDUCED_MOTION: (f) => { f['popup.css'] = { text: '@media (prefers-reduced-motion: reduce) { * { animation-duration: 0s !important; } }', bytes: 80, lines: 1 }; },
  FORCED_COLORS: (f) => { f['popup.css'] = { text: '.a { color: red; }', bytes: 20, lines: 1 }; },
  RT_COLOR: (f) => { f['popup.css'] = { text: 'rt { color: #666; }', bytes: 20, lines: 1 }; },
  IMAGE_SIZE: (f) => { f['icons/huge.png'] = { text: '', bytes: 900 * 1024, lines: 0 }; },
  FILE_SIZE: (f) => { f['popup.js'] = { text: 'x\n'.repeat(6000), bytes: 12000, lines: 6001 }; },
  PERMISSIONS: (f) => {
    const j = JSON.parse(f['manifest.json'].text);
    j.web_accessible_resources = [{ resources: ['popup.html'], matches: ['<all_urls>'] }];
    f['manifest.json'] = { text: JSON.stringify(j), bytes: 100, lines: 1 };
  },
};

const selftest = (checks, baseFiles) => {
  console.log('検査自身の確認（わざと壊して、捕まえられるかを見る）\n');
  let bad = 0;
  for (const c of checks) {
    const breaker = BREAKAGE[c.id];
    if (!breaker) {
      console.log(`  ? ${c.id} … 壊し方が用意されていない`);
      bad++; continue;
    }
    const files = JSON.parse(JSON.stringify(baseFiles));
    breaker(files);
    const got = run([c], files);
    const caught = got.length > 0;
    console.log(`  ${caught ? '✓' : '✗'} ${c.id} … ${caught ? `${got.length}件を検出` : '壊したのに検出できない'}`);
    if (!caught) bad++;
  }
  console.log(bad ? `\n検査そのものが機能していない: ${bad}件` : '\nすべての検査が反応した');
  return bad;
};

// --- 実行 -------------------------------------------------------------------
const files = listFiles();
const shared = await loadShared();
const checks = [...(shared || []), ...CHECKS];

if (!shared) {
  console.log('※ scripts/lib/project-quality.mjs（全リポジトリ共通の正本）が無いため、');
  console.log('  Part I の検査だけを実行する。正本を置けば自動で合成される。\n');
}

if (SELFTEST) {
  process.exit(selftest(checks, files) ? 1 : 0);
}

console.log(`品質ゲート — ${cfg.typeLabel}（${Object.keys(files).length}ファイル）\n`);
const findings = run(checks, files);
const byId = new Map();
for (const f of findings) {
  if (!byId.has(f.id)) byId.set(f.id, []);
  byId.get(f.id).push(f);
}
for (const c of checks) {
  const got = byId.get(c.id) || [];
  console.log(`  ${got.length ? '✗' : '✓'} ${c.id}  ${c.title}`);
  for (const g of got) console.log(`      - ${g.file}: ${g.message}`);
}

const na = Object.entries(cfg.notApplicable || {});
if (na.length) {
  console.log('\n  この型では当てはまらない項目（「未計測」ではなく「対象外」）:');
  for (const [k, why] of na) console.log(`    - ${k}: ${why}`);
}

console.log(findings.length ? `\n違反 ${findings.length}件` : '\n違反 0件');
process.exit(findings.length ? 1 : 0);
