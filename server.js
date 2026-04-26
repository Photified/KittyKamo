// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let mapBlocks = [];
let players = {};
let activeDecoys = {}; 
let gameState = 'WAITING'; 
let timeRemaining = 0;
let gameTimer = null;

let currentWinnerId = null;
let winReason = "";
let nextDecoyId = 0;
let nextHairballId = 0;
let activePlayers = []; 
let lastMvp = null; 
let lastLeaderboard = []; 
let currentMapWallColor = 0x8B4513; 
let currentMapSkyDay = 0x87CEEB;
let currentMapSkySunset = 0xFF7E47;
let currentMapSkyNight = 0x020211;

// Cooldown trackers for map generation
let recentBiomes = [];
let recentLayouts = [];

const catBeds = [
    {x: 15, z: 8}, {x: 15, z: -8}, {x: -15, z: 8}, {x: -15, z: -8},
    {x: 8, z: 15}, {x: -8, z: 15}, {x: 8, z: -15}, {x: -8, z: -15},
    {x: 15, z: 22}, {x: -15, z: 22} 
];

let yarnBalls = [
    { id: 'yarn0', x: -8, y: -4.6, z: 0, color: 0xFF0000, vx: 0, vy: 0, vz: 0, inGoal: false }
];

const lobbyObstacles = [
    { x: 0, z: -18.5, w: 5, d: 4 }, 
    { x: 17.5, z: -17.5, w: 4.5, d: 4.5 }, 
    { x: -18.0, z: -4.2, w: 2, d: 0.4 },  
    { x: -18.0, z: 4.2, w: 2, d: 0.4 },   
    { x: -19.0, z: 0, w: 0.4, d: 8.8 },   
    { x: 0, z: 0, w: 4.5, d: 4.5 }, 
    { x: 14, z: 14, w: 4.5, d: 4.5 }, 
    { x: -14, z: -14, w: 4.5, d: 4.5 },  
    { x: 15, z: 8, w: 3.4, d: 3.4 }, { x: 15, z: -8, w: 3.4, d: 3.4 }, 
    { x: -15, z: 8, w: 3.4, d: 3.4 }, { x: -15, z: -8, w: 3.4, d: 3.4 },
    { x: 8, z: 15, w: 3.4, d: 3.4 }, { x: -8, z: 15, w: 3.4, d: 3.4 }, 
    { x: 8, z: -15, w: 3.4, d: 3.4 }, { x: -8, z: -15, w: 3.4, d: 3.4 },
    { x: 15, z: 22, w: 3.4, d: 3.4 }, { x: -15, z: 22, w: 3.4, d: 3.4 },
    { x: 10, z: -6, w: 3.5, d: 3.5 },
    { x: 11.5, z: 14, w: 2.2, d: 2.2 },
    { x: 13, z: -4, w: 1.8, d: 1.8 },
    { x: 0, z: 10, w: 2.2, d: 2.2 },
    { x: -4.5, z: 0, w: 2.2, d: 2.2 }
];

