// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', initializeApp);
let isMusicPlaying = false;
var musicBtn = document.getElementById('music-btn');
async function initializeApp() {
    musicBtn = document.getElementById('music-btn');

    // Check get parameter to get URL
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const url = urlParams.get('url');

    // If the URL is not provided, redirect to the update page
    if (url == null) {
        try {
            const updateUrl = await window.electronAPI.getUrl('update');
            window.location.href = updateUrl;
        } catch (error) {
        }
    }

    // Store URL in a global variable for other functions to access
    window.initialURL = url;

    var page;
    var prevpage;
    var pagestat;

    // Set up document content
    document.getElementById("content-frame").setAttribute('src', url);

    // Initialize the button state
    checkmax();

    await openDB();
    isMusicPlaying = await loadMusicState();

    // Set the initial appearance of the button based on the loaded state
    if (isMusicPlaying) {
        musicBtn.classList.remove('crossed-out');
    } else {
        musicBtn.classList.add('crossed-out');
    }

    // Set up additional window state listeners
    setTimeout(() => {
        window.addEventListener('resize', () => {
            setTimeout(checkmax, 50);
        });

        // Additional event listener for the title bar
        const titleBar = document.querySelector('.title-bar');
        if (titleBar) {
            titleBar.addEventListener('mouseup', () => setTimeout(checkmax, 50));
            titleBar.addEventListener('dblclick', () => setTimeout(checkmax, 50));
        }

        // Listen for window state changes directly from the main process
        if (window.electronAPI && window.electronAPI.onWindowStateChange) {
            window.electronAPI.onWindowStateChange((isMaximized) => {
                const maxButton = document.getElementById('max-btn');
                if (maxButton) {
                    maxButton.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
                }
            });
        }
    }, 100);

    // Start the interval functions
    setInterval(discordrpc, 15000);
}

// Window control functions using IPC
async function toggleMaximize() {
    try {
        const maxButton = document.getElementById('max-btn');
        if (!maxButton) return; // Safety check

        // Call the maximize function which returns true if window is now maximized
        const isMaximized = await window.electronAPI.maximizeWindow();

        // Update button appearance immediately based on the returned state
        if (isMaximized) {
            maxButton.setAttribute('aria-label', 'Restore');
        } else {
            maxButton.setAttribute('aria-label', 'Maximize');
        }
    } catch (error) {
        console.error('Error in toggleMaximize:', error);
    }
}

async function checkmax() {
    try {
        const maxButton = document.getElementById('max-btn');
        if (!maxButton) return; // Safety check

        // Get the current window state
        const isMaximized = await window.electronAPI.isWindowMaximized();

        // Update the button's appearance based on the window state
        if (isMaximized) {
            if (maxButton.getAttribute('aria-label') !== 'Restore') {
                maxButton.setAttribute('aria-label', 'Restore');
            }
        } else {
            if (maxButton.getAttribute('aria-label') !== 'Maximize') {
                maxButton.setAttribute('aria-label', 'Maximize');
            }
        }
    } catch (error) {
        console.error('Error in checkmax:', error);
    }
}

// Run checkmax at a regular interval to keep the button state in sync
setInterval(checkmax, 100);

// Add event listeners for window state changes
window.addEventListener('resize', checkmax);
document.addEventListener('mouseup', checkmax);

