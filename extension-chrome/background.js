const extAPI = typeof chrome !== 'undefined' ? chrome : browser;

function getMessage(key, fallback) {
  return (extAPI.i18n && extAPI.i18n.getMessage(key)) || fallback || key;
}

extAPI.runtime.onInstalled.addListener(() => {
  extAPI.contextMenus.create({
    id: "sujib-download-link",
    title: getMessage("contextMenuTitle", "Download with Sujib (수집)"),
    contexts: ["link", "selection", "page"]
  });
});

extAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sujib-download-link") {
    let targetUrl = info.linkUrl || info.selectionText || (tab ? tab.url : '');

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return;
    }

    const settings = await extAPI.storage.sync.get({
      serverUrl: 'http://192.168.200.15/sujib',
      authUser: '',
      authPass: '',
      defaultProfile: '1',
      defaultDest: ''
    });

    const apiEndpoint = `${settings.serverUrl.replace(/\/+$/, '')}/api/download`;
    const headers = { 'Content-Type': 'application/json' };
    if (settings.authUser && settings.authPass) {
      headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          url: targetUrl.trim(),
          title: 'YouTube video',
          profile_id: parseInt(settings.defaultProfile, 10) || 1,
          dest_path: settings.defaultDest || ''
        })
      });

      if (res.ok) {
        extAPI.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-48.png",
          title: "Sujib 2.0",
          message: getMessage("notifSuccess", "Download sent to server successfully!")
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        extAPI.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-48.png",
          title: "Sujib 2.0",
          message: errData.detail || getMessage("notifError", "Failed to send download to server.")
        });
      }
    } catch (err) {
      console.error('Failed to send download link to Sujib', err);
      extAPI.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Sujib 2.0",
        message: `${getMessage("errorNetwork", "Cannot connect to Sujib server")}: ${err.message}`
      });
    }
  }
});
