const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: false, // 보안을 위해 false
            contextIsolation: true, // 보안을 위해 true
        },
        icon: path.join(__dirname, 'docs/favicon.ico') // 아이콘이 있다면 설정
    });

    // docs/index.html 파일을 로드합니다.
    win.loadFile(path.join(__dirname, 'docs/index.html'));

    // 개발자 도구 열기 (선택 사항)
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
