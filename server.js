const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// ─── Game State ───────────────────────────────────────────────────────────────
let gameState = {
  phase: "lobby",       // lobby | round | calculating | results | gameover
  round: 0,
  players: {},          // socketId → { name, number, distance, status }
  eliminated: [],       // array of { name, round }
  lastResult: null,     // { average, target, winner, eliminated, submissions }
  finalWinner: null,
};

function activePlayers() {
  return Object.values(gameState.players).filter((p) => p.status === "active");
}

function resetNumbers() {
  Object.keys(gameState.players).forEach((id) => {
    gameState.players[id].number = null;
    gameState.players[id].distance = null;
    gameState.players[id].submitted = false;
  });
}

function broadcastState() {
  // Send full state to host
  io.to("host").emit("gameState", gameState);

  // Send limited state to each player
  Object.entries(gameState.players).forEach(([id, p]) => {
    const socket = io.sockets.sockets.get(id);
    if (socket) {
      socket.emit("playerState", {
        phase: gameState.phase,
        round: gameState.round,
        name: p.name,
        status: p.status,
        submitted: p.submitted,
        lastResult: gameState.lastResult,
        finalWinner: gameState.finalWinner,
      });
    }
  });
}

// ─── Socket Events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Host joins
  socket.on("joinHost", () => {
    socket.join("host");
    socket.emit("gameState", gameState);
    console.log("Host connected");
  });

  // Player joins
  socket.on("joinPlayer", ({ name }) => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;

    // Check duplicate names
    const nameTaken = Object.values(gameState.players).some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.status === "active"
    );
    if (nameTaken) {
      socket.emit("joinError", "Name already taken. Choose another.");
      return;
    }

    gameState.players[socket.id] = {
      name: trimmed,
      number: null,
      distance: null,
      submitted: false,
      status: "active",
    };

    console.log(`Player joined: ${trimmed}`);
    broadcastState();
  });

  // Player submits number
  socket.on("submitNumber", ({ number }) => {
    const player = gameState.players[socket.id];
    if (!player || player.status !== "active") return;
    if (gameState.phase !== "round") return;
    if (player.submitted) return;

    const n = parseFloat(number);
    if (isNaN(n) || n < 0 || n > 100) return;

    player.number = n;
    player.submitted = true;

    console.log(`${player.name} submitted: ${n}`);
    broadcastState();

    // Auto-calculate if all active players submitted
    const active = activePlayers();
    const allSubmitted = active.every((p) => p.submitted);
    if (allSubmitted && active.length > 1) {
      setTimeout(() => calculateResult(), 500);
    }
  });

  // Host: Start Round
  socket.on("startRound", () => {
    if (gameState.phase !== "lobby" && gameState.phase !== "results") return;
    gameState.round += 1;
    gameState.phase = "round";
    gameState.lastResult = null;
    resetNumbers();
    console.log(`Round ${gameState.round} started`);
    broadcastState();
  });

  // Host: Calculate Result
  socket.on("calculateResult", () => {
    if (gameState.phase !== "round") return;
    calculateResult();
  });

  // Host: Next Round
  socket.on("nextRound", () => {
    if (gameState.phase !== "results") return;
    // Eliminate the loser
    if (gameState.lastResult && gameState.lastResult.eliminatedId) {
      const p = gameState.players[gameState.lastResult.eliminatedId];
      if (p) {
        p.status = "eliminated";
        gameState.eliminated.push({ name: p.name, round: gameState.round });
      }
    }
    gameState.phase = "lobby";
    resetNumbers();
    broadcastState();
  });

  // Host: End Game
  socket.on("endGame", () => {
    const remaining = activePlayers();
    gameState.finalWinner = remaining.length > 0 ? remaining[0].name : "No Winner";

    // If there's a pending elimination, apply it first
    if (gameState.lastResult && gameState.lastResult.eliminatedId && gameState.phase === "results") {
      const p = gameState.players[gameState.lastResult.eliminatedId];
      if (p && p.status === "active") {
        p.status = "eliminated";
        gameState.eliminated.push({ name: p.name, round: gameState.round });
      }
      // recalculate winner from remaining
      const nowActive = activePlayers();
      gameState.finalWinner = nowActive.length > 0 ? nowActive[0].name : (remaining.length > 0 ? remaining[0].name : "No Winner");
    }

    gameState.phase = "gameover";
    console.log(`Game over! Winner: ${gameState.finalWinner}`);
    broadcastState();
  });

  // Host: Reset Game
  socket.on("resetGame", () => {
    gameState = {
      phase: "lobby",
      round: 0,
      players: {},
      eliminated: [],
      lastResult: null,
      finalWinner: null,
    };
    console.log("Game reset");
    io.emit("forceReload");
    broadcastState();
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (gameState.players[socket.id]) {
      console.log(`Player disconnected: ${gameState.players[socket.id].name}`);
      delete gameState.players[socket.id];
      broadcastState();
    }
  });
});

// ─── Calculate Result Logic ───────────────────────────────────────────────────
function calculateResult() {
  gameState.phase = "calculating";

  const active = activePlayers();
  const submitted = active.filter((p) => p.submitted && p.number !== null);

  if (submitted.length === 0) {
    gameState.phase = "round";
    broadcastState();
    return;
  }

  const avg = submitted.reduce((sum, p) => sum + p.number, 0) / submitted.length;
  const target = avg * 0.8;

  // Calculate distances
  submitted.forEach((p) => {
    p.distance = Math.abs(p.number - target);
  });

  submitted.sort((a, b) => a.distance - b.distance);

  const winner = submitted[0];
  const loser = submitted[submitted.length - 1];

  // Find socket IDs
  const winnerId = Object.entries(gameState.players).find(([, v]) => v.name === winner.name)?.[0];
  const eliminatedId = Object.entries(gameState.players).find(([, v]) => v.name === loser.name)?.[0];

  gameState.lastResult = {
    average: Math.round(avg * 100) / 100,
    target: Math.round(target * 100) / 100,
    winnerId,
    winnerName: winner.name,
    eliminatedId,
    eliminatedName: loser.name,
    submissions: submitted.map((p) => ({
      name: p.name,
      number: p.number,
      distance: Math.round(p.distance * 100) / 100,
    })),
  };

  gameState.phase = "results";
  console.log(`Result: Winner=${winner.name}, Eliminated=${loser.name}`);
  broadcastState();
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Predict or Perish running on http://localhost:${PORT}`);
});
