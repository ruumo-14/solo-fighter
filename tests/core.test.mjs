import test from "node:test";
import assert from "node:assert/strict";
import { assertValidGameConfig } from "../src/config.js";
import { createStageRun, advanceStage, defeatActiveBoss, STAGE_RUN_STATUS } from "../src/stage.js";
import { createNewGameState, applyStageResults } from "../src/state.js";
import { createEnemy, ENEMY_STATE, canDealContactDamage, interruptEnemyWithHit } from "../src/enemies.js";
import { createCombatRun, setCombatInput, tickCombat } from "../src/combat.js";

test("game configuration keeps the agreed seven-minute boss schedule and gacha totals", () => {
  assert.equal(assertValidGameConfig(), true);
});

test("three scheduled bosses must be defeated to clear a stage", () => {
  const run = createStageRun(1);
  advanceStage(run, 120);
  assert.deepEqual(run.activeBossIndices, [0]);
  advanceStage(run, 120);
  assert.deepEqual(run.activeBossIndices, [0, 1]);
  defeatActiveBoss(run, 0);
  assert.equal(run.status, STAGE_RUN_STATUS.BOSS_ACTIVE);
  advanceStage(run, 120);
  assert.deepEqual(run.activeBossIndices, [1, 2]);
  defeatActiveBoss(run, 1);
  assert.equal(run.status, STAGE_RUN_STATUS.BOSS_ACTIVE);
  const result = defeatActiveBoss(run, 2);
  assert.ok(result.events.some(event => event.type === "stage-cleared"));
  assert.equal(run.status, STAGE_RUN_STATUS.CLEARED);
});

test("a stage fails at the seven-minute limit if the bosses are not all defeated", () => {
  const run = createStageRun(1);
  const result = advanceStage(run, 420);
  assert.equal(run.status, STAGE_RUN_STATUS.DEFEATED);
  assert.ok(result.events.some(event => event.type === "stage-defeated"));
});

test("clearing a stage grants permanent experience, crystals, and the next unlock", () => {
  const state = createNewGameState();
  const result = applyStageResults(state, {
    outcome: "cleared",
    stageNumber: 1,
    kills: 5
  });
  assert.equal(result.rewards.experience, 140);
  assert.equal(result.rewards.magicCrystals, 115);
  assert.equal(state.progression.unlockedStage, 2);
  assert.equal(state.profile.playerLevel, 2);
  assert.equal(state.profile.playerExperience, 40);
});

test("aerial charger loses its charge state when hit", () => {
  const hover = createEnemy("hover", {
    state: ENEMY_STATE.CHARGE,
    isCharging: true
  });
  assert.equal(canDealContactDamage(hover), true);
  interruptEnemyWithHit(hover);
  assert.equal(hover.state, ENEMY_STATE.RETREAT);
  assert.equal(canDealContactDamage(hover), false);
});

test("combat run accepts movement input and advances the player", () => {
  const run = createCombatRun(1);
  setCombatInput(run, { right: true });
  tickCombat(run, 0.05);
  assert.ok(run.player.x > 150);
});
