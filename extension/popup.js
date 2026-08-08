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

  const headers = {};
  if (settings.authUser && settings.authPass) {
    headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
  }

  // Synchronize profiles dynamically from Sujib server API
  await loadProfilesFromServer(settings.serverUrl, headers, settings.defaultProfile);

  // Auto-detect active YouTube tab URL
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0] && tabs[0].url) {
    if (tabs[0].url.includes('youtube.com') || tabs[0].url.includes('youtu.be')) {
      videoUrlInput.value = tabs[0].url;
    }
  }

  btnOptions.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  async function loadProfilesFromServer(baseUrl, reqHeaders, savedDefault) {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/profiles`;
    try {
      const res = await fetch(endpoint, { headers: reqHeaders });
      if (res.ok) {
        const profiles = await res.json();
        profileSelect.innerHTML = '';
        if (profiles.length === 0) {
          profileSelect.innerHTML = '<option value="1">Aucun profil actif</option>';
          return;
        }
        profiles.forEach(prof => {
          const opt = document.createElement('option');
          opt.value = prof.id;
          const destText = prof.dest_path ? ` 📁 ${prof.dest_path.split('/').pop()}` : '';
          opt.textContent = `${prof.name} (${prof.container.toUpperCase()})${destText}`;
          profileSelect.appendChild(opt);
        });

        if (savedDefault && profileSelect.querySelector(`option[value="${savedDefault}"]`)) {
          profileSelect.value = savedDefault;
        }
        return;
      }
    } catch (err) {
      console.warn('Erreur de synchro profils Sujib:', err);
    }

    // Fallback if server unreachable
    profileSelect.innerHTML = `
      <option value="1">4K (2160p)</option>
      <option value="2">1440p (2K)</option>
      <option value="3">1080p (Full HD)</option>
      <option value="4">720p (HD)</option>
      <option value="5">SD (480p)</option>
      <option value="6">Audio Only (MP3)</option>
    `;
  }

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
