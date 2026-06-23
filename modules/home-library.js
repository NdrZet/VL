// ─── HomeLibrary ──────────────────────────────────────────────────────────────
// Handles: library directory management, video card rendering,
//          thumbnail generation, favorites, playlists, statistics,
//          recent/folder/settings views, search, sidebar navigation.

class HomeLibrary {
    constructor(player) {
        this.player = player;
        this.dirs   = this.loadDirs();
        this.cache  = this.loadCache();
        this.thumbnailQueue      = [];
        this.activeThumbnailJobs = 0;
        this.CONCURRENCY         = 3;

        this.homeScreen   = document.getElementById('homeScreen');
        this.sectionsEl   = document.getElementById('librarySections');
        this.emptyEl      = document.getElementById('libraryEmpty');
        this.addFolderBtn = document.getElementById('addFolderBtn');
        this.openFileBtn  = document.getElementById('openFileBtn');
        this.searchInput  = document.getElementById('homeSearchInput');
        this.currentView  = 'library';

        this.bindEvents();
        this.render();

        if (localStorage.getItem('vl-sidebar-collapsed') === '1') {
            const sidebar = document.getElementById('homeSidebar');
            if (sidebar) sidebar.classList.add('is-collapsed');
        }
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    loadDirs() {
        try { return JSON.parse(localStorage.getItem('vl-library-dirs') || '[]'); }
        catch { return []; }
    }

    saveDirs() {
        localStorage.setItem('vl-library-dirs', JSON.stringify(this.dirs));
    }

    loadCache() {
        try { return JSON.parse(localStorage.getItem('vl-library-cache') || '{}'); }
        catch { return {}; }
    }

    saveCache() {
        try {
            localStorage.setItem('vl-library-cache', JSON.stringify(this.cache));
        } catch (e) {
            this.cache = {};
            localStorage.removeItem('vl-library-cache');
        }
    }

    // ── Favorites ─────────────────────────────────────────────────────────────

    getFavorites() {
        try { return JSON.parse(localStorage.getItem('vl-favorites') || '[]'); }
        catch { return []; }
    }

    saveFavorites(arr) {
        localStorage.setItem('vl-favorites', JSON.stringify(arr));
    }

    isFavorite(filePath) {
        return this.getFavorites().includes(filePath);
    }

    toggleFavorite(filePath) {
        const favs  = this.getFavorites();
        const idx   = favs.indexOf(filePath);
        const nowFav = idx === -1;
        if (nowFav) favs.push(filePath);
        else         favs.splice(idx, 1);
        this.saveFavorites(favs);
        document.querySelectorAll(`.card-fav-btn[data-path]`).forEach(btn => {
            if (btn.dataset.path === filePath) {
                btn.classList.toggle('is-fav', nowFav);
                btn.querySelector('svg').setAttribute('fill', nowFav ? 'currentColor' : 'none');
                if (window.VLi18n) {
                    btn.title = window.VLi18n.t(nowFav ? 'favorites.unfav_btn' : 'favorites.fav_btn');
                }
            }
        });
        if (this.currentView === 'favorites') this.renderFavoritesView();
    }

    renderFavoritesView() {
        const grid  = document.getElementById('favoritesGrid');
        const empty = document.getElementById('favEmpty');
        if (!grid) return;

        this.thumbnailQueue      = [];
        this.activeThumbnailJobs = 0;

        const favs = this.getFavorites();
        grid.innerHTML = '';

        if (favs.length === 0) {
            if (empty) empty.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            grid.classList.remove('hidden');
            favs.forEach((fp, i) => grid.appendChild(this.buildCard(fp, i)));
            this.processThumbnailQueue();
        }
    }

    // ── Playlists ──────────────────────────────────────────────────────────────

    getPlaylists() {
        try { return JSON.parse(localStorage.getItem('vl-playlists') || '[]'); }
        catch { return []; }
    }

    savePlaylists(arr) {
        localStorage.setItem('vl-playlists', JSON.stringify(arr));
    }

    createPlaylist(name) {
        const playlists = this.getPlaylists();
        const pl = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, files: [], createdAt: Date.now() };
        playlists.push(pl);
        this.savePlaylists(playlists);
        return pl;
    }

    deletePlaylist(id) {
        this.savePlaylists(this.getPlaylists().filter(pl => pl.id !== id));
    }

    renamePlaylist(id, name) {
        const playlists = this.getPlaylists();
        const pl = playlists.find(p => p.id === id);
        if (pl) { pl.name = name; this.savePlaylists(playlists); }
    }

    addToPlaylist(id, filePath) {
        const playlists = this.getPlaylists();
        const pl = playlists.find(p => p.id === id);
        if (pl && !pl.files.includes(filePath)) {
            pl.files.push(filePath);
            this.savePlaylists(playlists);
        }
    }

