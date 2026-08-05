// ============================================================================
// GIGA portal - Core Logic
// ============================================================================
// 【この画面は MV3 の拡張機能ページである】
// 既定で script-src 'self' が効いているため、インラインの onclick= /
// onerror= は一切実行されない。DOM を組み立てるときは必ず
// addEventListener を使うこと（文字列の HTML に書いた属性は動かない）。
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
let toastTimer = null;

const showToast = (message, type = 'success') => {
  UI.toast.textContent = message;
  UI.toast.className = `toast ${type}`;
  // エラーは割り込んで読み上げる。成功は操作の邪魔をしない読み上げにする。
  UI.toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  UI.toast.classList.remove('hidden');
  // 続けて出したときに前の消去予定が生き残ると、2つめが早く消える
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => UI.toast.classList.add('hidden'), 3000);
};

const switchView = (targetViewName) => {
  Object.values(UI.views).forEach(view => view.classList.add('hidden'));
  UI.views[targetViewName].classList.remove('hidden');
};

// --- URL の安全確認 ---------------------------------------------------------
// 開く先は http/https だけに限る。
// 設定ファイルは先生どうしで配られるものなので、中身は「他人が書いたもの」
// として扱う。javascript: が混ざったまま window.open に渡すと、
// 拡張機能の権限で任意のコードが動いてしまう。
const SAFE_PROTOCOLS = ['http:', 'https:'];
const safeUrl = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return SAFE_PROTOCOLS.includes(u.protocol) ? u.href : null;
  } catch { return null; }
};

// アイコンは表示するだけなので data: も許す（自前の代替画像がこの形）
const safeIconUrl = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const v = raw.trim();
  if (v.startsWith('icons/') || v.startsWith('data:image/')) return v;
  return safeUrl(v) || '';
};

// --- 自前の代替アイコン -----------------------------------------------------
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
const fallbackIconFor = (url) => {
  for (const [re, file] of FALLBACKS) if (re.test(url || '')) return file;
  return 'icons/fb-generic.svg';
};

const loadData = async () => {
  try {
    const syncData = await chrome.storage.sync.get(['apps']);
    if (syncData.apps && syncData.apps.length > 0) {
      currentApps = syncData.apps;
    } else {
      const localData = await chrome.storage.local.get(['apps']);
      currentApps = localData.apps && localData.apps.length > 0 ? localData.apps : [...defaultApps];
      await persist();
    }
    renderGrid();
  } catch (error) {
    showToast('データの読み込みに失敗しました', 'error');
  }
};

// 保存の実体。sync は 1項目 8KB・全体 100KB の上限がある。
// アプリを増やしていくと必ずいつか超えるので、超えたときに黙って消えないよう
// この端末（local）へ退避し、そのことを利用者に伝える。
const persist = async () => {
  try {
    await chrome.storage.sync.set({ apps: currentApps });
    await chrome.storage.local.set({ apps: currentApps });
    return { ok: true };
  } catch (error) {
    try {
      await chrome.storage.local.set({ apps: currentApps });
      return { ok: true, localOnly: true };
    } catch {
      return { ok: false };
    }
  }
};

const saveData = async () => {
  const r = await persist();
  renderGrid();
  if (!r.ok) showToast('保存できませんでした', 'error');
  else if (r.localOnly) showToast('この端末にだけ保存しました（同期の空きが足りません）', 'error');
  return r;
};

