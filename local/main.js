document.addEventListener('DOMContentLoaded', initializeApp);

let wasMusicPlayingOnStart = false;
let isMusicPlaying = false;
let userWantsMusicOn = true;
let iframeAllowsMusicPlayback = true;
let musicBtn;
let audioPlayer;
let chiptunePlayer = null;
let isChiptunePlayerReady = false;
let megaRandomList = [];
let currentTrackIndex = 0;
let fadeInterval = null;

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
        const request = store.get('musicState');
        request.onsuccess = (event) => {
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
        const modulesResponse = await fetch(`${baseUrl}/modules/index.m3u`);
        const modulesText = await modulesResponse.text();
        const modules = modulesText.split('\n').map(line => line.trim()).filter(line => line.includes('.mod'));
        const arcadeResponse = await fetch(`${baseUrl}/arcade/index.m3u`);
        const arcadeText = await arcadeResponse.text();
        const arcade = arcadeText.split('\n').map(line => line.trim()).filter(line => line.includes('.mp3'));
        return {
            modules,
            arcade,
            baseUrl
        };
    } catch (error) {
        console.error('Error fetching music lists:', error);
        return {
            modules: [],
            arcade: [],
            baseUrl: ''
        };
    }
};

const createMegaRandomList = (modules, arcade, baseUrl) => {
    const normalizedModules = modules.map(line => {
        const normalizedLine = line.trim().replaceAll('\\', '/');
        const parts = normalizedLine.split('/').filter(p => p.length > 0);
        if (parts.length >= 2) {
            const author = parts[parts.length - 2];
            const filename = parts[parts.length - 1];
            const url = `${baseUrl}/modules/${author}/${filename}`;
            return url;
        }
        console.error('Failed to parse module path:', line);
        return null;
    }).filter(url => url !== null);
    const normalizedArcade = arcade.map(filename => `${baseUrl}/arcade/${filename}`);
    const combinedList = [...normalizedModules, ...normalizedArcade];
    return shuffleArray(combinedList);
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

async function initChiptunePlayer() {
    try {
        const {
            ChiptuneJsPlayer
        } = await import('./lib/chiptune3.min.js');
        const audioContext = new AudioContext();
        chiptunePlayer = new ChiptuneJsPlayer(audioContext);
        isChiptunePlayerReady = true;
    } catch (e) {
        console.error('Error loading or initializing ChiptuneJsPlayer:', e);
        isChiptunePlayerReady = false;
    }
}

const loadAndPlayModule = async (url) => {
    if (!isChiptunePlayerReady) {
        console.error("ChiptuneJsPlayer is not ready. Skipping module playback and attempting next track.");
        playNextTrack();
        return;
    }
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = '';
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch module file');
        const buffer = await response.arrayBuffer();
        try {
            chiptunePlayer.play(buffer);
        } catch (error) {
            console.error('Error playing module:', error);
            // 2 second delay before next track
            setTimeout(playNextTrack, 2000);
            return;
        }
    } catch (error) {
        console.error('Error playing module:', error);
        // 2 second delay before next track
        setTimeout(playNextTrack, 2000);
        return;
    }
};

const playMp3 = (url) => {
    if (chiptunePlayer) {
        chiptunePlayer.stop();
    }
    try {
        audioPlayer.src = url;
        audioPlayer.play();
    } catch (error) {
        console.error('Error playing mp3:', error);
        // 2 second delay before next track
        setTimeout(playNextTrack, 2000);
        return;
    }
};

