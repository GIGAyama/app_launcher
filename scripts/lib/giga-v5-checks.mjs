// ============================================================================
// GIGA Standard v5 Part I の検査（D型・Chrome拡張 MV3 向け）
//
// 正本（scripts/lib/project-quality.mjs）とは分けてある。
// 正本が更新されたとき、丸ごと差し替えで受けられるようにするため。
//
// 【判定する前に必ずコメントを落とす】
// このリポジトリのコードには
//   「⚠️ onerror= 属性は CSP に阻まれて実行されない」
// という注意書きがある。素朴に正規表現を当てると、
// 注意書きそのものを違反として数えてしまう。
// 実際、共通の検査で同じ形の誤検知が過去に3件見つかっている。
// ============================================================================

export const stripJsComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

export const stripCssComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

export const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, '');

const finding = (id, file, message) => ({ id, file, message });

// --- 各検査 -----------------------------------------------------------------
// files: { path: { text, bytes, lines } } の形で受け取る。
// 「ファイルを読む」処理を外に出しておくと、わざと壊した中身を
// そのまま渡して検査が本当に反応するかを確かめられる。

export const CHECKS = [
  {
    id: 'LEGAL_FILES',
    title: '法務ファイルが揃っている',
    run: (files) => ['LICENSE', '.gitignore', '.github/dependabot.yml']
      .filter(f => !files[f])
      .map(f => finding('LEGAL_FILES', f, 'が無い')),
  },

  {
    id: 'INLINE_EVENT_HANDLER',
    title: 'インラインのイベント属性を使っていない',
    // MV3 の拡張機能ページでは script-src 'self' が効いており、
    // onclick= / onerror= は一切実行されない。書いても黙って効かない。
    run: (files) => {
      const out = [];
      for (const [path, f] of Object.entries(files)) {
        if (!/\.(html|js)$/.test(path)) continue;
        const text = path.endsWith('.html')
          ? stripHtmlComments(f.text) : stripJsComments(f.text);
        // 属性として書かれている形だけを見る（addEventListener('error') は対象外）
        const re = /<[^>]*\son(click|error|load|change|submit|input|focus|blur)\s*=/gi;
        if (re.test(text)) out.push(finding('INLINE_EVENT_HANDLER', path,
          'インラインのイベント属性がある。CSP に阻まれて実行されない'));
        const tpl = /\.(setAttribute\(\s*['"]on\w+|outerHTML\s*=)/g;
        if (tpl.test(text)) out.push(finding('INLINE_EVENT_HANDLER', path,
          '属性としてイベントを付けている'));
      }
      return out;
    },
  },

  {
    id: 'INNERHTML_INTERPOLATION',
    title: '外から来る文字を innerHTML に流し込んでいない',
    run: (files) => {
      const out = [];
      for (const [path, f] of Object.entries(files)) {
        if (!path.endsWith('.js')) continue;
        const text = stripJsComments(f.text);
        // 差し込み（`${...}` や + 連結）を伴う innerHTML だけを咎める。
        // 固定の文字列を入れる分には害がない。
        if (/innerHTML\s*=\s*[`'"][^`'"]*\$\{/.test(text) ||
            /innerHTML\s*[+]?=\s*[^;]*\+\s*\w/.test(text)) {
          out.push(finding('INNERHTML_INTERPOLATION', path,
            'innerHTML に変数を差し込んでいる。textContent で組み立てること'));
        }
      }
      return out;
    },
  },

  {
    id: 'POSTMESSAGE_STAR',
    title: 'postMessage の宛先が * でない',
    run: (files) => Object.entries(files)
      .filter(([p]) => p.endsWith('.js'))
      .filter(([, f]) => /postMessage\s*\([^)]*,\s*['"]\*['"]\s*\)/.test(stripJsComments(f.text)))
      .map(([p]) => finding('POSTMESSAGE_STAR', p, "postMessage の宛先が '*' になっている")),
  },

  {
    id: 'STORAGE_WIPE',
    title: '保存領域を丸ごと消していない',
    // localStorage.clear() / chrome.storage.*.clear() は
    // 他の機能や他アプリの記録まで巻き添えにする。
    run: (files) => Object.entries(files)
      .filter(([p]) => p.endsWith('.js'))
      .filter(([, f]) => /(localStorage\.clear\s*\(|chrome\.storage\.\w+\.clear\s*\()/.test(stripJsComments(f.text)))
      .map(([p]) => finding('STORAGE_WIPE', p, '保存領域を丸ごと消している')),
  },

  {
    id: 'CSP_DECLARED',
    title: 'CSP を明記し、unsafe-inline を足していない',
    run: (files) => {
      const m = files['manifest.json'];
      if (!m) return [finding('CSP_DECLARED', 'manifest.json', 'が無い')];
      let json;
      try { json = JSON.parse(m.text); } catch { return [finding('CSP_DECLARED', 'manifest.json', 'が JSON として読めない')]; }
      const csp = json.content_security_policy && json.content_security_policy.extension_pages;
      if (!csp) return [finding('CSP_DECLARED', 'manifest.json', 'content_security_policy.extension_pages が無い')];
      const out = [];
      if (csp.includes("'unsafe-inline'")) out.push(finding('CSP_DECLARED', 'manifest.json', "'unsafe-inline' を足している"));
      if (csp.includes("'unsafe-eval'")) out.push(finding('CSP_DECLARED', 'manifest.json', "'unsafe-eval' を足している"));
      for (const d of ['script-src', 'object-src', 'style-src', 'img-src']) {
        if (!csp.includes(d)) out.push(finding('CSP_DECLARED', 'manifest.json', `${d} が無い`));
      }
      return out;
    },
  },

  {
    id: 'CDN_EXECUTABLE',
    title: 'CDN から実行コードを取っていない',
    // 学校のフィルタリングで1本でも塞がれると画面が出なくなる。
    run: (files) => {
      const out = [];
      for (const [path, f] of Object.entries(files)) {
        if (!/\.(html|css)$/.test(path)) continue;
        const text = path.endsWith('.html') ? stripHtmlComments(f.text) : stripCssComments(f.text);
        if (/<script[^>]+src\s*=\s*['"]https?:\/\//i.test(text)) {
          out.push(finding('CDN_EXECUTABLE', path, '外部から script を読んでいる'));
        }
        if (/@import\s+url\(\s*['"]?https?:\/\//i.test(text)) {
          out.push(finding('CDN_EXECUTABLE', path, '外部の CSS を @import している'));
        }
        if (/babel\/standalone|cdn\.tailwindcss\.com/i.test(text)) {
          out.push(finding('CDN_EXECUTABLE', path, 'ブラウザ内コンパイルを使っている'));
        }
      }
      return out;
    },
  },

  {
    id: 'VIEWPORT',
    title: 'viewport が正しく、拡大を禁止していない',
    run: (files) => {
      const out = [];
      for (const [path, f] of Object.entries(files)) {
        if (!path.endsWith('.html')) continue;
        const text = stripHtmlComments(f.text);
        const m = text.match(/<meta[^>]+name=["']viewport["'][^>]*>/i);
        if (!m) { out.push(finding('VIEWPORT', path, 'viewport の指定が無い')); continue; }
        if (!/viewport-fit\s*=\s*cover/i.test(m[0])) {
          out.push(finding('VIEWPORT', path, 'viewport-fit=cover が無い'));
        }
        if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(m[0])) {
          out.push(finding('VIEWPORT', path, '拡大を禁止している。見えづらい子が拡大できなくなる'));
        }
      }
      return out;
    },
  },

  {
    id: 'VIEWPORT_100VH',
    title: '100vh を単独で使っていない',
    // ⚠️ @supports not (height: 100dvh) { … 100vh } は正しい書き方。
    //    その行だけを見ると誤検知する。前方も見ること。
    run: (files) => {
      const out = [];
      for (const [path, f] of Object.entries(files)) {
        if (!/\.(css|html)$/.test(path)) continue;
        const text = stripCssComments(f.text);
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (!/\b\d*100vh\b/.test(line)) return;
          const before = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
          if (/@supports\s+not\s*\(\s*height:\s*100dvh/.test(before)) return; // 正しいフォールバック
          if (/100dvh/.test(line)) return;
          out.push(finding('VIEWPORT_100VH', `${path}:${i + 1}`, '100vh を単独で使っている'));
        });
      }
      return out;
    },
  },

  {
    id: 'REDUCED_MOTION',
    title: 'prefers-reduced-motion があり、0 ではなく .01ms である',
    run: (files) => {
      const out = [];
      const css = Object.entries(files).filter(([p]) => p.endsWith('.css'));
      if (!css.length) return out;
      const hit = css.filter(([, f]) => /prefers-reduced-motion/.test(stripCssComments(f.text)));
      if (!hit.length) return [finding('REDUCED_MOTION', css[0][0], 'prefers-reduced-motion に対応していない')];
      for (const [path, f] of hit) {
        const text = stripCssComments(f.text);
        const block = text.slice(text.indexOf('prefers-reduced-motion'));
        // 0 にすると animation-fill-mode: forwards が壊れ、
        // 「動きを止める」つもりが「中身を消す」ことになる。
        if (/animation-duration:\s*0m?s?\s*!/.test(block) || /transition-duration:\s*0m?s?\s*!/.test(block)) {
          out.push(finding('REDUCED_MOTION', path, '0 にしている。.01ms にすること'));
        }
        if (!/\.01ms/.test(block)) {
          out.push(finding('REDUCED_MOTION', path, '.01ms が見当たらない'));
        }
      }
      return out;
    },
  },

  {
    id: 'FORCED_COLORS',
    title: 'ハイコントラストモードに対応している',
    run: (files) => {
      const css = Object.entries(files).filter(([p]) => p.endsWith('.css'));
      if (!css.length) return [];
      return css.some(([, f]) => /forced-colors:\s*active/.test(stripCssComments(f.text)))
        ? [] : [finding('FORCED_COLORS', css[0][0], 'forced-colors に対応していない')];
    },
  },

  {
    id: 'RT_COLOR',
    title: 'ふりがな（rt）の色を決め打ちしていない',
    // 色のついた面の上でふりがなが読めなくなる。
    // ふりがなが要るのは低学年の児童＝いちばん読めなくて困る人である。
    run: (files) => Object.entries(files)
      .filter(([p]) => /\.(css|html)$/.test(p))
      .filter(([, f]) => /(^|[\s,>])rt\s*\{[^}]*color\s*:\s*(#|rgb|hsl)/m.test(stripCssComments(f.text)))
      .map(([p]) => finding('RT_COLOR', p, 'rt に色を決め打ちしている。inherit で継がせること')),
  },

  {
    id: 'IMAGE_SIZE',
    title: '同梱する画像が大きすぎない',
    run: (files, cfg) => Object.entries(files)
      .filter(([p, f]) => /\.(png|jpe?g|webp)$/i.test(p) && f.bytes > cfg.maxImageBytes)
      .map(([p, f]) => finding('IMAGE_SIZE', p,
        `${(f.bytes / 1024).toFixed(1)}KB（上限 ${(cfg.maxImageBytes / 1024).toFixed(0)}KB）`)),
  },

  {
    id: 'FILE_SIZE',
    title: '1ファイルが大きすぎない',
    run: (files, cfg) => Object.entries(files)
      .filter(([p]) => /\.(js|css|html)$/.test(p))
      .filter(([, f]) => f.lines > cfg.maxFileLines || f.bytes > cfg.maxFileBytes)
      .map(([p, f]) => finding('FILE_SIZE', p, `${f.lines}行 / ${(f.bytes / 1024).toFixed(1)}KB`)),
  },

  {
    id: 'PERMISSIONS',
    title: '権限と公開範囲が広すぎない',
    run: (files) => {
      const m = files['manifest.json'];
      if (!m) return [];
      let json; try { json = JSON.parse(m.text); } catch { return []; }
      const out = [];
      for (const h of json.host_permissions || []) {
        if (h === '<all_urls>' || h === '*://*/*') {
          out.push(finding('PERMISSIONS', 'manifest.json', `host_permissions が ${h} と広すぎる`));
        }
      }
      for (const war of json.web_accessible_resources || []) {
        if (!war.matches || war.matches.some(x => x === '<all_urls>' || x === '*://*/*')) {
          out.push(finding('PERMISSIONS', 'manifest.json',
            'web_accessible_resources が全サイトへ公開されている'));
        }
      }
      return out;
    },
  },
];
