document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('server-url');
  const authUserInput = document.getElementById('auth-user');
  const authPassInput = document.getElementById('auth-pass');
  const defaultProfileSelect = document.getElementById('default-profile');
  const btnSave = document.getElementById('btn-save');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  browser.storage.sync.get({
    serverUrl: 'http://192.168.200.15/sujib',
    authUser: '',
    authPass: '',
    defaultProfile: '1'
  }).then((items) => {
    serverUrlInput.value = items.serverUrl;
    authUserInput.value = items.authUser;
    authPassInput.value = items.authPass;
    defaultProfileSelect.value = items.defaultProfile;
  });

  // Save settings
  btnSave.addEventListener('click', () => {
    let url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const user = authUserInput.value.trim();
    const pass = authPassInput.value.trim();
    const profile = defaultProfileSelect.value;

    browser.storage.sync.set({
      serverUrl: url,
      authUser: user,
      authPass: pass,
      defaultProfile: profile
    }).then(() => {
      statusDiv.textContent = 'Paramètres enregistrés avec succès !';
      statusDiv.className = 'status success';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    }).catch((err) => {
      statusDiv.textContent = 'Erreur lors de la sauvegarde : ' + err.message;
      statusDiv.className = 'status error';
    });
  });
});
