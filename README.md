# 🚪 GIGA portal

GIGA portal（ギガ・ポータル）は、GIGAスクール構想の教育現場（小学生・教職員）に最適化された、Google純正風のChrome拡張機能ランチャーです。

「どこからアプリを開けばいいか分からない」「タブを何個も開いて迷子になってしまう」といった教育現場の課題を解決し、デジタルワークスペースをスッキリと整理します。

| | |
|---|---|
| 種別 | Chrome 拡張機能（Manifest V3） |
| バージョン | 3.1（`manifest.json`） |
| 動作要件 | Chrome / Chromebook **108 以上**（`minimum_chrome_version`） |
| 配布 | Chrome ウェブストア未公開。デベロッパーモードでフォルダから読み込み |
| 依存ライブラリ | なし（Vanilla JS・外部スクリプト0バイト） |

> **先生向けの使い方は [MANUAL.md](MANUAL.md) にあります。**
> **品質の実測値は [AUDIT.md](AUDIT.md) にあります。**
> **開発中に分かった横断的な知見は [ROLLOUT.md](ROLLOUT.md) にあります。**

## 📱 これは何をするものか

ツールバーのアイコン（またはショートカット）を押すと、**よく使う学習ツールのアイコンが並んだ小さな画面**が開きます。押すとそのアプリへ移動します。

初期状態では、次の **9個** が最初から入っています。

| アイコン | 開く先 |
|---|---|
| クラスルーム | `https://classroom.google.com/` |
| ドライブ | `https://drive.google.com/` |
| ドキュメント | `https://docs.google.com/` |
| スライド | `https://docs.google.com/presentation/` |
| スプレッドシート | `https://docs.google.com/spreadsheets/` |
| フォーム | `https://docs.google.com/forms/` |
| Meet | `https://meet.google.com/` |
| カレンダー | `https://calendar.google.com/` |
| 翻訳 | `https://translate.google.com/` |

この9個は**削除も編集も並べ替えもできます**。学校で使うツール（デジタル教科書・自治体のポータル・ドリル教材など）を自由に足せます。

## ✨ 主な機能 (Features)

*   🎯 **スマートなタブ切り替え（迷子防止）**

    *   クリックしたアプリがすでにブラウザのどこかで開かれている場合、新しいタブを無駄に増やさず、そのタブへ自動的にフォーカスを移動します。別のウィンドウにあっても探しに行き、そのウィンドウ自体を手前に出します。
    *   判定は **URL の `?` より前の部分の前方一致**です。
    *   同じドメインを共有するアプリ（ドキュメント／スライド／スプレッドシート）は、より細かい宛先を持つほうを優先して判定します。`https://docs.google.com/` を押したときに、スライドのタブへ飛んでしまうことがありません。
    *   タブ操作に失敗した場合だけ、最後の手段として新しいタブで開きます。

*   🔵 **Google のページの「9つの点」ボタンを乗っ取る**

    *   `google.com` / `google.co.jp` のページ（Gmail・ドライブ・検索など）では、画面右上にある Google 標準のアプリランチャー（9つの点）を押すと、**Google のアプリ一覧ではなく GIGA portal が開きます。**
    *   ページの隅に小さな枠（iframe）として出ます。ページの外をクリックするか **Esc** で閉じます。
    *   Google のヘッダーは後から組み立てられるため、要素が現れるまで待ちます（最大 **15秒**）。それでも見つからなければ監視を打ち切ります。
    *   この差し替えが働くのは `google.com` と `google.co.jp` のページだけです。

*   🎨 **Google純正ライクなUI / ダークモード対応**

    *   Material Design 3に準拠し、Google Workspaceに完全に溶け込む洗練されたデザイン。OSのダークモード設定にも自動で追従します。
    *   Windows の「ハイコントラスト」（`forced-colors`）と「アニメーションを減らす」（`prefers-reduced-motion`）にも従います。
    *   拡大表示を禁止していません（`user-scalable=no` を書いていない）。押せるところはすべて 44px 四方以上の当たり判定を持ちます。

*   🔄 **直感的なドラッグ＆ドロップ**

    *   アプリアイコンをマウスで掴んで、自分の一番使いやすい順番に自由に並べ替えられます。キーボードだけの場合は Tab で選んでから **Alt+←/→** でも並べ替えられます（移動したことは読み上げ用のメッセージでも伝えます）。

