import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/state.js";
import {
  rollGacha, performLocalGacha, addOwnedItem, selectCharacter, selectPet,
  levelCharacter, levelPet, equipItem, upgradeEquipment, setSkillLoadout,
  addMissionProgress, claimMissionReward, unlockAchievement, equipTitle,
  recordRankingScore, getLocalRanking, createMarketListing,
  appendLocalChatMessage, claimEventReward, calculateEquipmentSetBonuses
} from "../src/systems.js";

test("normal and S1 gacha use the confirmed rarity tables", () => {
  assert.deepEqual(rollGacha("normal", () => 0), { banner: "normal", rarity: "item", isItem: true });
  assert.deepEqual(rollGacha("normal", () => 0.51), { banner: "normal", rarity: "ノーマル", isItem: false });
  assert.deepEqual(rollGacha("s1", () => 0.999), { banner: "s1", rarity: "S1", isItem: false });
});

test("local gacha records separate banner counters", () => {
  const state = createNewGameState();
  performLocalGacha(state, "normal", () => 0.2);
  performLocalGacha(state, "s1", () => 0.99);
  assert.equal(state.gacha.pity.normal, 1);
  assert.equal(state.gacha.pity.s1Equipment, 1);
  assert.equal(state.gacha.history.length, 2);
});

test("character and pet ownership, selection, and level caps work", () => {
  const state = createNewGameState();
  const character = addOwnedItem(state, "character", { id: "hero", rarity: "レア", level: 1 });
  const pet = addOwnedItem(state, "pet", { id: "pet-1", level: 19 });
  assert.equal(selectCharacter(state, character.id), true);
  assert.equal(selectPet(state, pet.id), true);
  assert.equal(levelCharacter(state, character.id, 2), 3);
  assert.equal(levelPet(state, pet.id, 5), 20);
});

test("equipment can be equipped and upgraded only with its specified materials", () => {
  const state = createNewGameState();
  const gear = addOwnedItem(state, "equipment", {
    id: "blade", slot: "武器", upgradeLevel: 0,
    upgradeCosts: { 1: { "ore": 2 } }, setId: "wanderer"
  });
  assert.equal(equipItem(state, gear.id), true);
  assert.equal(upgradeEquipment(state, gear.id).reason, "materials");
  state.inventory = [{ id: "ore", quantity: 2 }];
  assert.deepEqual(upgradeEquipment(state, gear.id), { ok: true, level: 1 });
  assert.equal(state.inventory[0].quantity, 0);
  assert.equal(calculateEquipmentSetBonuses(state, [
    { id: "wanderer", requiredPieces: 1, effects: { attack: 2 } }
  ])[0].effects.attack, 2);
});

test("skill loadout accepts owned skills without duplicate ids", () => {
  const state = createNewGameState();
  const a = addOwnedItem(state, "skill", { id: "skill-a" });
  addOwnedItem(state, "skill", { id: "skill-b" });
  assert.equal(setSkillLoadout(state, [a.id, "skill-b"]), true);
  assert.equal(setSkillLoadout(state, [a.id, a.id]), false);
});

test("missions, achievements, and titles can be progressed and claimed once", () => {
  const state = createNewGameState();
  addMissionProgress(state, "daily-1", 3);
  const mission = { id: "daily-1", target: 3, reward: { magicCrystals: 25 } };
  assert.equal(claimMissionReward(state, mission), true);
  assert.equal(claimMissionReward(state, mission), false);
  unlockAchievement(state, "first-clear", "初勝利");
  assert.equal(equipTitle(state, "初勝利"), true);
  assert.equal(state.resources.magicCrystals, 25);
});

test("local ranking sorts scores, and local chat rejects empty or oversized messages", () => {
  const state = createNewGameState();
  recordRankingScore(state, "power", 100);
  recordRankingScore(state, "power", 250);
  assert.equal(getLocalRanking(state, "power")[0].score, 250);
  assert.equal(appendLocalChatMessage(state, "Player", "こんにちは").body, "こんにちは");
  assert.equal(appendLocalChatMessage(state, "Player", "   "), false);
  assert.equal(appendLocalChatMessage(state, "Player", "x".repeat(181)), false);
});

test("market listings and event rewards are tracked once", () => {
  const state = createNewGameState();
  state.inventory = [{ id: "item-1", quantity: 1 }];
  assert.ok(createMarketListing(state, "item-1", 50));
  assert.equal(createMarketListing(state, "item-1", 50), false);
  assert.equal(claimEventReward(state, "winter-event", { magicCrystals: 10 }), true);
  assert.equal(claimEventReward(state, "winter-event", { magicCrystals: 10 }), false);
  assert.equal(state.resources.magicCrystals, 10);
});
