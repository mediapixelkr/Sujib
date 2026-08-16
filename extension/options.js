document.addEventListener('DOMContentLoaded', async () => {
  const serverUrlInput = document.getElementById('server-url');
  const authUserInput = document.getElementById('auth-user');
  const authPassInput = document.getElementById('auth-pass');
  const defaultProfileSelect = document.getElementById('default-profile');
  const defaultDestSelect = document.getElementById('default-dest');
  const btnSave = document.getElementById('btn-save');
  const btnTest = document.getElementById('btn-test');
  const statusDiv = document.getElementById('status');

  // Load existing settings
  const settings = await browser.storage.sync.get({
    serverUrl: 'http://192.168.200.15/sujib',
    authUser: '',
    authPass: '',
    defaultProfile: '1',
    defaultDest: ''
  });

  serverUrlInput.value = settings.serverUrl;
  authUserInput.value = settings.authUser;
  authPassInput.value = settings.authPass;

  await syncServerOptions(settings.serverUrl, settings.authUser, settings.authPass, settings.defaultProfile, settings.defaultDest);

  async function syncServerOptions(url, user, pass, savedProf, savedDest) {
    const headers = {};
    if (user && pass) {
      headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
    }

    const baseUrl = url.replace(/\/+$/, '');

    // Sync profiles
    try {
      const res = await fetch(`${baseUrl}/api/profiles`, { headers });
      if (res.ok) {
        const profiles = await res.json();
        defaultProfileSelect.innerHTML = '';
        profiles.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.name} (${p.container.toUpperCase()})`;
          defaultProfileSelect.appendChild(opt);
        });
        if (savedProf && defaultProfileSelect.querySelector(`option[value="${savedProf}"]`)) {
          defaultProfileSelect.value = savedProf;
        }
      }
    } catch (e) {
      console.warn('Profiles load error', e);
    }

    // Sync preset paths
    try {
      const res = await fetch(`${baseUrl}/api/preset-paths`, { headers });
      if (res.ok) {
        const paths = await res.json();
        defaultDestSelect.innerHTML = '<option value="">Dossier global par défaut</option>';
        paths.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.path;
          opt.textContent = p.label;
          defaultDestSelect.appendChild(opt);
        });
        if (savedDest && defaultDestSelect.querySelector(`option[value="${savedDest}"]`)) {
          defaultDestSelect.value = savedDest;
        }
      }
    } catch (e) {
      console.warn('Preset paths load error', e);
    }
  }

  btnTest.addEventListener('click', async () => {
    const url = serverUrlInput.value.trim();
    const user = authUserInput.value.trim();
    const pass = authPassInput.value.trim();

    if (!url) {
      showStatus('Veuillez saisir une URL de serveur', 'error');
      return;
    }

    showStatus('Test de connexion en cours...', '');
    const headers = {};
    if (user && pass) {
      headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
    }

    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/api/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        showStatus(`Connexion réussie ! Sujib v${data.version || '2.0'} opérationnel.`, 'success');
        await syncServerOptions(url, user, pass, defaultProfileSelect.value, defaultDestSelect.value);
      } else {
        showStatus(`Erreur de connexion : statut ${res.status}`, 'error');
      }
    } catch (err) {
      showStatus('Impossible de joindre le serveur : ' + err.message, 'error');
    }
  });

  btnSave.addEventListener('click', async () => {
    const serverUrl = serverUrlInput.value.trim();
    const authUser = authUserInput.value.trim();
    const authPass = authPassInput.value.trim();
    const defaultProfile = defaultProfileSelect.value;
    const defaultDest = defaultDestSelect.value;

    if (!serverUrl) {
      showStatus('Veuillez entrer une URL valide', 'error');
      return;
    }

    await browser.storage.sync.set({
      serverUrl,
      authUser,
      authPass,
      defaultProfile,
      defaultDest
    });

    showStatus('Paramètres enregistrés avec succès !', 'success');
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 2500);
  });

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = `status show ${type}`;
  }
});
