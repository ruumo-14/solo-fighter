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


/**
 * Apply one completed or failed run to permanent progression.
 * Combat XP/levels are run-local; this function grants account progression
 * and the primary currency after the result screen is reached.
 */
export function applyStageResults(state, result) {
  if (!state || !result || !["cleared", "defeated"].includes(result.outcome)) {
    return { state, rewards: { experience: 0, magicCrystals: 0 } };
  }

  const stage = Math.max(1, Math.floor(result.stageNumber || 1));
  const kills = Math.max(0, Math.floor(result.kills || 0));
  const cleared = result.outcome === "cleared";
  const rewards = {
    experience: cleared ? 120 + stage * 20 : 20 + stage * 5,
    magicCrystals: cleared ? 100 + stage * 10 + kills : 20 + Math.floor(kills / 2)
  };

  state.progression.totalRuns += 1;
  state.progression.totalDefeatedEnemies += kills;
  if (cleared) {
    state.progression.totalClears += 1;
    if (!state.progression.clearedStages.includes(stage)) {
      state.progression.clearedStages.push(stage);
    }
    state.progression.unlockedStage = Math.max(
      state.progression.unlockedStage,
      Math.min(GAME_CONFIG.stage.initialStageCount, stage + 1)
    );
  } else {
    state.progression.totalDefeats += 1;
  }

  state.profile.playerExperience += rewards.experience;
  while (
    state.profile.playerLevel < GAME_CONFIG.player.maxLevel &&
    state.profile.playerExperience >= state.profile.playerExperienceToNextLevel
  ) {
    state.profile.playerExperience -= state.profile.playerExperienceToNextLevel;
    state.profile.playerLevel += 1;
    state.profile.playerExperienceToNextLevel =
      Math.floor(state.profile.playerExperienceToNextLevel * 1.18 + 25);
  }
  if (state.profile.playerLevel >= GAME_CONFIG.player.maxLevel) {
    state.profile.playerExperience = 0;
  }

  state.resources.magicCrystals += rewards.magicCrystals;
  state.progression.totalMagicCrystalsEarned += rewards.magicCrystals;
  return { state, rewards };
}
