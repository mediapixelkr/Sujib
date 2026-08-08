document.addEventListener('DOMContentLoaded', async () => {
  const videoUrlInput = document.getElementById('video-url');
  const profileSelect = document.getElementById('profile-select');
  const btnSend = document.getElementById('btn-send');
  const btnOptions = document.getElementById('btn-open-options');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const settings = await browser.storage.sync.get({
    serverUrl: 'http://192.168.200.15/sujib',
    authUser: '',
    authPass: '',
    defaultProfile: '1'
  });

  profileSelect.value = settings.defaultProfile;

  // Get active tab URL
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0] && tabs[0].url) {
    if (tabs[0].url.includes('youtube.com') || tabs[0].url.includes('youtu.be')) {
      videoUrlInput.value = tabs[0].url;
    }
  }

  btnOptions.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  btnSend.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      statusDiv.textContent = 'Veuillez saisir une URL valide';
      statusDiv.className = 'status error';
      return;
    }

    const profileId = parseInt(profileSelect.value, 10);
    const apiEndpoint = `${settings.serverUrl.replace(/\/+$/, '')}/api/download`;

    const headers = { 'Content-Type': 'application/json' };
    if (settings.authUser && settings.authPass) {
      headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    btnSend.disabled = true;
    statusDiv.textContent = 'Envoi en cours...';
    statusDiv.className = 'status';

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          url: url,
          title: 'Vidéo envoyée via extension Firefox',
          profile_id: profileId
        })
      });

      if (res.ok) {
        statusDiv.textContent = 'Téléchargement lancé avec succès !';
        statusDiv.className = 'status success';
        setTimeout(() => window.close(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        statusDiv.textContent = data.detail || `Erreur serveur (${res.status})`;
        statusDiv.className = 'status error';
      }
    } catch (err) {
      statusDiv.textContent = 'Erreur réseau : ' + err.message;
      statusDiv.className = 'status error';
    } finally {
      btnSend.disabled = false;
    }
  });
});
