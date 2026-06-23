// ─── FeaturesManager ─────────────────────────────────────────────────────────
// Handles: Ambient Mode (canvas), Zoom & Pan, Mini Player (animated),
//          Frame Preview (progress bar thumbnail), Drag & Drop, Context Menu.

class FeaturesManager {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player = player;

        // Ambient Mode
        this.ambientAnimationId = null;
        this.ambientCtx         = null;

        // Zoom & Pan
        this.videoScale  = 1;
        this.videoPanX   = 0;
        this.videoPanY   = 0;
        this.isPanning   = false;
        this.panStart    = { x: 0, y: 0 };
        this.panOrigin   = { x: 0, y: 0 };

        // Mini Player
        this.isMiniMode = false;
        this._miniDrag  = null;

        // Frame Preview
        this.previewLastSeek = 0;
        this.previewCtx      = null;
    }

    setup() {
        this.setupAmbientMode();
        this.setupZoomPan();
        this.setupMiniPlayer();
        this.setupFramePreview();
        this.setupDragDrop();
        this.setupContextMenu();
        this.setupHomeButton();
    }

    // ── Ambient Mode ─────────────────────────────────────────────────────────

    setupAmbientMode() {
        // Nothing to bind — toggle is handled by UIManager stableVolumeToggle listener
    }

    toggleAmbientMode() {
        const p = this.player;
        p.settings.ambientMode = p.ambientToggle.checked;

        if (p.settings.ambientMode) {
            p.playerContainer.classList.add('ambient-active');
            this.startAmbientLoop();
        } else {
            p.playerContainer.classList.remove('ambient-active');
            this.stopAmbientLoop();
        }

        console.log('Ambient Mode:', p.settings.ambientMode);
        p.ui.handleUserActivity();
    }

    startAmbientLoop() {
        const p = this.player;
        if (!p.ambientCanvas) return;
        this.ambientCtx = p.ambientCanvas.getContext('2d');

        const draw = () => {
            if (!p.settings.ambientMode) return;
            if (!p.video.paused && !p.video.ended && p.video.readyState >= 2) {
                const w = p.ambientCanvas.offsetWidth;
                const h = p.ambientCanvas.offsetHeight;
                if (p.ambientCanvas.width  !== w) p.ambientCanvas.width  = w;
                if (p.ambientCanvas.height !== h) p.ambientCanvas.height = h;
                this.ambientCtx.drawImage(p.video, 0, 0, w, h);
            }
            this.ambientAnimationId = requestAnimationFrame(draw);
        };
        draw();
    }

    stopAmbientLoop() {
        const p = this.player;
        if (this.ambientAnimationId) {
            cancelAnimationFrame(this.ambientAnimationId);
            this.ambientAnimationId = null;
        }
        if (this.ambientCtx && p.ambientCanvas) {
            this.ambientCtx.clearRect(0, 0, p.ambientCanvas.width, p.ambientCanvas.height);
        }
    }

    // ── Zoom & Pan ────────────────────────────────────────────────────────────

    setupZoomPan() {
        const p = this.player;
        if (!p.videoWrapper) return;

        p.videoWrapper.addEventListener('wheel', e => {
            e.preventDefault();
            const delta    = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(1, Math.min(5, this.videoScale * delta));
            if (newScale === 1) { this.videoPanX = 0; this.videoPanY = 0; }
            this.videoScale = newScale;
            this.applyVideoTransform();
        }, { passive: false });

        p.videoWrapper.addEventListener('mousedown', e => {
            if (this.videoScale > 1 && e.button === 0) {
                this.isPanning  = true;
                this.panStart  = { x: e.clientX, y: e.clientY };
                this.panOrigin = { x: this.videoPanX, y: this.videoPanY };
                p.videoWrapper.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', e => {
            if (!this.isPanning) return;
            this.videoPanX = this.panOrigin.x + (e.clientX - this.panStart.x);
            this.videoPanY = this.panOrigin.y + (e.clientY - this.panStart.y);
            this.applyVideoTransform();
        });

        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                p.videoWrapper.style.cursor = this.videoScale > 1 ? 'grab' : 'default';
            }
        });

        p.videoWrapper.addEventListener('dblclick', e => {
            if (e.target.closest('#controlBar')) return;
            this.resetVideoTransform();
        });
    }

    applyVideoTransform() {
        const p = this.player;
        p.video.style.transform = `translate(${this.videoPanX}px, ${this.videoPanY}px) scale(${this.videoScale})`;
        if (p.videoWrapper) {
            p.videoWrapper.style.cursor = this.videoScale > 1 ? 'grab' : 'default';
        }
    }

    resetVideoTransform() {
        this.videoScale = 1;
        this.videoPanX  = 0;
        this.videoPanY  = 0;
        this.applyVideoTransform();
    }

    // ── Mini Player ───────────────────────────────────────────────────────────

    setupMiniPlayer() {
        const p = this.player;

        p.miniBtn           = document.getElementById('miniBtn');
        p.miniOverlay       = document.getElementById('miniOverlay');
        p.miniExpandBtn     = document.getElementById('miniExpandBtn');
        p.miniCloseBtn      = document.getElementById('miniCloseBtn');
        p.miniPlayPauseBtn  = document.getElementById('miniPlayPauseBtn');
        p.miniProgressPlayed = document.getElementById('miniProgressPlayed');

        if (p.miniBtn)        p.miniBtn.addEventListener('click', () => this.enterMiniPlayer());
        if (p.miniExpandBtn)  p.miniExpandBtn.addEventListener('click', e => { e.stopPropagation(); this.exitMiniPlayer(); });
        if (p.miniCloseBtn) {
            p.miniCloseBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (p.isPlaying) p.pause();
                this.exitMiniPlayer(true);
            });
        }
        if (p.miniPlayPauseBtn) {
            p.miniPlayPauseBtn.addEventListener('click', e => {
                e.stopPropagation();
                p.togglePlayPause();
            });
        }

        p.video.addEventListener('play',  () => this._syncMiniPlayIcon());
        p.video.addEventListener('pause', () => this._syncMiniPlayIcon());

        p.video.addEventListener('timeupdate', () => {
            if (this.isMiniMode && p.miniProgressPlayed && p.video.duration) {
                const pct = (p.video.currentTime / p.video.duration) * 100;
                p.miniProgressPlayed.style.width = `${pct}%`;
            }
        });

        // Drag for mini player
        p.playerContainer.addEventListener('mousedown', e => {
            if (!this.isMiniMode) return;
            if (e.target.closest('.mini-action-btn, .mini-play-btn')) return;
            e.preventDefault();
            const rect = p.playerContainer.getBoundingClientRect();
            p.playerContainer.style.right  = 'auto';
            p.playerContainer.style.bottom = 'auto';
            p.playerContainer.style.left   = rect.left + 'px';
            p.playerContainer.style.top    = rect.top  + 'px';
            this._miniDrag = {
                startX: e.clientX, startY: e.clientY,
                initLeft: rect.left, initTop: rect.top,
            };
        });

        document.addEventListener('mousemove', e => {
            if (!this._miniDrag) return;
            let newLeft = this._miniDrag.initLeft + (e.clientX - this._miniDrag.startX);
            let newTop  = this._miniDrag.initTop  + (e.clientY - this._miniDrag.startY);
            newLeft = Math.max(8, Math.min(window.innerWidth  - 328, newLeft));
            newTop  = Math.max(8, Math.min(window.innerHeight - 188, newTop));
            p.playerContainer.style.left = newLeft + 'px';
            p.playerContainer.style.top  = newTop  + 'px';
        });

        document.addEventListener('mouseup', () => { this._miniDrag = null; });
    }

    enterMiniPlayer() {
        if (this.isMiniMode) return;
        const c = this.player.playerContainer;
        const rect = c.getBoundingClientRect();
        const MINI_W = 320, MINI_H = 180, MARGIN = 24;
        const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)', DUR = '0.42s';

        c.style.position = 'fixed';
        c.style.left     = rect.left + 'px';
        c.style.top      = rect.top  + 'px';
        c.style.width    = rect.width  + 'px';
        c.style.height   = rect.height + 'px';
        c.style.right    = 'auto';
        c.style.bottom   = 'auto';
        c.style.margin   = '0';
        c.style.borderRadius = '0px';
        c.style.zIndex   = '1000';

        c.classList.add('mini-mode');

        if (this.player.homeScreen) this.player.homeScreen.style.display = 'flex';

        void c.offsetWidth;

        const targetLeft = window.innerWidth  - MARGIN - MINI_W;
        const targetTop  = window.innerHeight - MARGIN - MINI_H;

        c.style.transition   = `left ${DUR} ${EASING}, top ${DUR} ${EASING}, width ${DUR} ${EASING}, height ${DUR} ${EASING}, border-radius ${DUR} ease, box-shadow ${DUR} ease`;
        c.style.left         = targetLeft + 'px';
        c.style.top          = targetTop  + 'px';
        c.style.width        = MINI_W + 'px';
        c.style.height       = MINI_H + 'px';
        c.style.borderRadius = '14px';
        c.style.boxShadow    = '0 12px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.1)';

        const onEnd = e => {
            if (e.propertyName !== 'width') return;
            c.removeEventListener('transitionend', onEnd);
            c.style.transition = '';
            c.style.left   = 'auto';
            c.style.top    = 'auto';
            c.style.right  = MARGIN + 'px';
            c.style.bottom = MARGIN + 'px';
            this.isMiniMode = true;
            this._syncMiniPlayIcon();
        };
        c.addEventListener('transitionend', onEnd);
    }

    exitMiniPlayer(goHome = false) {
        const c = this.player.playerContainer;
        const rect = c.getBoundingClientRect();
        const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)', DUR = '0.38s';

        this.isMiniMode = false;

        c.style.transition = '';
        c.style.right  = 'auto';
        c.style.bottom = 'auto';
        c.style.left   = rect.left + 'px';
        c.style.top    = rect.top  + 'px';
        c.style.width  = rect.width  + 'px';
        c.style.height = rect.height + 'px';

        c.classList.remove('mini-mode');
        void c.offsetWidth;

        c.style.transition   = `left ${DUR} ${EASING}, top ${DUR} ${EASING}, width ${DUR} ${EASING}, height ${DUR} ${EASING}, border-radius ${DUR} ease, box-shadow ${DUR} ease`;
        c.style.left         = '0px';
        c.style.top          = '0px';
        c.style.width        = '100vw';
        c.style.height       = '100vh';
        c.style.borderRadius = '0px';
        c.style.boxShadow    = 'none';

        const onEnd = e => {
            if (e.propertyName !== 'width') return;
            c.removeEventListener('transitionend', onEnd);
            c.style.transition = c.style.position = '';
            c.style.left = c.style.top = c.style.right = c.style.bottom = '';
            c.style.width = c.style.height = '';
            c.style.borderRadius = c.style.boxShadow = '';
            c.style.margin = c.style.zIndex = '';

            if (goHome) {
                c.style.display = 'none';
                if (this.player.homeScreen) {
                    this.player.homeScreen.classList.remove('home-animate');
                    if (this.player.library) this.player.library.render();
                }
            } else {
                if (this.player.homeScreen) this.player.homeScreen.style.display = 'none';
            }
        };
        c.addEventListener('transitionend', onEnd);
    }

    _syncMiniPlayIcon() {
        const p = this.player;
        if (!p.miniPlayPauseBtn) return;
        const playIcon  = p.miniPlayPauseBtn.querySelector('.play-icon');
        const pauseIcon = p.miniPlayPauseBtn.querySelector('.pause-icon');
        if (p.video.paused) {
            playIcon  && playIcon.classList.remove('hidden');
            pauseIcon && pauseIcon.classList.add('hidden');
        } else {
            playIcon  && playIcon.classList.add('hidden');
            pauseIcon && pauseIcon.classList.remove('hidden');
        }
    }

    // ── Frame Preview ─────────────────────────────────────────────────────────

    setupFramePreview() {
        const p = this.player;
        if (!p.previewVideo || !p.previewCanvas) return;
        this.previewCtx = p.previewCanvas.getContext('2d');

        p.previewVideo.addEventListener('seeked', () => {
            if (!this.previewCtx) return;
            this.previewCtx.drawImage(p.previewVideo, 0, 0, p.previewCanvas.width, p.previewCanvas.height);
        });
    }

    seekPreviewFrame(time) {
        const p = this.player;
        if (!p.previewVideo || !p.video.src) return;

        const now = Date.now();
        if (now - this.previewLastSeek < 150) return;
        this.previewLastSeek = now;

        if (p.previewVideo.src !== p.video.src) {
            p.previewVideo.src = p.video.src;
            p.previewVideo.load();
        }
        p.previewVideo.currentTime = time;
    }

    // ── Drag & Drop ───────────────────────────────────────────────────────────

    setupDragDrop() {
        let dragCounter = 0;

        window.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); });

        window.addEventListener('dragenter', e => {
            e.preventDefault(); e.stopPropagation();
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                this.showDropOverlay();
            }
        });

        window.addEventListener('dragleave', e => {
            e.preventDefault(); e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) { dragCounter = 0; this.hideDropOverlay(); }
        });

        window.addEventListener('drop', e => {
            e.preventDefault(); e.stopPropagation();
            dragCounter = 0;
            this.hideDropOverlay();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (VIDEO_EXT_REGEX.test(file.name) && file.path) {
                    this.player.playlist.loadVideoFile(file.path);
                }
            }
        });
    }

    showDropOverlay() {
        if (this.player.dropOverlay) this.player.dropOverlay.classList.remove('hidden');
    }

    hideDropOverlay() {
        if (this.player.dropOverlay) this.player.dropOverlay.classList.add('hidden');
    }

    // ── Context Menu ──────────────────────────────────────────────────────────

    setupContextMenu() {
        const p = this.player;

        p.playerContainer.addEventListener('contextmenu', e => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        const ctxCopy = document.getElementById('ctxCopyTimestamp');
        if (ctxCopy) {
            ctxCopy.addEventListener('click', () => {
                window.vlApi.writeText(formatTime(p.video.currentTime || 0));
                this.hideContextMenu();
            });
        }

        const ctxExplorer = document.getElementById('ctxOpenInExplorer');
        if (ctxExplorer) {
            ctxExplorer.addEventListener('click', () => {
                if (p.currentVideoPath) window.vlApi.showItemInFolder(p.currentVideoPath);
                this.hideContextMenu();
            });
        }

        document.addEventListener('click', e => {
            if (p.contextMenu && !p.contextMenu.classList.contains('hidden') &&
                !p.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showContextMenu(x, y) {
        const p = this.player;
        if (!p.contextMenu) return;
        p.contextMenu.classList.remove('hidden');

        const menuW = 200, menuH = 80;
        const left  = Math.min(x, window.innerWidth  - menuW - 8);
        const top   = Math.min(y, window.innerHeight - menuH - 8);
        p.contextMenu.style.left = `${left}px`;
        p.contextMenu.style.top  = `${top}px`;

        const ctxExplorer = document.getElementById('ctxOpenInExplorer');
        if (ctxExplorer) {
            const noFile = !p.currentVideoPath;
            ctxExplorer.style.opacity      = noFile ? '0.35' : '1';
            ctxExplorer.style.pointerEvents = noFile ? 'none' : 'auto';
        }
    }

    hideContextMenu() {
        if (this.player.contextMenu) this.player.contextMenu.classList.add('hidden');
    }

    // ── Home Button ───────────────────────────────────────────────────────────

    setupHomeButton() {
        const p = this.player;
        if (!p.homeBtn) return;
        p.homeBtn.addEventListener('click', e => {
            e.stopPropagation();
            this.returnToHome();
        });
    }

    returnToHome() {
        const p = this.player;
        if (this.isMiniMode) {
            this.exitMiniPlayer(true);
            if (p.isPlaying) p.pause();
            return;
        }
        if (p.isPlaying) p.pause();
        p.playerContainer.style.display = 'none';
        if (p.homeScreen) {
            p.homeScreen.style.display = 'flex';
            p.homeScreen.classList.remove('home-animate');
            void p.homeScreen.offsetWidth;
            p.homeScreen.classList.add('home-animate');
            if (p.library) p.library.render();
        }
    }
}
