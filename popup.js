// --- 最初から入っているデフォルトのアプリ（9つ） ---
const defaultApps = [
  {
    id: 'default_classroom',
    name: 'クラスルーム',
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
    name: 'ドキュメント',
    url: 'https://docs.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_slides',
    name: 'スライド',
    url: 'https://docs.google.com/presentation/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/slides_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_sheets',
    name: 'スプレッドシート',
    url: 'https://docs.google.com/spreadsheets/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_forms',
    name: 'フォーム',
    url: 'https://docs.google.com/forms/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/forms_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_meet',
    name: 'Meet',
    url: 'https://meet.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_calendar',
    name: 'カレンダー',
    url: 'https://calendar.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png',
    isCustom: false
  },
  {
    id: 'default_translate',
    name: '<ruby>翻訳<rt>ほんやく</rt></ruby>',
    url: 'https://translate.google.com/',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png',
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

// メモリ上で現在の並び順を管理する配列
let currentApps = [];

// --- アプリの読み込みと表示 ---
async function loadAndRenderApps() {
  const result = await chrome.storage.local.get(['apps', 'customApps']);
  
  if (result.apps) {
    currentApps = result.apps;
  } else {
    // 初回起動時
    currentApps = [...defaultApps];
    if (result.customApps) {
      currentApps = [...currentApps, ...result.customApps];
    }
    await chrome.storage.local.set({ apps: currentApps });
  }
  
  renderGrid();
}

// --- グリッドを描画する関数（ドラッグ＆ドロップ対応） ---
function renderGrid() {
  appGrid.innerHTML = ''; 

  currentApps.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'app-item';
    
    // ドラッグ＆ドロップを有効化
    item.draggable = true;
    item.dataset.index = index;
    
    const iconSrc = app.icon ? app.icon : 'https://www.google.com/s2/favicons?sz=64&domain_url=' + app.url;

    let html = `
      <img src="${iconSrc}" class="app-icon" alt="icon" draggable="false" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%23ccc\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/%3E%3C/svg%3E'">
      <div class="app-name">${app.name}</div>
    `;

    if (app.isCustom) {
      html += `<button class="delete-btn" data-id="${app.id}">×</button>`;
    }

    item.innerHTML = html;

    // クリックした時の「タブ迷子防止」の仕組み
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

    // ドラッグ＆ドロップのイベント処理
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);

    // 削除ボタンの処理
    if (app.isCustom) {
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('このアプリを削除しますか？')) {
          currentApps = currentApps.filter(cApp => cApp.id !== app.id);
          await chrome.storage.local.set({ apps: currentApps });
          showToast('<ruby>削除<rt>さくじょ</rt></ruby>しました', 'success');
          renderGrid();
        }
      });
    }

    appGrid.appendChild(item);
  });
}

// --- ドラッグ＆ドロップを管理する変数と関数 ---
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
    
    chrome.storage.local.set({ apps: currentApps }).then(() => {
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

// --- 画面切り替えと保存処理 ---
showAddFormBtn.addEventListener('click', () => {
  launcherView.classList.add('hidden');
  addFormView.classList.remove('hidden');
  inputName.focus();
});

cancelBtn.addEventListener('click', () => {
  addFormView.classList.add('hidden');
  launcherView.classList.remove('hidden');
  inputName.value = '';
  inputUrl.value = '';
  inputIcon.value = '';
});

saveBtn.addEventListener('click', async () => {
  const nameVal = inputName.value.trim();
  const urlVal = inputUrl.value.trim();
  const iconVal = inputIcon.value.trim();

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
      icon: iconVal,
      isCustom: true
    });

    await chrome.storage.local.set({ apps: currentApps });
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
