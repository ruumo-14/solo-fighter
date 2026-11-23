import { GAME_CONFIG } from "./config.js";

const clone = value => structuredClone(value);
const requireState = state => {
  if (!state || !state.profile || !state.collection || !state.loadout) {
    throw new TypeError("ゲームデータが正しくありません。");
  }
};
const findOwned = (items, id) => items.find(item => item.id === id);
const getInventory = state => state.inventory ??= [];
const getCollection = state => {
  state.collection.characters ??= [];
  state.collection.pets ??= [];
  state.collection.equipment ??= [];
  state.collection.skills ??= [];
  return state.collection;
};

/** Weighted rarity roll. The "item" result is kept distinct from character/equipment rarity. */
export function rollGacha(banner = "normal", random = Math.random) {
  const table = GAME_CONFIG.gacha[banner];
  if (!table) throw new RangeError("存在しないガチャです。");
  const roll = random() * 100;
  let cursor = 0;
  for (const [rarity, chance] of Object.entries(table)) {
    cursor += chance;
    if (roll < cursor) return { banner, rarity, isItem: rarity === "item" };
  }
  return { banner, rarity: Object.keys(table).at(-1), isItem: false };
}

/**
 * Executes one local preview pull. Online currency deduction and authoritative
 * rewards must be moved to a trusted server transaction before public release.
 */
export function performLocalGacha(state, banner, random = Math.random) {
  requireState(state);
  const result = rollGacha(banner, random);
  state.gacha ??= { pity: {}, history: [] };
  state.gacha.pity ??= {};
  state.gacha.history ??= [];
  const pityKey = banner === "s1" ? "s1Equipment" : banner;
  state.gacha.pity[pityKey] = (state.gacha.pity[pityKey] ?? 0) + 1;
  const record = { ...result, pullNumber: state.gacha.pity[pityKey], at: Date.now() };
  state.gacha.history.push(record);
  return clone(record);
}

export function addOwnedItem(state, type, item) {
  requireState(state);
  const collection = getCollection(state);
  const key = ({ character: "characters", pet: "pets", equipment: "equipment", skill: "skills" })[type];
  if (!key) throw new RangeError("未対応のアイテム種別です。");
  const entry = { ...clone(item), id: item.id ?? crypto.randomUUID(), type };
  collection[key].push(entry);
  return clone(entry);
}

export function selectCharacter(state, characterId) {
  requireState(state);
  if (!findOwned(getCollection(state).characters, characterId)) return false;
  state.loadout.characterId = characterId;
  return true;
}
export function selectPet(state, petId) {
  requireState(state);
  if (!findOwned(getCollection(state).pets, petId)) return false;
  state.loadout.petId = petId;
  return true;
}

export function levelCharacter(state, characterId, amount = 1) {
  requireState(state);
  const character = findOwned(getCollection(state).characters, characterId);
  if (!character) return false;
  const next = Math.max(1, Math.floor(character.level ?? 1) + Math.max(1, Math.floor(amount)));
  character.level = Math.min(GAME_CONFIG.player.maxLevel, next);
  return character.level;
}
export function levelPet(state, petId, amount = 1) {
  requireState(state);
  const pet = findOwned(getCollection(state).pets, petId);
  if (!pet) return false;
  pet.level = Math.min(GAME_CONFIG.pet.maxLevel, Math.max(1, Math.floor(pet.level ?? 1) + Math.max(1, Math.floor(amount))));
  return pet.level;
}

export function equipItem(state, itemId) {
  requireState(state);
  const item = findOwned(getCollection(state).equipment, itemId);
  if (!item || !GAME_CONFIG.equipmentSlots.includes(item.slot)) return false;
  state.loadout.equipmentBySlot ??= Object.fromEntries(GAME_CONFIG.equipmentSlots.map(slot => [slot, null]));
  state.loadout.equipmentBySlot[item.slot] = itemId;
  return true;
}
export function upgradeEquipment(state, itemId) {
  requireState(state);
  const item = findOwned(getCollection(state).equipment, itemId);
  if (!item) return { ok: false, reason: "not-found" };
  const level = Math.max(0, Math.floor(item.upgradeLevel ?? 0));
  if (level >= GAME_CONFIG.equipment.maxUpgradeLevel) return { ok: false, reason: "max-level" };
  const costs = item.upgradeCosts?.[level + 1];
  if (!costs || typeof costs !== "object") return { ok: false, reason: "cost-table-missing" };
  const inventory = getInventory(state);
  for (const [materialId, amount] of Object.entries(costs)) {
    const material = inventory.find(entry => entry.id === materialId || entry.itemId === materialId);
    if (!material || (material.quantity ?? 0) < amount) return { ok: false, reason: "materials" };
  }
  for (const [materialId, amount] of Object.entries(costs)) {
    const material = inventory.find(entry => entry.id === materialId || entry.itemId === materialId);
    material.quantity -= amount;
  }
  item.upgradeLevel = level + 1;
  return { ok: true, level: item.upgradeLevel };
}

