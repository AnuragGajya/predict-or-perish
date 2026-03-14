const socket = io();

// ── State ─────────────────────────────────────────────────────────────────────
let myName = "";
let hasJoined = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screens = {
  join:       document.getElementById("screen-join"),
  lobby:      document.getElementById("screen-lobby"),
  round:      document.getElementById("screen-round"),
  submitted:  document.getElementById("screen-submitted"),
  result:     document.getElementById("screen-result"),
  eliminated: document.getElementById("screen-eliminated"),
  gameover:   document.getElementById("screen-gameover"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle("active", k === name);
  });
}

// ── Join ──────────────────────────────────────────────────────────────────────
document.getElementById("joinBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) { showError("Please enter your name."); return; }
  myName = name;
  socket.emit("joinPlayer", { name });
});

document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("joinBtn").click();
});

socket.on("joinError", (msg) => showError(msg));

function showError(msg) {
  document.getElementById("joinError").textContent = msg;
  setTimeout(() => document.getElementById("joinError").textContent = "", 3000);
}

// ── Submit Number ─────────────────────────────────────────────────────────────
document.getElementById("submitBtn").addEventListener("click", () => {
  const val = document.getElementById("numberInput").value;
  const n = parseFloat(val);
  if (val === "" || isNaN(n) || n < 0 || n > 100) {
    document.getElementById("numberInput").style.borderColor = "var(--red)";
    setTimeout(() => document.getElementById("numberInput").style.borderColor = "", 1000);
    return;
  }
  socket.emit("submitNumber", { number: n });
  document.getElementById("submittedName").textContent = myName.toUpperCase();
  document.getElementById("submittedNumber").textContent = n;
  showScreen("submitted");
});

document.getElementById("numberInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("submitBtn").click();
});

// ── Player State from server ──────────────────────────────────────────────────
socket.on("playerState", (state) => {
  if (!hasJoined && state.name) {
    hasJoined = true;
    myName = state.name;
  }

  if (state.status === "eliminated" && state.phase !== "gameover") {
    showScreen("eliminated");
    return;
  }

  if (state.phase === "gameover") {
    document.getElementById("gameoverWinner").textContent = state.finalWinner || "—";
    showScreen("gameover");
    return;
  }

  if (state.phase === "lobby") {
    document.getElementById("lobbyName").textContent = `PLAYER: ${state.name?.toUpperCase()}`;
    document.getElementById("lobbyRound").textContent = state.round > 0 ? `ROUND ${state.round} COMPLETE` : "";
    showScreen("lobby");
    return;
  }

  if (state.phase === "round") {
    if (state.submitted) {
      showScreen("submitted");
    } else {
      document.getElementById("roundName").textContent = `PLAYER: ${state.name?.toUpperCase()}`;
      document.getElementById("roundLabel").textContent = `ROUND ${state.round}`;
      document.getElementById("numberInput").value = "";
      showScreen("round");
    }
    return;
  }

  if (state.phase === "calculating") {
    showScreen("submitted");
    return;
  }

  if (state.phase === "results" && state.lastResult) {
    renderResultScreen(state);
    return;
  }
});

function renderResultScreen(state) {
  const r = state.lastResult;
  const name = state.name;

  document.getElementById("resultRound").textContent = `ROUND ${state.round} RESULTS`;
  document.getElementById("resultAvg").textContent = r.average;
  document.getElementById("resultTarget").textContent = r.target;
  document.getElementById("resultWinner").textContent = r.winnerName;
  document.getElementById("resultElim").textContent = r.eliminatedName;

  const personal = document.getElementById("resultPersonal");
  if (name === r.winnerName) {
    personal.textContent = "🏆 YOU WIN THIS ROUND";
    personal.className = "result-personal you-won";
  } else if (name === r.eliminatedName) {
    personal.textContent = "✕ YOU ARE ELIMINATED";
    personal.className = "result-personal you-lost";
  } else {
    personal.textContent = "✓ YOU SURVIVED";
    personal.className = "result-personal you-survived";
  }

  showScreen("result");
}

// ── Force reload on reset ─────────────────────────────────────────────────────
socket.on("forceReload", () => {
  window.location.href = "/";
});

// ── Initial screen ────────────────────────────────────────────────────────────
showScreen("join");
