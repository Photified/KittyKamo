// game.js

const meta = document.createElement('meta');
meta.name = 'viewport';
meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
document.head.appendChild(meta);

const socket = io();

const targetFPS = 30;
const fpsInterval = 1000 / targetFPS; 
let lastRenderTime = 0;

const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const colorDay = new THREE.Color(0x87CEEB);   
const colorSunset = new THREE.Color(0xFF7E47); 
const colorNight = new THREE.Color(0x020211); 

let volumeState = 1; 
const VOL_EMOJIS = { 2: '🔊', 1: '🔉', 0: '🔇' };

window.musicEnabled = true;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const audioLoader = new THREE.AudioLoader();
const meowBuffers = [];
for (let i = 1; i <= 5; i++) {
    audioLoader.load(`sounds/meow${i}.mp3`, (buffer) => {
        meowBuffers.push(buffer);
    });
}

function playSound(type) {
    if (volumeState === 0 || audioCtx.state === 'suspended') return; 
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    let v = (volumeState === 1) ? 0.3 : 1.0;
    let endV = Math.max(0.001, 0.01 * v); 

    if (type === 'step') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'radar') { 
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(550, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.05 * v, audioCtx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'tick') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'pop') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'tag') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.1); 
        gain.gain.setValueAtTime(0.15 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'spit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1 * v, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endV, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
}

function playCatMeow(catData) {
    if (volumeState === 0 || meowBuffers.length === 0) return;
    if (catData.pAudio.isPlaying) catData.pAudio.stop();
    const randomBuffer = meowBuffers[Math.floor(Math.random() * meowBuffers.length)];
    catData.pAudio.setBuffer(randomBuffer);
    
    catData.pAudio.setVolume(volumeState === 1 ? 0.3 : 1.0);
    catData.pAudio.play();
}

function drawFaceOnCanvas(ctx, type) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 6;

    if (type === 'happy') {
        ctx.beginPath(); ctx.moveTo(24, 50); ctx.lineTo(40, 35); ctx.lineTo(56, 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(72, 50); ctx.lineTo(88, 35); ctx.lineTo(104, 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(40, 80); ctx.lineTo(64, 100); ctx.lineTo(88, 80); ctx.stroke();
    } else if (type === 'mad') {
        ctx.beginPath(); ctx.moveTo(24, 30); ctx.lineTo(56, 45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(104, 30); ctx.lineTo(72, 45); ctx.stroke();
        ctx.fillRect(32, 50, 16, 16); ctx.fillRect(80, 50, 16, 16);
        ctx.beginPath(); ctx.moveTo(40, 100); ctx.lineTo(64, 85); ctx.lineTo(88, 100); ctx.stroke();
    } else if (type === 'surprised') {
        ctx.strokeRect(32, 40, 16, 24); ctx.strokeRect(80, 40, 16, 24);
        ctx.strokeRect(56, 80, 16, 24);
    } else if (type === 'meh') {
        ctx.beginPath(); ctx.moveTo(24, 50); ctx.lineTo(56, 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(72, 50); ctx.lineTo(104, 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(48, 90); ctx.lineTo(80, 90); ctx.stroke();
    } else if (type === 'crying') {
        ctx.beginPath(); ctx.moveTo(24, 45); ctx.lineTo(56, 45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(40, 45); ctx.lineTo(40, 65); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(72, 45); ctx.lineTo(104, 45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(88, 45); ctx.lineTo(88, 65); ctx.stroke();
        ctx.shadowColor = 'transparent'; ctx.fillStyle = '#00BFFF';
        ctx.fillRect(34, 75, 12, 30); ctx.fillRect(82, 75, 12, 30);
        ctx.fillStyle = '#000'; ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath(); ctx.arc(64, 105, 12, Math.PI, 0); ctx.stroke();
    } else if (type === 'uwu') {
        ctx.beginPath(); ctx.moveTo(24, 45); ctx.lineTo(40, 55); ctx.lineTo(56, 45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(72, 45); ctx.lineTo(88, 55); ctx.lineTo(104, 45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(48, 80); ctx.lineTo(56, 90); ctx.lineTo(64, 85); ctx.lineTo(72, 90); ctx.lineTo(80, 80); ctx.stroke();
    } else if (type === 'derp') {
        ctx.fillRect(32, 40, 16, 16); ctx.fillRect(84, 50, 12, 12); 
        ctx.beginPath(); ctx.arc(64, 90, 10, 0, Math.PI, false); ctx.stroke(); 
        ctx.fillStyle = '#FF69B4'; ctx.fill(); 
    } else if (type === 'cool') {
        ctx.fillRect(24, 40, 32, 16); ctx.fillRect(72, 40, 32, 16); 
        ctx.beginPath(); ctx.moveTo(56, 45); ctx.lineTo(72, 45); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(56, 90); ctx.lineTo(72, 90); ctx.stroke(); 
    } else if (type === 'derp2') { 
        ctx.strokeRect(32, 40, 16, 24); ctx.strokeRect(80, 40, 16, 24); 
        ctx.fillRect(40, 48, 8, 8); ctx.fillRect(80, 48, 8, 8); 
        ctx.beginPath(); ctx.moveTo(48, 85); ctx.lineTo(80, 85); ctx.stroke(); 
    } else if (type === 'derp3') { 
        ctx.beginPath(); ctx.moveTo(24, 50); ctx.lineTo(56, 50); ctx.stroke(); 
        ctx.fillRect(80, 40, 16, 16); 
        ctx.beginPath(); ctx.arc(64, 85, 12, 0, Math.PI, false); ctx.stroke(); 
        ctx.shadowColor = 'transparent'; ctx.fillStyle = '#FF4444'; ctx.fillRect(60, 85, 8, 16); 
    } else if (type === 'derp4') { 
        ctx.fillRect(24, 30, 32, 32); 
        ctx.fillRect(88, 50, 8, 8); 
        ctx.beginPath(); ctx.arc(64, 90, 8, 0, Math.PI); ctx.stroke();
    } else if (type === 'derp5') { 
        ctx.strokeRect(32, 40, 16, 24); ctx.strokeRect(80, 40, 16, 24);
        ctx.fillRect(56, 85, 16, 4); 
    } else if (type === 'derp6') { 
        ctx.fillRect(32, 50, 16, 4); ctx.fillRect(80, 50, 16, 4); 
        ctx.beginPath(); ctx.moveTo(48, 80); ctx.lineTo(64, 90); ctx.lineTo(80, 80); ctx.stroke(); 
    } else if (type === 'derp7') { 
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(40, 48, 12, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(40, 48, 6, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(88, 48, 12, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(88, 48, 6, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(56, 85); ctx.lineTo(72, 85); ctx.stroke();
    } else if (type === 'derp8') { 
        ctx.fillRect(52, 60, 6, 6); ctx.fillRect(70, 60, 6, 6);
        ctx.fillRect(58, 75, 12, 4);
    } else if (type === 'derp9') { 
        ctx.fillRect(32, 45, 16, 16); ctx.fillRect(80, 45, 16, 16);
        ctx.beginPath(); ctx.moveTo(40, 85); ctx.lineTo(88, 85); ctx.stroke();
        ctx.shadowColor = 'transparent'; ctx.fillStyle = '#FFF'; 
        ctx.fillRect(56, 85, 16, 12); ctx.strokeRect(56, 85, 16, 12);
        ctx.beginPath(); ctx.moveTo(64, 85); ctx.lineTo(64, 97); ctx.stroke(); 
    } else if (type === 'derp10') { 
        ctx.beginPath(); ctx.moveTo(24, 35); ctx.lineTo(48, 45); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(104, 35); ctx.lineTo(80, 45); ctx.stroke(); 
        ctx.fillRect(32, 50, 16, 8); ctx.fillRect(80, 50, 16, 8); 
        ctx.beginPath(); ctx.moveTo(64, 80); ctx.lineTo(88, 70); ctx.stroke(); 
    } else { // normal
        ctx.fillRect(32, 45, 16, 16); ctx.fillRect(80, 45, 16, 16);
        ctx.beginPath(); ctx.moveTo(56, 85); ctx.lineTo(64, 95); ctx.lineTo(72, 85); ctx.stroke();
    }
}

const faceTextures = {};
function getFaceTexture(type) {
    if (faceTextures[type]) return faceTextures[type];
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    drawFaceOnCanvas(ctx, type);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; 
    faceTextures[type] = tex;
    return tex;
}

const style = document.createElement('style');
style.innerHTML = `
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; overflow: hidden; margin: 0; padding: 0; }
    .menu-btn { background: #333; color: white; border: 1px solid #666; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content:center; }
    .menu-btn:hover { background: #555; transform: scale(1.05); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #666; border-radius: 4px; }
    
    #leftBox, #centerBox, #rightBox { box-sizing: border-box !important; }
    
    @media (max-width: 768px) {
        #topBar { 
            display: grid !important; 
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; 
            gap: 8px !important; 
            padding: 8px !important; 
            align-items: stretch !important; 
        }
        #leftBox { grid-column: 1 / 2 !important; grid-row: 1 / 2 !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
        #rightBox { grid-column: 2 / 3 !important; grid-row: 1 / 2 !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
        #centerBox { grid-column: 1 / 3 !important; grid-row: 2 / 3 !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
    }
`;
document.head.appendChild(style);

const scene = new THREE.Scene();
scene.background = colorDay.clone();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);

const listener = new THREE.AudioListener();
camera.add(listener);

const bgmAudio = new THREE.Audio(listener);
audioLoader.load('sounds/bgm.wav', (buffer) => {
    bgmAudio.setBuffer(buffer);
    bgmAudio.setLoop(true);
    bgmAudio.setVolume(0.05); 
});

window.toggleMusic = function(btn) {
    window.musicEnabled = !window.musicEnabled;
    
    if (window.musicEnabled) {
        btn.innerHTML = '🎵 MUSIC: ON';
        btn.style.background = '#4CAF50';
        if (volumeState > 0 && !bgmAudio.isPlaying && document.getElementById('startScreen').style.display === 'none') {
            bgmAudio.play();
        }
    } else {
        btn.innerHTML = '🎵 MUSIC: OFF';
        btn.style.background = '#ff6666';
        if (bgmAudio.isPlaying) {
            bgmAudio.pause();
        }
    }
    btn.blur(); 
};

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isMobile ? 1 : window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.zIndex = '1';
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Vibrant lighting parameters
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75); 
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.35);
sunLight.position.set(40, 40, 20); 
sunLight.castShadow = true;
sunLight.shadow.camera.left = -40; sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40; sunLight.shadow.camera.bottom = -40;
sunLight.shadow.mapSize.width = isMobile ? 1024 : 2048; 
sunLight.shadow.mapSize.height = isMobile ? 1024 : 2048;
scene.add(sunLight);

const camRaycaster = new THREE.Raycaster();

// --- WARDROBE SYSTEM ---
function buildAccessory(type, colorHex) {
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    const group = new THREE.Group();
    let targetPart = 'head'; 

    function addPart(geo, x, y, z) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    }

    if (type === 'topHat') {
        targetPart = 'head';
        addPart(new THREE.BoxGeometry(0.5, 0.05, 0.5), 0, 0.22, 0); // brim
        addPart(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0, 0.37, 0); // top
    } else if (type === 'glasses') {
        targetPart = 'head';
        addPart(new THREE.BoxGeometry(0.15, 0.1, 0.05), -0.1, 0.05, -0.21); // left
        addPart(new THREE.BoxGeometry(0.15, 0.1, 0.05), 0.1, 0.05, -0.21); // right
        addPart(new THREE.BoxGeometry(0.1, 0.02, 0.05), 0, 0.05, -0.21); // bridge
    } else if (type === 'sweater') {
        targetPart = 'body';
        addPart(new THREE.BoxGeometry(0.52, 0.52, 0.82), 0, 0.5, 0); // body wrapper
    } else if (type === 'boots') {
        targetPart = 'legs';
        addPart(new THREE.BoxGeometry(0.12, 0.15, 0.12), 0, -0.08, 0); // base shape for clone
    } else if (type === 'bowTie') {
        targetPart = 'body';
        addPart(new THREE.BoxGeometry(0.1, 0.1, 0.05), 0, 0.55, -0.42); // mid
        addPart(new THREE.BoxGeometry(0.15, 0.15, 0.05), -0.12, 0.55, -0.42); // l
        addPart(new THREE.BoxGeometry(0.15, 0.15, 0.05), 0.12, 0.55, -0.42); // r
    } else if (type === 'beanie') {
        targetPart = 'head';
        addPart(new THREE.BoxGeometry(0.42, 0.15, 0.42), 0, 0.2, 0);
        addPart(new THREE.BoxGeometry(0.1, 0.1, 0.1), 0, 0.3, 0); // pompom
    } else if (type === 'headband') {
        targetPart = 'head';
        addPart(new THREE.BoxGeometry(0.42, 0.08, 0.42), 0, 0.1, 0);
    } else if (type === 'monocle') {
        targetPart = 'head';
        addPart(new THREE.BoxGeometry(0.15, 0.15, 0.05), 0.1, 0.05, -0.21); 
        addPart(new THREE.BoxGeometry(0.02, 0.2, 0.02), 0.15, -0.05, -0.21); // chain
    } else if (type === 'scarf') {
        targetPart = 'body';
        addPart(new THREE.BoxGeometry(0.45, 0.15, 0.45), 0, 0.75, -0.3); // around neck
        addPart(new THREE.BoxGeometry(0.1, 0.4, 0.1), -0.15, 0.5, -0.45); // dangle
    } else if (type === 'partyHat') {
        targetPart = 'head';
        addPart(new THREE.ConeGeometry(0.15, 0.4, 4), 0, 0.4, 0);
    }
    
    return { meshGroup: group, target: targetPart, type: type };
}

function applyWardrobeToCat(cat, wardrobeArr) {
    if (cat.equippedAccessories) {
        cat.equippedAccessories.forEach(acc => {
            if (acc.target === 'head') cat.head.remove(acc.meshGroup);
            if (acc.target === 'body') cat.body.remove(acc.meshGroup);
            if (acc.target === 'legs') {
                cat.legs.forEach(leg => {
                    let toRemove = leg.children.find(c => c.userData && c.userData.isBoot);
                    if (toRemove) leg.remove(toRemove);
                });
            }
        });
    }
    cat.equippedAccessories = [];

    if (!wardrobeArr) return;
    wardrobeArr.forEach(item => {
        if (!item) return;
        let acc = buildAccessory(item.id, item.color);
        if (acc.target === 'head') cat.head.add(acc.meshGroup);
        if (acc.target === 'body') cat.body.add(acc.meshGroup);
        if (acc.target === 'legs') {
            cat.legs.forEach(leg => {
                let bootClone = acc.meshGroup.children[0].clone();
                bootClone.userData = { isBoot: true };
                leg.add(bootClone);
            });
        }
        cat.equippedAccessories.push(acc);
    });
}
// -----------------------

function createCrown() {
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); 
    const crownGroup = new THREE.Group();
    
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), crownMat);
    const peak1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), crownMat); peak1.position.set(0.1, 0.1, 0.1);
    const peak2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), crownMat); peak2.position.set(-0.1, 0.1, 0.1);
    const peak3 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), crownMat); peak3.position.set(0.1, 0.1, -0.1);
    const peak4 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), crownMat); peak4.position.set(-0.1, 0.1, -0.1);
    
    crownGroup.add(base, peak1, peak2, peak3, peak4);
    
    crownGroup.children.forEach(mesh => {
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.castShadow = true;
    });
    
    crownGroup.position.set(0, 0.25, 0); 
    crownGroup.visible = false; 
    crownGroup.crownMat = crownMat; 
    return crownGroup;
}

