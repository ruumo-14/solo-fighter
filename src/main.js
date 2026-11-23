import { createCombatRun, setCombatInput, tickCombat, drawCombat, chooseLevelUp, getCombatStatus } from "./combat.js";
import { loadLocalGameState, saveLocalGameState, applyStageResults } from "./state.js";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const overlayContent = document.querySelector("#overlayContent");
const startButton = document.querySelector("#start");
const statusText = document.querySelector("#status");
const stageSelect = document.querySelector("#stage");
const modeSelect = document.querySelector("#mode");
const hpText = document.querySelector("#hp");
const xpText = document.querySelector("#xp");
const levelText = document.querySelector("#level");
const killsText = document.querySelector("#kills");
const timeText = document.querySelector("#time");
const bossText = document.querySelector("#bosses");

let run = null;
let gameState = loadLocalGameState();
let lastFrame = 0;
let animationId = 0;
const keys = { left: false, right: false, jump: false, attack: false };
let jumpQueued = false;
let attackQueued = false;

function showOverlay(html) {
  overlayContent.innerHTML = html;
  overlay.classList.remove("hidden");
}
function hideOverlay() {
  overlay.classList.add("hidden");
}
function showLevelUp() {
  if (!run || run.pendingLevelUps <= 0) return;
  showOverlay(`
    <h2>レベルアップ！</h2>
    <p>強化を1つ選んでください。</p>
    <div class="choices">
      <button data-upgrade="power"><b>攻撃強化</b><span>攻撃力 +3</span></button>
      <button data-upgrade="vitality"><b>生命強化</b><span>最大HP +20、HP回復</span></button>
      <button data-upgrade="haste"><b>連撃強化</b><span>攻撃間隔を短縮</span></button>
    </div>
  `);
}
function showResult() {
  if (!run) return;
  const status = getCombatStatus(run);
  const cleared = run.result === "cleared";
  if (!run.rewardGranted) {
    const applied = applyStageResults(gameState, {
      outcome: run.result,
      stageNumber: run.stage.stageNumber,
      kills: run.kills
    });
    gameState = applied.state;
    run.rewardGranted = true;
    saveLocalGameState(gameState);
    refreshProfileHud();
    refreshStageOptions();
    run.rewards = applied.rewards;
  }
  statusText.textContent = cleared ? "ステージクリア！" : "ステージ失敗";
  showOverlay(`
    <h2>${cleared ? "ステージクリア！" : "ステージ失敗"}</h2>
    <p>ステージ ${run.stage.stageNumber}</p>
    <p>生存時間：${formatTime(status.elapsedSeconds)} / 討伐数：${status.kills}</p>
    <p>撃破ボス：${status.bossesDefeated}/3　到達Lv：${status.level}</p>
    <p>獲得経験値：${run.rewards.experience}　獲得魔晶：${run.rewards.magicCrystals}</p>
    <p>プレイヤーLv. ${gameState.profile.playerLevel}　所持魔晶 ${gameState.resources.magicCrystals}</p>
    <button class="primary" id="retry">もう一度挑戦</button>
    <button id="back">ステージ選択へ</button>
  `);
  document.querySelector("#retry").addEventListener("click", startRun);
  document.querySelector("#back").addEventListener("click", () => {
    cancelAnimationFrame(animationId);
    run = null;
    hideOverlay();
    statusText.textContent = "ステージを選択して開始してください。";
    refreshProfileHud();
refreshStageOptions();
drawTitleScreen();
  });
}
function formatTime(seconds) {
  const n = Math.floor(seconds);
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
}
function updateHud() {
  if (!run) return;
  const s = getCombatStatus(run);
  hpText.textContent = Math.ceil(s.hp) + "/" + s.maxHp;
  xpText.textContent = s.xp + "/" + s.xpNext;
  levelText.textContent = s.level;
  killsText.textContent = s.kills;
  timeText.textContent = formatTime(s.elapsedSeconds);
  bossText.textContent = s.bossesDefeated + "/3";
}
function frame(now) {
  if (!run) return;
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  setCombatInput(run, {
    left: keys.left,
    right: keys.right,
    jump: jumpQueued,
    attack: attackQueued
  });
  jumpQueued = false;
  attackQueued = false;
  tickCombat(run, dt);
  drawCombat(ctx, run, canvas.width, canvas.height);
  updateHud();

  if (run.pendingLevelUps > 0) {
    showLevelUp();
    animationId = requestAnimationFrame(frame);
    return;
  }
  if (run.result) {
    showResult();
    return;
  }
  animationId = requestAnimationFrame(frame);
}
function refreshProfileHud() {
  const level = document.querySelector("#profile-level");
  const crystals = document.querySelector("#profile-crystals");
  if (level) level.textContent = gameState.profile.playerLevel;
  if (crystals) crystals.textContent = gameState.resources.magicCrystals;
}
function refreshStageOptions() {
  const unlocked = Math.max(1, gameState.progression.unlockedStage);
  for (const option of stageSelect.options) {
    const stageNumber = Number(option.value);
    option.disabled = stageNumber > unlocked;
    option.textContent = "STAGE " + stageNumber + (stageNumber > unlocked ? "（未解放）" : "");
  }
  if (Number(stageSelect.value) > unlocked) stageSelect.value = String(unlocked);
}
function startRun() {
  cancelAnimationFrame(animationId);
  refreshStageOptions();
  const stage = Math.max(1, Math.min(gameState.progression.unlockedStage, Number(stageSelect.value) || 1));
  const mode = modeSelect.value;
  run = createCombatRun(stage, mode);
  lastFrame = 0;
  Object.keys(keys).forEach(key => keys[key] = false);
  hideOverlay();
  statusText.textContent = "戦闘中";
  animationId = requestAnimationFrame(frame);
}
function drawTitleScreen() {
  ctx.fillStyle = "#17263c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#273e53";
  ctx.fillRect(0, 330, canvas.width, 110);
  ctx.fillStyle = "#e9d8a6";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SOLO FIGHTER", canvas.width / 2, 175);
  ctx.font = "18px sans-serif";
  ctx.fillText("ステージとモードを選んで挑戦しよう", canvas.width / 2, 215);
}

startButton.addEventListener("click", startRun);
document.addEventListener("keydown", event => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
  if (event.repeat && ["Space", "KeyJ"].includes(event.code)) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") jumpQueued = true;
  if (event.code === "KeyJ" || event.code === "KeyK") attackQueued = true;
  if (event.code === "Escape" && run && !run.result) {
    run.paused = !run.paused;
    statusText.textContent = run.paused ? "一時停止中" : "戦闘中";
  }
});
document.addEventListener("keyup", event => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
});
document.querySelectorAll("[data-control]").forEach(button => {
  const key = button.dataset.control;
  const press = event => {
    event.preventDefault();
    if (key === "jump") jumpQueued = true;
    else if (key === "attack") attackQueued = true;
    else keys[key] = true;
  };
  const release = event => {
    event.preventDefault();
    if (key === "left" || key === "right") keys[key] = false;
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
});
overlayContent.addEventListener("click", event => {
  const button = event.target.closest("[data-upgrade]");
  if (!button || !run) return;
  chooseLevelUp(run, button.dataset.upgrade);
  hideOverlay();
  if (run.pendingLevelUps > 0) showLevelUp();
});
drawTitleScreen();
