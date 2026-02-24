// ============================================================================
// GIGA portal - Core Logic (Edit Feature & Google Drive Image Support)
// ============================================================================

const defaultApps = [
  { id: 'default_classroom', name: 'クラスルーム', url: 'https://classroom.google.com/', icon: 'https://ssl.gstatic.com/classroom/ic_product_classroom_144.png', isCustom: false },
  { id: 'default_drive', name: 'ドライブ', url: 'https://drive.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png', isCustom: false },
  { id: 'default_docs', name: 'ドキュメント', url: 'https://docs.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png', isCustom: false },
  { id: 'default_slides', name: 'スライド', url: 'https://docs.google.com/presentation/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/slides_2020q4_48dp.png', isCustom: false },
  { id: 'default_sheets', name: 'スプレッドシート', url: 'https://docs.google.com/spreadsheets/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png', isCustom: false },
  { id: 'default_forms', name: 'フォーム', url: 'https://docs.google.com/forms/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/forms_2020q4_48dp.png', isCustom: false },
  { id: 'default_meet', name: 'Meet', url: 'https://meet.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png', isCustom: false },
  { id: 'default_calendar', name: 'カレンダー', url: 'https://calendar.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png', isCustom: false },
  { id: 'default_translate', name: '翻訳', url: 'https://translate.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png', isCustom: false }
];

const UI = {
  views: {
    launcher: document.getElementById('launcher-view'),
    addForm: document.getElementById('add-form-view'),
    settings: document.getElementById('settings-view')
  },
  grid: document.getElementById('app-grid'),
  toast: document.getElementById('toast'),
  inputs: {
    title: document.getElementById('form-title'),
    editId: document.getElementById('edit-app-id'),
    name: document.getElementById('app-name'),
    url: document.getElementById('app-url'),
    icon: document.getElementById('app-icon')
  },
  buttons: {
    showAdd: document.getElementById('show-add-form-btn'),
    settings: document.getElementById('settings-btn'),
    cancelAdd: document.getElementById('cancel-add-btn'),
    saveApp: document.getElementById('save-app-btn'),
    closeSettings: document.getElementById('close-settings-btn'),
    export: document.getElementById('export-btn'),
    import: document.getElementById('import-btn'),
    reset: document.getElementById('reset-btn')
  },
  importFile: document.getElementById('import-file')
};

let currentApps = [];
let draggedItemIndex = null;

const showToast = (message, type = 'success') => {
  UI.toast.textContent = message;
  UI.toast.className = `toast ${type}`;
  UI.toast.classList.remove('hidden');
  setTimeout(() => UI.toast.classList.add('hidden'), 3000);
};

const switchView = (targetViewName) => {
  Object.values(UI.views).forEach(view => view.classList.add('hidden'));
  UI.views[targetViewName].classList.remove('hidden');
};

const loadData = async () => {
  try {
    const syncData = await chrome.storage.sync.get(['apps']);
    if (syncData.apps && syncData.apps.length > 0) {
      currentApps = syncData.apps;
    } else {
      const localData = await chrome.storage.local.get(['apps']);
      currentApps = localData.apps && localData.apps.length > 0 ? localData.apps : [...defaultApps];
      await chrome.storage.sync.set({ apps: currentApps });
    }
    renderGrid();
  } catch (error) {
    showToast('データの読み込みに失敗しました', 'error');
  }
};

const saveData = async () => {
  await chrome.storage.sync.set({ apps: currentApps });
  renderGrid();
};

// ★ Googleドライブの画像URLを、直接表示できる形式に変換する魔法の関数 ★
const formatIconUrl = (url) => {
  if (!url) return '';
  // 「drive.google.com/file/d/XXXXXX/view」などの形式を見つけて変換
  let driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  
  // 「drive.google.com/open?id=XXXXXX」の形式
  driveMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;

  return url; // ドライブのURLじゃなければそのまま返す
};

const renderGrid = () => {
  UI.grid.innerHTML = '';
  const fragment = document.createDocumentFragment();

  currentApps.forEach((app, index) => {
    const item = document.createElement('a');
    item.className = 'app-item';
    item.draggable = true;
    item.dataset.index = index;
    item.href = app.url;
    item.target = "_blank";
    item.rel = "noopener noreferrer";
    
    // アイコンURLの処理（ドライブ対応＆自動取得フォールバック）
    let iconSrc = formatIconUrl(app.icon);
    if (!iconSrc) {
        try { iconSrc = `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(app.url).origin}`; } 
        catch(e) { iconSrc = ''; }
    }
    const fallbackSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='%239aa0a6' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'/%3E%3C/svg%3E";

    // アプリとボタンの描画
    item.innerHTML = `
      <img src="${iconSrc}" class="app-icon" alt="" draggable="false" onerror="this.onerror=null; this.src='${fallbackSvg}';">
      <div class="app-name">${app.name}</div>
      <div class="item-actions">
        <button class="action-btn edit-btn" data-id="${app.id}" title="編集" aria-label="編集">
          <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-528q12-12 28-12t28 12l57 57q12 12 12 28t-12 28L257-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
        </button>
        <button class="action-btn delete-btn" data-id="${app.id}" title="削除" aria-label="削除">×</button>
      </div>
    `;

    // 1. スマート切り替え
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      // ボタンが押された時はジャンプしない
      if (e.target.closest('.action-btn')) return;

      try {
        const tabs = await chrome.tabs.query({});
        const existingTab = tabs.find(t => t.url && t.url.startsWith(app.url.split('?')[0]));
        if (existingTab) {
          await chrome.tabs.update(existingTab.id, { active: true });
          await chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: app.url });
        }
        if (window !== window.parent) window.parent.postMessage({ type: 'CLOSE_GIGA_LAUNCHER' }, '*');
      } catch (err) { window.open(app.url, '_blank'); }
    });

    // 2. 編集・削除
    item.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      openEditForm(app); // 編集フォームを開く
    });
    
    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (confirm(`「${app.name}」を削除しますか？`)) {
        currentApps = currentApps.filter(cApp => cApp.id !== app.id);
        await saveData();
        showToast('削除しました');
      }
    });

    // 3. ドラッグ＆ドロップ
    item.addEventListener('dragstart', (e) => {
      draggedItemIndex = parseInt(item.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragover', (e) => e.preventDefault());
    item.addEventListener('dragenter', () => {
      if (parseInt(item.dataset.index) !== draggedItemIndex) item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.stopPropagation(); item.classList.remove('drag-over');
      const targetIndex = parseInt(item.dataset.index);
      if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
        const movedApp = currentApps.splice(draggedItemIndex, 1)[0];
        currentApps.splice(targetIndex, 0, movedApp);
        saveData();
      }
      return false;
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      UI.grid.querySelectorAll('.app-item').forEach(el => el.classList.remove('drag-over'));
      draggedItemIndex = null;
    });

    fragment.appendChild(item);
  });
  
  UI.grid.appendChild(fragment);
};

