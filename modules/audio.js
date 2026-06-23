// ─── AudioManager ─────────────────────────────────────────────────────────────
// Handles: Web Audio API, stable volume (DynamicsCompressor),
//          audio track detection (native / ffprobe / MKV-parser),
//          ffmpeg transcoding for AC3/DTS tracks.

class AudioManager {
    /**
     * @param {HTMLVideoElement} video
     * @param {VisionLumina} player
     */
    constructor(video, player) {
        this.video  = video;
        this.player = player;

        // Web Audio API nodes
        this.audioContext = null;
        this.audioSource  = null;
        this.compressor   = null;
        this.gainNode     = null;

        // External audio element for AC3/DTS via ffmpeg
        this.externalAudio      = null;
        this._externalAudioPath = null;
        this._audioReadyPromise = null;

        // Track lists
        this.availableAudioTracks = [];
        this.currentAudioTrack    = null;
        this._ffprobeTracks       = [];
    }

    // ── Web Audio Context ────────────────────────────────────────────────────

    setup() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioSource  = this.audioContext.createMediaElementSource(this.video);

            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value      = 30;
            this.compressor.ratio.value     = 12;
            this.compressor.attack.value    = 0.003;
            this.compressor.release.value   = 0.25;

            this.gainNode = this.audioContext.createGain();

