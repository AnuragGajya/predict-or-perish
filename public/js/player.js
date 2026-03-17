const socket = io({ transports: ["websocket", "polling"] });

let myName = "";
let hasJoined = false;
let currentPhase = "";
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
  // NEVER switch away from round screen while player is typing
  if (isTyping && name !== "round" && name !== "submitted") return;
  if (currentPhase === name) return; // avoid unnecessary re-renders
  currentPhase = name;
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

// ── Join ──────────────────────────────────────────────────────────────────────
document.getElementById("joinBtn").addEventListener("click", () => {
  const roomCode = document.getElementById("roomInput").value.trim().toUpperCase();
  const name = document.getElementById("nameInput").value.trim();
  if (!roomCode) { showError("Please enter a room code."); return; }
  if (!name) { showError("Please enter your name."); return; }
  myName = name;
  socket.emit("joinPlayer", { name, roomCode });
});

document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("joinBtn").click();
});
document.getElementById("roomInput").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
});

socket.on("joinError", (msg) => showError(msg));

function showError(msg) {
  document.getElementById("joinError").textContent = msg;
  setTimeout(() => document.getElementById("joinError").textContent = "", 3000);
}

// ── Number input — track typing to prevent glitch ─────────────────────────────
const numberInput = document.getElementById("numberInput");

numberInput.addEventListener("focus", () => {
  isTyping = true;
  clearTimeout(typingTimeout);
});

numberInput.addEventListener("blur", () => {
  typingTimeout = setTimeout(() => { isTyping = false; }, 3000);
});

numberInput.addEventListener("input", () => {
  isTyping = true;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => { isTyping = false; }, 5000);
});

// ── Submit Number ─────────────────────────────────────────────────────────────
document.getElementById("submitBtn").addEventListener("click", () => {
  const val = numberInput.value;
  const n = parseFloat(val);
  if (val === "" || isNaN(n) || n < 0 || n > 100) {
    numberInput.style.borderColor = "var(--red)";
    setTimeout(() => numberInput.style.borderColor = "", 1000);
    return;
  }
  isTyping = false;
  clearTimeout(typingTimeout);
  socket.emit("submitNumber", { number: n });
  document.getElementById("submittedName").textContent = myName.toUpperCase();
  document.getElementById("submittedNumber").textContent = n;
  currentPhase = ""; // allow screen switch
  showScreen("submitted");
});

numberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("submitBtn").click();
});

// ── Player State from server ──────────────────────────────────────────────────
socket.on("playerState", (state) => {
  if (!hasJoined && state.name) { hasJoined = true; myName = state.name; }

  if (state.status === "eliminated" && state.phase !== "gameover") {
    currentPhase = "";
    showScreen("eliminated"); return;
  }

  if (state.phase === "gameover") {
    document.getElementById("gameoverWinner").textContent = state.finalWinner || "—";
    currentPhase = "";
    showScreen("gameover"); return;
  }

  if (state.phase === "lobby") {
    document.getElementById("lobbyName").textContent = `PLAYER: ${state.name?.toUpperCase()}`;
    document.getElementById("lobbyRoom").textContent = `ROOM: ${state.roomCode}`;
    document.getElementById("lobbyRound").textContent = state.round > 0 ? `ROUND ${state.round} COMPLETE` : "";
    currentPhase = "";
    showScreen("lobby"); return;
  }

  if (state.phase === "round") {
    if (state.submitted) {
      currentPhase = "";
      showScreen("submitted");
    } else {
      // Only switch TO round screen if not already there
      if (currentPhase !== "round") {
        document.getElementById("roundName").textContent = `PLAYER: ${state.name?.toUpperCase()}`;
        document.getElementById("roundLabel").textContent = `ROUND ${state.round}`;
        numberInput.value = "";
        isTyping = false;
        showScreen("round");
      }
    }
    return;
  }

  if (state.phase === "calculating") {
    if (!isTyping) { currentPhase = ""; showScreen("submitted"); }
    return;
  }

  if (state.phase === "results" && state.lastResult) {
    currentPhase = "";
    renderResultScreen(state); return;
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
  if (name === r.winnerName) { personal.textContent = "🏆 YOU WIN THIS ROUND"; personal.className = "result-personal you-won"; }
  else if (name === r.eliminatedName) { personal.textContent = "✕ YOU ARE ELIMINATED"; personal.className = "result-personal you-lost"; }
  else { personal.textContent = "✓ YOU SURVIVED"; personal.className = "result-personal you-survived"; }
  showScreen("result");
}

socket.on("forceReload", () => { window.location.href = "/"; });
showScreen("join");