function createCatSculpt(startColor = 0xFFFFFF, startFace = 'normal') {
    const uniqueMat = new THREE.MeshLambertMaterial({ color: startColor });
    const containerGroup = new THREE.Group();
    const catBody = new THREE.Group(); 
    containerGroup.add(catBody);

    function addPart(w, h, d, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), uniqueMat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        catBody.add(mesh);
        return mesh;
    }

    const head = addPart(0.4, 0.4, 0.4, 0, 0.7, -0.4);
    addPart(0.5, 0.5, 0.8, 0, 0.5, 0); 
    addPart(0.1, 0.2, 0.1, 0.15, 0.95, -0.4); addPart(0.1, 0.2, 0.1, -0.15, 0.95, -0.4); 
    
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.5, 0.4); 
    tailPivot.add(addPart(0.1, 0.1, 0.5, 0, 0, 0.25)); 
    catBody.add(tailPivot);

    const legs = [
        addPart(0.1, 0.3, 0.1, 0.15, 0.15, 0.3), addPart(0.1, 0.3, 0.1, -0.15, 0.15, 0.3),
        addPart(0.1, 0.3, 0.1, 0.15, 0.15, -0.3), addPart(0.1, 0.3, 0.1, -0.15, 0.15, -0.3)
    ];

    const faceGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const faceMat = new THREE.MeshBasicMaterial({ map: getFaceTexture(startFace), transparent: true, depthWrite: false });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 0, -0.201); 
    faceMesh.rotation.y = Math.PI; 
    head.add(faceMesh);

    const pAudio = new THREE.PositionalAudio(listener);
    pAudio.setDistanceModel('linear'); 
    pAudio.setRefDistance(3);  
    pAudio.setMaxDistance(30); 
    pAudio.setRolloffFactor(1);
    containerGroup.add(pAudio);

    const crown = createCrown();
    head.add(crown); 

    const dBeamGeo = new THREE.CylinderGeometry(1.4, 1.4, 60, 16, 1, true);
    const dBeamMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const dBeam = new THREE.Mesh(dBeamGeo, dBeamMat);
    dBeam.name = 'dBeam'; 
    dBeam.position.y = 30; 
    containerGroup.add(dBeam);

    return { group: containerGroup, body: catBody, head: head, legs: legs, tail: tailPivot, material: uniqueMat, pAudio: pAudio, crown: crown, crownMat: crown.crownMat, faceMesh: faceMesh, dBeamMat: dBeamMat };
}

function setNameLabel(catData, name) {
    if (catData.currentName === name) return; 
    
    if (catData.nameSprite) {
        catData.group.remove(catData.nameSprite);
        if (catData.nameSprite.material.map) catData.nameSprite.material.map.dispose();
        catData.nameSprite.material.dispose();
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, 128, 32);
    
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.position.y = 1.4; sprite.scale.set(1.5, 0.375, 1);
    catData.group.add(sprite); 
    catData.nameSprite = sprite; 
    catData.currentName = name; 
}

const particles = [];
const confettiParticles = [];
const confettiColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

function explodeParticles(pos, isRed) {
    const color = isRed ? 0xFF0000 : 0xFFFFFF;
    for (let i = 0; i < 20; i++) {
        const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        p.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
        scene.add(p);
        particles.push(p);
    }
}

const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const sharedEdgesGeo = new THREE.EdgesGeometry(sharedBoxGeo);
const sharedEdgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });

function createBlock(x, y, z, color) {
    const mesh = new THREE.Mesh(sharedBoxGeo, new THREE.MeshLambertMaterial({ color: color, transparent: true }));
    if (color !== 0x654321) {
        const edges = new THREE.LineSegments(sharedEdgesGeo, sharedEdgeMat);
        mesh.add(edges);
        mesh.castShadow = true; 
    }
    mesh.receiveShadow = true; 
    mesh.position.set(x, y, z);
    scene.add(mesh);
    mapObjects.push(mesh);
}

const walls = [];

function createWall(w, h, d, x, y, z, color = 0x8B4513) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: color, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    walls.push(mesh); 
}

const invisibleWalls = [];
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
function createInvisibleWall(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, invisibleMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    invisibleWalls.push(mesh);
}

const mapObjects = [];
const lobbyVisuals = []; 
const lobbyCollision = []; 
let myRole = 'hider';
let myName = 'Connecting...';
let myScore = 0; 
let serverGameState = 'WAITING';
let serverTime = 0;
let serverWinnerId = null;
let serverWinReason = "";
let lastTickTime = -1; 
let beamingPlayerIds = [];

const otherPlayers = {};
const activeDecoys = {}; 
const activeHairballs = [];

let myWalkTime = 0; 
let lastStepTime = 0; 
let myTailTime = 0; 
let lastRadarTime = 0; 
let lastTauntTime = 0; 
let wasGroundedLastFrame = true; 
let myEmote = 0; 

let myHairballs = 10;
let myDecoys = 3;
let amIStunned = false;

let isCustomizing = true; 
let customizationZone = null;
let ignoreServerPositionUntil = 0; 

const myPlayerObject = new THREE.Object3D(); 
scene.add(myPlayerObject);

// --- LOBBY BEAM VISUALS ---
const beamGeo = new THREE.CylinderGeometry(6, 6, 100, 32, 1, true); 
const beamMat = new THREE.MeshBasicMaterial({ 
    color: 0x88CCFF, 
    transparent: true, 
    opacity: 0.6, 
    depthWrite: false, 
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending 
});
const beamMesh = new THREE.Mesh(beamGeo, beamMat);
beamMesh.position.set(0, 45, 0); 
scene.add(beamMesh);

const beamLight = new THREE.PointLight(0x88CCFF, 2, 30);
beamLight.position.set(0, 2, 0);
scene.add(beamLight);

const beamGroundGeo = new THREE.PlaneGeometry(12, 12);
const beamGroundMat = new THREE.MeshBasicMaterial({ 
    color: 0xFFFFFF, 
    side: THREE.DoubleSide, 
    depthWrite: false 
});
const beamGroundMesh = new THREE.Mesh(beamGroundGeo, beamGroundMat);
beamGroundMesh.rotation.x = -Math.PI / 2;
beamGroundMesh.position.set(0, -4.9, 0); 
scene.add(beamGroundMesh);


function createCatBed(x, z, color) {
    const bedGroup = new THREE.Group();
    
    function addBedPart(geo, mat, px, py, pz, isCollision) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.position.set(px, py, pz);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        bedGroup.add(mesh);
        if (isCollision) lobbyCollision.push(mesh);
    }

    const baseMat = new THREE.MeshLambertMaterial({ color: color });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xDDDDDD });

    addBedPart(new THREE.BoxGeometry(2.6, 0.4, 2.6), baseMat, 0, -4.8, 0, true); 
    addBedPart(new THREE.BoxGeometry(0.4, 0.6, 3.4), rimMat, -1.5, -4.7, 0, false); 
    addBedPart(new THREE.BoxGeometry(0.4, 0.6, 3.4), rimMat, 1.5, -4.7, 0, false);  
    addBedPart(new THREE.BoxGeometry(2.6, 0.6, 0.4), rimMat, 0, -4.7, -1.5, false); 
    addBedPart(new THREE.BoxGeometry(2.6, 0.6, 0.4), rimMat, 0, -4.7, 1.5, false);  

    bedGroup.position.set(x, 0, z);
    scene.add(bedGroup);
    lobbyVisuals.push(bedGroup);
}

function createCatTree(x, z, type = 1) {
    const treeGroup = new THREE.Group();
    const matBase = new THREE.MeshLambertMaterial({ color: 0xDEB887 }); 
    const matPost = new THREE.MeshLambertMaterial({ color: 0xCD853F }); 

    function addTreePart(geo, mat, px, py, pz) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.position.set(px, py, pz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        treeGroup.add(mesh);
        lobbyCollision.push(mesh);
    }

    if (type === 1) {
        addTreePart(new THREE.BoxGeometry(4, 0.4, 4), matBase, 0, -4.8, 0);
        addTreePart(new THREE.BoxGeometry(0.6, 2, 0.6), matPost, -1, -3.6, 1);
        addTreePart(new THREE.BoxGeometry(2.5, 0.2, 2.5), matBase, -1, -2.5, 1);
        addTreePart(new THREE.BoxGeometry(0.6, 4, 0.6), matPost, 1, -2.6, 0);
        addTreePart(new THREE.BoxGeometry(3, 0.2, 3), matBase, 1, -0.5, 0);
        addTreePart(new THREE.BoxGeometry(0.6, 2, 0.6), matPost, 0, 0.6, -0.5); // FIXED
        addTreePart(new THREE.BoxGeometry(2, 0.2, 2), matBase, 0, 1.7, -0.5); // FIXED
    } else if (type === 2) {
        addTreePart(new THREE.BoxGeometry(3, 0.4, 3), matBase, 0, -4.8, 0);
        addTreePart(new THREE.BoxGeometry(0.6, 6, 0.6), matPost, 0, -1.8, 0);
        addTreePart(new THREE.BoxGeometry(2, 0.2, 2), matBase, 0, 1.3, 0);
        addTreePart(new THREE.BoxGeometry(1.5, 0.2, 1.5), matBase, 0.9, -1, 0);
        addTreePart(new THREE.BoxGeometry(1.5, 0.2, 1.5), matBase, -0.9, -3, 0);
    } else if (type === 3) {
        addTreePart(new THREE.BoxGeometry(4, 0.4, 3), matBase, 0, -4.8, 0);
        addTreePart(new THREE.BoxGeometry(0.6, 3, 0.6), matPost, -1, -3.3, 0);
        addTreePart(new THREE.BoxGeometry(0.6, 3, 0.6), matPost, 1, -3.3, 0);
        addTreePart(new THREE.BoxGeometry(4, 0.2, 2.5), matBase, 0, -1.7, 0);
        addTreePart(new THREE.BoxGeometry(1.5, 1, 1.5), matPost, 0, -1.1, 0); 
        addTreePart(new THREE.BoxGeometry(2, 0.2, 2), matBase, 0, -0.5, 0);
    }

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
    lobbyVisuals.push(treeGroup);
}