// Googleドライブの画像URLを、直接表示できる形式に変換する
const formatIconUrl = (url) => {
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

// 「すでに開いているタブ」を探す。
// 単純な前方一致だと https://docs.google.com/ が
// スライドやスプレッドシートのタブにも当たってしまい、
// 「ドキュメント」を押したのにスライドへ飛ぶ、という迷子が起きる。
// より長い宛先を持つアプリが同じタブに当たる場合は、そちらに譲る。
const findExistingTab = (tabs, app) => {
  const base = (app.url || '').split('?')[0];
  if (!base) return null;
  const rivals = currentApps
    .map(a => (a.url || '').split('?')[0])
    .filter(b => b.length > base.length && b.startsWith(base));
  return tabs.find(t =>
    t.url && t.url.startsWith(base) && !rivals.some(r => t.url.startsWith(r))
  ) || null;
};

// 埋め込み元（content.js の iframe）へ「閉じて」と伝える。
// 宛先に '*' を使うと、どこに埋め込まれても中身が渡ってしまう。
// 親のオリジンは content.js が iframe の URL の #embed= に入れて渡してくる。
// referrer から取る手もあるが、参照元ポリシー次第で空になることがあり
// 「閉じない」という形で黙って壊れるため、明示的に渡す形にした。
const GOOGLE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*google\.(com|co\.jp)$/;
const embedderOrigin = () => {
  const m = location.hash.match(/[#&]embed=([^&]+)/);
  if (!m) return null;
  const origin = decodeURIComponent(m[1]);
  return GOOGLE_ORIGIN.test(origin) ? origin : null;
};
const notifyParentToClose = () => {
  if (window === window.parent) return;
  const origin = embedderOrigin();
  if (!origin) return;
  window.parent.postMessage({ type: 'CLOSE_GIGA_LAUNCHER' }, origin);
};

const openApp = async (app) => {
  const target = safeUrl(app.url);
  if (!target) return showToast('このアプリのURLが正しくありません', 'error');
  try {
    const tabs = await chrome.tabs.query({});
    const existingTab = findExistingTab(tabs, app);
    if (existingTab) {
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: target });
    }
    notifyParentToClose();
  } catch (err) {
    // 権限が無い等でタブ操作に失敗したときの最後の手段。
    // ここに渡るのは safeUrl を通した http/https だけ。
    window.open(target, '_blank', 'noopener');
  }
};

// --- 1枚のタイルを組み立てる ------------------------------------------------
// 文字列の HTML を innerHTML に入れない。
// アプリ名はページのタイトルや、先生が配った設定ファイルから来る。
// つまり「自分で書いた文字」ではないので、タグとして解釈させてはならない。
const buildTile = (app, index) => {
  const tile = document.createElement('div');
  tile.className = 'app-tile';
  tile.draggable = true;
  tile.dataset.index = String(index);

  // 開くところ。button を a の中に入れると HTML として不正になり、
  // キーボードの順序も壊れるので、操作ボタンは兄弟として置く。
  const link = document.createElement('a');
  link.className = 'app-item';   // 100×92px あるので当たり判定の追加は要らない
  link.href = safeUrl(app.url) || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const img = document.createElement('img');
  img.className = 'app-icon';
  img.alt = '';               // 名前がすぐ下にあるので、読み上げは重複させない
  img.width = 44;
  img.height = 44;            // 読み込み前後で高さが変わらないようにする（CLS）
  img.draggable = false;
  img.decoding = 'async';
  const fallback = fallbackIconFor(app.url);
  // ⚠️ onerror= 属性は CSP に阻まれて実行されない。必ず addEventListener で付ける。
  img.addEventListener('error', () => {
    if (img.dataset.fellBack) return;   // 代替画像まで失敗したときに無限に回らないように
    img.dataset.fellBack = '1';
    img.src = fallback;
  }, { once: false });
  const wanted = safeIconUrl(formatIconUrl(app.icon));
  img.src = wanted || fallback;

  const name = document.createElement('div');
  name.className = 'app-name';
  name.textContent = app.name;        // ← タグとして解釈させない

  link.append(img, name);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn tap-44';
  editBtn.type = 'button';
  editBtn.title = '編集';
  editBtn.setAttribute('aria-label', `${app.name} を編集`);
  editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-528q12-12 28-12t28 12l57 57q12 12 12 28t-12 28L257-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';

  const delBtn = document.createElement('button');
  delBtn.className = 'action-btn delete-btn tap-44';
  delBtn.type = 'button';
  delBtn.title = '削除';
  delBtn.setAttribute('aria-label', `${app.name} を削除`);
  delBtn.textContent = '×';

  actions.append(editBtn, delBtn);
  tile.append(link, actions);

  link.addEventListener('click', (e) => { e.preventDefault(); openApp(app); });
  editBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openEditForm(app); });
  delBtn.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm(`「${app.name}」を削除しますか？`)) {
      currentApps = currentApps.filter(cApp => cApp.id !== app.id);
      const r = await saveData();
      if (r.ok) showToast('削除しました');
    }
  });

  // ドラッグ＆ドロップ
  tile.addEventListener('dragstart', () => {
    draggedItemIndex = parseInt(tile.dataset.index, 10);
    setTimeout(() => tile.classList.add('dragging'), 0);
  });
  tile.addEventListener('dragover', (e) => { e.preventDefault(); });
  tile.addEventListener('dragenter', () => {
    if (parseInt(tile.dataset.index, 10) !== draggedItemIndex) tile.classList.add('drag-over');
  });
  tile.addEventListener('dragleave', () => tile.classList.remove('drag-over'));
  tile.addEventListener('drop', (e) => {
    e.stopPropagation(); tile.classList.remove('drag-over');
    const targetIndex = parseInt(tile.dataset.index, 10);
    if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
      const movedApp = currentApps.splice(draggedItemIndex, 1)[0];
      currentApps.splice(targetIndex, 0, movedApp);
      saveData();
    }
    return false;
  });
  tile.addEventListener('dragend', () => {
    tile.classList.remove('dragging');
    UI.grid.querySelectorAll('.app-tile').forEach(el => el.classList.remove('drag-over'));
    draggedItemIndex = null;
  });

  // ドラッグはマウスが要る。キーボードだけでも並べ替えられるようにする。
  tile.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const from = parseInt(tile.dataset.index, 10);
    const to = e.key === 'ArrowLeft' ? from - 1 : from + 1;
    if (to < 0 || to >= currentApps.length) return;
    currentApps.splice(to, 0, currentApps.splice(from, 1)[0]);
    saveData().then(() => {
      const moved = UI.grid.querySelectorAll('.app-tile')[to];
      if (moved) moved.querySelector('.app-item').focus();
      showToast(`${currentApps[to].name} を移動しました`);
    });
  });

  return tile;
};

