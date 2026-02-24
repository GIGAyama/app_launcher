// ============================================================================
// GIGA portal - Core Logic (Optimized for MV3 & GIGA Standard v2)
// ============================================================================

// --- 1. 定数と初期データ ---
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

// --- 2. DOM要素の取得 ---
const UI = {
  views: {
    launcher: document.getElementById('launcher-view'),
    addForm: document.getElementById('add-form-view'),
    settings: document.getElementById('settings-view')
  },
  grid: document.getElementById('app-grid'),
  toast: document.getElementById('toast'),
  inputs: {
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

// 状態管理
let currentApps = [];
let draggedItemIndex = null;

// --- 3. コア関数群 ---

// 通知(Toast)の表示
const showToast = (message, type = 'success') => {
  UI.toast.textContent = message;
  UI.toast.className = `toast ${type}`;
  UI.toast.classList.remove('hidden');
  setTimeout(() => UI.toast.classList.add('hidden'), 3000);
};

// 画面(View)の切り替え
const switchView = (targetViewName) => {
  Object.values(UI.views).forEach(view => view.classList.add('hidden'));
  UI.views[targetViewName].classList.remove('hidden');
};

// データの読み込み (Sync優先、Localフォールバック)
const loadData = async () => {
  try {
    const syncData = await chrome.storage.sync.get(['apps']);
    if (syncData.apps && syncData.apps.length > 0) {
      currentApps = syncData.apps;
    } else {
      const localData = await chrome.storage.local.get(['apps']);
      currentApps = localData.apps && localData.apps.length > 0 ? localData.apps : [...defaultApps];
      await chrome.storage.sync.set({ apps: currentApps }); // クラウドに同期
    }
    renderGrid();
  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
    showToast('データの読み込みに失敗しました', 'error');
  }
};

// データの保存
const saveData = async () => {
  try {
    await chrome.storage.sync.set({ apps: currentApps });
    renderGrid();
  } catch (error) {
    console.error("保存エラー:", error);
    showToast('保存に失敗しました', 'error');
    throw error;
  }
};

// グリッドの描画 (ドラッグ＆ドロップ対応)
const renderGrid = () => {
  UI.grid.innerHTML = '';
  const fragment = document.createDocumentFragment();

  currentApps.forEach((app, index) => {
    const item = document.createElement('a'); // aタグに変更し、アクセシビリティ向上
    item.className = 'app-item';
    item.draggable = true;
    item.dataset.index = index;
    // URL設定（新しいタブで開く標準動作を付与しつつ、JSでスマート切り替えを上書き）
    item.href = app.url;
    item.target = "_blank";
    item.rel = "noopener noreferrer";
    
    // アイコンURLのフォールバック（Google Favicon API）
    const iconSrc = app.icon || `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(app.url).origin}`;
    // SVGプレースホルダー（画像読み込み失敗時）
    const fallbackSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='%239aa0a6' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'/%3E%3C/svg%3E";

    item.innerHTML = `
      <img src="${iconSrc}" class="app-icon" alt="" draggable="false" onerror="this.onerror=null; this.src='${fallbackSvg}';">
      <div class="app-name">${app.name}</div>
      ${app.isCustom ? `<div class="delete-btn" data-id="${app.id}" title="削除" aria-label="削除">×</div>` : ''}
    `;

    // --- イベントリスナーの登録 ---

    // 1. スマートタブ切り替え（クリックイベントのインターセプト）
    item.addEventListener('click', async (e) => {
      e.preventDefault(); // 標準のリンクジャンプを止める
      if (e.target.classList.contains('delete-btn')) return;

      try {
        const tabs = await chrome.tabs.query({});
        // URLの前方一致で既に開いているか判定（パラメータ違いなどを吸収）
        const existingTab = tabs.find(t => t.url && t.url.startsWith(app.url.split('?')[0]));

        if (existingTab) {
          await chrome.tabs.update(existingTab.id, { active: true });
          await chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: app.url });
        }

        // iframe内（Googleページに埋め込み中）なら自身を閉じる指示を親画面に出す
        if (window !== window.parent) window.parent.postMessage({ type: 'CLOSE_GIGA_LAUNCHER' }, '*');
      } catch (err) {
        console.error("タブの操作に失敗しました", err);
        window.open(app.url, '_blank'); // エラー時は通常の新規タブで開く（フォールバック）
      }
    });

    // 2. 削除機能
    if (app.isCustom) {
      item.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`「${app.name}」を削除しますか？`)) {
          currentApps = currentApps.filter(cApp => cApp.id !== app.id);
          await saveData();
          showToast('削除しました');
        }
      });
    }

    // 3. ドラッグ＆ドロップ機能
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
      e.stopPropagation();
      item.classList.remove('drag-over');
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

