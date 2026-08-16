const extAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  // Apply i18n translations
  applyI18n();

  const viewSetup = document.getElementById('view-setup');
  const viewDownload = document.getElementById('view-download');
  const btnToggleView = document.getElementById('btn-toggle-view');
  const btnToggleLabel = document.getElementById('btn-toggle-label');
  const statusDiv = document.getElementById('status');

  // Setup view inputs
  const setupServerUrl = document.getElementById('setup-server-url');
  const setupAuthUser = document.getElementById('setup-auth-user');
  const setupAuthPass = document.getElementById('setup-auth-pass');
  const btnSaveSetup = document.getElementById('btn-save-setup');

  // Download view inputs
  const videoUrlInput = document.getElementById('video-url');
  const profileSelect = document.getElementById('profile-select');
  const destSelect = document.getElementById('dest-select');
  const btnSend = document.getElementById('btn-send');

  // Load saved settings
  let settings = await extAPI.storage.sync.get({
    serverUrl: '',
    authUser: '',
    authPass: '',
    defaultProfile: '1',
    defaultDest: '',
    isConfigured: false
  });

  // Pre-fill setup inputs
  setupServerUrl.value = settings.serverUrl;
  setupAuthUser.value = settings.authUser;
  setupAuthPass.value = settings.authPass;

  // Decide initial view: if not configured or serverUrl empty, show setup view
  if (!settings.isConfigured || !settings.serverUrl) {
    showView('setup');
  } else {
    showView('download');
    await refreshDownloadData();
  }

  // Toggle view on header button click
  btnToggleView.addEventListener('click', () => {
    if (viewSetup.classList.contains('hidden')) {
      showView('setup');
    } else {
      showView('download');
      refreshDownloadData();
    }
  });

  function showView(name) {
    statusDiv.className = 'status';
    if (name === 'setup') {
      viewSetup.classList.remove('hidden');
      viewDownload.classList.add('hidden');
      btnToggleLabel.textContent = '← ' + getMessage('btnDownload', 'Retour');
    } else {
      viewSetup.classList.add('hidden');
      viewDownload.classList.remove('hidden');
      btnToggleLabel.textContent = getMessage('btnOptions', 'Options');
    }
  }

  // Setup form submit
  btnSaveSetup.addEventListener('click', async () => {
    const url = setupServerUrl.value.trim().replace(/\/+$/, '');
    const user = setupAuthUser.value.trim();
    const pass = setupAuthPass.value.trim();

    if (!url) {
      showStatus(getMessage('errorInvalidUrl', 'Veuillez saisir une URL valide'), 'error');
      return;
    }

    btnSaveSetup.disabled = true;
    showStatus(getMessage('testTesting', 'Test de connexion en cours...'), '');

    const headers = {};
    if (user && pass) {
      headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
    }

    try {
      const res = await fetch(`${url}/api/status`, { headers });
      if (res.ok) {
        // Save settings
        settings.serverUrl = url;
        settings.authUser = user;
        settings.authPass = pass;
        settings.isConfigured = true;

        await extAPI.storage.sync.set({
          serverUrl: url,
          authUser: user,
          authPass: pass,
          isConfigured: true
        });

        showStatus(getMessage('testSuccess', 'Connexion réussie !'), 'success');
        setTimeout(async () => {
          showView('download');
          await refreshDownloadData();
        }, 800);
      } else {
        showStatus(`${getMessage('testError', 'Erreur serveur: ')}${res.status}`, 'error');
      }
    } catch (err) {
      showStatus(`${getMessage('errorNetwork', 'Impossible de joindre le serveur')}: ${err.message}`, 'error');
    } finally {
      btnSaveSetup.disabled = false;
    }
  });

  async function refreshDownloadData() {
    if (!settings.serverUrl) return;

    const headers = {};
    if (settings.authUser && settings.authPass) {
      headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    await Promise.all([
      loadProfilesFromServer(settings.serverUrl, headers, settings.defaultProfile),
      loadPresetPathsFromServer(settings.serverUrl, headers, settings.defaultDest)
    ]);

    // Auto-detect YouTube tab URL
    try {
      const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        if (tabs[0].url.includes('youtube.com') || tabs[0].url.includes('youtu.be')) {
          videoUrlInput.value = tabs[0].url;
        }
      }
    } catch (e) {
      console.warn('Tab detection error:', e);
    }
  }

  async function loadProfilesFromServer(baseUrl, reqHeaders, savedDefault) {
    const endpoint = `${baseUrl}/api/profiles`;
    try {
      const res = await fetch(endpoint, { headers: reqHeaders });
      if (res.ok) {
        const profiles = await res.json();
        profileSelect.innerHTML = '';
        if (profiles.length === 0) {
          profileSelect.innerHTML = `<option value="1">Profil par défaut</option>`;
          return;
        }
        profiles.forEach(prof => {
          const opt = document.createElement('option');
          opt.value = prof.id;
          opt.textContent = `${prof.name} (${prof.container.toUpperCase()})`;
          profileSelect.appendChild(opt);
        });

        if (savedDefault && profileSelect.querySelector(`option[value="${savedDefault}"]`)) {
          profileSelect.value = savedDefault;
        }
        return;
      }
    } catch (err) {
      console.warn('Erreur synchro profils:', err);
    }

    profileSelect.innerHTML = `
      <option value="1">4K (2160p)</option>
      <option value="2">1440p (2K)</option>
      <option value="3">1080p (Full HD)</option>
      <option value="4">720p (HD)</option>
      <option value="5">SD (480p)</option>
      <option value="6">Audio Only (MP3)</option>
    `;
  }

  async function loadPresetPathsFromServer(baseUrl, reqHeaders, savedDest) {
    const endpoint = `${baseUrl}/api/preset-paths`;
    const defaultLabel = getMessage('defaultDestOption', 'Dossier par défaut');
    try {
      const res = await fetch(endpoint, { headers: reqHeaders });
      if (res.ok) {
        const paths = await res.json();
        destSelect.innerHTML = `<option value="">${defaultLabel}</option>`;
        paths.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.path;
          opt.textContent = p.label;
          destSelect.appendChild(opt);
        });

        if (savedDest && destSelect.querySelector(`option[value="${savedDest}"]`)) {
          destSelect.value = savedDest;
        }
        return;
      }
    } catch (err) {
      console.warn('Erreur synchro dossiers:', err);
    }

    destSelect.innerHTML = `<option value="">${defaultLabel}</option>`;
  }

  btnSend.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      showStatus(getMessage('errorInvalidUrl', 'Veuillez saisir une URL YouTube valide'), 'error');
      return;
    }

    if (!settings.serverUrl) {
      showView('setup');
      showStatus(getMessage('setupDesc', 'Veuillez configurer votre serveur Sujib'), 'error');
      return;
    }

    const profileId = parseInt(profileSelect.value, 10) || 1;
    const destPath = destSelect.value || '';
    const apiEndpoint = `${settings.serverUrl}/api/download`;

    const reqHeaders = { 'Content-Type': 'application/json' };
    if (settings.authUser && settings.authPass) {
      reqHeaders['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    btnSend.disabled = true;
    showStatus(getMessage('sending', 'Envoi en cours...'), '');

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          url: url,
          title: 'YouTube video',
          profile_id: profileId,
          dest_path: destPath
        })
      });

      if (res.ok) {
        showStatus(getMessage('successDownload', 'Téléchargement lancé avec succès !'), 'success');
        setTimeout(() => window.close(), 1400);
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus(data.detail || `Erreur serveur (${res.status})`, 'error');
      }
    } catch (err) {
      showStatus(`${getMessage('errorNetwork', 'Impossible de joindre le serveur')}: ${err.message}`, 'error');
    } finally {
      btnSend.disabled = false;
    }
  });

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = `status show ${type}`;
  }

  function getMessage(key, fallback) {
    return (extAPI.i18n && extAPI.i18n.getMessage(key)) || fallback || key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const msg = getMessage(key);
      if (msg) el.textContent = msg;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const msg = getMessage(key);
      if (msg) el.placeholder = msg;
    });
  }
});