*   ➕ **1クリックでアプリ追加＆編集**

    *   今見ているページを「右クリック」または「＋ボタン」から一発で追加可能。
        *   **＋ボタン**：今のタブの**タイトル・URL・ファビコン**をフォームに自動入力します（`chrome://` のページは対象外）。押す前に直せます。
        *   **右クリック**：確認画面を出さずにその場で追加し、**通知**で知らせます。アイコンはファビコン、無ければ Google のファビコン取得サービスを使います。
    *   標準の9個も含めて、編集・削除ができます（削除は確認ダイアログが出ます）。
    *   名前と URL は必須です。URL が `http` で始まっていなければ `https://` を補います。

*   🖼️ **Googleドライブ画像をアイコンにできる**

    *   アイコン URL 欄に Google ドライブの共有リンクを貼るだけで、表示できる形（`https://lh3.googleusercontent.com/d/<ID>`）へ自動変換します。対応する形は次の3つです。
        *   `drive.google.com/file/d/<ID>/view...`
        *   `drive.google.com/open?id=<ID>`
        *   `drive.google.com/uc?...id=<ID>`
    *   アイコン欄は省略できます。省略した場合は下記の同梱アイコンが出ます。

*   ☁️ **クラウド同期 (Sync)**

    *   Googleアカウントに紐づいて設定が保存されるため、使うChromebook（PC）が変わっても、いつもの自分専用ポータルがそのまま表示されます（`chrome.storage.sync` と端末内 `chrome.storage.local` の両方に書きます）。
    *   同期の容量を超えたときは、その端末に退避したうえで画面（または通知）に知らせます。**黙って失われることはありません。**

*   📁 **設定のエクスポート / インポート（先生向け）**

    *   自分が作った「最強のアプリ配置」を `giga_portal_settings.json` として書き出し、他の児童や先生のPCに一瞬で共有・反映させることができます。
    *   読み込むときは中身を検査し、**http/https 以外の URL を持つ項目は取り除きます。**除いた件数は画面に出ます。名前は 60 文字までに切り詰めます。
    *   読み込みは**今の配置を上書きします**（追加ではありません）。

*   🏫 **学校のネットワークに塞がれても動く**

    *   実行コードを外部から一切取りません（CDN依存 **0バイト**）。
    *   アイコン画像が届かない環境では、拡張機能に同梱した SVG を表示します。既定の9個には製品の色に合わせた専用の絵（`icons/fb-*.svg`）が、それ以外のアプリには汎用の絵（`icons/fb-generic.svg`）が出ます。判定は保存データではなく **URL** で行うため、すでに同期済みの設定にも効きます。

## 🌐 外部への通信について

**実行されるコードは 100% 同梱**ですが、**画像は外から取ります**。学校のフィルタリング方針を決めるときは次を参照してください。

| 宛先 | 何のため | 塞がれたとき |
|---|---|---|
| `ssl.gstatic.com` | 既定9個の公式アイコン画像 | 同梱の代替アイコンに切り替わる。動作に影響なし |
| `lh3.googleusercontent.com` | ドライブ共有リンクをアイコンにした場合の画像 | 代替アイコンに切り替わる |
| `www.google.com/s2/favicons` | 右クリック追加でファビコンが取れないときのアイコン取得 | 代替アイコンに切り替わる |
| 各サイトのファビコン | ＋ボタン追加時に自動入力された画像 | 代替アイコンに切り替わる |

アプリの一覧や利用状況を、GIGA portal の作者や第三者のサーバーへ送ることはありません（送信先のコードがそもそも存在しません）。

## 📦 ファイル構成

この拡張機能は、セキュリティとパフォーマンスに優れたManifest V3に準拠し、外部ライブラリを一切使用しないVanilla JSで構築されています。