setInterval(() => {
    if (gameState !== 'LOBBY' && gameState !== 'WAITING' && gameState !== 'GAME_OVER') return;
    
    let moved = false;
    yarnBalls.forEach(yarn => {
        if (yarn.y > -4.6) {
            yarn.vy -= 0.025; 
        }

        if (Math.abs(yarn.vx) > 0.005 || Math.abs(yarn.vz) > 0.005 || Math.abs(yarn.vy) > 0.005 || yarn.y > -4.6) {
            let nextX = yarn.x + yarn.vx;
            let nextZ = yarn.z + yarn.vz;
            let nextY = yarn.y + yarn.vy;
            
            if (nextX > 19.0) { yarn.vx *= -0.7; nextX = 19.0; }
            if (nextX < -19.0) { yarn.vx *= -0.7; nextX = -19.0; }
            if (nextZ > 25.0) { yarn.vz *= -0.7; nextZ = 25.0; } 
            if (nextZ < -19.0) { yarn.vz *= -0.7; nextZ = -19.0; }
            
            if (nextY < -4.6) {
                nextY = -4.6;
                if (yarn.vy < -0.1) {
                    yarn.vy *= -0.6; 
                } else {
                    yarn.vy = 0; 
                }
                yarn.vx *= 0.95; 
                yarn.vz *= 0.95;
            } else if (nextY > -4.6) {
                yarn.vx *= 0.99; 
                yarn.vz *= 0.99;
            }

            Object.values(players).forEach(p => {
                if (p.role !== 'spectator') {
                    let dx = nextX - p.x;
                    let dz = nextZ - p.z;
                    let dy = nextY - p.y;
                    let distSq = dx*dx + dz*dz;
                    if (distSq < 1.4 && dy > -0.5 && dy < 1.5) { 
                        let dist = Math.sqrt(distSq);
                        if(dist === 0) dist = 0.01;
                        let nx = dx / dist;
                        let nz = dz / dist;
                        
                        yarn.vx = nx * 0.3; 
                        yarn.vz = nz * 0.3;
                        
                        nextX = p.x + nx * 1.2;
                        nextZ = p.z + nz * 1.2;
                    }
                }
            });

            lobbyObstacles.forEach(obs => {
                let minX = obs.x - (obs.w / 2) - 0.5;
                let maxX = obs.x + (obs.w / 2) + 0.5;
                let minZ = obs.z - (obs.d / 2) - 0.5;
                let maxZ = obs.z + (obs.d / 2) + 0.5;

                if (nextX > minX && nextX < maxX && nextZ > minZ && nextZ < maxZ && nextY < -1.0) { 
                    let overlapLeft = nextX - minX;
                    let overlapRight = maxX - nextX;
                    let overlapTop = nextZ - minZ;
                    let overlapBottom = maxZ - nextZ;

                    let minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                    
                    if (minOverlap === overlapLeft) { nextX = minX; yarn.vx *= -0.7; }
                    else if (minOverlap === overlapRight) { nextX = maxX; yarn.vx *= -0.7; }
                    else if (minOverlap === overlapTop) { nextZ = minZ; yarn.vz *= -0.7; }
                    else if (minOverlap === overlapBottom) { nextZ = maxZ; yarn.vz *= -0.7; }
                }
            });

            if (nextX < -17.5 && nextX > -19.5 && nextZ > -4.0 && nextZ < 4.0 && nextY < -2.0) {
                if (!yarn.inGoal) {
                    yarn.inGoal = true;
                    io.emit('goalScored', { x: nextX, y: nextY, z: nextZ });
                }
            } else {
                yarn.inGoal = false;
            }

            yarn.x = nextX;
            yarn.y = nextY;
            yarn.z = nextZ;
            
            if (Math.abs(yarn.vx) < 0.01 && Math.abs(yarn.vz) < 0.01 && yarn.y === -4.6 && yarn.vy === 0) {
                yarn.vx = 0; yarn.vz = 0;
            }
            
            moved = true;
        }
    });

    if (moved) {
        io.emit('yarnState', yarnBalls);
    }
}, 33);

const BIOMES = [
    { name: 'Forest', top: 0x556B2F, trunk: 0x5C4033, leaf: 0x228B22, wall: 0x2E8B57, skyDay: 0x87CEEB, skySunset: 0xFF7E47, skyNight: 0x020211 },
    { name: 'Winter', top: 0xFFFAFA, trunk: 0x8B4513, leaf: 0xFFFFFF, wall: 0x4682B4, skyDay: 0xCAE1FF, skySunset: 0xDDA0DD, skyNight: 0x000033 },
    { name: 'Neon Arcade', top: 0x818589, trunk: 0x00FFFF, leaf: 0x32CD32, wall: 0x4B0082, skyDay: 0x1A0B2E, skySunset: 0x4B0082, skyNight: 0x050011 },
    { name: 'Desert', top: 0x9C661F, trunk: 0x8B4513, leaf: 0x2E8B57, wall: 0x5C4033, skyDay: 0x87CEEB, skySunset: 0xFF4500, skyNight: 0x000022 },
    { name: 'Autumn Grove', top: 0xCD853F, trunk: 0x3E2723, leaf: 0xFF4500, wall: 0x8B4513, skyDay: 0x87CEEB, skySunset: 0xFF8C00, skyNight: 0x191970 },
    { name: 'Cherry Blossom', top: 0x9ACD32, trunk: 0x5C4033, leaf: 0xFFB7C5, wall: 0x8FBC8F, skyDay: 0xE0FFFF, skySunset: 0xFF69B4, skyNight: 0x2C1030 },
    { name: 'Moon Base', top: 0x999999, trunk: 0x555555, leaf: 0xCCCCCC, wall: 0x333333, skyDay: 0x000000, skySunset: 0x1A1A24, skyNight: 0x050511 }, 
    { name: 'Glacier', top: 0xAEEEEE, trunk: 0x4682B4, leaf: 0xF0FFFF, wall: 0x5F9EA0, skyDay: 0x87CEFA, skySunset: 0xB0C4DE, skyNight: 0x000080 }
];

