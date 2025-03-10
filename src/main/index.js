const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const DiscordRPC = require('discord-rpc');
let win;
let pluginName;
const isDev = false; // Change to false if you want to disable development mode and package the application.
switch (process.platform) {
  case "win32":
    pluginName = process.arch == 'x64' ? 'x64/pepflashplayer.dll' : 'x32/pepflashplayer32.dll';
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
  win.setMenu(null);
  win.maximize();
  if(isDev){
    win.openDevTools();
  }
  // Load the custom Windows XP titlebar.
  if(isDev){
    startpath = "/../../src/local/start.html?url="
  } else {
    startpath = "/../../resources/src/local/start.html?url="
  }
  win.loadURL("file:///" + app.getAppPath().replace(/\\/g, '/') + startpath + "http://sploder.local/update");
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
      win.newwin.loadURL("file:///" + app.getAppPath().replace(/\\/g, '/') + startpath + url);
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
  if (process.platform !== "darwin") app.quit();
});


// Replace with your own Discord RPC client ID.
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