    removeFromPlaylist(id, filePath) {
        const playlists = this.getPlaylists();
        const pl = playlists.find(p => p.id === id);
        if (pl) {
            pl.files = pl.files.filter(f => f !== filePath);
            this.savePlaylists(playlists);
        }
    }

    renderPlaylistsView() {
        const grid   = document.getElementById('playlistsGrid');
        const empty  = document.getElementById('playlistsEmpty');
        const main   = document.getElementById('playlistsMain');
        const detail = document.getElementById('playlistDetail');
        if (!grid) return;

        if (main)   main.classList.remove('hidden');
        if (detail) detail.classList.add('hidden');

        const playlists = this.getPlaylists();
        grid.innerHTML  = '';

        if (playlists.length === 0) {
            if (empty) empty.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            grid.classList.remove('hidden');
            playlists.forEach(pl => grid.appendChild(this.buildPlaylistCard(pl)));
        }

        const createBtn = document.getElementById('createPlaylistBtn');
        const form      = document.getElementById('createPlForm');
        const input     = document.getElementById('createPlInput');
        const confirm   = document.getElementById('createPlConfirm');
        const cancel    = document.getElementById('createPlCancel');

        if (createBtn) createBtn.onclick = () => { form?.classList.remove('hidden'); input?.focus(); };
        if (confirm)   confirm.onclick   = () => this._confirmCreatePlaylist();
        if (cancel)    cancel.onclick    = () => { form?.classList.add('hidden'); if (input) input.value = ''; };
        if (input) {
            input.onkeydown = e => {
                if (e.key === 'Enter')  this._confirmCreatePlaylist();
                if (e.key === 'Escape') { form?.classList.add('hidden'); if (input) input.value = ''; }
            };
        }
        if (this.pendingAddToNew) {
            form?.classList.remove('hidden');
            input?.focus();
        }
    }

    _confirmCreatePlaylist() {
        const input = document.getElementById('createPlInput');
        const form  = document.getElementById('createPlForm');
        const name  = input?.value.trim();
        if (!name) { input?.focus(); return; }
        const pl = this.createPlaylist(name);
        if (this.pendingAddToNew) {
            this.addToPlaylist(pl.id, this.pendingAddToNew);
            this.pendingAddToNew = null;
        }
        if (input) input.value = '';
        form?.classList.add('hidden');
        this.renderPlaylistsView();
    }