const playNextTrack = () => {
    if (megaRandomList.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % megaRandomList.length;
    const nextUrl = megaRandomList[currentTrackIndex];
    if (nextUrl.endsWith('.mod')) {
        loadAndPlayModule(nextUrl);
    } else {
        playMp3(nextUrl);
    }
};


const fadeAndPauseMusic = () => {
    if (!isMusicPlaying) return;
    
    isMusicPlaying = false;
    
    const isMp3 = megaRandomList[currentTrackIndex].endsWith('.mp3');
    const player = isMp3 ? audioPlayer : chiptunePlayer;

    fadeMusicVolume(1, 0, () => {
        if (isMp3) {
            player.pause();
        } else if (isChiptunePlayerReady) {
            chiptunePlayer.pause();
        }
    });
};

function fadeMusicVolume(startVolume, endVolume, onComplete = null) {
    if (fadeInterval) clearInterval(fadeInterval);
    
    const isMp3 = megaRandomList[currentTrackIndex].endsWith('.mp3');
    const player = isMp3 ? audioPlayer : chiptunePlayer;
    
    let volume = startVolume;
    const fadeStep = startVolume < endVolume ? 0.05 : -0.05;
    
    if (player) {
        if (isMp3) {
            player.volume = volume;
        } else if (isChiptunePlayerReady) {
            chiptunePlayer.setVol(volume);
        }
    }
    
    fadeInterval = setInterval(() => {
        volume += fadeStep;
        
        const shouldStop = fadeStep > 0 ? volume >= endVolume : volume <= endVolume;
        
        if (shouldStop) {
            volume = endVolume;
            clearInterval(fadeInterval);
            fadeInterval = null;
            
            if (onComplete) {
                onComplete();
            }
        }
        
        if (player) {
            if (isMp3) {
                player.volume = volume;
            } else if (isChiptunePlayerReady) {
                chiptunePlayer.setVol(volume);
            }
        }
    }, 50);
}

const resumeMusic = () => {
    if (!userWantsMusicOn || !iframeAllowsMusicPlayback) return;
    if (isMusicPlaying) return;

    isMusicPlaying = true;
    const currentUrl = megaRandomList[currentTrackIndex];
    const isMp3 = currentUrl.endsWith('.mp3');

    if (isMp3) {
        if (audioPlayer.src && audioPlayer.src.includes(currentUrl) && audioPlayer.paused) {
            audioPlayer.play();
        } else {
            playMp3(currentUrl);
        }
    } else {
        if (chiptunePlayer) {
            if (wasMusicPlayingOnStart) {
                chiptunePlayer.unpause();
            } else {
                wasMusicPlayingOnStart = true;
                playNextTrack();
            }
        } else {
            playNextTrack();
        }
    }

    fadeMusicVolume(0, 1);
};
function toggleMusic() {
    userWantsMusicOn = !userWantsMusicOn;
    updateMusicButtonState();
    saveMusicState(userWantsMusicOn);

    tryPlayMusic();
}

async function initializeApp() {
    musicBtn = document.getElementById('music-btn');
    audioPlayer = new Audio();
    audioPlayer.addEventListener('ended', playNextTrack);
    
    await initChiptunePlayer();
    const { modules, arcade, baseUrl } = await getMusicList();
    megaRandomList = createMegaRandomList(modules, arcade, baseUrl);
    
    window.addEventListener("message", (event) => {
        if (event.data?.type === "iframe-audio") {
            if (event.data.state === "playing") {
                iframeAllowsMusicPlayback = false;
            } else if (event.data.state === "paused") {
                iframeAllowsMusicPlayback = true;
            }
            tryPlayMusic();
        }
    });

    await openDB();
    isMusicPlaying = await loadMusicState();
    userWantsMusicOn = isMusicPlaying;
    wasMusicPlayingOnStart = isMusicPlaying;

    updateMusicButtonState();
    
    tryPlayMusic();

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const url = urlParams.get('url');
    if (url == null) {
        try {
            const updateUrl = await window.electronAPI.getUrl('update');
            window.location.href = updateUrl;
        } catch (error) {
            console.error(error);
        }
    }
    window.initialURL = url;
    var page;
    var prevpage;
    var pagestat;
    document.getElementById("content-frame").setAttribute('src', url);
    checkmax();
    await openDB();
    isMusicPlaying = await loadMusicState();
    musicBtn.classList.remove('crossed-out');
    if (isMusicPlaying) {
        userDisabledMusic = false;
        if (megaRandomList.length > 0) {
            const firstUrl = megaRandomList[currentTrackIndex];
            if (firstUrl.endsWith('.mod')) {
                loadAndPlayModule(firstUrl);
            } else {
                playMp3(firstUrl);
            }
        }
    } else {
        musicBtn.classList.add('crossed-out');
        userDisabledMusic = true;
    }
    setTimeout(() => {
        window.addEventListener('resize', () => {
            setTimeout(checkmax, 50);
        });
        const titleBar = document.querySelector('.title-bar');
        if (titleBar) {
            titleBar.addEventListener('mouseup', () => setTimeout(checkmax, 50));
            titleBar.addEventListener('dblclick', () => setTimeout(checkmax, 50));
        }
        if (window.electronAPI && window.electronAPI.onWindowStateChange) {
            window.electronAPI.onWindowStateChange((isMaximized) => {
                const maxButton = document.getElementById('max-btn');
                if (maxButton) {
                    maxButton.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
                }
            });
        }
    }, 100);
    setInterval(discordrpc, 15000);
}


function tryPlayMusic() {
    if (userWantsMusicOn && iframeAllowsMusicPlayback && megaRandomList.length > 0) {
        resumeMusic();
    } else {
        fadeAndPauseMusic();
    }
}

function updateMusicButtonState() {
    if (userWantsMusicOn) {
        musicBtn.classList.remove('crossed-out');
    } else {
        musicBtn.classList.add('crossed-out');
    }
}

async function toggleMaximize() {
    try {
        const maxButton = document.getElementById('max-btn');
        if (!maxButton) return;
        const isMaximized = await window.electronAPI.maximizeWindow();
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
        if (!maxButton) return;
        const isMaximized = await window.electronAPI.isWindowMaximized();
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
setInterval(checkmax, 100);
window.addEventListener('resize', checkmax);
document.addEventListener('mouseup', checkmax);
var rpcinfo;

function discordrpc() {
    try {
        const frameWindow = document.getElementById("content-frame").contentWindow;
        if (frameWindow && frameWindow.rpcinfo) {
            rpcinfo = frameWindow.rpcinfo;
            if (window.electronAPI && window.electronAPI.updateRpcStatus) {
                window.electronAPI.updateRpcStatus(rpcinfo);
            }
        }
    } catch (error) {}
}
setInterval(discordrpc, 15000);

async function online() {
    if (document.getElementById("content-frame").contentWindow.location.href !== "chrome-error://chromewebdata/") {
        page = document.getElementById("content-frame").contentWindow.location.href;
    } else if (page === undefined) {
        page = window.initialURL || '';
    }
    if (page.includes("offline.html")) {
        // Disable music
        isMusicPlaying = false;
        fadeAndPauseMusic();
        wasMusicPlayingOnStart = false;
        page = "test";
    } else {
        const frame = document.getElementById('content-frame');
        try {
            var pingUrl = await window.electronAPI.getUrl('ping');
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState === 4 && this.status !== 200 && frame.getAttribute('src') !== "offline.html?retry=" + page) {
                    if (page !== "test") {
                        prevpage = page;
                    }
                    pagestat = "offline";
                    page = "offline.html";
                    frame.setAttribute('src', 'offline.html?retry=' + page);
                } else if (document.getElementById("content-frame").contentWindow.location.href !== "chrome-error://chromewebdata/") {
                    page = document.getElementById("content-frame").contentWindow.location.href;
                } else {
                    if ((page === "test") && (pagestat === "offline")) {
                        frame.setAttribute('src', prevpage);
                    }
                }
            };
            xhttp.open("GET", pingUrl, true);
            xhttp.send();
        } catch (error) {
            console.error('Error getting ping URL:', error);
        }
    }
}
window.addEventListener('focus', function() {
    setTimeout(checkmax, 50);
});
window.addEventListener('blur', function() {
    setTimeout(checkmax, 50);
});
window.addEventListener('scroll', () => {
    window.scrollTo(0, 0);
});
window.onscroll = () => window.scrollTo(0, 0);
document.addEventListener('wheel', (event) => {
    event.preventDefault();
}, {
    passive: false
});
document.addEventListener('keydown', (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
    }
});