```
GIGA-portal/
├── manifest.json          # 拡張機能の設定ファイル (Manifest V3・CSP を明記)
├── popup.html             # ランチャーのメインUI
├── popup.css              # スタイルシート（ダークモード対応）
├── popup.js               # メインロジック（UI制御、データ保存、タブ制御）
├── background.js          # バックグラウンド処理（右クリックメニュー・通知）
├── content.js             # ページ内スクリプト（Googleアプリボタンの差し替え）
├── lib/
│   ├── url-safety.js      # URLの検査・設定ファイルの取り込み・代替アイコンの判定
│   └── tab-match.js       # 開いているタブ探し
├── icons/                 # 【生成物を含む】拡張機能アイコン(PNG) + 代替アイコン(SVG)
│
│   ── ここから下は配布物ではない ──
├── tools/                 # 実測・検証・アイコン生成の道具
├── scripts/               # 品質ゲート（GIGA Standard v5 §P4）
├── tests/                 # 中核ロジック（lib/）のテスト
├── quality.config.json    # 品質ゲートの基準値と対象外の宣言
├── eslint.config.js       # ESLint 設定
├── package.json           # 開発用の道具だけを持つ（配布物には入らない）
├── .github/workflows/     # CI（lint・テスト・ゲート・実測・自己検査）
├── AUDIT.md               # 監査結果（実測値・未計測の明示）
├── MANUAL.md              # 先生向けの使い方
└── ROLLOUT.md             # 他リポジトリにも効く知見
```

### 生成物と原本

| ファイル | 編集してよいか |
|---|---|
| `tools/icon-source.png` | **ここを直す**（アイコンの原本・512×512） |
| `icons/icon-16.png` / `icon-48.png` / `icon-128.png` | **手で編集しない**（生成物） |

**原本を直したら必ず `npm run build:icons` を走らせてから push すること。**

`icons/fb-*.svg`（代替アイコン）は生成物ではなく、直接編集してよい原本です。

## 🚀 インストール方法 (ローカルでの導入)

現在のところ、Chromeウェブストアでの公開前のため、デベロッパーモードを使用してインストールします。

1.  このリポジトリをZIPでダウンロードするか、`git clone` します。
2.  Google Chromeを開き、アドレスバーに `chrome://extensions/` と入力して拡張機能管理画面を開きます。
3.  画面右上の **「デベロッパーモード」** をON（青色）にします。
4.  左上に表示される **「パッケージ化されていない拡張機能を読み込む」** をクリックします。
5.  ダウンロード（またはクローン）した `GIGA-portal` フォルダを選択します。
6.  ブラウザのツールバーにアイコンが追加されたら導入完了です！ピン留めしておくと便利です。

`npm install` は**導入には要りません**（開発用の道具だけです）。配布物は上の「ファイル構成」の上半分だけです。

## 📖 使い方

*   **起動:** 次の3つのどれでも開きます。
    *   ツールバーのアイコンをクリック
    *   キーボードショートカット `Ctrl+Shift+L`（Mac は `Command+Shift+L`）
        ※ これは**既定の割り当て**です。ほかの拡張機能と衝突すると割り当てられないことがあります。`chrome://extensions/shortcuts` で確認・変更できます。
    *   Google のページ右上の **9つの点のボタン**
*   **追加:** ランチャー下部の「＋新しいアプリを追加」をクリックするか、追加したいWebページ上で右クリックし、「このページをGIGA portalに追加」を選択します。
*   **編集/削除:** アプリのアイコンにマウスを乗せる（またはTabキーで選ぶ）と表示される「鉛筆マーク（編集）」または「×マーク（削除）」をクリックします。タッチ端末では常に表示されます。
*   **並べ替え:** アプリアイコンをドラッグ＆ドロップして好きな位置に移動します。キーボードでは Alt+←/→ です。
*   **設定の共有:** ヘッダー右上の歯車アイコンから、設定ファイルのエクスポート/インポートが可能です。
*   **初期化:** 歯車 →「初期状態（デフォルト9個）に戻す」。確認ダイアログが出ます。
*   **戻る:** 追加画面・設定画面はどちらも **Esc** で一覧へ戻ります。

## 🛠️ 技術スタック

*   **HTML5 / CSS3** (Material Design 3 ベース, Custom Properties活用)
*   **JavaScript (ES6+)** / Vanilla JS / ES Modules
*   **Chrome Extensions API** (Manifest V3)
    *   `chrome.storage.sync` / `local`
    *   `chrome.tabs` / `chrome.windows`
    *   `chrome.contextMenus`
    *   `chrome.notifications`

## 🔐 セキュリティ設計

