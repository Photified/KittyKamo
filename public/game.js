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

// --- 3-STATE VOLUME LOGIC ---
let volumeState = 1; // 2 = High, 1 = Low, 0 = Mute
const VOL_EMOJIS = { 2: '🔊', 1: '🔉', 0: '🔇' };

// --- INDEPENDENT MUSIC TOGGLE ---
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

    // Multiply the volume based on our setting (30% for low)
    let v = (volumeState === 1) ? 0.3 : 1.0;
    let endV = Math.max(0.001, 0.01 * v); // Exponential ramp cannot hit true 0

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
    }
}

function playCatMeow(catData) {
    if (volumeState === 0 || meowBuffers.length === 0) return;
    if (catData.pAudio.isPlaying) catData.pAudio.stop();
    const randomBuffer = meowBuffers[Math.floor(Math.random() * meowBuffers.length)];
    catData.pAudio.setBuffer(randomBuffer);
    
    // Scale positional audio volume down if Low setting is active
    catData.pAudio.setVolume(volumeState === 1 ? 0.3 : 1.0);
    catData.pAudio.play();
}

// --- STRIPPED AND BULLETPROOF CSS ---
const style = document.createElement('style');
style.innerHTML = `
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; overflow: hidden; margin: 0; padding: 0; }
    .menu-btn { background: #333; color: white; border: 1px solid #666; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content:center; }
    .menu-btn:hover { background: #555; transform: scale(1.05); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #666; border-radius: 4px; }
    
    #leftBox, #centerBox, #rightBox { box-sizing: border-box !important; }
    
    /* STRETCH GRID FOR MOBILE ALIGNMENT */
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
    bgmAudio.setVolume(0.15); // Default High Volume
});

// --- GLOBAL MUSIC TOGGLE FUNCTION ---
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
    btn.blur(); // Prevent spacebar from triggering this again
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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(40, 40, 20); 
sunLight.castShadow = true;
sunLight.shadow.camera.left = -40; sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40; sunLight.shadow.camera.bottom = -40;
sunLight.shadow.mapSize.width = isMobile ? 1024 : 2048; 
sunLight.shadow.mapSize.height = isMobile ? 1024 : 2048;
scene.add(sunLight);

const camRaycaster = new THREE.Raycaster();

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

function createCatSculpt(startColor = 0xFFFFFF) {
    const uniqueMat = new THREE.MeshLambertMaterial({ color: startColor });
    const catGroup = new THREE.Group();

    function addPart(w, h, d, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), uniqueMat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        catGroup.add(mesh);
        return mesh;
    }

    const head = addPart(0.4, 0.4, 0.4, 0, 0.7, -0.4);
    addPart(0.5, 0.5, 0.8, 0, 0.5, 0); 
    addPart(0.1, 0.2, 0.1, 0.15, 0.95, -0.4); addPart(0.1, 0.2, 0.1, -0.15, 0.95, -0.4); 
    
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.5, 0.4); 
    tailPivot.add(addPart(0.1, 0.1, 0.5, 0, 0, 0.25)); 
    catGroup.add(tailPivot);

    const legs = [
        addPart(0.1, 0.3, 0.1, 0.15, 0.15, 0.3), addPart(0.1, 0.3, 0.1, -0.15, 0.15, 0.3),
        addPart(0.1, 0.3, 0.1, 0.15, 0.15, -0.3), addPart(0.1, 0.3, 0.1, -0.15, 0.15, -0.3)
    ];

    const pAudio = new THREE.PositionalAudio(listener);
    pAudio.setDistanceModel('linear'); 
    pAudio.setRefDistance(3);  
    pAudio.setMaxDistance(30); 
    pAudio.setRolloffFactor(1);
    catGroup.add(pAudio);

    const crown = createCrown();
    head.add(crown); 

    return { group: catGroup, head: head, legs: legs, tail: tailPivot, material: uniqueMat, pAudio: pAudio, crown: crown, crownMat: crown.crownMat };
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

// --- SHARED GEOMETRIES ---
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

// --- BOUNDARY WALLS ---
const walls = [];
const wallMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
function createWall(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = wallMat.clone();
    mat.transparent = true; 
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    walls.push(mesh);
}

// --- INVISIBLE SKY WALLS ---
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
let myRole = 'hider';
let myName = 'Connecting...';
let myScore = 0; 
let serverGameState = 'WAITING';
let serverTime = 0;
let serverWinnerId = null;
let serverWinReason = "";
let lastTickTime = -1; 

const otherPlayers = {};
const activeDecoys = {}; 

let myWalkTime = 0; 
let lastStepTime = 0; 
let myTailTime = 0; 
let lastRadarTime = 0; 
let lastTauntTime = 0; 
let myDecoyUsed = false; 
let wasGroundedLastFrame = true; 

const myPlayerObject = new THREE.Object3D(); 
scene.add(myPlayerObject);

// --- REVISED BLINDFOLD FIX ---
const blindfoldStage = new THREE.Group();
camera.add(blindfoldStage); 

const blindfoldBg = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100), 
    new THREE.MeshBasicMaterial({color: 0x111111, depthTest: false, depthWrite: false, transparent: true, opacity: 1})
);
blindfoldBg.position.z = -5; 
blindfoldBg.renderOrder = 999; 
blindfoldStage.add(blindfoldBg);

const blindfoldLight = new THREE.PointLight(0xffffff, 1, 20);
blindfoldLight.position.set(0, 0, -2);
blindfoldStage.add(blindfoldLight);

const blindfoldAmbient = new THREE.AmbientLight(0xffffff, 0.6);
blindfoldStage.add(blindfoldAmbient);

const loadingCats = [];
for(let i=0; i<3; i++) {
    let cat = createCatSculpt(0xFFFFFF);
    cat.group.position.set((Math.random() * 10) - 5, -0.5 - (i * 1.0), -4);
    cat.group.traverse((child) => {
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

// --- DYNAMIC GROUND ---
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

// --- CUSTOM NAME ENTRY SCREEN ---
const startScreen = document.createElement('div');
startScreen.id = 'startScreen';
startScreen.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:"Segoe UI", sans-serif; z-index:999;';

const logo = document.createElement('h1');
logo.innerHTML = 'KITTY KAMO';
logo.style.cssText = 'font-size: 48px; color: gold; text-shadow: 3px 3px 0 #000; margin: 0 0 20px 0; font-weight: 900; letter-spacing: 2px; text-align: center;';
startScreen.appendChild(logo);

const nameInput = document.createElement('input');
nameInput.type = 'text';
nameInput.placeholder = 'Enter Name...';
nameInput.maxLength = 12;
nameInput.style.cssText = 'padding: 12px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 8px; border: 3px solid #555; background: #222; color: white; margin-bottom: 20px; width: 250px; outline: none; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: border-color 0.2s;';
nameInput.onfocus = () => nameInput.style.borderColor = 'gold';
nameInput.onblur = () => nameInput.style.borderColor = '#555';
startScreen.appendChild(nameInput);

const startBtn = document.createElement('button');
startBtn.innerHTML = "PLAY";
startBtn.style.cssText = 'padding: 12px 50px; font-size: 24px; font-weight:900; background: gold; color: #111; border: none; border-radius: 8px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: transform 0.2s;';
startBtn.onmouseover = () => startBtn.style.transform = 'scale(1.05)';
startBtn.onmouseout = () => startBtn.style.transform = 'scale(1)';

startBtn.onclick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (listener.context.state === 'suspended') listener.context.resume();
    
    // Play BGM when starting if not muted
    if (volumeState !== 0 && window.musicEnabled && !bgmAudio.isPlaying && bgmAudio.buffer) {
        bgmAudio.play();
    }
    
    let chosenName = nameInput.value.trim();
    if (chosenName !== "") {
        socket.emit('setName', chosenName);
    }
    
    startScreen.style.display = 'none';
};
startScreen.appendChild(startBtn);

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startBtn.onclick();
});

document.body.appendChild(startScreen);

// --- BULLETPROOF MOBILE BANNER ---
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
    // Cycle state: 2 -> 1 -> 0 -> 2
    volumeState = (volumeState === 2) ? 1 : (volumeState === 1) ? 0 : 2;
    muteBtn.innerHTML = VOL_EMOJIS[volumeState]; 
    
    if (volumeState === 0) {
        if (bgmAudio.isPlaying) bgmAudio.pause();
    } else {
        bgmAudio.setVolume(volumeState === 1 ? 0.05 : 0.15); // Adjust BGM volume directly
        if (window.musicEnabled && !bgmAudio.isPlaying && document.getElementById('startScreen').style.display === 'none') {
            bgmAudio.play();
        }
    }
    muteBtn.blur(); // Drop focus
};
soundBtnRow.appendChild(muteBtn);

const helpBtn = document.createElement('button');
helpBtn.className = 'menu-btn'; helpBtn.innerHTML = '❓';
helpBtn.onclick = () => { 
    document.getElementById('helpModal').style.display = document.getElementById('helpModal').style.display === 'none' ? 'flex' : 'none'; 
    helpBtn.blur(); // Drop focus
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
rightBox.style.cssText = 'background:rgba(20,20,20,0.85); border:2px solid #444; border-radius:8px; padding:6px; box-shadow:0px 4px 10px rgba(0,0,0,0.5); pointer-events:auto; display:flex; flex-direction:column; justify-content:center; text-align:right; color:white; max-width:30%; overflow-wrap: break-word; overflow-y:auto; overflow-x:hidden;';
rightBox.innerHTML = `<div style="font-weight:900; font-size:10px; margin-bottom:2px; color:#ddd;">SURVIVAL TIME</div>`;
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
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">W A S D</b> or <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">← → ↑ ↓</b> Move <br>
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">SPACE</b> Jump &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777;">F</b> Meow &nbsp;
                <b style="background: #333; padding: 3px 6px; border-radius: 4px; border: 1px solid #777; color: gold;">E</b> Decoy
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 8px; color: #eee; font-size: 12px; line-height: 1.4;">
            <p style="margin: 0;"><b>HIDERS:</b> Stand perfectly still next to a block to copy its color.</p>
            <p style="margin: 0;"><b>SEEKERS:</b> Touch Hiders to tag them. Listen for Meows!</p>
            <p style="margin: 0; color: #ff6666; font-weight: bold;">When a Hider gets tagged, they become a Seeker!</p>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 5px;">
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; flex: 1; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Meowing
            </div>
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; flex: 1; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Decoy Hit
            </div>
            <div style="background: rgba(100, 255, 100, 0.15); border: 1px solid #6f6; border-radius: 6px; padding: 6px 2px; flex: 1; text-align: center; color: #aaffaa; font-size: 10px; display: flex; flex-direction: column; justify-content: center;">
                <b style="font-size: 14px; margin-bottom: 2px;">+15s</b> Tagging
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

// --- NETWORKING ---
socket.on('gameStateUpdate', (data) => {
    serverGameState = data.state;
    serverTime = data.time;
    serverWinnerId = data.winnerId;
    serverWinReason = data.winReason;
    updateUI();

    if (serverGameState === 'SEEKING' && serverTime <= 10 && serverTime > 0 && serverTime !== lastTickTime) {
        playSound('tick'); lastTickTime = serverTime;
    }

    if (data.leaderboard && data.leaderboard.length > 0) {
        let lbText = `<div style="font-weight:900; font-size:10px; margin-bottom:2px; color:#ddd;">SURVIVAL TIME</div>`;
        
        let p1 = data.leaderboard[0];
        let c1 = (p1.id === serverWinnerId) ? '👑 ' : '';
        lbText += `<div style="font-size:9px; line-height:1.4;">1. ${c1}${p1.name} : <b style="color:gold;">${p1.score}s</b></div>`;

        if (data.leaderboard.length > 1) {
            let myRank = data.leaderboard.findIndex(p => p.id === socket.id);
            
            if (myRank === 0) {
                let p2 = data.leaderboard[1];
                let c2 = (p2.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">2. ${c2}${p2.name} : <b style="color:gold;">${p2.score}s</b></div>`;
            } else if (myRank > 0) {
                let myP = data.leaderboard[myRank];
                let myC = (myP.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">${myRank + 1}. ${myC}${myP.name} : <b style="color:gold;">${myP.score}s</b></div>`;
            } else {
                let p2 = data.leaderboard[1];
                let c2 = (p2.id === serverWinnerId) ? '👑 ' : '';
                lbText += `<div style="font-size:9px; line-height:1.4;">2. ${c2}${p2.name} : <b style="color:gold;">${p2.score}s</b></div>`;
            }
        } else {
            lbText += `<div style="font-size:9px; line-height:1.4; color:#777;">...</div>`;
        }
        
        rightBox.innerHTML = lbText;
    }
});

