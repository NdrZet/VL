const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow;
let videoFilePath = null;

function createWindow() {
    // Создаем главное окно приложения
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../app.asar.unpacked/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false // Разрешаем загрузку локальных файлов
        },
        titleBarStyle: 'default',
        icon: path.join(__dirname, 'favicon.ico') // Добавьте иконку если нужно
    });

    mainWindow.setMenuBarVisibility(false);

    // Загружаем index.html (loadFile требует прямые слеши, иначе ERR_FAILED на Windows)
    const indexPath = path.join(__dirname, 'index.html').replace(/\\/g, '/');
    mainWindow.loadFile(indexPath);

    // Открываем DevTools в режиме разработки
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Обработчик закрытия окна
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Когда страница загружена, отправляем путь к видео если есть
    mainWindow.webContents.once('did-finish-load', () => {
        if (videoFilePath) {
            mainWindow.webContents.send('load-video', videoFilePath);
        }
    });
}

// Обработка аргументов командной строки
function handleCommandLineArgs() {
    const args = process.argv.slice(1);
    
    // Ищем видеофайл среди аргументов
    for (const arg of args) {
        if (isVideoFile(arg) && fs.existsSync(arg)) {
            videoFilePath = path.resolve(arg);
            break;
        }
    }
}

// Проверяем, является ли файл видеофайлом
function isVideoFile(filePath) {
    const videoExtensions = [
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', 
        '.webm', '.m4v', '.3gp', '.ogv', '.ts', '.mts'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return videoExtensions.includes(ext);
}

// Готовность приложения
app.whenReady().then(() => {
    handleCommandLineArgs();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Закрытие всех окон
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Обработка открытия файла через ассоциацию (Windows)
app.on('open-file', (event, filePath) => {
    event.preventDefault();
    
    if (isVideoFile(filePath)) {
        videoFilePath = filePath;
        
        if (mainWindow) {
            mainWindow.webContents.send('load-video', videoFilePath);
        } else {
            createWindow();
        }
    }
});

// Обработка второго экземпляра приложения (Windows)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Обрабатываем аргументы второго экземпляра
        const args = commandLine.slice(1);
        
        for (const arg of args) {
            if (isVideoFile(arg) && fs.existsSync(arg)) {
                videoFilePath = path.resolve(arg);
                break;
            }
        }
        
        // Показываем окно и загружаем видео
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            
            if (videoFilePath) {
                mainWindow.webContents.send('load-video', videoFilePath);
            }
        }
    });
}

// IPC обработчики для общения с renderer процессом
ipcMain.handle('get-video-path', () => {
    return videoFilePath;
});

// Обработчик для получения информации о видео
ipcMain.handle('get-video-info', (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            name: path.basename(filePath),
            size: stats.size,
            path: filePath,
            exists: true
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
});

// Диалог выбора файла (субтитры, и др.)
ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

// Диалог выбора папки (для библиотеки)
ipcMain.handle('show-directory-dialog', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select folder to add to library',
        properties: ['openDirectory']
    });
    return result;
});

// Получение списка видеофайлов в директории (для плейлиста)
ipcMain.handle('get-directory-files', (event, dirPath) => {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv',
        '.webm', '.m4v', '.3gp', '.ogv', '.ts', '.mts'];
    try {
        const files = fs.readdirSync(dirPath)
            .filter(f => videoExtensions.includes(path.extname(f).toLowerCase()))
            .map(f => path.join(dirPath, f))
            .sort();
        return files;
    } catch (error) {
        return [];
    }
});

