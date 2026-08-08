document.addEventListener('DOMContentLoaded', () => {
    // ─── API path helper (subpath aware) ─────────────────────────────────────
    function apiPath(endpoint) {
        const base = window.location.pathname.replace(/\/+$/, '').replace(/\/[^/]*\.[^/]*$/, '');
        // Detect if we're under /sujib/
        const parts = window.location.pathname.split('/').filter(Boolean);
        const appBase = parts.length > 0 && !parts[parts.length-1].includes('.') ? window.location.pathname.replace(/\/$/, '') : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return `${appBase}/api${path}`;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    let profiles = [];
    let presetPaths = [];
    let queueItems = [];
    let historyItems = [];
    let currentPlaylistData = null;
    let selectedProfileId = 1;
    let hoveredDragProfile = null;

    // ─── DOM: Header ──────────────────────────────────────────────────────────
    const ytdlpVerText    = document.getElementById('ytdlp-ver-text');
    const btnUpdateYtdlp  = document.getElementById('btn-update-ytdlp');
    const btnOpenOptions  = document.getElementById('btn-open-options');

    // ─── DOM: Top Cards ───────────────────────────────────────────────────────
    const topCardsContainer  = document.getElementById('top-cards-container');
    const dropTargetCard     = document.getElementById('drop-target-card');
    const dropNormalState    = document.getElementById('drop-normal-state');
    const dropExpandedLayer  = document.getElementById('drop-expanded-layer');
    const dragProfilesList   = document.getElementById('drag-profiles-list');
    const dragPathsFlyout    = document.getElementById('drag-paths-flyout');
    const flyoutProfileTitle = document.getElementById('flyout-profile-title');
    const flyoutPathsList    = document.getElementById('flyout-paths-list');

    // ─── DOM: URL Form ────────────────────────────────────────────────────────
    const urlForm   = document.getElementById('url-form');
    const urlInput  = document.getElementById('url-input');

    // ─── DOM: Queue / History ─────────────────────────────────────────────────
    const queueList         = document.getElementById('queue-list');
    const queueEmpty        = document.getElementById('queue-empty');
    const queueCountBadge   = document.getElementById('queue-count-badge');
    const historyList       = document.getElementById('history-list');
    const historyEmpty      = document.getElementById('history-empty');
    const historyCountBadge = document.getElementById('history-count-badge');

    // ─── DOM: Config Modal ────────────────────────────────────────────────────
    const optionsModal   = document.getElementById('options-modal');
    const btnCloseOptions= document.getElementById('btn-close-options');
    const btnDoneOptions = document.getElementById('btn-done-options');

    // Accordion section: Preset paths
    const presetNewLabel  = document.getElementById('preset-new-label');
    const presetNewPath   = document.getElementById('preset-new-path');
    const btnAddPreset    = document.getElementById('btn-add-preset');
    const presetPathsList = document.getElementById('preset-paths-list');

    // Accordion section: Profiles
    const pmViewList        = document.getElementById('pm-view-list');
    const pmViewForm        = document.getElementById('pm-view-form');
    const profilesManagerList = document.getElementById('profiles-manager-list');
    const btnNewProfile     = document.getElementById('btn-new-profile');
    const chkShowArchived   = document.getElementById('chk-show-archived');
    const btnBackToPmList   = document.getElementById('btn-back-to-pm-list');
    const pmFormModeTitle   = document.getElementById('pm-form-mode-title');
    const profileEditForm   = document.getElementById('profile-edit-form');
    const profEditId        = document.getElementById('prof-edit-id');
    const profEditName      = document.getElementById('prof-edit-name');
    const profEditDest      = document.getElementById('prof-edit-dest');
    const profEditContainer = document.getElementById('prof-edit-container');
    const profEditRes       = document.getElementById('prof-edit-res');
    const profEditFormat    = document.getElementById('prof-edit-format');
    const btnCancelProfileEdit = document.getElementById('btn-cancel-profile-edit');

    // Accordion section: System options
    const optionsForm    = document.getElementById('options-form');
    const optDownloadDir = document.getElementById('opt-download-dir');
    const optRenameRegex = document.getElementById('opt-rename-regex');
    const optSubtitles   = document.getElementById('opt-subtitles');
    const optSubLang     = document.getElementById('opt-sub-lang');
    const optShowLast    = document.getElementById('opt-show-last');

    // ─── DOM: Playlist Modal ──────────────────────────────────────────────────
    const playlistModal         = document.getElementById('playlist-modal');
    const playlistTitle         = document.getElementById('playlist-title');
    const btnClosePlaylist      = document.getElementById('btn-close-playlist');
    const btnCancelPlaylist     = document.getElementById('btn-cancel-playlist');
    const btnConfirmPlaylist    = document.getElementById('btn-confirm-playlist');
    const btnSelectAll          = document.getElementById('btn-select-all');
    const btnDeselectAll        = document.getElementById('btn-deselect-all');
    const playlistSelectedCount = document.getElementById('playlist-selected-count');
    const playlistItemsList     = document.getElementById('playlist-items-list');

    // ─── DOM: Toast ───────────────────────────────────────────────────────────
    const toastContainer = document.getElementById('toast-container');

    // ─────────────────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────────────────
    init();

    async function init() {
        await loadStatus();
        await loadProfiles();
        await loadPresetPaths();
        await loadQueue();
        await loadHistory();
        setupSSE();
        setupEventListeners();
        setupAccordion();
        setupDragTarget();
    }

    // ─── Toast ────────────────────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    // ─── API: Status ──────────────────────────────────────────────────────────
    async function loadStatus() {
        try {
            const res = await fetch(apiPath('/status'));
            if (res.ok) {
                const data = await res.json();
                ytdlpVerText.textContent = data.ytdlp_version || 'Inconnu';
            }
        } catch (err) { console.error('loadStatus error', err); }
    }

    // ─── API: Profiles ────────────────────────────────────────────────────────
    async function loadProfiles() {
        try {
            const res = await fetch(apiPath('/profiles'));
            if (res.ok) { profiles = await res.json(); }
        } catch (err) { console.error('loadProfiles error', err); }
    }

    // ─── API: Preset Paths ────────────────────────────────────────────────────
    async function loadPresetPaths() {
        try {
            const res = await fetch(apiPath('/preset-paths'));
            if (res.ok) {
                presetPaths = await res.json();
                renderPresetPathsList();
            }
        } catch (err) { console.error('loadPresetPaths error', err); }
    }

    function renderPresetPathsList() {
        if (!presetPathsList) return;
        presetPathsList.replaceChildren();
        if (presetPaths.length === 0) {
            presetPathsList.innerHTML = '<div class="empty-state">Aucun dossier pré-enregistré. Ajoutez-en un ci-dessus.</div>';
            return;
        }
        presetPaths.forEach(item => {
            const row = document.createElement('div');
            row.className = 'preset-path-row';

            const info = document.createElement('div');
            info.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
            info.innerHTML = `<strong>${item.icon || '📁'} ${item.label}</strong><span style="font-size:0.8rem;color:var(--text-muted);">${item.path || '— Dossier par défaut (global)'}</span>`;

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-outline';
            btnDel.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);white-space:nowrap;';
            btnDel.textContent = '🗑️ Supprimer';
            btnDel.addEventListener('click', async () => {
                if (!confirm(`Supprimer « ${item.label} » ?`)) return;
                await fetch(apiPath(`/preset-paths/${item.id}`), { method: 'DELETE' });
                showToast('Dossier supprimé', 'info');
                await loadPresetPaths();
            });

            row.appendChild(info);
            row.appendChild(btnDel);
            presetPathsList.appendChild(row);
        });
    }

    // ─── API: Queue ───────────────────────────────────────────────────────────
    async function loadQueue() {
        try {
            const res = await fetch(apiPath('/queue'));
            if (res.ok) { queueItems = await res.json(); renderQueue(); }
        } catch (err) { console.error('loadQueue error', err); }
    }

    function renderQueue() {
        queueList.replaceChildren();
        const active = queueItems.filter(i => ['pending','downloading'].includes(i.status));
        queueCountBadge.textContent = active.length;

        if (queueItems.length === 0) { queueList.appendChild(queueEmpty); return; }

        queueItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'queue-item';

            const info = document.createElement('div');
            info.className = 'queue-info';

            const title = document.createElement('span');
            title.className = 'queue-title';
            title.textContent = item.title || item.url;

            const meta = document.createElement('span');
            meta.className = 'queue-meta';
            meta.textContent = `${item.profile_name || ''} · ${item.status}`;

            const progressBar = document.createElement('div');
            progressBar.className = 'queue-progress';
            if (item.status === 'downloading') {
                const fill = document.createElement('div');
                fill.className = 'queue-progress-fill';
                fill.style.width = `${item.progress_pct || 0}%`;
                progressBar.appendChild(fill);
            }

            info.appendChild(title);
            info.appendChild(meta);
            if (item.status === 'downloading') info.appendChild(progressBar);

            const actions = document.createElement('div');
            actions.className = 'queue-actions';

            if (['pending','downloading'].includes(item.status)) {
                const btnCancel = document.createElement('button');
                btnCancel.className = 'btn-sm btn-outline';
                btnCancel.textContent = 'Annuler';
                btnCancel.addEventListener('click', async () => {
                    await fetch(apiPath(`/queue/${item.id}`), { method: 'DELETE' });
                    showToast('Téléchargement annulé', 'info');
                    loadQueue();
                });
                actions.appendChild(btnCancel);
            }

            row.appendChild(info);
            row.appendChild(actions);
            queueList.appendChild(row);
        });
    }

    // ─── API: History ─────────────────────────────────────────────────────────
    async function loadHistory() {
        try {
            const res = await fetch(apiPath('/downloaded'));
            if (res.ok) { historyItems = await res.json(); renderHistory(); }
        } catch (err) { console.error('loadHistory error', err); }
    }

    function renderHistory() {
        historyList.replaceChildren();
        historyCountBadge.textContent = historyItems.length;

        if (historyItems.length === 0) { historyList.appendChild(historyEmpty); return; }

        historyItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'history-item';

            const info = document.createElement('div');
            info.className = 'history-info';

            const title = document.createElement('span');
            title.className = 'history-title';
            title.textContent = item.title || item.filename;

            const meta = document.createElement('span');
            meta.className = 'history-meta';
            const size = item.filesize ? `${(item.filesize / 1024 / 1024).toFixed(1)} MB` : '';
            meta.textContent = [item.resolution, item.format_info, size].filter(Boolean).join(' · ');

            info.appendChild(title);
            info.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'history-actions';

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-outline';
            btnDel.textContent = 'Supprimer';
            btnDel.addEventListener('click', async () => {
                await fetch(apiPath(`/downloaded/${item.id}?delete_file=true`), { method: 'DELETE' });
                showToast('Fichier supprimé', 'success');
                loadHistory();
            });
            actions.appendChild(btnDel);

            row.appendChild(info);
            row.appendChild(actions);
            historyList.appendChild(row);
        });
    }

    // ─── SSE ──────────────────────────────────────────────────────────────────
    function setupSSE() {
        const evtSource = new EventSource(apiPath('/events'));
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (['progress','completed','failed','cancelled'].includes(data.event)) {
                    loadQueue();
                    if (data.event === 'completed') loadHistory();
                }
            } catch (err) { console.error('SSE parse error', err); }
        };
    }

    // ─── Accordion ────────────────────────────────────────────────────────────
    function setupAccordion() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const isActive = item.classList.contains('active');

                document.querySelectorAll('.accordion-item').forEach(i => {
                    i.classList.remove('active');
                    const icon = i.querySelector('.accordion-icon');
                    if (icon) icon.textContent = '▼';
                });

                if (!isActive) {
                    item.classList.add('active');
                    const icon = header.querySelector('.accordion-icon');
                    if (icon) icon.textContent = '▲';
                    // Load profiles when profiles accordion opens
                    if (item.id === 'acc-profiles') loadManagerProfiles();
                }
            });
        });
    }

    // ─── Drag & Drop Cascading Selector ──────────────────────────────────────
    const cascadeState = {
        active: false,
        mode: 'idle', // 'idle' | 'dragging' | 'click_pending'
        url: null,
        hoveredProfile: null,
        selectedProfile: null,
        hoveredDest: null,
        selectedDest: null,
        dragDepth: 0,
        hoverTimer: null,
        leaveTimer: null
    };

    function extractUrl(e) {
        if (!e || !e.dataTransfer) return cascadeState.url;
        let text = '';
        try {
            text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/html') || '';
        } catch (err) {}
        const match = text.match(/https?:\/\/[^\s"'<>()]+/i);
        return match ? match[0] : cascadeState.url;
    }

    function isUrlDragPayload(e) {
        if (!e.dataTransfer) return false;
        const types = Array.from(e.dataTransfer.types || []);
        return types.includes('text/uri-list') || types.includes('text/plain') || types.includes('text/html') || types.includes('URL');
    }

    function setupDragTarget() {
        const zone = document.getElementById('drag-cascade-zone');
        const dropCard = document.getElementById('drop-target-card');
        const panel = document.getElementById('drag-cascade-panel');
        const btnCancel = document.getElementById('btn-cascade-cancel');

        if (!zone || !dropCard) return;

        // Master Zone Drag Enter
        zone.addEventListener('dragenter', (e) => {
            if (!isUrlDragPayload(e)) return;
            e.preventDefault();
            cascadeState.dragDepth++;
            if (cascadeState.leaveTimer) {
                clearTimeout(cascadeState.leaveTimer);
                cascadeState.leaveTimer = null;
            }
            if (!cascadeState.active) {
                activateCascadeDrag();
            }
        });

        // Master Zone Drag Over
        zone.addEventListener('dragover', (e) => {
            if (!isUrlDragPayload(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (cascadeState.leaveTimer) {
                clearTimeout(cascadeState.leaveTimer);
                cascadeState.leaveTimer = null;
            }
        });

        // Master Zone Drag Leave
        zone.addEventListener('dragleave', (e) => {
            cascadeState.dragDepth = Math.max(0, cascadeState.dragDepth - 1);
            if (cascadeState.dragDepth === 0 && cascadeState.mode === 'dragging') {
                cascadeState.leaveTimer = setTimeout(() => {
                    if (cascadeState.dragDepth === 0 && cascadeState.mode === 'dragging') {
                        resetCascadeState();
                    }
                }, 150);
            }
        });

        // Drop Card Drag Over & Drop
        dropCard.addEventListener('dragover', (e) => {
            if (!isUrlDragPayload(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        dropCard.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const extracted = extractUrl(e);
            if (!extracted) {
                showToast('Aucune URL valide trouvée', 'error');
                return;
            }
            cascadeState.url = extracted;
            cascadeState.mode = 'click_pending';
            activateCascadeDrag(extracted);
            revealDestinationRow();
            showToast('Lien enregistré ! Cliquez sur un profil puis un dossier.', 'info');
        });

        // Drop Card Click Support (for direct click or keyboard)
        dropCard.addEventListener('click', (e) => {
            if (cascadeState.active && cascadeState.mode === 'click_pending') {
                return;
            }
            cascadeState.mode = 'click_pending';
            activateCascadeDrag();
            revealDestinationRow();
        });

        dropCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropCard.click();
            }
        });

        // Cancel button
        if (btnCancel) {
            btnCancel.addEventListener('click', (e) => {
                e.stopPropagation();
                resetCascadeState();
            });
        }
    }

    function activateCascadeDrag(initialUrl = null) {
        cascadeState.active = true;
        if (cascadeState.mode === 'idle') {
            cascadeState.mode = 'dragging';
        }
        if (initialUrl) cascadeState.url = initialUrl;

        const container = document.getElementById('top-cards-container');
        const dropCard = document.getElementById('drop-target-card');
        const expandedContent = document.getElementById('card-expanded-content');

        if (container) container.classList.add('drag-expanded');
        if (dropCard) dropCard.classList.add('drag-hovering');
        if (expandedContent) expandedContent.classList.remove('hidden');

        renderCascadeProfiles();
        updateSummaryText();
    }

    function renderCascadeProfiles() {
        const listEl = document.getElementById('drag-profiles-list');
        if (!listEl) return;
        listEl.replaceChildren();

        const activeProfiles = profiles.length > 0 ? profiles : [
            { id: 1, name: '4K (2160p)', max_res: '2160p', container: 'mkv' },
            { id: 2, name: '1440p (2K)', max_res: '1440p', container: 'mkv' },
            { id: 3, name: '1080p (Full HD)', max_res: '1080p', container: 'mkv' },
            { id: 4, name: '720p (HD)', max_res: '720p', container: 'mp4' },
            { id: 5, name: 'Audio Only (MP3)', max_res: 'audio', container: 'mp3' }
        ];

        activeProfiles.forEach(prof => {
            const pill = document.createElement('div');
            pill.className = 'cascade-pill profile-pill';
            pill.tabIndex = 0;
            pill.role = 'button';
            pill.setAttribute('aria-label', `Profil ${prof.name}`);

            if (cascadeState.selectedProfile && cascadeState.selectedProfile.id === prof.id) {
                pill.classList.add('active');
            }

            pill.innerHTML = `
                <span>${prof.name}</span>
                <span class="cascade-pill-tag">${(prof.container || 'mkv').toUpperCase()}</span>
            `;

            // Drag Enter / Over
            pill.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleProfileHover(prof);
            });

            pill.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
            });

            // Early Drop on Profile
            pill.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = extractUrl(e) || cascadeState.url;
                if (!url) {
                    showToast('Aucun lien valide détecté', 'error');
                    return;
                }
                cascadeState.url = url;
                cascadeState.selectedProfile = prof;
                cascadeState.mode = 'click_pending';
                updateProfilePillsSelection(prof.id);
                revealDestinationRow();
                showToast(`Profil ${prof.name} sélectionné. Survolez ou cliquez sur un dossier pour lancer.`, 'info');
            });

            // Click Support
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                cascadeState.selectedProfile = prof;
                updateProfilePillsSelection(prof.id);
                revealDestinationRow();
            });

            // Keyboard Focus & Keydown Support
            pill.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pill.click();
                }
            });

            listEl.appendChild(pill);
        });
    }

    function handleProfileHover(prof) {
        cascadeState.hoveredProfile = prof;
        cascadeState.selectedProfile = prof;

        updateProfilePillsSelection(prof.id);
        updateSummaryText();

        if (cascadeState.hoverTimer) clearTimeout(cascadeState.hoverTimer);
        cascadeState.hoverTimer = setTimeout(() => {
            revealDestinationRow();
        }, 120); // 100-150ms delay
    }

    function updateProfilePillsSelection(selectedId) {
        const listEl = document.getElementById('drag-profiles-list');
        if (!listEl) return;
        const activeProfiles = profiles.length > 0 ? profiles : [
            { id: 1, name: '4K (2160p)' }, { id: 2, name: '1440p (2K)' },
            { id: 3, name: '1080p (Full HD)' }, { id: 4, name: '720p (HD)' }, { id: 5, name: 'Audio Only (MP3)' }
        ];

        listEl.querySelectorAll('.cascade-pill').forEach((pill, idx) => {
            const p = activeProfiles[idx];
            if (p && p.id === selectedId) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    function revealDestinationRow() {
        const flyout = document.getElementById('drag-paths-flyout');
        const flyoutTitle = document.getElementById('flyout-profile-title');
        const profName = cascadeState.selectedProfile ? cascadeState.selectedProfile.name : 'Profil';

        if (flyoutTitle) flyoutTitle.textContent = `📁 Dossier de destination pour « ${profName} » :`;
        if (flyout) flyout.classList.remove('hidden');

        renderCascadeDestinations();
        updateSummaryText();
    }

    function renderCascadeDestinations() {
        const listEl = document.getElementById('drag-dests-list');
        if (!listEl) return;
        listEl.replaceChildren();

        const activeDests = presetPaths.length > 0 ? presetPaths : [
            { id: 1, label: 'Dossier par défaut (Global)', path: '', icon: '📁' },
            { id: 2, label: 'Albums US', path: '/var/www/html/sujib/downloads/Albums_US', icon: '💿' },
            { id: 3, label: 'MV K-Pop', path: '/var/www/html/sujib/downloads/KPop_MV', icon: '🎵' },
            { id: 4, label: 'Musique / EDM', path: '/var/www/html/sujib/downloads/EDM', icon: '🎧' }
        ];

        activeDests.forEach(dest => {
            const pill = document.createElement('div');
            pill.className = 'cascade-pill dest-pill';
            pill.tabIndex = 0;
            pill.role = 'button';
            pill.setAttribute('aria-label', `Dossier ${dest.label}`);

            if (cascadeState.selectedDest && (cascadeState.selectedDest.id === dest.id || cascadeState.selectedDest.path === dest.path)) {
                pill.classList.add('active');
            }

            const pathDisplay = dest.path ? dest.path : '— Dossier par défaut (Global)';

            pill.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;font-weight:600;">
                    <span>${dest.icon || '📁'} ${dest.label}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);word-break:break-all;">${pathDisplay}</div>
            `;

            // Drag Enter / Over
            pill.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDestHover(dest);
            });

            pill.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
            });

            // Drop on Destination Pill -> Instant Launch Download!
            pill.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleDestinationDrop(dest, e);
            });

            // Click Support
            pill.addEventListener('click', async (e) => {
                e.stopPropagation();
                cascadeState.selectedDest = dest;
                updateDestPillsSelection(dest.id || dest.path);

                if (cascadeState.url) {
                    await handleDestinationDrop(dest, null);
                } else {
                    showToast(`Dossier « ${dest.label} » sélectionné. Collez une URL dans la barre de droite pour lancer.`, 'info');
                }
            });

            pill.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pill.click();
                }
            });

            listEl.appendChild(pill);
        });
    }

    function handleDestHover(dest) {
        cascadeState.hoveredDest = dest;
        cascadeState.selectedDest = dest;

        updateDestPillsSelection(dest.id || dest.path);
        updateSummaryText();
    }

    function updateDestPillsSelection(selectedKey) {
        const listEl = document.getElementById('drag-dests-list');
        if (!listEl) return;
        const activeDests = presetPaths.length > 0 ? presetPaths : [
            { id: 1, label: 'Dossier par défaut (Global)', path: '', icon: '📁' },
            { id: 2, label: 'Albums US', path: '/var/www/html/sujib/downloads/Albums_US', icon: '💿' },
            { id: 3, label: 'MV K-Pop', path: '/var/www/html/sujib/downloads/KPop_MV', icon: '🎵' },
            { id: 4, label: 'Musique / EDM', path: '/var/www/html/sujib/downloads/EDM', icon: '🎧' }
        ];

        listEl.querySelectorAll('.cascade-pill').forEach((pill, idx) => {
            const d = activeDests[idx];
            if (d && (d.id === selectedKey || d.path === selectedKey)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    async function handleDestinationDrop(dest, e) {
        const url = (e ? extractUrl(e) : null) || cascadeState.url;

        if (!url) {
            showToast('Aucun lien YouTube valide détecté', 'error');
            return;
        }

        const prof = cascadeState.selectedProfile || profiles[0] || { id: 1, name: 'Default' };
        const destPath = dest.path || '';
        const destLabel = dest.label || 'Dossier par défaut';

        showToast(`🚀 Téléchargement : ${prof.name} ➔ ${destLabel}`, 'success');

        try {
            const res = await fetch(apiPath('/download'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    profile_id: prof.id,
                    dest_path: destPath
                })
            });

            if (res.ok) {
                showToast('Ajouté à la file de téléchargement !', 'success');
                loadQueue();
            } else {
                showToast('Erreur lors de l\'ajout à la file', 'error');
            }
        } catch (err) {
            showToast('Erreur réseau pendant le téléchargement', 'error');
        }

        resetCascadeState();
    }

    function updateSummaryText() {
        const summaryEl = document.getElementById('cascade-summary-text');
        if (!summaryEl) return;

        const profName = cascadeState.selectedProfile ? cascadeState.selectedProfile.name : null;
        const destLabel = cascadeState.selectedDest ? cascadeState.selectedDest.label : null;
        const destPath = cascadeState.selectedDest ? cascadeState.selectedDest.path : null;

        if (profName && destLabel) {
            const pathDesc = destPath ? ` (${destPath})` : '';
            summaryEl.innerHTML = `<span class="status-icon">🚀</span> <strong>${profName}</strong> ➔ <strong>${destLabel}</strong><span style="color:var(--text-muted);">${pathDesc}</span> &mdash; Relâchez pour lancer.`;
        } else if (profName) {
            summaryEl.innerHTML = `<span class="status-icon">🎯</span> Profil <strong>${profName}</strong> &mdash; Survolez ou cliquez sur un dossier de destination ci-dessous.`;
        } else if (cascadeState.url) {
            summaryEl.innerHTML = `<span class="status-icon">🔗</span> URL enregistrée &mdash; Choisissez un profil puis un dossier.`;
        } else {
            summaryEl.innerHTML = `<span class="status-icon">💡</span> Survolez un profil, puis un dossier de destination, et relâchez le clic.`;
        }
    }

    function resetCascadeState() {
        if (cascadeState.hoverTimer) clearTimeout(cascadeState.hoverTimer);
        if (cascadeState.leaveTimer) clearTimeout(cascadeState.leaveTimer);

        cascadeState.active = false;
        cascadeState.mode = 'idle';
        cascadeState.url = null;
        cascadeState.hoveredProfile = null;
        cascadeState.selectedProfile = null;
        cascadeState.hoveredDest = null;
        cascadeState.selectedDest = null;
        cascadeState.dragDepth = 0;

        const container = document.getElementById('top-cards-container');
        const dropCard = document.getElementById('drop-target-card');
        const expandedContent = document.getElementById('card-expanded-content');
        const flyout = document.getElementById('drag-paths-flyout');

        if (container) container.classList.remove('drag-expanded');
        if (dropCard) dropCard.classList.remove('drag-hovering');
        if (expandedContent) expandedContent.classList.add('hidden');
        if (flyout) flyout.classList.add('hidden');
    }

    // ─── URL Form Submit ──────────────────────────────────────────────────────
    function setupEventListeners() {
        // URL form
        urlForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawUrl = urlInput.value.trim();
            if (!rawUrl) return;
            showToast('Analyse de l\'URL en cours...', 'info');

            try {
                const res = await fetch(apiPath('/analyze'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: rawUrl })
                });

                if (!res.ok) { showToast('Erreur lors de l\'analyse', 'error'); return; }
                const data = await res.json();

                if (data.is_playlist) {
                    openPlaylistModal(data, selectedProfileId);
                } else {
                    const dlRes = await fetch(apiPath('/download'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: rawUrl, title: data.title, video_id: data.video_id, profile_id: selectedProfileId })
                    });
                    if (dlRes.ok) {
                        showToast('Téléchargement ajouté à la file !', 'success');
                        urlInput.value = '';
                        loadQueue();
                    } else {
                        showToast('Erreur lors du lancement du téléchargement', 'error');
                    }
                }
            } catch (err) {
                showToast('Erreur réseau', 'error');
                console.error(err);
            }
        });

        // yt-dlp update
        btnUpdateYtdlp.addEventListener('click', async () => {
            showToast('Mise à jour de yt-dlp en cours...', 'info');
            btnUpdateYtdlp.disabled = true;
            try {
                const res = await fetch(apiPath('/update-ytdlp'), { method: 'POST' });
                const data = await res.json();
                showToast(data.success ? data.message : (data.message || 'Mise à jour échouée'), data.success ? 'success' : 'error');
                loadStatus();
            } catch (err) {
                showToast('Erreur réseau pendant la mise à jour', 'error');
            } finally {
                btnUpdateYtdlp.disabled = false;
            }
        });

        // Config modal open
        btnOpenOptions.addEventListener('click', async () => {
            const res = await fetch(apiPath('/options'));
            if (res.ok) {
                const opt = await res.json();
                optDownloadDir.value = opt.download_dir || '';
                optRenameRegex.value = opt.rename_regex || '';
                optSubtitles.value   = opt.subtitles || 0;
                optSubLang.value     = opt.sub_lang || 'fr';
                optShowLast.value    = opt.show_last || 20;
            }
            await loadPresetPaths();
            optionsModal.classList.remove('hidden');
        });

        const closeOptions = () => optionsModal.classList.add('hidden');
        btnCloseOptions.addEventListener('click', closeOptions);
        btnDoneOptions.addEventListener('click', closeOptions);
        optionsModal.addEventListener('click', (e) => { if (e.target === optionsModal) closeOptions(); });

        // Add preset path
        btnAddPreset.addEventListener('click', async () => {
            const label = presetNewLabel.value.trim();
            const path = presetNewPath.value.trim();
            if (!label) { showToast('Veuillez saisir un libellé', 'info'); return; }
            await fetch(apiPath('/preset-paths'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, path, icon: '📁' })
            });
            presetNewLabel.value = '';
            presetNewPath.value = '';
            showToast('Dossier ajouté !', 'success');
            await loadPresetPaths();
        });

        // System options save
        optionsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                download_dir: optDownloadDir.value.trim(),
                rename_regex: optRenameRegex.value,
                show_last: parseInt(optShowLast.value, 10) || 20,
                subtitles: parseInt(optSubtitles.value, 10),
                sub_lang: optSubLang.value.trim()
            };
            const res = await fetch(apiPath('/options'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            showToast(res.ok ? 'Options enregistrées !' : 'Erreur lors de l\'enregistrement', res.ok ? 'success' : 'error');
        });

        // Profile list/form view switching
        const showPmListView = () => {
            pmViewForm.classList.add('hidden');
            pmViewList.classList.remove('hidden');
        };

        const showPmFormView = (profile) => {
            pmViewList.classList.add('hidden');
            pmViewForm.classList.remove('hidden');
            pmFormModeTitle.textContent = profile ? `Édition: ${profile.name}` : 'Nouveau profil';
            if (profile) {
                profEditId.value        = profile.id;
                profEditName.value      = profile.name || '';
                profEditDest.value      = profile.dest_path || '';
                profEditContainer.value = profile.container || 'mkv';
                profEditRes.value       = profile.max_res || '';
                profEditFormat.value    = profile.format_spec || '';
            } else {
                profEditId.value        = '';
                profEditName.value      = '';
                profEditDest.value      = '';
                profEditContainer.value = 'mkv';
                profEditRes.value       = '1080p';
                profEditFormat.value    = 'bestvideo[height<=1080]+bestaudio/best';
            }
        };

        btnBackToPmList.addEventListener('click', showPmListView);
        btnCancelProfileEdit.addEventListener('click', showPmListView);

        btnNewProfile.addEventListener('click', () => showPmFormView(null));

        chkShowArchived.addEventListener('change', loadManagerProfiles);

        profileEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pid = profEditId.value ? parseInt(profEditId.value, 10) : 0;
            const body = {
                name: profEditName.value.trim(),
                dest_path: profEditDest.value.trim(),
                container: profEditContainer.value,
                max_res: profEditRes.value.trim(),
                format_spec: profEditFormat.value.trim(),
                audio_only: profEditContainer.value === 'mp3' ? 1 : 0,
                is_active: 1
            };
            const url = pid > 0 ? apiPath(`/profiles/${pid}`) : apiPath('/profiles');
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                showToast(pid > 0 ? 'Profil mis à jour !' : 'Profil créé !', 'success');
                showPmListView();
                await loadProfiles();
                await loadManagerProfiles();
            } else {
                showToast('Erreur lors de l\'enregistrement du profil', 'error');
            }
        });

        // Playlist modal
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
            if (checkedBoxes.length === 0) { showToast('Sélectionnez au moins une vidéo', 'info'); return; }
            const profileId = selectedProfileId;
            const playlistData = currentPlaylistData;

            showToast(`Ajout de ${checkedBoxes.length} vidéo(s) à la file…`, 'info');
            closePlaylist();

            for (const chk of checkedBoxes) {
                const idx = parseInt(chk.dataset.index, 10);
                const video = playlistData.videos[idx];
                await fetch(apiPath('/download'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: video.url, title: video.title, video_id: video.id, profile_id: profileId })
                });
            }

            urlInput.value = '';
            showToast('Toutes les vidéos sélectionnées ont été ajoutées !', 'success');
            loadQueue();
        });
    }

    // ─── Playlist Modal ───────────────────────────────────────────────────────
    function openPlaylistModal(data, profileId) {
        currentPlaylistData = data;
        playlistTitle.textContent = `Playlist : ${data.title || 'Sans titre'} (${data.videos ? data.videos.length : 0} vidéos)`;
        playlistItemsList.replaceChildren();

        (data.videos || []).forEach((video, idx) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = true;
            chk.dataset.index = idx;
            chk.id = `pl-item-${idx}`;
            chk.addEventListener('change', updatePlaylistCounter);

            const label = document.createElement('label');
            label.htmlFor = `pl-item-${idx}`;
            label.className = 'playlist-item-label';
            label.textContent = video.title || `Vidéo ${idx + 1}`;

            item.appendChild(chk);
            item.appendChild(label);
            playlistItemsList.appendChild(item);
        });

        updatePlaylistCounter();
        playlistModal.classList.remove('hidden');
    }

    function updatePlaylistCounter() {
        const checked = playlistItemsList.querySelectorAll('input[type="checkbox"]:checked').length;
        playlistSelectedCount.textContent = `${checked} sélectionné(s)`;
    }

    // ─── Profile Manager (in accordion) ──────────────────────────────────────
    async function loadManagerProfiles() {
        const includeArchived = chkShowArchived ? chkShowArchived.checked : false;
        const res = await fetch(apiPath(`/profiles?include_archived=${includeArchived}`));
        if (res.ok) {
            const list = await res.json();
            renderProfilesManagerList(list);
        }
    }

    function renderProfilesManagerList(list) {
        profilesManagerList.replaceChildren();

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.style.gridColumn = '1 / -1';
            empty.textContent = 'Aucun profil trouvé.';
            profilesManagerList.appendChild(empty);
            return;
        }

        list.forEach(prof => {
            const card = document.createElement('div');
            card.className = 'pm-item-card';

            const header = document.createElement('div');
            header.className = 'pm-item-header';
            const title = document.createElement('span');
            title.className = 'pm-item-title';
            title.textContent = prof.name;
            const badge = document.createElement('span');
            badge.className = prof.is_active === 1 ? 'pm-badge-active' : 'pm-badge-archived';
            badge.textContent = prof.is_active === 1 ? 'Actif' : 'Archivé';
            header.appendChild(title);
            header.appendChild(badge);

            const details = document.createElement('div');
            details.className = 'pm-item-details';
            const specInfo = document.createElement('div');
            specInfo.innerHTML = `<strong>${prof.container.toUpperCase()}</strong> · ${prof.max_res || 'Auto'}`;
            const pathPill = document.createElement('div');
            pathPill.className = 'pm-path-pill';
            pathPill.textContent = prof.dest_path ? `📁 ${prof.dest_path}` : '📁 Dossier global';
            details.appendChild(specInfo);
            details.appendChild(pathPill);

            const actions = document.createElement('div');
            actions.className = 'pm-item-actions';

            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-sm btn-outline';
            btnEdit.textContent = '✏️ Éditer';
            btnEdit.addEventListener('click', () => {
                // Open profiles accordion if not already open
                const accProfiles = document.getElementById('acc-profiles');
                if (accProfiles && !accProfiles.classList.contains('active')) {
                    document.querySelectorAll('.accordion-item').forEach(i => {
                        i.classList.remove('active');
                        const icon = i.querySelector('.accordion-icon');
                        if (icon) icon.textContent = '▼';
                    });
                    accProfiles.classList.add('active');
                    const icon = accProfiles.querySelector('.accordion-icon');
                    if (icon) icon.textContent = '▲';
                }
                showPmFormViewInner(prof);
            });

            const btnToggle = document.createElement('button');
            btnToggle.className = 'btn-sm btn-outline';
            btnToggle.textContent = prof.is_active === 1 ? '📦 Archiver' : '🔄 Restaurer';
            btnToggle.addEventListener('click', async () => {
                const newActive = prof.is_active === 1 ? 0 : 1;
                await fetch(apiPath(`/profiles/${prof.id}/toggle-active?is_active=${newActive}`), { method: 'POST' });
                showToast(newActive === 1 ? 'Profil restauré !' : 'Profil archivé !', 'success');
                await loadProfiles();
                await loadManagerProfiles();
            });

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-sm btn-outline';
            btnDelete.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);';
            btnDelete.textContent = '🗑️ Supprimer';
            btnDelete.addEventListener('click', async () => {
                if (confirm(`Supprimer le profil "${prof.name}" ?`)) {
                    await fetch(apiPath(`/profiles/${prof.id}`), { method: 'DELETE' });
                    showToast('Profil supprimé !', 'info');
                    await loadProfiles();
                    await loadManagerProfiles();
                }
            });

            actions.appendChild(btnEdit);
            actions.appendChild(btnToggle);
            actions.appendChild(btnDelete);

            card.appendChild(header);
            card.appendChild(details);
            card.appendChild(actions);
            profilesManagerList.appendChild(card);
        });
    }

    // Inner version (used when clicking Edit from card list)
    function showPmFormViewInner(profile) {
        pmViewList.classList.add('hidden');
        pmViewForm.classList.remove('hidden');
        pmFormModeTitle.textContent = profile ? `Édition: ${profile.name}` : 'Nouveau profil';
        if (profile) {
            profEditId.value        = profile.id;
            profEditName.value      = profile.name || '';
            profEditDest.value      = profile.dest_path || '';
            profEditContainer.value = profile.container || 'mkv';
            profEditRes.value       = profile.max_res || '';
            profEditFormat.value    = profile.format_spec || '';
        }
    }
});
