const socket = io({ transports: ["websocket", "polling"] });
let currentRoomCode = null;
let latestState = null;

// ── Setup ─────────────────────────────────────────────────────────────────────
const setupScreen     = document.getElementById("screen-setup");
const dashboardScreen = document.getElementById("screen-dashboard");
const roomCodeInput   = document.getElementById("roomCodeInput");
const createRoomBtn   = document.getElementById("createRoomBtn");
const setupError      = document.getElementById("setupError");

createRoomBtn.addEventListener("click", () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) { setupError.textContent = "Please enter a room code."; return; }
  socket.emit("createRoom", { code });
});
roomCodeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createRoomBtn.click(); });
roomCodeInput.addEventListener("input",   (e) => { e.target.value = e.target.value.toUpperCase(); });
socket.on("roomError", (msg) => { setupError.textContent = msg; });

socket.on("roomCreated", ({ roomCode }) => {
  currentRoomCode = roomCode;
  document.getElementById("roomCodeBadge").textContent = `ROOM: ${roomCode}`;
  setupScreen.classList.remove("active");
  setupScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
});

// ── DOM ───────────────────────────────────────────────────────────────────────
const phaseBadge       = document.getElementById("phaseBadge");
const roundBadge       = document.getElementById("roundBadge");
const activeCount      = document.getElementById("activeCount");
const elimCount        = document.getElementById("elimCount");
const activePlayerList = document.getElementById("activePlayerList");
const elimPlayerList   = document.getElementById("elimPlayerList");
const subCount         = document.getElementById("subCount");
const submissionList   = document.getElementById("submissionList");
const resultPopup      = document.getElementById("resultPopup");
const winnerOverlay    = document.getElementById("winnerOverlay");

const btnStart      = document.getElementById("btnStartRound");
const btnShowResult = document.getElementById("btnShowResult");
const btnNext       = document.getElementById("btnNextRound");
const btnReset      = document.getElementById("btnReset");
const btnEndGame    = document.getElementById("btnEndGame");
const popupClose    = document.getElementById("popupClose");

btnStart.addEventListener("click",      () => socket.emit("startRound"));
btnShowResult.addEventListener("click", () => socket.emit("showResult"));
btnNext.addEventListener("click",       () => { closeResultPopup(); socket.emit("nextRound"); });
btnReset.addEventListener("click",      () => { if (confirm("Reset the entire game?")) socket.emit("resetGame"); });
btnEndGame.addEventListener("click",    () => { if (confirm("End game and send everyone to home?")) socket.emit("endGame"); });
popupClose.addEventListener("click",    () => closeResultPopup());

// ── Game State ────────────────────────────────────────────────────────────────
socket.on("gameState", (state) => {
  latestState = state;
  updateHeader(state);
  updatePlayers(state);
  updateSubmissions(state);
  updateControls(state);

  // Show result popup when phase becomes results
  if (state.phase === "results" && state.lastResult) {
    showResultPopup(state);
  }

  // Show winner overlay for final round
  if (state.phase === "gameover") {
    document.getElementById("winnerNameBig").textContent = state.finalWinner || "—";
    winnerOverlay.classList.remove("hidden");
    resultPopup.classList.add("hidden");
  }
});

socket.on("forceReload", () => window.location.reload());

// ── Result Popup ──────────────────────────────────────────────────────────────
function showResultPopup(state) {
  const r = state.lastResult;
  if (!r) return;

  document.getElementById("popupRound").textContent  = state.round;
  document.getElementById("popupAvg").textContent    = r.average;
  document.getElementById("popupTarget").textContent = r.target;
  document.getElementById("popupWinner").textContent = r.winnerName;
  document.getElementById("popupElim").textContent   = r.eliminatedName;

  const subs = [...r.submissions].sort((a, b) => a.distance - b.distance);
  document.getElementById("popupSubmissions").innerHTML = subs.map((s, i) => {
    const isWinner = s.name === r.winnerName;
    const isElim   = s.name === r.eliminatedName;
    return `<div class="popup-sub-row ${isWinner ? "popup-winner-row" : ""} ${isElim ? "popup-elim-row" : ""}">
      <span class="popup-rank">${i + 1}</span>
      <span class="popup-pname">${esc(s.name)}</span>
      <span class="popup-pnum">${s.number}</span>
      <span class="popup-pdist">Δ ${s.distance}</span>
    </div>`;
  }).join("");

  resultPopup.classList.remove("hidden");
}

