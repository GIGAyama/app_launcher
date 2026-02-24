// ページが読み込まれたら、Googleの「9つのドット」ボタンを探す魔法のスクリプトです。

function initGoogleLauncherHijack() {
  // Googleの標準アプリランチャーボタンを探します（aria-labelが目印）
  const googleAppBtn = document.querySelector('[aria-label="Google アプリ"], [aria-label="Google apps"]');
  
  if (googleAppBtn) {
    // 既存のボタンの動作を止めるため、そっくりなボタンを作って入れ替えます
    const cloneBtn = googleAppBtn.cloneNode(true);
    googleAppBtn.parentNode.replaceChild(cloneBtn, googleAppBtn);

    // 私たちが作った「学びのトビラ」を表示するための透明な箱（iframe）を作ります
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    iframe.id = 'giga-launcher-iframe';
    
    // スタイル設定：画面の右上に綺麗に浮かび上がるようにします
    iframe.style.position = 'fixed';
    iframe.style.top = '60px'; // ヘッダーのすぐ下
    iframe.style.right = '20px'; // 右端から少し離す
    iframe.style.width = '360px';
    iframe.style.height = '500px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    iframe.style.zIndex = '2147483647'; // 画面の絶対に一番前に出す
    iframe.style.display = 'none'; // 最初は隠しておく
    iframe.style.backgroundColor = '#f8f9fa';
    
    document.body.appendChild(iframe);

    // 9つのドットボタンが押されたら、私たちの画面を表示/非表示にします
    cloneBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (iframe.style.display === 'none') {
        iframe.style.display = 'block';
      } else {
        iframe.style.display = 'none';
      }
    });

    // 画面の他の場所をクリックしたら、スッと閉じるようにします
    document.addEventListener('click', (e) => {
      if (!cloneBtn.contains(e.target) && iframe.style.display === 'block') {
         iframe.style.display = 'none';
      }
    });
  }
}

// 拡張機能の中の画面（popup.js）から「閉じて！」という連絡が来たら閉じる仕組み
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLOSE_GIGA_LAUNCHER') {
    const iframe = document.getElementById('giga-launcher-iframe');
    if (iframe) iframe.style.display = 'none';
  }
});

// ページが開いてから少しだけ待って（Googleのボタンが表示されるのを待つため）実行します
setTimeout(initGoogleLauncherHijack, 1500);