socket.on('initMap', (mapBlocks) => {
    mapObjects.forEach(mesh => scene.remove(mesh)); mapObjects.length = 0;
    walls.forEach(mesh => scene.remove(mesh)); walls.length = 0;
    invisibleWalls.forEach(mesh => scene.remove(mesh)); invisibleWalls.length = 0;
    
    mapBlocks.forEach(b => createBlock(b.x, b.y, b.z, b.color));
    myDecoyUsed = false; 
    
    Object.keys(activeDecoys).forEach(dId => {
        scene.remove(activeDecoys[dId].group); delete activeDecoys[dId];
    });

    if (mapBlocks.length > 0) {
        const minX = Math.min(...mapBlocks.map(b => b.x));
        const maxX = Math.max(...mapBlocks.map(b => b.x));
        const minZ = Math.min(...mapBlocks.map(b => b.z));
        const maxZ = Math.max(...mapBlocks.map(b => b.z));

        const widthX = (maxX - minX) + 5; 
        const depthZ = (maxZ - minZ) + 5;
        
        ground.scale.set(widthX, depthZ, 1);
        ground.position.set((minX + maxX) / 2, -5, (minZ + maxZ) / 2);

        createWall(widthX, 10, 2, (minX + maxX) / 2, 0, minZ - 1.5);
        createWall(widthX, 10, 2, (minX + maxX) / 2, 0, maxZ + 1.5);
        
        const wallDepthZ = (maxZ - minZ) + 1;
        createWall(2, 10, wallDepthZ, minX - 1.5, 0, (minZ + maxZ) / 2);
        createWall(2, 10, wallDepthZ, maxX + 1.5, 0, (minZ + maxZ) / 2);
        
        createInvisibleWall(widthX, 40, 2, (minX + maxX) / 2, 25, minZ - 1.5);
        createInvisibleWall(widthX, 40, 2, (minX + maxX) / 2, 25, maxZ + 1.5);
        createInvisibleWall(2, 40, wallDepthZ, minX - 1.5, 25, (minZ + maxZ) / 2);
        createInvisibleWall(2, 40, wallDepthZ, maxX + 1.5, 25, (minZ + maxZ) / 2);
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
            myCatData.material.color.setHex(players[id].color);
            
            let cColor = (players[id].color === 0xFFFFFF || players[id].color === 0xFF0000) ? 0xFFD700 : players[id].color;
            myCatData.crownMat.color.setHex(cColor);

            setNameLabel(myCatData, myName); 
            if (serverGameState === 'WAITING' || myRole !== 'spectator') {
                myPlayerObject.position.set(players[id].x, players[id].y, players[id].z);
            }
            myCatData.crown.visible = (id === serverWinnerId);
        } else { 
            if (otherPlayers[id]) {
                if (otherPlayers[id].role === 'hider' && players[id].role === 'seeker') {
                    playCatMeow(otherPlayers[id]); 
                    explodeParticles(otherPlayers[id].group.position, true);
                    playSound('tag');
                }
                otherPlayers[id].role = players[id].role;
                otherPlayers[id].material.color.setHex(players[id].color);
                
                let oColor = (players[id].color === 0xFFFFFF || players[id].color === 0xFF0000) ? 0xFFD700 : players[id].color;
                otherPlayers[id].crownMat.color.setHex(oColor);

                otherPlayers[id].crown.visible = (id === serverWinnerId);
                
                setNameLabel(otherPlayers[id], players[id].name);
            } else { addOtherPlayer(id, players[id]); }
        }
    });
    updateUI(); 
});