function createCraftingTable(x, z) {
    const tableGroup = new THREE.Group();
    const matWood = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const matPaper = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const matCrayonR = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
    const matCrayonB = new THREE.MeshLambertMaterial({ color: 0x0000FF });
    const matCrayonG = new THREE.MeshLambertMaterial({ color: 0x00FF00 });

    function addPart(geo, mat, px, py, pz, isCollision=false) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.position.set(px, py, pz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        tableGroup.add(mesh);
        if (isCollision) lobbyCollision.push(mesh);
    }

    // Lowered Tabletop and Shortened Legs
    addPart(new THREE.BoxGeometry(3, 0.2, 1.2), matWood, 0, -4.2, 0, true);
    addPart(new THREE.BoxGeometry(0.2, 0.6, 0.2), matWood, -1.3, -4.6, -0.4, true);
    addPart(new THREE.BoxGeometry(0.2, 0.6, 0.2), matWood, 1.3, -4.6, -0.4, true);
    addPart(new THREE.BoxGeometry(0.2, 0.6, 0.2), matWood, -1.3, -4.6, 0.4, true);
    addPart(new THREE.BoxGeometry(0.2, 0.6, 0.2), matWood, 1.3, -4.6, 0.4, true);

    // --- NEW SHELVES (Moved forward to Z: -0.4 so they don't clip into the wall!) ---
    addPart(new THREE.BoxGeometry(2.8, 0.1, 0.4), matWood, 0, -2.8, -0.4, true); // Bottom Shelf
    addPart(new THREE.BoxGeometry(2.8, 0.1, 0.4), matWood, 0, -1.6, -0.4, true); // Top Shelf

    // Lowered Papers
    addPart(new THREE.BoxGeometry(0.6, 0.05, 0.8), matPaper, -0.5, -4.08, 0);
    addPart(new THREE.BoxGeometry(0.6, 0.05, 0.8), matPaper, 0.2, -4.08, 0.1);

    // Lowered Crayons
    const cray1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), matCrayonR);
    cray1.position.set(0.8, -4.05, -0.2); cray1.rotation.y = 0.2; tableGroup.add(cray1);
    
    const cray2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), matCrayonB);
    cray2.position.set(0.9, -4.05, 0); cray2.rotation.y = -0.1; tableGroup.add(cray2);
    
    const cray3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), matCrayonG);
    cray3.position.set(0.7, -4.05, 0.2); cray3.rotation.y = 0.4; tableGroup.add(cray3);

    [cray1, cray2, cray3].forEach(c => {
        c.add(new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        c.castShadow = true; c.receiveShadow = true;
    });

    // --- ADD WARDROBE PROPS (DESK) ---
    const hatProp = buildAccessory('topHat', 0x222222).meshGroup;
    hatProp.position.set(-1.0, -4.295, 0.1); 
    hatProp.rotation.y = 0.4;
    tableGroup.add(hatProp);

    const glassesProp = buildAccessory('glasses', 0x00FFFF).meshGroup;
    glassesProp.position.set(0.1, -4.1, 0.3);
    glassesProp.rotation.y = -0.3;
    tableGroup.add(glassesProp);

    const boot1 = buildAccessory('boots', 0x333333).meshGroup;
    boot1.position.set(1.1, -3.945, 0.1);
    boot1.rotation.y = -0.6;
    tableGroup.add(boot1);

    const boot2 = buildAccessory('boots', 0x333333).meshGroup;
    boot2.position.set(1.3, -3.945, 0.3);
    boot2.rotation.y = -0.2;
    tableGroup.add(boot2);

    // --- ADD WARDROBE PROPS (BOTTOM SHELF: Y = -2.75) ---
    const partyHat1 = buildAccessory('partyHat', 0xFF1493).meshGroup; 
    partyHat1.position.set(-1.2, -2.95, -0.4);
    partyHat1.rotation.y = 0.2;
    tableGroup.add(partyHat1);

    const bowTie1 = buildAccessory('bowTie', 0x00FFFF).meshGroup; 
    bowTie1.position.set(-0.7, -3.25, 0.02); // 0.02 counteracts the internal chest anchor
    bowTie1.rotation.y = -0.1;
    tableGroup.add(bowTie1);

    const monocle1 = buildAccessory('monocle', 0xFFD700).meshGroup; 
    monocle1.position.set(-0.2, -2.6, -0.19); // counteracts the face anchor
    monocle1.rotation.y = 0.3;
    tableGroup.add(monocle1);

    const glasses2 = buildAccessory('glasses', 0xFFFFFF).meshGroup; 
    glasses2.position.set(0.3, -2.75, -0.19);
    glasses2.rotation.y = -0.2;
    tableGroup.add(glasses2);

    const bowTie2 = buildAccessory('bowTie', 0xFF0000).meshGroup; 
    bowTie2.position.set(0.8, -3.25, 0.02); 
    bowTie2.rotation.y = 0.1;
    tableGroup.add(bowTie2);

    const partyHat2 = buildAccessory('partyHat', 0x00BFFF).meshGroup; 
    partyHat2.position.set(1.3, -2.95, -0.4);
    partyHat2.rotation.y = -0.3;
    tableGroup.add(partyHat2);

    // --- ADD WARDROBE PROPS (TOP SHELF: Y = -1.55) ---
    const beanie1 = buildAccessory('beanie', 0x32CD32).meshGroup; 
    beanie1.position.set(-1.2, -1.675, -0.4);
    beanie1.rotation.y = -0.4;
    tableGroup.add(beanie1);

    const topHat1 = buildAccessory('topHat', 0xFF0000).meshGroup; 
    topHat1.position.set(-0.7, -1.745, -0.4);
    topHat1.rotation.y = 0.2;
    tableGroup.add(topHat1);

    const head1 = buildAccessory('headband', 0xFFFF00).meshGroup; 
    head1.position.set(-0.2, -1.61, -0.4);
    head1.rotation.y = 0.1;
    tableGroup.add(head1);

    const scarf1 = buildAccessory('scarf', 0xFF69B4).meshGroup; 
    scarf1.position.set(0.3, -1.85, -0.05); 
    scarf1.rotation.y = 0.1;
    tableGroup.add(scarf1);

    const topHat2 = buildAccessory('topHat', 0x8A2BE2).meshGroup; 
    topHat2.position.set(0.8, -1.745, -0.4);
    topHat2.rotation.y = -0.3;
    tableGroup.add(topHat2);

    const beanie2 = buildAccessory('beanie', 0xFF8C00).meshGroup; 
    beanie2.position.set(1.3, -1.675, -0.4);
    beanie2.rotation.y = 0.2;
    tableGroup.add(beanie2);

    tableGroup.position.set(x, 0, z);
    scene.add(tableGroup);
    lobbyVisuals.push(tableGroup);
}

function createClosedBox(w, h, d, x, y, z, rY) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: 0xC19A6B }); 
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rY || 0;
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    lobbyVisuals.push(mesh);
    lobbyCollision.push(mesh);
}

function createOpenBox(w, h, d, x, y, z, rY) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xC19A6B, side: THREE.DoubleSide });
    const t = 0.1; 
    
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mat);
    bottom.position.set(0, -h/2 + t/2, 0);
    group.add(bottom);
    
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
    left.position.set(-w/2 + t/2, 0, 0);
    group.add(left);
    
    const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
    right.position.set(w/2 - t/2, 0, 0);
    group.add(right);
    
    const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
    front.position.set(0, 0, d/2 - t/2);
    group.add(front);
    
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
    back.position.set(0, 0, -d/2 + t/2);
    group.add(back);

    group.children.forEach(c => {
        c.add(new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        c.castShadow = true; c.receiveShadow = true;
        lobbyCollision.push(c); 
    });

    group.position.set(x, y, z);
    group.rotation.y = rY || 0; 
    scene.add(group);
    lobbyVisuals.push(group);
}

let qPressTime = 0;
let isQPressed = false;
const unstuckUI = document.createElement('div');
unstuckUI.style.cssText = 'position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:200px; height:20px; background:rgba(0,0,0,0.5); border:2px solid #fff; border-radius:10px; display:none; z-index:200; overflow:hidden;';
const unstuckFill = document.createElement('div');
unstuckFill.style.cssText = 'width:0%; height:100%; background:gold; transition:width 0.1s;';
unstuckUI.appendChild(unstuckFill);
const unstuckText = document.createElement('div');
unstuckText.innerHTML = 'RE-DROPPING...';
unstuckText.style.cssText = 'position:absolute; width:100%; text-align:center; top:2px; font-size:12px; font-weight:bold; color:white; text-shadow:1px 1px 0 #000;';
unstuckUI.appendChild(unstuckText);
document.body.appendChild(unstuckUI);

const blindfoldStage = new THREE.Group();
camera.add(blindfoldStage); 

const blindfoldBg = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100), 
    new THREE.MeshBasicMaterial({color: 0x111111, depthTest: false, depthWrite: false, transparent: true, opacity: 1})
);
blindfoldBg.position.z = -5; 
blindfoldBg.renderOrder = 999; 
blindfoldStage.add(blindfoldBg);

const blindfoldAmbient = new THREE.AmbientLight(0xffffff, 1.2);
blindfoldStage.add(blindfoldAmbient);

const loadingCats = [];
for(let i=0; i<3; i++) {
    let cat = createCatSculpt(0xFFFFFF);
    cat.group.position.set((Math.random() * 10) - 5, -0.5 - (i * 1.0), -4);
    cat.group.traverse((child) => {
        if (child.name === 'dBeam') {
            child.visible = false; 
            return;
        }
        if (child.isMesh || child.isLineSegments) {
            child.material.depthTest = false; 
            child.material.depthWrite = false; 
            child.material.transparent = true; 
            child.material.opacity = 1;
            child.renderOrder = 1000;
        }
    });
    cat.speed = (Math.random() * 0.05) + 0.05; cat.direction = i % 2 === 0 ? 1 : -1;
    cat.group.rotation.y = cat.direction === 1 ? -Math.PI / 2 : Math.PI / 2;
    blindfoldStage.add(cat.group); loadingCats.push(cat);
}
blindfoldStage.visible = false; 

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x4CAF50, side: THREE.DoubleSide }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -5; ground.receiveShadow = true; 
scene.add(ground);

const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });
for (let i = 0; i < 20; i++) {
    let cloud = new THREE.Mesh(new THREE.BoxGeometry(Math.random() * 6 + 3, Math.random() * 1.5 + 0.5, Math.random() * 6 + 3), cloudMat);
    cloud.position.set((Math.random() * 120) - 60, Math.random() * 10 + 15, (Math.random() * 120) - 60);
    cloud.castShadow = true; scene.add(cloud); clouds.push(cloud);
}

const starGeo = new THREE.BufferGeometry();
const starCount = 400;
const starPos = new Float32Array(starCount * 3);
for(let i=0; i < starCount * 3; i+=3) {
    starPos[i] = (Math.random() - 0.5) * 200; 
    starPos[i+1] = (Math.random() * 100) + 10; 
    starPos[i+2] = (Math.random() - 0.5) * 200; 
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({color: 0xFFFFFF, transparent: true, opacity: 0, size: 0.7});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

const myCatData = createCatSculpt(); 
myPlayerObject.add(myCatData.group);

// --- ADD MIRROR CAT GLOBALLY ---
const myMirrorCat = createCatSculpt();
scene.add(myMirrorCat.group);
myMirrorCat.group.visible = false;
const mirrorZ = 19.5; // The actual mirror glass Z-position

// Guarantee NO spotlight/beam on the mirror cat
let mBeam = myMirrorCat.group.getObjectByName('dBeam');
if (mBeam) mBeam.visible = false; 

// Store mirror cats for other players
const otherMirrorCats = {};
// -------------------------------

window.myBaseColor = 0xFFFFFF; 
window.myFace = 'normal';
window.myWardrobe = [null, null, null]; // 3 Slots for Customization
window.activeSlot = 0;
let currentItemColor = 0xFF0000; // Default Red

const previewCat = createCatSculpt(window.myBaseColor, window.myFace);
previewCat.group.position.set(0, 100, 0); 
scene.add(previewCat.group);
const previewLight = new THREE.AmbientLight(0xffffff, 1.2); 
scene.add(previewLight);

// --- START SCREEN UI REWRITE ---
const startScreen = document.createElement('div');
startScreen.id = 'startScreen';
startScreen.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); color:white; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom: 10vh; font-family:"Segoe UI", sans-serif; z-index:999; box-sizing:border-box;';

const uiContainer = document.createElement('div');
uiContainer.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%;';

const logo = document.createElement('h1');
logo.innerHTML = 'KITTY KAMO';
logo.style.cssText = 'font-size: 48px; color: gold; text-shadow: 3px 3px 0 #000; margin: 0 0 10px 0; font-weight: 900; letter-spacing: 2px; text-align: center;';
uiContainer.appendChild(logo);

// TAB BUTTONS
const tabRow = document.createElement('div');
tabRow.style.cssText = 'display:flex; gap:10px; margin-bottom:15px;';
const catTabBtn = document.createElement('button');
catTabBtn.innerHTML = '🐱 BASE CAT';
const wardrobeTabBtn = document.createElement('button');
wardrobeTabBtn.innerHTML = '👕 WARDROBE';

[catTabBtn, wardrobeTabBtn].forEach(btn => {
    btn.style.cssText = 'padding:8px 16px; font-weight:bold; background:#333; color:white; border:2px solid #555; border-radius:6px; cursor:pointer;';
});
catTabBtn.style.borderColor = 'gold';
tabRow.appendChild(catTabBtn);
tabRow.appendChild(wardrobeTabBtn);
uiContainer.appendChild(tabRow);

// TAB CONTAINERS
const catTab = document.createElement('div');
catTab.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
const wardrobeTab = document.createElement('div');
wardrobeTab.style.cssText = 'display:none; flex-direction:column; align-items:center; width: 100%; max-width: 350px;';

uiContainer.appendChild(catTab);
uiContainer.appendChild(wardrobeTab);

// 1. CAT TAB CONTENT
const nameInput = document.createElement('input');
nameInput.id = 'nameInput';
nameInput.type = 'text';
nameInput.placeholder = 'Enter Name...';
nameInput.maxLength = 12;
nameInput.style.cssText = 'padding: 12px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 8px; border: 3px solid #555; background: #222; color: white; margin-bottom: 20px; width: 250px; outline: none; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: border-color 0.2s;';
nameInput.onfocus = () => nameInput.style.borderColor = 'gold';
nameInput.onblur = () => nameInput.style.borderColor = '#555';
catTab.appendChild(nameInput);

const colorPalette = document.createElement('div');
colorPalette.style.cssText = 'display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; justify-content:center; max-width: 350px;';

const colors = [
    {n:'White', h:0xFFFFFF}, {n:'Black', h:0x222222}, 
    {n:'Bright Blue', h:0x0044FF}, {n:'Deep Pink', h:0xFF00AA}, 
    {n:'Bright Purple', h:0xAA00FF}, {n:'Bright Yellow', h:0xFFFF00}, 
    {n:'Cyan', h:0x00FFFF}, {n:'Bright Orange', h:0xFF6600},
    {n:'Magenta', h:0xFF00FF}, {n:'Violet', h:0x8A2BE2}, 
    {n:'Deep Sky Blue', h:0x00AAFF}, {n:'Hot Pink', h:0xFF0055},
    {n:'Lime', h:0x32CD32}, {n:'Crimson', h:0xDC143C},
    {n:'Teal', h:0x008080}, {n:'Gold', h:0xFFD700},
    {n:'Charcoal', h:0x555555}, {n:'Coral', h:0xFF5533}
];

colors.forEach(c => {
    let btn = document.createElement('button');
    btn.style.cssText = `width:28px; height:28px; border-radius:50%; background:#${c.h.toString(16).padStart(6,'0')}; border:3px solid #555; cursor:pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.5); transition: transform 0.1s;`;
    btn.onclick = () => { 
        window.myBaseColor = c.h; 
        previewCat.material.color.setHex(c.h);
        myMirrorCat.material.color.setHex(c.h); // MIRROR SYNC
        Array.from(colorPalette.children).forEach(child => child.style.borderColor = '#555');
        btn.style.borderColor = 'gold';
    };
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    colorPalette.appendChild(btn);
});
colorPalette.children[0].style.borderColor = 'gold';
catTab.appendChild(colorPalette);

const facePalette = document.createElement('div');
facePalette.style.cssText = 'display:flex; gap:6px; margin-bottom:15px; flex-wrap:wrap; justify-content:center; max-width: 350px;';
const faces = [
    { id: 'normal'}, { id: 'happy'}, { id: 'mad'}, { id: 'surprised'}, { id: 'meh'}, { id: 'crying'},
    { id: 'uwu'}, { id: 'derp'}, { id: 'cool'}, { id: 'derp2'}, { id: 'derp3'}, { id: 'derp4'},
    { id: 'derp5'}, { id: 'derp6'}, { id: 'derp7'}, { id: 'derp8'}, { id: 'derp9'}, { id: 'derp10'}
];

