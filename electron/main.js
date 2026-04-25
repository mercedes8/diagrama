const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

function createWindow() {
  const indexPath = path.join(app.getAppPath(), "dist", "index.html");
  if (!isDev && !fs.existsSync(indexPath)) {
    console.error("Error: index.html no encontrado en la ruta:", indexPath);
    app.quit();
    return;
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Cronograma Mensual de Francos",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(indexPath);
  }
  // Abrir links externos en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  try {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error("Error al crear la ventana:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
