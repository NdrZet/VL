// ─── PlaylistManager ─────────────────────────────────────────────────────────
// Handles: loading video files, building directory playlist,
//          next/prev navigation, chapter management.

class PlaylistManager {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player       = player;
        this.playlist     = [];
        this.currentIndex = -1;
    }

    // ── Video File Loading ───────────────────────────────────────────────────

    async loadVideoFile(filePath) {
        if (!filePath) return;

        const player = this.player;

        player.stats.endSession();
        player.currentVideoPath = filePath;
        player.features.resetVideoTransform();

        // Cleanup previous external audio
        player.audio.syncPause();
        player.audio.cleanupExternalAudio();
        await player.audio.cleanupTempAudio();

        const fileUrl = filePath.startsWith('file://')
            ? filePath
            : `file://${filePath.replace(/\\/g, '/')}`;

        // Reset ffprobe data BEFORE load — avoid stale data race
        player.audio._ffprobeTracks = [];

        // Set audio promise BEFORE video.load() — loadedmetadata may fire before await
        player.audio._audioReadyPromise = player.audio.prepareAudio(filePath);

        player.video.src = fileUrl;

        const fileName = filePath.split(/[/\\]/).pop();
        document.title = `Vision Lumina Player - ${fileName}`;

        player.video.load();

        await this.buildPlaylist(filePath);

        player.subs.clear();

        console.log('Loaded video:', fileName);
    }

    async buildPlaylist(currentFilePath) {
        try {
            const dirPath = currentFilePath.replace(/[/\\][^/\\]+$/, '');
            const files   = await window.vlApi.invoke('get-directory-files', dirPath);

            this.playlist = files;
            const normalized = f => f.replace(/\\/g, '/').toLowerCase();
            this.currentIndex = files.findIndex(
                f => normalized(f) === normalized(currentFilePath)
            );

            console.log(`Playlist: ${files.length} files, current index: ${this.currentIndex}`);
        } catch (e) {
            console.warn('Could not build playlist:', e);
            this.playlist    = [currentFilePath];
            this.currentIndex = 0;
        }
    }

    nextVideo() {
        if (this.playlist.length > 1 && this.currentIndex >= 0) {
            const nextIndex = (this.currentIndex + 1) % this.playlist.length;
            this.loadVideoFile(this.playlist[nextIndex]);
        } else {
            this.player.video.currentTime = 0;
            if (this.player.isPlaying) this.player.play();
        }
        this.player.ui.handleUserActivity();
    }

    // ── Chapters ─────────────────────────────────────────────────────────────

    async showChapterMenu() {
        const player = this.player;
        player.ui.handleUserActivity();

        if (!player.currentVideoPath) return;

        const chapterFile = player.currentVideoPath.replace(/\.[^.]+$/, '.chapters.vtt');

        try {
            if (window.vlApi.existsSync(chapterFile)) {
                const content    = window.vlApi.readFileSync(chapterFile, 'utf-8');
                player.chapters  = this.parseVttChapters(content);
                player.chapterBtn.classList.remove('hidden');
                this.updateCurrentChapter();
                console.log(`Chapters loaded: ${player.chapters.length}`);
            } else {
                console.log('No chapter file found:', chapterFile);
            }
        } catch (e) {
            console.warn('Chapter load error:', e);
        }
    }

    parseVttChapters(vttContent) {
        const chapters = [];
        const blocks   = vttContent.split(/\n\n+/);

        for (const block of blocks) {
            const lines  = block.trim().split('\n');
            if (lines.length < 2) continue;

            const tsLine = lines.find(l => l.includes(' --> '));
            if (!tsLine) continue;

            const [startStr] = tsLine.split(' --> ');
            const title = lines[lines.length - 1].trim();
            if (title && !title.startsWith('WEBVTT')) {
                chapters.push({
                    start: this.parseVttTime(startStr.trim()),
                    title
                });
            }
        }
        return chapters;
    }

    parseVttTime(ts) {
        const parts = ts.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parseFloat(parts[2]);
        }
        return parts[0] * 60 + parseFloat(parts[1]);
    }

    updateCurrentChapter() {
        const player = this.player;
        if (!player.chapters || player.chapters.length === 0) return;

        const currentTime = player.video.currentTime;
        let current = player.chapters[0];
        for (const ch of player.chapters) {
            if (currentTime >= ch.start) current = ch;
        }

        const span = player.chapterBtn.querySelector('span');
        if (span) span.textContent = current.title;
    }
}
