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

    // ─── DOM: Downloads Section ───────────────────────────────────────────────
    const queueList         = document.getElementById('queue-list');
    const queueEmpty        = document.getElementById('queue-empty');
    const queueCountBadge   = document.getElementById('queue-count-badge');

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
        await loadAllDownloads();
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

    // ─── Sober SVG Icons Helpers ─────────────────────────────────────────────
    const ICONS = {
        trash: (s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        edit: (s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        folder: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        clock: (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        archive: (s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
        restore: (s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        copy: (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        check: (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };

    function createCopyUrlButton(videoId, fallbackUrl = '') {
        let vid = extractYouTubeId(videoId) || extractYouTubeId(fallbackUrl);
        const targetUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : (fallbackUrl && fallbackUrl.startsWith('http') ? fallbackUrl : '');
        if (!targetUrl) return null;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-copy-url';
        btn.title = "Copier l'URL YouTube";
        btn.innerHTML = ICONS.copy(13);

        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(targetUrl);
                btn.innerHTML = ICONS.check(13);
                btn.classList.add('copied');
                showToast('URL YouTube copiée !', 'info');
                setTimeout(() => {
                    btn.innerHTML = ICONS.copy(13);
                    btn.classList.remove('copied');
                }, 1500);
            } catch (err) {
                console.error('Erreur copie presse-papier', err);
                prompt('Copiez ce lien YouTube :', targetUrl);
            }
        });

        return btn;
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
            info.innerHTML = `<strong style="display:flex;align-items:center;gap:6px;">${ICONS.folder(14)} <span>${item.label}</span></strong><span style="font-size:0.8rem;color:var(--text-muted);">${item.path || '— Dossier par défaut (global)'}</span>`;

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-outline';
            btnDel.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);white-space:nowrap;display:inline-flex;align-items:center;gap:6px;';
            btnDel.innerHTML = `${ICONS.trash(13)} <span>Supprimer</span>`;
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

    // ─── Thumbnail & SVG Helpers ──────────────────────────────────────────────
    function getFallbackSvg() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '26');
        svg.setAttribute('height', '26');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', '#60a5fa');
        svg.setAttribute('stroke-width', '1.5');
        svg.innerHTML = '<rect x="2" y="4" width="20" height="16" rx="4" fill="rgba(59, 130, 246, 0.15)"></rect><polygon points="10 8 16 12 10 16 10 8" fill="#60a5fa" stroke="none"></polygon>';
        return svg;
    }

    function extractYouTubeId(str) {
        if (!str || typeof str !== 'string') return '';
        const trimmed = str.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
            return trimmed;
        }
        const match = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];

        const bracketMatch = trimmed.match(/\[([a-zA-Z0-9_-]{11})\]/);
        if (bracketMatch) return bracketMatch[1];

        return '';
    }

    function createThumbnailElement(videoId, fallbackSource = '') {
        let vid = extractYouTubeId(videoId) || extractYouTubeId(fallbackSource);
        const targetUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : (fallbackSource && fallbackSource.startsWith('http') ? fallbackSource : '');

        const thumbEl = document.createElement(targetUrl ? 'a' : 'div');
        thumbEl.className = 'download-thumb';

        if (targetUrl) {
            thumbEl.href = targetUrl;
            thumbEl.target = '_blank';
            thumbEl.rel = 'noopener noreferrer';
            thumbEl.title = 'Ouvrir sur YouTube ↗';
        }

        if (vid) {
            const img = document.createElement('img');
            img.referrerPolicy = 'no-referrer';
            img.src = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
            img.alt = 'Thumbnail';
            img.onerror = () => {
                if (img.src.includes('hqdefault.jpg')) {
                    img.src = `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
                } else {
                    thumbEl.replaceChildren(getFallbackSvg());
                }
            };
            thumbEl.appendChild(img);

            // Hover overlay with Play / External Link badge
            const overlay = document.createElement('div');
            overlay.className = 'download-thumb-overlay';
            overlay.innerHTML = `
                <div class="download-thumb-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Ouvrir</span>
                </div>
            `;
            thumbEl.appendChild(overlay);
        } else {
            thumbEl.appendChild(getFallbackSvg());
        }
        return thumbEl;
    }

    function getLocalizedStatusInfo(statusStr) {
        switch ((statusStr || '').toLowerCase()) {
            case 'pending':
                return { text: 'En attente', class: 'status-pending' };
            case 'downloading':
                return { text: 'Téléchargement', class: 'status-downloading' };
            case 'processing':
            case 'merging':
                return { text: 'Traitement', class: 'status-processing' };
            case 'completed':
                return { text: 'Terminé', class: 'status-completed' };
            case 'failed':
            case 'error':
                return { text: 'Échec', class: 'status-failed' };
            case 'cancelled':
                return { text: 'Annulé', class: 'status-cancelled' };
            default:
                return { text: statusStr || 'Inconnu', class: 'status-pending' };
        }
    }

    // ─── API: Downloads (Queue & Completed) ───────────────────────────────────
    async function loadAllDownloads() {
        try {
            const [qRes, hRes] = await Promise.all([
                fetch(apiPath('/queue')),
                fetch(apiPath('/downloaded'))
            ]);
            if (qRes.ok) queueItems = await qRes.json();
            if (hRes.ok) historyItems = await hRes.json();
            renderDownloads();
        } catch (err) { console.error('loadAllDownloads error', err); }
    }

    async function loadQueue() {
        await loadAllDownloads();
    }

    async function loadHistory() {
        await loadAllDownloads();
    }

    function renderDownloads() {
        queueList.replaceChildren();

        const activeItems = queueItems.filter(i => ['pending','downloading','processing','failed','error'].includes(i.status));
        queueCountBadge.textContent = activeItems.length + historyItems.length;

        if (activeItems.length === 0 && historyItems.length === 0) {
            queueList.appendChild(queueEmpty);
            return;
        }

        // 1. Render active & failed queue items
        activeItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'download-card';

            // Thumbnail
            const thumb = createThumbnailElement(item.video_id, item.url || item.title);
            card.appendChild(thumb);

            // Body
            const body = document.createElement('div');
            body.className = 'download-body';

            // Header Row: Title Group & Status Pill
            const headerRow = document.createElement('div');
            headerRow.className = 'download-header-row';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'download-title-group';

            const title = document.createElement('div');
            title.className = 'download-title';
            title.textContent = item.title || item.url || 'Sans titre';
            title.title = item.title || item.url || '';
            titleGroup.appendChild(title);

            const copyBtn = createCopyUrlButton(item.video_id, item.url);
            if (copyBtn) {
                titleGroup.appendChild(copyBtn);
            }

            const statusInfo = getLocalizedStatusInfo(item.status);
            const statusPill = document.createElement('span');
            statusPill.className = `status-pill ${statusInfo.class}`;
            statusPill.textContent = statusInfo.text;

            headerRow.appendChild(titleGroup);
            headerRow.appendChild(statusPill);
            body.appendChild(headerRow);

            // Metadata Chips Row
            const chipsRow = document.createElement('div');
            chipsRow.className = 'chips-row';

            const sourceChip = document.createElement('span');
            sourceChip.className = 'meta-chip';
            sourceChip.textContent = 'YouTube';
            chipsRow.appendChild(sourceChip);

            if (item.profile_name) {
                const profChip = document.createElement('span');
                profChip.className = 'meta-chip';
                profChip.textContent = item.profile_name;
                chipsRow.appendChild(profChip);
            }

            body.appendChild(chipsRow);

            // Progress Bar or Error Display
            if (['downloading', 'pending'].includes(item.status)) {
                const progressContainer = document.createElement('div');
                progressContainer.className = 'progress-bar-container';

                const track = document.createElement('div');
                track.className = 'progress-track';

                const fill = document.createElement('div');
                fill.className = 'progress-fill';
                const pct = item.status === 'downloading' ? (item.progress_pct || 0) : 0;
                fill.style.width = `${pct}%`;
                track.appendChild(fill);
                progressContainer.appendChild(track);

                if (item.status === 'downloading') {
                    const statsRow = document.createElement('div');
                    statsRow.className = 'progress-stats-row';

                    const speedEtaText = [item.speed, item.eta ? `~${item.eta}` : null].filter(Boolean).join(' · ');
                    const statsLeft = document.createElement('span');
                    statsLeft.textContent = speedEtaText || 'Téléchargement...';

                    const statsRight = document.createElement('span');
                    statsRight.textContent = `${pct.toFixed(0)}%`;

                    statsRow.appendChild(statsLeft);
                    statsRow.appendChild(statsRight);
                    progressContainer.appendChild(statsRow);
                }

                body.appendChild(progressContainer);
            } else if (['failed', 'error'].includes(item.status)) {
                const errorBox = document.createElement('div');
                errorBox.style.cssText = 'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:0.78rem;color:#f87171;word-break:break-word;';
                errorBox.textContent = item.error_msg || 'Erreur lors du téléchargement.';
                body.appendChild(errorBox);
            }

            // Footer Row: Destination & Actions
            const footerRow = document.createElement('div');
            footerRow.className = 'download-footer-row';

            const destInfo = document.createElement('div');
            destInfo.className = 'download-dest-info';
            const destPath = item.dest_path ? item.dest_path : 'Dossier par défaut';
            destInfo.innerHTML = `<span>${ICONS.folder(13)}</span> <span>${destPath}</span>`;
            destInfo.title = destPath;

            footerRow.appendChild(destInfo);

            const actions = document.createElement('div');
            actions.className = 'download-actions';

            if (['pending', 'downloading'].includes(item.status)) {
                const btnCancel = document.createElement('button');
                btnCancel.className = 'btn-cancel-ghost';
                btnCancel.textContent = 'Annuler';
                btnCancel.addEventListener('click', async () => {
                    await fetch(apiPath(`/queue/${item.id}`), { method: 'DELETE' });
                    showToast('Téléchargement annulé', 'info');
                    loadAllDownloads();
                });
                actions.appendChild(btnCancel);
            } else if (['failed', 'error'].includes(item.status)) {
                const btnRetry = document.createElement('button');
                btnRetry.className = 'btn-sm btn-outline';
                btnRetry.style.cssText = 'color:#60a5fa;border-color:rgba(96,165,250,0.4);display:inline-flex;align-items:center;gap:4px;';
                btnRetry.innerHTML = `${ICONS.restore(12)} <span>Réessayer</span>`;
                btnRetry.addEventListener('click', async () => {
                    await fetch(apiPath(`/queue/${item.id}/retry`), { method: 'POST' });
                    showToast('Téléchargement relancé', 'info');
                    loadAllDownloads();
                });
                actions.appendChild(btnRetry);

                const btnDel = document.createElement('button');
                btnDel.className = 'btn-sm btn-outline';
                btnDel.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);display:inline-flex;align-items:center;gap:4px;';
                btnDel.innerHTML = `${ICONS.trash(12)} <span>Supprimer</span>`;
                btnDel.addEventListener('click', async () => {
                    await fetch(apiPath(`/queue/${item.id}`), { method: 'DELETE' });
                    loadAllDownloads();
                });
                actions.appendChild(btnDel);
            }

            footerRow.appendChild(actions);
            body.appendChild(footerRow);
            card.appendChild(body);
            queueList.appendChild(card);
        });

        // 2. Render completed items below active items
        historyItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'download-card';

            // Thumbnail
            const thumb = createThumbnailElement(item.video_id, item.title || item.filename);
            card.appendChild(thumb);

            // Body
            const body = document.createElement('div');
            body.className = 'download-body';

            // Header Row: Title Group & Status Pill
            const headerRow = document.createElement('div');
            headerRow.className = 'download-header-row';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'download-title-group';

            const title = document.createElement('div');
            title.className = 'download-title';
            title.textContent = item.title || item.filename || 'Téléchargement';
            title.title = item.title || item.filename || '';
            titleGroup.appendChild(title);

            const copyBtn = createCopyUrlButton(item.video_id, item.title);
            if (copyBtn) {
                titleGroup.appendChild(copyBtn);
            }

            const statusPill = document.createElement('span');
            statusPill.className = 'status-pill status-completed';
            statusPill.textContent = 'Terminé';

            headerRow.appendChild(titleGroup);
            headerRow.appendChild(statusPill);
            body.appendChild(headerRow);

            // Chips Row
            const chipsRow = document.createElement('div');
            chipsRow.className = 'chips-row';

            const sourceChip = document.createElement('span');
            sourceChip.className = 'meta-chip';
            sourceChip.textContent = 'YouTube';
            chipsRow.appendChild(sourceChip);

            if (item.resolution) {
                const resChip = document.createElement('span');
                resChip.className = 'meta-chip';
                resChip.textContent = item.resolution;
                chipsRow.appendChild(resChip);
            }

            // Codecs chip (vcodec / acodec)
            const codecs = [item.vcodec, item.acodec].filter(Boolean);
            if (codecs.length > 0) {
                const codecChip = document.createElement('span');
                codecChip.className = 'meta-chip';
                codecChip.textContent = codecs.join(' / ');
                chipsRow.appendChild(codecChip);
            }

            // Bitrate chip
            if (item.bitrate) {
                const brChip = document.createElement('span');
                brChip.className = 'meta-chip';
                brChip.textContent = item.bitrate;
                chipsRow.appendChild(brChip);
            }

            // FPS chip
            if (item.fps) {
                const fpsChip = document.createElement('span');
                fpsChip.className = 'meta-chip';
                fpsChip.textContent = item.fps;
                chipsRow.appendChild(fpsChip);
            }

            if (item.format_info && !codecs.length) {
                const fmtChip = document.createElement('span');
                fmtChip.className = 'meta-chip';
                fmtChip.textContent = item.format_info;
                chipsRow.appendChild(fmtChip);
            }

            if (item.duration && item.duration !== '--') {
                const durChip = document.createElement('span');
                durChip.className = 'meta-chip';
                durChip.innerHTML = `${ICONS.clock(12)} <span>${item.duration}</span>`;
                chipsRow.appendChild(durChip);
            }

            if (item.filesize) {
                const sizeChip = document.createElement('span');
                sizeChip.className = 'meta-chip';
                sizeChip.textContent = `${(item.filesize / 1024 / 1024).toFixed(1)} MB`;
                chipsRow.appendChild(sizeChip);
            }

            body.appendChild(chipsRow);

            // Footer Row: Destination & Delete Button
            const footerRow = document.createElement('div');
            footerRow.className = 'download-footer-row';

            const destInfo = document.createElement('div');
            destInfo.className = 'download-dest-info';
            const filepath = item.filepath || item.filename || 'Stockage local';
            destInfo.innerHTML = `<span>${ICONS.folder(13)}</span> <span>${filepath}</span>`;
            destInfo.title = filepath;

            const actions = document.createElement('div');
            actions.className = 'download-actions';
            actions.style.cssText = 'display:flex; gap:6px; align-items:center;';

            const btnRename = document.createElement('button');
            btnRename.className = 'btn-sm btn-outline';
            btnRename.style.cssText = 'color:var(--primary);border-color:rgba(124,58,237,0.4);cursor:pointer;display:inline-flex;align-items:center;gap:6px;';
            btnRename.innerHTML = `${ICONS.edit(13)} <span>Renommer</span>`;
            btnRename.addEventListener('click', () => {
                openRenameModal(item);
            });

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-sm btn-outline';
            btnDel.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);cursor:pointer;display:inline-flex;align-items:center;gap:6px;';
            btnDel.innerHTML = `${ICONS.trash(13)} <span>Supprimer</span>`;
            btnDel.addEventListener('click', () => {
                openDeleteModal(
                    `"${item.title || item.filename}"`,
                    async () => {
                        await fetch(apiPath(`/downloaded/${item.id}?delete_file=true`), { method: 'DELETE' });
                        showToast('Fichier supprimé du disque et retiré de la liste', 'success');
                        loadAllDownloads();
                    },
                    async () => {
                        await fetch(apiPath(`/downloaded/${item.id}?delete_file=false`), { method: 'DELETE' });
                        showToast('Téléchargement retiré de la liste (fichier conservé)', 'info');
                        loadAllDownloads();
                    }
                );
            });
            actions.appendChild(btnRename);
            actions.appendChild(btnDel);

            footerRow.appendChild(destInfo);
            footerRow.appendChild(actions);
            body.appendChild(footerRow);

            card.appendChild(body);
            queueList.appendChild(card);
        });
    }

    // ─── SSE ──────────────────────────────────────────────────────────────────
    function setupSSE() {
        const evtSource = new EventSource(apiPath('/events'));
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (['progress','completed','failed','cancelled'].includes(data.event)) {
                    loadAllDownloads();
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

    function getProfileDisplayLabels(p) {
        if (!p) return { primary: 'Auto', secondary: 'Best' };
        const rawName = p.name || '';
        const maxRes = (p.max_res || '').toLowerCase();
        const container = (p.container || '').toUpperCase();
        const isAudio = Boolean(p.audio_only || rawName.toLowerCase().includes('audio') || maxRes === 'audio');

        let primary = rawName;
        let secondary = '';

        if (isAudio) {
            primary = 'Audio';
            if (p.container && p.container.trim() !== '' && p.container.toLowerCase() !== 'audio') {
                secondary = p.container.toUpperCase();
            } else if (p.format_spec && p.format_spec.toLowerCase().includes('mp3')) {
                secondary = 'MP3';
            } else if (p.format_spec && p.format_spec.toLowerCase().includes('m4a')) {
                secondary = 'M4A';
            } else {
                secondary = 'MP3 / M4A';
            }
        } else if (rawName.includes('4K') || maxRes === '2160p') {
            primary = '4K';
            secondary = '2160p';
        } else if (rawName.includes('1440p') || rawName.includes('2K') || maxRes === '1440p') {
            primary = '1440p';
            secondary = 'QHD';
        } else if (rawName.includes('1080p') || maxRes === '1080p') {
            primary = '1080p';
            secondary = 'Full HD';
        } else if (rawName.includes('720p') || maxRes === '720p') {
            primary = '720p';
            secondary = 'HD';
        } else if (rawName.includes('SD') || rawName.includes('480p') || maxRes === '480p') {
            primary = 'SD';
            secondary = '480p';
        } else {
            primary = rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
            secondary = p.max_res || (container !== '' ? container : 'Auto');
        }

        if (primary.toLowerCase() === secondary.toLowerCase()) {
            secondary = container !== '' && container !== primary ? container : 'Auto';
        }

        return { primary, secondary };
    }

    function updateLiveSelectionSummary() {
        const summaryDestEl = document.getElementById('cascade-live-summary');

        if (!cascadeState.active || !cascadeState.selectedProfile) {
            if (summaryDestEl) { summaryDestEl.classList.add('hidden'); summaryDestEl.textContent = ''; }
            return;
        }

        const profDisplay = getProfileDisplayLabels(cascadeState.selectedProfile);
        const profText = profDisplay.primary;
        const destText = cascadeState.selectedDest ? cascadeState.selectedDest.label : null;

        if (summaryDestEl) {
            summaryDestEl.classList.remove('hidden');
            if (destText) {
                summaryDestEl.innerHTML = `<span class="summary-prof">${profText}</span> <span class="summary-arrow">→</span> <span class="summary-dest">${destText}</span> <span class="summary-action">· Relâchez pour télécharger</span>`;
            } else {
                summaryDestEl.innerHTML = `<span class="summary-prof">${profText}</span> <span class="summary-action">· Choisissez une destination</span>`;
            }
        }
    }

    function setupDragTarget() {
        const zone = document.getElementById('drag-cascade-zone');
        const dropCard = document.getElementById('drop-target-card');
        const profilesPanel = document.getElementById('cascade-profiles-panel');
        const destsPanel = document.getElementById('cascade-dests-panel');

        if (!zone || !dropCard) return;

        // Panel Drag Over listeners to clear leaveTimer instantly when mouse crosses gap into panel
        [profilesPanel, destsPanel].forEach(panel => {
            if (!panel) return;
            panel.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (cascadeState.leaveTimer) {
                    clearTimeout(cascadeState.leaveTimer);
                    cascadeState.leaveTimer = null;
                }
            });
            panel.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (cascadeState.leaveTimer) {
                    clearTimeout(cascadeState.leaveTimer);
                    cascadeState.leaveTimer = null;
                }
            });
        });

        // Staged Destination Band Reveal (Appears when moving out of profile band toward destination zone)
        if (profilesPanel) {
            profilesPanel.addEventListener('dragleave', (e) => {
                if (cascadeState.active && (!e.relatedTarget || !profilesPanel.contains(e.relatedTarget))) {
                    revealDestinationPanel();
                }
            });
        }

        if (destsPanel) {
            destsPanel.addEventListener('dragenter', (e) => {
                e.preventDefault();
                revealDestinationPanel();
            });
            destsPanel.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                revealDestinationPanel();
            });
        }

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
            // If the drag target is still inside the master zone, ignore dragleave
            if (e.relatedTarget && zone.contains(e.relatedTarget)) {
                return;
            }
            cascadeState.dragDepth = Math.max(0, cascadeState.dragDepth - 1);
            if (cascadeState.dragDepth === 0 && cascadeState.mode === 'dragging') {
                if (cascadeState.leaveTimer) clearTimeout(cascadeState.leaveTimer);
                cascadeState.leaveTimer = setTimeout(() => {
                    if (cascadeState.dragDepth === 0 && cascadeState.mode === 'dragging') {
                        resetCascadeState();
                    }
                }, 150); // 150ms grace period when leaving the entire component
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
            if (cascadeState.active && cascadeState.mode === 'dragging') {
                showToast('Sélection annulée', 'info');
            }
            resetCascadeState();
        });

        // Drop Card Click Support (Toggle open / close)
        dropCard.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cascadeState.active) {
                resetCascadeState();
                return;
            }
            cascadeState.mode = 'click_pending';
            activateCascadeDrag();
            revealDestinationPanel();
        });

        // Close button (✕) click listener
        const closeBtn = document.getElementById('btn-close-cascade');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetCascadeState();
            });
        }

        // Click Outside Listener (Closes panel when clicking anywhere outside drag cascade zone)
        document.addEventListener('click', (e) => {
            if (!cascadeState.active) return;
            if (!zone.contains(e.target)) {
                resetCascadeState();
            }
        });

        dropCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropCard.click();
            }
        });

        // Global drag completion safety listeners
        window.addEventListener('dragend', () => {
            resetCascadeState();
        });

        window.addEventListener('drop', (e) => {
            if (!e.target.closest('.dest-card')) {
                if (cascadeState.active && cascadeState.mode === 'dragging') {
                    showToast('Sélection annulée', 'info');
                }
                resetCascadeState();
            }
        }, true);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                resetCascadeState();
            }
        });
    }

    function activateCascadeDrag(initialUrl = null) {
        cascadeState.active = true;
        if (cascadeState.mode === 'idle') {
            cascadeState.mode = 'dragging';
        }
        if (initialUrl) cascadeState.url = initialUrl;

        const dropCard = document.getElementById('drop-target-card');
        const overlayWrapper = document.getElementById('cascade-overlay-wrapper');
        const profilesPanel = document.getElementById('cascade-profiles-panel');

        if (dropCard) dropCard.classList.add('drag-hovering');
        if (overlayWrapper) overlayWrapper.classList.remove('hidden');
        if (profilesPanel) profilesPanel.classList.remove('hidden');

        renderCascadeProfiles();
        updateLiveSelectionSummary();
    }

    function renderCascadeProfiles() {
        const listEl = document.getElementById('drag-profiles-list');
        if (!listEl) return;
        listEl.replaceChildren();

        const defaultProfiles = [
            { id: 1, name: '4K (2160p)', max_res: '2160p', container: 'mkv' },
            { id: 2, name: '1440p (2K)', max_res: '1440p', container: 'mkv' },
            { id: 3, name: '1080p (Full HD)', max_res: '1080p', container: 'mkv' },
            { id: 4, name: '720p (HD)', max_res: '720p', container: 'mp4' },
            { id: 5, name: 'Audio Only (MP3)', max_res: 'audio', container: 'mp3', audio_only: 1 }
        ];

        const activeProfiles = profiles.length > 0 ? profiles : defaultProfiles;

        activeProfiles.forEach(prof => {
            const display = getProfileDisplayLabels(prof);
            const card = document.createElement('div');
            card.className = 'cascade-card profile-card';
            card.tabIndex = 0;
            card.role = 'button';
            card.setAttribute('aria-label', `Profil ${display.primary}`);

            if (cascadeState.selectedProfile && cascadeState.selectedProfile.id === prof.id) {
                card.classList.add('active');
            }

            card.innerHTML = `
                <div class="cascade-card-title">${display.primary}</div>
                <div class="cascade-card-sub">${display.secondary}</div>
            `;

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleProfileHover(prof);
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                handleProfileHover(prof);
            });

            card.addEventListener('click', (e) => {
                e.stopPropagation();
                handleProfileHover(prof);
                revealDestinationPanel();
            });

            listEl.appendChild(card);
        });
    }

    function handleProfileHover(prof) {
        if (cascadeState.leaveTimer) {
            clearTimeout(cascadeState.leaveTimer);
            cascadeState.leaveTimer = null;
        }
        cascadeState.hoveredProfile = prof;
        cascadeState.selectedProfile = prof;
        updateProfileCardsSelection(prof);
        updateLiveSelectionSummary();

        // Reveal destination panel on profile hover so user can fluidly move into destination cards
        if (cascadeState.hoverTimer) clearTimeout(cascadeState.hoverTimer);
        cascadeState.hoverTimer = setTimeout(() => {
            revealDestinationPanel();
        }, 50);
    }

    function updateProfileCardsSelection(selectedProf) {
        const listEl = document.getElementById('drag-profiles-list');
        if (!listEl) return;
        const selectedLabels = selectedProf ? getProfileDisplayLabels(selectedProf) : null;
        listEl.querySelectorAll('.cascade-card').forEach(card => {
            if (selectedLabels && card.querySelector('.cascade-card-title')?.textContent === selectedLabels.primary) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    function revealDestinationPanel() {
        const destsPanel = document.getElementById('cascade-dests-panel');
        if (!destsPanel) return;
        if (destsPanel.classList.contains('hidden')) {
            destsPanel.classList.remove('hidden');
            renderCascadeDestinations();
        }
        updateLiveSelectionSummary();
    }

    function renderCascadeDestinations() {
        const listEl = document.getElementById('drag-dests-list');
        if (!listEl) return;
        listEl.replaceChildren();

        const defaultDests = [
            { id: 1, label: 'Albums américains', path: '/var/www/html/sujib/downloads/Albums_US' },
            { id: 2, label: 'MV K-pop', path: '/var/www/html/sujib/downloads/KPop_MV' },
            { id: 3, label: 'EDM', path: '/var/www/html/sujib/downloads/EDM' },
            { id: 4, label: 'Playlists', path: '/var/www/html/sujib/downloads/Playlists' },
            { id: 5, label: 'Divers', path: '' }
        ];

        const activeDests = presetPaths.length > 0 ? presetPaths : defaultDests;

        activeDests.forEach(dest => {
            const card = document.createElement('div');
            card.className = 'cascade-card dest-card';
            card.tabIndex = 0;
            card.role = 'button';
            card.setAttribute('aria-label', `Dossier ${dest.label}`);

            if (cascadeState.selectedDest && (cascadeState.selectedDest.id === dest.id || cascadeState.selectedDest.path === dest.path)) {
                card.classList.add('active');
            }

            card.innerHTML = `
                <div class="cascade-card-title">${dest.label}</div>
                <div class="cascade-card-sub">Dossier</div>
            `;

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDestHover(dest);
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                handleDestHover(dest);
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleDestinationDrop(dest, e);
            });

            card.addEventListener('click', async (e) => {
                e.stopPropagation();
                cascadeState.selectedDest = dest;
                updateLiveSelectionSummary();
                if (cascadeState.url) {
                    await handleDestinationDrop(dest, null);
                }
            });

            listEl.appendChild(card);
        });
    }

    function handleDestHover(dest) {
        if (cascadeState.leaveTimer) {
            clearTimeout(cascadeState.leaveTimer);
            cascadeState.leaveTimer = null;
        }
        cascadeState.hoveredDest = dest;
        cascadeState.selectedDest = dest;
        updateDestCardsSelection(dest);
        updateLiveSelectionSummary();
    }

    function updateDestCardsSelection(selectedDest) {
        const listEl = document.getElementById('drag-dests-list');
        if (!listEl) return;
        listEl.querySelectorAll('.cascade-card').forEach(card => {
            if (selectedDest && card.textContent.includes(selectedDest.label)) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
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

        try {
            const res = await fetch(apiPath('/download'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    title: '',
                    profile_id: prof.id,
                    dest_path: destPath
                })
            });

            if (res.ok) {
                showSuccessBanner();
                loadQueue();
            } else {
                showToast('Erreur lors de l\'ajout à la file', 'error');
            }
        } catch (err) {
            showToast('Erreur réseau pendant le téléchargement', 'error');
        }

        resetCascadeState();
    }

    function showSuccessBanner() {
        const banner = document.getElementById('cascade-success-banner');
        if (!banner) return;
        banner.classList.remove('hidden');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 6000);
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

        const dropCard = document.getElementById('drop-target-card');
        const overlayWrapper = document.getElementById('cascade-overlay-wrapper');
        const profilesPanel = document.getElementById('cascade-profiles-panel');
        const destsPanel = document.getElementById('cascade-dests-panel');

        if (dropCard) dropCard.classList.remove('drag-hovering');
        if (overlayWrapper) overlayWrapper.classList.add('hidden');
        if (profilesPanel) profilesPanel.classList.add('hidden');
        if (destsPanel) destsPanel.classList.add('hidden');

        updateLiveSelectionSummary();
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
            pathPill.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;">${ICONS.folder(13)} <span>${prof.dest_path || 'Dossier global'}</span></span>`;
            details.appendChild(specInfo);
            details.appendChild(pathPill);

            const actions = document.createElement('div');
            actions.className = 'pm-item-actions';

            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-sm btn-outline';
            btnEdit.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
            btnEdit.innerHTML = `${ICONS.edit(13)} <span>Éditer</span>`;
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
            btnToggle.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
            btnToggle.innerHTML = prof.is_active === 1 
                ? `${ICONS.archive(13)} <span>Archiver</span>` 
                : `${ICONS.restore(13)} <span>Restaurer</span>`;
            btnToggle.addEventListener('click', async () => {
                const newActive = prof.is_active === 1 ? 0 : 1;
                await fetch(apiPath(`/profiles/${prof.id}/toggle-active?is_active=${newActive}`), { method: 'POST' });
                showToast(newActive === 1 ? 'Profil restauré !' : 'Profil archivé !', 'success');
                await loadProfiles();
                await loadManagerProfiles();
            });

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-sm btn-outline';
            btnDelete.style.cssText = 'color:#ef4444;border-color:rgba(239,68,68,0.4);display:inline-flex;align-items:center;gap:6px;';
            btnDelete.innerHTML = `${ICONS.trash(13)} <span>Supprimer</span>`;
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

    // ─── Clear yt-dlp Cache ──────────────────────────────────────────────────
    const btnClearCache = document.getElementById('btn-clear-cache');
    if (btnClearCache) {
        btnClearCache.addEventListener('click', async () => {
            const statusSpan = document.getElementById('cache-clear-status');
            btnClearCache.disabled = true;
            if (statusSpan) statusSpan.textContent = 'Nettoyage...';
            try {
                const res = await fetch(apiPath('/clear-cache'), { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast('Cache yt-dlp vidé avec succès !', 'success');
                    if (statusSpan) statusSpan.textContent = 'Cache nettoyé !';
                } else {
                    showToast(`Erreur : ${data.error || 'Impossible de vider le cache'}`, 'error');
                    if (statusSpan) statusSpan.textContent = 'Erreur';
                }
            } catch (err) {
                showToast('Erreur lors du nettoyage du cache', 'error');
                if (statusSpan) statusSpan.textContent = '';
            } finally {
                btnClearCache.disabled = false;
                setTimeout(() => { if (statusSpan) statusSpan.textContent = ''; }, 4000);
            }
        });
    }
    // ─── Delete Confirmation Modal Logic ────────────────────────────────────
    const deleteModal           = document.getElementById('delete-confirm-modal');
    const deleteModalTitle      = document.getElementById('delete-modal-title');
    const btnCloseDeleteModal   = document.getElementById('btn-close-delete-modal');
    const btnDeleteFileAndEntry = document.getElementById('btn-delete-file-and-entry');
    const btnDeleteEntryOnly    = document.getElementById('btn-delete-entry-only');
    const btnCancelDelete       = document.getElementById('btn-cancel-delete');

    let pendingDeleteAction = null;

    function openDeleteModal(titleText, onConfirmFileDelete, onConfirmEntryOnly) {
        if (deleteModalTitle) deleteModalTitle.textContent = titleText;
        pendingDeleteAction = { fileDelete: onConfirmFileDelete, entryOnly: onConfirmEntryOnly };
        if (deleteModal) deleteModal.classList.remove('hidden');
    }

    function closeDeleteModal() {
        if (deleteModal) deleteModal.classList.add('hidden');
        pendingDeleteAction = null;
    }

    if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);

    if (btnDeleteFileAndEntry) {
        btnDeleteFileAndEntry.addEventListener('click', async () => {
            if (pendingDeleteAction && pendingDeleteAction.fileDelete) {
                await pendingDeleteAction.fileDelete();
            }
            closeDeleteModal();
        });
    }

    if (btnDeleteEntryOnly) {
        btnDeleteEntryOnly.addEventListener('click', async () => {
            if (pendingDeleteAction && pendingDeleteAction.entryOnly) {
                await pendingDeleteAction.entryOnly();
            }
            closeDeleteModal();
        });
    }

    // ─── Rename Modal Logic ──────────────────────────────────────────────────
    const renameModal         = document.getElementById('rename-modal');
    const renameForm          = document.getElementById('rename-form');
    const renameItemIdInput   = document.getElementById('rename-item-id');
    const renameFilenameInput = document.getElementById('rename-input-filename');
    const btnCloseRenameModal = document.getElementById('btn-close-rename-modal');
    const btnCancelRename     = document.getElementById('btn-cancel-rename');

    function openRenameModal(item) {
        if (renameItemIdInput) renameItemIdInput.value = item.id;
        if (renameFilenameInput) renameFilenameInput.value = item.filename || item.title || '';
        if (renameModal) renameModal.classList.remove('hidden');
        if (renameFilenameInput) {
            renameFilenameInput.focus();
            renameFilenameInput.select();
        }
    }

    function closeRenameModal() {
        if (renameModal) renameModal.classList.add('hidden');
    }

    if (btnCloseRenameModal) btnCloseRenameModal.addEventListener('click', closeRenameModal);
    if (btnCancelRename) btnCancelRename.addEventListener('click', closeRenameModal);

    if (renameForm) {
        renameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemId = renameItemIdInput ? renameItemIdInput.value : '';
            const newFilename = renameFilenameInput ? renameFilenameInput.value.trim() : '';

            if (!itemId || !newFilename) return;

            try {
                const res = await fetch(apiPath(`/downloaded/${itemId}/rename`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_filename: newFilename })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(`Fichier renommé en "${data.data.filename}"`, 'success');
                    closeRenameModal();
                    await loadAllDownloads();
                } else {
                    showToast(`Erreur : ${data.detail || 'Impossible de renommer'}`, 'error');
                }
            } catch (err) {
                showToast('Erreur réseau lors du nommage du fichier', 'error');
            }
        });
    }

    // ─── Clear Completed Downloads History ───────────────────────────────────
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', async () => {
            if (confirm("Voulez-vous vider la liste des téléchargements terminés ?")) {
                try {
                    const res = await fetch(apiPath('/downloaded?delete_files=false'), { method: 'DELETE' });
                    if (res.ok) {
                        showToast('Liste des téléchargements vidée (fichiers conservés)', 'info');
                        await loadAllDownloads();
                    }
                } catch (err) {
                    showToast('Erreur lors du vidage de la liste', 'error');
                }
            }
        });
    }
});
