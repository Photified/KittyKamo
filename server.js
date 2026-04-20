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

function generateMap() {
    mapBlocks = [];
    let offset = Math.random() * 100; 
    let occupiedColumns = new Set(); // Prevents structures from spawning inside each other

    for (let x = -20; x <= 20; x++) {
        for (let z = -20; z <= 20; z++) {
            let y = Math.floor(Math.sin((x + offset) / 4) * 2 + Math.cos((z + offset) / 4) * 2);
            let colKey = `${x},${z}`;

            // --- BASE TERRAIN ---
            mapBlocks.push({ x: x, y: y + 0.5, z: z, color: 0x556B2F }); // Grass top
            mapBlocks.push({ x: x, y: y - 0.5, z: z, color: 0x654321 }); // Dirt bottom

            // Add Puddles in the lowlands
            if (y < -1 && Math.random() < 0.2) {
                 mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x1E90FF }); // Blue water block
                 occupiedColumns.add(colKey);
            }

            // --- STRUCTURES & PROPS ---
            // Only spawn if the column is empty and we hit the 6% random chance
            if (!occupiedColumns.has(colKey) && Math.random() < 0.06) {
                let type = Math.random();

                if (type < 0.4) {
                    // 1. BETTER TREES (Oak Style)
                    // Trunk
                    for(let ty = 1; ty <= 3; ty++) {
                        mapBlocks.push({ x: x, y: y + 0.5 + ty, z: z, color: 0x5C4033 });
                    }
                    // Leaves (Plus shape)
                    const leafColor = 0x228B22;
                    for(let lx = -1; lx <= 1; lx++) {
                        for(let lz = -1; lz <= 1; lz++) {
                            if (Math.abs(lx) === 1 && Math.abs(lz) === 1) continue; // Removes corners for a plus shape
                            mapBlocks.push({ x: x + lx, y: y + 3.5, z: z + lz, color: leafColor });
                            occupiedColumns.add(`${x+lx},${z+lz}`);
                        }
                    }
                    mapBlocks.push({ x: x, y: y + 4.5, z: z, color: leafColor }); // Top leaf

                } else if (type < 0.6) {
                    // 2. GIANT YARN BALLS (2x2x2 bright color cluster)
                    const yarnColors = [0xFF1493, 0x00BFFF, 0xFF4500, 0x9400D3]; // Pink, Cyan, Orange, Purple
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
                    // 3. TALL FLOWERS
                    const flowerColors = [0xFFFF00, 0xFF69B4, 0xFFFFFF]; // Yellow, Pink, White
                    const fColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                    mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x32CD32 }); // Bright green stem
                    mapBlocks.push({ x: x, y: y + 2.5, z: z, color: fColor }); // Flower head
                    occupiedColumns.add(colKey);

                } else {
                    // 4. CARDBOARD BOXES (Hollow 3x3x2 structures)
                    const boxColor = 0xC19A6B;
                    for(let bx = -1; bx <= 1; bx++) {
                        for(let bz = -1; bz <= 1; bz++) {
                            // Leave one side open for the cat to enter, and keep the middle hollow
                            if (bx === 0 && bz === 1) continue; 
                            if (bx === 0 && bz === 0) continue; 
                            
                            mapBlocks.push({ x: x + bx, y: y + 1.5, z: z + bz, color: boxColor }); // Bottom wall
                            mapBlocks.push({ x: x + bx, y: y + 2.5, z: z + bz, color: boxColor }); // Top wall
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

    gameState = 'LOBBY';
    timeRemaining = 60; 
    
    // Clear map for a flat lobby arena!
    mapBlocks = [];
    io.emit('initMap', mapBlocks);

    ids.forEach(id => {
        players[id].role = 'hider';
        players[id].color = players[id].baseColor;
        
        // Spawn players outside of the beam (radius > 6)
        let angle = Math.random() * Math.PI * 2;
        let dist = 8 + Math.random() * 8; // Dist between 8 and 16
        players[id].x = Math.cos(angle) * dist;
        players[id].y = 20; 
        players[id].z = Math.sin(angle) * dist;
        
        players[id].score = 0; 
        players[id].decoyUsed = false; 
        players[id].hairballs = 3; 
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
                timeRemaining = 8; // Extra time for MVP celebration
                winReason = hidersLeft ? 'HIDERS SURVIVE!' : 'SEEKERS WIN!';
                
                let sortedIds = activePlayers.filter(id => players[id]).sort((a,b) => players[b].score - players[a].score);
                currentWinnerId = sortedIds.length > 0 ? sortedIds[0] : null;

                // Move everyone to the lobby immediately for the MVP celebration
                mapBlocks = [];
                io.emit('initMap', mapBlocks);
                
                activePlayers.forEach(id => {
                    players[id].role = 'hider';
                    players[id].color = players[id].baseColor;
                    players[id].stunned = false;
                    
                    if (id === currentWinnerId) {
                        players[id].x = 0;
                        players[id].y = 0; // On top of the roof of the customization house
                        players[id].z = -18.5;
                        players[id].rY = 0;
                    } else {
                        // Spawn randomly in front of the house looking at it
                        players[id].x = (Math.random() - 0.5) * 12;
                        players[id].y = -4; 
                        players[id].z = -12 + (Math.random() * 4);
                        players[id].rY = 0; // Look towards -Z (the house)
                    }
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
        players[id].decoyUsed = false; 
        players[id].hairballs = 3; 
        players[id].stunned = false;
        players[id].emote = 0; 
    });
    
    io.emit('currentPlayers', players); 
}

io.on('connection', (socket) => {
    if (mapBlocks.length === 0 && gameState !== 'LOBBY' && gameState !== 'WAITING') {
        generateMap();
    }
    socket.emit('initMap', mapBlocks);

    let joinRole = (gameState === 'WAITING' || gameState === 'LOBBY' || Object.keys(players).length < 1) ? 'hider' : 'spectator';

    // Calculate a safe lobby spawn
    let angle = Math.random() * Math.PI * 2;
    let dist = 8 + Math.random() * 8;
    let startX = (gameState === 'LOBBY' || gameState === 'WAITING') ? Math.cos(angle) * dist : (Math.random() * 30) - 15;
    let startZ = (gameState === 'LOBBY' || gameState === 'WAITING') ? Math.sin(angle) * dist : (Math.random() * 30) - 15;

    players[socket.id] = {
        id: socket.id,
        name: 'Cat-' + socket.id.substring(0, 4),
        score: 0,
        x: startX,
        y: 20, 
        z: startZ,
        rY: 0, moving: false, role: joinRole, color: 0xFFFFFF, baseColor: 0xFFFFFF,
        decoyUsed: false, hairballs: 3, stunned: false, emote: 0, face: 'normal'
    };

    socket.emit('currentPlayers', players);
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
            if (players[socket.id].role !== 'seeker') {
                players[socket.id].color = data.color;
            }
            io.emit('currentPlayers', players);
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
        if (players[socket.id] && players[socket.id].role === 'hider' && gameState === 'SEEKING' && !players[socket.id].decoyUsed) {
            players[socket.id].decoyUsed = true; 
            const decoyId = 'decoy_' + (nextDecoyId++);
            activeDecoys[decoyId] = socket.id; 
            io.emit('spawnDecoy', { id: decoyId, x: data.x, y: data.y, z: data.z, rY: data.rY, color: data.color, face: players[socket.id].face });
            socket.emit('inventoryUpdate', { decoys: 0, hairballs: players[socket.id].hairballs });
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
                socket.emit('inventoryUpdate', { decoys: players[socket.id].decoyUsed ? 0 : 1, hairballs: players[socket.id].hairballs });
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