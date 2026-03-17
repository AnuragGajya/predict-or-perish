const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function createRoomState() {
  return { phase: "lobby", round: 0, players: {}, eliminated: [], lastResult: null, finalWinner: null, resultsRevealed: false };
}

function getRoom(code) { return rooms[code?.toUpperCase()]; }

function activePlayers(state) {
  return Object.values(state.players).filter((p) => p.status === "active");
}

function resetNumbers(state) {
  Object.keys(state.players).forEach((id) => {
    state.players[id].number = null;
    state.players[id].distance = null;
    state.players[id].submitted = false;
  });
  state.resultsRevealed = false;
}

function getHostState(state) {
  const active = activePlayers(state);
  const allSubmitted = active.length > 0 && active.every((p) => p.submitted);
  const sanitizedPlayers = {};
  Object.entries(state.players).forEach(([id, p]) => {
    sanitizedPlayers[id] = {
      ...p,
      number: (state.phase === "round" && !allSubmitted) ? null : p.number,
    };
  });
  return { ...state, players: sanitizedPlayers, allSubmitted };
}

function broadcastState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const state = room.state;

  io.to(`host:${roomCode}`).emit("gameState", getHostState(state));

  Object.entries(state.players).forEach(([id, p]) => {
    const socket = io.sockets.sockets.get(id);
    if (socket) {
      socket.emit("playerState", {
        phase: state.phase,
        round: state.round,
        name: p.name,
        status: p.status,
        submitted: p.submitted,
        // Only send result to players if host has revealed it
        lastResult: state.resultsRevealed ? state.lastResult : null,
        finalWinner: state.finalWinner,
        roomCode,
      });
    }
  });
}

