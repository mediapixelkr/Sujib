document.addEventListener('DOMContentLoaded', () => {
    // State
    let profiles = [];
    let queueItems = [];
    let historyItems = [];
    let currentPlaylistData = null;
    let selectedProfileId = 1;

    // DOM Elements
    const ytdlpVerText = document.getElementById('ytdlp-ver-text');
    const btnUpdateYtdlp = document.getElementById('btn-update-ytdlp');
    const btnOpenOptions = document.getElementById('btn-open-options');
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const profilesGrid = document.getElementById('profiles-grid');
    const queueList = document.getElementById('queue-list');
    const queueEmpty = document.getElementById('queue-empty');
    const queueCountBadge = document.getElementById('queue-count-badge');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const historyCountBadge = document.getElementById('history-count-badge');

    // Options Modal Elements
    const optionsModal = document.getElementById('options-modal');
    const optionsForm = document.getElementById('options-form');
    const btnCloseOptions = document.getElementById('btn-close-options');
    const btnCancelOptions = document.getElementById('btn-cancel-options');
    const optDownloadDir = document.getElementById('opt-download-dir');
    const optRenameRegex = document.getElementById('opt-rename-regex');
    const optSubtitles = document.getElementById('opt-subtitles');
    const optSubLang = document.getElementById('opt-sub-lang');

    // Playlist Modal Elements
    const playlistModal = document.getElementById('playlist-modal');
    const playlistTitle = document.getElementById('playlist-title');
    const btnClosePlaylist = document.getElementById('btn-close-playlist');
    const btnCancelPlaylist = document.getElementById('btn-cancel-playlist');
    const btnConfirmPlaylist = document.getElementById('btn-confirm-playlist');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    const playlistSelectedCount = document.getElementById('playlist-selected-count');
    const playlistItemsList = document.getElementById('playlist-items-list');

    // Profile Edit Modal Elements
    const profileEditModal = document.getElementById('profile-edit-modal');
    const profileEditForm = document.getElementById('profile-edit-form');
    const btnCloseProfileEdit = document.getElementById('btn-close-profile-edit');
    const btnCancelProfileEdit = document.getElementById('btn-cancel-profile-edit');
    const profEditId = document.getElementById('prof-edit-id');
    const profEditName = document.getElementById('prof-edit-name');
    const profEditDest = document.getElementById('prof-edit-dest');
    const profEditContainer = document.getElementById('prof-edit-container');
    const profEditRes = document.getElementById('prof-edit-res');
    const profEditFormat = document.getElementById('prof-edit-format');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Initialize App
    init();

    async function init() {
        await loadStatus();
        await loadProfiles();
        await loadQueue();
        await loadHistory();
        setupSSE();
        setupEventListeners();
    }

    // Helper: Toast Notifications
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    // API Calls & Data Loaders
    async function loadStatus() {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                ytdlpVerText.textContent = data.ytdlp_version || 'Inconnu';
            }
        } catch (err) {
            console.error('Error loading status', err);
        }
    }

    async function loadProfiles() {
        try {
            const res = await fetch('/api/profiles');
            if (res.ok) {
                profiles = await res.json();
                renderProfiles();
            }
        } catch (err) {
            console.error('Error loading profiles', err);
        }
    }

    async function loadQueue() {
        try {
            const res = await fetch('/api/queue');
            if (res.ok) {
                queueItems = await res.json();
                renderQueue();
            }
        } catch (err) {
            console.error('Error loading queue', err);
        }
    }

    async function loadHistory() {
        try {
            const res = await fetch('/api/downloaded');
            if (res.ok) {
                historyItems = await res.json();
                renderHistory();
            }
        } catch (err) {
            console.error('Error loading history', err);
        }
    }

    // SSE Connection for Live Progress
    function setupSSE() {
        const evtSource = new EventSource('/api/events');
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.event === 'progress' || data.event === 'completed' || data.event === 'failed' || data.event === 'cancelled') {
                    loadQueue();
                    if (data.event === 'completed') {
                        loadHistory();
                    }
                }
            } catch (err) {
                console.error('SSE parse error', err);
            }
        };
    }

    // Render Profiles (with Drag & Drop support)
    function renderProfiles() {
        profilesGrid.replaceChildren();

        profiles.forEach(profile => {
            const card = document.createElement('div');
            card.className = `profile-card ${profile.id === selectedProfileId ? 'selected' : ''}`;
            card.dataset.profileId = profile.id;

            // Edit button top corner
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-profile-edit';
            editBtn.title = 'Éditer ce profil (Dossier, Qualité, Conteneur)';
            editBtn.innerHTML = '⚙️';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openProfileEditModal(profile);
            });

            const iconDiv = document.createElement('div');
            iconDiv.className = 'profile-icon';
            iconDiv.innerHTML = profile.audio_only === 1
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'profile-name';
            nameDiv.textContent = profile.name;

            const subDiv = document.createElement('div');
            subDiv.className = 'profile-sub';
            subDiv.textContent = profile.container ? profile.container.toUpperCase() : 'MKV';

            const destDiv = document.createElement('div');
            destDiv.className = 'profile-dest-badge';
            destDiv.title = profile.dest_path ? `Chemin spécifique: ${profile.dest_path}` : 'Dossier de destination par défaut';
            destDiv.textContent = profile.dest_path ? `📁 ${profile.dest_path}` : '📁 Dossier par défaut';

            card.appendChild(editBtn);
            card.appendChild(iconDiv);
            card.appendChild(nameDiv);
            card.appendChild(subDiv);
            card.appendChild(destDiv);

            // Click handler
            card.addEventListener('click', () => {
                selectedProfileId = profile.id;
                renderProfiles();
            });

            // Drag & Drop handlers
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
                if (text && text.trim().startsWith('http')) {
                    urlInput.value = text.trim();
                    handleAnalyzeOrDownload(text.trim(), profile.id);
                }
            });

            profilesGrid.appendChild(card);
        });
    }

    // Render Active Queue Cards
    function renderQueue() {
        const activeItems = queueItems.filter(q => q.status === 'pending' || q.status === 'downloading');
        queueCountBadge.textContent = activeItems.length;

        if (activeItems.length === 0) {
            queueEmpty.style.display = 'block';
            queueList.replaceChildren(queueEmpty);
            return;
        }

        queueEmpty.style.display = 'none';
        queueList.replaceChildren();

        activeItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';

            const progressBg = document.createElement('div');
            progressBg.className = 'progress-bg';
            progressBg.style.width = `${item.progress_pct || 0}%`;

            const content = document.createElement('div');
            content.className = 'item-content';

            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.title || item.filename || 'Téléchargement en cours...';

            const meta = document.createElement('div');
            meta.className = 'item-meta';

            const pSpan = document.createElement('span');
            pSpan.textContent = `Profil: ${item.profile_name}`;

            const pctSpan = document.createElement('span');
            pctSpan.textContent = `${item.progress_pct || 0}%`;

            const speedSpan = document.createElement('span');
            speedSpan.textContent = item.speed || '';

            const etaSpan = document.createElement('span');
            etaSpan.textContent = item.eta ? `ETA: ${item.eta}` : '';

            meta.appendChild(pSpan);
            meta.appendChild(pctSpan);
            if (item.speed) meta.appendChild(speedSpan);
            if (item.eta) meta.appendChild(etaSpan);

            content.appendChild(title);
            content.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'item-actions';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn-sm btn-outline';
            btnCancel.textContent = 'Annuler';
            btnCancel.addEventListener('click', async () => {
                await fetch(`/api/queue/${item.id}`, { method: 'DELETE' });
                showToast('Téléchargement annulé', 'info');
                loadQueue();
            });

            actions.appendChild(btnCancel);

            card.appendChild(progressBg);
            card.appendChild(content);
            card.appendChild(actions);

            queueList.appendChild(card);
        });
    }

    // Render Downloaded History Cards
    function renderHistory() {
        historyCountBadge.textContent = historyItems.length;

        if (historyItems.length === 0) {
            historyEmpty.style.display = 'block';
            historyList.replaceChildren(historyEmpty);
            return;
        }

        historyEmpty.style.display = 'none';
        historyList.replaceChildren();

        historyItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';

            const content = document.createElement('div');
            content.className = 'item-content';

            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.filename || item.title;

            const meta = document.createElement('div');
            meta.className = 'item-meta';

            const resSpan = document.createElement('span');
            resSpan.textContent = `Qualité: ${item.resolution || 'Auto'}`;

            const sizeSpan = document.createElement('span');
            const sizeMB = (item.filesize / (1024 * 1024)).toFixed(1);
            sizeSpan.textContent = `${sizeMB} MB`;

            const dateSpan = document.createElement('span');
            dateSpan.textContent = item.downloaded_at ? item.downloaded_at.substring(0, 16) : '';

            meta.appendChild(resSpan);
            meta.appendChild(sizeSpan);
            meta.appendChild(dateSpan);

            content.appendChild(title);
            content.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'item-actions';

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-outline';
            btnDel.textContent = 'Supprimer';
            btnDel.addEventListener('click', async () => {
                await fetch(`/api/downloaded/${item.id}?delete_file=true`, { method: 'DELETE' });
                showToast('Fichier et historique supprimés', 'success');
                loadHistory();
            });

            actions.appendChild(btnDel);

            card.appendChild(content);
            card.appendChild(actions);

            historyList.appendChild(card);
        });
    }

    // Process Input URL or Dragged Link
    async function handleAnalyzeOrDownload(url, profileId) {
        if (!url) return;
        showToast('Analyse de l\'URL en cours...', 'info');

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!res.ok) {
                const errData = await res.json();
                showToast(errData.detail || 'Erreur lors de l\'analyse', 'error');
                return;
            }

            const data = await res.json();

            if (data.type === 'playlist') {
                openPlaylistModal(data, profileId);
            } else {
                // Direct Video download request
                const dlRes = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: data.url,
                        title: data.title,
                        video_id: data.id,
                        profile_id: profileId
                    })
                });

                if (dlRes.ok) {
                    showToast('Ajouté à la file de téléchargement !', 'success');
                    urlInput.value = '';
                    loadQueue();
                } else {
                    showToast('Erreur lors de l\'ajout à la file', 'error');
                }
            }
        } catch (err) {
            showToast('Erreur réseau lors de l\'analyse', 'error');
        }
    }

    // Playlist Selection Modal Handling
    function openPlaylistModal(playlistData, profileId) {
        currentPlaylistData = { playlistData, profileId };
        playlistTitle.textContent = `Playlist: ${playlistData.title} (${playlistData.videos.length} vidéos)`;
        playlistItemsList.replaceChildren();

        playlistData.videos.forEach((video, index) => {
            const row = document.createElement('div');
            row.className = 'playlist-item-row';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = true;
            chk.id = `pl-vid-${index}`;
            chk.dataset.index = index;
            chk.addEventListener('change', updatePlaylistCounter);

            const label = document.createElement('label');
            label.htmlFor = `pl-vid-${index}`;
            label.textContent = video.title;

            row.appendChild(chk);
            row.appendChild(label);
            playlistItemsList.appendChild(row);
        });

        updatePlaylistCounter();
        playlistModal.classList.remove('hidden');
    }

    function updatePlaylistCounter() {
        const checkboxes = playlistItemsList.querySelectorAll('input[type="checkbox"]:checked');
        playlistSelectedCount.textContent = `${checkboxes.length} sélectionné(s)`;
    }

    // Setup Form & Modal Listeners
    function setupEventListeners() {
        urlForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAnalyzeOrDownload(urlInput.value.trim(), selectedProfileId);
        });

        // Options Modal
        btnOpenOptions.addEventListener('click', async () => {
            const res = await fetch('/api/options');
            if (res.ok) {
                const opt = await res.json();
                optDownloadDir.value = opt.download_dir || '';
                optRenameRegex.value = opt.rename_regex || '';
                optSubtitles.value = opt.subtitles || 0;
                optSubLang.value = opt.sub_lang || 'en';
                optionsModal.classList.remove('hidden');
            }
        });

        const closeOptions = () => optionsModal.classList.add('hidden');
        btnCloseOptions.addEventListener('click', closeOptions);
        btnCancelOptions.addEventListener('click', closeOptions);

        optionsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                download_dir: optDownloadDir.value.trim(),
                rename_regex: optRenameRegex.value,
                show_last: 20,
                subtitles: parseInt(optSubtitles.value, 10),
                sub_lang: optSubLang.value.trim()
            };

            const res = await fetch('/api/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                showToast('Options enregistrées avec succès !', 'success');
                closeOptions();
            } else {
                showToast('Erreur lors de l\'enregistrement des options', 'error');
            }
        });

        // yt-dlp Update Button
        btnUpdateYtdlp.addEventListener('click', async () => {
            showToast('Mise à jour de yt-dlp en cours...', 'info');
            btnUpdateYtdlp.disabled = true;
            try {
                const res = await fetch('/api/update-ytdlp', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    loadStatus();
                } else {
                    showToast(data.message || 'Mise à jour échouée', 'error');
                }
            } catch (err) {
                showToast('Erreur réseau pendant la mise à jour', 'error');
            } finally {
                btnUpdateYtdlp.disabled = false;
            }
        });

        // Playlist Modal Actions
        const closePlaylist = () => playlistModal.classList.add('hidden');
        btnClosePlaylist.addEventListener('click', closePlaylist);
        btnCancelPlaylist.addEventListener('click', closePlaylist);

        btnSelectAll.addEventListener('click', () => {
            playlistItemsList.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
            updatePlaylistCounter();
        });

        btnDeselectAll.addEventListener('click', () => {
            playlistItemsList.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
            updatePlaylistCounter();
        });

        btnConfirmPlaylist.addEventListener('click', async () => {
            if (!currentPlaylistData) return;
            const checkedBoxes = playlistItemsList.querySelectorAll('input[type="checkbox"]:checked');
            if (checkedBoxes.length === 0) {
                showToast('Veuillez sélectionner au moins une vidéo', 'info');
                return;
            }

            const { playlistData, profileId } = currentPlaylistData;
            closePlaylist();
            showToast(`Ajout de ${checkedBoxes.length} vidéo(s) à la file...`, 'info');

            for (const chk of checkedBoxes) {
                const idx = parseInt(chk.dataset.index, 10);
                const video = playlistData.videos[idx];
                await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: video.url,
                        title: video.title,
                        video_id: video.id,
                        profile_id: profileId
                    })
                });
            }

            urlInput.value = '';
            showToast('Toutes les vidéos sélectionnées ont été ajoutées !', 'success');
            loadQueue();
        });

        // Profile Edit Modal Actions
        const closeProfileEdit = () => profileEditModal.classList.add('hidden');
        btnCloseProfileEdit.addEventListener('click', closeProfileEdit);
        btnCancelProfileEdit.addEventListener('click', closeProfileEdit);

        profileEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pid = parseInt(profEditId.value, 10);
            const body = {
                name: profEditName.value.trim(),
                dest_path: profEditDest.value.trim(),
                container: profEditContainer.value,
                max_res: profEditRes.value.trim(),
                format_spec: profEditFormat.value.trim(),
                audio_only: profEditContainer.value === 'mp3' ? 1 : 0
            };

            const res = await fetch(`/api/profiles/${pid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                showToast('Profil mis à jour avec succès !', 'success');
                closeProfileEdit();
                await loadProfiles();
            } else {
                showToast('Erreur lors de la mise à jour du profil', 'error');
            }
        });
    }

    function openProfileEditModal(profile) {
        profEditId.value = profile.id;
        profEditName.value = profile.name || '';
        profEditDest.value = profile.dest_path || '';
        profEditContainer.value = profile.container || 'mkv';
        profEditRes.value = profile.max_res || '';
        profEditFormat.value = profile.format_spec || '';
        profileEditModal.classList.remove('hidden');
    }
});
