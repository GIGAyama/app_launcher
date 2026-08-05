// Google のページに出ている「9つのドット」ボタンを、GIGA portal に差し替える。
//
// 【この scripts は Google のページの上で動く】
// ページ側のスクリプトと同じ窓を共有しているので、
// window に届くメッセージは「誰でも送れるもの」として扱う。

const EXTENSION_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
const IFRAME_ID = 'giga-launcher-iframe';

function initGoogleLauncherHijack() {
  // Googleの標準アプリランチャーボタンを探します（aria-labelが目印）
  const googleAppBtn = document.querySelector('[aria-label="Google アプリ"], [aria-label="Google apps"]');
  if (!googleAppBtn || document.getElementById(IFRAME_ID)) return;

  // 既存のボタンの動作を止めるため、そっくりなボタンを作って入れ替えます
  const cloneBtn = googleAppBtn.cloneNode(true);
  googleAppBtn.parentNode.replaceChild(cloneBtn, googleAppBtn);

  // GIGA portal を表示するための箱（iframe）を作ります。
  // 親のオリジンを #embed= で渡す。こうしておくと、中の画面が
  // 「閉じて」と伝えるときの宛先を '*' にしないで済む。
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup.html') + '#embed=' + encodeURIComponent(location.origin);
  iframe.id = IFRAME_ID;
  iframe.title = 'GIGA portal';
  // ページ側の CSS に巻き込まれないよう、見た目はここで直接指定する
  iframe.style.cssText = [
    'position:fixed',
    'top:60px',
    // 画面が狭いときに右端からはみ出さないようにする（下限 320px）
    'right:max(8px, env(safe-area-inset-right, 0px))',
    'width:min(360px, calc(100vw - 16px))',
    'height:min(500px, calc(100dvh - 80px))',
    'border:none',
    'border-radius:8px',
    'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
    'z-index:2147483647',
    'display:none',
    'background-color:#f8f9fa',
    'color-scheme:light dark'
  ].join(';');

  document.body.appendChild(iframe);

  const setOpen = (open) => {
    iframe.style.display = open ? 'block' : 'none';
    cloneBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) iframe.focus();
  };
  cloneBtn.setAttribute('aria-expanded', 'false');

  // 9つのドットボタンが押されたら、GIGA portal を表示/非表示にします
  cloneBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(iframe.style.display === 'none');
  });

  // 画面の他の場所をクリックしたら、スッと閉じるようにします
  document.addEventListener('click', (e) => {
    if (!cloneBtn.contains(e.target) && iframe.style.display === 'block') setOpen(false);
  });

  // Esc でも閉じられるようにする（キーボードだけで操作する場合のため）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && iframe.style.display === 'block') {
      setOpen(false);
      cloneBtn.focus();
    }
  });
}

// 拡張機能の中の画面（popup.js）から「閉じて」という連絡が来たら閉じる仕組み。
// ⚠️ 送り主を確かめる。確かめないと、ページに載っている任意のスクリプトが
//    同じ形のメッセージを投げるだけでランチャーを閉じられてしまう。
window.addEventListener('message', (e) => {
  const iframe = document.getElementById(IFRAME_ID);
  if (!iframe) return;
  if (e.origin !== EXTENSION_ORIGIN) return;          // 拡張機能のページ以外は無視
  if (e.source !== iframe.contentWindow) return;      // その iframe 自身以外は無視
  if (e.data && e.data.type === 'CLOSE_GIGA_LAUNCHER') {
    iframe.style.display = 'none';
  }
});

// Google のヘッダーは後から組み立てられるため、要素が現れるのを待つ。
// 固定の待ち時間だけだと、通信が遅い Chromebook では間に合わずに
// 差し替えが起きない（＝機能が黙って効かない）ことがある。
const observer = new MutationObserver(() => initGoogleLauncherHijack());
const start = () => {
  initGoogleLauncherHijack();
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // 見つからないまま監視し続けても負荷になるだけなので、15秒で打ち切る
  setTimeout(() => observer.disconnect(), 15000);
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
