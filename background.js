// ============================================================================
// GIGA portal - Background Service Worker
// ============================================================================

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
      let result = await chrome.storage.sync.get(['apps']);
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

      // 保存
      await chrome.storage.sync.set({ apps: currentApps });

      // 追加成功のシステム通知を表示（Manifest V3対応）
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'GIGA portal',
        message: `「${nameVal}」を追加しました！`
      });

    } catch (error) {
      console.error("GIGA portal: 保存に失敗しました", error);
    }
  }
});
