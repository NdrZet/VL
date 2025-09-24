const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Разрешаем загрузку локальных файлов
        },
        titleBarStyle: 'default',
        icon: path.join(__dirname, 'icon.ico') // Добавьте иконку если нужно
    });

    // Загружаем index.html
    mainWindow.loadFile('index.html');

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