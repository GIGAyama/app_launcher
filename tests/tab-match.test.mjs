import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findExistingTab } from '../lib/tab-match.js';

// 既定の並びのうち、同じドメインを共有するものだけを取り出したもの
const APPS = [
  { id: 'docs', url: 'https://docs.google.com/' },
  { id: 'slides', url: 'https://docs.google.com/presentation/' },
  { id: 'sheets', url: 'https://docs.google.com/spreadsheets/' },
  { id: 'drive', url: 'https://drive.google.com/' },
];
const app = (id) => APPS.find(a => a.id === id);

test('すでに開いているタブがあればそれを返す', () => {
  const tabs = [{ id: 1, url: 'https://drive.google.com/drive/my-drive' }];
  assert.equal(findExistingTab(tabs, app('drive'), APPS).id, 1);
});

test('「ドキュメント」がスライドのタブを掴まない', () => {
  // これがこの関数の存在理由。
  // https://docs.google.com/ の前方一致は、スライドの URL にも当たる。
  // 素直に一致させると「ドキュメント」を押したのにスライドが前に出る。
  const tabs = [{ id: 7, url: 'https://docs.google.com/presentation/d/xxx/edit' }];
  assert.equal(findExistingTab(tabs, app('docs'), APPS), null);
  assert.equal(findExistingTab(tabs, app('slides'), APPS).id, 7);
});

test('「ドキュメント」はドキュメントのタブなら掴む', () => {
  const tabs = [
    { id: 7, url: 'https://docs.google.com/presentation/d/xxx/edit' },
    { id: 8, url: 'https://docs.google.com/document/d/yyy/edit' },
  ];
  assert.equal(findExistingTab(tabs, app('docs'), APPS).id, 8);
});

test('スプレッドシートも同じように区別される', () => {
  const tabs = [{ id: 9, url: 'https://docs.google.com/spreadsheets/d/zzz/edit' }];
  assert.equal(findExistingTab(tabs, app('docs'), APPS), null);
  assert.equal(findExistingTab(tabs, app('sheets'), APPS).id, 9);
});

test('開いていなければ null（新しいタブを開く合図）', () => {
  assert.equal(findExistingTab([{ id: 1, url: 'https://example.com/' }], app('drive'), APPS), null);
  assert.equal(findExistingTab([], app('drive'), APPS), null);
});

test('URL が無い・壊れている場合に落ちない', () => {
  assert.equal(findExistingTab([{ id: 1 }], app('drive'), APPS), null);
  assert.equal(findExistingTab([{ id: 1, url: 'https://drive.google.com/' }], {}, APPS), null);
  assert.equal(findExistingTab(null, app('drive'), APPS), null);
  // 第3引数を省いても（比べる相手がいなくても）動く
  assert.equal(findExistingTab([{ id: 1, url: 'https://drive.google.com/x' }], app('drive')).id, 1);
});

test('クエリ付きのアプリURLは ? より前で見る', () => {
  const a = { id: 'q', url: 'https://example.com/search?q=1' };
  const tabs = [{ id: 3, url: 'https://example.com/search?q=99' }];
  assert.equal(findExistingTab(tabs, a, [a]).id, 3);
});