export function setSkillLoadout(state, skillIds) {
  requireState(state);
  if (!Array.isArray(skillIds) || new Set(skillIds).size !== skillIds.length) return false;
  const owned = new Set(getCollection(state).skills.map(skill => skill.id));
  if (skillIds.some(id => !owned.has(id))) return false;
  state.loadout.skillIds = [...skillIds];
  return true;
}
export function resetBuild(state, allocation = {}) {
  requireState(state);
  // The exact stat-point costs are intentionally supplied by the final character
  // definitions; this operation only resets the saved allocation.
  state.profile.statAllocation = clone(allocation);
  return true;
}

export function addMissionProgress(state, missionKey, amount = 1, period = "daily") {
  requireState(state);
  if (!["daily", "weekly"].includes(period)) throw new RangeError("期間が不正です。");
  state.missions ??= { daily: {}, weekly: {}, claimedRewards: [] };
  const bucket = state.missions[period] ??= {};
  bucket[missionKey] = Math.max(0, (bucket[missionKey] ?? 0) + Math.max(0, amount));
  return bucket[missionKey];
}
export function claimMissionReward(state, mission) {
  requireState(state);
  if (!mission?.id || !Number.isFinite(mission.target) || !mission.reward) return false;
  state.missions ??= { daily: {}, weekly: {}, claimedRewards: [] };
  state.missions.claimedRewards ??= [];
  if (state.missions.claimedRewards.includes(mission.id)) return false;
  const progress = state.missions[mission.period ?? "daily"]?.[mission.id] ?? 0;
  if (progress < mission.target) return false;
  if (mission.reward.magicCrystals) state.resources.magicCrystals += mission.reward.magicCrystals;
  if (mission.reward.experience) state.profile.playerExperience += mission.reward.experience;
  if (mission.reward.items) getInventory(state).push(...clone(mission.reward.items));
  state.missions.claimedRewards.push(mission.id);
  return true;
}

export function unlockAchievement(state, achievementId, titleId = null) {
  requireState(state);
  state.achievements ??= { unlocked: [], titles: [] };
  if (!state.achievements.unlocked.includes(achievementId)) state.achievements.unlocked.push(achievementId);
  if (titleId && !state.achievements.titles.includes(titleId)) state.achievements.titles.push(titleId);
  return true;
}
export function equipTitle(state, titleId) {
  requireState(state);
  if (!state.achievements?.titles?.includes(titleId)) return false;
  state.profile.title = titleId;
  return true;
}

export function recordRankingScore(state, category, score, period = "lifetime") {
  requireState(state);
  state.rankings ??= [];
  if (!Number.isFinite(score)) return false;
  state.rankings.push({ category, score, period, createdAt: Date.now() });
  return true;
}
export function getLocalRanking(state, category, period = null) {
  requireState(state);
  return [...(state.rankings ?? [])]
    .filter(row => row.category === category && (period === null || row.period === period))
    .sort((a, b) => b.score - a.score);
}

export function createMarketListing(state, itemId, price) {
  requireState(state);
  const item = getInventory(state).find(entry => entry.id === itemId);
  if (!item || !Number.isInteger(price) || price <= 0) return false;
  state.marketListings ??= [];
  if (state.marketListings.some(row => row.itemId === itemId && row.status === "listed")) return false;
  const listing = { id: crypto.randomUUID(), itemId, price, status: "listed", createdAt: Date.now() };
  state.marketListings.push(listing);
  return clone(listing);
}

export function appendLocalChatMessage(state, playerName, message) {
  requireState(state);
  const body = String(message ?? "").trim();
  if (!body || body.length > 180) return false;
  state.chatMessages ??= [];
  const entry = { playerName: String(playerName || "冒険者").slice(0, 24), body, createdAt: Date.now() };
  state.chatMessages.push(entry);
  state.chatMessages = state.chatMessages.slice(-100);
  return clone(entry);
}

/** Event data is supplied by the event calendar; this helper tracks local claims only. */
export function claimEventReward(state, eventId, reward) {
  requireState(state);
  state.events ??= { claimedRewards: [] };
  state.events.claimedRewards ??= [];
  const key = String(eventId);
  if (state.events.claimedRewards.includes(key)) return false;
  if (reward?.magicCrystals) state.resources.magicCrystals += reward.magicCrystals;
  if (reward?.items) getInventory(state).push(...clone(reward.items));
  state.events.claimedRewards.push(key);
  return true;
}

export function calculateEquipmentSetBonuses(state, setDefinitions = []) {
  requireState(state);
  const equipped = new Set(Object.values(state.loadout.equipmentBySlot ?? {}).filter(Boolean));
  const items = getCollection(state).equipment.filter(item => equipped.has(item.id));
  return setDefinitions.filter(set => {
    const count = items.filter(item => item.setId === set.id).length;
    return count >= set.requiredPieces;
  }).map(set => ({ setId: set.id, effects: clone(set.effects) }));
}