const faceCanvas = document.createElement('canvas');
faceCanvas.width = 128; faceCanvas.height = 128;
const fCtx = faceCanvas.getContext('2d');

faces.forEach(f => {
    let btn = document.createElement('button');
    
    drawFaceOnCanvas(fCtx, f.id);
    let dataURL = faceCanvas.toDataURL();

    btn.style.cssText = `width:32px; height:32px; border-radius:6px; background-color:#DDD; background-image:url(${dataURL}); background-size:80%; background-position:center; background-repeat:no-repeat; border:3px solid #555; cursor:pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.5); transition: transform 0.1s;`;
    
    btn.onclick = () => { 
        window.myFace = f.id; 
        previewCat.faceMesh.material.map = getFaceTexture(f.id);
        myMirrorCat.faceMesh.material.map = getFaceTexture(f.id); // MIRROR SYNC
        Array.from(facePalette.children).forEach(child => child.style.borderColor = '#555');
        btn.style.borderColor = 'gold';
    };
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    facePalette.appendChild(btn);
});
facePalette.children[0].style.borderColor = 'gold';
catTab.appendChild(facePalette);


// 2. WARDROBE TAB CONTENT
const slotRow = document.createElement('div');
slotRow.style.cssText = 'display:flex; gap:15px; margin-bottom: 15px;';
const slots = [];
for(let i=0; i<3; i++) {
    let slot = document.createElement('div');
    slot.style.cssText = 'width:50px; height:50px; border: 3px solid #555; border-radius: 8px; background: rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:24px; color:white; font-weight:bold;';
    slot.innerHTML = '+';
    slot.onclick = () => {
        window.activeSlot = i;
        slots.forEach(s => s.style.borderColor = '#555');
        slot.style.borderColor = 'cyan';
    };
    slots.push(slot);
    slotRow.appendChild(slot);
}
slots[0].style.borderColor = 'cyan';
wardrobeTab.appendChild(slotRow);

const itemRow = document.createElement('div');
itemRow.style.cssText = 'display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; justify-content:center;';
const items = [
    {id:'topHat', icon:'🎩'}, {id:'glasses', icon:'👓'}, {id:'sweater', icon:'👕'},
    {id:'boots', icon:'🥾'}, {id:'bowTie', icon:'🎀'}, {id:'beanie', icon:'🧢'},
    {id:'headband', icon:'🥽'}, {id:'monocle', icon:'🧐'}, {id:'scarf', icon:'🧣'},
    {id:'partyHat', icon:'🎉'}
];

items.forEach(item => {
    let btn = document.createElement('button');
    btn.innerHTML = item.icon;
    btn.style.cssText = 'width:40px; height:40px; border-radius:8px; background:#444; border:2px solid #555; cursor:pointer; font-size:20px;';
    btn.onclick = () => {
        window.myWardrobe[window.activeSlot] = { id: item.id, color: currentItemColor };
        slots[window.activeSlot].innerHTML = item.icon;
        applyWardrobeToCat(previewCat, window.myWardrobe);
        applyWardrobeToCat(myMirrorCat, window.myWardrobe); // MIRROR SYNC
    };
    itemRow.appendChild(btn);
});

const clearBtn = document.createElement('button');
clearBtn.innerHTML = '❌';
clearBtn.style.cssText = 'width:40px; height:40px; border-radius:8px; background:#622; border:2px solid #f44; cursor:pointer; font-size:16px;';
clearBtn.onclick = () => {
    window.myWardrobe[window.activeSlot] = null;
    slots[window.activeSlot].innerHTML = '+';
    applyWardrobeToCat(previewCat, window.myWardrobe);
    applyWardrobeToCat(myMirrorCat, window.myWardrobe); // MIRROR SYNC
};
itemRow.appendChild(clearBtn);
wardrobeTab.appendChild(itemRow);

// Item Color Picker
const itemColorRow = document.createElement('div');
itemColorRow.style.cssText = 'display:flex; gap:5px; flex-wrap:wrap; justify-content:center; padding-top: 10px; border-top: 1px solid #555; width: 100%;';
colors.forEach(c => {
    let btn = document.createElement('button');
    btn.style.cssText = `width:25px; height:25px; border-radius:50%; background:#${c.h.toString(16).padStart(6,'0')}; border:2px solid #555; cursor:pointer;`;
    btn.onclick = () => { 
        currentItemColor = c.h; 
        if (window.myWardrobe[window.activeSlot]) {
            window.myWardrobe[window.activeSlot].color = currentItemColor;
            applyWardrobeToCat(previewCat, window.myWardrobe);
            applyWardrobeToCat(myMirrorCat, window.myWardrobe); // MIRROR SYNC
        }
    };
    itemColorRow.appendChild(btn);
});
wardrobeTab.appendChild(itemColorRow);

// Tab Toggle Logic
catTabBtn.onclick = () => { catTab.style.display='flex'; wardrobeTab.style.display='none'; catTabBtn.style.borderColor='gold'; wardrobeTabBtn.style.borderColor='#555'; };
wardrobeTabBtn.onclick = () => { catTab.style.display='none'; wardrobeTab.style.display='flex'; catTabBtn.style.borderColor='#555'; wardrobeTabBtn.style.borderColor='gold'; };


const startBtn = document.createElement('button');
startBtn.id = 'playBtn';
startBtn.innerHTML = "PLAY";
startBtn.style.cssText = 'padding: 12px 50px; font-size: 24px; font-weight:900; background: gold; color: #111; border: none; border-radius: 8px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: transform 0.2s; margin-top:10px;';
startBtn.onmouseover = () => startBtn.style.transform = 'scale(1.05)';
startBtn.onmouseout = () => startBtn.style.transform = 'scale(1)';

startBtn.onclick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (listener.context.state === 'suspended') listener.context.resume();
    
    if (volumeState !== 0 && window.musicEnabled && !bgmAudio.isPlaying && bgmAudio.buffer) {
        bgmAudio.play();
    }
    
    let chosenName = nameInput.value.trim();
    socket.emit('joinGame', { name: chosenName, color: window.myBaseColor, face: window.myFace, wardrobe: window.myWardrobe });
    
    startScreen.style.display = 'none';
    isCustomizing = false;
    
    ignoreServerPositionUntil = Date.now() + 2000; 

    if (customizationZone && myPlayerObject.position.distanceTo(customizationZone) < 4) {
        myPlayerObject.position.set(0, -4, -12); 
        socket.emit('playerMovement', { 
            x: myPlayerObject.position.x, y: myPlayerObject.position.y, z: myPlayerObject.position.z,
            rY: myPlayerObject.rotation.y, moving: false, color: window.myBaseColor, role: myRole,
            emote: myEmote
        });
    }

    let mUI = document.getElementById('mobileUI');
    if (mUI) mUI.style.display = 'flex';
};
uiContainer.appendChild(startBtn);

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startBtn.onclick();
});

startScreen.appendChild(uiContainer);
document.body.appendChild(startScreen);
// ------------------------------------

const topBar = document.createElement('div');
topBar.id = 'topBar';
topBar.style.cssText = 'position:absolute; top:0; left:0; width:100%; padding:10px; box-sizing:border-box; display:flex; justify-content:space-between; align-items:stretch; z-index:100; pointer-events:none;';
document.body.appendChild(topBar);

const leftBox = document.createElement('div');
leftBox.id = 'leftBox';
leftBox.style.cssText = 'background:rgba(20,20,20,0.85); border:2px solid #444; border-radius:8px; padding:6px; box-shadow:0px 4px 10px rgba(0,0,0,0.5); pointer-events:auto; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; gap:4px; max-width:30%; overflow:hidden;';
leftBox.innerHTML = `<div style="color:white; font-size:12px; font-weight:900; letter-spacing:1px; margin-bottom:2px;">KITTY KAMO</div>`;

const soundBtnRow = document.createElement('div');
soundBtnRow.style.cssText = "display: flex; gap: 5px; flex-wrap: wrap;";

const muteBtn = document.createElement('button');
muteBtn.className = 'menu-btn'; muteBtn.innerHTML = VOL_EMOJIS[volumeState];
muteBtn.onclick = (e) => { 
    volumeState = (volumeState === 2) ? 1 : (volumeState === 1) ? 0 : 2;
    muteBtn.innerHTML = VOL_EMOJIS[volumeState]; 
    
    if (volumeState === 0) {
        if (bgmAudio.isPlaying) bgmAudio.pause();
    } else {
        bgmAudio.setVolume(volumeState === 1 ? 0.05 : 0.15); 
        if (window.musicEnabled && !bgmAudio.isPlaying && document.getElementById('startScreen').style.display === 'none') {
            bgmAudio.play();
        }
    }
    muteBtn.blur(); 
};
soundBtnRow.appendChild(muteBtn);

const helpBtn = document.createElement('button');
helpBtn.className = 'menu-btn'; helpBtn.innerHTML = '❓';
helpBtn.onclick = () => { 
    document.getElementById('helpModal').style.display = document.getElementById('helpModal').style.display === 'none' ? 'flex' : 'none'; 
    helpBtn.blur(); 
};
soundBtnRow.appendChild(helpBtn);

leftBox.appendChild(soundBtnRow);
topBar.appendChild(leftBox);

const centerBox = document.createElement('div');
centerBox.id = 'centerBox';
centerBox.style.cssText = 'background:rgba(20,20,20,0.85); border:2px solid #444; border-radius:8px; padding:6px; box-shadow:0px 4px 10px rgba(0,0,0,0.5); pointer-events:auto; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; flex:1; max-width:35%; margin:0 5px; overflow:hidden;';
topBar.appendChild(centerBox);

const rightBox = document.createElement('div');
rightBox.id = 'rightBox';
rightBox.style.cssText = 'background:rgba(20,20,20,0.85); border:2px solid #444; border-radius:8px; padding:6px; box-shadow:0px 4px 10px rgba(0,0,0,0.5); pointer-events:auto; display:flex; flex-direction:row; align-items:center; gap: 10px; color:white; min-width:20%; overflow:hidden; justify-content:space-between;';
rightBox.innerHTML = `<div></div><div></div>`; 
topBar.appendChild(rightBox);

const helpModal = document.createElement('div');
helpModal.id = 'helpModal';
helpModal.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:#222; border:4px solid #555; border-radius:12px; padding:20px; color:white; z-index:150; display:none; width:90%; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.8); flex-direction:column;';
helpModal.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
        <h2 style="margin: 0; font-size: 20px; font-weight:900; text-align: center; color: gold;">HOW TO PLAY</h2>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px; text-align: center; font-size: 12px;">
            <div style="margin-bottom: 8px; color: gold; font-weight: bold; font-size: 14px;">CONTROLS</div>
            <div style="line-height: 2;">
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">W A S D</b> Move &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">SPACE</b> Jump<br>
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">F</b> Meow &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777; color: gold;">E</b> Decoy &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777; color: #ff9999;">R</b> Hairball<br>
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">Q (hold)</b> Unstuck &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777; color: cyan;">1-5</b> Emotes
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 8px; color: #eee; font-size: 12px; line-height: 1.4;">
            <p style="margin: 0;"><b>HIDERS:</b> Stand perfectly still next to a block to copy its color. Shoot hairballs at Seekers to stun them!</p>
            <p style="margin: 0;"><b>SEEKERS:</b> Jump on the top of a Hider's head to tag them! (But don't jump too high over them!) Listen for Meows!</p>
            <p style="margin: 0; color: #ff6666; font-weight: bold;">When a Hider gets tagged, they become a Seeker!</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Meowing
            </div>
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Decoy Hit
            </div>
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Tagging
            </div>
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Hairball Hit
            </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 5px;">
            <button onclick="window.toggleMusic(this); this.blur();" style="flex: 1; padding: 8px; font-size: 14px; font-weight:bold; background: #4CAF50; color: #111; border: none; border-radius: 4px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🎵 MUSIC: ON</button>
            <button onclick="document.getElementById('helpModal').style.display='none'; this.blur();" style="flex: 1; padding: 8px; font-size: 14px; font-weight:bold; background: gold; color: #111; border: none; border-radius: 4px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">GOT IT!</button>
        </div>
    </div>