function generateMap() {
    mapBlocks = [];
    let offset = Math.random() * 100; 

    // FILTER BIOMES USING COOLDOWN
    let availableBiomes = BIOMES.filter(b => !recentBiomes.includes(b.name));
    if (availableBiomes.length === 0) availableBiomes = BIOMES; // Failsafe
    const currentBiome = availableBiomes[Math.floor(Math.random() * availableBiomes.length)];
    
    recentBiomes.push(currentBiome.name);
    if (recentBiomes.length > 4) recentBiomes.shift(); // Increased to 4 to support 8 biomes

    currentMapWallColor = currentBiome.wall; 
    currentMapSkyDay = currentBiome.skyDay;
    currentMapSkySunset = currentBiome.skySunset;
    currentMapSkyNight = currentBiome.skyNight;
    
    // FILTER LAYOUTS USING COOLDOWN
    const layouts = ['hills', 'islands', 'city', 'blocks', 'craters'];
    let availableLayouts = layouts.filter(l => !recentLayouts.includes(l));
    if (availableLayouts.length === 0) availableLayouts = layouts; // Failsafe
    let currentLayout = availableLayouts[Math.floor(Math.random() * availableLayouts.length)];
    
    // FORCE CRATERS IF MOON BASE
    if (currentBiome.name === 'Moon Base') {
        currentLayout = 'craters';
    } else if (currentLayout === 'craters') {
        // Prevent craters from rolling naturally for other biomes
        currentLayout = 'hills'; 
    }

    recentLayouts.push(currentLayout);
    if (recentLayouts.length > 2) recentLayouts.shift(); // Kept at 2 out of 5 to avoid burning through the layouts

    for (let x = -20; x <= 20; x++) {
        for (let z = -20; z <= 20; z++) {
            let y = 0;
            
            if (currentLayout === 'hills') {
                y = Math.floor(Math.sin((x + offset) / 4) * 2 + Math.cos((z + offset) / 4) * 2);
            } else if (currentLayout === 'islands') {
                y = Math.floor(Math.sin((x + offset) / 3.5) * 3 + Math.cos((z + offset) / 3.5) * 3);
            } else if (currentLayout === 'city') {
                let chunkX = Math.floor(x / 5);
                let chunkZ = Math.floor(z / 5);
                let pseudoRandom = Math.abs(Math.sin(chunkX * 12.9898 + chunkZ * 78.233) * 43758.5453);
                y = -1 + Math.floor((pseudoRandom - Math.floor(pseudoRandom)) * 6);
                if (x % 5 === 0 || z % 5 === 0) y = -2; 
            } else if (currentLayout === 'blocks') {
                y = Math.floor(Math.random() * 4) - 1;
            } else if (currentLayout === 'craters') {
                // Generate a repeating grid of craters using modulo
                let gridX = (x + Math.floor(offset) + 100) % 16 - 8;
                let gridZ = (z + Math.floor(offset) + 100) % 16 - 8;
                let dist = Math.sqrt(gridX * gridX + gridZ * gridZ);
                
                if (dist < 4) {
                    y = Math.floor(dist) - 3; // The deep crater bowl
                } else if (dist < 5.5) {
                    y = 1; // The raised crater rim
                } else {
                    y = Math.random() > 0.8 ? 1 : 0; // Flat lunar surface with occasional debris
                }
            }

            y += 2;

            // STRICTLY one single layer to maximize performance
            mapBlocks.push({ x: x, y: y + 0.5, z: z, color: currentBiome.top }); 

            if (x > -19 && x < 19 && z > -19 && z < 19) {
                // 12% prop spawn rate - dense but highly optimized
                if (Math.random() < 0.06) { 
                    let type = Math.random();

                    if (type < 0.4) {
                        for(let ty = 1; ty <= 3; ty++) {
                            mapBlocks.push({ x: x, y: y + 0.5 + ty, z: z, color: currentBiome.trunk });
                        }
                        mapBlocks.push({ x: x+1, y: y + 3.5, z: z, color: currentBiome.leaf });
                        mapBlocks.push({ x: x-1, y: y + 3.5, z: z, color: currentBiome.leaf });
                        mapBlocks.push({ x: x, y: y + 3.5, z: z+1, color: currentBiome.leaf });
                        mapBlocks.push({ x: x, y: y + 3.5, z: z-1, color: currentBiome.leaf });
                        mapBlocks.push({ x: x, y: y + 4.5, z: z, color: currentBiome.leaf }); 

                    } else if (type < 0.6) {
                        const yarnColors = [0xFF1493, 0x00BFFF, 0xFFA500, 0x9400D3]; 
                        const yColor = yarnColors[Math.floor(Math.random() * yarnColors.length)];
                        mapBlocks.push({ x: x, y: y + 1.5, z: z, color: yColor });
                    } else if (type < 0.8) {
                        const flowerColors = [0xFFFF00, 0xFF69B4, 0xFFFFFF]; 
                        const fColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                        mapBlocks.push({ x: x, y: y + 1.5, z: z, color: currentBiome.leaf }); 
                        mapBlocks.push({ x: x, y: y + 2.5, z: z, color: fColor }); 
                    } else {
                        const boxColor = 0xC19A6B;
                        mapBlocks.push({ x: x, y: y + 1.5, z: z, color: boxColor }); 
                        mapBlocks.push({ x: x, y: y + 2.5, z: z, color: boxColor }); 
                    }
                }
            }
        }
    }
}

