const socket = io({
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

let myName = "";
let myRoomCode = "";
let hasJoined = false;
let currentScreen = "";
let isTyping = false;
let typingTimeout = null;

const screens = {
  join:        document.getElementById("screen-join"),
  lobby:       document.getElementById("screen-lobby"),
  round:       document.getElementById("screen-round"),
  submitted:   document.getElementById("screen-submitted"),
  result:      document.getElementById("screen-result"),
  eliminated:  document.getElementById("screen-eliminated"),
  gameover:    document.getElementById("screen-gameover"),
  rejoinwait:  document.getElementById("screen-rejoinwait"),
};

function showScreen(name) {
  if (isTyping && name !== "round" && name !== "submitted") return;
  if (currentScreen === name) return;
  currentScreen = name;
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
}

// ── Connection Status Banner ───────────────────────────────────────────────────
const banner = document.createElement("div");
banner.id = "conn-banner";
banner.style.cssText = `
  display:none; position:fixed; top:0; left:0; right:0; z-index:9999;
  background:#c0392b; color:#fff; text-align:center;
  padding:10px; font-family:monospace; font-size:0.85rem; letter-spacing:0.05em;
`;
banner.textContent = "⚠ CONNECTION LOST — RECONNECTING...";
document.body.prepend(banner);

socket.on("disconnect", () => {
  banner.style.display = "block";
});

socket.on("connect", () => {
  banner.style.display = "none";
  // If we were already in a game, send a rejoin request to the host
  if (hasJoined && myName && myRoomCode) {
    socket.emit("requestRejoin", { name: myName, roomCode: myRoomCode });
  }
});

// ── Rejoin flow ───────────────────────────────────────────────────────────────
socket.on("rejoinPending", () => {
  // Show waiting screen while host decides
  document.getElementById("rejoinPlayerName").textContent = myName.toUpperCase();
  currentScreen = "";
  showScreen("rejoinwait");
});

socket.on("rejoinAdmitted", () => {
  // Host admitted — playerState will arrive and move us to the right screen
  hasJoined = true;
  banner.style.display = "none";
});

socket.on("rejoinDenied", (msg) => {
  // Host denied or room gone — go back to join screen with message
  hasJoined = false;
  myName = "";
  myRoomCode = "";
  currentScreen = "";
  showScreen("join");
  const errEl = document.getElementById("joinError");
  errEl.textContent = msg || "Rejoin was denied by the host.";
  setTimeout(() => errEl.textContent = "", 4000);
});

// ── Join ──────────────────────────────────────────────────────────────────────
document.getElementById("joinBtn").addEventListener("click", () => {
  const roomCode = document.getElementById("roomInput").value.trim().toUpperCase();
  const name     = document.getElementById("nameInput").value.trim();
  if (!roomCode) { showError("Please enter a room code."); return; }
  if (!name)     { showError("Please enter your name."); return; }
  myName = name;
  myRoomCode = roomCode;
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
  if (!hasJoined && state.name) {
    hasJoined = true;
    myName = state.name;
    myRoomCode = state.roomCode;
  }

  if (state.status === "eliminated" && state.phase !== "gameover") {
    currentScreen = ""; showScreen("eliminated"); return;
  }

  if (state.phase === "gameover") {
    document.getElementById("gameoverWinner").textContent = state.finalWinner || "—";
    // Show final round numbers on gameover screen
    if (state.lastResult) {
      const r = state.lastResult;
      const goAvg    = document.getElementById("goAvg");
      const goTarget = document.getElementById("goTarget");
      const goSubs   = document.getElementById("goSubmissions");
      if (goAvg) goAvg.textContent = r.average;
      if (goTarget) goTarget.textContent = r.target;
      if (goSubs) {
        const subs = [...r.submissions].sort((a, b) => a.distance - b.distance);
        goSubs.innerHTML = subs.map(s => {
          const isWinner = s.name === r.winnerName;
          return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.08);${isWinner ? "color:#f1c40f;font-weight:bold" : ""}">
            <span>${s.name}</span>
            <span style="opacity:0.6">Δ${s.distance}</span>
            <span>${s.number}</span>
          </div>`;
        }).join("");
      }
    }
    currentScreen = ""; showScreen("gameover"); return;
  }

  if (state.phase === "lobby") {
    document.getElementById("lobbyName").textContent  = `PLAYER: ${state.name?.toUpperCase()}`;
    document.getElementById("lobbyRoom").textContent  = `ROOM: ${state.roomCode}`;
    document.getElementById("lobbyRound").textContent = state.round > 0 ? `ROUND ${state.round} COMPLETE` : "";
    currentScreen = ""; showScreen("lobby"); return;
  }

  if (state.phase === "round") {
    if (state.submitted) {
      if (currentScreen !== "submitted") { currentScreen = ""; showScreen("submitted"); }
    } else {
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

  if (state.phase === "results") {
    if (state.lastResult) {
      currentScreen = ""; renderResultScreen(state);
    } else {
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
  if (name === r.winnerName)          { personal.textContent = "🏆 YOU WIN THIS ROUND"; personal.className = "result-personal you-won"; }
  else if (name === r.eliminatedName) { personal.textContent = "✕ YOU ARE ELIMINATED";  personal.className = "result-personal you-lost"; }
  else                                { personal.textContent = "✓ YOU SURVIVED";         personal.className = "result-personal you-survived"; }
  showScreen("result");
}

socket.on("forceReload", () => { window.location.href = "/"; });
showScreen("join");
