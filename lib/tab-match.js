// ============================================================================
// 「すでに開いているタブ」を探す（迷子防止のためのタブ切り替え）
// ============================================================================

// 単純な前方一致だと https://docs.google.com/ が
// スライドやスプレッドシートのタブにも当たってしまい、
// 「ドキュメント」を押したのにスライドへ飛ぶ、という迷子が起きる。
// より長い宛先を持つアプリが同じタブに当たる場合は、そちらに譲る。
export const findExistingTab = (tabs, app, allApps = []) => {
  const base = (app && app.url ? app.url : '').split('?')[0];
  if (!base) return null;
  const rivals = allApps
    .map(a => (a && a.url ? a.url : '').split('?')[0])
    .filter(b => b.length > base.length && b.startsWith(base));
  return (tabs || []).find(t =>
    t && t.url && t.url.startsWith(base) && !rivals.some(r => t.url.startsWith(r))
  ) || null;
};