function startLobby() {
    const ids = Object.keys(players);
    if (ids.length < 2) {
        gameState = 'WAITING';
        timeRemaining = 0;
        io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [], lastLeaderboard: lastLeaderboard, lastMvp: lastMvp });
        return;
    }

    let wasGameOver = (gameState === 'GAME_OVER');
    gameState = 'LOBBY';
    timeRemaining = 60; 
    currentMapWallColor = 0x8B4513; 
    currentMapSkyDay = 0x87CEEB;
    currentMapSkySunset = 0xFF7E47;
    currentMapSkyNight = 0x020211;
    
    yarnBalls[0] = { id: 'yarn0', x: -8, y: -4.6, z: 0, color: 0xFF0000, vx: 0, vy: 0, vz: 0, inGoal: false };
    io.emit('yarnState', yarnBalls);

    if (!wasGameOver) {
        mapBlocks = [];
        io.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });
        
        ids.forEach(id => {
            let bed = catBeds[Math.floor(Math.random() * catBeds.length)];
            players[id].x = bed.x + (Math.random() > 0.5 ? 0.6 : -0.6);
            players[id].y = -4; 
            players[id].z = bed.z + (Math.random() > 0.5 ? 0.6 : -0.6);
            players[id].rY = Math.atan2(players[id].x, players[id].z); 
            
            io.to(id).emit('forceTeleport', {x: players[id].x, y: players[id].y, z: players[id].z, rY: players[id].rY});
        });
    }

    ids.forEach(id => {
        players[id].role = 'hider';
        players[id].color = players[id].baseColor;
        players[id].decoys = 3; 
        players[id].hairballs = 10; 
        players[id].stunned = false;
        players[id].upsideDown = false;
        players[id].respawnBeam = false;
        players[id].emote = 0; 
    });
    
    io.emit('currentPlayers', players); 

    if (gameTimer) clearInterval(gameTimer);
    
    gameTimer = setInterval(() => {
        timeRemaining--;

        if (gameState === 'LOBBY') {
            activePlayers = Object.values(players).filter(p => {
                return Math.sqrt(p.x * p.x + p.z * p.z) < 6;
            }).map(p => p.id);

            let totalPlayers = Object.keys(players).length;

            if (totalPlayers >= 2 && activePlayers.length === totalPlayers) {
                if (timeRemaining > 5) {
                    timeRemaining = 5;
                }
            }

            if (timeRemaining <= 0) {
                if (activePlayers.length < 2) {
                    timeRemaining = 15; 
                } else {
                    gameState = 'BEAMING';
                    timeRemaining = 3; 
                    io.emit('beamingPlayers', activePlayers);
                }
            }
        } else if (gameState === 'BEAMING' && timeRemaining <= 0) {
            startRound(); 
        } else if (gameState === 'HIDING' && timeRemaining <= 0) {
            gameState = 'SEEKING';
            timeRemaining = 180; 
        } else if (gameState === 'SEEKING') {
            let hidersLeft = false;
            activePlayers.forEach(id => {
                if (players[id] && players[id].role === 'hider') {
                    players[id].score += 1; 
                    hidersLeft = true;
                }
            });

            if (!hidersLeft || timeRemaining <= 0) {
                gameState = 'GAME_OVER';
                timeRemaining = 5; 
                winReason = hidersLeft ? 'HIDERS SURVIVE!' : 'SEEKERS WIN!';
                
                let sortedIds = activePlayers.filter(id => players[id]).sort((a,b) => players[b].score - players[a].score);
                currentWinnerId = sortedIds.length > 0 ? sortedIds[0] : null;

                if (currentWinnerId && players[currentWinnerId]) {
                    let w = players[currentWinnerId];
                    lastMvp = { name: w.name, score: w.score, face: w.face, color: w.baseColor, role: w.role };
                }
                lastLeaderboard = sortedIds.map(id => ({ name: players[id].name, score: players[id].score }));

                mapBlocks = [];
                currentMapWallColor = 0x8B4513; 
                currentMapSkyDay = 0x87CEEB;
                currentMapSkySunset = 0xFF7E47;
                currentMapSkyNight = 0x020211;
                io.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });
                
                activePlayers.forEach(id => {
                    players[id].role = 'hider';
                    players[id].color = players[id].baseColor;
                    players[id].stunned = false;
                    players[id].upsideDown = false;
                    players[id].respawnBeam = false;
                    
                    if (id === currentWinnerId) {
                        players[id].x = 17.5;
                        players[id].y = -3.5; 
                        players[id].z = -17.5;
                        players[id].rY = Math.PI * 0.75; 
                    } else {
                        // Safe spawn zone in front of the MVP platform
                        players[id].x = 11 + (Math.random() * 3); 
                        players[id].y = -4; 
                        players[id].z = -11 - (Math.random() * 3);
                        
                        // Calculate rotation to face the MVP (17.5, -17.5)
                        let dx = 17.5 - players[id].x;
                        let dz = -17.5 - players[id].z;
                        players[id].rY = Math.atan2(-dx, -dz); 
                    }
                    io.to(id).emit('forceTeleport', {x: players[id].x, y: players[id].y, z: players[id].z, rY: players[id].rY});
                });
                io.emit('currentPlayers', players);
            }
        } else if (gameState === 'GAME_OVER' && timeRemaining <= 0) {
            startLobby(); 
        }

        const leaderboardData = Object.values(players)
            .filter(p => activePlayers.includes(p.id)) 
            .map(p => ({ id: p.id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score); 

        io.emit('gameStateUpdate', { 
            state: gameState, 
            time: timeRemaining, 
            leaderboard: leaderboardData,
            lastLeaderboard: lastLeaderboard, 
            winnerId: currentWinnerId,
            winReason: winReason,
            lastMvp: lastMvp 
        });
    }, 1000);
}

