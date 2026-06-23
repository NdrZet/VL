// ─── UIManager ────────────────────────────────────────────────────────────────
// Handles: all event listeners, keyboard shortcuts, settings menus,
//          progress bar, volume UI, controls visibility (auto-hide).

class UIManager {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player = player;
        this.hideControlsTimeout = null;
        this.userActivity        = false;
    }

    setup() {
        this.setupEventListeners();
        this.setupSubmenuEvents();
        this.initializeSettings();
    }

    // ── Settings Initialization ───────────────────────────────────────────────

    initializeSettings() {
        const p = this.player;
        p.stableVolumeToggle.checked    = p.settings.stableVolume;
        p.ambientToggle.checked         = p.settings.ambientMode;
        p.sleepTimerValue.textContent   = p._tv(p.settings.sleepTimer);
        p.playbackSpeedValue.textContent = p._tv(p.settings.playbackSpeed);
        p.qualityValue.textContent      = p._tv(p.settings.quality);
        p.audioTrackValue.textContent   = p._tv(p.settings.audioTrack);

        const appSettings = p._loadAppSettingsPlayer();
        const vol = appSettings.defaultVolume !== undefined ? appSettings.defaultVolume / 100 : 0.5;
        p.video.volume  = Math.min(1.5, Math.max(0, vol));
        p.currentVolume = p.video.volume;
        this.updateVolumeUI();
    }

    // ── Event Listeners ───────────────────────────────────────────────────────

    setupEventListeners() {
        const p = this.player;

        p.video.addEventListener('loadedmetadata', () => {
            p.onVideoLoaded();
            p.detectVideoQuality();
            p.audio.populateAudioTracks();
        });
        p.video.addEventListener('timeupdate', () => this.updateProgress());
        p.video.addEventListener('progress',   () => this.updateBuffered());
        p.video.addEventListener('play',       () => p.onPlay());
        p.video.addEventListener('pause',      () => p.onPause());
        p.video.addEventListener('ended',      () => p.onVideoEnded());
        p.video.addEventListener('volumechange', () => p.onVolumeChange());

        // Async audio tracks (Chromium sometimes adds them after loadedmetadata)
        if (p.video.audioTracks) {
            p.video.audioTracks.onaddtrack = () => {
                if (p.video.audioTracks.length > p.audio.availableAudioTracks.length) {
                    p.audio.populateAudioTracks();
                }
            };
        }

        p.video.addEventListener('click', () => {
            if (p.features.isMiniMode) return;
            p.togglePlayPause();
        });

        p.playPauseBtn.addEventListener('click', e => { e.stopPropagation(); p.togglePlayPause(); });
        p.nextBtn.addEventListener('click',      () => p.playlist.nextVideo());
        p.volumeBtn.addEventListener('click',    () => p.toggleMute());

        p.volumeSlider.addEventListener('input', e => {
            e.stopPropagation();
            const vol = parseFloat(e.target.value);
            p.video.volume  = vol;
            p.video.muted   = vol === 0;
            if (vol > 0) p.currentVolume = vol;
            this.updateVolumeUI();
        });

        p.ccBtn.addEventListener('click',       () => p.subs.toggle());
        p.settingsBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleSettings(); });
        p.pipBtn.addEventListener('click',      () => p.togglePictureInPicture());
        p.fullscreenBtn.addEventListener('click', () => p.toggleFullscreen());
        p.chapterBtn.addEventListener('click',  () => p.playlist.showChapterMenu());

        // Progress bar
        p.progressContainer.addEventListener('click',     e => p.seek(e));
        p.progressContainer.addEventListener('mousemove', e => this.updateProgressHover(e));
        p.progressContainer.addEventListener('mouseleave', () => {
            if (p.progressTooltip) p.progressTooltip.style.display = 'none';
        });

        // Settings toggles
        p.stableVolumeToggle.addEventListener('change', e => {
            e.stopPropagation();
            p.settings.stableVolume = p.stableVolumeToggle.checked;
            p.audio.toggleStableVolume(p.settings.stableVolume);
            this.handleUserActivity();
        });
        p.ambientToggle.addEventListener('change', e => {
            e.stopPropagation();
            p.features.toggleAmbientMode();
        });

        // Settings menu items
        document.querySelectorAll('.settings-item.clickable').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                this.handleSettingsClick(e);
            });
        });

        document.addEventListener('keydown', e => this.handleKeyboard(e));
        document.addEventListener('click',   e => {
            if (!p.settingsMenu.contains(e.target) &&
                !p.settingsBtn.contains(e.target) &&
                !this.isClickInsideSubmenus(e.target)) {
                this.closeAllMenus();
            }
        });

        p.playerContainer.addEventListener('mousemove',  e => this.handleMouseActivity(e));
        p.playerContainer.addEventListener('mouseenter', () => this.handleMouseActivity());
        p.playerContainer.addEventListener('mouseleave', () => this.handleMouseLeave());
        p.playerContainer.addEventListener('click',      () => this.handleUserActivity());

        p.controlBar.addEventListener('mouseenter', () => this.handleControlBarHover(true));
        p.controlBar.addEventListener('mouseleave', () => this.handleControlBarHover(false));

        document.addEventListener('fullscreenchange',       () => p.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => p.onFullscreenChange());
        document.addEventListener('mozfullscreenchange',    () => p.onFullscreenChange());
        document.addEventListener('msfullscreenchange',     () => p.onFullscreenChange());
    }

    // ── Submenu Events ────────────────────────────────────────────────────────

    setupSubmenuEvents() {
        const p = this.player;

        // Back buttons
        document.getElementById('sleepTimerBack').addEventListener('click', e => { e.stopPropagation(); this.showMainSettings(); });
        document.getElementById('speedBack').addEventListener('click',      e => { e.stopPropagation(); this.showMainSettings(); });
        document.getElementById('qualityBack').addEventListener('click',    e => { e.stopPropagation(); this.showMainSettings(); });
        document.getElementById('audioBack').addEventListener('click',      e => { e.stopPropagation(); this.showMainSettings(); });
        document.getElementById('subtitlesBack').addEventListener('click',  e => { e.stopPropagation(); this.showMainSettings(); });

        // Sleep timer options
        document.querySelectorAll('#sleepTimerSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', e => {
                e.stopPropagation();
                this.selectSleepTimer(e.target.dataset.value);
            });
        });

        // Speed options
        document.querySelectorAll('#speedSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', e => {
                e.stopPropagation();
                this.selectPlaybackSpeed(e.target.dataset.value);
            });
        });

        // Subtitles options
        document.querySelectorAll('#subtitlesSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', e => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.value;
                if (action === 'load') {
                    p.subs.openDialog();
                } else if (action === 'off') {
                    p.subs.subtitlesActive = false;
                    p.subs.applyState();
                    this.showMainSettings();
                }
            });
        });
    }

    // ── Settings Menu ─────────────────────────────────────────────────────────

    handleSettingsClick(e) {
        const menuType = e.currentTarget.dataset.menu;
        switch (menuType) {
            case 'subtitles': this.player.subs.showSubmenu();        break;
            case 'audiotrack': this.player.audio.showSubmenu();       break;
            case 'sleep':     this.showSleepTimerSubmenu();           break;
            case 'speed':     this.showSpeedSubmenu();                break;
            case 'quality':   this.showQualitySubmenu();              break;
        }
        this.handleUserActivity();
    }

    toggleSettings() {
        if (this.player.settingsOpen || this.player.currentSubmenu) {
            this.closeAllMenus();
        } else {
            this.openSettings();
        }
        this.handleUserActivity();
    }

    openSettings() {
        this.closeAllSubmenus();
        this.player.settingsMenu.classList.remove('hidden');
        this.player.settingsOpen  = true;
        this.player.currentSubmenu = null;
        this.clearHideTimer();
        this.showControls();
    }

    closeSettings() {
        this.player.settingsMenu.classList.add('hidden');
        this.player.settingsOpen = false;
        if (this.player.isPlaying && !this.player.currentSubmenu) {
            this.startHideTimer(2000);
        }
    }

    closeAllSubmenus() {
        this.player.sleepTimerSubmenu.classList.add('hidden');
        this.player.speedSubmenu.classList.add('hidden');
        this.player.qualitySubmenu.classList.add('hidden');
        this.player.audioSubmenu.classList.add('hidden');
        this.player.subtitlesSubmenu.classList.add('hidden');
        this.player.currentSubmenu = null;
    }

    closeAllMenus() {
        this.closeSettings();
        this.closeAllSubmenus();
    }

    showMainSettings() {
        this.closeAllSubmenus();
        this.player.settingsMenu.classList.remove('hidden');
        this.player.settingsOpen  = true;
        this.player.currentSubmenu = null;
    }

    isClickInsideSubmenus(target) {
        return this.player.sleepTimerSubmenu.contains(target) ||
               this.player.speedSubmenu.contains(target)      ||
               this.player.qualitySubmenu.contains(target)    ||
               this.player.audioSubmenu.contains(target)      ||
               this.player.subtitlesSubmenu.contains(target);
    }

    // ── Submenus ─────────────────────────────────────────────────────────────

    showSleepTimerSubmenu() {
        const p = this.player;
        p.settingsMenu.classList.add('hidden');
        p.settingsOpen = false;
        this.closeAllSubmenus();
        p.sleepTimerSubmenu.classList.remove('hidden');
        p.currentSubmenu = 'sleep';
        this.updateActiveOption('sleepTimerSubmenu', p.settings.sleepTimer);
    }

    showSpeedSubmenu() {
        const p = this.player;
        p.settingsMenu.classList.add('hidden');
        p.settingsOpen = false;
        this.closeAllSubmenus();
        p.speedSubmenu.classList.remove('hidden');
        p.currentSubmenu = 'speed';
        this.updateActiveOption('speedSubmenu', p.settings.playbackSpeed);
    }

    showQualitySubmenu() {
        const p = this.player;
        p.settingsMenu.classList.add('hidden');
        p.settingsOpen = false;
        this.closeAllSubmenus();
        p.qualitySubmenu.classList.remove('hidden');
        p.currentSubmenu = 'quality';
        this.updateActiveOption('qualitySubmenu', p.settings.quality);
    }

    updateActiveOption(submenuId, value) {
        const submenu = document.getElementById(submenuId);
        submenu.querySelectorAll('.submenu-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.value === value) option.classList.add('active');
        });
    }

    // ── Sleep Timer ───────────────────────────────────────────────────────────

    selectSleepTimer(value) {
        const p = this.player;
        p.settings.sleepTimer = value;
        p.sleepTimerValue.textContent = p._tv(value);
        this.updateActiveOption('sleepTimerSubmenu', value);
        this.cancelSleepTimer();

        if (value !== 'Off') {
            const minutes = parseInt(value);
            if (!isNaN(minutes)) {
                const ms        = minutes * 60 * 1000;
                const warningMs = ms - 60 * 1000;

                if (warningMs > 0) {
                    p._sleepTimerWarningTimeout = setTimeout(() => {
                        p.showSleepNotification('Sleep timer: 1 minute remaining');
                    }, warningMs);
                }

                p._sleepTimerTimeout = setTimeout(() => {
                    p.pause();
                    p.showSleepNotification('Sleep timer: Playback paused', 4000);
                    p.settings.sleepTimer          = 'Off';
                    p.sleepTimerValue.textContent  = p._tv('Off');
                }, ms);

                console.log(`Sleep timer set for ${minutes} minutes`);
            }
        }
        this.showMainSettings();
    }

    cancelSleepTimer() {
        const p = this.player;
        if (p._sleepTimerTimeout) {
            clearTimeout(p._sleepTimerTimeout);
            p._sleepTimerTimeout = null;
        }
        if (p._sleepTimerWarningTimeout) {
            clearTimeout(p._sleepTimerWarningTimeout);
            p._sleepTimerWarningTimeout = null;
        }
    }

    // ── Playback Speed ────────────────────────────────────────────────────────

    selectPlaybackSpeed(value) {
        const p = this.player;
        p.settings.playbackSpeed         = value;
        p.playbackSpeedValue.textContent = p._tv(value);

        const speedMap = {
            '0.25': 0.25, '0.5': 0.5, '0.75': 0.75,
            'Normal': 1,
            '1.25': 1.25, '1.5': 1.5, '1.75': 1.75, '2': 2
        };

        p.video.playbackRate = speedMap[value] || 1;
        p.audio.syncPlaybackRate(p.video.playbackRate);
        this.updateActiveOption('speedSubmenu', value);
        console.log('Playback speed set to:', value);
        this.showMainSettings();
    }

    // ── Progress / Time ───────────────────────────────────────────────────────

    updateProgress() {
        const p = this.player;
        if (!p.video.duration) return;

        const progress = (p.video.currentTime / p.video.duration) * 100;
        p.progressPlayed.style.width  = `${progress}%`;
        p.progressHandle.style.left   = `${progress}%`;
        this.updateTimeDisplay();

        if (p.chapters.length > 0) {
            p.playlist.updateCurrentChapter();
        }

        // Save resume position every ~5 s
        if (p.currentVideoPath && p.video.currentTime > 3) {
            const now = Date.now();
            if (!p._lastPositionSave || now - p._lastPositionSave > 5000) {
                p._lastPositionSave = now;
                try {
                    const pos       = JSON.parse(localStorage.getItem('vl-resume-pos') || '{}');
                    const remaining = p.video.duration - p.video.currentTime;
                    if (remaining > 10) {
                        pos[p.currentVideoPath] = Math.floor(p.video.currentTime);
                    } else {
                        delete pos[p.currentVideoPath];
                    }
                    localStorage.setItem('vl-resume-pos', JSON.stringify(pos));
                } catch {}
            }
        }
    }

    updateBuffered() {
        const p = this.player;
        if (p.video.buffered.length > 0 && p.video.duration) {
            const buffered = (p.video.buffered.end(0) / p.video.duration) * 100;
            p.progressBuffered.style.width = `${buffered}%`;
        }
    }

    updateTimeDisplay() {
        const p = this.player;
        p.currentTime.textContent = formatTime(p.video.currentTime || 0);
        p.totalTime.textContent   = formatTime(p.video.duration    || 0);
    }

    updateProgressHover(e) {
        const p = this.player;
        if (!p.video.duration || !p.progressTooltip) return;

        const rect    = p.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time    = percent * p.video.duration;

        if (p.previewTooltipTime) {
            p.previewTooltipTime.textContent = formatTime(time);
        }
        p.progressTooltip.style.display = 'flex';
        p.progressTooltip.style.left    = `${percent * 100}%`;

        p.features.seekPreviewFrame(time);
    }

    // ── Volume UI ─────────────────────────────────────────────────────────────

    updateVolumeUI() {
        const p      = this.player;
        const isMuted = p.video.muted || p.video.volume === 0;
        const vol     = isMuted ? 0 : p.video.volume;

        if (p.volumeSlider) {
            p.volumeSlider.value = vol;
            p.volumeSlider.style.setProperty('--volume-pct', `${vol * 100}%`);
        }

        const highIcon  = p.volumeBtn.querySelector('.volume-high');
        const mutedIcon = p.volumeBtn.querySelector('.volume-muted');
        if (highIcon && mutedIcon) {
            highIcon.classList.toggle('hidden',  isMuted);
            mutedIcon.classList.toggle('hidden', !isMuted);
        }
    }

    // ── Controls Visibility ───────────────────────────────────────────────────

    handleMouseActivity() {
        this.userActivity = true;
        this.showControls();
        this.clearHideTimer();
        const p = this.player;
        if (p.isPlaying && !p.settingsOpen && !p.currentSubmenu) {
            this.startHideTimer();
        }
    }

    handleMouseLeave() {
        const p = this.player;
        if (p.isPlaying && !p.settingsOpen && !p.currentSubmenu) {
            this.startHideTimer(1500);
        }
    }

    handleUserActivity() {
        this.userActivity = true;
        this.showControls();
        this.clearHideTimer();
        const p = this.player;
        if (p.isPlaying && !p.settingsOpen && !p.currentSubmenu) {
            this.startHideTimer();
        }
    }

    handleControlBarHover(entering) {
        if (entering) {
            this.clearHideTimer();
            this.showControls();
        } else {
            const p = this.player;
            if (p.isPlaying && !p.settingsOpen && !p.currentSubmenu) {
                this.startHideTimer(2000);
            }
        }
    }

    showControls() {
        const p = this.player;
        p.controlBar.classList.remove('auto-hide');
        p.controlBar.classList.add('show');
        if (p.homeBtn) p.homeBtn.classList.remove('auto-hide');
    }

    hideControls() {
        const p = this.player;
        if (p.isPlaying && !p.settingsOpen && !p.currentSubmenu && !this.userActivity) {
            p.controlBar.classList.add('auto-hide');
            p.controlBar.classList.remove('show');
            if (p.homeBtn) p.homeBtn.classList.add('auto-hide');
        }
        this.userActivity = false;
    }

    startHideTimer(delay = 3000) {
        this.clearHideTimer();
        const p = this.player;
        if (!p.isPlaying || p.settingsOpen || p.currentSubmenu) return;
        this.hideControlsTimeout = setTimeout(() => this.hideControls(), delay);
    }

    clearHideTimer() {
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
            this.hideControlsTimeout = null;
        }
    }

    // ── Keyboard Shortcuts ────────────────────────────────────────────────────

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        this.handleUserActivity();
        const p = this.player;

        switch (e.code) {
            case 'Space':
            case 'KeyK':
                e.preventDefault();
                p.togglePlayPause();
                break;
            case 'ArrowLeft':
            case 'KeyJ':
                e.preventDefault();
                p.video.currentTime = Math.max(0, p.video.currentTime - 10);
                p.audio.syncTime();
                break;
            case 'ArrowRight':
            case 'KeyL':
                e.preventDefault();
                p.video.currentTime = Math.min(p.video.duration, p.video.currentTime + 10);
                p.audio.syncTime();
                break;
            case 'ArrowUp':
                e.preventDefault();
                p.video.volume = Math.min(1, p.video.volume + 0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                p.video.volume = Math.max(0, p.video.volume - 0.05);
                break;
            case 'KeyM':
                e.preventDefault();
                p.toggleMute();
                break;
            case 'KeyF':
                e.preventDefault();
                p.toggleFullscreen();
                break;
            case 'Escape':
                e.preventDefault();
                if (p.contextMenu && !p.contextMenu.classList.contains('hidden')) {
                    p.features.hideContextMenu();
                } else if (p.settingsOpen || p.currentSubmenu) {
                    this.closeAllMenus();
                } else if (p.isFullscreen) {
                    p.toggleFullscreen();
                }
                break;
            case 'KeyT':
                e.preventDefault();
                p.toggleTheaterMode();
                break;
            case 'KeyC':
                e.preventDefault();
                p.subs.toggle();
                break;
            case 'KeyI':
                e.preventDefault();
                p.togglePictureInPicture();
                break;
        }
    }
}
