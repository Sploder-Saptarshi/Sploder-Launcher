const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
process.env.NODE_ENV || 'development';

const config = {
    SPLODER_URL: "http://127.0.0.1:8010",
    DEV: !app.isPackaged,
}
const isDev = config.DEV;
if (isDev) {
    console.log(config);
}

// If not on windows, disable RPC
let DiscordRPC;
if (process.platform == "win32") {
  DiscordRPC = require('discord-rpc');
}
let win;
let pluginName;
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

if(isDev){
  flashpath = path.join("../../../plugins/", pluginName)
} else {
  flashpath = path.join(__dirname + "/../plugins/", pluginName)
}

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
      // Who cares about security?
      // I'll surely have to address this sometime soon though.
      enableRemoteModule: true,
      nodeIntegration: true,  
      devTools: true,
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

  function getSploderUrl(path='') {
    return encodeURIComponent(config.SPLODER_URL + path);
  }
  // Load the custom Windows XP titlebar.
  if(isDev) { 
    startpath = '/../../src/local/start.html?url='
    console.log('startpath: ', startpath);
  } else {
    startpath = '/../../resources/src/local/start.html?url='
  }
  function loadURLFromStartPath(appendedPath='') {
    const path = "file:///" + app.getAppPath().replace(/\\/g, '/') + startpath + getSploderUrl() + appendedPath;
    if (isDev) {
      console.log(path);
    }
    win.loadURL(path);
  }
  loadURLFromStartPath();
  win.webContents.on('did-finish-load', () => {
    win.show();
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
          nodeIntegration: true,
          enableRemoteModule: true,
          nodeIntegration: true,
          plugins: true,
        },
      });
      win.newwin.setMenu(null);
      loadURLFromStartPath(url);
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

if (process.platform === "win32") {
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
