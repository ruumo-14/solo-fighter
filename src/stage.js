import { GAME_CONFIG } from "./config.js";

export const STAGE_RUN_STATUS = Object.freeze({
  RUNNING: "running",
  BOSS_ACTIVE: "boss-active",
  CLEARED: "cleared",
  DEFEATED: "defeated"
});

export function createStageRun(stageNumber, mode = "normal") {
  if (!Number.isInteger(stageNumber) || stageNumber < 1) {
    throw new RangeError("ステージ番号は1以上の整数にしてください。");
  }
  if (!Object.hasOwn(GAME_CONFIG.modes, mode)) {
    throw new RangeError("存在しないゲームモードです。");
  }
  return {
    stageNumber,
    mode,
    elapsedSeconds: 0,
    status: STAGE_RUN_STATUS.RUNNING,
    nextBossIndex: 0,
    activeBossIndices: [],
    defeatedBosses: [],
    emittedEvents: []
  };
}

/**
 * Emits every boss spawn crossed by this frame. Bosses remain independently
 * trackable, so a late player can still fight more than one spawned boss.
 */
export function advanceStage(run, deltaSeconds) {
  if (!run || run.status === STAGE_RUN_STATUS.CLEARED ||
      run.status === STAGE_RUN_STATUS.DEFEATED) {
    return { run, events: [] };
  }
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("経過時間は0以上の数値にしてください。");
  }

  const previous = run.elapsedSeconds;
  run.elapsedSeconds = Math.min(
    GAME_CONFIG.stage.maxDurationSeconds,
    previous + deltaSeconds
  );

  const events = [];
  const bossTimes = GAME_CONFIG.stage.bossSpawnSeconds;

  while (
    run.nextBossIndex < bossTimes.length &&
    previous < bossTimes[run.nextBossIndex] &&
    run.elapsedSeconds >= bossTimes[run.nextBossIndex]
  ) {
    const bossIndex = run.nextBossIndex++;
    run.activeBossIndices.push(bossIndex);
    run.status = STAGE_RUN_STATUS.BOSS_ACTIVE;
    events.push({
      type: "boss-spawn",
      bossIndex,
      stageNumber: run.stageNumber,
      atSeconds: bossTimes[bossIndex]
    });
  }

  if (run.elapsedSeconds >= GAME_CONFIG.stage.maxDurationSeconds &&
      run.defeatedBosses.length < bossTimes.length) {
    run.status = STAGE_RUN_STATUS.DEFEATED;
    events.push({ type: "stage-defeated", reason: "time-limit" });
  }

  run.emittedEvents.push(...events);
  return { run, events };
}

export function defeatActiveBoss(run, requestedBossIndex = null) {
  if (!run || run.status === STAGE_RUN_STATUS.CLEARED ||
      run.status === STAGE_RUN_STATUS.DEFEATED ||
      run.activeBossIndices.length === 0) {
    return { run, events: [] };
  }

  const bossIndex = requestedBossIndex ?? run.activeBossIndices[0];
  if (!run.activeBossIndices.includes(bossIndex)) {
    return { run, events: [] };
  }

  run.activeBossIndices = run.activeBossIndices.filter(index => index !== bossIndex);
  if (!run.defeatedBosses.includes(bossIndex)) {
    run.defeatedBosses.push(bossIndex);
  }

  const events = [{
    type: "boss-defeated",
    bossIndex,
    stageNumber: run.stageNumber
  }];

  if (run.defeatedBosses.length === GAME_CONFIG.stage.bossSpawnSeconds.length) {
    run.status = STAGE_RUN_STATUS.CLEARED;
    events.push({
      type: "stage-cleared",
      stageNumber: run.stageNumber,
      elapsedSeconds: run.elapsedSeconds
    });
  } else {
    run.status = run.activeBossIndices.length
      ? STAGE_RUN_STATUS.BOSS_ACTIVE
      : STAGE_RUN_STATUS.RUNNING;
  }

  run.emittedEvents.push(...events);
  return { run, events };
}
