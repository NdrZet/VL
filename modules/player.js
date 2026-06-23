// ─── VisionLumina (Player Core) ───────────────────────────────────────────────
// Coordinator class. Owns all DOM refs and delegates to manager classes.
// Dependencies (loaded before this script):
//   utils.js, audio.js, subtitles.js, playlist.js,
//   watch-stats.js, watch-together.js, ui.js, features.js, home-library.js

class VisionLumina {
    constructor() {
        // Core elements
        this.video           = document.getElementById('videoPlayer');
        this.videoWrapper    = document.getElementById('videoWrapper');
        this.controlBar      = document.getElementById('controlBar');
        this.settingsMenu    = document.getElementById('settingsMenu');
        this.playerContainer = document.querySelector('.player-container');
        this.ambientCanvas   = document.getElementById('ambientCanvas');

        // Control buttons
        this.playPauseBtn     = document.getElementById('playPauseBtn');
        this.nextBtn          = document.getElementById('nextBtn');
        this.volumeBtn        = document.getElementById('volumeBtn');
        this.ccBtn            = document.getElementById('ccBtn');
        this.settingsBtn      = document.getElementById('settingsBtn');
        this.watchTogetherBtn = document.getElementById('watchTogetherBtn');
        this.pipBtn           = document.getElementById('pipBtn');
        this.fullscreenBtn    = document.getElementById('fullscreenBtn');
        this.chapterBtn       = document.getElementById('chapterBtn');

        // Progress elements
        this.progressContainer = document.querySelector('.progress-container');
        this.progressBar       = document.querySelector('.progress-bar');
        this.progressPlayed    = document.getElementById('progressPlayed');
        this.progressBuffered  = document.getElementById('progressBuffered');
        this.progressHandle    = document.getElementById('progressHandle');
        this.progressTooltip   = document.getElementById('progressTooltip');

        // Time displays
        this.currentTime = document.getElementById('currentTime');
        this.totalTime   = document.getElementById('totalTime');

        // Settings toggles
        this.stableVolumeToggle = document.getElementById('stableVolumeToggle');
        this.ambientToggle      = document.getElementById('ambientToggle');

        // Submenus
        this.sleepTimerSubmenu = document.getElementById('sleepTimerSubmenu');
        this.speedSubmenu      = document.getElementById('speedSubmenu');
        this.qualitySubmenu    = document.getElementById('qualitySubmenu');
        this.audioSubmenu      = document.getElementById('audioSubmenu');
        this.subtitlesSubmenu  = document.getElementById('subtitlesSubmenu');

        // Value displays
        this.sleepTimerValue    = document.getElementById('sleepTimerValue');
        this.playbackSpeedValue = document.getElementById('playbackSpeedValue');
        this.qualityValue       = document.getElementById('qualityValue');
        this.audioTrackValue    = document.getElementById('audioTrackValue');
        this.subtitlesValue     = document.getElementById('subtitlesValue');

        // Notifications
        this.sleepNotification = document.getElementById('sleepNotification');

        // Volume slider
        this.volumeSlider = document.getElementById('volumeSlider');

        // Subtitle track element
        this.subtitleTrack = document.getElementById('subtitleTrack');

        // Playback state
        this.isPlaying      = false;
        this.isFullscreen   = false;
        this.isTheaterMode  = false;
        this.currentVolume  = 0.5;
        this.isMuted        = false;
        this.settingsOpen   = false;
        this.currentSubmenu = null;

        // Settings state
        this.settings = {
            stableVolume:  false,
            ambientMode:   false,
            sleepTimer:    'Off',
            playbackSpeed: 'Normal',
            quality:       'Auto',
            audioTrack:    'Default'
        };

        // Quality
        this.currentVideoQuality = null;
        this.availableQualities  = [];

        // Chapters
        this.chapters = [];

        // Current file
        this.currentVideoPath = null;

        // Home screen
        this.homeScreen = document.getElementById('homeScreen');

        // Drop overlay, context menu
        this.dropOverlay = document.getElementById('dropOverlay');
        this.contextMenu = document.getElementById('contextMenu');

        // Frame preview
        this.previewVideo       = document.getElementById('previewVideo');
        this.previewCanvas      = document.getElementById('previewCanvas');
        this.previewTooltipTime = document.getElementById('progressTooltipTime');

        // Home button
        this.homeBtn = document.getElementById('homeBtn');

        // Library (initialized after managers)
        this.library = null;

        // Sleep timer handles
        this._sleepTimerTimeout        = null;
        this._sleepTimerWarningTimeout = null;
        this._lastPositionSave         = 0;

        // Initialize manager objects
        this.audio    = new AudioManager(this.video, this);
        this.subs     = new SubtitleManager(this);
        this.playlist = new PlaylistManager(this);
        this.stats    = new WatchStats(this);
        this.wt       = new WatchTogether(this);
        this.ui       = new UIManager(this);
        this.features = new FeaturesManager(this);

        this.init();
    }

