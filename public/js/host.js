const socket = io();
socket.emit("joinHost");

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

const btnStart     = document.getElementById("btnStartRound");
const btnCalc      = document.getElementById("btnCalculate");
const btnNext      = document.getElementById("btnNextRound");
const btnEnd       = document.getElementById("btnEndGame");
const btnReset     = document.getElementById("btnReset");
const btnGoReset   = document.getElementById("goReset");

// ── Controls ──────────────────────────────────────────────────────────────────
btnStart.addEventListener("click", () => socket.emit("startRound"));
btnCalc.addEventListener("click",  () => socket.emit("calculateResult"));
btnNext.addEventListener("click",  () => socket.emit("nextRound"));
btnEnd.addEventListener("click",   () => { if (confirm("End the game and reveal the final winner?")) socket.emit("endGame"); });
btnReset.addEventListener("click", () => { if (confirm("Reset the entire game? All data will be lost.")) socket.emit("resetGame"); });
btnGoReset.addEventListener("click", () => { if (confirm("Reset the entire game?")) socket.emit("resetGame"); });

// ── Render Game State ─────────────────────────────────────────────────────────
socket.on("gameState", (state) => {
  updateHeader(state);
  updatePlayers(state);
  updateSubmissions(state);
  updateResult(state);
  updateControls(state);
  updateGameover(state);
});

socket.on("forceReload", () => window.location.reload());

// ── Header ────────────────────────────────────────────────────────────────────
function updateHeader(state) {
  roundBadge.textContent = `ROUND ${state.round}`;

  const phases = { lobby: "LOBBY", round: "ROUND OPEN", calculating: "CALCULATING", results: "RESULTS", gameover: "GAME OVER" };
  phaseBadge.textContent = phases[state.phase] || state.phase.toUpperCase();
  phaseBadge.className = "phase-badge";
  if (state.phase === "round") phaseBadge.classList.add("phase-round");
  if (state.phase === "results" || state.phase === "calculating") phaseBadge.classList.add("phase-results");
}

// ── Player Lists ──────────────────────────────────────────────────────────────
function updatePlayers(state) {
  const active = Object.entries(state.players).filter(([, p]) => p.status === "active");
  const elims  = state.eliminated || [];

  activeCount.textContent = active.length;
  elimCount.textContent   = elims.length;

  if (active.length === 0) {
    activePlayerList.innerHTML = `<div class="empty-state">Waiting for players to join...</div>`;
  } else {
    activePlayerList.innerHTML = active.map(([, p]) => {
      const statusText = p.submitted ? "SUBMITTED ✓" : "WAITING...";
      return `<div class="player-item ${p.submitted ? "submitted" : ""}">
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-status">${statusText}</span>
      </div>`;
    }).join("");
  }

  if (elims.length === 0) {
    elimPlayerList.innerHTML = `<div class="empty-state">None yet</div>`;
  } else {
    elimPlayerList.innerHTML = elims.slice().reverse().map((e) =>
      `<div class="player-item eliminated-item">
        <span class="p-name">${esc(e.name)}</span>
        <span class="elim-round">R${e.round}</span>
      </div>`
    ).join("");
  }
}

// ── Submissions ───────────────────────────────────────────────────────────────
function updateSubmissions(state) {
  const active    = Object.values(state.players).filter((p) => p.status === "active");
  const submitted = active.filter((p) => p.submitted);

  subCount.textContent = `${submitted.length} / ${active.length}`;

  const r = state.lastResult;

  if (submitted.length === 0 && state.phase === "lobby") {
    submissionList.innerHTML = `<div class="empty-state">Start a round to collect numbers</div>`;
    return;
  }

  if (submitted.length === 0) {
    submissionList.innerHTML = `<div class="empty-state">Waiting for submissions...</div>`;
    return;
  }

  const sorted = [...submitted].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  const hasResults = r && r.submissions;

  submissionList.innerHTML = sorted.map((p) => {
    let cls = "";
    let distHtml = "";
    if (hasResults) {
      if (p.name === r.winnerName) cls = "winner-sub";
      if (p.name === r.eliminatedName) cls = "loser-sub";
      const sub = r.submissions.find((s) => s.name === p.name);
      if (sub) distHtml = `<span class="sub-dist">Δ ${sub.distance}</span>`;
    }
    const num = p.number !== null ? p.number : "—";
    return `<div class="sub-item ${cls}">
      <span class="sub-name">${esc(p.name)}</span>
      <span style="display:flex;gap:0.75rem;align-items:center">${distHtml}<span class="sub-num">${num}</span></span>
    </div>`;
  }).join("");
}

// ── Result Panel ──────────────────────────────────────────────────────────────
function updateResult(state) {
  const r = state.lastResult;
  if (!r) {
    resultContent.innerHTML = `<div class="empty-state">No results yet</div>`;
    return;
  }

  resultContent.innerHTML = `
    <div class="result-stat">
      <span class="rs-label">AVERAGE</span>
      <span class="rs-val">${r.average}</span>
    </div>
    <div class="result-stat">
      <span class="rs-label">TARGET (×0.8)</span>
      <span class="rs-val green big">${r.target}</span>
    </div>
    <div class="result-stat" style="margin-top:0.5rem;border-top:1px solid var(--border);padding-top:0.75rem">
      <span class="rs-label">WINNER</span>
      <span class="rs-val green">🏆 ${esc(r.winnerName)}</span>
    </div>
    <div class="result-stat">
      <span class="rs-label">ELIMINATED</span>
      <span class="rs-val red">✕ ${esc(r.eliminatedName)}</span>
    </div>
  `;
}

// ── Controls ──────────────────────────────────────────────────────────────────
function updateControls(state) {
  const p = state.phase;
  const active = Object.values(state.players).filter((pl) => pl.status === "active");

  btnStart.disabled = !(p === "lobby" || p === "results");
  btnCalc.disabled  = !(p === "round" && active.some((pl) => pl.submitted));
  btnNext.disabled  = !(p === "results");
  btnEnd.disabled   = (p === "gameover");
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function updateGameover(state) {
  if (state.phase === "gameover") {
    goWinnerName.textContent = state.finalWinner || "—";
    gameoverOverlay.classList.remove("hidden");
  } else {
    gameoverOverlay.classList.add("hidden");
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
