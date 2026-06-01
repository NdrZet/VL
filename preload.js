const { contextBridge, ipcRenderer, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('vlApi', {
    // IPC
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
        const wrapper = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, wrapper);
        return () => ipcRenderer.removeListener(channel, wrapper);
    },

    // Shell & Clipboard
    showItemInFolder: (fullPath) => shell.showItemInFolder(fullPath),
    writeText: (text) => clipboard.writeText(text),

    // FS wrappers (returns serializable data)
    readFileSync: (filePath, encoding = 'utf-8') => fs.readFileSync(filePath, encoding),
    existsSync: (filePath) => fs.existsSync(filePath),
    statSync: (filePath) => {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
        };
    },
    readdirSync: (dirPath) => {
        return fs.readdirSync(dirPath, { withFileTypes: true }).map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
        }));
    },

    // Path wrappers
    pathBasename: (p, ext) => path.basename(p, ext),
    pathExtname: (p) => path.extname(p),
    pathJoin: (...args) => path.join(...args),
    pathResolve: (p) => path.resolve(p),
    pathDirname: (p) => path.dirname(p),

    // Watch statistics
    startWatchSession: (filePath) => ipcRenderer.invoke('start-watch-session', filePath),
    trackWatchTime: (filePath, seconds) => ipcRenderer.invoke('track-watch-time', { filePath, seconds }),
    getWatchStats: () => ipcRenderer.invoke('get-watch-stats'),
});