io.on("connection", (socket) => {

  socket.on("createRoom", ({ code }) => {
    const roomCode = code.trim().toUpperCase().slice(0, 10);
    if (!roomCode) { socket.emit("roomError", "Invalid room code."); return; }
    if (rooms[roomCode]) { socket.emit("roomError", "Room code already in use. Choose another."); return; }
    rooms[roomCode] = { state: createRoomState(), hostSocketId: socket.id };
    socket.join(`host:${roomCode}`);
    socket.data.roomCode = roomCode;
    socket.data.role = "host";
    socket.emit("roomCreated", { roomCode });
    socket.emit("gameState", getHostState(rooms[roomCode].state));
  });

  socket.on("rejoinHost", ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) { socket.emit("roomError", "Room not found."); return; }
    room.hostSocketId = socket.id;
    socket.join(`host:${roomCode}`);
    socket.data.roomCode = roomCode;
    socket.data.role = "host";
    socket.emit("roomCreated", { roomCode });
    socket.emit("gameState", getHostState(room.state));
  });

  socket.on("joinPlayer", ({ name, roomCode }) => {
    const code = roomCode.trim().toUpperCase();
    const room = getRoom(code);
    if (!room) { socket.emit("joinError", "Room not found. Check the code."); return; }
    if (room.state.phase !== "lobby") { socket.emit("joinError", "Game already in progress."); return; }
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) { socket.emit("joinError", "Please enter your name."); return; }
    const nameTaken = Object.values(room.state.players).some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.status === "active"
    );
    if (nameTaken) { socket.emit("joinError", "Name already taken. Choose another."); return; }
    room.state.players[socket.id] = { name: trimmed, number: null, distance: null, submitted: false, status: "active" };
    socket.data.roomCode = code;
    socket.data.role = "player";
    broadcastState(code);
  });

  socket.on("submitNumber", ({ number }) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;
    const player = room.state.players[socket.id];
    if (!player || player.status !== "active" || room.state.phase !== "round" || player.submitted) return;
    const n = parseFloat(number);
    if (isNaN(n) || n < 0 || n > 100) return;
    player.number = n;
    player.submitted = true;

    // Confirm to this player immediately
    socket.emit("playerState", {
      phase: room.state.phase, round: room.state.round,
      name: player.name, status: player.status,
      submitted: true, lastResult: null,
      finalWinner: room.state.finalWinner, roomCode: socket.data.roomCode,
    });

    broadcastState(socket.data.roomCode);
  });

  socket.on("startRound", () => {
    const room = getRoom(socket.data.roomCode);
    if (!room || (room.state.phase !== "lobby" && room.state.phase !== "results")) return;
    room.state.round += 1;
    room.state.phase = "round";
    room.state.lastResult = null;
    resetNumbers(room.state);
    broadcastState(socket.data.roomCode);
  });

  // Host clicks "Show Result" — calculates AND reveals to players
  socket.on("showResult", () => {
    const roomCode = socket.data.roomCode;
    const room = getRoom(roomCode);
    if (!room || room.state.phase !== "round") return;

    // Calculate
    const state = room.state;
    const submitted = activePlayers(state).filter((p) => p.submitted && p.number !== null);
    if (submitted.length === 0) return;

    const avg = submitted.reduce((sum, p) => sum + p.number, 0) / submitted.length;
    const target = avg * 0.8;
    submitted.forEach((p) => { p.distance = Math.abs(p.number - target); });
    submitted.sort((a, b) => a.distance - b.distance);

    const winner = submitted[0];
    const loser  = submitted[submitted.length - 1];
    const winnerId    = Object.entries(state.players).find(([, v]) => v.name === winner.name)?.[0];
    const eliminatedId = Object.entries(state.players).find(([, v]) => v.name === loser.name)?.[0];

    state.lastResult = {
      average: Math.round(avg * 100) / 100,
      target: Math.round(target * 100) / 100,
      winnerId, winnerName: winner.name,
      eliminatedId, eliminatedName: loser.name,
      submissions: submitted.map((p) => ({
        name: p.name, number: p.number,
        distance: Math.round(p.distance * 100) / 100,
      })),
    };

    // Check if this was the final round (only 2 active players)
    const activeCount = activePlayers(state).length;
    const isFinalRound = activeCount <= 2;

    if (isFinalRound) {
      // Apply elimination
      const loserPlayer = state.players[eliminatedId];
      if (loserPlayer) {
        loserPlayer.status = "eliminated";
        state.eliminated.push({ name: loserPlayer.name, round: state.round });
      }
      // Set final winner
      const remaining = activePlayers(state);
      state.finalWinner = remaining.length > 0 ? remaining[0].name : winner.name;
      state.phase = "gameover";
      state.resultsRevealed = true;
    } else {
      state.phase = "results";
      state.resultsRevealed = true;
    }

    broadcastState(roomCode);
  });

  socket.on("nextRound", () => {
    const room = getRoom(socket.data.roomCode);
    if (!room || room.state.phase !== "results") return;
    if (room.state.lastResult?.eliminatedId) {
      const p = room.state.players[room.state.lastResult.eliminatedId];
      if (p) { p.status = "eliminated"; room.state.eliminated.push({ name: p.name, round: room.state.round }); }
    }
    room.state.phase = "lobby";
    resetNumbers(room.state);
    broadcastState(socket.data.roomCode);
  });

  // End game — send everyone to home page
  socket.on("endGame", () => {
    const roomCode = socket.data.roomCode;
    const room = getRoom(roomCode);
    if (!room) return;
    // Send all players to home
    Object.keys(room.state.players).forEach((id) => {
      io.sockets.sockets.get(id)?.emit("forceReload");
    });
    delete rooms[roomCode];
    console.log(`Room ${roomCode} ended and closed`);
  });

  socket.on("resetGame", () => {
    const roomCode = socket.data.roomCode;
    const room = getRoom(roomCode);
    if (!room) return;
    Object.keys(room.state.players).forEach((id) => {
      io.sockets.sockets.get(id)?.emit("forceReload");
    });
    room.state = createRoomState();
    broadcastState(roomCode);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    const room = getRoom(roomCode);
    if (room?.state.players[socket.id]) {
      delete room.state.players[socket.id];
      broadcastState(roomCode);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Predict or Perish running on http://localhost:${PORT}`));