socket.on('newPlayer', (data) => addOtherPlayer(data.id, data.player));
socket.on('playerMoved', (data) => {
    if (otherPlayers[data.id]) {
        otherPlayers[data.id].group.position.set(data.x, data.y, data.z);
        otherPlayers[data.id].group.rotation.y = data.rY;
        otherPlayers[data.id].moving = data.moving;
        otherPlayers[data.id].material.color.setHex(data.color); 
        
        let oColor = (data.color === 0xFFFFFF || data.color === 0xFF0000) ? 0xFFD700 : data.color;
        otherPlayers[data.id].crownMat.color.setHex(oColor);

        otherPlayers[data.id].role = data.role; 
    }
});
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].group); delete otherPlayers[id]; } });

socket.on('playerTaunted', (taunterId) => {
    if (otherPlayers[taunterId]) {
        playCatMeow(otherPlayers[taunterId]);
    }
});

socket.on('spawnDecoy', (data) => {
    const decoy = createCatSculpt(data.color);
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

function addOtherPlayer(id, playerInfo) {
    if (otherPlayers[id]) scene.remove(otherPlayers[id].group);
    const catData = createCatSculpt(playerInfo.color);
    catData.group.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    catData.group.rotation.y = playerInfo.rY;
    catData.role = playerInfo.role; 
    setNameLabel(catData, playerInfo.name); 
    catData.crown.visible = (id === serverWinnerId);
    
    let oColor = (playerInfo.color === 0xFFFFFF || playerInfo.color === 0xFF0000) ? 0xFFD700 : playerInfo.color;
    catData.crownMat.color.setHex(oColor);

    scene.add(catData.group);
    otherPlayers[id] = catData;
}

function checkCollision(pos) {
    const pBox = new THREE.Box3();
    const currentScaleY = myCatData.group.scale.y;
    pBox.setFromCenterAndSize(new THREE.Vector3(pos.x, pos.y + ((1.2 * currentScaleY)/2), pos.z), new THREE.Vector3(0.6, 1.2 * currentScaleY, 0.6));
    
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

    for (let id in otherPlayers) {
        if (otherPlayers[id].role === 'spectator') continue;
        const oBox = new THREE.Box3().setFromObject(otherPlayers[id].group); oBox.expandByScalar(-0.02);
        if (pBox.intersectsBox(oBox)) return true;
    }
    return false;
}

const keys = { w: false, a: false, s: false, d: false, ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, " ": false };

document.addEventListener('keydown', (e) => { 
    if (document.activeElement.tagName === 'INPUT') return;

    if(keys.hasOwnProperty(e.key)) keys[e.key] = true; 
    
    if(e.key.toLowerCase() === 'f') {
        if (Date.now() - lastTauntTime > 5000) { 
            if (myRole === 'hider' && serverGameState === 'SEEKING') {
                lastTauntTime = Date.now();
                socket.emit('taunt'); 
                playCatMeow(myCatData); 
            } else if (serverGameState === 'WAITING') {
                lastTauntTime = Date.now();
                socket.emit('lobbyMeow'); 
                playCatMeow(myCatData); 
            }
        }
    }
    
    if(e.key.toLowerCase() === 'e') {
        if (myRole === 'hider' && serverGameState === 'SEEKING' && !myDecoyUsed) {
            myDecoyUsed = true; 
            let targetColor = myCatData.material.color.getHex();
            socket.emit('dropDecoy', { 
                x: myPlayerObject.position.x, y: myPlayerObject.position.y, z: myPlayerObject.position.z, 
                rY: myPlayerObject.rotation.y, color: targetColor 
            });
        }
    }
});

document.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });

