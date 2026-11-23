export const GAME_CONFIG = Object.freeze({
  title: "SOLO FIGHTER",
  version: "rebuild-1",
  stage: {
    firstStage: 1,
    initialStageCount: 20,
    maxDurationSeconds: 420,
    bossSpawnSeconds: [120, 240, 360],
    unlockNextStageOnClear: true,
    allowReplayClearedStages: true
  },
  modes: {
    normal: { label: "ノーマル" },
    hard: { label: "ハード", unlockPlayerLevel: 50 },
    endless: { label: "エンドレス" },
    bossRush: { label: "ボスラッシュ" },
    survival: { label: "サバイバル" }
  },
  rarities: ["ノーマル", "レア", "エピック", "レジェンド", "S1"],
  gacha: {
    normal: {
      item: 50,
      ノーマル: 10,
      レア: 35,
      エピック: 4,
      レジェンド: 1
    },
    s1: {
      item: 50,
      ノーマル: 10,
      レア: 33,
      エピック: 4,
      レジェンド: 2,
      S1: 1
    },
    pityCount: 100
  },
  equipmentSlots: ["頭", "胴", "脚", "足", "手", "武器"],
  player: {
    startingLevel: 1,
    maxLevel: 100
  },
  pet: {
    maxLevel: 20
  },
  equipment: {
    maxUpgradeLevel: 10
  },
  currency: {
    primary: "魔晶"
  }
});

export function assertValidGameConfig() {
  const bossTimes = GAME_CONFIG.stage.bossSpawnSeconds;
  if (GAME_CONFIG.stage.maxDurationSeconds !== 420) {
    throw new Error("ステージの制限時間は7分（420秒）である必要があります。");
  }
  if (bossTimes.join(",") !== "120,240,360") {
    throw new Error("ボス出現時刻の設定が設計と一致しません。");
  }
  for (const banner of [GAME_CONFIG.gacha.normal, GAME_CONFIG.gacha.s1]) {
    const total = Object.values(banner).reduce((sum, value) => sum + value, 0);
    if (total !== 100) throw new Error("ガチャ確率の合計は100%である必要があります。");
  }
  return true;
}