    init() {
        this.audio.setup();
        this.ui.setup();
        this.ui.updateTimeDisplay();
        this.ui.showControls();
        this.video.load();
        this.setupElectronIntegration();
        this.features.setup();
        this.stats.setup();
        this.wt.setup();
        this.library = new HomeLibrary(this);
        console.log('Vision Lumina initialized successfully');
    }

    // ── i18n Value Translation ────────────────────────────────────────────────

    _tv(value) {
        if (!window.VLi18n) return value;
        const map = {
            'Off':         'player.value_off',
            'On':          'player.value_on',
            'Normal':      'player.value_normal',
            'Default':     'player.value_default',
            'Auto':        'player.value_auto',
            '10 minutes':  'player.sleep_10',
            '15 minutes':  'player.sleep_15',
            '30 minutes':  'player.sleep_30',
            '60 minutes':  'player.sleep_60',
        };
        return map[value] ? window.VLi18n.t(map[value]) : value;
    }

    _loadAppSettingsPlayer() {
        try { return JSON.parse(localStorage.getItem('vl-app-settings') || '{}'); }
        catch { return {}; }
    }

    // ── Electron Integration ──────────────────────────────────────────────────

    setupElectronIntegration() {
        window.vlApi.on('load-video', videoPath => {
            this.playlist.loadVideoFile(videoPath);
        });
        window.vlApi.invoke('get-video-path').then(videoPath => {
            if (videoPath) this.playlist.loadVideoFile(videoPath);
        });
    }

    // ── Video File Loading (public shortcut for HomeLibrary / WatchTogether) ──

    loadVideoFile(filePath) {
        return this.playlist.loadVideoFile(filePath);
    }

    // ── Video Events ──────────────────────────────────────────────────────────

    onVideoLoaded() {
        this.ui.updateTimeDisplay();
        if (this.currentVideoPath) {
            if (this.homeScreen) this.homeScreen.style.display = 'none';
            this.playerContainer.style.display = 'block';
            this.playerContainer.classList.remove('screen-fade-in');
            void this.playerContainer.offsetWidth;
            this.playerContainer.classList.add('screen-fade-in');

            try {
                const appSettings = this._loadAppSettingsPlayer();
                if (appSettings.resumePlayback) {
                    const pos = JSON.parse(localStorage.getItem('vl-resume-pos') || '{}');
                    const savedTime = pos[this.currentVideoPath];
                    if (savedTime && savedTime > 3 && savedTime < this.video.duration - 10) {
                        this.video.currentTime = savedTime;
                    }
                }
            } catch {}

            this._playWhenReady();
        }
        console.log('Video loaded successfully');
    }

    async _playWhenReady() {
        if (this.audio._audioReadyPromise) {
            try { await this.audio._audioReadyPromise; } catch {}
        }
        this.play();
    }

