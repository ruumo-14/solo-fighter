import { GAME_CONFIG } from "./config.js";

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_KEY = "solo-fighter-rebuild";

export function createNewGameState() {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    profile: {
      playerName: "冒険者",
      playerLevel: GAME_CONFIG.player.startingLevel,
      playerExperience: 0,
      playerExperienceToNextLevel: 100,
      title: "",
      selectedCharacterId: null
    },
    resources: {
      magicCrystals: 0,
      gachaStones: 10,
      gachaTickets: 0
    },
    progression: {
      unlockedStage: GAME_CONFIG.stage.firstStage,
      clearedStages: [],
      totalRuns: 0,
      totalClears: 0,
      totalDefeats: 0,
      totalDefeatedEnemies: 0,
      totalMagicCrystalsEarned: 0
    },
    collection: {
      characters: [],
      pets: [],
      equipment: [],
      skills: []
    },
    loadout: {
      characterId: null,
      petId: null,
      equipmentBySlot: Object.fromEntries(
        GAME_CONFIG.equipmentSlots.map(slot => [slot, null])
      )
    },
    gacha: {
      pity: { character: 0, pet: 0, s1Equipment: 0 },
      history: []
    },
    missions: {
      daily: {},
      weekly: {},
      claimedRewards: []
    },
    achievements: {
      unlocked: [],
      titles: []
    },
    social: {
      chatEnabled: true
    },
    settings: {
      soundEnabled: true,
      effectsEnabled: true
    }
  };
}

export function loadLocalGameState(storage = globalThis.localStorage) {
  if (!storage) return createNewGameState();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createNewGameState();
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== SAVE_SCHEMA_VERSION) {
      return createNewGameState();
    }
    return parsed;
  } catch {
    return createNewGameState();
  }
}

export function saveLocalGameState(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
