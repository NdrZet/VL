const { ipcRenderer } = require('electron');

class VisionLumina {
    constructor() {
        // Core elements
        this.video = document.getElementById('videoPlayer');
        this.controlBar = document.getElementById('controlBar');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.playerContainer = document.querySelector('.player-container');
        this.ambientCanvas = document.getElementById('ambientCanvas');

        // Control buttons
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeBtn = document.getElementById('volumeBtn');
        this.ccBtn = document.getElementById('ccBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.pipBtn = document.getElementById('pipBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.chapterBtn = document.getElementById('chapterBtn');

        // Progress elements
        this.progressContainer = document.querySelector('.progress-container');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressPlayed = document.getElementById('progressPlayed');
        this.progressBuffered = document.getElementById('progressBuffered');
        this.progressHandle = document.getElementById('progressHandle');
        this.progressTooltip = document.getElementById('progressTooltip');

        // Time displays
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');

        // Settings toggles
        this.stableVolumeToggle = document.getElementById('stableVolumeToggle');
        this.ambientToggle = document.getElementById('ambientToggle');

        // Submenus
        this.sleepTimerSubmenu = document.getElementById('sleepTimerSubmenu');
        this.speedSubmenu = document.getElementById('speedSubmenu');
        this.qualitySubmenu = document.getElementById('qualitySubmenu');
        this.audioSubmenu = document.getElementById('audioSubmenu');
        this.subtitlesSubmenu = document.getElementById('subtitlesSubmenu');

        // Value displays
        this.sleepTimerValue = document.getElementById('sleepTimerValue');
        this.playbackSpeedValue = document.getElementById('playbackSpeedValue');
        this.qualityValue = document.getElementById('qualityValue');
        this.audioTrackValue = document.getElementById('audioTrackValue');
        this.subtitlesValue = document.getElementById('subtitlesValue');

        // Notifications
        this.sleepNotification = document.getElementById('sleepNotification');

        // Volume slider
        this.volumeSlider = document.getElementById('volumeSlider');

        // Subtitle track element
        this.subtitleTrack = document.getElementById('subtitleTrack');

        // Playback state
        this.isPlaying = false;
        this.isFullscreen = false;
        this.isTheaterMode = false;
        this.currentVolume = 0.5;
        this.isMuted = false;
        this.hideControlsTimeout = null;
        this.settingsOpen = false;
        this.currentSubmenu = null;
        this.userActivity = false;

        // Settings state
        this.settings = {
            stableVolume: false,
            ambientMode: false,
            sleepTimer: 'Off',
            playbackSpeed: 'Normal',
            quality: 'Auto',
            audioTrack: 'Default'
        };

        // Quality
        this.currentVideoQuality = null;
        this.availableQualities = [];

        // Audio tracks
        this.currentAudioTrack = null;
        this.availableAudioTracks = [];

        // Subtitles
        this.subtitlesActive = false;
        this.subtitleBlobUrl = null;

        // Sleep timer
        this.sleepTimerTimeout = null;
        this.sleepTimerWarningTimeout = null;

        // Playlist
        this.playlist = [];
        this.currentIndex = -1;
        this.currentVideoPath = null;

        // Chapters
        this.chapters = [];

        // Audio API (for stable volume)
        this.audioContext = null;
        this.audioSource = null;
        this.compressor = null;
        this.gainNode = null;

        // Ambient mode
        this.ambientAnimationId = null;
        this.ambientCtx = null;

        // Home screen / library
        this.homeScreen = document.getElementById('homeScreen');

        // Drag & Drop
        this.dropOverlay = document.getElementById('dropOverlay');

        // Context menu
        this.contextMenu = document.getElementById('contextMenu');

        // Frame preview
        this.previewVideo = document.getElementById('previewVideo');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewTooltipTime = document.getElementById('progressTooltipTime');
        this.previewLastSeek = 0;
        this.previewCtx = null;

        // Home button in player controls
        this.homeBtn = document.getElementById('homeBtn');

        // Library manager (initialized in init)
        this.library = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeSettings();
        this.updateTimeDisplay();
        this.showControls();
        this.video.load();
        this.setupElectronIntegration();
        this.setupAudioContext();
        this.setupDragDrop();
        this.setupContextMenu();
        this.setupFramePreview();
        this.setupHomeButton();
        this.library = new HomeLibrary(this);
        console.log('Vision Lumina initialized successfully');
    }

    // ─── Audio Context ───────────────────────────────────────────────────────

    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioSource = this.audioContext.createMediaElementSource(this.video);

            // DynamicsCompressor for stable volume
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            this.gainNode = this.audioContext.createGain();

            // Default routing: source -> gain -> destination (compressor bypassed)
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
        } catch (e) {
            console.warn('AudioContext not available:', e);
        }
    }

    // ─── Event Listeners ─────────────────────────────────────────────────────

    setupEventListeners() {
        this.video.addEventListener('loadedmetadata', () => {
            this.onVideoLoaded();
            this.detectVideoQuality();
            this.populateAudioTracks();
        });
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('progress', () => this.updateBuffered());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('ended', () => this.onVideoEnded());
        this.video.addEventListener('volumechange', () => this.onVolumeChange());
        this.video.addEventListener('click', () => this.togglePlayPause());

        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });

        this.nextBtn.addEventListener('click', () => this.nextVideo());
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            const vol = parseFloat(e.target.value);
            this.video.volume = vol;
            this.video.muted = vol === 0;
            if (vol > 0) this.currentVolume = vol;
            this.updateVolumeUI();
        });
        this.ccBtn.addEventListener('click', () => this.toggleSubtitles());
        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSettings();
        });
        this.pipBtn.addEventListener('click', () => this.togglePictureInPicture());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.chapterBtn.addEventListener('click', () => this.showChapterMenu());

        // Progress bar
        this.progressContainer.addEventListener('click', (e) => this.seek(e));
        this.progressContainer.addEventListener('mousemove', (e) => this.updateProgressHover(e));
        this.progressContainer.addEventListener('mouseleave', () => {
            if (this.progressTooltip) this.progressTooltip.style.display = 'none';
        });

        // Settings toggles
        this.stableVolumeToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleStableVolume();
        });
        this.ambientToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleAmbientMode();
        });

        // Settings menu items
        document.querySelectorAll('.settings-item.clickable').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleSettingsClick(e);
            });
        });

        this.setupSubmenuEvents();

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        document.addEventListener('click', (e) => {
            if (!this.settingsMenu.contains(e.target) &&
                !this.settingsBtn.contains(e.target) &&
                !this.isClickInsideSubmenus(e.target)) {
                this.closeAllMenus();
            }
        });

        this.playerContainer.addEventListener('mousemove', (e) => this.handleMouseActivity(e));
        this.playerContainer.addEventListener('mouseenter', () => this.handleMouseActivity());
        this.playerContainer.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.playerContainer.addEventListener('click', () => this.handleUserActivity());

        this.controlBar.addEventListener('mouseenter', () => this.handleControlBarHover(true));
        this.controlBar.addEventListener('mouseleave', () => this.handleControlBarHover(false));

        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('msfullscreenchange', () => this.onFullscreenChange());
    }

    // ─── Quality Detection ────────────────────────────────────────────────────

    detectVideoQuality() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            console.log('Video dimensions not available yet');
            return;
        }

        const width = this.video.videoWidth;
        const height = this.video.videoHeight;
        const detectedQuality = this.getQualityFromResolution(width, height);

        this.availableQualities = [detectedQuality];
        this.currentVideoQuality = detectedQuality;

        this.buildQualityMenu();

        this.settings.quality = detectedQuality;
        this.qualityValue.textContent = detectedQuality;

        console.log(`Video quality detected: ${detectedQuality} (${width}x${height})`);
    }

    getQualityFromResolution(width, height) {
        const resolutionMap = {
            '3840x2160': '4K',
            '2560x1440': '1440p',
            '1920x1080': '1080p HD',
            '1280x720': '720p HD',
            '854x480': '480p',
            '640x360': '360p',
            '426x240': '240p'
        };

        const resolution = `${width}x${height}`;
        if (resolutionMap[resolution]) return resolutionMap[resolution];

        if (height >= 2160) return '4K';
        if (height >= 1440) return '1440p';
        if (height >= 1080) return '1080p HD';
        if (height >= 720) return '720p HD';
        if (height >= 480) return '480p';
        if (height >= 360) return '360p';
        if (height >= 240) return '240p';
        return `${width}x${height}`;
    }

    buildQualityMenu() {
        const qualitySubmenu = this.qualitySubmenu;
        const header = qualitySubmenu.querySelector('.submenu-header');
        qualitySubmenu.innerHTML = '';
        qualitySubmenu.appendChild(header);

        this.availableQualities.forEach((quality) => {
            const option = document.createElement('div');
            option.className = 'submenu-option';
            option.dataset.value = quality;
            option.textContent = quality;
            if (quality === this.currentVideoQuality) {
                option.classList.add('active');
            }
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectQuality(quality);
            });
            qualitySubmenu.appendChild(option);
        });

        const autoOption = document.createElement('div');
        autoOption.className = 'submenu-option';
        autoOption.dataset.value = 'Auto';
        autoOption.textContent = 'Auto';
        autoOption.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectQuality('Auto');
        });
        qualitySubmenu.appendChild(autoOption);
    }

    selectQuality(value) {
        this.settings.quality = value;
        this.qualityValue.textContent = value;
        this.updateActiveOption('qualitySubmenu', value);
        console.log('Quality set to:', value);
        this.showMainSettings();
    }

    // ─── Audio Tracks ─────────────────────────────────────────────────────────

    populateAudioTracks() {
        this.availableAudioTracks = [];

        if (this.video.audioTracks && this.video.audioTracks.length > 0) {
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                const track = this.video.audioTracks[i];
                this.availableAudioTracks.push({
                    id: track.id || String(i),
                    label: track.label || `Track ${i + 1}`,
                    language: track.language || '',
                    index: i,
                    nativeTrack: track
                });
            }
        } else {
            // Fallback: single default track
            this.availableAudioTracks.push({
                id: '0',
                label: 'Default',
                language: '',
                index: 0,
                nativeTrack: null
            });
        }

        this.currentAudioTrack = this.availableAudioTracks[0];
        this.settings.audioTrack = this.currentAudioTrack.label;
        this.audioTrackValue.textContent = this.currentAudioTrack.label;

        this.buildAudioTrackMenu();
        console.log(`Audio tracks found: ${this.availableAudioTracks.length}`);
    }

    buildAudioTrackMenu() {
        const submenu = this.audioSubmenu;
        const header = submenu.querySelector('.submenu-header');
        submenu.innerHTML = '';
        submenu.appendChild(header);

        this.availableAudioTracks.forEach((track) => {
            const option = document.createElement('div');
            option.className = 'submenu-option';
            option.dataset.value = track.label;
            option.textContent = track.language
                ? `${track.label} (${track.language})`
                : track.label;

            if (this.currentAudioTrack && track.id === this.currentAudioTrack.id) {
                option.classList.add('active');
            }
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectAudioTrack(track);
            });
            submenu.appendChild(option);
        });
    }

    showAudioTrackSubmenu() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        this.closeAllSubmenus();
        this.audioSubmenu.classList.remove('hidden');
        this.currentSubmenu = 'audio';
        this.updateActiveOption('audioSubmenu', this.settings.audioTrack);
    }

    selectAudioTrack(track) {
        if (this.video.audioTracks && this.video.audioTracks.length > 1) {
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                this.video.audioTracks[i].enabled = (i === track.index);
            }
        }
        this.currentAudioTrack = track;
        this.settings.audioTrack = track.label;
        this.audioTrackValue.textContent = track.label;
        this.updateActiveOption('audioSubmenu', track.label);
        console.log('Audio track selected:', track.label);
        this.showMainSettings();
    }

    // ─── Subtitles ────────────────────────────────────────────────────────────

    toggleSubtitles() {
        if (!this.subtitlesActive && !this.subtitleBlobUrl) {
            // No file loaded yet — open the subtitles submenu
            this.showSubtitlesSubmenu();
        } else {
            this.subtitlesActive = !this.subtitlesActive;
            this.applySubtitleState();
        }
        this.handleUserActivity();
    }

    async openSubtitleDialog() {
        try {
            const result = await ipcRenderer.invoke('show-open-dialog', {
                title: 'Select subtitle file',
                filters: [
                    { name: 'Subtitles', extensions: ['vtt', 'srt'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.loadSubtitleFile(result.filePaths[0]);
                this.showMainSettings();
            }
        } catch (e) {
            console.error('Subtitle dialog error:', e);
        }
    }

    loadSubtitleFile(filePath) {
        const fs = require('fs');
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const ext = filePath.split('.').pop().toLowerCase();

            let vttContent = content;
            if (ext === 'srt') {
                vttContent = this.srtToVtt(content);
            }

            if (this.subtitleBlobUrl) {
                URL.revokeObjectURL(this.subtitleBlobUrl);
            }

            const blob = new Blob([vttContent], { type: 'text/vtt' });
            this.subtitleBlobUrl = URL.createObjectURL(blob);

            if (this.subtitleTrack) {
                this.subtitleTrack.src = this.subtitleBlobUrl;
                this.subtitleTrack.track.mode = 'showing';
            }

            this.subtitlesActive = true;
            this.applySubtitleState();
            console.log('Subtitles loaded:', filePath);
        } catch (e) {
            console.error('Failed to load subtitles:', e);
        }
    }

    srtToVtt(srt) {
        let vtt = 'WEBVTT\n\n';
        vtt += srt
            .trim()
            .replace(/\r\n|\r/g, '\n')
            // remove cue index numbers on their own line
            .replace(/^\d+\s*\n/gm, '')
            // convert SRT timestamps (00:00:00,000) to VTT (00:00:00.000)
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
            .trim();
        return vtt;
    }

    applySubtitleState() {
        if (this.subtitleTrack) {
            this.subtitleTrack.track.mode = this.subtitlesActive ? 'showing' : 'hidden';
        }
        this.ccBtn.style.opacity = this.subtitlesActive ? '1' : '0.6';
        this.ccBtn.title = this.subtitlesActive ? 'Subtitles: On' : 'Subtitles: Off';
        if (this.subtitlesValue) {
            this.subtitlesValue.textContent = this.subtitlesActive ? 'On' : 'Off';
        }
    }

    showSubtitlesSubmenu() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        this.closeAllSubmenus();
        this.subtitlesSubmenu.classList.remove('hidden');
        this.currentSubmenu = 'subtitles';
        // Mark active state
        this.subtitlesSubmenu.querySelectorAll('.submenu-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.value === 'off' && !this.subtitlesActive) opt.classList.add('active');
        });
    }

    clearSubtitles() {
        if (this.subtitleBlobUrl) {
            URL.revokeObjectURL(this.subtitleBlobUrl);
            this.subtitleBlobUrl = null;
        }
        if (this.subtitleTrack) {
            this.subtitleTrack.src = '';
        }
        this.subtitlesActive = false;
        this.applySubtitleState();
    }

    // ─── Sleep Timer ──────────────────────────────────────────────────────────

    selectSleepTimer(value) {
        this.settings.sleepTimer = value;
        this.sleepTimerValue.textContent = value;
        this.updateActiveOption('sleepTimerSubmenu', value);
        this.cancelSleepTimer();

        if (value !== 'Off') {
            const minutes = parseInt(value);
            if (!isNaN(minutes)) {
                const ms = minutes * 60 * 1000;
                const warningMs = ms - 60 * 1000;

                if (warningMs > 0) {
                    this.sleepTimerWarningTimeout = setTimeout(() => {
                        this.showSleepNotification('Sleep timer: 1 minute remaining');
                    }, warningMs);
                }

                this.sleepTimerTimeout = setTimeout(() => {
                    this.pause();
                    this.showSleepNotification('Sleep timer: Playback paused', 4000);
                    this.settings.sleepTimer = 'Off';
                    this.sleepTimerValue.textContent = 'Off';
                }, ms);

                console.log(`Sleep timer set for ${minutes} minutes`);
            }
        }

        this.showMainSettings();
    }

    cancelSleepTimer() {
        if (this.sleepTimerTimeout) {
            clearTimeout(this.sleepTimerTimeout);
            this.sleepTimerTimeout = null;
        }
        if (this.sleepTimerWarningTimeout) {
            clearTimeout(this.sleepTimerWarningTimeout);
            this.sleepTimerWarningTimeout = null;
        }
    }

    showSleepNotification(text, duration = 5000) {
        if (!this.sleepNotification) return;
        this.sleepNotification.textContent = text;
        this.sleepNotification.classList.add('show');
        setTimeout(() => {
            this.sleepNotification.classList.remove('show');
        }, duration);
    }

    // ─── Stable Volume (DynamicsCompressor) ──────────────────────────────────

    toggleStableVolume() {
        this.settings.stableVolume = this.stableVolumeToggle.checked;

        if (!this.audioContext || !this.audioSource) {
            console.warn('AudioContext not initialized');
            return;
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        try {
            this.audioSource.disconnect();
            this.gainNode.disconnect();
            this.compressor.disconnect();

            if (this.settings.stableVolume) {
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

        console.log('Stable Volume:', this.settings.stableVolume);
        this.handleUserActivity();
    }

    // ─── Ambient Mode ─────────────────────────────────────────────────────────

    toggleAmbientMode() {
        this.settings.ambientMode = this.ambientToggle.checked;

        if (this.settings.ambientMode) {
            this.playerContainer.classList.add('ambient-active');
            this.startAmbientLoop();
        } else {
            this.playerContainer.classList.remove('ambient-active');
            this.stopAmbientLoop();
        }

        console.log('Ambient Mode:', this.settings.ambientMode);
        this.handleUserActivity();
    }

    startAmbientLoop() {
        if (!this.ambientCanvas) return;
        this.ambientCtx = this.ambientCanvas.getContext('2d');

        const draw = () => {
            if (!this.settings.ambientMode) return;
            if (!this.video.paused && !this.video.ended && this.video.readyState >= 2) {
                const w = this.ambientCanvas.offsetWidth;
                const h = this.ambientCanvas.offsetHeight;
                if (this.ambientCanvas.width !== w) this.ambientCanvas.width = w;
                if (this.ambientCanvas.height !== h) this.ambientCanvas.height = h;
                this.ambientCtx.drawImage(this.video, 0, 0, w, h);
            }
            this.ambientAnimationId = requestAnimationFrame(draw);
        };

        draw();
    }

    stopAmbientLoop() {
        if (this.ambientAnimationId) {
            cancelAnimationFrame(this.ambientAnimationId);
            this.ambientAnimationId = null;
        }
        if (this.ambientCtx && this.ambientCanvas) {
            this.ambientCtx.clearRect(0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
        }
    }

    // ─── Playlist / Next Video ────────────────────────────────────────────────

    async loadVideoFile(filePath) {
        if (!filePath) return;

        this.currentVideoPath = filePath;

        const fileUrl = filePath.startsWith('file://')
            ? filePath
            : `file://${filePath.replace(/\\/g, '/')}`;

        this.video.src = fileUrl;

        const fileName = filePath.split(/[\\/]/).pop();
        document.title = `Vision Lumina Player - ${fileName}`;

        this.video.load();

        // Build playlist from directory
        await this.buildPlaylist(filePath);

        // Reset subtitles when switching video
        this.clearSubtitles();

        console.log('Loaded video:', fileName);
    }

    async buildPlaylist(currentFilePath) {
        try {
            // Extract directory path
            const dirPath = currentFilePath.replace(/[\\/][^\\/]+$/, '');
            const files = await ipcRenderer.invoke('get-directory-files', dirPath);

            this.playlist = files;
            const normalized = f => f.replace(/\\/g, '/').toLowerCase();
            this.currentIndex = files.findIndex(
                f => normalized(f) === normalized(currentFilePath)
            );

            console.log(`Playlist: ${files.length} files, current index: ${this.currentIndex}`);
        } catch (e) {
            console.warn('Could not build playlist:', e);
            this.playlist = [currentFilePath];
            this.currentIndex = 0;
        }
    }

    nextVideo() {
        if (this.playlist.length > 1 && this.currentIndex >= 0) {
            const nextIndex = (this.currentIndex + 1) % this.playlist.length;
            this.loadVideoFile(this.playlist[nextIndex]);
        } else {
            // No playlist — restart current file
            this.video.currentTime = 0;
            if (this.isPlaying) this.play();
        }
        this.handleUserActivity();
    }

    // ─── Chapter Menu ─────────────────────────────────────────────────────────

    async showChapterMenu() {
        this.handleUserActivity();

        if (!this.currentVideoPath) {
            console.log('No video loaded for chapters');
            return;
        }

        const fs = require('fs');
        const chapterFile = this.currentVideoPath.replace(/\.[^.]+$/, '.chapters.vtt');

        try {
            if (fs.existsSync(chapterFile)) {
                const content = fs.readFileSync(chapterFile, 'utf-8');
                this.chapters = this.parseVttChapters(content);
                this.chapterBtn.classList.remove('hidden');
                this.updateCurrentChapter();
                console.log(`Chapters loaded: ${this.chapters.length}`);
            } else {
                console.log('No chapter file found:', chapterFile);
            }
        } catch (e) {
            console.warn('Chapter load error:', e);
        }
    }

    parseVttChapters(vttContent) {
        const chapters = [];
        const blocks = vttContent.split(/\n\n+/);

        for (const block of blocks) {
            const lines = block.trim().split('\n');
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
        if (!this.chapters || this.chapters.length === 0) return;

        const currentTime = this.video.currentTime;
        let current = this.chapters[0];
        for (const ch of this.chapters) {
            if (currentTime >= ch.start) current = ch;
        }

        const span = this.chapterBtn.querySelector('span');
        if (span) span.textContent = current.title;
    }

    // ─── Electron Integration ─────────────────────────────────────────────────

    setupElectronIntegration() {
        ipcRenderer.on('load-video', (event, videoPath) => {
            this.loadVideoFile(videoPath);
        });

        ipcRenderer.invoke('get-video-path').then(videoPath => {
            if (videoPath) {
                this.loadVideoFile(videoPath);
            }
        });
    }

    // ─── Settings ─────────────────────────────────────────────────────────────

    initializeSettings() {
        this.stableVolumeToggle.checked = this.settings.stableVolume;
        this.ambientToggle.checked = this.settings.ambientMode;
        this.sleepTimerValue.textContent = this.settings.sleepTimer;
        this.playbackSpeedValue.textContent = this.settings.playbackSpeed;
        this.qualityValue.textContent = this.settings.quality;
        this.audioTrackValue.textContent = this.settings.audioTrack;
        // Default volume: 50%
        this.video.volume = 0.5;
        this.updateVolumeUI();
    }

    handleSettingsClick(e) {
        const menuType = e.currentTarget.dataset.menu;

        switch (menuType) {
            case 'subtitles':
                this.showSubtitlesSubmenu();
                break;
            case 'audiotrack':                    // FIX: was missing
                this.showAudioTrackSubmenu();
                break;
            case 'sleep':
                this.showSleepTimerSubmenu();
                break;
            case 'speed':
                this.showSpeedSubmenu();
                break;
            case 'quality':
                this.showQualitySubmenu();
                break;
        }
        this.handleUserActivity();
    }

    isClickInsideSubmenus(target) {
        return this.sleepTimerSubmenu.contains(target) ||
            this.speedSubmenu.contains(target) ||
            this.qualitySubmenu.contains(target) ||
            this.audioSubmenu.contains(target) ||       // FIX: was missing
            this.subtitlesSubmenu.contains(target);     // FIX: was missing
    }

    closeAllSubmenus() {
        this.sleepTimerSubmenu.classList.add('hidden');
        this.speedSubmenu.classList.add('hidden');
        this.qualitySubmenu.classList.add('hidden');
        this.audioSubmenu.classList.add('hidden');      // FIX: was missing
        this.subtitlesSubmenu.classList.add('hidden');  // FIX: was missing
        this.currentSubmenu = null;
    }

    setupSubmenuEvents() {
        document.getElementById('sleepTimerBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainSettings();
        });
        document.getElementById('speedBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainSettings();
        });
        document.getElementById('qualityBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainSettings();
        });
        document.getElementById('audioBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainSettings();
        });
        document.getElementById('subtitlesBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainSettings();
        });

        // Sleep timer options
        document.querySelectorAll('#sleepTimerSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectSleepTimer(e.target.dataset.value);
            });
        });

        // Speed options
        document.querySelectorAll('#speedSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectPlaybackSpeed(e.target.dataset.value);
            });
        });

        // Subtitles options
        document.querySelectorAll('#subtitlesSubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.value;
                if (action === 'load') {
                    this.openSubtitleDialog();
                } else if (action === 'off') {
                    this.subtitlesActive = false;
                    this.applySubtitleState();
                    this.showMainSettings();
                }
            });
        });
    }

    showSleepTimerSubmenu() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        this.closeAllSubmenus();
        this.sleepTimerSubmenu.classList.remove('hidden');
        this.currentSubmenu = 'sleep';
        this.updateActiveOption('sleepTimerSubmenu', this.settings.sleepTimer);
    }

    showSpeedSubmenu() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        this.closeAllSubmenus();
        this.speedSubmenu.classList.remove('hidden');
        this.currentSubmenu = 'speed';
        this.updateActiveOption('speedSubmenu', this.settings.playbackSpeed);
    }

    showQualitySubmenu() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        this.closeAllSubmenus();
        this.qualitySubmenu.classList.remove('hidden');
        this.currentSubmenu = 'quality';
        this.updateActiveOption('qualitySubmenu', this.settings.quality);
    }

    updateActiveOption(submenuId, value) {
        const submenu = document.getElementById(submenuId);
        submenu.querySelectorAll('.submenu-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.value === value) {
                option.classList.add('active');
            }
        });
    }

    selectPlaybackSpeed(value) {
        this.settings.playbackSpeed = value;
        this.playbackSpeedValue.textContent = value;

        const speedMap = {
            '0.25': 0.25, '0.5': 0.5, '0.75': 0.75,
            'Normal': 1,
            '1.25': 1.25, '1.5': 1.5, '1.75': 1.75, '2': 2
        };

        this.video.playbackRate = speedMap[value] || 1;
        this.updateActiveOption('speedSubmenu', value);
        console.log('Playback speed set to:', value);
        this.showMainSettings();
    }

    // ─── Settings Menu State ──────────────────────────────────────────────────

    toggleSettings() {
        if (this.settingsOpen || this.currentSubmenu) {
            this.closeAllMenus();
        } else {
            this.openSettings();
        }
        this.handleUserActivity();
    }

    openSettings() {
        this.closeAllSubmenus();
        this.settingsMenu.classList.remove('hidden');
        this.settingsOpen = true;
        this.currentSubmenu = null;
        this.clearHideTimer();
        this.showControls();
    }

    closeSettings() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        if (this.isPlaying && !this.currentSubmenu) {
            this.startHideTimer(2000);
        }
    }

    closeAllSubmenus() {
        this.sleepTimerSubmenu.classList.add('hidden');
        this.speedSubmenu.classList.add('hidden');
        this.qualitySubmenu.classList.add('hidden');
        this.audioSubmenu.classList.add('hidden');
        this.subtitlesSubmenu.classList.add('hidden');
        this.currentSubmenu = null;
    }

    closeAllMenus() {
        this.closeSettings();
        this.closeAllSubmenus();
    }

    showMainSettings() {
        this.closeAllSubmenus();
        this.settingsMenu.classList.remove('hidden');
        this.settingsOpen = true;
        this.currentSubmenu = null;
    }

    // ─── Video State ──────────────────────────────────────────────────────────

    onVideoLoaded() {
        this.updateTimeDisplay();
        // Switch from home screen to player
        if (this.homeScreen) this.homeScreen.style.display = 'none';
        this.playerContainer.style.display = 'block';
        console.log('Video loaded successfully');
    }

    updateProgress() {
        if (!this.video.duration) return;

        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progressPlayed.style.width = `${progress}%`;
        this.progressHandle.style.left = `${progress}%`;
        this.updateTimeDisplay();

        if (this.chapters.length > 0) {
            this.updateCurrentChapter();
        }
    }

    updateBuffered() {
        if (this.video.buffered.length > 0 && this.video.duration) {
            const buffered = (this.video.buffered.end(0) / this.video.duration) * 100;
            this.progressBuffered.style.width = `${buffered}%`;
        }
    }

    updateTimeDisplay() {
        this.currentTime.textContent = this.formatTime(this.video.currentTime || 0);
        this.totalTime.textContent = this.formatTime(this.video.duration || 0);
    }

    updateProgressHover(e) {
        if (!this.video.duration || !this.progressTooltip) return;

        const rect = this.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.video.duration;

        // Update time label
        if (this.previewTooltipTime) {
            this.previewTooltipTime.textContent = this.formatTime(time);
        }

        // Show tooltip
        this.progressTooltip.style.display = 'flex';
        this.progressTooltip.style.left = `${percent * 100}%`;

        // Seek preview video to get frame (throttled)
        this.seekPreviewFrame(time);
    }

    seek(e) {
        if (!this.video.duration) return;

        const rect = this.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.video.currentTime = percent * this.video.duration;
        this.handleUserActivity();
    }

    // ─── Playback ─────────────────────────────────────────────────────────────

    togglePlayPause() {
        if (this.video.paused) {
            this.play();
        } else {
            this.pause();
        }
        this.handleUserActivity();
    }

    play() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.video.play().catch(e => console.error('Play error:', e));
    }

    pause() {
        this.video.pause();
    }

    onPlay() {
        this.isPlaying = true;
        this.playerContainer.classList.add('playing');
        this.showPlayIcon(false);

        setTimeout(() => {
            if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
                this.startHideTimer();
            }
        }, 3000);
    }

    onPause() {
        this.isPlaying = false;
        this.playerContainer.classList.remove('playing');
        this.showPlayIcon(true);
        this.showControls();
        this.clearHideTimer();
    }

    onVideoEnded() {
        this.isPlaying = false;
        this.playerContainer.classList.remove('playing');
        this.showPlayIcon(true);
        this.showControls();
        this.clearHideTimer();

        // Auto-advance to next file in playlist
        if (this.playlist.length > 1 && this.currentIndex >= 0) {
            const nextIndex = this.currentIndex + 1;
            if (nextIndex < this.playlist.length) {
                this.loadVideoFile(this.playlist[nextIndex]).then(() => {
                    setTimeout(() => this.play(), 500);
                });
            }
        }
    }

    showPlayIcon(show) {
        const playIcon = this.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

        if (show) {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        } else {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        }
    }

    // ─── Volume ───────────────────────────────────────────────────────────────

    toggleMute() {
        if (this.video.muted || this.video.volume === 0) {
            this.video.muted = false;
            this.video.volume = this.currentVolume > 0 ? this.currentVolume : 0.5;
        } else {
            this.currentVolume = this.video.volume;
            this.video.muted = true;
        }
        this.handleUserActivity();
    }

    onVolumeChange() {
        this.isMuted = this.video.muted || this.video.volume === 0;
        this.updateVolumeUI();
    }

    updateVolumeUI() {
        const isMuted = this.video.muted || this.video.volume === 0;
        const vol = isMuted ? 0 : this.video.volume;

        // Sync slider position
        if (this.volumeSlider) {
            this.volumeSlider.value = vol;
            // Update CSS custom property for filled track
            this.volumeSlider.style.setProperty('--volume-pct', `${vol * 100}%`);
        }

        // Toggle mute/unmute icon
        const highIcon = this.volumeBtn.querySelector('.volume-high');
        const mutedIcon = this.volumeBtn.querySelector('.volume-muted');
        if (highIcon && mutedIcon) {
            highIcon.classList.toggle('hidden', isMuted);
            mutedIcon.classList.toggle('hidden', !isMuted);
        }
    }

    // ─── Modes ────────────────────────────────────────────────────────────────

    togglePictureInPicture() {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(e => console.error('PiP error:', e));
        } else if (document.pictureInPictureEnabled) {
            this.video.requestPictureInPicture().catch(e => console.error('PiP error:', e));
        }
        this.handleUserActivity();
    }

    toggleTheaterMode() {
        this.isTheaterMode = !this.isTheaterMode;
        if (this.isTheaterMode) {
            this.playerContainer.style.height = '70vh';
            this.playerContainer.style.maxWidth = '100vw';
        } else {
            this.playerContainer.style.height = '100vh';
        }
        this.handleUserActivity();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.playerContainer.requestFullscreen().catch(e => console.error('Fullscreen error:', e));
        } else {
            document.exitFullscreen().catch(e => console.error('Exit fullscreen error:', e));
        }
        this.handleUserActivity();
    }

    // ─── Home Button ──────────────────────────────────────────────────────────

    setupHomeButton() {
        if (!this.homeBtn) return;
        this.homeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.returnToHome();
        });
    }

    returnToHome() {
        if (this.isPlaying) this.pause();
        this.playerContainer.style.display = 'none';
        if (this.homeScreen) {
            this.homeScreen.style.display = 'flex';
            if (this.library) this.library.render();
        }
    }

    // ─── Drag & Drop ──────────────────────────────────────────────────────────

    setupDragDrop() {
        const videoExtensions = /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp|ogv|ts|mts)$/i;
        let dragCounter = 0;

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                this.showDropOverlay();
            }
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                this.hideDropOverlay();
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            this.hideDropOverlay();

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (videoExtensions.test(file.name) && file.path) {
                    this.loadVideoFile(file.path);
                }
            }
        });
    }

    showDropOverlay() {
        if (this.dropOverlay) this.dropOverlay.classList.remove('hidden');
    }

    hideDropOverlay() {
        if (this.dropOverlay) this.dropOverlay.classList.add('hidden');
    }

    // ─── Context Menu ─────────────────────────────────────────────────────────

    setupContextMenu() {
        const { clipboard, shell } = require('electron');

        // Show custom context menu on right-click in player
        this.playerContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        // Copy timestamp
        const ctxCopy = document.getElementById('ctxCopyTimestamp');
        if (ctxCopy) {
            ctxCopy.addEventListener('click', () => {
                const ts = this.formatTime(this.video.currentTime || 0);
                clipboard.writeText(ts);
                this.hideContextMenu();
            });
        }

        // Open in Explorer
        const ctxExplorer = document.getElementById('ctxOpenInExplorer');
        if (ctxExplorer) {
            ctxExplorer.addEventListener('click', () => {
                if (this.currentVideoPath) {
                    shell.showItemInFolder(this.currentVideoPath);
                }
                this.hideContextMenu();
            });
        }

        // Close on any outside click
        document.addEventListener('click', (e) => {
            if (this.contextMenu && !this.contextMenu.classList.contains('hidden') &&
                !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showContextMenu(x, y) {
        if (!this.contextMenu) return;
        this.contextMenu.classList.remove('hidden');

        // Clamp to viewport
        const menuW = 200;
        const menuH = 80;
        const left = Math.min(x, window.innerWidth - menuW - 8);
        const top = Math.min(y, window.innerHeight - menuH - 8);
        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;

        // Dim "Open in Explorer" when no file loaded
        const ctxExplorer = document.getElementById('ctxOpenInExplorer');
        if (ctxExplorer) {
            const noFile = !this.currentVideoPath;
            ctxExplorer.style.opacity = noFile ? '0.35' : '1';
            ctxExplorer.style.pointerEvents = noFile ? 'none' : 'auto';
        }
    }

    hideContextMenu() {
        if (this.contextMenu) this.contextMenu.classList.add('hidden');
    }

    // ─── Frame Preview ────────────────────────────────────────────────────────

    setupFramePreview() {
        if (!this.previewVideo || !this.previewCanvas) return;
        this.previewCtx = this.previewCanvas.getContext('2d');

        this.previewVideo.addEventListener('seeked', () => {
            if (!this.previewCtx) return;
            this.previewCtx.drawImage(
                this.previewVideo,
                0, 0,
                this.previewCanvas.width,
                this.previewCanvas.height
            );
        });
    }

    seekPreviewFrame(time) {
        if (!this.previewVideo || !this.video.src) return;

        const now = Date.now();
        if (now - this.previewLastSeek < 150) return; // throttle
        this.previewLastSeek = now;

        // Keep preview src in sync with main video
        if (this.previewVideo.src !== this.video.src) {
            this.previewVideo.src = this.video.src;
            this.previewVideo.load();
        }

        this.previewVideo.currentTime = time;
    }

    onFullscreenChange() {
        this.isFullscreen = !!document.fullscreenElement;
        this.showControls();
        if (this.isFullscreen) {
            this.clearHideTimer();
            if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
                this.startHideTimer(4000);
            }
        }
    }

    // ─── Controls Visibility ──────────────────────────────────────────────────

    handleMouseActivity(e) {
        this.userActivity = true;
        this.showControls();
        this.clearHideTimer();
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer();
        }
    }

    handleMouseLeave() {
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer(1500);
        }
    }

    handleUserActivity() {
        this.userActivity = true;
        this.showControls();
        this.clearHideTimer();
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer();
        }
    }

    handleControlBarHover(entering) {
        if (entering) {
            this.clearHideTimer();
            this.showControls();
        } else {
            if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
                this.startHideTimer(2000);
            }
        }
    }

    showControls() {
        this.controlBar.classList.remove('auto-hide');
        this.controlBar.classList.add('show');
        if (this.homeBtn) this.homeBtn.classList.remove('auto-hide');
    }

    hideControls() {
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu && !this.userActivity) {
            this.controlBar.classList.add('auto-hide');
            this.controlBar.classList.remove('show');
            if (this.homeBtn) this.homeBtn.classList.add('auto-hide');
        }
        this.userActivity = false;
    }

    startHideTimer(delay = 3000) {
        this.clearHideTimer();
        if (!this.isPlaying || this.settingsOpen || this.currentSubmenu) return;
        this.hideControlsTimeout = setTimeout(() => this.hideControls(), delay);
    }

    clearHideTimer() {
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
            this.hideControlsTimeout = null;
        }
    }

    // ─── Keyboard ─────────────────────────────────────────────────────────────

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        this.handleUserActivity();

        switch (e.code) {
            case 'Space':
            case 'KeyK':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
            case 'KeyJ':
                e.preventDefault();
                this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                break;
            case 'ArrowRight':
            case 'KeyL':
                e.preventDefault();
                this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.video.volume = Math.min(1, this.video.volume + 0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.video.volume = Math.max(0, this.video.volume - 0.05);
                break;
            case 'KeyM':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'KeyF':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'Escape':
                e.preventDefault();
                if (this.contextMenu && !this.contextMenu.classList.contains('hidden')) {
                    this.hideContextMenu();
                } else if (this.settingsOpen || this.currentSubmenu) {
                    this.closeAllMenus();
                } else if (this.isFullscreen) {
                    this.toggleFullscreen();
                }
                break;
            case 'KeyT':
                e.preventDefault();
                this.toggleTheaterMode();
                break;
            case 'KeyC':
                e.preventDefault();
                this.toggleSubtitles();
                break;
            case 'KeyI':
                e.preventDefault();
                this.togglePictureInPicture();
                break;
        }
    }

    // ─── Utils ────────────────────────────────────────────────────────────────

    formatTime(seconds) {
        if (isNaN(seconds)) seconds = 0;
        if (seconds === 0) return '0:00';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// ═════════════════════════════════════════════════════════════════ HomeLibrary

class HomeLibrary {
    constructor(player) {
        this.player = player;
        this.dirs = this.loadDirs();
        this.cache = this.loadCache();
        this.thumbnailQueue = [];
        this.activeThumbnailJobs = 0;
        this.CONCURRENCY = 3;

        this.homeScreen    = document.getElementById('homeScreen');
        this.sectionsEl    = document.getElementById('librarySections');
        this.emptyEl       = document.getElementById('libraryEmpty');
        this.addFolderBtn  = document.getElementById('addFolderBtn');
        this.openFileBtn   = document.getElementById('openFileBtn');

        this.bindEvents();
        this.render();
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
            // localStorage quota exceeded — clear thumbnails
            this.cache = {};
            localStorage.removeItem('vl-library-cache');
        }
    }

    // ── Events ────────────────────────────────────────────────────────────────

    bindEvents() {
        if (this.addFolderBtn) {
            this.addFolderBtn.addEventListener('click', () => this.promptAddFolder());
        }
        if (this.openFileBtn) {
            this.openFileBtn.addEventListener('click', () => this.promptOpenFile());
        }
    }

    async promptAddFolder() {
        const { ipcRenderer } = require('electron');
        try {
            const result = await ipcRenderer.invoke('show-directory-dialog');
            if (!result.canceled && result.filePaths.length > 0) {
                const dir = result.filePaths[0];
                if (!this.dirs.includes(dir)) {
                    this.dirs.push(dir);
                    this.saveDirs();
                    this.render();
                }
            }
        } catch (e) {
            console.error('Add folder error:', e);
        }
    }

    async promptOpenFile() {
        const { ipcRenderer } = require('electron');
        try {
            const result = await ipcRenderer.invoke('show-open-dialog', {
                title: 'Open video file',
                filters: [
                    { name: 'Video', extensions: ['mp4','avi','mkv','mov','wmv','flv','webm','m4v','3gp','ogv','ts','mts'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });
            if (!result.canceled && result.filePaths.length > 0) {
                this.player.loadVideoFile(result.filePaths[0]);
            }
        } catch (e) {
            console.error('Open file error:', e);
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    render() {
        if (!this.sectionsEl || !this.emptyEl) return;

        // Reset thumbnail queue for fresh render
        this.thumbnailQueue = [];
        this.activeThumbnailJobs = 0;

        if (this.dirs.length === 0) {
            this.emptyEl.classList.remove('hidden');
            this.sectionsEl.classList.add('hidden');
            return;
        }

        this.emptyEl.classList.add('hidden');
        this.sectionsEl.classList.remove('hidden');
        this.sectionsEl.innerHTML = '';

        const fs   = require('fs');
        const path = require('path');
        const videoExt = /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp|ogv|ts|mts)$/i;

        for (const dir of this.dirs) {
            let files = [];
            try {
                files = fs.readdirSync(dir)
                    .filter(f => videoExt.test(f))
                    .sort()
                    .map(f => path.join(dir, f));
            } catch (e) {
                console.warn('Cannot read dir:', dir);
                continue;
            }
            if (files.length === 0) continue;

            this.sectionsEl.appendChild(this.buildSection(dir, files, path));
        }

        this.processThumbnailQueue();
    }

    buildSection(dir, files, path) {
        const section = document.createElement('div');
        section.className = 'library-section';

        const header = document.createElement('div');
        header.className = 'library-section-header';

        const title = document.createElement('div');
        title.className = 'library-section-title';
        title.textContent = path.basename(dir) || dir;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'library-section-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => this.removeDir(dir));

        header.appendChild(title);
        header.appendChild(removeBtn);

        const grid = document.createElement('div');
        grid.className = 'library-grid';

        for (const filePath of files) {
            grid.appendChild(this.buildCard(filePath, path));
        }

        section.appendChild(header);
        section.appendChild(grid);
        return section;
    }

    buildCard(filePath, path) {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.title = filePath;

        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'library-card-thumb';

        const cached = this.cache[filePath];
        if (cached && cached.thumbDataUrl) {
            const img = document.createElement('img');
            img.src = cached.thumbDataUrl;
            thumbDiv.appendChild(img);
        } else {
            // Placeholder icon
            thumbDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"></polygon>
            </svg>`;
            this.thumbnailQueue.push({ filePath, thumbDiv, card });
        }

        const info = document.createElement('div');
        info.className = 'library-card-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'library-card-name';
        nameEl.textContent = path.basename(filePath, path.extname(filePath));

        const durEl = document.createElement('div');
        durEl.className = 'library-card-duration';
        durEl.textContent = (cached && cached.duration)
            ? this.player.formatTime(cached.duration)
            : '—';

        info.appendChild(nameEl);
        info.appendChild(durEl);
        card.appendChild(thumbDiv);
        card.appendChild(info);

        card.addEventListener('click', () => {
            this.player.loadVideoFile(filePath);
        });

        return card;
    }

    // ── Thumbnail Generation ──────────────────────────────────────────────────

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
        return new Promise((resolve) => {
            const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';
            tempVideo.muted = true;
            tempVideo.src = fileUrl;
            tempVideo.style.display = 'none';
            document.body.appendChild(tempVideo);

            let done = false;
            const cleanup = () => {
                if (done) return;
                done = true;
                if (document.body.contains(tempVideo)) document.body.removeChild(tempVideo);
                resolve();
            };

            // Safety timeout for corrupt/inaccessible files
            const safetyTimer = setTimeout(cleanup, 8000);

            tempVideo.addEventListener('loadedmetadata', () => {
                const duration = tempVideo.duration;

                if (!this.cache[filePath]) this.cache[filePath] = {};
                this.cache[filePath].duration = duration;

                // Update duration label
                const durEl = card.querySelector('.library-card-duration');
                if (durEl) durEl.textContent = this.player.formatTime(duration);

                // Seek to 5s or 10% of duration
                tempVideo.currentTime = Math.min(5, duration * 0.1);
            });

            tempVideo.addEventListener('seeked', () => {
                clearTimeout(safetyTimer);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 200;
                    canvas.height = 112;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempVideo, 0, 0, 200, 112);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

                    // Replace placeholder with image
                    thumbDiv.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    thumbDiv.appendChild(img);

                    // Cache it
                    this.cache[filePath].thumbDataUrl = dataUrl;
                    this.saveCache();
                } catch (e) {
                    console.warn('Canvas draw failed:', e);
                }
                cleanup();
            });

            tempVideo.addEventListener('error', () => {
                clearTimeout(safetyTimer);
                cleanup();
            });
        });
    }

    // ── Directory Management ──────────────────────────────────────────────────

    removeDir(dir) {
        this.dirs = this.dirs.filter(d => d !== dir);
        this.saveDirs();
        this.render();
    }
}

// Initialize the player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Vision Lumina...');
    try {
        window.VisionPlayer = new VisionLumina();
    } catch (error) {
        console.error('Error initializing Vision Lumina:', error);
    }
});

// Handle page visibility for auto-pause
document.addEventListener('visibilitychange', () => {
    if (window.VisionPlayer && document.hidden && window.VisionPlayer.isPlaying) {
        window.VisionPlayer.pause();
    }
});
