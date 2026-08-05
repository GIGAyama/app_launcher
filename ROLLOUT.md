# ロールアウト記録：`app_launcher`（GIGA portal）

- **型**：D型（Chrome拡張 Manifest V3）
- **実施**：2026-08-05 / GIGA Standard v5 `/rollout`
- **ブランチ**：`claude/rollout-fn257q`
- **結果**：P0 → P0.5 → P1 → P2 → P3 → P4 まで完了。品質ゲート 0件。

実測値と「測っていないもの」は [AUDIT.md](AUDIT.md) にある。

---

## ほかのリポジトリにも効く知見

### 1. 🆕 MV3 拡張では、インラインの `onerror=` / `onclick=` が黙って効かない

**このリポジトリでいちばん大きかった問題がこれ。**

MV3 の拡張機能ページには既定で `script-src 'self'` が効いている。
`manifest.json` に CSP を1行も書いていなくても効いている。
そのため次はどちらも**実行されない**。

```javascript
// ❌ 動かない。エラーも例外も出ない。ただ「何も起きない」
item.innerHTML = `<img src="${url}" onerror="this.src='fallback.png'">`;
```

```html
<!-- ❌ 動かない -->
<button onclick="initGame()">はじめる</button>
```

**書き方は正しく、構文も正しく、静的解析も通る。**
壊れていることは、実際に読み込ませないと分からない。

このリポジトリでは、この形で書かれた「アイコンの代替表示」が
**一度も動いたことがなかった。** その結果、
`ssl.gstatic.com` を塞いでいる学校では既定の9個が9枚とも空白だった。

**ほかの D型リポジトリで最初に見るべき1行：**

```bash
grep -rn "innerHTML" $(git ls-files '*.js') | grep -E "on(error|click|load|change)="
grep -rn "<[^>]* on[a-z]*=" $(git ls-files '*.html')
```

### 2. 🆕 「見た目だけの CDN」でも、代替が壊れていれば実行コードと同じ

v5 §1 は依存を「実行コード」と「見た目だけ」に分けている。
アイコン画像は後者に見えるが、**代替の仕組みが動かなければ前者と変わらない。**
児童からは「壊れている」としか見えず、原因はアプリの外にある。

判断の順序を1つ足すとよい。

1. 外部から取っているか
2. 取れなかったときに代わりが出るか
3. **その「代わり」は、実際に出ることを測ったか** ← ここが抜けやすい

### 3. 🆕 ダークモードの強調色に白文字を載せると必ず基準を割る

ダークの配色は明るいパステル（`#f28b82` / `#81c995` / `#8ab4f8`）になる。
そこに白を載せる指定がライトモードから残っていると、比が 2 前後まで落ちる。

このリポジトリでは 4件すべてがこの形で、しかも
**「保存しました」「正しい設定ファイルではありません」という、
いちばん困っている人に向けた文だった。**

**面と対になる文字色の変数を持つのが正しい。**

```css
:root { --error-color: #d93025; --on-accent: #ffffff; }
@media (prefers-color-scheme: dark) {
  :root { --error-color: #f28b82; --on-accent: #202124; }  /* 明るい面には黒側 */
}
.toast.error { background: var(--error-color); color: var(--on-accent); }
```

**横断で数えるなら：**

```bash
grep -rn "color:\s*#fff" $(git ls-files '*.css') | head
grep -l "prefers-color-scheme: dark" $(git ls-files '*.css')
```

### 4. 🆕 ホバーでしか出ない操作は、タッチ端末とキーボードから到達できない

`:hover` で出す編集・削除ボタンは、
**タッチの Chromebook・iPad からは一生出ない。** キーボードからも出ない。

```css
.tile:hover .actions,
.tile:focus-within .actions { display: flex; }   /* キーボード */
@media (hover: none) { .actions { display: flex; } }  /* タッチ端末 */
```

### 5. 🆕 44px の当たり判定は、隣と重ねてはいけない

§2-9 の疑似要素の手は正しいが、**ボタンが2つ並んでいる場所では
判定同士が重なる。** 「編集」を狙った指が「削除」に当たる。

28px のボタンなら、間を **16px** 空けると 44px の判定がちょうど隣り合う
（28 + 16 = 44 が中心間距離になる）。

### 6. 🆕 検査を書いたら、自分のコメントに反応していないか確かめる

「⚠️ `onerror=` 属性は CSP に阻まれて実行されない」という**注意書き**が、
`onerror=` を探す検査に引っかかった。
v5 §P4 の `SW_LOCALSTORAGE` の誤検知とまったく同じ形である。

**判定の前にコメントを落とす。** これは共通の検査すべてに要る。

もう1件、検査対象から `.github/**` を外していたせいで、
存在する `dependabot.yml` を「無い」と報告していた。
**除外の設定は、検査の内容と同じくらい間違えやすい。**

### 7. 拡張機能は headless では読み込めない — が、測れないわけではない

`chrome-headless-shell` では拡張機能を読み込めないが、
Playwright で `channel: 'chromium'` を指定すると新しい headless で動き、
**画面のあるサーバーが無くても実物として読み込ませられる。**

```javascript
await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
});
```

Service Worker が起きたかどうかが、**manifest が受理された証拠**になる。

また、`web_accessible_resources` の `matches` を確かめるには、
埋め込み元のオリジンがその条件を満たしている必要がある。
`about:blank` に貼って「入れなかった」と判定すると、
**設定が正しいのに壊れていると読み違える。**
`page.route()` で当該 URL の応答だけ差し替えるとよい。

### 8. 同じドメインを共有するアプリの前方一致は取り違える

`https://docs.google.com/` の前方一致は、スライドにもスプレッドシートにも当たる。
「ドキュメント」を押すとスライドのタブが前に出る、という迷子が起きていた。

**より長い宛先を持つ項目があれば、そちらに譲る。**
ランチャー・ブックマーク・タブ切り替えを持つリポジトリすべてに効く。

---

## このリポジトリで人間が決めること（未決）

1. `tabs` 権限を残したこと（迷子防止機能に必須。外すと壊れる）
2. `lib/` へのファイル分割（テストのために必要だった。停止条件によりマージは人間の判断）
3. 代替アイコンの絵柄（Google の公式ロゴではなく自前のグリフ）
4. `confirm()` を残したこと（吹き出しの中での挙動は未計測。壊れている証拠も無い）
5. `scripts/lib/project-quality.mjs`（共通の正本）をこのリポジトリに置くか

## 次に横断で回すとよいもの

上の 1〜3・8 は、ほかの D型リポジトリと、
ダークモードを持つ全リポジトリにそのまま当たる。

```bash
# 1) MV3 で効かないインラインのイベント属性
grep -rln "manifest_version" $(git ls-files '*/manifest.json') \
  | xargs -I{} dirname {} \
  | xargs -I{} sh -c 'grep -rln "on\(error\|click\|load\)=" {}/*.js {}/*.html 2>/dev/null'

# 3) ダークモードの強調色に白文字
grep -rn "color:\s*#fff" $(git ls-files '*.css')

# 4) ホバーでしか出ない操作
grep -rn ":hover .*{ *display: *\(flex\|block\)" $(git ls-files '*.css')
```