const renderGrid = () => {
  UI.grid.textContent = '';
  const fragment = document.createDocumentFragment();
  currentApps.forEach((app, index) => fragment.appendChild(buildTile(app, index)));
  UI.grid.appendChild(fragment);
};

// --- 編集フォームを開く ---
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
  } catch (e) { /* 今のタブが取れないだけなので、空欄のまま進める */ }
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
  const checked = safeUrl(urlVal);
  if (!checked) return showToast('URLの形が正しくありません', 'error');
  urlVal = checked;

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

    const r = await saveData();
    if (r.ok) {
      showToast(editId ? '更新しました' : '保存しました'); // メッセージも切り替え
      switchView('launcher');
    }
  } finally {
    UI.buttons.saveApp.disabled = false;
    document.getElementById('save-text').classList.remove('hidden');
    document.getElementById('save-spinner').classList.add('hidden');
  }
});

// 設定画面の処理（エクスポート・インポート）
UI.buttons.settings.addEventListener('click', () => switchView('settings'));
UI.buttons.closeSettings.addEventListener('click', () => switchView('launcher'));
UI.buttons.export.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentApps));
  const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", "giga_portal_settings.json");
  document.body.appendChild(dl); dl.click(); dl.remove();
  showToast('設定ファイルを保存しました');
});
UI.buttons.import.addEventListener('click', () => UI.importFile.click());

// 読み込む設定ファイルは、先生から先生へ配られる「他人が書いたもの」。
// 中身をそのまま信じず、必要な項目だけを取り出して形を整える。
const sanitizeImported = (raw) => {
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const url = safeUrl(entry.url);
    if (!url) return;                       // http/https 以外は捨てる
    const name = typeof entry.name === 'string' && entry.name.trim()
      ? entry.name.trim().slice(0, 60) : url;
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `custom_${Date.now()}_${i}`,
      name,
      url,
      icon: safeIconUrl(entry.icon),
      isCustom: entry.isCustom !== false
    });
  });
  return out.length ? out : null;
};

UI.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    let parsed = null;
    try { parsed = JSON.parse(event.target.result); } catch { parsed = null; }
    const cleaned = parsed ? sanitizeImported(parsed) : null;
    if (!cleaned) {
      showToast('正しい設定ファイルではありません', 'error');
    } else {
      const dropped = Array.isArray(parsed) ? parsed.length - cleaned.length : 0;
      currentApps = cleaned;
      const r = await saveData();
      if (r.ok) {
        showToast(dropped ? `設定を読み込みました（${dropped}件は開けないURLのため除きました）` : '設定を読み込みました');
        switchView('launcher');
      }
    }
    UI.importFile.value = '';
  };
  reader.onerror = () => { showToast('ファイルを読めませんでした', 'error'); UI.importFile.value = ''; };
  reader.readAsText(file);
});

UI.buttons.reset.addEventListener('click', async () => {
  if (confirm("全ての追加アプリと並び順を削除し、最初の9個の状態に戻します。よろしいですか？")) {
    currentApps = defaultApps.map(a => ({ ...a }));
    const r = await saveData();
    if (r.ok) { showToast('初期状態にリセットしました'); switchView('launcher'); }
  }
});

// Esc で1つ前の画面に戻す（マウスが使えない児童のため）
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!UI.views.addForm.classList.contains('hidden')) switchView('launcher');
  else if (!UI.views.settings.classList.contains('hidden')) switchView('launcher');
});

document.addEventListener('DOMContentLoaded', loadData);
