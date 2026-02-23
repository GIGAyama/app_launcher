// --- 最初から入っているデフォルトのアプリ ---
const defaultApps = [
  {
    id: 'default_classroom',
    name: '<ruby>教室<rt>きょうしつ</rt></ruby>',
    url: 'https://classroom.google.com/',
    icon: 'https://ssl.gstatic.com/classroom/ic_product_classroom_144.png',
    isCustom: false
  },
  {
    id: 'default_drive',
    name: 'ドライブ',
    url: 'https://drive.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_docs',
    name: '<ruby>文章<rt>ぶんしょう</rt></ruby>',
    url: 'https://docs.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png',
    isCustom: false
  }
];

// --- 画面の要素を取得 ---
const appGrid = document.getElementById('app-grid');
const launcherView = document.getElementById('launcher-view');
const addFormView = document.getElementById('add-form-view');
const showAddFormBtn = document.getElementById('show-add-form-btn');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const toastEl = document.getElementById('toast');

// 入力欄
const inputName = document.getElementById('app-name');
const inputUrl = document.getElementById('app-url');
const inputIcon = document.getElementById('app-icon');

// --- アプリの読み込みと表示 ---
async function loadAndRenderApps() {
  appGrid.innerHTML = ''; // 一旦クリア

  // Chromeの保存領域から追加されたアプリを読み込む
  const result = await chrome.storage.local.get(['customApps']);
  const customApps = result.customApps || [];

  // デフォルトアプリとカスタムアプリを合体
  const allApps = [...defaultApps, ...customApps];

  // 画面にボタンを作って並べる
  allApps.forEach(app => {
    const item = document.createElement('div');
    item.className = 'app-item';
    
    // アイコン画像がない場合は標準の地球マークの代わり文字にする
    const iconSrc = app.icon ? app.icon : 'https://www.google.com/s2/favicons?sz=64&domain_url=' + app.url;

    let html = `
      <img src="${iconSrc}" class="app-icon" alt="icon" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%23ccc\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/%3E%3C/svg%3E'">
      <div class="app-name">${app.name}</div>
    `;

    // 自分で追加したアプリには削除ボタンを付ける
    if (app.isCustom) {
      html += `<button class="delete-btn" data-id="${app.id}">×</button>`;
    }

    item.innerHTML = html;

    // クリックした時の「タブ迷子防止」の仕組み
    item.addEventListener('click', async (e) => {
      // 削除ボタンを押した時は移動しない
      if (e.target.classList.contains('delete-btn')) return;

      // 現在開いている全てのタブを調べる
      const tabs = await chrome.tabs.query({});
      
      // 同じURLで始まるタブが既に開かれているか探す
      const existingTab = tabs.find(t => t.url && t.url.startsWith(app.url));

      if (existingTab) {
        // すでに開いていれば、そのタブをアクティブにして前面に出す
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        // 開いていなければ新しいタブを作る
        await chrome.tabs.create({ url: app.url });
      }
    });

    // 削除ボタンの処理
    if (app.isCustom) {
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('このアプリを削除しますか？')) {
          const newCustomApps = customApps.filter(cApp => cApp.id !== app.id);
          await chrome.storage.local.set({ customApps: newCustomApps });
          showToast('<ruby>削除<rt>さくじょ</rt></ruby>しました', 'success');
          loadAndRenderApps();
        }
      });
    }

    appGrid.appendChild(item);
  });
}

// --- 画面の切り替え ---
showAddFormBtn.addEventListener('click', () => {
  launcherView.classList.add('hidden');
  addFormView.classList.remove('hidden');
  inputName.focus();
});

cancelBtn.addEventListener('click', () => {
  addFormView.classList.add('hidden');
  launcherView.classList.remove('hidden');
  // 入力欄を空にする
  inputName.value = '';
  inputUrl.value = '';
  inputIcon.value = '';
});

// --- アプリの保存処理 ---
saveBtn.addEventListener('click', async () => {
  const nameVal = inputName.value.trim();
  const urlVal = inputUrl.value.trim();
  const iconVal = inputIcon.value.trim();

  // エラーチェック
  if (!nameVal || !urlVal) {
    showToast('<ruby>名前<rt>なまえ</rt></ruby>とURLは<ruby>必須<rt>ひっす</rt></ruby>です', 'error');
    return;
  }
  if (!urlVal.startsWith('http')) {
    showToast('URLは http から<ruby>始<rt>はじ</rt></ruby>めてください', 'error');
    return;
  }

  // ボタンを無効化してスピナーを表示（二重クリック防止）
  saveBtn.disabled = true;
  document.getElementById('save-text').classList.add('hidden');
  document.getElementById('save-spinner').classList.remove('hidden');

  try {
    // 既存のカスタムアプリを取得
    const result = await chrome.storage.local.get(['customApps']);
    const customApps = result.customApps || [];

    // 新しいアプリのデータを作成
    const newApp = {
      id: 'custom_' + Date.now(),
      name: nameVal,
      url: urlVal,
      icon: iconVal,
      isCustom: true
    };

    // 保存
    customApps.push(newApp);
    await chrome.storage.local.set({ customApps: customApps });

    // 成功通知
    showToast('<ruby>保存<rt>ほぞん</rt></ruby>しました', 'success');

    // 画面を戻して再描画
    cancelBtn.click();
    loadAndRenderApps();

  } catch (error) {
    showToast('<ruby>失敗<rt>しっぱい</rt></ruby>しました', 'error');
  } finally {
    // ボタンを元に戻す
    saveBtn.disabled = false;
    document.getElementById('save-text').classList.remove('hidden');
    document.getElementById('save-spinner').classList.add('hidden');
  }
});

// --- トースト通知を表示する関数 ---
function showToast(message, type) {
  toastEl.innerHTML = message;
  toastEl.className = `toast ${type}`;
  toastEl.classList.remove('hidden');
  
  // 3秒後に消す
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

// --- 最初に行う処理 ---
document.addEventListener('DOMContentLoaded', loadAndRenderApps);
