const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

let splashWin = null
let mainWin = null

function createSplash() {
  splashWin = new BrowserWindow({
    width: 520,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    splashWin.loadURL('http://localhost:5173/splash.html')
  } else {
    splashWin.loadFile(path.join(__dirname, '../dist/splash.html'))
  }
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lanime',
    frame: false,
    show: false,
    icon: path.join(__dirname, '../public/icon-256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWin.loadURL('http://localhost:5173')
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// 窗口控制 IPC
ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
})
ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
})

app.whenReady().then(() => {
  createMainWindow()
  createSplash()

  setTimeout(() => {
    if (mainWin) {
      mainWin.show()
      mainWin.focus()
    }
    if (splashWin) {
      splashWin.close()
      splashWin = null
    }
  }, 5500)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
    createSplash()
    setTimeout(() => {
      if (mainWin) mainWin.show()
      if (splashWin) { splashWin.close(); splashWin = null }
    }, 5500)
  }
})