function closeResultPopup() { resultPopup.classList.add("hidden"); }

// ── Header ────────────────────────────────────────────────────────────────────
function updateHeader(state) {
  roundBadge.textContent = `ROUND ${state.round}`;
  const phases = { lobby: "LOBBY", round: "ROUND OPEN", calculating: "CALCULATING", results: "RESULTS", gameover: "GAME OVER" };
  phaseBadge.textContent = phases[state.phase] || state.phase.toUpperCase();
  phaseBadge.className = "phase-badge";
  if (state.phase === "round") phaseBadge.classList.add("phase-round");
  if (state.phase === "results") phaseBadge.classList.add("phase-results");
}

// ── Players ───────────────────────────────────────────────────────────────────
function updatePlayers(state) {
  const active = Object.entries(state.players).filter(([, p]) => p.status === "active");
  const elims  = state.eliminated || [];
  activeCount.textContent = active.length;
  elimCount.textContent   = elims.length;

  activePlayerList.innerHTML = active.length === 0
    ? `<div class="empty-state">Waiting for players...<br><span style="color:var(--green);font-size:0.8rem">Room: ${currentRoomCode}</span></div>`
    : active.map(([, p]) => `
        <div class="player-item ${p.submitted ? "submitted" : ""}">
          <span class="p-name">${esc(p.name)}</span>
          <span class="p-dot ${p.submitted ? "dot-green" : "dot-red"}"></span>
        </div>`).join("");

  elimPlayerList.innerHTML = elims.length === 0
    ? `<div class="empty-state">None yet</div>`
    : elims.slice().reverse().map((e) =>
        `<div class="player-item eliminated-item">
          <span class="p-name">${esc(e.name)}</span>
          <span class="elim-round">R${e.round}</span>
        </div>`).join("");
}

// ── Submissions ───────────────────────────────────────────────────────────────
function updateSubmissions(state) {
  const active    = Object.values(state.players).filter((p) => p.status === "active");
  const submitted = active.filter((p) => p.submitted);
  subCount.textContent = `${submitted.length} / ${active.length}`;

  if (state.phase === "lobby" && !state.lastResult) {
    submissionList.innerHTML = `<div class="empty-state">Start a round to collect numbers</div>`;
    return;
  }

  if (state.phase === "round") {
    if (active.length === 0) { submissionList.innerHTML = `<div class="empty-state">Waiting for players...</div>`; return; }
    if (state.allSubmitted) {
      submissionList.innerHTML = `<div class="empty-state" style="color:var(--green)">✓ All players submitted!<br><span style="font-size:0.7rem;color:var(--text-dim)">Click SHOW RESULT</span></div>`;
      return;
    }
    submissionList.innerHTML = `
      <div class="status-grid">
        ${active.map((p) => `
          <div class="status-box ${p.submitted ? "status-green" : "status-red"}">
            <span class="status-name">${esc(p.name)}</span>
            <span class="status-icon">${p.submitted ? "✓" : "…"}</span>
          </div>`).join("")}
      </div>
      <div class="waiting-label">Waiting for all players to submit...</div>`;
    return;
  }

  if ((state.phase === "results" || state.phase === "gameover") && state.lastResult) {
    const subs = [...state.lastResult.submissions].sort((a, b) => a.distance - b.distance);
    submissionList.innerHTML = subs.map((s) => {
      const isWinner = s.name === state.lastResult.winnerName;
      const isElim   = s.name === state.lastResult.eliminatedName;
      return `<div class="sub-item ${isWinner ? "winner-sub" : ""} ${isElim ? "loser-sub" : ""}">
        <span class="sub-name">${esc(s.name)}</span>
        <span style="display:flex;gap:0.5rem;align-items:center">
          <span class="sub-dist">Δ${s.distance}</span>
          <span class="sub-num">${s.number}</span>
        </span>
      </div>`;
    }).join("");
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
function updateControls(state) {
  const p = state.phase;
  const active = Object.values(state.players).filter((pl) => pl.status === "active");
  const anySubmitted = active.some((pl) => pl.submitted);
  btnStart.disabled      = !(p === "lobby" || p === "results");
  btnShowResult.disabled = !(p === "round" && anySubmitted);
  btnNext.disabled       = !(p === "results");
}

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
