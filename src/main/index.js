const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const url = require("url");

// Import centralized configuration
const { createConfig } = require("../config");

// Helper function to create proper file URLs
function pathToFileURL(filePath) {
  const formattedPath = path.resolve(filePath).replace(/\\/g, '/');
  return `file:///${formattedPath}`;
}

// If not on windows, disable RPC
let DiscordRPC;
if (process.platform == "win32") {
  DiscordRPC = require('discord-rpc');
}
let win;
let pluginName;
const isDev = !app.isPackaged;

// Create configuration with proper isDev detection
const config = createConfig(isDev);

let rendererPath, preloadPath;
if(isDev) {
  rendererPath = path.resolve(path.join(__dirname, '../renderer'));
  preloadPath = path.resolve(path.join(rendererPath, 'preload.js'));
} else {
  rendererPath = path.join(path.dirname(app.getAppPath()), 'src', 'renderer');
  preloadPath = path.join(rendererPath, 'preload.js');
}
switch (process.platform) {
  case "win32":
    pluginName = process.arch == 'x64' ? 'x64/pepflashplayer.dll' : 'x32/pepflashplayer32.dll';
    break;
  // If linux, use libpepflashplayer.so
  case "linux":
    pluginName = process.arch == 'x64' ? 'x64/libpepflashplayer.so' : 'x32/libpepflashplayer.so';
    break;
  // If macOS, use PepperFlashPlayer.plugin
  case "darwin":
    pluginName = 'PepperFlashPlayer.plugin';
    break;  
  default:
    pluginName = 'x64/pepflashplayer.dll';
    break;
}

let flashpath;
if(isDev){
  flashpath = path.join(__dirname ,"../..", "plugins", pluginName);
} else {
  flashpath = path.join(path.dirname(app.getAppPath()), 'plugins', pluginName);
}
// This is necessary because there is something wrong with Linux that prevents flash from running when a sandbox is present.
if (process.platform === "linux") app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("ppapi-flash-path", flashpath);
app.commandLine.appendSwitch("ppapi-flash-version", "32.0.0.371");
// I do not know why this exists or what this does.
app.commandLine.appendSwitch('disable-site-isolation-trials')
function createWindow() {
  win = new BrowserWindow({
    // Disable the titlebar for Windows XP theme.
    backgroundColor: "#32103C",
    frame:false,
    minWidth:640,
    minHeight: 320,
    show: false, // Initially hide the new window
    webPreferences: {
      // Improve security by disabling remote module
      enableRemoteModule: false, // Disable remote module
      nodeIntegration: false,  // Disable node integration
      contextIsolation: true, // Enable context isolation
      preload: preloadPath, // Use the verified absolute path
      devTools: isDev,
      // Must be enabled to allow flash to run.
      plugins: true,
    },
    
  }
  );
  macosMenu = [
    {
      label: app.name,
      submenu: [
        {
          label: "About " + app.name,
          role: "about"
        },
        {
          type: "separator"
        },
        {
          label: "Quit",
          role: "quit"
        }
      ]
    },
    // Add edit menu for macOS
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          role: "undo"
        },
        {
          label: "Redo",
          role: "redo"
        },
        {
          type: "separator"
        },
        {
          label: "Cut",
          role: "cut"
        },
        {
          label: "Copy",
          role: "copy"
        },
        {
          label: "Paste",
          role: "paste"
        },
        {
          label: "Select All",
          role: "selectAll"
        }
      ]
    }
  ];
  // If not on macOS, disable the menu.
  if (process.platform !== "darwin") {
    win.setMenu(null);
  } else {
    win.setMenu(macosMenu);
  }
  win.maximize();
  if(isDev){
    win.openDevTools();
  }
  // Load the custom Windows XP titlebar.
  let startHtmlPath;
  if(isDev){
    startHtmlPath = path.resolve(path.join(__dirname, '..', '..', 'local', 'start.html'));
  } else {
    startHtmlPath = path.join(path.dirname(app.getAppPath()), 'local', 'start.html');
  }  
  
  // Load the URL with proper file protocol and use the config for the initial URL
  const startUrl = `${pathToFileURL(startHtmlPath)}?url=${config.getUrl('update')}`;
  win.loadURL(startUrl);
  
  win.webContents.on('did-finish-load', () => {
    win.show();
  });
  
  // Add listeners for window state changes
  win.on('maximize', () => {
    win.webContents.send('window-state-change', true);
  });
  
  win.on('unmaximize', () => {
    win.webContents.send('window-state-change', false);
  });
  
  win.webContents.on('new-window', (event, url) => {
    if (url.includes("/make/publish.php?s=") || url.includes("&inLauncher=1")) {
      // Internally handle the new window by creating a popup window
      // The URL should be on "file:///" +  app.getAppPath().replace(/\\/g, '/') + URL
      event.preventDefault();
      win.newwin = new BrowserWindow({
        backgroundColor: "#32103C",
        width: 800,
        height: 600,
        minWidth: 640,
        minHeight: 320,
        frame: false,
        show: false, // Initially hide the new window
        webPreferences: {
          enableRemoteModule: false,
          nodeIntegration: false,
          contextIsolation: true,
          preload: preloadPath, // Use the verified absolute path
          plugins: true,
        },
      });
      win.newwin.setMenu(null);
      
      // Use the helper function to create a proper file URL
      const fileURL = pathToFileURL(startHtmlPath);
      const popupUrl = `${fileURL}?url=${url}`;
      
      win.newwin.loadURL(popupUrl);
      win.newwin.webContents.on('did-finish-load', () => {
        win.newwin.show();
      });
      win.newwin.on("closed", () => {
        win.newwin = null;
      });
      win.newwin.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
      });
    } else {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  app.quit();
});


