// --- 最初から入っているデフォルトのアプリ（9つ） ---
const defaultApps = [
  { id: 'default_classroom', name: 'クラスルーム', url: 'https://classroom.google.com/', icon: 'https://ssl.gstatic.com/classroom/ic_product_classroom_144.png', isCustom: false },
  { id: 'default_drive', name: 'ドライブ', url: 'https://drive.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png', isCustom: false },
  { id: 'default_docs', name: 'ドキュメント', url: 'https://docs.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png', isCustom: false },
  { id: 'default_slides', name: 'スライド', url: 'https://docs.google.com/presentation/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/slides_2020q4_48dp.png', isCustom: false },
  { id: 'default_sheets', name: 'スプレッドシート', url: 'https://docs.google.com/spreadsheets/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png', isCustom: false },
  { id: 'default_forms', name: 'フォーム', url: 'https://docs.google.com/forms/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/forms_2020q4_48dp.png', isCustom: false },
  { id: 'default_meet', name: 'Meet', url: 'https://meet.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png', isCustom: false },
  { id: 'default_calendar', name: 'カレンダー', url: 'https://calendar.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png', isCustom: false },
  { id: 'default_translate', name: '<ruby>翻訳<rt>ほんやく</rt></ruby>', url: 'https://translate.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png', isCustom: false }
];

const appGrid = document.getElementById('app-grid');
const launcherView = document.getElementById('launcher-view');
const addFormView = document.getElementById('add-form-view');
const showAddFormBtn = document.getElementById('show-add-form-btn');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const toastEl = document.getElementById('toast');

const inputName = document.getElementById('app-name');
const inputUrl = document.getElementById('app-url');
const inputIcon = document.getElementById('app-icon');

let currentApps = [];

// --- アプリの読み込み（クラウド同期 chrome.storage.sync を使用） ---
async function loadAndRenderApps() {
  // クラウド同期(sync)から読み込み
  let result = await chrome.storage.sync.get(['apps']);
  
  if (result.apps && result.apps.length > 0) {
    currentApps = result.apps;
  } else {
    // クラウドにデータがない場合、今までのPC内データ(local)を探して引き継ぐ
    const localResult = await chrome.storage.local.get(['apps']);
    if (localResult.apps) {
      currentApps = localResult.apps;
      await chrome.storage.sync.set({ apps: currentApps }); // クラウドに移行
    } else {
      // 完全に初回起動の場合
      currentApps = [...defaultApps];
      await chrome.storage.sync.set({ apps: currentApps });
    }
  }
  
  renderGrid();
}

// --- グリッドを描画する関数 ---
function renderGrid() {
  appGrid.innerHTML = ''; 

  currentApps.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'app-item';
    item.draggable = true;
    item.dataset.index = index;
    
    // アイコンURLが空欄の場合、Googleのファビコン取得APIで自動補完して表示する
    let iconSrc = app.icon;
    if (!iconSrc) {
        try {
            const domain = new URL(app.url).origin;
            iconSrc = `https://www.google.com/s2/favicons?sz=64&domain_url=${domain}`;
        } catch (e) {
            iconSrc = '';
        }
    }

    let html = `
      <img src="${iconSrc}" class="app-icon" alt="icon" draggable="false" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%23ccc\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/%3E%3C/svg%3E'">
      <div class="app-name">${app.name}</div>
    `;

    if (app.isCustom) {
      html += `<button class="delete-btn" data-id="${app.id}">×</button>`;
    }

    item.innerHTML = html;

    item.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-btn')) return;

      const tabs = await chrome.tabs.query({});
      const existingTab = tabs.find(t => t.url && t.url.startsWith(app.url));

      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: app.url });
      }

      if (window !== window.parent) {
        window.parent.postMessage({ type: 'CLOSE_GIGA_LAUNCHER' }, '*');
      }
    });

    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);

    if (app.isCustom) {
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('このアプリを削除しますか？')) {
          currentApps = currentApps.filter(cApp => cApp.id !== app.id);
          await chrome.storage.sync.set({ apps: currentApps }); // クラウドに保存
          showToast('<ruby>削除<rt>さくじょ</rt></ruby>しました', 'success');
          renderGrid();
        }
      });
    }

    appGrid.appendChild(item);
  });
}

