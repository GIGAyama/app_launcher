// ============================================================================
// ESLint 設定
//
// no-undef を必ず通すこと。
// ファイルを分けたあとの import 漏れは、ビルドも静的な目視も通過して
// 実行時にだけ落ちる。児童が押した瞬間に何も起きない、という形で出る。
// ============================================================================

const browser = {
  window: 'readonly', document: 'readonly', location: 'readonly', navigator: 'readonly',
  console: 'readonly', fetch: 'readonly', URL: 'readonly', Event: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  FileReader: 'readonly', MutationObserver: 'readonly', ResizeObserver: 'readonly',
  matchMedia: 'readonly', getComputedStyle: 'readonly', confirm: 'readonly',
  requestAnimationFrame: 'readonly', HTMLElement: 'readonly', Image: 'readonly',
};

export default [
  {
    // 拡張機能として配る側のコード
    files: ['popup.js', 'background.js', 'content.js', 'lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browser, chrome: 'readonly', self: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-implicit-globals': 'error',
      // 拡張機能ページでは CSP に阻まれて動かない書き方を禁じる
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // content.js だけは module にできない（content script の制約）
    files: ['content.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-implicit-globals': 'off' },
  },
  {
    // background.js は Service Worker として動く
    files: ['background.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-implicit-globals': 'off' },
  },
  {
    // 開発用の道具（配布物には入らない）
    files: ['tools/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browser, process: 'readonly', chrome: 'readonly', NodeFilter: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  { ignores: ['node_modules/**', 'dist/**'] },
];