    buildPlaylistCard(pl) {
        const t        = (key, opts) => window.VLi18n ? window.VLi18n.t(key, opts) : key;
        const card     = document.createElement('div');
        card.className = 'pl-card';

        const firstFile = pl.files[0];
        const cached    = firstFile ? this.cache[firstFile] : null;
        const thumbHtml = (cached && cached.thumbDataUrl)
            ? `<img src="${cached.thumbDataUrl}" alt="">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.45)" stroke-width="1.5" width="36" height="36"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

        card.innerHTML = `
            <div class="pl-card-thumb">
                ${thumbHtml}
                <div class="pl-card-count-badge">${t('dynamic.pl_videos', { n: pl.files.length })}</div>
            </div>
            <div class="pl-card-info">
                <div class="pl-card-name">${escHtml(pl.name)}</div>
                <div class="pl-card-count">${t('dynamic.pl_videos', { n: pl.files.length })}</div>
            </div>`;

        card.addEventListener('click', () => this.renderPlaylistDetail(pl.id));
        return card;
    }

    renderPlaylistDetail(id) {
        const main    = document.getElementById('playlistsMain');
        const detail  = document.getElementById('playlistDetail');
        const titleEl = document.getElementById('plDetailTitle');
        const countEl = document.getElementById('plDetailCount');
        const grid    = document.getElementById('plDetailGrid');
        const emptyEl = document.getElementById('plDetailEmpty');
        if (!detail || !grid) return;

        const t = (key, opts) => window.VLi18n ? window.VLi18n.t(key, opts) : key;

        const playlists = this.getPlaylists();
        const pl = playlists.find(p => p.id === id);
        if (!pl) { this.renderPlaylistsView(); return; }

        this.currentPlaylistId = id;
        if (main)   main.classList.add('hidden');
        detail.classList.remove('hidden');

        if (titleEl) titleEl.textContent = pl.name;
        if (countEl) countEl.textContent = t('dynamic.pl_videos', { n: pl.files.length });

        this.thumbnailQueue      = [];
        this.activeThumbnailJobs = 0;
        grid.innerHTML = '';

        if (pl.files.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            if (emptyEl) emptyEl.classList.add('hidden');
            grid.classList.remove('hidden');
            pl.files.forEach((fp, i) => {
                const card      = this.buildCard(fp, i);
                const removeBtn = document.createElement('button');
                removeBtn.className = 'card-fav-btn';
                removeBtn.title     = t('playlists.remove_video');
                removeBtn.style.color = 'rgba(255,255,255,0.5)';
                removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
                removeBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.removeFromPlaylist(id, fp);
                    this.renderPlaylistDetail(id);
                });
                const actions = card.querySelector('.card-actions');
                if (actions) actions.prepend(removeBtn);
                grid.appendChild(card);
            });
            this.processThumbnailQueue();
        }

        const backBtn    = document.getElementById('plBackBtn');
        const playAllBtn = document.getElementById('plPlayAllBtn');
        const addBtn     = document.getElementById('plAddVideosBtn');
        const renameBtn  = document.getElementById('plRenameBtn');
        const deleteBtn  = document.getElementById('plDeleteBtn');

        if (backBtn)    backBtn.onclick = () => this.renderPlaylistsView();
        if (playAllBtn) playAllBtn.onclick = () => {
            if (pl.files.length === 0) return;
            this.player.playlist.loadVideoFile(pl.files[0]);
        };
        if (addBtn) addBtn.onclick = async () => {
            try {
                const result = await window.vlApi.invoke('show-open-dialog', {
                    title: t('playlists.add_videos'),
                    filters: [
                        { name: 'Video Files', extensions: ['mp4','avi','mkv','mov','wmv','flv','webm','m4v','3gp','ogv','ts','mts'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    properties: ['openFile', 'multiSelections']
                });
                if (!result.canceled && result.filePaths.length) {
                    result.filePaths.forEach(fp => this.addToPlaylist(id, fp));
                    this.renderPlaylistDetail(id);
                }
            } catch (e) { console.error('Add videos dialog error:', e); }
        };
        if (renameBtn) renameBtn.onclick = () => {
            const newName = prompt(t('playlists.rename'), pl.name);
            if (newName && newName.trim()) {
                this.renamePlaylist(id, newName.trim());
                this.renderPlaylistDetail(id);
            }
        };
        if (deleteBtn) deleteBtn.onclick = () => {
            if (confirm(t('playlists.delete') + '?')) {
                this.deletePlaylist(id);
                this.renderPlaylistsView();
            }
        };
    }

    // ── Card Context Menu ──────────────────────────────────────────────────────

    showCardCtxMenu(x, y, filePath) {
        this.hideCardCtxMenu();
        const t        = (key, opts) => window.VLi18n ? window.VLi18n.t(key, opts) : key;
        const isFav    = this.isFavorite(filePath);
        const playlists = this.getPlaylists();

        const menu     = document.createElement('div');
        menu.className = 'card-ctx-menu';
        menu.id        = 'cardCtxMenu';

        const favItem     = document.createElement('div');
        favItem.className = 'card-ctx-item' + (isFav ? ' is-fav-item' : '');
        favItem.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${t(isFav ? 'favorites.unfav_btn' : 'favorites.fav_btn')}`;
        favItem.addEventListener('click', () => { this.toggleFavorite(filePath); this.hideCardCtxMenu(); });
        menu.appendChild(favItem);

        const divider1 = document.createElement('div');
        divider1.className = 'card-ctx-divider';
        menu.appendChild(divider1);

        const label = document.createElement('div');
        label.className   = 'card-ctx-submenu-label';
        label.textContent = t('playlists.add_to');
        menu.appendChild(label);

        playlists.forEach(pl => {
            const inPl   = pl.files.includes(filePath);
            const plItem = document.createElement('div');
            plItem.className = 'card-ctx-pl-item';
            plItem.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>${escHtml(pl.name)}${inPl ? ' ✓' : ''}`;
            plItem.addEventListener('click', () => {
                if (inPl) this.removeFromPlaylist(pl.id, filePath);
                else      this.addToPlaylist(pl.id, filePath);
                this.hideCardCtxMenu();
            });
            menu.appendChild(plItem);
        });

        const divider2 = document.createElement('div');
        divider2.className = 'card-ctx-divider';
        menu.appendChild(divider2);

        const newPlItem     = document.createElement('div');
        newPlItem.className = 'card-ctx-pl-item card-ctx-new-pl';
        newPlItem.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${t('playlists.create')}`;
        newPlItem.addEventListener('click', () => {
            this.hideCardCtxMenu();
            this.pendingAddToNew = filePath;
            this.switchView('playlists');
        });
        menu.appendChild(newPlItem);

        document.body.appendChild(menu);

        const mw = menu.offsetWidth  || 220;
        const mh = menu.offsetHeight || 200;
        menu.style.left = `${Math.min(x, window.innerWidth  - mw - 8)}px`;
        menu.style.top  = `${Math.min(y, window.innerHeight - mh - 8)}px`;

        this._ctxHideListener = e => { if (!menu.contains(e.target)) this.hideCardCtxMenu(); };
        setTimeout(() => document.addEventListener('click', this._ctxHideListener), 0);
    }

    hideCardCtxMenu() {
        document.getElementById('cardCtxMenu')?.remove();
        if (this._ctxHideListener) {
            document.removeEventListener('click', this._ctxHideListener);
            this._ctxHideListener = null;
        }
    }

    // ── Events ────────────────────────────────────────────────────────────────

    bindEvents() {
        if (this.addFolderBtn) this.addFolderBtn.addEventListener('click', () => this.promptAddFolder());
        if (this.openFileBtn)  this.openFileBtn.addEventListener('click', () => this.promptOpenFile());
        if (this.searchInput)  this.searchInput.addEventListener('input', () => this.filterCards(this.searchInput.value));

        document.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });

        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleSidebar());