`;
document.body.appendChild(helpModal);

const blindfold = document.createElement('div');
blindfold.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:transparent; color:#ff4444; display:none; align-items:flex-start; justify-content:center; padding-top:25vh; font-weight:900; z-index:200; text-align:center; pointer-events:none; box-sizing:border-box;';
blindfold.innerHTML = `<div style="z-index:2; position:relative; text-shadow:2px 2px 0 #000; font-size: 24px;">YOU ARE THE SEEKER!<br><span style="font-size:16px; color:white;">GIVING HIDERS TIME TO HIDE...</span></div>`;
document.body.appendChild(blindfold);

function updateUI() {
    let roleText = myRole.toUpperCase();
    let roleColor = myRole === 'seeker' ? '#ff6666' : (myRole === 'spectator' ? '#AAAAAA' : '#66ff66');
    
    if (serverGameState === 'WAITING') {
        centerBox.innerHTML = `<div style="font-size:10px; color:#ddd; margin-bottom:2px;">YOU ARE: <b style="color:gold;">${myName}</b></div><div style="font-size:12px; color:#aaa; font-weight:bold;">WAITING FOR PLAYERS...</div>`;
        blindfold.style.display = 'none'; blindfoldStage.visible = false;
    } else if (serverGameState === 'LOBBY') {
        centerBox.innerHTML = `<div style="font-size:10px; color:#ddd; margin-bottom:2px;">YOU ARE: <b style="color:gold;">${myName}</b></div><div style="font-size:14px; font-weight:900; color:cyan; text-shadow:1px 1px 0 #000;">ENTER THE BEAM!</div><div style="font-size:12px; font-weight:bold; color:white;">STARTS IN ${serverTime}s</div>`;
        blindfold.style.display = 'none'; blindfoldStage.visible = false;
    } else if (serverGameState === 'BEAMING') {
        let isMe = beamingPlayerIds.includes(socket.id);
        centerBox.innerHTML = `<div style="font-size:16px; font-weight:900; color:gold; text-shadow:1px 1px 0 #000; margin-top:5px;">${isMe ? 'BEAMING UP!' : 'SPECTATING...'}</div>`;
        blindfold.style.display = 'none'; blindfoldStage.visible = false;
    } else if (serverGameState === 'GAME_OVER') {
        centerBox.innerHTML = `
            <div style="font-size:16px; font-weight:900; color:gold; margin-bottom:2px; text-shadow: 1px 1px 0 #000;">${serverWinReason}</div>
            <div style="font-size:10px; color:white; font-weight:bold;">NEXT ROUND IN ${serverTime}s</div>
        `;
        blindfold.style.display = 'none'; blindfoldStage.visible = false;
    } else if (myRole === 'spectator') {
        centerBox.innerHTML = `<div style="font-size:10px; color:#ddd; margin-bottom:2px;">YOU ARE: <b style="color:gold;">${myName}</b></div><div style="font-size:16px; font-weight:900; color:${roleColor}; line-height:1; margin-bottom:2px;">${roleText}</div><div style="font-size:10px; color:#aaa; font-weight:bold;">WAITING...</div>`;
        blindfold.style.display = 'none'; blindfoldStage.visible = false;
    } else {
        centerBox.innerHTML = `<div style="font-size:10px; color:#ddd; margin-bottom:2px;">YOU ARE: <b style="color:gold;">${myName}</b></div><div style="font-size:16px; font-weight:900; color:${roleColor}; line-height:1; margin-bottom:2px;">${roleText}</div><div style="font-size:12px; font-weight:bold; color:white;">${serverGameState} - ${serverTime}s</div>`;
        if (myRole === 'seeker' && serverGameState === 'HIDING') {
            blindfold.style.display = 'flex'; blindfoldStage.visible = true;    
        } else {
            blindfold.style.display = 'none'; blindfoldStage.visible = false;
        }
    }
}

function updateRightBox(leaderboardData) {
    let invHTML = `
        <div style="text-align:left; display:flex; flex-direction:column; justify-content:center; color:#00FFFF; font-size:10px; font-weight:bold; min-width:80px; text-shadow: 1px 1px 0 #000;">
            <div>DECOYS: <span style="color:gold;">${myDecoys}</span></div>
            <div>HAIRBALLS: <span style="color:gold;">${myHairballs}</span></div>
        </div>
    `;

    let lbText = `<div style="text-align:right; flex:1;"><div style="font-weight:900; font-size:10px; margin-bottom:2px; color:#ddd;">SURVIVAL TIME</div>`;
    
    if (leaderboardData && leaderboardData.length > 0) {
        let p1 = leaderboardData[0];
        let c1 = (p1.id === serverWinnerId) ? '👑 ' : '';
        lbText += `<div style="font-size:9px; line-height:1.4;">1. ${c1}${p1.name} : <b style="color:gold;">${p1.score}s</b></div>`;

        if (leaderboardData.length > 1) {
            let myRank = leaderboardData.findIndex(p => p.id === socket.id);
            if (myRank === 0) {
                let p2 = leaderboardData[1];
                let c2 = (p2.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">2. ${c2}${p2.name} : <b style="color:gold;">${p2.score}s</b></div>`;
            } else if (myRank > 0) {
                let myP = leaderboardData[myRank];
                let myC = (myP.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">${myRank + 1}. ${myC}${myP.name} : <b style="color:gold;">${myP.score}s</b></div>`;
            } else {
                let p2 = leaderboardData[1];
                let c2 = (p2.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">2. ${c2}${p2.name} : <b style="color:gold;">${p2.score}s</b></div>`;
            }
        } else {
            lbText += `<div style="font-size:9px; line-height:1.4; color:#777;">...</div>`;
        }
    } else {
        lbText += `<div style="font-size:9px; line-height:1.4; color:#777;">...</div>`;
    }
    lbText += `</div>`;

    rightBox.innerHTML = invHTML + lbText;
}

socket.on('gameStateUpdate', (data) => {
    let wasNotGameOver = serverGameState !== 'GAME_OVER';
    serverGameState = data.state;
    serverTime = data.time;
    serverWinnerId = data.winnerId;
    serverWinReason = data.winReason;
    updateUI();

    if (serverGameState === 'SEEKING' && serverTime <= 10 && serverTime > 0 && serverTime !== lastTickTime) {
        playSound('tick'); lastTickTime = serverTime;
    }

    if (serverGameState === 'LOBBY' || serverGameState === 'WAITING' || serverGameState === 'GAME_OVER') {
        ground.material.color.setHex(0x654321); 
    } else {
        ground.material.color.setHex(0x4CAF50); 
    }

    updateRightBox(data.leaderboard);
});

socket.on('beamingPlayers', (ids) => {
    beamingPlayerIds = ids;
});

socket.on('forceTeleport', (data) => {
    myPlayerObject.position.set(data.x, data.y, data.z);
    myPlayerObject.rotation.y = data.rY;
    velocityY = 0;
});

socket.on('initMap', (mapBlocks) => {
    mapObjects.forEach(mesh => scene.remove(mesh)); mapObjects.length = 0;
    walls.forEach(mesh => scene.remove(mesh)); walls.length = 0;
    invisibleWalls.forEach(mesh => scene.remove(mesh)); invisibleWalls.length = 0;
    
    lobbyVisuals.forEach(v => scene.remove(v));
    lobbyVisuals.length = 0;
    lobbyCollision.length = 0;

    customizationZone = null;

    myDecoyUsed = false; 
    
    Object.keys(activeDecoys).forEach(dId => {
        scene.remove(activeDecoys[dId].group); delete activeDecoys[dId];
    });

    activeHairballs.forEach(hb => scene.remove(hb.mesh));
    activeHairballs.length = 0;

    mapBlocks.forEach(b => createBlock(b.x, b.y, b.z, b.color));

    scene.updateMatrixWorld(true);

    if (mapBlocks.length > 0) {
        const minX = Math.min(...mapBlocks.map(b => b.x));
        const maxX = Math.max(...mapBlocks.map(b => b.x));
        const minZ = Math.min(...mapBlocks.map(b => b.z));
        const maxZ = Math.max(...mapBlocks.map(b => b.z));

        const wX = (maxX - minX) + 3; 
        const wZ = (maxZ - minZ) + 3; 
        
        ground.scale.set(wX, wZ, 1);
        ground.position.set((minX + maxX) / 2, -5, (minZ + maxZ) / 2);
        ground.material.color.setHex(0x4CAF50); 

        // Flush boundary walls 10 blocks high!
        createWall(wX, 10, 2, (minX + maxX) / 2, 0, minZ - 0.5, 0x8B4513);
        createWall(wX, 10, 2, (minX + maxX) / 2, 0, maxZ + 0.5, 0x8B4513);
        
        const sideDepth = (maxZ - minZ) - 1; 
        createWall(2, 10, sideDepth, minX - 0.5, 0, (minZ + maxZ) / 2, 0x8B4513);
        createWall(2, 10, sideDepth, maxX + 0.5, 0, (minZ + maxZ) / 2, 0x8B4513);
        
        createInvisibleWall(wX, 40, 2, (minX + maxX) / 2, 25, minZ - 0.5);
        createInvisibleWall(wX, 40, 2, (minX + maxX) / 2, 25, maxZ + 0.5);
        createInvisibleWall(2, 40, sideDepth, minX - 0.5, 25, (minZ + maxZ) / 2);
        createInvisibleWall(2, 40, sideDepth, maxX + 0.5, 25, (minZ + maxZ) / 2);
    } else {
        // FLAT LOBBY
        // Expand the ground slightly to ensure the reflection room has a floor
        ground.scale.set(43, 50, 1);
        ground.position.set(0, -5, 3.5);
        ground.material.color.setHex(0x654321); 
        
        // Front wall
        createWall(43, 2, 2, 0, -4, -20.5, 0x8B4513); 
        
        // Back wall with gap cut out for the Mirror Room
        createWall(18.5, 2, 2, -12.25, -4, 20.5, 0x8B4513); // Left side
        createWall(18.5, 2, 2, 12.25, -4, 20.5, 0x8B4513);  // Right side

        // --- MIRROR HOUSE (Building physical mirrored room) ---
        // Left wall
        createWall(1, 4, 8, -2.5, -3, 21.5, 0x8B4513); 
        // Right wall
        createWall(1, 4, 8, 2.5, -3, 21.5, 0x8B4513); 
        // Roof
        createWall(7, 1, 10, 0, -0.5, 21.5, 0xAA4A44); 
        // Far back wall to seal the reflection room nicely
        createWall(6, 4, 1, 0, -3, 25.5, 0x8B4513); 
        
        // Invisible collision to stop player walking into the mirror glass
        createInvisibleWall(4, 4, 1, 0, -3, 19.5); 
        
        // Mirror Glass (Scaled down slightly to 3.98x3.98 to avoid Z-fighting with floor/ceiling)
        const glassGeo = new THREE.PlaneGeometry(3.98, 3.98);
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0, -3, 19.5); 
        glass.rotation.y = Math.PI; 
        scene.add(glass);
        lobbyVisuals.push(glass);
        // --------------------

        createWall(2, 2, 39, -20.5, -4, 0, 0x8B4513); // Left Side Wall
        createWall(2, 2, 39, 20.5, -4, 0, 0x8B4513);  // Right Side Wall

        createInvisibleWall(43, 40, 2, 0, 17, -20.5);
        createInvisibleWall(43, 40, 2, 0, 17, 20.5);
        createInvisibleWall(2, 40, 39, -20.5, 17, 0);
        createInvisibleWall(2, 40, 39, 20.5, 17, 0);

        createCatBed(15, 8, 0xFF69B4);
        createCatBed(15, -8, 0x4169E1);
        createCatBed(-15, 8, 0xFFD700);
        createCatBed(-15, -8, 0x8A2BE2);
        createCatBed(8, 15, 0x00FFFF);
        createCatBed(-8, 15, 0xFF00FF);
        createCatBed(8, -15, 0xFF8C00);
        createCatBed(-8, -15, 0x00FF00);

        createCatTree(0, 0, 1);
        createCatTree(14, 14, 2);
        createCatTree(-14, -14, 3);

        createWall(6, 4, 1, 0, -3, -19.5, 0x8B4513); 
        createWall(1, 4, 4, -2.5, -3, -18, 0x8B4513); 
        createWall(1, 4, 4, 2.5, -3, -18, 0x8B4513); 
        createWall(7, 1, 6, 0, -0.5, -18.5, 0xAA4A44); 

        // New Open-Front Crown MVP Podium structure
        createWall(4, 1.5, 4, 17.5, -4.25, -17.5, 0xFFD700); // Base
        createWall(0.8, 1.2, 0.8, 17.5 + 1.6, -2.9, -17.5 - 1.6, 0xFFD700); // Back corner
        createWall(0.8, 1.2, 0.8, 17.5 + 1.6, -2.9, -17.5 + 1.6, 0xFFD700); // Right corner
        createWall(0.8, 1.2, 0.8, 17.5 - 1.6, -2.9, -17.5 - 1.6, 0xFFD700); // Left corner
        createWall(0.8, 0.6, 0.8, 17.5 + 1.6, -3.2, -17.5, 0xFFD700); // Back-right middle
        createWall(0.8, 0.6, 0.8, 17.5, -3.2, -17.5 - 1.6, 0xFFD700); // Back-left middle

        createCraftingTable(0, -18.4);
        
        const padGeo = new THREE.BoxGeometry(4, 0.1, 4);
        const padMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(0, -4.95, -18);
        scene.add(pad);
        lobbyVisuals.push(pad);

        createClosedBox(1.5, 1.5, 1.5, -4.5, -4.25, 0, Math.PI/6); 
        createClosedBox(1.5, 1.5, 1.5, 11.5, -4.25, 14, -Math.PI/8);
        createClosedBox(1.5, 1.5, 1.5, -10.5, -4.25, -11.5, Math.PI/4);
        
        createOpenBox(3.5, 1.5, 3.5, -8, -4.25, -4, 0); 
        createOpenBox(3.5, 1.5, 3.5, 10, -4.25, -6, 0);
        createOpenBox(3.5, 1.5, 3.5, -10, -4.25, 6, 0);

        createClosedBox(1.5, 1.5, 1.5, -6, -4.25, -8, Math.PI/3);
        createClosedBox(1.2, 1.2, 1.2, 13, -4.4, -4, Math.PI/7);
        createClosedBox(1.5, 1.5, 1.5, 0, -4.25, 10, Math.PI/6);

        customizationZone = new THREE.Vector3(0, -5, -18);
    }
});

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id === socket.id) {
            if (myRole === 'hider' && players[id].role === 'seeker') {
                playCatMeow(myCatData); 
                explodeParticles(myPlayerObject.position, true);
                playSound('tag');
            }
            myRole = players[id].role; myName = players[id].name; 
            myHairballs = players[id].hairballs;
            myDecoys = players[id].decoys;
            amIStunned = players[id].stunned;

            myCatData.material.color.setHex(players[id].color);
            myCatData.faceMesh.material.map = getFaceTexture(players[id].face || 'normal');
            myCatData.faceStr = players[id].face || 'normal'; 
            
            let cColor = (players[id].color === 0xFFFFFF || players[id].color === 0xFF0000) ? 0xFFD700 : players[id].color;
            myCatData.crownMat.color.setHex(cColor);

            setNameLabel(myCatData, myName); 
            myCatData.crown.visible = (id === serverWinnerId);
            
            // WARDROBE APPLY FOR YOU
            applyWardrobeToCat(myCatData, players[id].wardrobe);

            updateRightBox(null);
        } else { 
            if (otherPlayers[id]) {
                if (otherPlayers[id].role === 'hider' && players[id].role === 'seeker') {
                    playCatMeow(otherPlayers[id]); 
                    explodeParticles(otherPlayers[id].group.position, true);
                    playSound('tag');
                }
                otherPlayers[id].role = players[id].role;
                otherPlayers[id].material.color.setHex(players[id].color);
                otherPlayers[id].stunned = players[id].stunned;
                otherPlayers[id].baseColor = players[id].baseColor;
                otherPlayers[id].faceMesh.material.map = getFaceTexture(players[id].face || 'normal');
                otherPlayers[id].faceStr = players[id].face || 'normal'; 
                
                let oColor = (players[id].color === 0xFFFFFF || players[id].color === 0xFF0000) ? 0xFFD700 : players[id].color;
                otherPlayers[id].crownMat.color.setHex(oColor);

                otherPlayers[id].crown.visible = (id === serverWinnerId);
                
                setNameLabel(otherPlayers[id], players[id].name);
                
                // WARDROBE APPLY FOR OTHER PLAYERS
                applyWardrobeToCat(otherPlayers[id], players[id].wardrobe);
                if(otherMirrorCats[id]) applyWardrobeToCat(otherMirrorCats[id], players[id].wardrobe);

            } else { addOtherPlayer(id, players[id]); }
        }
    });
    updateUI(); 
});