    onPlay() {
        this.audio.resumeContext();
        this.isPlaying = true;
        this.playerContainer.classList.add('playing');
        this.showPlayIcon(false);
        this.audio.syncPlay();
        setTimeout(() => {
            if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
                this.ui.startHideTimer();
            }
        }, 3000);
    }

    onPause() {
        this.isPlaying = false;
        this.playerContainer.classList.remove('playing');
        this.showPlayIcon(true);
        this.ui.showControls();
        this.ui.clearHideTimer();
        this.audio.syncPause();
    }

    onVideoEnded() {
        this.audio.syncPause();
        this.isPlaying = false;
        this.playerContainer.classList.remove('playing');
        this.showPlayIcon(true);
        this.ui.showControls();
        this.ui.clearHideTimer();

        const appSettings = this._loadAppSettingsPlayer();
        if (appSettings.autoPlayNext !== false &&
            this.playlist.playlist.length > 1 &&
            this.playlist.currentIndex >= 0) {
            const nextIndex = this.playlist.currentIndex + 1;
            if (nextIndex < this.playlist.playlist.length) {
                this.playlist.loadVideoFile(this.playlist.playlist[nextIndex]).then(() => {
                    setTimeout(() => this.play(), 500);
                });
            }
        }
    }

    onFullscreenChange() {
        this.isFullscreen = !!document.fullscreenElement;
        const icon = this.fullscreenBtn.querySelector('svg');
        if (icon) {
            icon.style.opacity = this.isFullscreen ? '1' : '';
        }
    }

    onVolumeChange() {
        this.isMuted = this.video.muted || this.video.volume === 0;
        this.audio.syncVolume();
        this.ui.updateVolumeUI();
    }

    // ── Playback ──────────────────────────────────────────────────────────────

    togglePlayPause() {
        if (this.video.paused) this.play();
        else                   this.pause();
        this.ui.handleUserActivity();
    }

    async play() {
        await this.audio.resumeContext();
        this.audio.syncPlay();
        this.video.play().catch(e => console.error('Play error:', e));
    }

    pause() {
        this.audio.syncPause();
        this.video.pause();
    }

    showPlayIcon(show) {
        const playIcon  = this.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
        if (playIcon)  playIcon.classList.toggle('hidden', !show);
        if (pauseIcon) pauseIcon.classList.toggle('hidden', show);
    }

    // ── Volume ────────────────────────────────────────────────────────────────

    toggleMute() {
        if (this.video.muted || this.video.volume === 0) {
            this.video.muted   = false;
            this.video.volume  = this.currentVolume > 0 ? this.currentVolume : 0.5;
        } else {
            this.currentVolume = this.video.volume;
            this.video.muted   = true;
        }
        this.ui.handleUserActivity();
    }

    // ── Seek ──────────────────────────────────────────────────────────────────

    seek(e) {
        if (!this.video.duration) return;
        const rect    = this.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.video.currentTime = percent * this.video.duration;
        this.audio.syncTime();
        this.ui.handleUserActivity();
    }

    // ── Modes ─────────────────────────────────────────────────────────────────

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.playerContainer.requestFullscreen().catch(e => console.error('Fullscreen error:', e));
        } else {
            document.exitFullscreen().catch(e => console.error('Exit fullscreen error:', e));
        }
        this.ui.handleUserActivity();
    }

    togglePictureInPicture() {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(e => console.error('PiP error:', e));
        } else if (document.pictureInPictureEnabled) {
            this.video.requestPictureInPicture().catch(e => console.error('PiP error:', e));
        }
        this.ui.handleUserActivity();
    }

    toggleTheaterMode() {
        this.isTheaterMode = !this.isTheaterMode;
        if (this.isTheaterMode) {
            this.playerContainer.style.height   = '70vh';
            this.playerContainer.style.maxWidth = '100vw';
        } else {
            this.playerContainer.style.height   = '100vh';
        }
        this.ui.handleUserActivity();
    }

    // ── Sleep Notification ────────────────────────────────────────────────────

    showSleepNotification(text, duration = 5000) {
        if (!this.sleepNotification) return;
        this.sleepNotification.textContent = text;
        this.sleepNotification.classList.add('show');
        setTimeout(() => {
            this.sleepNotification.classList.remove('show');
        }, duration);
    }

    // ── Quality ───────────────────────────────────────────────────────────────

    detectVideoQuality() {
        if (!this.video.videoWidth || !this.video.videoHeight) return;
        const { videoWidth: w, videoHeight: h } = this.video;
        const quality = this._getQualityFromResolution(w, h);

        this.availableQualities  = [quality];
        this.currentVideoQuality = quality;
        this.settings.quality    = quality;
        this.qualityValue.textContent = this._tv(quality);
        this.buildQualityMenu();
        console.log(`Video quality detected: ${quality} (${w}x${h})`);
    }

    _getQualityFromResolution(w, h) {
        if (h >= 2160) return '4K';
        if (h >= 1440) return '1440p';
        if (h >= 1080) return '1080p HD';
        if (h >= 720)  return '720p HD';
        if (h >= 480)  return '480p';
        if (h >= 360)  return '360p';
        if (h >= 240)  return '240p';
        return `${w}x${h}`;
    }

    buildQualityMenu() {
        const qualitySubmenu = this.qualitySubmenu;
        const header         = qualitySubmenu.querySelector('.submenu-header');
        qualitySubmenu.innerHTML = '';
        qualitySubmenu.appendChild(header);

        this.availableQualities.forEach(quality => {
            const option        = document.createElement('div');
            option.className    = 'submenu-option';
            option.dataset.value = quality;
            option.textContent  = quality;
            if (quality === this.currentVideoQuality) option.classList.add('active');
            option.addEventListener('click', e => { e.stopPropagation(); this.selectQuality(quality); });
            qualitySubmenu.appendChild(option);
        });

        const autoOption        = document.createElement('div');
        autoOption.className    = 'submenu-option';
        autoOption.dataset.value = 'Auto';
        autoOption.textContent  = 'Auto';
        autoOption.addEventListener('click', e => { e.stopPropagation(); this.selectQuality('Auto'); });
        qualitySubmenu.appendChild(autoOption);
    }

    selectQuality(value) {
        this.settings.quality         = value;
        this.qualityValue.textContent = this._tv(value);
        this.ui.updateActiveOption('qualitySubmenu', value);
        console.log('Quality set to:', value);
        this.ui.showMainSettings();
    }

    // ── Time Formatting (kept on player for backward compat with HomeLibrary) ─

    formatTime(seconds) {
        return formatTime(seconds);
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (window.VLi18n) {
        window.VLi18n.init();
        document.documentElement.lang = window.VLi18n.lang;
    }
    console.log('Initializing Vision Lumina...');
    try {
        window.VisionPlayer = new VisionLumina();
    } catch (error) {
        console.error('Error initializing Vision Lumina:', error);
    }
});

// Auto-pause when tab becomes hidden
document.addEventListener('visibilitychange', () => {
    if (window.VisionPlayer && document.hidden && window.VisionPlayer.isPlaying) {
        window.VisionPlayer.pause();
    }
});