        this.updateDiskUsage();
    }

    // ── Sidebar Navigation ─────────────────────────────────────────────────────

    async switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.view === view);
        });
        ['library', 'recent', 'folders', 'favorites', 'playlists', 'statistics', 'settings'].forEach(v => {
            const el = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
            if (el) el.classList.toggle('hidden', v !== view);
        });
        if (view === 'recent')     this.renderRecentView();
        if (view === 'folders')    this.renderFoldersView();
        if (view === 'favorites')  this.renderFavoritesView();
        if (view === 'playlists')  this.renderPlaylistsView();
        if (view === 'statistics') await this.renderStatistics();
        if (view === 'settings')   this.renderSettingsPage();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('homeSidebar');
        if (!sidebar) return;
        sidebar.classList.toggle('is-collapsed');
        localStorage.setItem('vl-sidebar-collapsed', sidebar.classList.contains('is-collapsed') ? '1' : '0');
    }

    updateDiskUsage() {
        const el = document.getElementById('diskUsageText');
        if (!el || this.dirs.length === 0) return;
        try {
            let total = 0;
            for (const dir of this.dirs) {
                const files = this.getVideoFilesRecursive(dir, VIDEO_EXT_REGEX);
                for (const fp of files) {
                    try { total += window.vlApi.statSync(fp).size; } catch {}
                }
            }
            const gb = total / (1024 ** 3);
            el.textContent = gb >= 1 ? `${gb.toFixed(1)} GB` : `${(total / (1024 ** 2)).toFixed(0)} MB`;
        } catch {}
    }

    filterCards(query) {
        const q = query.trim().toLowerCase();
        const cards = this.sectionsEl.querySelectorAll('.library-card');
        cards.forEach(card => {
            const nameEl = card.querySelector('.library-card-name');
            const match  = !q || (nameEl && nameEl.textContent.toLowerCase().includes(q));
            card.style.display = match ? '' : 'none';
        });
        const sections = this.sectionsEl.querySelectorAll('.library-section');
        sections.forEach(section => {
            const anyVisible = [...section.querySelectorAll('.library-card')].some(c => c.style.display !== 'none');
            section.style.display = anyVisible ? '' : 'none';
        });
    }

    // ── Track Last Opened ─────────────────────────────────────────────────────

    trackOpened(filePath) {
        if (!this.cache[filePath]) this.cache[filePath] = {};
        this.cache[filePath].lastOpened = Date.now();
        this.cache[filePath].openCount  = (this.cache[filePath].openCount || 0) + 1;
        this.saveCache();
    }

    // ── Recent View ───────────────────────────────────────────────────────────

    renderRecentView() {
        const grid  = document.getElementById('recentGrid');
        const empty = document.getElementById('recentEmpty');
        if (!grid) return;

        const recent = Object.entries(this.cache)
            .filter(([, d]) => d.lastOpened)
            .sort(([, a], [, b]) => b.lastOpened - a.lastOpened)
            .slice(0, 24)
            .map(([fp]) => fp);

        grid.innerHTML = '';
        if (recent.length === 0) {
            if (empty) empty.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            grid.classList.remove('hidden');
            recent.forEach((fp, i) => grid.appendChild(this.buildCard(fp, i)));
        }
    }

    // ── Folders View ───────────────────────────────────────────────────────────

    renderFoldersView() {
        const grid  = document.getElementById('foldersGrid');
        const empty = document.getElementById('foldersEmpty');
        if (!grid) return;

        grid.innerHTML = '';

        if (this.dirs.length === 0) {
            if (empty) empty.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            grid.classList.remove('hidden');
            this.dirs.forEach(dir => {
                const count = this.getVideoFilesRecursive(dir, VIDEO_EXT_REGEX).length;
                grid.appendChild(this.buildFolderCard(dir, count));
            });
        }
    }

    buildFolderCard(dir, fileCount) {
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.innerHTML = `
            <div class="folder-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <div class="folder-card-body">
                <div class="folder-card-name">${escHtml(window.vlApi.pathBasename(dir) || dir)}</div>
                <div class="folder-card-path">${escHtml(dir)}</div>
            </div>
            <div class="folder-card-footer">
                <span class="folder-card-count">${window.VLi18n.t('dynamic.videos', { n: fileCount })}</span>
                <button class="folder-card-remove">${window.VLi18n.t('dynamic.remove')}</button>
            </div>`;
        card.querySelector('.folder-card-remove').addEventListener('click', () => this.removeDir(dir));
        return card;
    }

    // ── Statistics View ────────────────────────────────────────────────────────

    async renderStatistics() {
        const now   = Date.now();
        const day30 = 30 * 24 * 60 * 60 * 1000;

        let totalVideos = 0, totalSize = 0;
        const folderStats = [];

        for (const dir of this.dirs) {
            const files = this.getVideoFilesRecursive(dir, VIDEO_EXT_REGEX);
            let folderSize = 0;
            for (const fp of files) {
                try { folderSize += window.vlApi.statSync(fp).size; } catch {}
            }
            totalVideos += files.length;
            totalSize   += folderSize;
            folderStats.push({ dir, count: files.length, size: folderSize });
        }

        const recentCount = Object.values(this.cache)
            .filter(d => d.lastOpened && (now - d.lastOpened) < day30).length;

        const fmtSize = bytes => {
            const gb = bytes / (1024 ** 3);
            return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
        };

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setVal('statTotalVideos', totalVideos || '0');
        setVal('statLibrarySize', totalSize > 0 ? fmtSize(totalSize) : '—');
        setVal('statRecentCount', recentCount || '0');
        setVal('statFolderCount', this.dirs.length || '0');

        const barsEl      = document.getElementById('statsFolderBars');
        const barsSection = document.getElementById('statsFoldersSection');
        if (barsEl) {
            barsEl.innerHTML = '';
            if (folderStats.length === 0) {
                if (barsSection) barsSection.style.display = 'none';
            } else {
                if (barsSection) barsSection.style.display = '';
                const maxCount = Math.max(...folderStats.map(f => f.count), 1);
                folderStats.forEach(({ dir, count }) => {
                    const pct = Math.round((count / maxCount) * 100);
                    const row = document.createElement('div');
                    row.className = 'stats-bar-row';
                    row.innerHTML = `
                        <div class="stats-bar-label" title="${escHtml(dir)}">${escHtml(window.vlApi.pathBasename(dir) || dir)}</div>
                        <div class="stats-bar-track"><div class="stats-bar-fill" style="width:0%"></div></div>
                        <div class="stats-bar-count">${count}</div>`;
                    barsEl.appendChild(row);
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        row.querySelector('.stats-bar-fill').style.width = `${pct}%`;
                    }));
                });
            }
        }

        const recentGrid  = document.getElementById('statsRecentGrid');
        const recentEmpty = document.getElementById('statsRecentEmpty');
        if (!recentGrid) return;

        const recent = Object.entries(this.cache)
            .filter(([, d]) => d.lastOpened)
            .sort(([, a], [, b]) => b.lastOpened - a.lastOpened)
            .slice(0, 16)
            .map(([fp]) => fp);

        recentGrid.innerHTML = '';
        if (recent.length === 0) {
            if (recentEmpty) recentEmpty.classList.remove('hidden');
            recentGrid.classList.add('hidden');
        } else {
            if (recentEmpty) recentEmpty.classList.add('hidden');
            recentGrid.classList.remove('hidden');
            recent.forEach((fp, i) => recentGrid.appendChild(this.buildCard(fp, i)));
        }

        try {
            const wStats = await window.vlApi.getWatchStats();
            const fmtTime = secs => {
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                if (h > 0) return `${h}h ${m}m`;
                return `${m}m`;
            };

            const totalSeconds  = wStats.totalSeconds || 0;
            const fileEntries   = Object.entries(wStats.files || {});
            const totalSessions = fileEntries.reduce((sum, [, d]) => sum + (d.sessions || 0), 0);

            const daily    = wStats.daily || {};
            const dayKeys  = Object.keys(daily);
            let dailyAvg   = 0;
            if (dayKeys.length > 0) dailyAvg = Math.round(totalSeconds / dayKeys.length);

            let streak = 0;
            if (dayKeys.length > 0) {
                const today = new Date().toISOString().slice(0, 10);
                let check   = new Date(today);
                while (true) {
                    const key = check.toISOString().slice(0, 10);
                    if (daily[key]) { streak++; check.setDate(check.getDate() - 1); }
                    else break;
                }
            }

            setVal('statTotalWatchTime', totalSeconds > 0 ? fmtTime(totalSeconds) : '—');
            setVal('statTotalSessions',  totalSessions || '0');
            setVal('statDailyAvg',       dailyAvg > 0 ? fmtTime(dailyAvg) : '—');
            setVal('statCurrentStreak',  streak > 0 ? `${streak} ${window.VLi18n ? window.VLi18n.t('dynamic.days', { n: streak }) : 'days'}` : '—');

            const mwBars    = document.getElementById('statsMostWatchedBars');
            const mwSection = document.getElementById('statsMostWatchedSection');
            const mwEmpty   = document.getElementById('statsMostWatchedEmpty');
            if (mwBars) {
                mwBars.innerHTML = '';
                const top = fileEntries
                    .filter(([, d]) => d.totalSeconds > 0)
                    .sort(([, a], [, b]) => b.totalSeconds - a.totalSeconds)
                    .slice(0, 10);
                if (top.length === 0) {
                    if (mwSection) mwSection.style.display = 'none';
                    if (mwEmpty)   mwEmpty.classList.remove('hidden');
                } else {
                    if (mwSection) mwSection.style.display = '';
                    if (mwEmpty)   mwEmpty.classList.add('hidden');
                    const maxSec = Math.max(...top.map(([, d]) => d.totalSeconds), 1);
                    top.forEach(([fp, d]) => {
                        const pct = Math.round((d.totalSeconds / maxSec) * 100);
                        const row = document.createElement('div');
                        row.className = 'stats-bar-row';
                        row.innerHTML = `
                            <div class="stats-bar-label" title="${escHtml(fp)}">${escHtml(window.vlApi.pathBasename(fp))}</div>
                            <div class="stats-bar-track"><div class="stats-bar-fill" style="width:0%"></div></div>
                            <div class="stats-bar-count">${fmtTime(d.totalSeconds)} · ${d.sessions || 0}</div>`;
                        mwBars.appendChild(row);
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            row.querySelector('.stats-bar-fill').style.width = `${pct}%`;
                        }));
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load watch stats:', e);
        }
    }

    // ── Settings View ──────────────────────────────────────────────────────────

    loadAppSettings() {
        try { return JSON.parse(localStorage.getItem('vl-app-settings') || '{}'); }
        catch { return {}; }
    }

    saveAppSettings(patch) {
        const s = this.loadAppSettings();
        Object.assign(s, patch);
        localStorage.setItem('vl-app-settings', JSON.stringify(s));
        return s;
    }

    renderSettingsPage() {
        const s = this.loadAppSettings();

        const volSlider = document.getElementById('settingDefaultVolume');
        const volVal    = document.getElementById('settingDefaultVolumeVal');
        if (volSlider) {
            volSlider.value = s.defaultVolume !== undefined ? s.defaultVolume : 50;
            if (volVal) volVal.textContent = `${volSlider.value}%`;
            volSlider.oninput = () => {
                if (volVal) volVal.textContent = `${volSlider.value}%`;
                this.saveAppSettings({ defaultVolume: Number(volSlider.value) });
            };
        }

        const ambSlider = document.getElementById('settingAmbientIntensity');
        const ambVal    = document.getElementById('settingAmbientIntensityVal');
        if (ambSlider) {
            ambSlider.value = s.ambientIntensity !== undefined ? s.ambientIntensity : 50;
            if (ambVal) ambVal.textContent = `${ambSlider.value}%`;
            ambSlider.oninput = () => {
                if (ambVal) ambVal.textContent = `${ambSlider.value}%`;
                this.saveAppSettings({ ambientIntensity: Number(ambSlider.value) });
            };
        }

        const bindToggle = (id, key, def = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = s[key] !== undefined ? s[key] : def;
            el.onchange = () => this.saveAppSettings({ [key]: el.checked });
        };
        bindToggle('settingResume',     'resumePlayback',    false);
        bindToggle('settingAutoNext',   'autoPlayNext',      true);
        bindToggle('settingHwAccel',    'hwAccel',           true);
        bindToggle('settingThumbnails', 'generateThumbnails', true);

        this._refreshSettingsCacheInfo();

        const clearCacheBtn = document.getElementById('settingClearCache');
        if (clearCacheBtn) {
            clearCacheBtn.onclick = () => {
                for (const key of Object.keys(this.cache)) delete this.cache[key].thumbDataUrl;
                this.saveCache();
                this._refreshSettingsCacheInfo();
            };
        }

        const clearHistBtn = document.getElementById('settingClearHistory');
        if (clearHistBtn) {
            clearHistBtn.onclick = () => {
                for (const key of Object.keys(this.cache)) {
                    delete this.cache[key].lastOpened;
                    delete this.cache[key].openCount;
                }
                this.saveCache();
                localStorage.removeItem('vl-resume-pos');
                this._refreshSettingsCacheInfo();
            };
        }

        const currentLang = window.VLi18n ? window.VLi18n.lang : 'en';
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.lang === currentLang);
            btn.onclick = () => {
                const lang = btn.dataset.lang;
                this.saveAppSettings({ language: lang });
                if (window.VLi18n) {
                    window.VLi18n.applyLang(lang);
                    document.documentElement.lang = lang;
                    document.querySelectorAll('.lang-btn').forEach(b =>
                        b.classList.toggle('is-active', b.dataset.lang === lang));
                    this.render();
                    this._refreshSettingsCacheInfo();
                }
            };
        });
    }

    _refreshSettingsCacheInfo() {
        const thumbCount = Object.values(this.cache).filter(d => d.thumbDataUrl).length;
        const histCount  = Object.values(this.cache).filter(d => d.lastOpened).length;
        const cacheDesc  = document.getElementById('settingCacheDesc');
        const histDesc   = document.getElementById('settingHistoryDesc');
        if (cacheDesc) cacheDesc.textContent = thumbCount > 0
            ? window.VLi18n.t('dynamic.thumbnails_stored', { n: thumbCount })
            : window.VLi18n.t('dynamic.no_thumbnails');
        if (histDesc) histDesc.textContent = histCount > 0
            ? window.VLi18n.t('dynamic.history_items', { n: histCount })
            : window.VLi18n.t('dynamic.history_empty');
    }

    // ── Dialog Prompts ─────────────────────────────────────────────────────────

    async promptAddFolder() {
        try {
            const result = await window.vlApi.invoke('show-directory-dialog');
            if (!result.canceled && result.filePaths.length > 0) {
                const dir = result.filePaths[0];
                if (!this.dirs.includes(dir)) {
                    this.dirs.push(dir);
                    this.saveDirs();
                    this.render();
                    if (this.currentView === 'folders') this.renderFoldersView();
                }
            }
        } catch (e) { console.error('Add folder error:', e); }
    }

    async promptOpenFile() {
        try {
            const result = await window.vlApi.invoke('show-open-dialog', {
                title: 'Open video file',
                filters: [
                    { name: 'Video', extensions: ['mp4','avi','mkv','mov','wmv','flv','webm','m4v','3gp','ogv','ts','mts'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });
            if (!result.canceled && result.filePaths.length > 0) {
                this.player.playlist.loadVideoFile(result.filePaths[0]);
            }
        } catch (e) { console.error('Open file error:', e); }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    render() {
        if (!this.sectionsEl || !this.emptyEl) return;

        this.thumbnailQueue      = [];
        this.activeThumbnailJobs = 0;
        if (this.searchInput) this.searchInput.value = '';

        if (this.dirs.length === 0) {
            this.emptyEl.classList.remove('hidden');
            this.sectionsEl.classList.add('hidden');
            return;
        }

        this.emptyEl.classList.add('hidden');
        this.sectionsEl.classList.remove('hidden');
        this.sectionsEl.innerHTML = '';

        for (const dir of this.dirs) {
            const files = this.getVideoFilesRecursive(dir, VIDEO_EXT_REGEX);
            if (files.length === 0) continue;
            this.sectionsEl.appendChild(this.buildSection(dir, files));
        }

        this.processThumbnailQueue();
    }

    buildSection(dir, files) {
        const section = document.createElement('div');
        section.className = 'library-section';

        const header   = document.createElement('div');
        header.className = 'library-section-header';

        const title      = document.createElement('div');
        title.className  = 'library-section-title';
        title.textContent = window.vlApi.pathBasename(dir) || dir;

        const removeBtn       = document.createElement('button');
        removeBtn.className   = 'library-section-remove';
        removeBtn.textContent = window.VLi18n.t('dynamic.remove');
        removeBtn.addEventListener('click', () => this.removeDir(dir));

        const countEl       = document.createElement('span');
        countEl.className   = 'library-section-count';
        countEl.textContent = window.VLi18n.t('dynamic.files', { n: files.length });

        header.appendChild(title);
        header.appendChild(countEl);
        header.appendChild(removeBtn);

        const grid     = document.createElement('div');
        grid.className = 'library-grid';
        files.forEach((filePath, i) => grid.appendChild(this.buildCard(filePath, i)));

        section.appendChild(header);
        section.appendChild(grid);
        return section;
    }

    buildCard(filePath, cardIndex = 0) {
        const card     = document.createElement('div');
        card.className = 'library-card';
        card.title     = filePath;
        card.style.animationDelay = `${Math.min(cardIndex * 40, 600)}ms`;

        const thumbDiv     = document.createElement('div');
        thumbDiv.className = 'library-card-thumb';

        const cached = this.cache[filePath];
        if (cached && cached.thumbDataUrl) {
            const img = document.createElement('img');
            img.src   = cached.thumbDataUrl;
            thumbDiv.appendChild(img);
        } else {
            thumbDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"></polygon>
            </svg>`;
            const appSettings = (() => {
                try { return JSON.parse(localStorage.getItem('vl-app-settings') || '{}'); } catch { return {}; }
            })();
            if (appSettings.generateThumbnails !== false) {
                this.thumbnailQueue.push({ filePath, thumbDiv, card });
            }
        }

        const playOverlay     = document.createElement('div');
        playOverlay.className = 'card-play-overlay';
        playOverlay.innerHTML = `<div class="card-play-icon"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></div>`;
        thumbDiv.appendChild(playOverlay);

        const isFav  = this.isFavorite(filePath);
        const t      = key => window.VLi18n ? window.VLi18n.t(key) : key;
        const favBtn = document.createElement('button');
        favBtn.className   = 'card-fav-btn' + (isFav ? ' is-fav' : '');
        favBtn.dataset.path = filePath;
        favBtn.title       = t(isFav ? 'favorites.unfav_btn' : 'favorites.fav_btn');
        favBtn.innerHTML   = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${isFav ? 'currentColor' : 'none'}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        favBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleFavorite(filePath); });

        const cardActions     = document.createElement('div');
        cardActions.className = 'card-actions';
        cardActions.appendChild(favBtn);
        thumbDiv.appendChild(cardActions);

        const info     = document.createElement('div');
        info.className = 'library-card-info';

        const nameEl       = document.createElement('div');
        nameEl.className   = 'library-card-name';
        nameEl.textContent = window.vlApi.pathBasename(filePath, window.vlApi.pathExtname(filePath));

        const durEl       = document.createElement('div');
        durEl.className   = 'library-card-duration';
        durEl.textContent = (cached && cached.duration) ? formatTime(cached.duration) : '—';

        info.appendChild(nameEl);
        info.appendChild(durEl);
        card.appendChild(thumbDiv);
        card.appendChild(info);

        card.addEventListener('click', () => {
            this.trackOpened(filePath);
            this.player.playlist.loadVideoFile(filePath);
        });
        card.addEventListener('contextmenu', e => {
            e.preventDefault();
            this.showCardCtxMenu(e.clientX, e.clientY, filePath);
        });

        return card;
    }

    // ── Recursive File Scan ───────────────────────────────────────────────────

    getVideoFilesRecursive(dir, videoExt, depth = 0) {
        if (depth > 6) return [];
        let results = [];
        try {
            const entries = window.vlApi.readdirSync(dir);
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = window.vlApi.pathJoin(dir, entry.name);
                if (entry.isDirectory) {
                    results = results.concat(this.getVideoFilesRecursive(fullPath, videoExt, depth + 1));
                } else if (entry.isFile && videoExt.test(entry.name)) {
                    results.push(fullPath);
                }
            }
        } catch (e) { console.warn('Cannot read dir:', dir, e.message); }
        return results.sort();
    }

    // ── Thumbnail Generation ───────────────────────────────────────────────────

    processThumbnailQueue() {
        while (this.activeThumbnailJobs < this.CONCURRENCY && this.thumbnailQueue.length > 0) {
            const job = this.thumbnailQueue.shift();
            this.activeThumbnailJobs++;
            this.generateThumbnail(job).finally(() => {
                this.activeThumbnailJobs--;
                this.processThumbnailQueue();
            });
        }
    }

    generateThumbnail({ filePath, thumbDiv, card }) {
        return new Promise(resolve => {
            const fileUrl   = 'file:///' + filePath.replace(/\\/g, '/');
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';
            tempVideo.muted   = true;
            tempVideo.src     = fileUrl;
            tempVideo.style.display = 'none';
            document.body.appendChild(tempVideo);

            let done = false;
            const cleanup = () => {
                if (done) return;
                done = true;
                if (document.body.contains(tempVideo)) document.body.removeChild(tempVideo);
                resolve();
            };

            const safetyTimer = setTimeout(cleanup, 8000);

            tempVideo.addEventListener('loadedmetadata', () => {
                const duration = tempVideo.duration;
                if (!this.cache[filePath]) this.cache[filePath] = {};
                this.cache[filePath].duration = duration;
                const durEl = card.querySelector('.library-card-duration');
                if (durEl) durEl.textContent = formatTime(duration);
                tempVideo.currentTime = Math.min(5, duration * 0.1);
            });

            tempVideo.addEventListener('seeked', () => {
                clearTimeout(safetyTimer);
                try {
                    const canvas   = document.createElement('canvas');
                    canvas.width   = 200;
                    canvas.height  = 112;
                    const ctx      = canvas.getContext('2d');
                    ctx.drawImage(tempVideo, 0, 0, 200, 112);
                    const dataUrl  = canvas.toDataURL('image/jpeg', 0.75);

                    thumbDiv.innerHTML = '';
                    const img = document.createElement('img');
                    img.src   = dataUrl;
                    thumbDiv.appendChild(img);

                    this.cache[filePath].thumbDataUrl = dataUrl;
                    this.saveCache();
                } catch (e) { console.warn('Canvas draw failed:', e); }
                cleanup();
            });

            tempVideo.addEventListener('error', () => { clearTimeout(safetyTimer); cleanup(); });
        });
    }

    // ── Directory Management ───────────────────────────────────────────────────

    removeDir(dir) {
        this.dirs = this.dirs.filter(d => d !== dir);
        this.saveDirs();
        this.render();
        if (this.currentView === 'folders') this.renderFoldersView();
    }
}