socket.on('inventoryUpdate', (data) => {
    myDecoys = data.decoys;
    myHairballs = data.hairballs;
    updateRightBox(null);
});

socket.on('newPlayer', (data) => addOtherPlayer(data.id, data.player));
socket.on('playerMoved', (data) => {
    if (otherPlayers[data.id]) {
        otherPlayers[data.id].group.position.set(data.x, data.y, data.z);
        otherPlayers[data.id].group.rotation.y = data.rY;
        otherPlayers[data.id].moving = data.moving;
        otherPlayers[data.id].material.color.setHex(data.color); 
        otherPlayers[data.id].emote = data.emote;
        otherPlayers[data.id].stunned = data.stunned;
        
        let oColor = (data.color === 0xFFFFFF || data.color === 0xFF0000) ? 0xFFD700 : data.color;
        otherPlayers[data.id].crownMat.color.setHex(oColor);

        otherPlayers[data.id].role = data.role; 
    }
});

socket.on('playerDisconnected', (id) => { 
    if (otherPlayers[id]) { 
        scene.remove(otherPlayers[id].group); 
        delete otherPlayers[id]; 
    } 
    if (otherMirrorCats[id]) { 
        scene.remove(otherMirrorCats[id].group); 
        delete otherMirrorCats[id]; 
    }
});

socket.on('playerStunned', (id) => {
    if (id === socket.id) amIStunned = true;
    else if (otherPlayers[id]) otherPlayers[id].stunned = true;
});

socket.on('playerUnstunned', (id) => {
    if (id === socket.id) amIStunned = false;
    else if (otherPlayers[id]) otherPlayers[id].stunned = false;
});

socket.on('playerTaunted', (taunterId) => {
    if (otherPlayers[taunterId]) {
        playCatMeow(otherPlayers[taunterId]);
    }
});

socket.on('spawnDecoy', (data) => {
    const decoy = createCatSculpt(data.color, data.face);
    decoy.group.position.set(data.x, data.y, data.z);
    decoy.group.rotation.y = data.rY;
    scene.add(decoy.group);
    activeDecoys[data.id] = decoy;
});

socket.on('decoyPopped', (decoyId) => {
    if (activeDecoys[decoyId]) {
        playSound('pop'); 
        explodeParticles(activeDecoys[decoyId].group.position, false); 
        scene.remove(activeDecoys[decoyId].group);
        delete activeDecoys[decoyId];
    }
});

socket.on('spawnHairball', (data) => {
    const hbGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2); 
    const hbMat = new THREE.MeshLambertMaterial({color: 0x6B4226}); 
    const hbMesh = new THREE.Mesh(hbGeo, hbMat);
    hbMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(hbGeo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
    hbMesh.position.set(data.x, data.y, data.z);
    scene.add(hbMesh);
    activeHairballs.push({ mesh: hbMesh, dirX: data.dirX, dirZ: data.dirZ, id: data.id, ownerId: data.ownerId, distance: 0 });
});

function addOtherPlayer(id, playerInfo) {
    if (otherPlayers[id]) scene.remove(otherPlayers[id].group);
    if (otherMirrorCats[id]) scene.remove(otherMirrorCats[id].group); // clean up existing mirror if needed

    const catData = createCatSculpt(playerInfo.color, playerInfo.face || 'normal');
    catData.group.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    catData.group.rotation.y = playerInfo.rY;
    catData.role = playerInfo.role; 
    catData.emote = playerInfo.emote || 0;
    catData.stunned = playerInfo.stunned || false;
    catData.baseColor = playerInfo.baseColor || 0xFFFFFF; 
    catData.faceStr = playerInfo.face || 'normal';

    setNameLabel(catData, playerInfo.name); 
    catData.crown.visible = (id === serverWinnerId);
    
    let oColor = (playerInfo.color === 0xFFFFFF || playerInfo.color === 0xFF0000) ? 0xFFD700 : playerInfo.color;
    catData.crownMat.color.setHex(oColor);

    applyWardrobeToCat(catData, playerInfo.wardrobe);

    scene.add(catData.group);
    otherPlayers[id] = catData;

    // Generate specific mirror cat for this player
    const mCat = createCatSculpt(playerInfo.color, playerInfo.face || 'normal');
    mCat.group.visible = false;
    let omBeam = mCat.group.getObjectByName('dBeam');
    if (omBeam) omBeam.visible = false;
    applyWardrobeToCat(mCat, playerInfo.wardrobe);
    scene.add(mCat.group);
    otherMirrorCats[id] = mCat;
}

function checkCollision(pos) {
    const pBox = new THREE.Box3();
    const currentScaleY = myCatData.body.scale.y; 
    pBox.setFromCenterAndSize(new THREE.Vector3(pos.x, pos.y + ((1.2 * currentScaleY)/2), pos.z), new THREE.Vector3(0.5, 1.2 * currentScaleY, 0.5));
    
    for (let i = 0; i < mapObjects.length; i++) {
        const bBox = new THREE.Box3().setFromObject(mapObjects[i]); bBox.expandByScalar(-0.02);
        if (pBox.intersectsBox(bBox)) return true;
    }
    
    for (let i = 0; i < walls.length; i++) {
        const wBox = new THREE.Box3().setFromObject(walls[i]); wBox.expandByScalar(-0.02);
        if (pBox.intersectsBox(wBox)) return true;
    }

    for (let i = 0; i < invisibleWalls.length; i++) {
        const wBox = new THREE.Box3().setFromObject(invisibleWalls[i]); wBox.expandByScalar(-0.02);
        if (pBox.intersectsBox(wBox)) return true;
    }

    for (let i = 0; i < lobbyCollision.length; i++) {
        const propBox = new THREE.Box3().setFromObject(lobbyCollision[i]); propBox.expandByScalar(-0.02);
        if (pBox.intersectsBox(propBox)) return true;
    }

    // Player-to-Player collision added here
    for (let id in otherPlayers) {
        let other = otherPlayers[id];
        if (other.role !== 'spectator') {
            const oScaleY = other.body.scale.y || 1;
            const oBox = new THREE.Box3();
            oBox.setFromCenterAndSize(
                new THREE.Vector3(other.group.position.x, other.group.position.y + ((1.2 * oScaleY)/2), other.group.position.z),
                new THREE.Vector3(0.5, 1.2 * oScaleY, 0.5)
            );
            oBox.expandByScalar(-0.02); // Prevent permanent sticking
            if (pBox.intersectsBox(oBox)) return true;
        }
    }

    return false;
}

const keys = { w: false, a: false, s: false, d: false, ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, " ": false };

document.addEventListener('keydown', (e) => { 
    if (document.activeElement.tagName === 'INPUT') return;

    if(keys.hasOwnProperty(e.key)) keys[e.key] = true; 
    
    if (e.key.toLowerCase() === 'q') isQPressed = true;
    
    if (['1','2','3','4','5'].includes(e.key)) {
        myEmote = parseInt(e.key);
    }
    
    if(e.key.toLowerCase() === 'f') {
        if (serverGameState === 'LOBBY' || serverGameState === 'WAITING' || serverGameState === 'GAME_OVER' || Date.now() - lastTauntTime > 5000) { 
            if (serverGameState !== 'LOBBY' && serverGameState !== 'WAITING' && serverGameState !== 'GAME_OVER') {
                lastTauntTime = Date.now();
            }
            if (myRole === 'hider' && serverGameState === 'SEEKING') {
                socket.emit('taunt'); 
            } else if (serverGameState === 'WAITING' || serverGameState === 'LOBBY' || serverGameState === 'GAME_OVER') {
                socket.emit('lobbyMeow'); 
            }
            playCatMeow(myCatData); 
        }
    }
    
    if(e.key.toLowerCase() === 'e') {
        if (myRole === 'hider' && serverGameState === 'SEEKING' && myDecoys > 0) {
            myDecoys--;
            updateRightBox(null);
            let targetColor = myCatData.material.color.getHex();
            socket.emit('dropDecoy', { 
                x: myPlayerObject.position.x, y: myPlayerObject.position.y, z: myPlayerObject.position.z, 
                rY: myPlayerObject.rotation.y, color: targetColor 
            });
        }
    }

    if(e.key.toLowerCase() === 'r') {
        if (myRole === 'hider' || serverGameState === 'GAME_OVER') {
            let canShoot = false;

            if (serverGameState === 'SEEKING' && myHairballs > 0) {
                myHairballs--;
                updateRightBox(null);
                canShoot = true;
            } else if (serverGameState === 'LOBBY' || serverGameState === 'WAITING' || serverGameState === 'GAME_OVER') {
                canShoot = true; 
            }

            if (canShoot) {
                playSound('spit');
                let dirX = -Math.sin(myPlayerObject.rotation.y);
                let dirZ = -Math.cos(myPlayerObject.rotation.y);
                socket.emit('shootHairball', { 
                    x: myPlayerObject.position.x, y: myPlayerObject.position.y + 0.5, z: myPlayerObject.position.z, 
                    dirX: dirX, dirZ: dirZ 
                });
            }
        }
    }
});

document.addEventListener('keyup', (e) => { 
    if(keys.hasOwnProperty(e.key)) keys[e.key] = false; 
    if(e.key.toLowerCase() === 'q') isQPressed = false;
});

const moveSpeed = 0.28; 
const turnSpeed = 0.13; 
let velocityY = 0; 
let isGrounded = true; 
const gravity = -0.016; 
const jumpStrength = 0.35; 

function resetCatPose(cat) {
    cat.head.position.set(0, 0.7, -0.4); cat.head.rotation.set(0, cat.head.rotation.y, 0);
    cat.legs[0].position.set(0.15, 0.15, 0.3);
    cat.legs[1].position.set(-0.15, 0.15, 0.3);
    cat.legs[2].position.set(0.15, 0.15, -0.3);
    cat.legs[3].position.set(-0.15, 0.15, -0.3);
    cat.legs.forEach(l => l.rotation.set(0,0,0));
    cat.tail.rotation.set(0, cat.tail.rotation.y, 0);
    cat.body.rotation.x = 0;
    cat.body.rotation.z = 0; 
    cat.body.position.y = 0; 
}

function animateCat(cat, emote, walkTime) {
    resetCatPose(cat);

    if (cat.stunned) {
        cat.body.rotation.z = Math.sin(performance.now() / 20) * 0.2;
        cat.head.rotation.x = Math.sin(performance.now() / 30) * 0.5;
        cat.legs.forEach(l => l.rotation.x = (Math.random() - 0.5) * 1);
        return; 
    }

    if (emote === 1) { 
        cat.body.position.y = -0.1; 
        cat.body.rotation.x = Math.PI / 8; 
        cat.head.position.y = 0.5;
        cat.head.rotation.x = -Math.PI / 8; 
        
        cat.legs[0].position.set(0.15, 0.15, 0.3);
        cat.legs[0].rotation.x = -Math.PI / 8; 
        cat.legs[1].position.set(-0.15, 0.15, 0.3);
        cat.legs[1].rotation.x = -Math.PI / 8;
        
        cat.legs[2].position.set(0.15, 0.15, -0.35); 
        cat.legs[2].rotation.z = 0;
        cat.legs[2].rotation.x = Math.PI / 2.2; 
        
        cat.legs[3].position.set(-0.15, 0.15, -0.35);
        cat.legs[3].rotation.z = 0;
        cat.legs[3].rotation.x = Math.PI / 2.2; 
        
    } else if (emote === 2) { 
        cat.body.position.y = 0.4;
        cat.body.rotation.x = -Math.PI / 2.5; 
        cat.head.rotation.x = Math.PI / 2.5; 
        
        cat.legs[2].rotation.x = Math.PI / 2.5;
        cat.legs[3].rotation.x = Math.PI / 2.5;
        
        cat.legs[0].rotation.x = Math.PI / 6 + Math.sin(walkTime * 4) * 0.4;
        cat.legs[1].rotation.x = Math.PI / 6 + Math.sin(walkTime * 4 + Math.PI) * 0.4;
        cat.tail.rotation.x = Math.PI / 4;
    } else if (emote === 3) { 
        cat.body.position.y = -0.15;
        cat.body.rotation.x = Math.PI / 8;
        cat.head.position.y = 0.5;
        cat.legs[0].rotation.x = -Math.PI / 3;
        cat.legs[1].rotation.x = -Math.PI / 3;
        cat.legs[2].rotation.x = Math.PI / 4;
        cat.legs[3].rotation.x = Math.PI / 4;
        cat.tail.rotation.x = Math.PI / 4;
    } else if (emote === 4) { 
        cat.head.rotation.x = -Math.PI / 6;
        cat.legs[0].rotation.x = -Math.PI / 2 + Math.sin(walkTime * 3) * 0.8;
        cat.body.position.y = 0.1;
        cat.body.rotation.x = -Math.PI / 8;
    } else if (emote === 5) { 
        cat.body.position.y = 0.3; 
        cat.body.rotation.x = Math.PI / 3; 
        cat.head.rotation.x = -Math.PI / 4; 
        
        cat.legs[0].rotation.x = -Math.PI / 3; 
        cat.legs[1].rotation.x = -Math.PI / 3;
        
        cat.legs[2].rotation.x = Math.PI / 2.5 + Math.sin(walkTime * 1.5) * 0.3; 
        cat.legs[3].rotation.x = Math.PI / 2.5 + Math.sin(walkTime * 1.5 + Math.PI) * 0.3;
        cat.tail.rotation.x = -Math.PI / 4;
    } else { 
        if (cat.moving || walkTime > 0) {
            cat.legs[0].rotation.x = Math.sin(walkTime) * 0.5;
            cat.legs[1].rotation.x = -Math.sin(walkTime) * 0.5;
            cat.legs[2].rotation.x = -Math.sin(walkTime) * 0.5;
            cat.legs[3].rotation.x = Math.sin(walkTime) * 0.5;
        }
    }
}

