// ============================================================================
// URL まわりの判断。ここは画面に触らない純粋な処理だけを置く。
// テストから直接呼べるようにするため、popup.js から切り出してある。
// ============================================================================

// 開く先は http/https だけに限る。
// 設定ファイルは先生どうしで配られるものなので、中身は「他人が書いたもの」
// として扱う。javascript: が混ざったまま window.open に渡すと、
// 拡張機能の権限で任意のコードが動いてしまう。
export const SAFE_PROTOCOLS = ['http:', 'https:'];

export const safeUrl = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return SAFE_PROTOCOLS.includes(u.protocol) ? u.href : null;
  } catch { return null; }
};

// アイコンは表示するだけなので、同梱の絵と data: も許す
export const safeIconUrl = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const v = raw.trim();
  if (v.startsWith('icons/') || v.startsWith('data:image/')) return v;
  return safeUrl(v) || '';
};

// Googleドライブの画像URLを、直接表示できる形式に変換する
export const formatIconUrl = (url) => {
  if (!url) return '';

  // 1. 「drive.google.com/file/d/XXXXXX/view」などの形式を見つけて変換
  let driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;

  // 2. 「drive.google.com/open?id=XXXXXX」の形式
  driveMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;

  // 3. 古い「drive.google.com/uc?id=XXXXXX」などの形式（先生が使っていたもの）
  driveMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;

  return url; // ドライブのURLじゃなければそのまま返す
};

// 既定の9個のアイコンは ssl.gstatic.com から取っている。
// 学校のフィルタリングで塞がれると9枚とも「壊れた画像」になり、
// 児童からはアプリ自体が壊れたようにしか見えない。
// URL から宛先を見分けて、拡張機能に同梱した SVG を代わりに出す。
// （すでに同期済みの設定にも効くよう、保存データではなく URL から判定する）
const FALLBACKS = [
  [/^https?:\/\/classroom\.google\.com/, 'icons/fb-classroom.svg'],
  [/^https?:\/\/drive\.google\.com/, 'icons/fb-drive.svg'],
  [/^https?:\/\/docs\.google\.com\/presentation/, 'icons/fb-slides.svg'],
  [/^https?:\/\/docs\.google\.com\/spreadsheets/, 'icons/fb-sheets.svg'],
  [/^https?:\/\/docs\.google\.com\/forms/, 'icons/fb-forms.svg'],
  [/^https?:\/\/docs\.google\.com/, 'icons/fb-docs.svg'],
  [/^https?:\/\/meet\.google\.com/, 'icons/fb-meet.svg'],
  [/^https?:\/\/calendar\.google\.com/, 'icons/fb-calendar.svg'],
  [/^https?:\/\/translate\.google\.com/, 'icons/fb-translate.svg']
];

export const fallbackIconFor = (url) => {
  for (const [re, file] of FALLBACKS) if (re.test(url || '')) return file;
  return 'icons/fb-generic.svg';
};

// 読み込む設定ファイルは、先生から先生へ配られる「他人が書いたもの」。
// 中身をそのまま信じず、必要な項目だけを取り出して形を整える。
export const sanitizeImported = (raw, now = Date.now()) => {
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const url = safeUrl(entry.url);
    if (!url) return;                       // http/https 以外は捨てる
    const name = typeof entry.name === 'string' && entry.name.trim()
      ? entry.name.trim().slice(0, 60) : url;
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `custom_${now}_${i}`,
      name,
      url,
      icon: safeIconUrl(entry.icon),
      isCustom: entry.isCustom !== false
    });
  });
  return out.length ? out : null;
};

// 埋め込み元のオリジンとして受け入れてよい形。
// content.js は Google のページでしか動かないので、そこだけを通す。
export const GOOGLE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*google\.(com|co\.jp)$/;
export const embedderOriginFromHash = (hash) => {
  const m = String(hash || '').match(/[#&]embed=([^&]+)/);
  if (!m) return null;
  let origin;
  try { origin = decodeURIComponent(m[1]); } catch { return null; }
  return GOOGLE_ORIGIN.test(origin) ? origin : null;
};