// ── Встроенный парсер MKV/EBML (без внешних зависимостей) ──────────────────
function parseMkvAudioTracks(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(5 * 1024 * 1024); // первые 5 МБ — там всегда заголовок
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const data = buf.slice(0, bytesRead);

        // Проверка сигнатуры EBML
        if (bytesRead < 4 || data.readUInt32BE(0) !== 0x1A45DFA3) return [];

        // Чтение VINT (variable-length integer) — размеры элементов
        function readVint(pos) {
            const b = data[pos]; let len = 1, mask = 0x80;
            while (len < 8 && !(b & mask)) { len++; mask >>= 1; }
            let val = b & (mask - 1);
            for (let i = 1; i < len; i++) val = val * 256 + (data[pos + i] || 0);
            return { value: val, len };
        }

        // Чтение ID элемента (leading bits сохраняются)
        function readId(pos) {
            const b = data[pos]; let len = 1, mask = 0x80;
            while (len <= 4 && !(b & mask)) { len++; mask >>= 1; }
            let id = 0;
            for (let i = 0; i < len; i++) id = id * 256 + (data[pos + i] || 0);
            return { id, len };
        }

        function readStr(pos, size) {
            return data.slice(pos, pos + size).toString('utf8').replace(/\0/g, '').trim();
        }
        function readInt(pos, size) {
            let v = 0;
            for (let i = 0; i < size && i < 4; i++) v = v * 256 + (data[pos + i] || 0);
            return v;
        }

        // Пропускаем EBML header → ищем Segment (0x18538067)
        let pos = 0;
        { const id = readId(pos); pos += id.len; }
        { const sz = readVint(pos); pos += sz.len + sz.value; }

        // Segment
        const segId = readId(pos);
        if (segId.id !== 0x18538067) return [];
        pos += segId.len;
        const segSz = readVint(pos);
        pos += segSz.len;
        const segEnd = Math.min(pos + segSz.value, data.length);

        // Ищем Tracks (0x1654AE6B) внутри Segment
        // Некоторые элементы (Cluster, Cues) могут быть огромными — пропускаем безопасно
        const SKIP_IDS = new Set([0x1F43B675, 0x1C53BB6B, 0x1941A469]); // Cluster, Cues, Tags
        let tracksPos = -1, tracksEnd = -1;
        let cur = pos;
        while (cur < segEnd - 8) {
            const el = readId(cur); cur += el.len;
            const sz = readVint(cur); cur += sz.len;
            if (el.id === 0x1654AE6B) { tracksPos = cur; tracksEnd = Math.min(cur + sz.value, segEnd); break; }
            // Если размер неизвестен или огромный — выходим (дальше только кластеры)
            if (sz.value === 0 || sz.value > 10 * 1024 * 1024) break;
            cur += sz.value;
        }
        if (tracksPos < 0) return [];

        // Парсим TrackEntry (0xAE) элементы
        const tracks = [];
        let audioIdx = 0;
        cur = tracksPos;
        while (cur < tracksEnd - 4) {
            const el = readId(cur); cur += el.len;
            const sz = readVint(cur); cur += sz.len;
            const elEnd = cur + sz.value;
            if (el.id !== 0xAE) { cur = elEnd; continue; } // не TrackEntry

            let trackType = 0, name = '', lang = '', codec = '';
            let fpos = cur;
            while (fpos < elEnd - 2) {
                const fid = readId(fpos); fpos += fid.len;
                const fsz = readVint(fpos); fpos += fsz.len;
                const fend = fpos + fsz.value;
                if      (fid.id === 0x83)     trackType = readInt(fpos, fsz.value);
                else if (fid.id === 0x536E)   name      = readStr(fpos, fsz.value);
                else if (fid.id === 0x22B59C || fid.id === 0x22B59D) lang = readStr(fpos, fsz.value);
                else if (fid.id === 0x86)     codec     = readStr(fpos, fsz.value);
                if (fend > elEnd) break;
                fpos = fsz.value === 0 ? fpos + 1 : fend; // защита от бесконечного цикла
            }

            if (trackType === 2) { // 2 = Audio
                const parts = [];
                if (name) parts.push(name);
                if (lang && lang !== 'und') parts.push(lang.toUpperCase());
                if (!parts.length) parts.push(`Track ${audioIdx + 1}`);
                if (codec) parts.push(codec.replace('A_', ''));
                tracks.push({ index: audioIdx++, label: parts.join(' — '), language: lang, codec });
            }
            cur = elEnd;
        }
        return tracks;
    } catch { return []; }
}

// ── Поиск ffprobe в нескольких местах ──────────────────────────────────────
function findAndRunFfprobe(filePath) {
    const { spawnSync } = require('child_process');
    const candidates = [
        'ffprobe',
        'C:\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\Program Files (x86)\\ffmpeg\\bin\\ffprobe.exe',
        path.join(__dirname, 'ffprobe.exe'),
        path.join(__dirname, 'ffmpeg', 'bin', 'ffprobe.exe'),
    ];
    const args = ['-v','quiet','-print_format','json','-show_streams','-select_streams','a', filePath];

    for (const cmd of candidates) {
        try {
            const r = spawnSync(cmd, args, { windowsHide: true, timeout: 8000, encoding: 'utf8' });
            if (r.status === 0 && r.stdout) {
                const parsed = JSON.parse(r.stdout);
                return (parsed.streams || []).map((s, i) => {
                    const tags = s.tags || {};
                    const parts = [];
                    if (tags.title)    parts.push(tags.title);
                    if (tags.language && tags.language !== 'und') parts.push(tags.language.toUpperCase());
                    if (!parts.length) parts.push(`Track ${i + 1}`);
                    if (s.codec_name)  parts.push(s.codec_name.toUpperCase());
                    return { index: i, label: parts.join(' — '), language: tags.language || '', codec: s.codec_name || '', channels: s.channels || 2 };
                });
            }
        } catch { /* продолжаем */ }
    }
    return null;
}