// --- ★編集フォームを開く関数 ---
const openEditForm = (app) => {
  switchView('addForm');
  UI.inputs.title.textContent = 'アプリの編集';
  UI.inputs.editId.value = app.id; // 直しているアプリのIDを隠し項目にセット
  UI.inputs.name.value = app.name;
  UI.inputs.url.value = app.url;
  UI.inputs.icon.value = app.icon || ''; // 変換前のURLを表示
  UI.inputs.name.focus();
};

// 【追加画面】新規で開く
UI.buttons.showAdd.addEventListener('click', async () => {
  switchView('addForm');
  UI.inputs.title.textContent = 'アプリの追加';
  UI.inputs.editId.value = ''; // 新規なのでIDを空に
  UI.inputs.name.value = ''; UI.inputs.url.value = ''; UI.inputs.icon.value = '';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      UI.inputs.name.value = tab.title ? tab.title.split(' - ')[0] : '';
      UI.inputs.url.value = tab.url;
      if (tab.favIconUrl) UI.inputs.icon.value = tab.favIconUrl;
    }
  } catch(e) {}
  UI.inputs.name.focus();
});

// 【追加画面】キャンセル
UI.buttons.cancelAdd.addEventListener('click', () => switchView('launcher'));

// 【追加画面】保存（新規追加 ＆ 編集更新）
UI.buttons.saveApp.addEventListener('click', async () => {
  const nameVal = UI.inputs.name.value.trim();
  let urlVal = UI.inputs.url.value.trim();
  const iconVal = UI.inputs.icon.value.trim();
  const editId = UI.inputs.editId.value; // 編集IDがあるかチェック

  if (!nameVal || !urlVal) return showToast('名前とURLは必須です', 'error');
  if (!urlVal.startsWith('http')) urlVal = 'https://' + urlVal;

  UI.buttons.saveApp.disabled = true;
  document.getElementById('save-text').classList.add('hidden');
  document.getElementById('save-spinner').classList.remove('hidden');

  try {
    if (editId) {
      // 編集の場合：リストから探して上書き
      const index = currentApps.findIndex(a => a.id === editId);
      if (index !== -1) {
        currentApps[index].name = nameVal;
        currentApps[index].url = urlVal;
        currentApps[index].icon = iconVal;
      }
    } else {
      // 新規追加の場合
      currentApps.push({ id: 'custom_' + Date.now(), name: nameVal, url: urlVal, icon: iconVal, isCustom: true });
    }
    
    await saveData();
    showToast(editId ? '更新しました' : '保存しました'); // メッセージも切り替え
    switchView('launcher');
  } catch (error) {
  } finally {
    UI.buttons.saveApp.disabled = false;
    document.getElementById('save-text').classList.remove('hidden');
    document.getElementById('save-spinner').classList.add('hidden');
  }
});

// 設定画面の処理（エクスポート・インポートなど変更なし）
UI.buttons.settings.addEventListener('click', () => switchView('settings'));
UI.buttons.closeSettings.addEventListener('click', () => switchView('launcher'));
UI.buttons.export.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentApps));
  const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", "giga_portal_settings.json");
  document.body.appendChild(dl); dl.click(); dl.remove();
  showToast('設定ファイルを保存しました');
});
UI.buttons.import.addEventListener('click', () => UI.importFile.click());
UI.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedApps = JSON.parse(event.target.result);
      if (Array.isArray(importedApps) && importedApps.length > 0 && importedApps[0].url) {
        currentApps = importedApps; await saveData(); showToast('設定を読み込みました'); switchView('launcher');
      } else throw new Error();
    } catch (err) { showToast('正しい設定ファイルではありません', 'error'); }
    UI.importFile.value = '';
  };
  reader.readAsText(file);
});
UI.buttons.reset.addEventListener('click', async () => {
  if (confirm("全ての追加アプリと並び順を削除し、最初の9個の状態に戻します。よろしいですか？")) {
    currentApps = [...defaultApps]; await saveData(); showToast('初期状態にリセットしました'); switchView('launcher');
  }
});

document.addEventListener('DOMContentLoaded', loadData);
