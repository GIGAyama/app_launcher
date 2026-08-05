import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeUrl, safeIconUrl, formatIconUrl, fallbackIconFor,
  sanitizeImported, embedderOriginFromHash
} from '../lib/url-safety.js';

test('開ける宛先は http と https だけ', () => {
  assert.equal(safeUrl('https://example.com/'), 'https://example.com/');
  assert.equal(safeUrl('  http://example.com/a  '), 'http://example.com/a');
  // 設定ファイルは先生どうしで配られる。ここを通すと拡張機能の権限で
  // 任意のコードが動いてしまうので、必ず弾く。
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('JavaScript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>x</script>'), null);
  assert.equal(safeUrl('chrome://settings'), null);
  assert.equal(safeUrl('file:///etc/passwd'), null);
  assert.equal(safeUrl(''), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl('ただの文字列'), null);
});

test('アイコンは同梱の絵と data:image も許す', () => {
  assert.equal(safeIconUrl('icons/fb-docs.svg'), 'icons/fb-docs.svg');
  assert.equal(safeIconUrl('data:image/svg+xml;utf8,<svg/>'), 'data:image/svg+xml;utf8,<svg/>');
  assert.equal(safeIconUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(safeIconUrl('javascript:alert(1)'), '');
  assert.equal(safeIconUrl(undefined), '');
});

test('Googleドライブの共有リンクを表示できる形に直す', () => {
  const want = 'https://lh3.googleusercontent.com/d/ABC-123_xyz';
  assert.equal(formatIconUrl('https://drive.google.com/file/d/ABC-123_xyz/view?usp=sharing'), want);
  assert.equal(formatIconUrl('https://drive.google.com/open?id=ABC-123_xyz'), want);
  assert.equal(formatIconUrl('https://drive.google.com/uc?export=view&id=ABC-123_xyz'), want);
  // ドライブ以外はそのまま
  assert.equal(formatIconUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(formatIconUrl(''), '');
});

test('宛先ごとに正しい代替アイコンを選ぶ', () => {
  // より細かい宛先が先に当たること。docs.google.com の一括判定に
  // 飲み込まれると、スライドにドキュメントの絵が出る。
  assert.equal(fallbackIconFor('https://docs.google.com/presentation/'), 'icons/fb-slides.svg');
  assert.equal(fallbackIconFor('https://docs.google.com/spreadsheets/'), 'icons/fb-sheets.svg');
  assert.equal(fallbackIconFor('https://docs.google.com/forms/'), 'icons/fb-forms.svg');
  assert.equal(fallbackIconFor('https://docs.google.com/'), 'icons/fb-docs.svg');
  assert.equal(fallbackIconFor('https://classroom.google.com/'), 'icons/fb-classroom.svg');
  assert.equal(fallbackIconFor('https://meet.google.com/'), 'icons/fb-meet.svg');
  // 先生が自分で足したアプリ
  assert.equal(fallbackIconFor('https://kids.yahoo.co.jp/'), 'icons/fb-generic.svg');
  assert.equal(fallbackIconFor(undefined), 'icons/fb-generic.svg');
});

test('取り込む設定ファイルは中身を検査してから受ける', () => {
  const cleaned = sanitizeImported([
    { id: 'a', name: 'ヤフーキッズ', url: 'https://kids.yahoo.co.jp/', icon: '', isCustom: true },
    { id: 'b', name: 'わるいの', url: 'javascript:alert(1)' },        // 落とす
    { id: 'c', url: 'https://example.com/', icon: 'javascript:x' },  // icon だけ落とす
    null,                                                             // 落とす
    'ただの文字列',                                                    // 落とす
  ], 1700000000000);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].name, 'ヤフーキッズ');
  assert.equal(cleaned[1].icon, '');
  // 名前が無いときは URL を名前にする（空欄のタイルにしない）
  assert.equal(cleaned[1].name, 'https://example.com/');
  // 1件も残らなければ「正しい設定ファイルではありません」にする
  assert.equal(sanitizeImported([{ url: 'javascript:alert(1)' }]), null);
  assert.equal(sanitizeImported('配列ではない'), null);
  assert.equal(sanitizeImported(null), null);
});

test('名前は HTML として解釈させない形で保たれる', () => {
  // 取り込みの時点では消さない（表示側が textContent で組み立てる）。
  // ここで消してしまうと、記号を含む正しい名前まで壊れる。
  const cleaned = sanitizeImported([
    { url: 'https://example.com/', name: '<img src=x onerror=alert(1)>' }
  ]);
  assert.equal(cleaned[0].name, '<img src=x onerror=alert(1)>');
  // 長すぎる名前はタイルを壊すので切り詰める
  const long = sanitizeImported([{ url: 'https://example.com/', name: 'あ'.repeat(200) }]);
  assert.equal(long[0].name.length, 60);
});

test('埋め込み元として受け入れるのは Google のページだけ', () => {
  assert.equal(embedderOriginFromHash('#embed=https%3A%2F%2Fwww.google.com'), 'https://www.google.com');
  assert.equal(embedderOriginFromHash('#embed=https%3A%2F%2Fdocs.google.co.jp'), 'https://docs.google.co.jp');
  assert.equal(embedderOriginFromHash('#embed=https%3A%2F%2Fevil.example.com'), null);
  // google.com.evil.com のような紛らわしい宛先を通さない
  assert.equal(embedderOriginFromHash('#embed=https%3A%2F%2Fgoogle.com.evil.com'), null);
  assert.equal(embedderOriginFromHash('#embed=http%3A%2F%2Fwww.google.com'), null);   // http は不可
  assert.equal(embedderOriginFromHash(''), null);
  assert.equal(embedderOriginFromHash(undefined), null);
});
