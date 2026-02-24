// --- インストールされた時に、右クリックメニューを作成する ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-giga-portal",
    title: "このページをGIGA portalに追加",
    contexts: ["page"] // ページ上のどこかを右クリックした時に表示
  });
});

// --- 右クリックメニューがクリックされた時の処理 ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-to-giga-portal") {
    // タブの情報から名前とURLを自動取得
    const nameVal = tab.title ? tab.title.split(' - ')[0] : "新しいアプリ"; // タイトルをスッキリさせる
    const urlVal = tab.url;
    
    // ファビコンURLの取得（サイトが設定していない場合はGoogleのAPIを利用して自動生成）
    const iconVal = tab.favIconUrl || `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(urlVal).origin}`;

    try {
      // データの保存先を sync (クラウド同期) に変更して読み込み
      const result = await chrome.storage.sync.get(['apps']);
      let currentApps = result.apps || [];
      
      // 初めてクラウド同期を使う場合、ローカル（今まで）のデータを引き継ぐ親切設計
      if (currentApps.length === 0) {
          const localResult = await chrome.storage.local.get(['apps']);
          if (localResult.apps) {
              currentApps = localResult.apps;
          }
      }

      // 新しいアプリのデータを作成
      const newApp = {
        id: 'custom_' + Date.now(),
        name: nameVal,
        url: urlVal,
        icon: iconVal,
        isCustom: true
      };

      // クラウドに保存
      currentApps.push(newApp);
      await chrome.storage.sync.set({ apps: currentApps });

      // 追加成功の通知を表示
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png', // 設定したアイコンが表示されます
        title: 'GIGA portal',
        message: '「' + nameVal + '」を追加しました！'
      });

    } catch (error) {
      console.error("保存に失敗しました", error);
    }
  }
});