let mvpEmoteTimer = 0;
let currentMvpEmote = 1;

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    if (now - lastRenderTime < fpsInterval) return; 
    lastRenderTime = now - (now % fpsInterval);

    if (document.getElementById('startScreen').style.display !== 'none') {
        previewCat.group.visible = true;

        previewCat.material.color.setHex(window.myBaseColor);
        previewCat.faceMesh.material.map = getFaceTexture(window.myFace);
        previewCat.crown.visible = false;
        if(previewCat.nameSprite) previewCat.nameSprite.visible = false;
        
        animateCat(previewCat, 0, 0); 
        
        previewCat.group.position.set(0, 100, 0);
        previewCat.group.rotation.y += 0.015;

        camera.position.set(0, 98.0, 4.5); 
        camera.lookAt(0, 99.0, 0);
        
        renderer.render(scene, camera);
        return; 
    } 

    let isGameOver = serverGameState === 'GAME_OVER';
    let isMVPGameOver = (isGameOver && serverWinnerId === socket.id);

    if (!isCustomizing && customizationZone && (serverGameState === 'LOBBY' || serverGameState === 'WAITING')) {
        if (myPlayerObject.position.distanceTo(customizationZone) < 2.5) {
            isCustomizing = true;
            document.getElementById('startScreen').style.display = 'flex';
            document.getElementById('playBtn').innerHTML = 'SAVE & EXIT';
            previewCat.group.rotation.y = 0; 
        }
    }

    previewCat.group.visible = false;
    myCatData.group.visible = myRole !== 'spectator';

    // --- MIRROR LOGIC (LOCAL PLAYER) ---
    if ((serverGameState === 'LOBBY' || serverGameState === 'WAITING')) {
        let distToMirror = mirrorZ - myPlayerObject.position.z;
        
        if (distToMirror > 0 && distToMirror <= 5.0 && Math.abs(myPlayerObject.position.x) < 4.0 && myPlayerObject.position.y < -1) {
            myMirrorCat.group.visible = true;
            
            myMirrorCat.group.position.x = myPlayerObject.position.x;
            myMirrorCat.group.position.y = myPlayerObject.position.y;
            myMirrorCat.group.position.z = mirrorZ + distToMirror; 
            
            myMirrorCat.group.rotation.y = Math.PI - myPlayerObject.rotation.y;
            
            myMirrorCat.material.color.setHex(myCatData.material.color.getHex());
            myMirrorCat.faceMesh.material.map = myCatData.faceMesh.material.map;
            myMirrorCat.body.scale.copy(myCatData.body.scale);
            if (myMirrorCat.nameSprite) myMirrorCat.nameSprite.visible = false;
            
            let mBeam = myMirrorCat.group.getObjectByName('dBeam');
            if (mBeam) mBeam.visible = false; 
            myMirrorCat.dBeamMat.opacity = 0;

            let globalTime = performance.now() / 136;
            let isBeaming = (serverGameState === 'BEAMING' && beamingPlayerIds.includes(socket.id));
            
            animateCat(myMirrorCat, isBeaming ? 3 : myEmote, (myEmote > 0 || isBeaming) ? globalTime : myWalkTime);
            myMirrorCat.tail.rotation.y = -Math.sin(myTailTime) * 0.3; 
            
            let op = 1.0 - ((distToMirror - 1.0) / 4.0);
            op = Math.max(0.0, Math.min(1.0, op)); 
            
            myMirrorCat.group.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = op;
                }
                if (child.isLineSegments && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = op * 0.3; 
                }
            });
            
            if (op <= 0) myMirrorCat.group.visible = false;
            
        } else {
            myMirrorCat.group.visible = false;
        }
    } else {
        myMirrorCat.group.visible = false;
    }
    // --------------------

    // Update Confetti Physics
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
        let p = confettiParticles[i];
        p.position.add(p.vel);
        p.rotation.x += p.rotVel.x; p.rotation.y += p.rotVel.y; p.rotation.z += p.rotVel.z;
        if (p.position.y < -4.9 || !isGameOver) {
            scene.remove(p);
            confettiParticles.splice(i, 1);
        }
    }

    if (isGameOver) {
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.PlaneGeometry(0.3, 0.3);
            const mat = new THREE.MeshBasicMaterial({ color: confettiColors[Math.floor(Math.random() * confettiColors.length)], side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(17.5 + (Math.random() - 0.5) * 10, 5 + Math.random() * 5, -17.5 + (Math.random() - 0.5) * 10);
            mesh.rotation.set(Math.random(), Math.random(), Math.random());
            mesh.vel = new THREE.Vector3((Math.random() - 0.5) * 0.1, -0.1 - Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
            mesh.rotVel = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
            scene.add(mesh);
            confettiParticles.push(mesh);
        }

        if (isMVPGameOver) {
            if (now > mvpEmoteTimer) {
                currentMvpEmote = Math.floor(Math.random() * 5) + 1;
                mvpEmoteTimer = now + 1500;
            }
            myEmote = currentMvpEmote; 
        }
    }

    myPlayerObject.rotation.x = 0;
    myPlayerObject.rotation.z = 0;

    let cycleProgress = 0;
    if (serverGameState === 'SEEKING') {
        cycleProgress = Math.max(0, Math.min(1, (60 - serverTime) / 60)); 
    } else if (serverGameState === 'WAITING') {
        let timeLoop = (Date.now() % 60000) / 60000; 
        cycleProgress = Math.abs(timeLoop * 2 - 1); 
    } else {
        cycleProgress = 0; 
    }

    let sunX = 40 - (80 * cycleProgress); 
    sunLight.position.set(sunX, 40, 20);  
    if (cycleProgress < 0.7) {
        let p = cycleProgress / 0.7;
        scene.background.lerpColors(colorDay, colorSunset, p);
        starMat.opacity = 0; 
    } else {
        let p = (cycleProgress - 0.7) / 0.3;
        scene.background.lerpColors(colorSunset, colorNight, p);
        starMat.opacity = p; 
    }
    
    let dimFactor = 1 - (0.15 * cycleProgress); 
    sunLight.intensity = 0.35 * dimFactor;
    ambientLight.intensity = 0.75 * dimFactor;

    stars.rotation.y += 0.0003; 

    beamMesh.visible = (serverGameState === 'LOBBY' || serverGameState === 'BEAMING');
    beamLight.visible = beamMesh.visible;
    beamGroundMesh.visible = beamMesh.visible;
    if (beamMesh.visible) {
        let glowOsc = 0.4 + Math.sin(performance.now() / 150) * 0.2;
        beamMat.opacity = glowOsc; 
        beamMesh.rotation.y += 0.01;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.position.add(p.velocity); p.velocity.y -= 0.02; p.scale.multiplyScalar(0.9); 
        if (p.scale.x < 0.01) { scene.remove(p); particles.splice(i, 1); }
    }

    for (let i = activeHairballs.length - 1; i >= 0; i--) {
        let hb = activeHairballs[i];
        
        hb.mesh.position.x += hb.dirX * 0.6;
        hb.mesh.position.z += hb.dirZ * 0.6;

        hb.distance = (hb.distance || 0) + 0.6;

        if (hb.distance > 10) {
            hb.velocityY = (hb.velocityY || 0) - 0.032; 
            hb.mesh.position.y += hb.velocityY;
        }

        let hitWall = false;
        let hitSeekerId = null;

        if (hb.mesh.position.y <= -4.8) hitWall = true;
        if (Math.abs(hb.mesh.position.x) > 30 || Math.abs(hb.mesh.position.z) > 30) hitWall = true;

        const hbBox = new THREE.Box3().setFromObject(hb.mesh);

        if (!hitWall) {
            for(let j=0; j<mapObjects.length; j++){
               if(hbBox.intersectsBox(new THREE.Box3().setFromObject(mapObjects[j]))) { hitWall = true; break; }
            }
            if(!hitWall){
               for(let j=0; j<walls.length; j++){
                  if(hbBox.intersectsBox(new THREE.Box3().setFromObject(walls[j]))) { hitWall = true; break; }
               }
            }
        }

        if (!hitWall) {
            if (hb.ownerId !== socket.id) {
                let myBox = new THREE.Box3();
                const currentScaleY = myCatData.body.scale.y; 
                myBox.setFromCenterAndSize(new THREE.Vector3(myPlayerObject.position.x, myPlayerObject.position.y + ((1.2 * currentScaleY)/2), myPlayerObject.position.z), new THREE.Vector3(0.6, 1.2 * currentScaleY, 0.6));
                
                if (hbBox.intersectsBox(myBox)) {
                    hitWall = true;
                }
            }
            
            Object.keys(otherPlayers).forEach(id => {
                if (id !== hb.ownerId) { 
                    let sBox = new THREE.Box3().setFromObject(otherPlayers[id].group);
                    if (hbBox.intersectsBox(sBox)) {
                        hitWall = true;
                        if (hb.ownerId === socket.id) {
                            hitSeekerId = id; 
                        }
                    }
                }
            });
        }

        if (hitSeekerId && hb.ownerId === socket.id) {
            let validHit = false;
            if (serverGameState === 'SEEKING' && otherPlayers[hitSeekerId].role === 'seeker' && !otherPlayers[hitSeekerId].stunned) validHit = true;
            
            if (validHit) {
                socket.emit('hairballHit', hitSeekerId);
            }
        }

        if (hitWall) {
            explodeParticles(hb.mesh.position, false);
            playSound('pop');
            scene.remove(hb.mesh);
            activeHairballs.splice(i, 1);
        }
    }

    let moved = false;
    let targetColor = myRole === 'seeker' ? 0xFF0000 : window.myBaseColor; 
    let isBeaming = (serverGameState === 'BEAMING' && beamingPlayerIds.includes(socket.id));

    if (isQPressed && !amIStunned && myRole !== 'spectator' && !isBeaming && !isMVPGameOver) {
        qPressTime += fpsInterval; 
        unstuckUI.style.display = 'block';
        unstuckFill.style.width = Math.min(100, (qPressTime / 3000) * 100) + '%';
        if (qPressTime >= 3000) {
            myPlayerObject.position.set((Math.random() * 30) - 15, 20, (Math.random() * 30) - 15);
            qPressTime = 0;
            isQPressed = false;
            unstuckUI.style.display = 'none';
        }
    } else {
        qPressTime = 0;
        unstuckUI.style.display = 'none';
    }

    if (blindfoldStage.visible) {
        loadingCats.forEach(cat => {
            cat.group.position.x += cat.speed * cat.direction;
            if (cat.direction === 1 && cat.group.position.x > 6) cat.group.position.x = -6;
            if (cat.direction === -1 && cat.group.position.x < -6) cat.group.position.x = 6;
            cat.walkTime = (cat.walkTime || 0) + 0.44; 
            animateCat(cat, 0, cat.walkTime);
            cat.tailTime = (cat.tailTime || 0) + 0.22; cat.tail.rotation.y = Math.sin(cat.tailTime) * 0.3;
        });
    }

    if (!isBeaming && !isCustomizing) {
        if (!amIStunned && !isMVPGameOver) {
            if (keys.ArrowLeft || keys.a) myPlayerObject.rotation.y += turnSpeed;
            if (keys.ArrowRight || keys.d) myPlayerObject.rotation.y -= turnSpeed;
            
            const oldX = myPlayerObject.position.x; 
            const oldZ = myPlayerObject.position.z;
            
            if (keys.w || keys.ArrowUp) { myPlayerObject.translateZ(-moveSpeed); moved = true; }
            if (keys.s || keys.ArrowDown) { myPlayerObject.translateZ(moveSpeed); moved = true; }
            
            if (moved) {
                let proposedX = myPlayerObject.position.x;
                let proposedZ = myPlayerObject.position.z;
                
                if (checkCollision(myPlayerObject.position)) { 
                    myPlayerObject.position.x = oldX; 
                    if (checkCollision(myPlayerObject.position)) {
                        myPlayerObject.position.x = proposedX;
                        myPlayerObject.position.z = oldZ;
                        if (checkCollision(myPlayerObject.position)) {
                            myPlayerObject.position.x = oldX;
                        }
                    }
                }
            }

            if (keys[" "] && isGrounded) { 
                velocityY = jumpStrength; 
                isGrounded = false; 
                moved = true; 
                playSound('jump'); 
            }
        }
    }
    
    if (keys.w || keys.a || keys.s || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || keys[" "]) {
        if (myEmote !== 0) moved = true; 
        myEmote = 0;
    }

    if (isMVPGameOver) {
        myPlayerObject.position.set(17.5, -3.5, -17.5);
        myPlayerObject.rotation.y += 0.05;
        moved = true;
    } else if (isBeaming) {
        velocityY = 0.2; 
        myPlayerObject.position.y += velocityY;
        isGrounded = false;
        moved = true; 
    } else {
        const oldY = myPlayerObject.position.y;
        velocityY += gravity; 
        myPlayerObject.position.y += velocityY;
        
        if (checkCollision(myPlayerObject.position)) {
            myPlayerObject.position.y = oldY; 
            if (velocityY > 0) {
                velocityY = 0; 
                isGrounded = false; 
            } else {
                velocityY = 0; 
                isGrounded = true; 
            }
        } else { 
            isGrounded = false; 
        }
        if (myPlayerObject.position.y <= -5) { myPlayerObject.position.y = -5; velocityY = 0; isGrounded = true; }
    }

    if (myRole === 'seeker' && serverGameState === 'SEEKING' && !amIStunned) {
        let closestDist = 999;
        let closestHider = null;

        const currentScaleY = myCatData.body.scale.y;
        const seekerBox = new THREE.Box3();
        seekerBox.setFromCenterAndSize(
            new THREE.Vector3(myPlayerObject.position.x, myPlayerObject.position.y + ((1.2 * currentScaleY) / 2), myPlayerObject.position.z), 
            new THREE.Vector3(0.6, 1.2 * currentScaleY, 0.6)
        );
        seekerBox.expandByScalar(0.2);

        Object.keys(otherPlayers).forEach(id => {
            if (otherPlayers[id].role === 'hider') {
                let true3DDist = myPlayerObject.position.distanceTo(otherPlayers[id].group.position);
                if (true3DDist < closestDist) { closestDist = true3DDist; closestHider = otherPlayers[id]; }

                const hiderBox = new THREE.Box3().setFromObject(otherPlayers[id].group);
                
                if (seekerBox.intersectsBox(hiderBox)) {
                    let heightDiff = myPlayerObject.position.y - otherPlayers[id].group.position.y;
                    if (heightDiff > 0.5 && heightDiff <= 1.4) {
                        otherPlayers[id].role = 'seeker'; 
                        socket.emit('tagPlayer', id);
                        playCatMeow(otherPlayers[id]); explodeParticles(otherPlayers[id].group.position, true);
                        playSound('tag'); 
                    }
                }
            }
        });

        Object.keys(activeDecoys).forEach(dId => {
            const decoyBox = new THREE.Box3().setFromObject(activeDecoys[dId].group);
            if (seekerBox.intersectsBox(decoyBox)) {
                socket.emit('tagDecoy', dId);
                explodeParticles(activeDecoys[dId].group.position, false); 
                scene.remove(activeDecoys[dId].group); delete activeDecoys[dId]; 
            }
        });

        if (closestDist < 5.0 && closestHider && Date.now() - lastRadarTime > 3000) {
            playCatMeow(closestHider); 
            lastRadarTime = Date.now();
        }
    }

    if (myRole === 'hider' && !moved && isGrounded && myEmote === 0 && !amIStunned && serverGameState === 'SEEKING') { 
        let minDist = 2.0; let closestBlock = null;
        
        for (let i = 0; i < mapObjects.length; i++) {
            let dist = myPlayerObject.position.distanceTo(mapObjects[i].position);
            if (dist < minDist) { minDist = dist; closestBlock = mapObjects[i]; }
        }
        
        for (let i = 0; i < walls.length; i++) {
            const wBox = new THREE.Box3().setFromObject(walls[i]);
            let dist = wBox.distanceToPoint(myPlayerObject.position);
            if (dist < minDist) { minDist = dist; closestBlock = walls[i]; }
        }
        
        if (closestBlock) { targetColor = closestBlock.material.color.getHex(); }
    }
    
    myCatData.material.color.setHex(targetColor);
    let cColor = (targetColor === 0xFFFFFF || targetColor === 0xFF0000) ? 0xFFD700 : targetColor;
    myCatData.crownMat.color.setHex(cColor);

    if (myCatData.nameSprite) { myCatData.nameSprite.visible = false; }

    let targetHeadRot = 0;
    if (!amIStunned && !isBeaming && !isCustomizing && !isMVPGameOver) {
        if (keys.ArrowLeft || keys.a) targetHeadRot = 0.4;
        else if (keys.ArrowRight || keys.d) targetHeadRot = -0.4;
    }
    myCatData.head.rotation.y += (targetHeadRot - myCatData.head.rotation.y) * 0.15;
    
    myTailTime += 0.22; 
    myCatData.tail.rotation.y = Math.sin(myTailTime) * 0.3; 

    if (moved && isGrounded && !amIStunned && !isMVPGameOver) { 
        myWalkTime += 0.44; 
        if (myWalkTime - lastStepTime > 1.5) { playSound('step'); lastStepTime = myWalkTime; }
    } else { 
        myWalkTime = 0; 
    }
    
    let globalTime = performance.now() / 136; 
    myCatData.stunned = amIStunned; 
    animateCat(myCatData, isBeaming ? 3 : myEmote, (myEmote > 0 || isBeaming) ? globalTime : myWalkTime);

    let isDropping = (serverGameState === 'HIDING' && serverTime >= 8);
    let targetOp = isDropping ? 0.6 : 0;
    myCatData.dBeamMat.opacity += (targetOp - myCatData.dBeamMat.opacity) * 0.1;

    let finalScaleY = 1; let finalScaleXZ = 1;
    if (!isGrounded && !isBeaming && !isMVPGameOver) {
        if (velocityY > 0) { let stretch = 1 + (velocityY * 0.8); finalScaleY *= stretch; finalScaleXZ *= (1 / stretch); }
    } else {
        if (wasGroundedLastFrame === false) { 
            myPlayerObject.squashAnimTime = 0; 
            playSound('land'); 
        }
        if (myPlayerObject.squashAnimTime !== undefined && myPlayerObject.squashAnimTime < 1) {
            myPlayerObject.squashAnimTime += 0.15;
            let squashAmt = 0.3 * (1 - (1 - Math.pow(1 - myPlayerObject.squashAnimTime, 3))); 
            finalScaleY *= (1 - squashAmt); finalScaleXZ *= (1 + squashAmt);
        }
    }
    myCatData.body.scale.set(finalScaleXZ, finalScaleY, finalScaleXZ);
    wasGroundedLastFrame = isGrounded; 

    // Update Other Players visually AND THEIR MIRRORS!
    Object.entries(otherPlayers).forEach(([id, p]) => {
        if (p.role === 'spectator') { 
            p.group.visible = false; 
            if(otherMirrorCats[id]) otherMirrorCats[id].group.visible = false;
            return; 
        } else { 
            p.group.visible = true; 
        }
        
        p.group.scale.set(1, 1, 1);
        
        p.tailTime = (p.tailTime || 0) + 0.22; p.tail.rotation.y = Math.sin(p.tailTime) * 0.3; 
        let rYDelta = p.group.rotation.y - (p.lastRY === undefined ? p.group.rotation.y : p.lastRY);
        p.lastRY = p.group.rotation.y;
        let otherTargetHeadRot = 0;
        if (rYDelta > 0.01) otherTargetHeadRot = 0.4; else if (rYDelta < -0.01) otherTargetHeadRot = -0.4; 
        p.head.rotation.y += (otherTargetHeadRot - p.head.rotation.y) * 0.15;
        
        if (p.nameSprite) { 
            p.nameSprite.visible = !blindfoldStage.visible && (p.role === 'seeker' || p.material.color.getHex() === p.baseColor || serverGameState === 'LOBBY' || serverGameState === 'WAITING' || serverGameState === 'GAME_OVER'); 
        }

        if (p.moving && !p.stunned) {
            p.walkTime = (p.walkTime || 0) + 0.44; 
        }

        let isOtherBeaming = (serverGameState === 'BEAMING' && beamingPlayerIds.includes(id));
        animateCat(p, isOtherBeaming ? 3 : p.emote, (p.emote > 0 || isOtherBeaming) ? globalTime : (p.moving ? p.walkTime : 0));

        let isOtherDropping = (serverGameState === 'HIDING' && serverTime >= 8);
        let targetOtherOp = isOtherDropping ? 0.6 : 0;
        p.dBeamMat.opacity += (targetOtherOp - p.dBeamMat.opacity) * 0.1;

        // --- MIRROR LOGIC (OTHER PLAYERS) ---
        let oMirror = otherMirrorCats[id];
        if (oMirror) {
            if ((serverGameState === 'LOBBY' || serverGameState === 'WAITING')) {
                let distToMirror = mirrorZ - p.group.position.z;
                if (distToMirror > 0 && distToMirror <= 5.0 && Math.abs(p.group.position.x) < 4.0 && p.group.position.y < -1) {
                    oMirror.group.visible = true;
                    
                    oMirror.group.position.x = p.group.position.x;
                    oMirror.group.position.y = p.group.position.y;
                    oMirror.group.position.z = mirrorZ + distToMirror; 
                    
                    oMirror.group.rotation.y = Math.PI - p.group.rotation.y;
                    
                    oMirror.material.color.setHex(p.material.color.getHex());
                    oMirror.faceMesh.material.map = p.faceMesh.material.map;
                    oMirror.body.scale.copy(p.body.scale);
                    if (oMirror.nameSprite) oMirror.nameSprite.visible = false;
                    
                    let omBeam = oMirror.group.getObjectByName('dBeam');
                    if (omBeam) omBeam.visible = false; 
                    oMirror.dBeamMat.opacity = 0;

                    animateCat(oMirror, isOtherBeaming ? 3 : p.emote, (p.emote > 0 || isOtherBeaming) ? globalTime : (p.moving ? p.walkTime : 0));
                    oMirror.tail.rotation.y = -Math.sin(p.tailTime) * 0.3; 
                    
                    let op = 1.0 - ((distToMirror - 1.0) / 4.0);
                    op = Math.max(0.0, Math.min(1.0, op)); 
                    
                    oMirror.group.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = true;
                            child.material.opacity = op;
                        }
                        if (child.isLineSegments && child.material) {
                            child.material.transparent = true;
                            child.material.opacity = op * 0.3; 
                        }
                    });
                    
                    if (op <= 0) oMirror.group.visible = false;
                    
                } else {
                    oMirror.group.visible = false;
                }
            } else {
                oMirror.group.visible = false;
            }
        }
    });

    clouds.forEach(cloud => { cloud.position.x += 0.02; if (cloud.position.x > 60) cloud.position.x = -60; });

    let focusObject = myPlayerObject;
    if (myRole === 'spectator' && !isGameOver) {
        let seekerId = Object.keys(otherPlayers).find(id => otherPlayers[id].role === 'seeker');
        if (seekerId && otherPlayers[seekerId]) focusObject = otherPlayers[seekerId].group;
    }

    focusObject.updateMatrixWorld(); 
    
    let idealOffset = new THREE.Vector3(0, 1.5, 3);
    if (isMobile && window.innerHeight > window.innerWidth) {
        idealOffset.set(0, 2.5, 4); 
    }

    let cameraTargetPos = idealOffset.applyMatrix4(focusObject.matrixWorld);
    camera.position.lerp(cameraTargetPos, 0.15);
    let lookAtTarget = focusObject.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    camera.lookAt(lookAtTarget);

    walls.forEach(w => {
        if (w.material.opacity < 1) {
            w.material.opacity += 0.05;
            if (w.material.opacity > 1) w.material.opacity = 1;
        }
    });
    mapObjects.forEach(m => {
        if (m.material.opacity < 1) {
            m.material.opacity += 0.05;
            if (m.material.opacity > 1) m.material.opacity = 1;
        }
    });

    let obstacles = [...walls, ...mapObjects];
    let rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    let upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    
    let sightTargets = [
        lookAtTarget,
        lookAtTarget.clone().add(rightDir.clone().multiplyScalar(0.7)),
        lookAtTarget.clone().add(rightDir.clone().multiplyScalar(-0.7)),
        lookAtTarget.clone().add(upDir.clone().multiplyScalar(0.7)),
        lookAtTarget.clone().add(upDir.clone().multiplyScalar(-0.7))
    ];

    sightTargets.forEach(t => {
        let camDist = camera.position.distanceTo(t);
        let camDir = new THREE.Vector3().subVectors(t, camera.position).normalize();
        camRaycaster.set(camera.position, camDir);
        
        let hits = camRaycaster.intersectObjects(obstacles);
        hits.forEach(hit => {
            if (hit.distance < camDist - 0.5) {
                let blockingObj = hit.object;
                blockingObj.material.opacity -= 0.15;
                if (blockingObj.material.opacity < 0.2) blockingObj.material.opacity = 0.2;
            }
        });
    });

    socket.emit('playerMovement', { 
        x: myPlayerObject.position.x, y: myPlayerObject.position.y, z: myPlayerObject.position.z,
        rY: myPlayerObject.rotation.y, moving: moved, color: targetColor, role: myRole,
        emote: myEmote
    });
    
    renderer.render(scene, camera);
}
animate();

