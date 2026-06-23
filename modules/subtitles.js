// ─── SubtitleManager ─────────────────────────────────────────────────────────
// Handles: subtitle file loading (SRT/VTT), SRT→VTT conversion,
//          Blob URL management, CC button state.

class SubtitleManager {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player = player;

        this.subtitlesActive  = false;
        this.subtitleBlobUrl  = null;
    }

    // ── Toggle & State ───────────────────────────────────────────────────────

    toggle() {
        if (!this.subtitlesActive && !this.subtitleBlobUrl) {
            this.showSubmenu();
        } else {
            this.subtitlesActive = !this.subtitlesActive;
            this.applyState();
        }
        this.player.ui.handleUserActivity();
    }

    applyState() {
        const track = this.player.subtitleTrack;
        if (track) {
            track.track.mode = this.subtitlesActive ? 'showing' : 'hidden';
        }
        this.player.ccBtn.style.opacity = this.subtitlesActive ? '1' : '0.6';
        this.player.ccBtn.title = this.subtitlesActive ? 'Subtitles: On' : 'Subtitles: Off';
        if (this.player.subtitlesValue) {
            this.player.subtitlesValue.textContent = this.player._tv(this.subtitlesActive ? 'On' : 'Off');
        }
    }

    clear() {
        if (this.subtitleBlobUrl) {
            URL.revokeObjectURL(this.subtitleBlobUrl);
            this.subtitleBlobUrl = null;
        }
        const track = this.player.subtitleTrack;
        if (track) track.src = '';
        this.subtitlesActive = false;
        this.applyState();
    }

    // ── File Loading ─────────────────────────────────────────────────────────

    async openDialog() {
        try {
            const result = await window.vlApi.invoke('show-open-dialog', {
                title: 'Select subtitle file',
                filters: [
                    { name: 'Subtitles', extensions: ['vtt', 'srt'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });
            if (!result.canceled && result.filePaths.length > 0) {
                this.loadFile(result.filePaths[0]);
                this.player.ui.showMainSettings();
            }
        } catch (e) {
            console.error('Subtitle dialog error:', e);
        }
    }

    loadFile(filePath) {
        try {
            const content = window.vlApi.readFileSync(filePath, 'utf-8');
            const ext     = filePath.split('.').pop().toLowerCase();

            let vttContent = content;
            if (ext === 'srt') {
                vttContent = this.srtToVtt(content);
            }

            if (this.subtitleBlobUrl) {
                URL.revokeObjectURL(this.subtitleBlobUrl);
            }

            const blob = new Blob([vttContent], { type: 'text/vtt' });
            this.subtitleBlobUrl = URL.createObjectURL(blob);

            const track = this.player.subtitleTrack;
            if (track) {
                track.src = this.subtitleBlobUrl;
                track.track.mode = 'showing';
            }

            this.subtitlesActive = true;
            this.applyState();
            console.log('Subtitles loaded:', filePath);
        } catch (e) {
            console.error('Failed to load subtitles:', e);
        }
    }

    // ── SRT → VTT Conversion ─────────────────────────────────────────────────

    srtToVtt(srt) {
        let vtt = 'WEBVTT\n\n';
        vtt += srt
            .trim()
            .replace(/\r\n|\r/g, '\n')
            .replace(/^\d+\s*\n/gm, '')
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
            .trim();
        return vtt;
    }

    // ── Submenu ──────────────────────────────────────────────────────────────

    showSubmenu() {
        this.player.settingsMenu.classList.add('hidden');
        this.player.settingsOpen = false;
        this.player.ui.closeAllSubmenus();
        this.player.subtitlesSubmenu.classList.remove('hidden');
        this.player.currentSubmenu = 'subtitles';
        this.player.subtitlesSubmenu.querySelectorAll('.submenu-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.value === 'off' && !this.subtitlesActive) opt.classList.add('active');
        });
    }
}
