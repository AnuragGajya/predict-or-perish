const socket = io({ transports: ["websocket", "polling"] });

let myName = "";
let hasJoined = false;
let currentScreen = "";
let isTyping = false;
let typingTimeout = null;

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
  if (isTyping && name !== "round" && name !== "submitted") return;
  if (currentScreen === name) return;
  currentScreen = name;
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

// ── Join ──────────────────────────────────────────────────────────────────────
document.getElementById("joinBtn").addEventListener("click", () => {
  const roomCode = document.getElementById("roomInput").value.trim().toUpperCase();
  const name     = document.getElementById("nameInput").value.trim();
  if (!roomCode) { showError("Please enter a room code."); return; }
  if (!name)     { showError("Please enter your name."); return; }
  myName = name;
  socket.emit("joinPlayer", { name, roomCode });
});
document.getElementById("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("joinBtn").click(); });
document.getElementById("roomInput").addEventListener("input",   (e) => { e.target.value = e.target.value.toUpperCase(); });
socket.on("joinError", (msg) => showError(msg));

function showError(msg) {
  document.getElementById("joinError").textContent = msg;
  setTimeout(() => document.getElementById("joinError").textContent = "", 3000);
}

// ── Typing protection ─────────────────────────────────────────────────────────
const numberInput = document.getElementById("numberInput");
numberInput.addEventListener("focus", () => { isTyping = true; clearTimeout(typingTimeout); });
numberInput.addEventListener("blur",  () => { typingTimeout = setTimeout(() => { isTyping = false; }, 3000); });
numberInput.addEventListener("input", () => { isTyping = true; clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { isTyping = false; }, 5000); });

// ── Submit ────────────────────────────────────────────────────────────────────
document.getElementById("submitBtn").addEventListener("click", () => {
  const val = numberInput.value;
  const n   = parseFloat(val);
  if (val === "" || isNaN(n) || n < 0 || n > 100) {
    numberInput.style.borderColor = "var(--red)";
    setTimeout(() => numberInput.style.borderColor = "", 1000);
    return;
  }
  isTyping = false;
  clearTimeout(typingTimeout);
  socket.emit("submitNumber", { number: n });
  document.getElementById("submittedName").textContent   = myName.toUpperCase();
  document.getElementById("submittedNumber").textContent = n;
  currentScreen = "";
  showScreen("submitted");
});
numberInput.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("submitBtn").click(); });

// ── Player State ──────────────────────────────────────────────────────────────
socket.on("playerState", (state) => {
  if (!hasJoined && state.name) { hasJoined = true; myName = state.name; }

  // Eliminated
  if (state.status === "eliminated" && state.phase !== "gameover") {
    currentScreen = ""; showScreen("eliminated"); return;
  }

  // Game over — final winner screen
  if (state.phase === "gameover") {
    document.getElementById("gameoverWinner").textContent = state.finalWinner || "—";
    currentScreen = ""; showScreen("gameover"); return;
  }

  // Lobby
  if (state.phase === "lobby") {
    document.getElementById("lobbyName").textContent  = `PLAYER: ${state.name?.toUpperCase()}`;
    document.getElementById("lobbyRoom").textContent  = `ROOM: ${state.roomCode}`;
    document.getElementById("lobbyRound").textContent = state.round > 0 ? `ROUND ${state.round} COMPLETE` : "";
    currentScreen = ""; showScreen("lobby"); return;
  }

  // Round — player submitting
  if (state.phase === "round") {
    if (state.submitted) {
      // Already submitted — show waiting screen
      if (currentScreen !== "submitted") { currentScreen = ""; showScreen("submitted"); }
    } else {
      // Not submitted yet — show round screen (only if not already there)
      if (currentScreen !== "round") {
        document.getElementById("roundName").textContent  = `PLAYER: ${state.name?.toUpperCase()}`;
        document.getElementById("roundLabel").textContent = `ROUND ${state.round}`;
        numberInput.value = "";
        isTyping = false;
        showScreen("round");
      }
    }
    return;
  }

  // Results — only show if host has revealed (lastResult will be non-null)
  if (state.phase === "results") {
    if (state.lastResult) {
      currentScreen = ""; renderResultScreen(state);
    } else {
      // Host hasn't revealed yet — keep showing submitted screen
      if (currentScreen !== "submitted") { currentScreen = ""; showScreen("submitted"); }
    }
    return;
  }
});

function renderResultScreen(state) {
  const r    = state.lastResult;
  const name = state.name;
  document.getElementById("resultRound").textContent  = `ROUND ${state.round} RESULTS`;
  document.getElementById("resultAvg").textContent    = r.average;
  document.getElementById("resultTarget").textContent = r.target;
  document.getElementById("resultWinner").textContent = r.winnerName;
  document.getElementById("resultElim").textContent   = r.eliminatedName;

  const personal = document.getElementById("resultPersonal");
  if (name === r.winnerName)      { personal.textContent = "🏆 YOU WIN THIS ROUND"; personal.className = "result-personal you-won"; }
  else if (name === r.eliminatedName) { personal.textContent = "✕ YOU ARE ELIMINATED"; personal.className = "result-personal you-lost"; }
  else                            { personal.textContent = "✓ YOU SURVIVED";        personal.className = "result-personal you-survived"; }
  showScreen("result");
}

socket.on("forceReload", () => { window.location.href = "/"; });
showScreen("join");