*   **CSP を `manifest.json` に明記**
    （`script-src 'self'; object-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'none'`）。
    `'unsafe-inline'` は足していません。そのため
    **インラインの `onclick=` / `onerror=` は一切使えません。**
    DOM を組み立てるときは必ず `addEventListener` を使ってください。
*   **外から来る文字列は `textContent` で扱います。**
    アプリ名はページのタイトルや、先生が配る設定ファイルから来ます。
*   **開く先は http/https のみ**（`lib/url-safety.js`）。
    取り込んだ設定ファイルの中身も同じ検査を通します。
    アイコンだけは表示専用のため `icons/`（同梱）と `data:image/` も許します。
*   **`postMessage` の宛先を `*` にしません。**
    埋め込み元のオリジンを iframe の URL（`#embed=`）で受け渡し、そこだけに送ります。
    受け取る側も `e.origin`（拡張機能のオリジン）と `e.source`（その iframe 自身）を確かめます。
    渡されたオリジンも `https://(*.)google.com|google.co.jp` の形だけを受け入れます。
*   **`web_accessible_resources` は `popup.html` のみ**を
    `*.google.com` / `*.google.co.jp` に限定して公開します。

> **`frame-ancestors` について。** 拡張機能ページへの埋め込み制限は
> `web_accessible_resources` の `matches` で行っています。
> HTTP ヘッダーとしての `frame-ancestors` は拡張機能では設定できません。

### 権限について

| 権限 | 何に使うか |
|---|---|
| `storage` | アプリの一覧と並び順の保存（同期 `sync`・端末内 `local`） |
| `tabs` | **開いているタブを探して切り替えるため**と、＋ボタンで今のページを自動入力するため。URL を読みますが送信はしません |
| `contextMenus` | 右クリックメニュー「このページを GIGA portal に追加」 |
| `notifications` | 右クリックで追加できたこと（できなかったこと）の通知 |

`host_permissions` は要求しません。ページ内で動くのは `google.com` / `google.co.jp` の content script だけです。

## 🧪 開発

```bash
npm install                # 開発用の道具（配布物には入りません）

npm run check              # ESLint → テスト → 品質ゲート（CI と同じ順）
npm run lint               # ESLint 単体
npm test                   # tests/*.test.mjs（lib/ の中核ロジック）
npm run gate               # 品質ゲート単体
npm run verify             # 実物の Chrome に読み込ませて確かめる
npm run measure            # 実ブラウザで表示を測る（学校のフィルタリングを再現）
npm run measure -- --all   # 通っているものも比の低い順に出す
npm run measure:online     # 外部への取得を許して測る
npm run build:icons        # tools/icon-source.png から icons/*.png を作り直す
```

`npm run verify` が確かめること … Chrome が manifest を受け付けるか／Service Worker が起きるか／`popup.html` に JS エラー・CSP違反が出ないか／同梱アイコンが読めるか／右クリックメニューが作られるか。

`npm run measure` が測ること … コントラスト比・タップ領域 44px（疑似要素の当たり判定を含む）・CSP違反と JS エラー・320px 幅での横スクロール。

### 「0件でした」を信じないための仕組み

`npm run measure:selftest` と `npm run gate:selftest` は、
**わざと壊した中身を検査に食わせ、ちゃんと捕まることを確かめます。**

0件という数字は、基準を満たしている場合にも、検査が何も見ていない場合にも出ます。
CI では毎回この確認を行っており、失敗すればビルドを落とします。

### 制限と注意

*   `chrome.storage.sync` の上限は、**拡張機能あたり全体 100KB・1項目 8KB** です。
    アイコンに極端に長い data URL を入れると、すぐに届きます。
*   `content.js` は ES Modules を使えません（content script の制約）。
    `lib/` を import できるのは `popup.js` だけです。
    `background.js` も同じ理由で（`type: "module"` を宣言していないため）import できません。
*   検証は Linux 上の Chromium で行っています。
    **実機の Chromebook・iPad での確認は別途必要です**（[AUDIT.md](AUDIT.md) 参照）。

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) のもとで公開されています。教育現場等での改変・再配布も自由に行っていただけます。

*Developed with ❤️ for GIGA School Program*

## プライバシーポリシー

[PRIVACY.md](PRIVACY.md) をご覧ください。この拡張機能は利用者の情報を収集も送信もしません。
