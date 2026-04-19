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

function generateMap() {
    mapBlocks = [];
    let offset = Math.random() * 100; 

    for (let x = -20; x <= 20; x++) {
        for (let z = -20; z <= 20; z++) {
            let y = Math.floor(Math.sin((x + offset) / 4) * 2 + Math.cos((z + offset) / 4) * 2);
            
            mapBlocks.push({ x: x, y: y + 0.5, z: z, color: 0x556B2F });
            mapBlocks.push({ x: x, y: y - 0.5, z: z, color: 0x654321 });

            if (Math.random() < 0.04 && y >= 0) {
                mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x5C4033 }); 
                mapBlocks.push({ x: x, y: y + 2.5, z: z, color: 0x228B22 }); 
            }
            if (Math.random() < 0.05 && y < 0) {
                mapBlocks.push({ x: x, y: y + 1.5, z: z, color: 0x006400 }); 
            }
        }
    }
}

function startRound() {
    const ids = Object.keys(players);
    if (ids.length < 2) {
        gameState = 'WAITING';
        io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [] });
        return;
    }

    generateMap(); 
    io.emit('initMap', mapBlocks);

    activeDecoys = {};

    const seekerId = ids[Math.floor(Math.random() * ids.length)];
    ids.forEach(id => {
        players[id].role = (id === seekerId) ? 'seeker' : 'hider';
        players[id].baseColor = players[id].baseColor || 0xFFFFFF; 
        players[id].color = (id === seekerId) ? 0xFF0000 : players[id].baseColor;
        
        players[id].x = (Math.random() * 30) - 15;
        players[id].y = 20; 
        players[id].z = (Math.random() * 30) - 15;
        players[id].score = 0; 
        players[id].decoyUsed = false; 
        players[id].hairballs = 3; 
        players[id].stunned = false;
        players[id].emote = 0; 
    });
    
    io.emit('currentPlayers', players); 
    gameState = 'HIDING';
    timeRemaining = 20; 

    if (gameTimer) clearInterval(gameTimer);
    
    gameTimer = setInterval(() => {
        timeRemaining--;

        if (gameState === 'HIDING' && timeRemaining <= 0) {
            gameState = 'SEEKING';
            timeRemaining = 60; 
        } else if (gameState === 'SEEKING') {
            let hidersLeft = false;
            Object.values(players).forEach(p => {
                if (p.role === 'hider') {
                    p.score += 1; 
                    hidersLeft = true;
                }
            });

            if (!hidersLeft || timeRemaining <= 0) {
                gameState = 'GAME_OVER';
                timeRemaining = 5; 
                winReason = hidersLeft ? 'HIDERS SURVIVE!' : 'SEEKERS WIN!';
                
                let sortedIds = Object.keys(players).sort((a,b) => players[b].score - players[a].score);
                currentWinnerId = sortedIds.length > 0 ? sortedIds[0] : null;
            }
        } else if (gameState === 'GAME_OVER' && timeRemaining <= 0) {
            startRound(); 
        }

        const leaderboardData = Object.values(players)
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

io.on('connection', (socket) => {
    if (mapBlocks.length === 0) generateMap();
    socket.emit('initMap', mapBlocks);

    let joinRole = (gameState === 'WAITING' || Object.keys(players).length < 1) ? 'hider' : 'spectator';

    players[socket.id] = {
        id: socket.id,
        name: 'Cat-' + socket.id.substring(0, 4),
        score: 0,
        x: (Math.random() * 30) - 15, y: 20, z: (Math.random() * 30) - 15, 
        rY: 0, moving: false, role: joinRole, color: 0xFFFFFF, baseColor: 0xFFFFFF,
        decoyUsed: false, hairballs: 3, stunned: false, emote: 0
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    if (Object.keys(players).length >= 2 && gameState === 'WAITING') {
        startRound();
    }

    socket.on('joinGame', (data) => {
        if (players[socket.id]) {
            let cleanName = data.name.trim().substring(0, 12).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            if (cleanName.length > 0) {
                players[socket.id].name = cleanName;
            }
            players[socket.id].baseColor = data.color;
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
            io.emit('spawnDecoy', { id: decoyId, x: data.x, y: data.y, z: data.z, rY: data.rY, color: data.color });
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
        if (players[socket.id] && players[socket.id].role === 'hider' && gameState === 'SEEKING' && players[socket.id].hairballs > 0) {
            players[socket.id].hairballs--;
            const hbId = 'hb_' + (nextHairballId++);
            io.emit('spawnHairball', { id: hbId, ownerId: socket.id, x: data.x, y: data.y, z: data.z, dirX: data.dirX, dirZ: data.dirZ });
            socket.emit('inventoryUpdate', { decoys: players[socket.id].decoyUsed ? 0 : 1, hairballs: players[socket.id].hairballs });
        }
    });

    socket.on('hairballHit', (targetId) => {
        if (players[targetId] && players[targetId].role === 'seeker' && !players[targetId].stunned) {
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
        if (gameState === 'WAITING') {
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
        
        const activePlayers = Object.values(players).filter(p => p.role !== 'spectator').length;
        if (activePlayers < 2) {
            gameState = 'WAITING';
            if (gameTimer) clearInterval(gameTimer);
            io.emit('gameStateUpdate', { state: gameState, time: 0, leaderboard: [] });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running at: http://localhost:${PORT}`));