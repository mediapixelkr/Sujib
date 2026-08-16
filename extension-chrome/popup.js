const extAPI = typeof chrome !== 'undefined' ? chrome : browser;

document.addEventListener('DOMContentLoaded', async () => {
  // Apply i18n translations
  applyI18n();

  const videoUrlInput = document.getElementById('video-url');
  const profileSelect = document.getElementById('profile-select');
  const destSelect = document.getElementById('dest-select');
  const btnSend = document.getElementById('btn-send');
  const btnOptions = document.getElementById('btn-open-options');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const settings = await extAPI.storage.sync.get({
    serverUrl: 'http://localhost:8000',
    authUser: '',
    authPass: '',
    defaultProfile: '1',
    defaultDest: ''
  });

  const headers = {};
  if (settings.authUser && settings.authPass) {
    headers['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
  }

  // Load profiles and preset paths from Sujib server
  await Promise.all([
    loadProfilesFromServer(settings.serverUrl, headers, settings.defaultProfile),
    loadPresetPathsFromServer(settings.serverUrl, headers, settings.defaultDest)
  ]);

  // Auto-detect active YouTube tab URL
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

  btnOptions.addEventListener('click', () => {
    extAPI.runtime.openOptionsPage();
  });

  async function loadProfilesFromServer(baseUrl, reqHeaders, savedDefault) {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/profiles`;
    try {
      const res = await fetch(endpoint, { headers: reqHeaders });
      if (res.ok) {
        const profiles = await res.json();
        profileSelect.innerHTML = '';
        if (profiles.length === 0) {
          profileSelect.innerHTML = `<option value="1">${getMessage('defaultProfile', 'Profile 1')}</option>`;
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

  async function loadPresetPathsFromServer(baseUrl, reqHeaders, savedDest) {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/preset-paths`;
    const defaultLabel = getMessage('defaultDestOption', 'Default Folder');
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
      showStatus(getMessage('errorInvalidUrl', 'Please enter a valid YouTube URL'), 'error');
      return;
    }

    const profileId = parseInt(profileSelect.value, 10) || 1;
    const destPath = destSelect.value || '';
    const apiEndpoint = `${settings.serverUrl.replace(/\/+$/, '')}/api/download`;

    const reqHeaders = { 'Content-Type': 'application/json' };
    if (settings.authUser && settings.authPass) {
      reqHeaders['Authorization'] = 'Basic ' + btoa(`${settings.authUser}:${settings.authPass}`);
    }

    btnSend.disabled = true;
    showStatus(getMessage('sending', 'Sending to server...'), '');

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
        showStatus(getMessage('successDownload', 'Download started successfully!'), 'success');
        setTimeout(() => window.close(), 1400);
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus(data.detail || `Server error (${res.status})`, 'error');
      }
    } catch (err) {
      showStatus(`${getMessage('errorNetwork', 'Cannot connect to server')}: ${err.message}`, 'error');
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
