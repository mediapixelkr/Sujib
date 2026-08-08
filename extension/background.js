browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "sujib-download-link",
    title: "Télécharger avec Sujib (수집)",
    contexts: ["link", "selection", "page"]
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sujib-download-link") {
    let targetUrl = info.linkUrl || info.selectionText || tab.url;

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return;
    }

    const settings = await browser.storage.sync.get({
      serverUrl: 'http://192.168.200.15/sujib',
      authUser: '',
      authPass: '',
      defaultProfile: '1'
    });

    const apiEndpoint = `${settings.serverUrl.replace(/\/+$/, '')}/api/download`;
    const headers = { 'Content-Type': 'application/json' };
    if (settings.authUser && settings.authPass) {
      headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    try {
      await fetch(apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          url: targetUrl.trim(),
          title: 'Envoyé via menu contextuel Firefox',
          profile_id: parseInt(settings.defaultProfile, 10)
        })
      });
    } catch (err) {
      console.error('Failed to send download link to Sujib', err);
    }
  }
});
