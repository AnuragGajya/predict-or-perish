const socket = io();
let currentRoomCode = null;

// ── Setup Screen ──────────────────────────────────────────────────────────────
const setupScreen   = document.getElementById("screen-setup");
const dashboardScreen = document.getElementById("screen-dashboard");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const setupError    = document.getElementById("setupError");

createRoomBtn.addEventListener("click", () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) { setupError.textContent = "Please enter a room code."; return; }
  socket.emit("createRoom", { code });
});

roomCodeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createRoomBtn.click(); });
roomCodeInput.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

socket.on("roomError", (msg) => { setupError.textContent = msg; });

socket.on("roomCreated", ({ roomCode }) => {
  currentRoomCode = roomCode;
  document.getElementById("roomCodeBadge").textContent = `ROOM: ${roomCode}`;
  setupScreen.classList.remove("active");
  setupScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const phaseBadge       = document.getElementById("phaseBadge");
const roundBadge       = document.getElementById("roundBadge");
const activeCount      = document.getElementById("activeCount");
const elimCount        = document.getElementById("elimCount");
const activePlayerList = document.getElementById("activePlayerList");
const elimPlayerList   = document.getElementById("elimPlayerList");
const subCount         = document.getElementById("subCount");
const submissionList   = document.getElementById("submissionList");
const resultContent    = document.getElementById("resultContent");
const gameoverOverlay  = document.getElementById("gameoverOverlay");
const goWinnerName     = document.getElementById("goWinnerName");

const btnStart   = document.getElementById("btnStartRound");
const btnCalc    = document.getElementById("btnCalculate");
const btnNext    = document.getElementById("btnNextRound");
const btnEnd     = document.getElementById("btnEndGame");
const btnReset   = document.getElementById("btnReset");
const btnGoReset = document.getElementById("goReset");

btnStart.addEventListener("click",   () => socket.emit("startRound"));
btnCalc.addEventListener("click",    () => socket.emit("calculateResult"));
btnNext.addEventListener("click",    () => socket.emit("nextRound"));
btnEnd.addEventListener("click",     () => { if (confirm("End the game and reveal the final winner?")) socket.emit("endGame"); });
btnReset.addEventListener("click",   () => { if (confirm("Reset the entire game? All data will be lost.")) socket.emit("resetGame"); });
btnGoReset.addEventListener("click", () => { if (confirm("Reset the entire game?")) socket.emit("resetGame"); });

socket.on("gameState", (state) => {
  updateHeader(state);
  updatePlayers(state);
  updateSubmissions(state);
  updateResult(state);
  updateControls(state);
  updateGameover(state);
});

socket.on("forceReload", () => window.location.reload());

function updateHeader(state) {
  roundBadge.textContent = `ROUND ${state.round}`;
  const phases = { lobby: "LOBBY", round: "ROUND OPEN", calculating: "CALCULATING", results: "RESULTS", gameover: "GAME OVER" };
  phaseBadge.textContent = phases[state.phase] || state.phase.toUpperCase();
  phaseBadge.className = "phase-badge";
  if (state.phase === "round") phaseBadge.classList.add("phase-round");
  if (state.phase === "results" || state.phase === "calculating") phaseBadge.classList.add("phase-results");
}

function updatePlayers(state) {
  const active = Object.entries(state.players).filter(([, p]) => p.status === "active");
  const elims  = state.eliminated || [];
  activeCount.textContent = active.length;
  elimCount.textContent   = elims.length;
  activePlayerList.innerHTML = active.length === 0
    ? `<div class="empty-state">Waiting for players to join...<br><span style="color:var(--green);font-size:0.8rem">Room: ${currentRoomCode}</span></div>`
    : active.map(([, p]) => `<div class="player-item ${p.submitted ? "submitted" : ""}">
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-status">${p.submitted ? "SUBMITTED ✓" : "WAITING..."}</span>
      </div>`).join("");
  elimPlayerList.innerHTML = elims.length === 0
    ? `<div class="empty-state">None yet</div>`
    : elims.slice().reverse().map((e) => `<div class="player-item eliminated-item">
        <span class="p-name">${esc(e.name)}</span>
        <span class="elim-round">R${e.round}</span>
      </div>`).join("");
}

function updateSubmissions(state) {
  const active    = Object.values(state.players).filter((p) => p.status === "active");
  const submitted = active.filter((p) => p.submitted);
  subCount.textContent = `${submitted.length} / ${active.length}`;
  const r = state.lastResult;
  if (submitted.length === 0 && state.phase === "lobby") { submissionList.innerHTML = `<div class="empty-state">Start a round to collect numbers</div>`; return; }
  if (submitted.length === 0) { submissionList.innerHTML = `<div class="empty-state">Waiting for submissions...</div>`; return; }
  const sorted = [...submitted].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  submissionList.innerHTML = sorted.map((p) => {
    let cls = ""; let distHtml = "";
    if (r) {
      if (p.name === r.winnerName) cls = "winner-sub";
      if (p.name === r.eliminatedName) cls = "loser-sub";
      const sub = r.submissions?.find((s) => s.name === p.name);
      if (sub) distHtml = `<span class="sub-dist">Δ ${sub.distance}</span>`;
    }
    return `<div class="sub-item ${cls}">
      <span class="sub-name">${esc(p.name)}</span>
      <span style="display:flex;gap:0.75rem;align-items:center">${distHtml}<span class="sub-num">${p.number !== null ? p.number : "—"}</span></span>
    </div>`;
  }).join("");
}

function updateResult(state) {
  const r = state.lastResult;
  if (!r) { resultContent.innerHTML = `<div class="empty-state">No results yet</div>`; return; }
  resultContent.innerHTML = `
    <div class="result-stat"><span class="rs-label">AVERAGE</span><span class="rs-val">${r.average}</span></div>
    <div class="result-stat"><span class="rs-label">TARGET (×0.8)</span><span class="rs-val green big">${r.target}</span></div>
    <div class="result-stat" style="margin-top:0.5rem;border-top:1px solid var(--border);padding-top:0.75rem">
      <span class="rs-label">WINNER</span><span class="rs-val green">🏆 ${esc(r.winnerName)}</span>
    </div>
    <div class="result-stat"><span class="rs-label">ELIMINATED</span><span class="rs-val red">✕ ${esc(r.eliminatedName)}</span></div>`;
}

function updateControls(state) {
  const p = state.phase;
  const active = Object.values(state.players).filter((pl) => pl.status === "active");
  btnStart.disabled = !(p === "lobby" || p === "results");
  btnCalc.disabled  = !(p === "round" && active.some((pl) => pl.submitted));
  btnNext.disabled  = !(p === "results");
  btnEnd.disabled   = (p === "gameover");
}

function updateGameover(state) {
  if (state.phase === "gameover") {
    goWinnerName.textContent = state.finalWinner || "—";
    gameoverOverlay.classList.remove("hidden");
  } else {
    gameoverOverlay.classList.add("hidden");
  }
}

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