if (isMobile) {
    const mobileUI = document.createElement('div');
    mobileUI.id = 'mobileUI';
    mobileUI.style.cssText = 'position:absolute; bottom:50px; left:0; width:100%; height:110px; pointer-events:none; z-index:150; display:none; justify-content:space-between; padding:0 20px; box-sizing:border-box;';
    
    function createBtn(text, x, y, key) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        let fontSize = text.length > 2 ? '10px' : '18px'; 
        
        btn.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:50px; height:50px; background:rgba(0,0,0,0.4); border:2px solid rgba(255,255,255,0.6); border-radius:50%; color:white; font-weight:900; font-size:${fontSize}; user-select:none; touch-action:none; pointer-events:auto; display:flex; align-items:center; justify-content:center; box-shadow: 0px 4px 10px rgba(0,0,0,0.5);`;
        
        if (key === 'emote') {
            btn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                let randomEmote = Math.floor(Math.random() * 5) + 1;
                document.dispatchEvent(new KeyboardEvent('keydown', {'key': randomEmote.toString()}));
                btn.style.background = 'rgba(255, 215, 0, 0.6)'; 
                btn.style.transform = 'scale(0.9)'; 
            }, {passive: false});
            
            btn.addEventListener('touchend', (e) => { 
                e.preventDefault(); 
                btn.style.background = 'rgba(0,0,0,0.4)'; 
                btn.style.transform = 'scale(1)';
            }, {passive: false});
        } else {
            btn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                keys[key] = true;
                btn.style.background = 'rgba(255, 215, 0, 0.6)'; 
                btn.style.transform = 'scale(0.9)'; 

                if(key === 'f' || key === 'e' || key === 'q' || key === 'r') {
                    document.dispatchEvent(new KeyboardEvent('keydown', {'key': key}));
                }
            }, {passive: false});
            
            btn.addEventListener('touchend', (e) => { 
                e.preventDefault(); 
                keys[key] = false; 
                btn.style.background = 'rgba(0,0,0,0.4)'; 
                btn.style.transform = 'scale(1)';
                if(key === 'q') {
                    document.dispatchEvent(new KeyboardEvent('keyup', {'key': key}));
                }
            }, {passive: false});
        }
        
        return btn;
    }
    
    const dpad = document.createElement('div');
    dpad.style.cssText = 'position:relative; width:50px; height:110px;';
    dpad.appendChild(createBtn('▲', 0, 0, 'w'));               
    dpad.appendChild(createBtn('▼', 0, 60, 's'));             
    
    const actions = document.createElement('div');
    actions.style.cssText = 'position:relative; width:290px; height:110px;';
    
    actions.appendChild(createBtn('◀', 60, 0, 'a'));       
    actions.appendChild(createBtn('▶', 120, 0, 'd'));      
    
    actions.appendChild(createBtn('EMOTE', 0, 60, 'emote'));         
    actions.appendChild(createBtn('MEOW', 60, 60, 'f'));         
    actions.appendChild(createBtn('JUMP', 120, 60, ' '));       
    actions.appendChild(createBtn('DECOY', 180, 60, 'e'));      
    actions.appendChild(createBtn('HAIRBALL', 240, 60, 'r'));      

    mobileUI.appendChild(dpad);
    mobileUI.appendChild(actions);
    document.body.appendChild(mobileUI);
}