function startRound() {
    gameState = 'HIDING';
    timeRemaining = 10; 
    activeDecoys = {};

    generateMap();
    io.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });

    const seekerId = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    
    Object.keys(players).forEach(id => {
        if (activePlayers.includes(id)) {
            players[id].role = (id === seekerId) ? 'seeker' : 'hider';
            players[id].color = (id === seekerId) ? 0xFF0000 : players[id].baseColor;
            players[id].y = 25; 
            
            if (mapBlocks.length > 0) {
                let randomBlock = mapBlocks[Math.floor(Math.random() * mapBlocks.length)];
                players[id].x = randomBlock.x;
                players[id].z = randomBlock.z;
            } else {
                players[id].x = 0;
                players[id].z = 0;
            }
            
        } else {
            players[id].role = 'spectator';
            players[id].color = players[id].baseColor;
        }
        players[id].decoys = 3; 
        players[id].hairballs = 10; 
        players[id].stunned = false;
        players[id].upsideDown = false;
        players[id].respawnBeam = false;
        players[id].emote = 0; 
        
        io.to(id).emit('forceTeleport', {x: players[id].x, y: players[id].y, z: players[id].z, rY: players[id].rY});
    });
    
    io.emit('currentPlayers', players); 
}

io.on('connection', (socket) => {
    if (mapBlocks.length === 0 && (gameState === 'HIDING' || gameState === 'SEEKING')) {
        generateMap();
    }
    socket.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });
    socket.emit('yarnState', yarnBalls); 

    let joinRole = (gameState === 'WAITING' || gameState === 'LOBBY' || Object.keys(players).length < 1) ? 'hider' : 'spectator';

    let isLobbyPhase = (gameState === 'LOBBY' || gameState === 'WAITING');
    let bed = catBeds[Math.floor(Math.random() * catBeds.length)];
    let startX = isLobbyPhase ? bed.x + (Math.random() > 0.5 ? 0.6 : -0.6) : (Math.random() * 30) - 15;
    let startZ = isLobbyPhase ? bed.z + (Math.random() > 0.5 ? 0.6 : -0.6) : (Math.random() * 30) - 15;
    let startRY = isLobbyPhase ? Math.atan2(startX, startZ) : 0; 
    let startY = isLobbyPhase ? -4 : 20;

    players[socket.id] = {
        id: socket.id,
        name: 'Cat-' + socket.id.substring(0, 4),
        score: 0,
        x: startX,
        y: startY, 
        z: startZ,
        rY: startRY, moving: false, role: joinRole, color: 0xFFFFFF, baseColor: 0xFFFFFF,
        decoys: 3, hairballs: 10, stunned: false, upsideDown: false, respawnBeam: false, emote: 0, face: 'normal',
        wardrobe: [null, null, null]
    };

    socket.emit('currentPlayers', players);
    socket.emit('forceTeleport', { x: startX, y: startY, z: startZ, rY: startRY });
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    if (Object.keys(players).length >= 2 && gameState === 'WAITING') {
        startLobby();
    }

    socket.on('joinGame', (data) => {
        if (players[socket.id]) {
            let cleanName = data.name.trim().substring(0, 12).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            if (cleanName.length > 0) {
                players[socket.id].name = cleanName;
            }
            players[socket.id].baseColor = data.color;
            players[socket.id].face = data.face || 'normal';
            players[socket.id].wardrobe = data.wardrobe || [null, null, null];
            if (players[socket.id].role !== 'seeker') {
                players[socket.id].color = data.color;
            }
            io.emit('currentPlayers', players);
        }
    });

    socket.on('kickYarn', (data) => {
        let yarn = yarnBalls.find(y => y.id === data.id);
        if (yarn && (gameState === 'LOBBY' || gameState === 'WAITING' || gameState === 'GAME_OVER')) {
            let force = 0.4 + Math.random() * 0.3; 
            yarn.vx = data.dirX * force;
            yarn.vz = data.dirZ * force;
            yarn.vy = 0.35 + Math.random() * 0.2;  
        }
    });

    socket.on('tagPlayer', (targetId) => {
        if (players[targetId] && players[targetId].role === 'hider') {
            if (players[socket.id] && players[socket.id].role === 'seeker' && !players[socket.id].stunned) {
                players[targetId].role = 'seeker';
                players[targetId].color = 0xFF0000;
                
                players[socket.id].score += (50 + timeRemaining);
                
                io.emit('currentPlayers', players); 
            }
        }
    });

    socket.on('playerMovement', (movementData) => {
        players[socket.id].x = movementData.x; players[socket.id].y = movementData.y; players[socket.id].z = movementData.z;
        players[socket.id].rY = movementData.rY; players[socket.id].moving = movementData.moving;
        players[socket.id].color = movementData.color;
        players[socket.id].emote = movementData.emote;
        
        socket.broadcast.emit('playerMoved', { 
            id: socket.id, x: movementData.x, y: movementData.y, z: movementData.z, 
            rY: movementData.rY, moving: movementData.moving, color: movementData.color, role: players[socket.id].role,
            emote: movementData.emote, stunned: players[socket.id].stunned,
            upsideDown: players[socket.id].upsideDown, respawnBeam: players[socket.id].respawnBeam
        });
    });

    socket.on('taunt', () => {
        if (players[socket.id] && players[socket.id].role === 'hider' && gameState === 'SEEKING') {
            players[socket.id].score += 5; 
            socket.broadcast.emit('playerTaunted', socket.id);
        }
    });

    socket.on('dropDecoy', (data) => {
        if (players[socket.id] && players[socket.id].role === 'hider' && gameState === 'SEEKING' && players[socket.id].decoys > 0) {
            players[socket.id].decoys--; 
            const decoyId = 'decoy_' + (nextDecoyId++);
            activeDecoys[decoyId] = socket.id; 
            io.emit('spawnDecoy', { id: decoyId, x: data.x, y: data.y, z: data.z, rY: data.rY, color: data.color, face: players[socket.id].face });
            socket.emit('inventoryUpdate', { decoys: players[socket.id].decoys, hairballs: players[socket.id].hairballs });
        }
    });

    socket.on('tagDecoy', (decoyId) => {
        if (players[socket.id] && players[socket.id].role === 'seeker') {
            const ownerId = activeDecoys[decoyId];
            if (ownerId && players[ownerId] && players[ownerId].role === 'hider') {
                players[ownerId].score += 20; 
            }
            io.emit('decoyPopped', decoyId);
            delete activeDecoys[decoyId]; 
        }
    });

    socket.on('shootHairball', (data) => {
        if (players[socket.id] && players[socket.id].role === 'hider') {
            if (gameState === 'SEEKING' && players[socket.id].hairballs > 0) {
                players[socket.id].hairballs--;
                const hbId = 'hb_' + (nextHairballId++);
                io.emit('spawnHairball', { id: hbId, ownerId: socket.id, x: data.x, y: data.y, z: data.z, dirX: data.dirX, dirZ: data.dirZ });
                socket.emit('inventoryUpdate', { decoys: players[socket.id].decoys, hairballs: players[socket.id].hairballs });
            } else if (gameState === 'LOBBY' || gameState === 'WAITING' || gameState === 'GAME_OVER') {
                const hbId = 'hb_' + (nextHairballId++);
                io.emit('spawnHairball', { id: hbId, ownerId: socket.id, x: data.x, y: data.y, z: data.z, dirX: data.dirX, dirZ: data.dirZ });
            }
        }
    });

    socket.on('hairballHit', (targetId) => {
        if (gameState !== 'SEEKING') return; 

        if (players[targetId] && players[targetId].role === 'seeker' && !players[targetId].stunned) {
            
            if (players[socket.id] && players[socket.id].role === 'hider') {
                players[socket.id].score += 20; 
            }

            players[targetId].stunned = true;
            io.emit('playerStunned', targetId);
            
            setTimeout(() => {
                if (players[targetId]) {
                    players[targetId].stunned = false;
                    io.emit('playerUnstunned', targetId);
                }
            }, 3000);
        }
    });

    socket.on('lobbyMeow', () => {
        if (gameState === 'WAITING' || gameState === 'LOBBY' || gameState === 'GAME_OVER') {
            socket.broadcast.emit('playerTaunted', socket.id);
        }
    });

    socket.on('lavaFall', () => {
        if (gameState === 'SEEKING' || gameState === 'HIDING') {
            if (players[socket.id] && players[socket.id].role === 'hider') {
                players[socket.id].stunned = true;
                players[socket.id].upsideDown = true;
                players[socket.id].respawnBeam = true;
                
                io.emit('playerStunned', socket.id);
                io.emit('playerUpsideDown', { id: socket.id, state: true });

                setTimeout(() => {
                    if (players[socket.id]) {
                        players[socket.id].stunned = false;
                        players[socket.id].upsideDown = false;
                        players[socket.id].respawnBeam = false;
                        
                        io.emit('playerUnstunned', socket.id);
                        io.emit('playerUpsideDown', { id: socket.id, state: false });
                    }
                }, 10000); // 10 SECOND STUN PENALTY
            } else if (players[socket.id] && players[socket.id].role === 'seeker') {
                io.emit('playerLavaDeath', socket.id);
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
        
        for (let dId in activeDecoys) {
            if (activeDecoys[dId] === socket.id) {
                delete activeDecoys[dId];
            }
        }
        
        activePlayers = activePlayers.filter(id => id !== socket.id);

        if (gameState !== 'WAITING' && gameState !== 'LOBBY' && activePlayers.length < 2) {
            gameState = 'WAITING';
            timeRemaining = 0;
            mapBlocks = [];
            io.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });
            if (gameTimer) clearInterval(gameTimer);
            io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [], lastLeaderboard: lastLeaderboard, lastMvp: lastMvp });
        } else if (gameState === 'WAITING' && Object.keys(players).length < 2) {
            mapBlocks = [];
            io.emit('initMap', { blocks: mapBlocks, wallColor: currentMapWallColor, skyDay: currentMapSkyDay, skySunset: currentMapSkySunset, skyNight: currentMapSkyNight });
            if (gameTimer) clearInterval(gameTimer);
            io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [], lastLeaderboard: lastLeaderboard, lastMvp: lastMvp });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running at: http://localhost:${PORT}`));