// ─── WatchTogether ────────────────────────────────────────────────────────────
// Handles: WebSocket room creation (host) and joining (client),
//          video state synchronization over network,
//          UI panel management, peer list.

class WatchTogether {
    /**
     * @param {VisionLumina} player
     */
    constructor(player) {
        this.player = player;

        // DOM refs (assigned in setup())
        this.panel                  = null;
        this.createBtn              = null;
        this.portInput              = null;
        this.hostInfo               = null;
        this.hostAddress            = null;
        this.publicAddressSection   = null;
        this.publicAddress          = null;
        this.copyAddressBtn         = null;
        this.closeRoomBtn           = null;
        this.joinBtn                = null;
        this.leaveBtn               = null;
        this.joinInput              = null;
        this.statusDot              = null;
        this.statusText             = null;
        this.peersList              = null;

        this._peers            = new Set();
        this._isRemoteUpdate   = false;
        this._syncTimer        = null;

        // IPC unsubscribe functions
        this._unsubMessage    = null;
        this._unsubStatus     = null;
        this._unsubPeerJoined = null;
        this._unsubPeerLeft   = null;
    }

    setup() {
        this.panel                = document.getElementById('watchTogetherPanel');
        this.createBtn            = document.getElementById('wtCreateBtn');
        this.portInput            = document.getElementById('wtPortInput');
        this.hostInfo             = document.getElementById('wtHostInfo');
        this.hostAddress          = document.getElementById('wtHostAddress');
        this.publicAddressSection = document.getElementById('wtPublicAddressSection');
        this.publicAddress        = document.getElementById('wtPublicAddress');
        this.copyAddressBtn       = document.getElementById('wtCopyAddressBtn');
        this.closeRoomBtn         = document.getElementById('wtCloseRoomBtn');
        this.joinBtn              = document.getElementById('wtJoinBtn');
        this.leaveBtn             = document.getElementById('wtLeaveBtn');
        this.joinInput            = document.getElementById('wtJoinInput');
        this.statusDot            = document.getElementById('wtStatusDot');
        this.statusText           = document.getElementById('wtStatusText');
        this.peersList            = document.getElementById('wtPeersList');

        // Toggle panel button
        const toggleBtn = this.player.watchTogetherBtn;
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.togglePanel());
        }

        if (this.createBtn)    this.createBtn.addEventListener('click', () => this.createRoom());
        if (this.closeRoomBtn) this.closeRoomBtn.addEventListener('click', () => this.closeRoom());
        if (this.copyAddressBtn) {
            this.copyAddressBtn.addEventListener('click', () => {
                const addr = this.publicAddress.textContent !== '—'
                    ? this.publicAddress.textContent
                    : this.hostAddress.textContent;
                if (addr && addr !== '—') window.vlApi.writeText(addr);
            });
        }
        if (this.joinBtn)  this.joinBtn.addEventListener('click', () => this.joinRoom());
        if (this.leaveBtn) this.leaveBtn.addEventListener('click', () => this.leaveRoom());

        // IPC event listeners
        this._unsubMessage    = window.vlApi.onWtMessage(msg => this.onMessage(msg));
        this._unsubStatus     = window.vlApi.onWtStatus(status => this.onStatus(status));
        this._unsubPeerJoined = window.vlApi.onWtPeerJoined(data => {
            this._peers.add(data.clientId);
            this.updatePeersUI();
        });
        this._unsubPeerLeft = window.vlApi.onWtPeerLeft(data => {
            this._peers.delete(data.clientId);
            this.updatePeersUI();
        });

        // Bind video events -> send to network
        this._bindVideoEvents();
    }

    // ── Panel ────────────────────────────────────────────────────────────────

    togglePanel() {
        if (!this.panel) return;
        const isHidden = this.panel.classList.contains('hidden');
        if (isHidden && this.player.settingsOpen) {
            this.player.ui.closeAllMenus();
        }
        this.panel.classList.toggle('hidden', !isHidden);
    }

    closePanel() {
        if (this.panel) this.panel.classList.add('hidden');
    }

    // ── Room Management ──────────────────────────────────────────────────────

    async createRoom() {
        const port   = this.portInput.value.trim();
        const result = await window.vlApi.wtCreateRoom(port || 0);
        if (result.success) {
            this.hostAddress.textContent = `${result.hostIp}:${result.port}`;
            if (result.publicIp) {
                this.publicAddress.textContent = `${result.publicIp}:${result.port}`;
                this.publicAddressSection.classList.remove('hidden');
            }
            this.hostInfo.classList.remove('hidden');
            this.createBtn.classList.add('hidden');
            this.portInput.classList.add('hidden');
            this.setStatus('host', window.VLi18n ? window.VLi18n.t('wt.status_host') : 'Hosting');
            this._startSyncTimer();
        } else {
            this.setStatus('error', result.error);
        }
    }

    async closeRoom() {
        await window.vlApi.wtCloseRoom();
        this.hostInfo.classList.add('hidden');
        this.publicAddressSection.classList.add('hidden');
        this.createBtn.classList.remove('hidden');
        this.portInput.classList.remove('hidden');
        this.hostAddress.textContent   = '—';
        this.publicAddress.textContent = '—';
        this._peers.clear();
        this.updatePeersUI();
        this.setStatus('disconnected');
        this._stopSyncTimer();
    }

    async joinRoom() {
        const address = this.joinInput.value.trim();
        if (!address) return;
        const result = await window.vlApi.wtJoinRoom(address);
        if (result.success) {
            this.joinBtn.classList.add('hidden');
            this.leaveBtn.classList.remove('hidden');
            this.joinInput.disabled = true;
            this.setStatus('connected', window.VLi18n ? window.VLi18n.t('wt.status_connected') : 'Connected');
            this._startSyncTimer();
        } else {
            this.setStatus('error', result.error);
        }
    }

    async leaveRoom() {
        await window.vlApi.wtLeaveRoom();
        this.joinBtn.classList.remove('hidden');
        this.leaveBtn.classList.add('hidden');
        this.joinInput.disabled = false;
        this.joinInput.value    = '';
        this._peers.clear();
        this.updatePeersUI();
        this.setStatus('disconnected');
        this._stopSyncTimer();
    }

    // ── UI Updates ───────────────────────────────────────────────────────────

    setStatus(type, text) {
        const colors = {
            disconnected: '#666',
            connected:    '#22c55e',
            host:         '#6366f1',
            error:        '#ef4444'
        };
        if (this.statusDot)  this.statusDot.style.background = colors[type] || '#666';
        if (this.statusText) {
            this.statusText.textContent = text || (window.VLi18n ? window.VLi18n.t('wt.disconnected') : 'Disconnected');
        }
    }

    updatePeersUI() {
        if (!this.peersList) return;
        const count = this._peers.size;
        if (count === 0) {
            this.peersList.textContent = window.VLi18n ? window.VLi18n.t('wt.no_peers') : 'No peers';
        } else {
            this.peersList.textContent =
                (window.VLi18n ? window.VLi18n.t('wt.peers', { n: count }) : `${count} peers`) +
                `: ${Array.from(this._peers).map(id => id.slice(0, 4)).join(', ')}`;
        }
    }

    // ── Message Handling ─────────────────────────────────────────────────────

    onMessage(msg) {
        if (!msg || msg.type !== 'state') return;
        this._isRemoteUpdate = true;
        try {
            const { action, time } = msg;
            const threshold = 0.5;
            switch (action) {
                case 'play':
                    if (this.player.video.paused) this.player.video.play();
                    break;
                case 'pause':
                    if (!this.player.video.paused) this.player.video.pause();
                    break;
                case 'seek':
                case 'sync':
                    if (time !== undefined && Math.abs(this.player.video.currentTime - time) > threshold) {
                        this.player.video.currentTime = time;
                    }
                    if (action === 'sync' && msg.playing !== undefined) {
                        if (msg.playing && this.player.video.paused)  this.player.video.play();
                        else if (!msg.playing && !this.player.video.paused) this.player.video.pause();
                    }
                    break;
            }
        } finally {
            this._isRemoteUpdate = false;
        }
    }

    onStatus(status) {
        if (!status) return;
        if (status.type === 'disconnected') {
            this.setStatus('disconnected');
            this._stopSyncTimer();
            this._peers.clear();
            this.updatePeersUI();
            if (!this.joinBtn.classList.contains('hidden')) {
                this.joinBtn.classList.remove('hidden');
                this.leaveBtn.classList.add('hidden');
                this.joinInput.disabled = false;
            }
        } else if (status.type === 'error') {
            this.setStatus('error', status.message);
        }
    }

    // ── Video Event Binding ───────────────────────────────────────────────────

    _bindVideoEvents() {
        const sendState = (action, time) => {
            if (this._isRemoteUpdate) return;
            window.vlApi.wtSend({ type: 'state', action, time: time ?? this.player.video.currentTime }).catch(() => {});
        };

        this.player.video.addEventListener('play',   () => sendState('play'));
        this.player.video.addEventListener('pause',  () => sendState('pause'));
        this.player.video.addEventListener('seeked', () => sendState('seek', this.player.video.currentTime));
    }

    _startSyncTimer() {
        this._stopSyncTimer();
        this._syncTimer = setInterval(() => {
            if (!this.player.video.paused) {
                window.vlApi.wtSend({
                    type:    'state',
                    action:  'sync',
                    time:    this.player.video.currentTime,
                    playing: !this.player.video.paused
                }).catch(() => {});
            }
        }, 2000);
    }

    _stopSyncTimer() {
        if (this._syncTimer) {
            clearInterval(this._syncTimer);
            this._syncTimer = null;
        }
    }
}