// --- 4. イベントハンドラの登録 ---

// 【追加画面】開く（自動入力機能付き）
UI.buttons.showAdd.addEventListener('click', async () => {
  switchView('addForm');
  UI.inputs.name.value = ''; UI.inputs.url.value = ''; UI.inputs.icon.value = '';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      UI.inputs.name.value = tab.title ? tab.title.split(' - ')[0] : '';
      UI.inputs.url.value = tab.url;
      if (tab.favIconUrl) UI.inputs.icon.value = tab.favIconUrl;
    }
  } catch(e) { console.log("タブ情報取得スキップ"); }
  UI.inputs.name.focus();
});

// 【追加画面】閉じる
UI.buttons.cancelAdd.addEventListener('click', () => switchView('launcher'));

// 【追加画面】保存する
UI.buttons.saveApp.addEventListener('click', async () => {
  const nameVal = UI.inputs.name.value.trim();
  let urlVal = UI.inputs.url.value.trim();
  const iconVal = UI.inputs.icon.value.trim();

  if (!nameVal || !urlVal) return showToast('名前とURLは必須です', 'error');
  if (!urlVal.startsWith('http')) urlVal = 'https://' + urlVal; // 自動補完

  UI.buttons.saveApp.disabled = true;
  document.getElementById('save-text').classList.add('hidden');
  document.getElementById('save-spinner').classList.remove('hidden');

  try {
    currentApps.push({ id: 'custom_' + Date.now(), name: nameVal, url: urlVal, icon: iconVal, isCustom: true });
    await saveData();
    showToast('保存しました');
    switchView('launcher');
  } catch (error) {
    // Error handled in saveData
  } finally {
    UI.buttons.saveApp.disabled = false;
    document.getElementById('save-text').classList.remove('hidden');
    document.getElementById('save-spinner').classList.add('hidden');
  }
});

// 【設定画面】開く・閉じる
UI.buttons.settings.addEventListener('click', () => switchView('settings'));
UI.buttons.closeSettings.addEventListener('click', () => switchView('launcher'));

// 【設定画面】エクスポート（JSONファイルとして保存）
UI.buttons.export.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentApps));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "giga_portal_settings.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  showToast('設定ファイルを保存しました');
});

// 【設定画面】インポート（ファイル選択ダイアログを開く）
UI.buttons.import.addEventListener('click', () => UI.importFile.click());

// 【設定画面】インポート処理（ファイル読み込み）
UI.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedApps = JSON.parse(event.target.result);
      if (Array.isArray(importedApps) && importedApps.length > 0 && importedApps[0].url) {
        currentApps = importedApps;
        await saveData();
        showToast('設定を読み込みました');
        switchView('launcher'); // 読み込み成功したら一覧に戻る
      } else {
        throw new Error('Invalid format');
      }
    } catch (err) {
      showToast('正しい設定ファイルではありません', 'error');
    }
    UI.importFile.value = ''; // リセット
  };
  reader.readAsText(file);
});

// 【設定画面】初期状態にリセット
UI.buttons.reset.addEventListener('click', async () => {
  if (confirm("全ての追加アプリと並び順を削除し、最初の9個の状態に戻します。よろしいですか？")) {
    currentApps = [...defaultApps];
    await saveData();
    showToast('初期状態にリセットしました');
    switchView('launcher');
  }
});

// --- 5. 初期化 ---
document.addEventListener('DOMContentLoaded', loadData);