// Keep updating the Discord RPC message
var rpcinfo;
function discordrpc() {
    try {
        // Try to get RPC info from the iframe content
        const frameWindow = document.getElementById("content-frame").contentWindow;
        if (frameWindow && frameWindow.rpcinfo) {
            rpcinfo = frameWindow.rpcinfo;
            // Update the Discord RPC status in the main process
            if (window.electronAPI && window.electronAPI.updateRpcStatus) {
                window.electronAPI.updateRpcStatus(rpcinfo);
            }
        }
    } catch (error) {
        // Silently handle cross-origin errors or other issues
        // This is expected when the iframe contains external content
    }
}
setInterval(discordrpc, 15000);
// Custom built code to check if user is online.
// I have no idea how or why this works.
async function online() {
    if (document.getElementById("content-frame").contentWindow.location.href != "chrome-error://chromewebdata/") {
        page = document.getElementById("content-frame").contentWindow.location.href;
    } else if (page == undefined) {
        page = window.initialURL || ''; // Use the stored global URL
    }
    if (page.includes("offline.html")) {
        page = "test";
    } else {


        const frame = document.getElementById('content-frame');
        try {
            var pingUrl = await window.electronAPI.getUrl('ping');
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function () {

                if (this.readyState == 4 && this.status != 200 && frame.getAttribute('src') != "offline.html?retry=" + page) {
                    if (page != "test") {
                        prevpage = page;
                    }
                    pagestat = "offline";
                    page = "offline.html";
                    frame.setAttribute('src', 'offline.html?retry=' + page);

                } else if (document.getElementById("content-frame").contentWindow.location.href != "chrome-error://chromewebdata/") {
                    page = document.getElementById("content-frame").contentWindow.location.href;
                } else {
                    if ((page == "test") && (pagestat == "offline")) {
                        frame.setAttribute('src', prevpage);
                    }
                    //pagestat = "online";
                }

            };
            xhttp.open("GET", pingUrl, true);
            xhttp.send();
        } catch (error) {
            console.error('Error getting ping URL:', error);
        }
    }
}
// Add window focus and blur listeners to check window state
window.addEventListener('focus', function () {
    setTimeout(checkmax, 50);
});

window.addEventListener('blur', function () {
    setTimeout(checkmax, 50);
});

// Prevent scrolling using JavaScript
window.addEventListener('scroll', () => {
    window.scrollTo(0, 0); // Keep the window locked at the top
});

// Disable scroll-related JavaScript methods
window.onscroll = () => window.scrollTo(0, 0);

document.addEventListener('wheel', (event) => {
    event.preventDefault(); // Disable mouse wheel scrolling
}, { passive: false });

document.addEventListener('keydown', (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
        event.preventDefault(); // Disable keyboard scrolling
    }
});



function toggleMusic() {
    const musicBtn = document.getElementById('music-btn');
    // Update the global state variable
    isMusicPlaying = !isMusicPlaying;

    if (isMusicPlaying) {
        musicBtn.classList.remove('crossed-out');
        // Unmute music logic here
        if (window.electronAPI && window.electronAPI.setMusicMuted) {
            window.electronAPI.setMusicMuted(false);
        }
    } else {
        musicBtn.classList.add('crossed-out');
        // Mute music logic here
        if (window.electronAPI && window.electronAPI.setMusicMuted) {
            window.electronAPI.setMusicMuted(true);
        }
    }

    // Save the new state to IndexedDB
    saveMusicState(isMusicPlaying);
}

let db;
const dbName = 'musicAppState';
const dbVersion = 1;
const storeName = 'preferences';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject('IndexedDB error');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            // Create the object store if it doesn't exist
            db.createObjectStore(storeName);
        };
    });
};

const saveMusicState = (isMusicPlaying) => {
    if (!db) {
        console.error('Database is not open.');
        return;
    }
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    // Use a specific key, like 'musicState', to store the value
    const request = store.put(isMusicPlaying, 'musicState');


    request.onerror = (event) => {
        console.error('Error saving music state:', event.target.error);
    };
};

const loadMusicState = () => {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('Database is not open.');
            reject('Database not open');
            return;
        }
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        // Retrieve the value using the same key
        const request = store.get('musicState');

        request.onsuccess = (event) => {
            // If the key exists, resolve with the value; otherwise, resolve with a default state
            const state = event.target.result !== undefined ? event.target.result : false;
            resolve(state);
        };

        request.onerror = (event) => {
            console.error('Error loading music state:', event.target.error);
            reject('Error loading state');
        };
    });
};

const getMusicList = async () => {
    try {
        const baseUrl = await window.electronAPI.getUrl('music');

        // Fetch and parse the modules list
        const modulesResponse = await fetch(`${baseUrl}/modules/index.m3u`);
        const modulesText = await modulesResponse.text();
        const modules = modulesText.split('\n').map(line => line.trim()).filter(line => line.includes('.mod'));

        // Fetch and parse the arcade list
        const arcadeResponse = await fetch(`${baseUrl}/arcade/index.m3u`);
        const arcadeText = await arcadeResponse.text();
        const arcade = arcadeText.split('\n').map(line => line.trim()).filter(line => line.includes('.mp3'));

        return { modules, arcade };
    } catch (error) {
        console.error('Error fetching music lists:', error);
        return { modules: [], arcade: [] };
    }
};
