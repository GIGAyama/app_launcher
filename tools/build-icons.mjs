#!/usr/bin/env node
// ============================================================================
// アイコンを作り直す（§2-6）
//
// icon.png は 512×512 のフルカラーで 124KB あった。
// 拡張機能が使うのは 16 / 48 / 128 の3枚で、512 のまま置いておく理由はない。
// 色数の少ない絵はパレット PNG にすれば桁違いに軽くなる。
//
// ⚠️ sharp を通して書き直すとパレットが落ちることがあるので、
//    作ったバッファをそのまま書く（再エンコードしない）。
//
//   node tools/build-icons.mjs
// ============================================================================

import { writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/icon-source.png');
const OUT = path.join(ROOT, 'icons');

if (!existsSync(SRC)) {
  console.error('tools/icon-source.png が見つかりません');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const SIZES = [16, 48, 128];
const rows = [];

for (const size of SIZES) {
  // 色数を落としながら、いちばん軽くなった版を選ぶ
  let best = null;
  for (const colours of [16, 32, 64, 128, 256]) {
    const buf = await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, colours, effort: 10, compressionLevel: 9 })
      .toBuffer();
    if (!best || buf.length < best.buf.length) best = { buf, colours };
  }
  const dest = path.join(OUT, `icon-${size}.png`);
  writeFileSync(dest, best.buf);
  rows.push({ file: `icons/icon-${size}.png`, size, bytes: best.buf.length, colours: best.colours });
}

const before = statSync(SRC).size;
const after = rows.reduce((n, r) => n + r.bytes, 0);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

console.log('| ファイル | 色数 | サイズ |');
console.log('|---|---:|---:|');
for (const r of rows) console.log(`| ${r.file} | ${r.colours} | ${kb(r.bytes)} |`);
console.log(`\ntools/icon-source.png（原本・512×512）: ${kb(before)}`);
console.log(`生成した3枚の合計       : ${kb(after)}`);
console.log(`削減                    : ${kb(before - after)} (${((1 - after / before) * 100).toFixed(1)}%)`);
