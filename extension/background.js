browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "sujib-download-link",
    title: "Télécharger avec Sujib (수집)",
    contexts: ["link", "selection", "page"]
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sujib-download-link") {
    let targetUrl = info.linkUrl || info.selectionText || (tab ? tab.url : '');

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return;
    }

    const settings = await browser.storage.sync.get({
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
          title: 'Envoyé via menu contextuel Firefox',
          profile_id: parseInt(settings.defaultProfile, 10) || 1,
          dest_path: settings.defaultDest || ''
        })
      });

      if (res.ok) {
        browser.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-48.png",
          title: "Sujib 2.0",
          message: "Téléchargement envoyé au serveur avec succès !"
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        browser.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-48.png",
          title: "Sujib 2.0 — Erreur",
          message: errData.detail || `Erreur serveur (${res.status})`
        });
      }
    } catch (err) {
      console.error('Failed to send download link to Sujib', err);
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Sujib 2.0 — Erreur réseau",
        message: "Impossible de joindre le serveur Sujib (" + err.message + ")"
      });
    }
  }
});
