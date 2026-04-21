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

// Coordinates for all 8 cat beds in the lobby
const catBeds = [
    {x: 15, z: 8}, {x: 15, z: -8}, {x: -15, z: 8}, {x: -15, z: -8},
    {x: 8, z: 15}, {x: -8, z: 15}, {x: 8, z: -15}, {x: -8, z: -15}
];

// Server-side state for the interactive yarn balls (Now with Y-velocity for arcs!)
let yarnBalls = [
    { id: 'yarn0', x: 5, y: -4.6, z: 5, color: 0xFF1493, vx: 0, vy: 0, vz: 0 },
    { id: 'yarn1', x: -5, y: -4.6, z: 5, color: 0x00BFFF, vx: 0, vy: 0, vz: 0 },
    { id: 'yarn2', x: 0, y: -4.6, z: 10, color: 0xFFFF00, vx: 0, vy: 0, vz: 0 }
];

// Bouncy physics loop for the yarn balls (Runs at 30fps)
setInterval(() => {
    if (gameState !== 'LOBBY' && gameState !== 'WAITING' && gameState !== 'GAME_OVER') return;
    
    let moved = false;
    yarnBalls.forEach(yarn => {
        // Apply gravity if it's in the air
        if (yarn.y > -4.6) {
            yarn.vy -= 0.025; 
        }

        // Only calculate physics if it's moving or in the air
        if (Math.abs(yarn.vx) > 0.005 || Math.abs(yarn.vz) > 0.005 || Math.abs(yarn.vy) > 0.005 || yarn.y > -4.6) {
            let nextX = yarn.x + yarn.vx;
            let nextZ = yarn.z + yarn.vz;
            let nextY = yarn.y + yarn.vy;
            
            // 1. Basic Wall Bounces (Outer Lobby Walls)
            if (nextX > 19) { yarn.vx *= -0.7; nextX = 19; }
            if (nextX < -19) { yarn.vx *= -0.7; nextX = -19; }
            if (nextZ > 18.5) { yarn.vz *= -0.7; nextZ = 18.5; } // Front of mirror
            if (nextZ < -19.5) { yarn.vz *= -0.7; nextZ = -19.5; }
            
            // 2. Floor Bounce
            if (nextY < -4.6) {
                nextY = -4.6;
                if (yarn.vy < -0.1) {
                    yarn.vy *= -0.6; // Bounce back up!
                } else {
                    yarn.vy = 0; // Stop micro-bouncing when rolling
                }
                yarn.vx *= 0.95; // Ground friction
                yarn.vz *= 0.95;
            } else if (nextY > -4.6) {
                yarn.vx *= 0.99; // Air resistance
                yarn.vz *= 0.99;
            }

            // 3. Player Collision (Bounce off other cats)
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
                        
                        yarn.vx = nx * 0.3; // Deflect away from the cat
                        yarn.vz = nz * 0.3;
                        
                        nextX = p.x + nx * 1.2;
                        nextZ = p.z + nz * 1.2;
                    }
                }
            });

            // 4. Object Collision (Rough bounding boxes for the main lobby structures)
            const lobbyObstacles = [
                { minX: -3.5, maxX: 3.5, minZ: 18.5, maxZ: 25 }, // Mirror area
                { minX: -5.5, maxX: 5.5, minZ: -20.5, maxZ: -16.5 }, // Desk/Podium area
                { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 }, // Center tree
                { minX: -16.5, maxX: -11.5, minZ: -16.5, maxZ: -11.5 }, // NW tree
                { minX: 11.5, maxX: 16.5, minZ: 11.5, maxZ: 16.5 }  // SE tree
            ];

            lobbyObstacles.forEach(obs => {
                // If hitting an object and close to the ground
                if (nextX > obs.minX && nextX < obs.maxX && nextZ > obs.minZ && nextZ < obs.maxZ && nextY < 0) { 
                    let overlapLeft = nextX - obs.minX;
                    let overlapRight = obs.maxX - nextX;
                    let overlapTop = nextZ - obs.minZ;
                    let overlapBottom = obs.maxZ - nextZ;

                    let minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                    
                    if (minOverlap === overlapLeft) { nextX = obs.minX; yarn.vx *= -0.7; }
                    else if (minOverlap === overlapRight) { nextX = obs.maxX; yarn.vx *= -0.7; }
                    else if (minOverlap === overlapTop) { nextZ = obs.minZ; yarn.vz *= -0.7; }
                    else if (minOverlap === overlapBottom) { nextZ = obs.maxZ; yarn.vz *= -0.7; }
                }
            });

            yarn.x = nextX;
            yarn.y = nextY;
            yarn.z = nextZ;
            
            // Put it fully to sleep if it's barely moving
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

function generateMap() {
    mapBlocks = [];
    let offset = Math.random() * 100; 
    let occupiedColumns = new Set(); 

    for (let x = -20; x <= 20; x++) {
        for (let z = -20; z <= 20; z++) {
            let y = Math.floor(Math.sin((x + offset) / 4) * 2 + Math.cos((z + offset) / 4) * 2);
            let colKey = `${x},${z}`;

            mapBlocks.push({ x: x, y: y + 0.5, z: z, color: 0x556B2F }); 
            mapBlocks.push({ x: x, y: y - 0.5, z: z, color: 0x654321 }); 

            if (y < -1 && Math.random() < 0.2) {
                 mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x1E90FF }); 
                 occupiedColumns.add(colKey);
            }

            if (!occupiedColumns.has(colKey) && Math.random() < 0.06) {
                let type = Math.random();

                if (type < 0.4) {
                    for(let ty = 1; ty <= 3; ty++) {
                        mapBlocks.push({ x: x, y: y + 0.5 + ty, z: z, color: 0x5C4033 });
                    }
                    const leafColor = 0x228B22;
                    for(let lx = -1; lx <= 1; lx++) {
                        for(let lz = -1; lz <= 1; lz++) {
                            if (Math.abs(lx) === 1 && Math.abs(lz) === 1) continue; 
                            mapBlocks.push({ x: x + lx, y: y + 3.5, z: z + lz, color: leafColor });
                            occupiedColumns.add(`${x+lx},${z+lz}`);
                        }
                    }
                    mapBlocks.push({ x: x, y: y + 4.5, z: z, color: leafColor }); 

                } else if (type < 0.6) {
                    const yarnColors = [0xFF1493, 0x00BFFF, 0xFF4500, 0x9400D3]; 
                    const yColor = yarnColors[Math.floor(Math.random() * yarnColors.length)];
                    for(let yx = 0; yx <= 1; yx++) {
                        for(let yz = 0; yz <= 1; yz++) {
                            for(let yy = 1; yy <= 2; yy++) {
                                mapBlocks.push({ x: x + yx, y: y + 0.5 + yy, z: z + yz, color: yColor });
                                occupiedColumns.add(`${x+yx},${z+yz}`);
                            }
                        }
                    }

                } else if (type < 0.8) {
                    const flowerColors = [0xFFFF00, 0xFF69B4, 0xFFFFFF]; 
                    const fColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                    mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x32CD32 }); 
                    mapBlocks.push({ x: x, y: y + 2.5, z: z, color: fColor }); 
                    occupiedColumns.add(colKey);

                } else {
                    const boxColor = 0xC19A6B;
                    for(let bx = -1; bx <= 1; bx++) {
                        for(let bz = -1; bz <= 1; bz++) {
                            if (bx === 0 && bz === 1) continue; 
                            if (bx === 0 && bz === 0) continue; 
                            
                            mapBlocks.push({ x: x + bx, y: y + 1.5, z: z + bz, color: boxColor }); 
                            mapBlocks.push({ x: x + bx, y: y + 2.5, z: z + bz, color: boxColor }); 
                            occupiedColumns.add(`${x+bx},${z+bz}`);
                        }
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
        io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [] });
        return;
    }

    let wasGameOver = (gameState === 'GAME_OVER');
    gameState = 'LOBBY';
    timeRemaining = 60; 
    
    // Reset yarn balls to starting positions
    yarnBalls[0] = { id: 'yarn0', x: 5, y: -4.6, z: 5, color: 0xFF1493, vx: 0, vy: 0, vz: 0 };
    yarnBalls[1] = { id: 'yarn1', x: -5, y: -4.6, z: 5, color: 0x00BFFF, vx: 0, vy: 0, vz: 0 };
    yarnBalls[2] = { id: 'yarn2', x: 0, y: -4.6, z: 10, color: 0xFFFF00, vx: 0, vy: 0, vz: 0 };
    io.emit('yarnState', yarnBalls);

    if (!wasGameOver) {
        mapBlocks = [];
        io.emit('initMap', mapBlocks);

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
        players[id].score = 0; 
        players[id].decoys = 3; 
        players[id].hairballs = 10; 
        players[id].stunned = false;
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
            timeRemaining = 60; 
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

                mapBlocks = [];
                io.emit('initMap', mapBlocks);
                
                activePlayers.forEach(id => {
                    players[id].role = 'hider';
                    players[id].color = players[id].baseColor;
                    players[id].stunned = false;
                    
                    if (id === currentWinnerId) {
                        players[id].x = 17.5;
                        players[id].y = -3.5; // Top of the Crown Podium Base
                        players[id].z = -17.5;
                        players[id].rY = Math.PI * 0.75; 
                    } else {
                        players[id].x = 13 + (Math.random() * 3); 
                        players[id].y = -4; 
                        players[id].z = -13 - (Math.random() * 3);
                        players[id].rY = -Math.PI / 4; 
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
            winnerId: currentWinnerId,
            winReason: winReason
        });
    }, 1000);
}