if (process.platform == "win32") {
  const clientId = '915116210570539058';
  const rpc = new DiscordRPC.Client({ transport: 'ipc' });
  const startTimestamp = new Date();

  async function setActivity() {
    if (!rpc || !win) {
      return;
    }
    const boops = await win.webContents.executeJavaScript('rpcinfo');
    rpc.setActivity({
      details: `${boops}`,
      startTimestamp,
      largeImageKey: 'icon',
      largeImageText: `${boops}`
    });
  }

  rpc.on('ready', () => {
    setActivity();
    setInterval(() => {
      setActivity();
    }, 15e3);
  });

  rpc.login({ clientId }).catch();
}

// Set up IPC handlers for window control
ipcMain.handle('window-minimize', (event) => {
  // Find the BrowserWindow that the request is coming from
  const webContents = event.sender;
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  
  if (browserWindow) {
    browserWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('window-maximize', (event) => {
  // Find the BrowserWindow that the request is coming from
  const webContents = event.sender;
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  
  if (browserWindow) {
    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize();
      return false;
    } else {
      browserWindow.maximize();
      return true;
    }
  }
  return false;
});

ipcMain.handle('window-close', (event) => {
  // Find the BrowserWindow that the request is coming from
  const webContents = event.sender;
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  
  if (browserWindow) {
    browserWindow.close();
    return true;
  }
  return false;
});

ipcMain.handle('window-is-maximized', (event) => {
  // Find the BrowserWindow that the request is coming from
  const webContents = event.sender;
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  
  if (browserWindow) {
    return browserWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('get-rpc-info', async (event) => {
  if (!win) return '';
  try {
    return await win.webContents.executeJavaScript('rpcinfo');
  } catch (error) {
    return '';
  }
});

// Handler to provide application configuration to the renderer
ipcMain.handle('get-config', (event) => {
  return config;
});

// Handler to get a specific URL
ipcMain.handle('get-url', (event, endpoint) => {
  return config.getUrl(endpoint);
});
