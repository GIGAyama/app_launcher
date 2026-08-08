// ============================================================================
// GIGA portal - Background Service Worker
// ============================================================================

const notify = (message) => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'GIGA portal',
    message
  });
};

// インストール時に右クリックメニューを作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-giga-portal",
    title: "このページをGIGA portalに追加",
    contexts: ["page"]
  });
});

// 右クリックメニューが押された時の処理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-to-giga-portal") {
    const nameVal = tab.title ? tab.title.split(' - ')[0] : "新しいアプリ";
    const urlVal = tab.url;
    // URLからオリジン（ドメイン部分）を安全に抽出
    let domain = "";
    try { domain = new URL(urlVal).origin; } catch(e) {}
    
    const iconVal = tab.favIconUrl || (domain ? `https://www.google.com/s2/favicons?sz=64&domain_url=${domain}` : "");

    try {
      // クラウド同期データ(sync)から取得。なければlocalから取得を試みる
      const result = await chrome.storage.sync.get(['apps']);
      let currentApps = result.apps;
      
      if (!currentApps || currentApps.length === 0) {
          const localResult = await chrome.storage.local.get(['apps']);
          currentApps = localResult.apps || [];
      }

      // 新規データ追加
      currentApps.push({
        id: 'custom_' + Date.now(),
        name: nameVal,
        url: urlVal,
        icon: iconVal,
        isCustom: true
      });

      // 保存。sync は 1項目 8KB・全体 100KB の上限がある。
      // popup.js の persist() と同じ振る舞いにそろえる。
      // ここだけ sync のみに書いていると、上限を超えたときに
      // console にしか出ず、追加が黙って消える（通知も出ない）。
      let localOnly = false;
      try {
        await chrome.storage.sync.set({ apps: currentApps });
        await chrome.storage.local.set({ apps: currentApps });
      } catch (e) {
        await chrome.storage.local.set({ apps: currentApps });
        localOnly = true;
      }

      // 追加成功のシステム通知を表示（Manifest V3対応）
      notify(localOnly
        ? `「${nameVal}」を追加しました（この端末にだけ保存しました。同期の空きが足りません）`
        : `「${nameVal}」を追加しました！`);

    } catch (error) {
      console.error("GIGA portal: 保存に失敗しました", error);
      // 黙って失敗しない。押したのに何も起きない、が一番困る。
      notify(`「${nameVal}」を追加できませんでした`);
    }
  }
});