function startRound() {
    gameState = 'HIDING';
    timeRemaining = 10; 
    activeDecoys = {};

    generateMap();
    io.emit('initMap', mapBlocks);

    const seekerId = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    
    Object.keys(players).forEach(id => {
        if (activePlayers.includes(id)) {
            players[id].role = (id === seekerId) ? 'seeker' : 'hider';
            players[id].color = (id === seekerId) ? 0xFF0000 : players[id].baseColor;
            players[id].y = 25; 
            players[id].x = (Math.random() * 30) - 15; 
            players[id].z = (Math.random() * 30) - 15;
            players[id].score = 0; 
        } else {
            players[id].role = 'spectator';
            players[id].color = players[id].baseColor;
        }
        players[id].decoys = 3; 
        players[id].hairballs = 10; 
        players[id].stunned = false;
        players[id].emote = 0; 
        
        io.to(id).emit('forceTeleport', {x: players[id].x, y: players[id].y, z: players[id].z, rY: players[id].rY});
    });
    
    io.emit('currentPlayers', players); 
}

io.on('connection', (socket) => {
    if (mapBlocks.length === 0 && (gameState === 'HIDING' || gameState === 'SEEKING')) {
        generateMap();
    }
    socket.emit('initMap', mapBlocks);
    socket.emit('yarnState', yarnBalls); // Send initial yarn state to new player

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
        decoys: 3, hairballs: 10, stunned: false, emote: 0, face: 'normal',
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
            let force = 0.4 + Math.random() * 0.3; // Kick strength
            yarn.vx = data.dirX * force;
            yarn.vz = data.dirZ * force;
            yarn.vy = 0.35 + Math.random() * 0.2;  // Upward arc added here!
        }
    });

    socket.on('tagPlayer', (targetId) => {
        if (players[targetId] && players[targetId].role === 'hider') {
            if (players[socket.id] && players[socket.id].role === 'seeker' && !players[socket.id].stunned) {
                players[targetId].role = 'seeker';
                players[targetId].color = 0xFF0000;
                
                players[socket.id].score += 15;
                
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
            emote: movementData.emote, stunned: players[socket.id].stunned
        });
    });

    socket.on('taunt', () => {
        if (players[socket.id] && players[socket.id].role === 'hider' && gameState === 'SEEKING') {
            players[socket.id].score += 15; 
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
                players[ownerId].score += 15;
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
                players[socket.id].score += 15;
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
            io.emit('initMap', mapBlocks);
            if (gameTimer) clearInterval(gameTimer);
            io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [] });
        } else if (gameState === 'WAITING' && Object.keys(players).length < 2) {
            mapBlocks = [];
            io.emit('initMap', mapBlocks);
            if (gameTimer) clearInterval(gameTimer);
            io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [] });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running at: http://localhost:${PORT}`));