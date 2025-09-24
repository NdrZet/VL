const { ipcRenderer } = require('electron');

class VisionLumina {
    constructor() {
        this.video = document.getElementById('videoPlayer');
        this.controlBar = document.getElementById('controlBar');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.playerContainer = document.querySelector('.player-container');
        
        // Control elements
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeBtn = document.getElementById('volumeBtn');
        this.ccBtn = document.getElementById('ccBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.pipBtn = document.getElementById('pipBtn');
        this.theaterBtn = document.getElementById('theaterBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.chapterBtn = document.getElementById('chapterBtn');
        
        // Progress elements
        this.progressContainer = document.querySelector('.progress-container');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressPlayed = document.getElementById('progressPlayed');
        this.progressBuffered = document.getElementById('progressBuffered');
        this.progressHandle = document.getElementById('progressHandle');
        
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
        
        // Value displays
        this.sleepTimerValue = document.getElementById('sleepTimerValue');
        this.playbackSpeedValue = document.getElementById('playbackSpeedValue');
        this.qualityValue = document.getElementById('qualityValue');
        
        // State
        this.isPlaying = false;
        this.isFullscreen = false;
        this.isTheaterMode = false;
        this.currentVolume = 1;
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
            quality: '1080p60 HD'
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeSettings();
        this.updateTimeDisplay();
        
        // Ensure controls are visible from start
        this.showControls();
        
        // Load video
        this.video.load();
        this.setupElectronIntegration();

        console.log('Vision Lumina initialized successfully');
    }
    
    initializeSettings() {
        // Set initial toggle states
        this.stableVolumeToggle.checked = this.settings.stableVolume;
        this.ambientToggle.checked = this.settings.ambientMode;
        
        // Set initial value displays
        this.sleepTimerValue.textContent = this.settings.sleepTimer;
        this.playbackSpeedValue.textContent = this.settings.playbackSpeed;
        this.qualityValue.textContent = this.settings.quality;
    }
    
    setupEventListeners() {
        // Video events
        this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('progress', () => this.updateBuffered());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('ended', () => this.onVideoEnded());
        this.video.addEventListener('volumechange', () => this.onVolumeChange());
        this.video.addEventListener('click', () => this.togglePlayPause());
        
        // Control button events
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });
        this.nextBtn.addEventListener('click', () => this.nextVideo());
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.ccBtn.addEventListener('click', () => this.toggleSubtitles());
        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSettings();
        });
        this.pipBtn.addEventListener('click', () => this.togglePictureInPicture());
        this.theaterBtn.addEventListener('click', () => this.toggleTheaterMode());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.chapterBtn.addEventListener('click', () => this.showChapterMenu());
        
        // Progress bar events
        this.progressContainer.addEventListener('click', (e) => this.seek(e));
        this.progressContainer.addEventListener('mousemove', (e) => this.updateProgressHover(e));
        
        // Settings menu events
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
        
        // Submenu navigation
        this.setupSubmenuEvents();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Click outside menus to close
        document.addEventListener('click', (e) => {
            if (!this.settingsMenu.contains(e.target) && 
                !this.settingsBtn.contains(e.target) &&
                !this.isClickInsideSubmenus(e.target)) {
                this.closeAllMenus();
            }
        });
        
        // Enhanced mouse activity tracking for auto-hide
        this.playerContainer.addEventListener('mousemove', (e) => this.handleMouseActivity(e));
        this.playerContainer.addEventListener('mouseenter', () => this.handleMouseActivity());
        this.playerContainer.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.playerContainer.addEventListener('click', () => this.handleUserActivity());
        
        // Control bar specific events
        this.controlBar.addEventListener('mouseenter', () => this.handleControlBarHover(true));
        this.controlBar.addEventListener('mouseleave', () => this.handleControlBarHover(false));
        
        // Fullscreen change events
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('msfullscreenchange', () => this.onFullscreenChange());
    }
    
    setupSubmenuEvents() {
        // Back buttons
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
        
        // Quality options
        document.querySelectorAll('#qualitySubmenu .submenu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectQuality(e.target.dataset.value);
            });
        });
    }
    setupElectronIntegration() {
        // Слушаем сообщение о загрузке видео из main процесса
        ipcRenderer.on('load-video', (event, videoPath) => {
            this.loadVideoFile(videoPath);
        });

        // Загружаем видео при старте если путь передан
        ipcRenderer.invoke('get-video-path').then(videoPath => {
            if (videoPath) {
                this.loadVideoFile(videoPath);
            }
        });
    }

    loadVideoFile(filePath) {
        if (!filePath) return;

        // Конвертируем путь в file:// URL для локальных файлов
        const fileUrl = filePath.startsWith('file://')
            ? filePath
            : `file://${filePath.replace(/\\/g, '/')}`;

        // Устанавливаем источник видео
        this.video.src = fileUrl;

        // Показываем название файла
        const fileName = filePath.split(/[\\/]/).pop();
        document.title = `Vision Lumina Player - ${fileName}`;

        // Загружаем и запускаем
        this.video.load();

        console.log('Loaded video:', fileName);
    }

    isClickInsideSubmenus(target) {
        return this.sleepTimerSubmenu.contains(target) || 
               this.speedSubmenu.contains(target) || 
               this.qualitySubmenu.contains(target);
    }
    
    handleMouseActivity(e) {
        this.userActivity = true;
        this.showControls();
        this.clearHideTimer();
        
        // Only start hide timer if playing and no menus open
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer();
        }
    }
    
    handleMouseLeave() {
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer(1500); // Shorter delay when leaving
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
        } else if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
            this.startHideTimer(2000);
        }
    }
    
    onVideoLoaded() {
        this.updateTimeDisplay();
        console.log('Video loaded successfully');
    }
    
    updateProgress() {
        if (!this.video.duration) return;
        
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progressPlayed.style.width = `${progress}%`;
        this.progressHandle.style.left = `${progress}%`;
        
        this.updateTimeDisplay();
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
        const rect = this.progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        // Could add time tooltip here if needed
    }
    
    seek(e) {
        if (!this.video.duration) return;
        
        const rect = this.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.video.duration;
        
        this.video.currentTime = time;
        this.handleUserActivity();
    }
    
    togglePlayPause() {
        if (this.video.paused) {
            this.play();
        } else {
            this.pause();
        }
        this.handleUserActivity();
    }
    
    play() {
        this.video.play().catch(e => console.error('Play error:', e));
    }
    
    pause() {
        this.video.pause();
    }
    
    onPlay() {
        this.isPlaying = true;
        this.playerContainer.classList.add('playing');
        this.showPlayIcon(false);
        
        // Start hide timer only after user stops interacting
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
    
    nextVideo() {
        // Simulate next video - reset to beginning for demo
        this.video.currentTime = 0;
        if (this.isPlaying) {
            this.play();
        }
        this.handleUserActivity();
    }
    
    toggleMute() {
        if (this.video.muted || this.video.volume === 0) {
            this.video.muted = false;
            this.video.volume = this.currentVolume || 0.5;
        } else {
            this.currentVolume = this.video.volume;
            this.video.muted = true;
        }
        this.handleUserActivity();
    }
    
    onVolumeChange() {
        // Update volume icon if needed
        this.isMuted = this.video.muted || this.video.volume === 0;
    }
    
    toggleSubtitles() {
        // Toggle CC button state
        this.ccBtn.style.opacity = this.ccBtn.style.opacity === '0.6' ? '1' : '0.6';
        this.handleUserActivity();
    }
    
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
        this.clearHideTimer(); // Don't hide controls while settings are open
        this.showControls();
    }
    
    closeSettings() {
        this.settingsMenu.classList.add('hidden');
        this.settingsOpen = false;
        
        // Resume auto-hide if playing
        if (this.isPlaying && !this.currentSubmenu) {
            this.startHideTimer(2000);
        }
    }
    
    closeAllSubmenus() {
        this.sleepTimerSubmenu.classList.add('hidden');
        this.speedSubmenu.classList.add('hidden');
        this.qualitySubmenu.classList.add('hidden');
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
    
    handleSettingsClick(e) {
        const menuType = e.currentTarget.dataset.menu;
        
        switch (menuType) {
            case 'subtitles':
                console.log('Open subtitles menu');
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
    
    selectSleepTimer(value) {
        this.settings.sleepTimer = value;
        this.sleepTimerValue.textContent = value;
        this.updateActiveOption('sleepTimerSubmenu', value);
        
        // Implement actual sleep timer logic here
        console.log('Sleep timer set to:', value);
        
        this.showMainSettings();
    }
    
    selectPlaybackSpeed(value) {
        this.settings.playbackSpeed = value;
        this.playbackSpeedValue.textContent = value;
        
        // Set actual playback speed
        const speedMap = {
            '0.25': 0.25,
            '0.5': 0.5,
            '0.75': 0.75,
            'Normal': 1,
            '1.25': 1.25,
            '1.5': 1.5,
            '1.75': 1.75,
            '2': 2
        };
        
        this.video.playbackRate = speedMap[value] || 1;
        this.updateActiveOption('speedSubmenu', value);
        
        console.log('Playback speed set to:', value);
        
        this.showMainSettings();
    }
    
    selectQuality(value) {
        this.settings.quality = value;
        this.qualityValue.textContent = value;
        this.updateActiveOption('qualitySubmenu', value);
        
        // Implement actual quality change logic here
        console.log('Quality set to:', value);
        
        this.showMainSettings();
    }
    
    toggleStableVolume() {
        this.settings.stableVolume = this.stableVolumeToggle.checked;
        console.log('Stable Volume:', this.settings.stableVolume);
        this.handleUserActivity();
    }
    
    toggleAmbientMode() {
        this.settings.ambientMode = this.ambientToggle.checked;
        console.log('Ambient Mode:', this.settings.ambientMode);
        this.handleUserActivity();
    }
    
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
    
    onFullscreenChange() {
        this.isFullscreen = !!document.fullscreenElement;
        
        // Ensure controls are visible when entering/exiting fullscreen
        this.showControls();
        
        // In fullscreen, always show controls on any activity
        if (this.isFullscreen) {
            this.clearHideTimer();
            if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu) {
                this.startHideTimer(4000); // Longer delay in fullscreen
            }
        }
    }
    
    showChapterMenu() {
        // Could implement chapter selection
        console.log('Show chapter menu');
        this.handleUserActivity();
    }
    
    showControls() {
        this.controlBar.classList.remove('auto-hide');
        this.controlBar.classList.add('show');
    }
    
    hideControls() {
        // Only hide if playing and no menus open and no recent user activity
        if (this.isPlaying && !this.settingsOpen && !this.currentSubmenu && !this.userActivity) {
            this.controlBar.classList.add('auto-hide');
            this.controlBar.classList.remove('show');
        }
        
        // Reset user activity flag
        this.userActivity = false;
    }
    
    startHideTimer(delay = 3000) {
        this.clearHideTimer();
        
        // Don't hide if paused or menus open
        if (!this.isPlaying || this.settingsOpen || this.currentSubmenu) {
            return;
        }
        
        this.hideControlsTimeout = setTimeout(() => {
            this.hideControls();
        }, delay);
    }
    
    clearHideTimer() {
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
            this.hideControlsTimeout = null;
        }
    }
    
    handleKeyboard(e) {
        // Prevent shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Always show controls on keyboard interaction
        this.handleUserActivity();
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'KeyK':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                break;
            case 'KeyJ':
                e.preventDefault();
                this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
                break;
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
                if (this.settingsOpen || this.currentSubmenu) {
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
    
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing YVision Lumina...');
    try {
        window.VisionPlayer = new VisionLumina();
    } catch (error) {
        console.error('Error initializing Vision Lumina:', error);
    }
});

// Handle page visibility for auto-pause
document.addEventListener('visibilitychange', () => {
    if (window.VisionPlayer && document.hidden && window.VisionPlayer.isPlaying) {
        // Could auto-pause when tab is hidden
    }
});