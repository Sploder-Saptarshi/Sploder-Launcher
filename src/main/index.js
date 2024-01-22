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
    frame:false,
    minWidth:640,
    minHeight: 320,
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
    startpath = "/../../src/local/start.html"
  } else {
    startpath = "/../../resources/src/local/start.html"
  }
  win.loadURL("file:///" +  app.getAppPath().replace(/\\/g, '/') +startpath);
  win.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
  // Discord is a nuisance and does not allow it's website to be embedded in an iframe... Workaround below.
  win.webContents.session.webRequest.onHeadersReceived({ urls: [ "https://discord.com/*" ] },
  (d, c)=>{
    if(d.responseHeaders['X-Frame-Options']){
      delete d.responseHeaders['X-Frame-Options'];
    } else if(d.responseHeaders['x-frame-options']) {
      delete d.responseHeaders['x-frame-options'];
    }

    c({cancel: false, responseHeaders: d.responseHeaders});
  }
);
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