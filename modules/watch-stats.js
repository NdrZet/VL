// ─── WatchStats ───────────────────────────────────────────────────────────────
// Handles: watch session tracking, time accumulation,
//          periodic flush to main process, resume-position saving.

class WatchStats {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player = player;

        this._sessionFile  = null;
        this._sessionStart = 0;
        this._flushTimer   = null;
    }

    setup() {
        const video = this.player.video;

        video.addEventListener('play',  () => this.startSession());
        video.addEventListener('pause', () => this.endSession());
        video.addEventListener('ended', () => this.endSession());

        window.addEventListener('beforeunload', () => this.endSession());

        // Flush every 5 s so crash/close doesn't lose much data
        this._flushTimer = setInterval(() => this.flush(), 5000);
    }

    startSession() {
        if (!this.player.currentVideoPath || this.player.video.paused) return;
        this._sessionFile  = this.player.currentVideoPath;
        this._sessionStart = Date.now();
        window.vlApi.startWatchSession(this.player.currentVideoPath).catch(() => {});
    }

    endSession() {
        this.flush();
        this._sessionFile  = null;
        this._sessionStart = 0;
    }

    flush() {
        if (!this._sessionFile || !this._sessionStart) return;
        const elapsed = Math.round((Date.now() - this._sessionStart) / 1000);
        if (elapsed < 1) return;
        window.vlApi.trackWatchTime(this._sessionFile, elapsed).catch(() => {});
        this._sessionStart = Date.now();
    }
}