const moveSpeed = 0.15; const turnSpeed = 0.06; let velocityY = 0; let isGrounded = true; const gravity = -0.015; const jumpStrength = 0.3;

function animate() {
    requestAnimationFrame(animate);

    myPlayerObject.rotation.x = 0;
    myPlayerObject.rotation.z = 0;

    let cycleProgress = 0;
    if (serverGameState === 'SEEKING') {
        cycleProgress = Math.max(0, Math.min(1, (60 - serverTime) / 60)); 
    } else if (serverGameState === 'WAITING' || serverGameState === 'GAME_OVER') {
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

    stars.rotation.y += 0.0003; 

    let dimFactor = 1 - (0.15 * cycleProgress); 
    sunLight.intensity = 0.8 * dimFactor;
    ambientLight.intensity = 0.4 * dimFactor;

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.position.add(p.velocity); p.velocity.y -= 0.02; p.scale.multiplyScalar(0.9); 
        if (p.scale.x < 0.01) { scene.remove(p); particles.splice(i, 1); }
    }

    let moved = false;
    let targetColor = myRole === 'seeker' ? 0xFF0000 : 0xFFFFFF; 

    if (blindfoldStage.visible) {
        loadingCats.forEach(cat => {
            cat.group.position.x += cat.speed * cat.direction;
            if (cat.direction === 1 && cat.group.position.x > 6) cat.group.position.x = -6;
            if (cat.direction === -1 && cat.group.position.x < -6) cat.group.position.x = 6;
            cat.walkTime = (cat.walkTime || 0) + 0.2;
            cat.legs[0].rotation.x = Math.sin(cat.walkTime) * 0.5; cat.legs[1].rotation.x = -Math.sin(cat.walkTime) * 0.5; 
            cat.legs[2].rotation.x = -Math.sin(cat.walkTime) * 0.5; cat.legs[3].rotation.x = Math.sin(cat.walkTime) * 0.5; 
            cat.tailTime = (cat.tailTime || 0) + 0.1; cat.tail.rotation.y = Math.sin(cat.tailTime) * 0.3;
        });
    }

    if (myRole === 'spectator' || serverGameState === 'GAME_OVER') {
        myCatData.group.visible = false;
        if (keys.ArrowLeft || keys.a) myPlayerObject.rotation.y += turnSpeed;
        if (keys.ArrowRight || keys.d) myPlayerObject.rotation.y -= turnSpeed;
    } else {
        myCatData.group.visible = true;

        if (!(myRole === 'seeker' && serverGameState === 'HIDING')) {
            if (keys.ArrowLeft || keys.a) myPlayerObject.rotation.y += turnSpeed;
            if (keys.ArrowRight || keys.d) myPlayerObject.rotation.y -= turnSpeed;
            
            const oldX = myPlayerObject.position.x; const oldZ = myPlayerObject.position.z;
            
            if (keys.w || keys.ArrowUp) { myPlayerObject.translateZ(-moveSpeed); moved = true; }
            if (keys.s || keys.ArrowDown) { myPlayerObject.translateZ(moveSpeed); moved = true; }
            
            if (checkCollision(myPlayerObject.position)) { myPlayerObject.position.x = oldX; myPlayerObject.position.z = oldZ; }
            if (keys[" "] && isGrounded) { 
                velocityY = jumpStrength; 
                isGrounded = false; 
                moved = true; 
                playSound('jump'); 
            }
        }
        
        const oldY = myPlayerObject.position.y;
        velocityY += gravity; myPlayerObject.position.y += velocityY;
        if (checkCollision(myPlayerObject.position)) {
            myPlayerObject.position.y = oldY; velocityY = 0; isGrounded = (velocityY <= 0);
        } else { isGrounded = false; }
        if (myPlayerObject.position.y <= -5) { myPlayerObject.position.y = -5; velocityY = 0; isGrounded = true; }

        if (myRole === 'seeker' && serverGameState === 'SEEKING') {
            let closestDist = 999;
            let closestHider = null;

            const currentScaleY = myCatData.group.scale.y;
            const seekerBox = new THREE.Box3();
            seekerBox.setFromCenterAndSize(
                new THREE.Vector3(myPlayerObject.position.x, myPlayerObject.position.y + ((1.2 * currentScaleY) / 2), myPlayerObject.position.z), 
                new THREE.Vector3(0.6, 1.2 * currentScaleY, 0.6)
            );
            seekerBox.expandByScalar(0.8);

            Object.keys(otherPlayers).forEach(id => {
                if (otherPlayers[id].role === 'hider') {
                    let true3DDist = myPlayerObject.position.distanceTo(otherPlayers[id].group.position);
                    if (true3DDist < closestDist) { closestDist = true3DDist; closestHider = otherPlayers[id]; }

                    const hiderBox = new THREE.Box3().setFromObject(otherPlayers[id].group);
                    
                    if (seekerBox.intersectsBox(hiderBox)) {
                        otherPlayers[id].role = 'seeker'; 
                        socket.emit('tagPlayer', id);
                        playCatMeow(otherPlayers[id]); explodeParticles(otherPlayers[id].group.position, true);
                        playSound('tag'); 
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

        if (myRole === 'hider' && !moved && isGrounded) { 
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
        if (keys.ArrowLeft || keys.a) targetHeadRot = 0.4;
        else if (keys.ArrowRight || keys.d) targetHeadRot = -0.4;
        myCatData.head.rotation.y += (targetHeadRot - myCatData.head.rotation.y) * 0.15;
        
        myTailTime += 0.1; myCatData.tail.rotation.y = Math.sin(myTailTime) * 0.3; 

        if (moved && isGrounded) { 
            myWalkTime += 0.2; 
            if (myWalkTime - lastStepTime > 1.5) { playSound('step'); lastStepTime = myWalkTime; }
        } else { myWalkTime = 0; }
        
        myCatData.legs[0].rotation.x = Math.sin(myWalkTime) * 0.5; myCatData.legs[1].rotation.x = -Math.sin(myWalkTime) * 0.5; 
        myCatData.legs[2].rotation.x = -Math.sin(myWalkTime) * 0.5; myCatData.legs[3].rotation.x = Math.sin(myWalkTime) * 0.5; 

        let finalScaleY = 1; let finalScaleXZ = 1;
        if (!isGrounded) {
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
        myCatData.group.scale.set(finalScaleXZ, finalScaleY, finalScaleXZ);
        wasGroundedLastFrame = isGrounded; 
    }

    Object.values(otherPlayers).forEach(p => {
        if (p.role === 'spectator' || (serverGameState === 'GAME_OVER' && p.id !== serverWinnerId)) { 
            p.group.visible = false; return; 
        } else { 
            p.group.visible = true; 
        }
        
        p.group.scale.set(1, 1, 1);
        
        p.tailTime = (p.tailTime || 0) + 0.1; p.tail.rotation.y = Math.sin(p.tailTime) * 0.3;
        let rYDelta = p.group.rotation.y - (p.lastRY === undefined ? p.group.rotation.y : p.lastRY);
        p.lastRY = p.group.rotation.y;
        let otherTargetHeadRot = 0;
        if (rYDelta > 0.01) otherTargetHeadRot = 0.4; else if (rYDelta < -0.01) otherTargetHeadRot = -0.4; 
        p.head.rotation.y += (otherTargetHeadRot - p.head.rotation.y) * 0.15;
        
        if (p.nameSprite) { p.nameSprite.visible = !blindfoldStage.visible && (p.role === 'seeker' || p.material.color.getHex() === 0xFFFFFF); }

        if (p.moving) {
            p.walkTime = (p.walkTime || 0) + 0.2;
            p.legs[0].rotation.x = Math.sin(p.walkTime) * 0.5; p.legs[1].rotation.x = -Math.sin(p.walkTime) * 0.5;
            p.legs[2].rotation.x = -Math.sin(p.walkTime) * 0.5; p.legs[3].rotation.x = Math.sin(p.walkTime) * 0.5;
        } else { p.legs.forEach(leg => leg.rotation.x = 0); }
    });

    clouds.forEach(cloud => { cloud.position.x += 0.02; if (cloud.position.x > 60) cloud.position.x = -60; });

    let focusObject = myPlayerObject;
    if (serverGameState === 'GAME_OVER' && serverWinnerId) {
        focusObject = (serverWinnerId === socket.id) ? myPlayerObject : (otherPlayers[serverWinnerId] ? otherPlayers[serverWinnerId].group : myPlayerObject);
        focusObject.rotation.y += 0.02; 
    } else if (myRole === 'spectator') {
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

    const now = performance.now();
    if (now - lastRenderTime >= fpsInterval) {
        lastRenderTime = now;
        socket.emit('playerMovement', { 
            x: myPlayerObject.position.x, y: myPlayerObject.position.y, z: myPlayerObject.position.z,
            rY: myPlayerObject.rotation.y, moving: moved, color: targetColor, role: myRole
        });
        renderer.render(scene, camera);
    }
}
animate();

if (isMobile) {
    const mobileUI = document.createElement('div');
    mobileUI.style.cssText = 'position:absolute; bottom:50px; left:0; width:100%; height:110px; pointer-events:none; z-index:150; display:flex; justify-content:space-between; padding:0 20px; box-sizing:border-box;';
    
    function createBtn(text, x, y, key) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        let fontSize = text.length > 2 ? '10px' : '18px'; 
        
        btn.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:50px; height:50px; background:rgba(0,0,0,0.4); border:2px solid rgba(255,255,255,0.6); border-radius:50%; color:white; font-weight:900; font-size:${fontSize}; user-select:none; touch-action:none; pointer-events:auto; display:flex; align-items:center; justify-content:center; box-shadow: 0px 4px 10px rgba(0,0,0,0.5);`;
        
        btn.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            keys[key] = true;
            btn.style.background = 'rgba(255, 215, 0, 0.6)'; 
            btn.style.transform = 'scale(0.9)'; 

            if(key === 'f' || key === 'e') {
                document.dispatchEvent(new KeyboardEvent('keydown', {'key': key}));
            }
        }, {passive: false});
        
        btn.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            keys[key] = false; 
            btn.style.background = 'rgba(0,0,0,0.4)'; 
            btn.style.transform = 'scale(1)';
        }, {passive: false});
        
        return btn;
    }
    
    const dpad = document.createElement('div');
    dpad.style.cssText = 'position:relative; width:50px; height:110px;';
    dpad.appendChild(createBtn('▲', 0, 0, 'w'));               
    dpad.appendChild(createBtn('▼', 0, 60, 's'));             
    
    const actions = document.createElement('div');
    actions.style.cssText = 'position:relative; width:170px; height:110px;';
    
    actions.appendChild(createBtn('◀', 30, 0, 'a'));       
    actions.appendChild(createBtn('▶', 90, 0, 'd'));      
    
    actions.appendChild(createBtn('MEOW', 0, 60, 'f'));         
    actions.appendChild(createBtn('JUMP', 60, 60, ' '));       
    actions.appendChild(createBtn('DECOY', 120, 60, 'e'));      

    mobileUI.appendChild(dpad);
    mobileUI.appendChild(actions);
    document.body.appendChild(mobileUI);
}