// ── Поиск ffmpeg (для транскодирования AC3 и др.) ───────────────────────────
function findFfmpeg() {
    const { spawnSync } = require('child_process');
    const candidates = [
        'ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
        path.join(__dirname, 'ffmpeg.exe'),
        path.join(__dirname, 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ];
    for (const cmd of candidates) {
        try {
            const r = spawnSync(cmd, ['-version'], { windowsHide: true, timeout: 3000 });
            if (r.status === 0) return cmd;
        } catch {}
    }
    return null;
}

// IPC: транскодировать аудиодорожку в MP3/AAC через ffmpeg (для AC3/DTS)
ipcMain.handle('extract-audio-track', async (event, { filePath, trackIndex }) => {
    const ffmpegPath = findFfmpeg();
    if (!ffmpegPath) return { success: false, reason: 'ffmpeg not found' };

    const os = require('os');
    const { spawn } = require('child_process');
    const tempBase = path.join(os.tmpdir(), `vl_audio_${Date.now()}_t${trackIndex}`);

    // Пробуем MP3, если не вышло — AAC
    const attempts = [
        { outPath: tempBase + '.mp3', args: ['-c:a', 'libmp3lame', '-b:a', '192k'] },
        { outPath: tempBase + '.m4a', args: ['-c:a', 'aac',        '-b:a', '192k'] },
    ];

    for (const { outPath, args } of attempts) {
        const ok = await new Promise((resolve) => {
            const proc = spawn(ffmpegPath, [
                '-y', '-i', filePath,
                '-map', `0:a:${trackIndex}`,
                '-vn', ...args, outPath
            ], { windowsHide: true });
            proc.on('close', code => resolve(code === 0 && fs.existsSync(outPath)));
            proc.on('error', () => resolve(false));
        });
        if (ok) return { success: true, tempPath: outPath };
    }
    return { success: false, reason: 'transcoding failed' };
});

// IPC: удалить временный аудиофайл
ipcMain.handle('cleanup-temp-audio', (event, filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
    } catch { return false; }
});

// ── IPC: получить аудиодорожки (ffprobe → встроенный MKV-парсер) ──────────
ipcMain.handle('get-audio-tracks-ffprobe', (event, filePath) => {
    // 1. Пробуем ffprobe
    const ffprobeTracks = findAndRunFfprobe(filePath);
    if (ffprobeTracks && ffprobeTracks.length > 0) {
        return { available: true, method: 'ffprobe', tracks: ffprobeTracks };
    }

    // 2. Встроенный парсер для MKV/WebM
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mkv' || ext === '.webm' || ext === '.mka') {
        const mkvTracks = parseMkvAudioTracks(filePath);
        if (mkvTracks.length > 0) {
            return { available: true, method: 'mkv-parser', tracks: mkvTracks };
        }
    }

    return { available: false, method: 'none', tracks: [] };
});

// ── Watch Statistics ────────────────────────────────────────────────────────

const statsPath = path.join(app.getPath('userData'), 'watch-stats.json');

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    } catch {
        return { totalSeconds: 0, daily: {}, files: {}, firstWatchDate: null, lastWatchDate: null };
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch {}
}

ipcMain.handle('start-watch-session', (event, filePath) => {
    const stats = loadStats();
    const today = new Date().toISOString().slice(0, 10);
    if (!stats.files[filePath]) {
        stats.files[filePath] = { totalSeconds: 0, sessions: 0, lastWatched: null };
    }
    stats.files[filePath].sessions += 1;
    stats.files[filePath].lastWatched = new Date().toISOString();
    if (!stats.firstWatchDate) stats.firstWatchDate = today;
    stats.lastWatchDate = today;
    saveStats(stats);
});