// --- ドラッグ＆ドロップ関連 ---
let draggedItemIndex = null;

function handleDragStart(e) {
  draggedItemIndex = parseInt(this.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
  e.preventDefault(); 
  return false;
}

function handleDragEnter(e) {
  if (parseInt(this.dataset.index) !== draggedItemIndex) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  this.classList.remove('drag-over');
  
  const targetIndex = parseInt(this.dataset.index);
  
  if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
    const movedApp = currentApps.splice(draggedItemIndex, 1)[0];
    currentApps.splice(targetIndex, 0, movedApp);
    
    // 保存をクラウド同期に変更
    chrome.storage.sync.set({ apps: currentApps }).then(() => {
      renderGrid();
    });
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  appGrid.querySelectorAll('.app-item').forEach(item => item.classList.remove('drag-over'));
  draggedItemIndex = null;
}

// --- ★自動入力対応★ 追加ボタンが押された時 ---
showAddFormBtn.addEventListener('click', async () => {
  launcherView.classList.add('hidden');
  addFormView.classList.remove('hidden');
  
  // 現在開いているタブ（見ているページ）の情報を取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    // タイトルから不要な文字（" - Google 検索" など）を消してスッキリさせる
    let cleanTitle = tab.title ? tab.title.split(' - ')[0] : ''; 
    inputName.value = cleanTitle;
    inputUrl.value = tab.url;
    
    // ファビコンURLがあればセット、なければ自動取得機能にお任せするため空欄に
    if (tab.favIconUrl) {
      inputIcon.value = tab.favIconUrl;
    } else {
      inputIcon.value = ''; 
    }
  }

  // 自動入力された後、そのまま保存ボタンを押せるように名前欄にフォーカス
  inputName.focus();
});

cancelBtn.addEventListener('click', () => {
  addFormView.classList.add('hidden');
  launcherView.classList.remove('hidden');
  inputName.value = '';
  inputUrl.value = '';
  inputIcon.value = '';
});

// --- 保存処理 ---
saveBtn.addEventListener('click', async () => {
  const nameVal = inputName.value.trim();
  const urlVal = inputUrl.value.trim();
  const iconVal = inputIcon.value.trim(); // 空欄でもOK

  if (!nameVal || !urlVal) {
    showToast('<ruby>名前<rt>なまえ</rt></ruby>とURLは<ruby>必須<rt>ひっす</rt></ruby>です', 'error');
    return;
  }
  if (!urlVal.startsWith('http')) {
    showToast('URLは http から<ruby>始<rt>はじ</rt></ruby>めてください', 'error');
    return;
  }

  saveBtn.disabled = true;
  document.getElementById('save-text').classList.add('hidden');
  document.getElementById('save-spinner').classList.remove('hidden');

  try {
    currentApps.push({
      id: 'custom_' + Date.now(),
      name: nameVal,
      url: urlVal,
      icon: iconVal, // 空欄の場合は描画時に自動取得される
      isCustom: true
    });

    // 保存先をクラウド同期(sync)に変更
    await chrome.storage.sync.set({ apps: currentApps });
    showToast('<ruby>保存<rt>ほぞん</rt></ruby>しました', 'success');
    cancelBtn.click();
    renderGrid();

  } catch (error) {
    showToast('<ruby>失敗<rt>しっぱい</rt></ruby>しました', 'error');
  } finally {
    saveBtn.disabled = false;
    document.getElementById('save-text').classList.remove('hidden');
    document.getElementById('save-spinner').classList.add('hidden');
  }
});

function showToast(message, type) {
  toastEl.innerHTML = message;
  toastEl.className = `toast ${type}`;
  toastEl.classList.remove('hidden');
  setTimeout(() => { toastEl.classList.add('hidden'); }, 3000);
}

document.addEventListener('DOMContentLoaded', loadAndRenderApps);