            // Default routing: source -> gain -> destination (compressor bypassed)
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
        } catch (e) {
            console.warn('AudioContext not available:', e);
        }
    }

    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try { await this.audioContext.resume(); } catch (e) {}
        }
    }

    // ── Stable Volume (DynamicsCompressor) ───────────────────────────────────

    toggleStableVolume(enabled) {
        if (!this.audioContext || !this.audioSource) {
            console.warn('AudioContext not initialized');
            return;
        }
        this.resumeContext();
        try {
            this.audioSource.disconnect();
            this.gainNode.disconnect();
            this.compressor.disconnect();

            if (enabled) {
                // source -> compressor -> gain -> destination
                this.audioSource.connect(this.compressor);
                this.compressor.connect(this.gainNode);
            } else {
                // source -> gain -> destination (compressor bypassed)
                this.audioSource.connect(this.gainNode);
            }
            this.gainNode.connect(this.audioContext.destination);
        } catch (e) {
            console.error('Audio graph reconnect error:', e);
        }
        console.log('Stable Volume:', enabled);
    }

    // ── External Audio (AC3/DTS via ffmpeg) ──────────────────────────────────

    setupExternalAudio(src) {
        this.cleanupExternalAudio();
        this.externalAudio = new Audio(src);
        this.externalAudio.volume      = (this.video.muted || this.video.volume === 0) ? 0 : this.video.volume;
        this.externalAudio.playbackRate = this.video.playbackRate;
        this.externalAudio.currentTime = this.video.currentTime;
        if (this.player.isPlaying) {
            this.externalAudio.play().catch(e => console.warn('External audio play failed:', e));
        }
    }

    cleanupExternalAudio() {
        if (this.externalAudio) {
            this.externalAudio.pause();
            this.externalAudio.src = '';
            this.externalAudio = null;
        }
    }

    async cleanupTempAudio() {
        if (this._externalAudioPath) {
            window.vlApi.invoke('cleanup-temp-audio', this._externalAudioPath).catch(() => {});
            this._externalAudioPath = null;
        }
    }

    setLoading(loading) {
        if (loading) {
            this.player.playPauseBtn.classList.add('audio-loading');
            this.player.showSleepNotification('Loading audio (AC3)...', 120000);
        } else {
            this.player.playPauseBtn.classList.remove('audio-loading');
            if (this.player.sleepNotification) {
                this.player.sleepNotification.classList.remove('show');
            }
        }
    }

    async tryFfmpegAudio(trackIndex) {
        if (!this.player.currentVideoPath) return;
        const extractingForPath = this.player.currentVideoPath;

        this.setLoading(true);
        try {
            const result = await window.vlApi.invoke('extract-audio-track', {
                filePath: extractingForPath,
                trackIndex
            });
            if (this.player.currentVideoPath !== extractingForPath) return;

            if (!result.success) {
                this.player.showSleepNotification('AC3 audio: install ffmpeg for support', 5000);
                return;
            }
            await this.cleanupTempAudio();
            this._externalAudioPath = result.tempPath;
            this.setupExternalAudio('file:///' + result.tempPath.replace(/\\/g, '/'));
            console.log('AC3 audio ready');
        } catch (e) {
            console.error('Audio extraction error:', e);
            this.player.showSleepNotification('AC3 audio extraction failed', 4000);
        } finally {
            this.setLoading(false);
        }
    }

    async prepareAudio(filePath) {
        try {
            const result = await window.vlApi.invoke('get-audio-tracks-ffprobe', filePath);
            if (this.player.currentVideoPath !== filePath) return;
            if (!result.available || result.tracks.length === 0) return;

            this.onFfprobeReady(result.tracks);

            const bestTrack = result.tracks.find(t => this.isCodecSupported(t.codec))
                || result.tracks[0];

            if (bestTrack && bestTrack.codec && !this.isCodecSupported(bestTrack.codec)) {
                await this.tryFfmpegAudio(bestTrack.index);
            }
        } catch {}
    }

    async playWhenReady() {
        if (this._audioReadyPromise) {
            try { await this._audioReadyPromise; } catch {}
        }
        this.player.play();
    }

    // ── Codec Detection ──────────────────────────────────────────────────────

    isCodecSupported(codec) {
        if (!codec) return true;
        const c = codec.toUpperCase().replace(/^A_/, '');
        const unsupported = ['AC3', 'DTS', 'TRUEHD', 'EAC3', 'MLP'];
        return !unsupported.some(u => c === u || c.startsWith(u + '_'));
    }

    getBestTrackIndex() {
        for (let i = 0; i < this.availableAudioTracks.length; i++) {
            if (this.isCodecSupported(this.availableAudioTracks[i].codec)) return i;
        }
        return 0;
    }

    // ── Track Population ─────────────────────────────────────────────────────

    populateAudioTracks() {
        this.availableAudioTracks = [];

        if (this.video.audioTracks && this.video.audioTracks.length > 0) {
            let nativeDefault = 0;
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                const t = this.video.audioTracks[i];
                this.availableAudioTracks.push({
                    id: t.id || String(i),
                    label: t.label || (t.language ? `Track ${i + 1} (${t.language})` : `Track ${i + 1}`),
                    language: t.language || '',
                    index: i,
                    nativeTrack: t
                });
                if (t.enabled) nativeDefault = i;
            }
            const anyEnabled = Array.from(
                { length: this.video.audioTracks.length },
                (_, i) => this.video.audioTracks[i].enabled
            ).some(Boolean);
            if (!anyEnabled) {
                this.video.audioTracks[0].enabled = true;
                nativeDefault = 0;
            }
            if (this._ffprobeTracks.length > 0) {
                for (let i = 0; i < this.availableAudioTracks.length && i < this._ffprobeTracks.length; i++) {
                    this.availableAudioTracks[i].codec = this._ffprobeTracks[i].codec;
                }
            }
            this.currentAudioTrack = this.availableAudioTracks[nativeDefault];
            this.player.settings.audioTrack = this.currentAudioTrack.label;
            this.player.audioTrackValue.textContent = this.player._tv(this.currentAudioTrack.label);
            this.buildAudioTrackMenu();
            console.log(`Native audio tracks: ${this.availableAudioTracks.length}, active: ${nativeDefault}`);
            return;
        } else if (this._ffprobeTracks && this._ffprobeTracks.length > 0) {
            this.buildTracksFromProbe(this._ffprobeTracks);
            return;
        } else {
            this.availableAudioTracks.push({
                id: '0', label: 'Default', language: '', index: 0, nativeTrack: null
            });
        }

        this.commitAudioTracks();
    }

    onFfprobeReady(probedTracks) {
        this._ffprobeTracks = probedTracks;
        const nativeCount = this.video.audioTracks ? this.video.audioTracks.length : 0;

        if (nativeCount === 0) {
            if (probedTracks.length > 0) {
                this.buildTracksFromProbe(probedTracks);
            }
        } else {
            for (let i = 0; i < this.availableAudioTracks.length && i < probedTracks.length; i++) {
                this.availableAudioTracks[i].codec = probedTracks[i].codec;
            }
        }
    }

    buildTracksFromProbe(probedTracks) {
        this.availableAudioTracks = probedTracks.map(t => ({
            id: String(t.index),
            label: t.label,
            language: t.language || '',
            codec: t.codec || '',
            index: t.index,
            nativeTrack: null,
            ffprobeTrack: true,
        }));
        this.commitAudioTracks();
        console.log(`ffprobe/mkv-parser tracks applied: ${this.availableAudioTracks.length}`);
    }

    commitAudioTracks() {
        const bestIdx = this.getBestTrackIndex();
        this.currentAudioTrack = this.availableAudioTracks[bestIdx];
        if (this.video.audioTracks && this.video.audioTracks.length > bestIdx) {
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                this.video.audioTracks[i].enabled = (i === bestIdx);
            }
        }
        this.player.settings.audioTrack = this.currentAudioTrack.label;
        this.player.audioTrackValue.textContent = this.player._tv(this.currentAudioTrack.label);
        this.buildAudioTrackMenu();
        console.log(`Audio tracks committed: ${this.availableAudioTracks.length}, best: ${bestIdx} (${this.currentAudioTrack.label})`);
    }

    // ── Audio Track Menu ─────────────────────────────────────────────────────

    buildAudioTrackMenu() {
        const submenu = this.player.audioSubmenu;
        const header  = submenu.querySelector('.submenu-header');
        submenu.innerHTML = '';
        submenu.appendChild(header);

        this.availableAudioTracks.forEach(track => {
            const option = document.createElement('div');
            option.className   = 'submenu-option';
            option.dataset.value = track.label;
            option.textContent = track.language
                ? `${track.label} (${track.language})`
                : track.label;

            if (this.currentAudioTrack && track.id === this.currentAudioTrack.id) {
                option.classList.add('active');
            }
            option.addEventListener('click', e => {
                e.stopPropagation();
                this.selectAudioTrack(track);
            });
            submenu.appendChild(option);
        });
    }

    async selectAudioTrack(track) {
        const wasPlaying = this.player.isPlaying;

        if (this.video.audioTracks && this.video.audioTracks.length > 1 && !track.ffprobeTrack) {
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                this.video.audioTracks[i].enabled = (i === track.index);
            }
        } else if (track.codec && !this.isCodecSupported(track.codec)) {
            if (wasPlaying) this.player.pause();
            this._audioReadyPromise = this.tryFfmpegAudio(track.index);
            await this._audioReadyPromise;
            if (wasPlaying && this.player.currentVideoPath) this.player.play();
        }

        this.currentAudioTrack = track;
        this.player.settings.audioTrack = track.label;
        this.player.audioTrackValue.textContent = this.player._tv(track.label);
        this.player.ui.updateActiveOption('audioSubmenu', track.label);
        console.log('Audio track selected:', track.label);
        this.player.ui.showMainSettings();
    }

    showSubmenu() {
        this.player.settingsMenu.classList.add('hidden');
        this.player.settingsOpen = false;
        this.player.ui.closeAllSubmenus();
        this.player.audioSubmenu.classList.remove('hidden');
        this.player.currentSubmenu = 'audio';
        this.player.ui.updateActiveOption('audioSubmenu', this.player.settings.audioTrack);
    }

    // ── Volume sync for external audio ───────────────────────────────────────

    syncVolume() {
        if (!this.externalAudio) return;
        const muted = this.video.muted || this.video.volume === 0;
        this.externalAudio.volume = muted ? 0 : this.video.volume;
        this.externalAudio.muted  = this.video.muted;
    }

    syncTime() {
        if (this.externalAudio) this.externalAudio.currentTime = this.video.currentTime;
    }

    syncPlaybackRate(rate) {
        if (this.externalAudio) this.externalAudio.playbackRate = rate;
    }

    syncPlay() {
        if (this.externalAudio) {
            this.externalAudio.currentTime = this.video.currentTime;
            this.externalAudio.play().catch(() => {});
        }
    }

    syncPause() {
        if (this.externalAudio) this.externalAudio.pause();
    }
}