ipcMain.handle('track-watch-time', (event, { filePath, seconds }) => {
    const stats = loadStats();
    const today = new Date().toISOString().slice(0, 10);
    stats.totalSeconds = (stats.totalSeconds || 0) + seconds;
    stats.daily[today] = (stats.daily[today] || 0) + seconds;
    if (!stats.files[filePath]) {
        stats.files[filePath] = { totalSeconds: 0, sessions: 0, lastWatched: null };
    }
    stats.files[filePath].totalSeconds += seconds;
    stats.files[filePath].lastWatched = new Date().toISOString();
    if (!stats.firstWatchDate) stats.firstWatchDate = today;
    stats.lastWatchDate = today;
    saveStats(stats);
});

ipcMain.handle('get-watch-stats', () => {
    return loadStats();
});

// ── Watch Together ──────────────────────────────────────────────────────────

const { WebSocket } = require('ws');
const os = require('os');

let wtServer = null;
let wtServerClients = new Map(); // id -> ws
let wtClient = null;
let wtClientId = generateId();

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function broadcastToClients(data, excludeId = null) {
    const payload = JSON.stringify(data);
    wtServerClients.forEach((ws, id) => {
        if (id !== excludeId && ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}

async function getPublicIp() {
    try {
        const res = await require('https').get('https://api.ipify.org?format=json', (r) => {
            let data = '';
            r.on('data', chunk => data += chunk);
            r.on('end', () => { getPublicIp._cached = JSON.parse(data).ip; });
        });
        res.on('error', () => {});
    } catch {}
    return getPublicIp._cached || null;
}

ipcMain.handle('wt-create-room', async (event, preferredPort = 0) => {
    if (wtServer) {
        return { success: false, error: 'Room already active' };
    }
    try {
        const portNum = preferredPort ? parseInt(preferredPort, 10) : 0;
        wtServer = new WebSocket.Server({ port: portNum });
        const port = wtServer.address().port;
        const publicIp = await getPublicIp();

        wtServer.on('connection', (ws) => {
            const clientId = generateId();
            wtServerClients.set(clientId, ws);

            // Notify renderer about new peer
            if (mainWindow) {
                mainWindow.webContents.send('wt-peer-joined', { clientId });
            }

            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw);
                    // Broadcast to other clients and to host renderer
                    broadcastToClients({ ...msg, _from: clientId }, clientId);
                    if (mainWindow) {
                        mainWindow.webContents.send('wt-message', { ...msg, _from: clientId });
                    }
                } catch {}
            });

            ws.on('close', () => {
                wtServerClients.delete(clientId);
                if (mainWindow) {
                    mainWindow.webContents.send('wt-peer-left', { clientId });
                }
            });

            ws.on('error', () => {
                wtServerClients.delete(clientId);
            });
        });

        wtServer.on('error', (err) => {
            if (mainWindow) {
                mainWindow.webContents.send('wt-status', { type: 'error', message: err.message });
            }
        });

        return { success: true, port, hostIp: getLocalIp(), publicIp };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('wt-close-room', () => {
    if (wtServer) {
        wtServerClients.forEach(ws => ws.close());
        wtServerClients.clear();
        wtServer.close();
        wtServer = null;
    }
    return true;
});

ipcMain.handle('wt-join-room', async (event, address) => {
    if (wtClient) {
        return { success: false, error: 'Already connected' };
    }
    return new Promise((resolve) => {
        try {
            const url = address.startsWith('ws://') ? address : `ws://${address}`;
            wtClient = new WebSocket(url);

            wtClient.on('open', () => {
                if (mainWindow) {
                    mainWindow.webContents.send('wt-status', { type: 'connected' });
                }
                resolve({ success: true });
            });

            wtClient.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw);
                    if (mainWindow) {
                        mainWindow.webContents.send('wt-message', msg);
                    }
                } catch {}
            });

            wtClient.on('close', () => {
                wtClient = null;
                if (mainWindow) {
                    mainWindow.webContents.send('wt-status', { type: 'disconnected' });
                }
            });

            wtClient.on('error', (err) => {
                wtClient = null;
                if (mainWindow) {
                    mainWindow.webContents.send('wt-status', { type: 'error', message: err.message });
                }
                resolve({ success: false, error: err.message });
            });
        } catch (err) {
            wtClient = null;
            resolve({ success: false, error: err.message });
        }
    });
});

ipcMain.handle('wt-leave-room', () => {
    if (wtClient) {
        wtClient.close();
        wtClient = null;
    }
    return true;
});

ipcMain.handle('wt-send', (event, data) => {
    const payload = JSON.stringify(data);
    if (wtClient && wtClient.readyState === WebSocket.OPEN) {
        wtClient.send(payload);
        return true;
    }
    // If we are host, broadcast to all connected clients
    if (wtServer) {
        broadcastToClients(data);
        return true;
    }
    return false;
});
