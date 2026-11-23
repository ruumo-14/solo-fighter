export const ENEMY_DEFINITIONS = Object.freeze({
  beast: {
    id: "beast",
    name: "獣",
    role: "melee",
    behavior: ["approach-player", "contact-damage"],
    contactDamageOnlyWhileCharging: false
  },
  goblin: {
    id: "goblin",
    name: "ゴブリン",
    role: "charger",
    behavior: ["approach-player", "short-windup", "charge"],
    contactDamageOnlyWhileCharging: true
  },
  skeleton: {
    id: "skeleton",
    name: "スケルトン",
    role: "ranged",
    behavior: ["warning-flash", "fire-ballistic-arrow"],
    contactDamageOnlyWhileCharging: false
  },
  hover: {
    id: "hover",
    name: "ホバリン",
    role: "aerial-charger",
    behavior: ["approach-player", "create-distance", "pause", "charge"],
    contactDamageOnlyWhileCharging: true
  }
});

export const ENEMY_STATE = Object.freeze({
  APPROACH: "approach",
  WINDUP: "windup",
  CHARGE: "charge",
  RETREAT: "retreat",
  PAUSE: "pause",
  WARNING: "warning",
  ATTACK: "attack",
  RECOVER: "recover"
});

export function createEnemy(enemyId, overrides = {}) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  if (!definition) throw new RangeError("未定義の敵です: " + enemyId);

  return {
    id: definition.id,
    name: definition.name,
    role: definition.role,
    x: 0,
    y: 0,
    hp: 1,
    maxHp: 1,
    moveSpeed: 1,
    attackPower: 1,
    state: ENEMY_STATE.APPROACH,
    stateTime: 0,
    attackCooldown: 0,
    flashTime: 0,
    isCharging: false,
    isAlive: true,
    ...overrides
  };
}

/**
 * Returns whether an enemy can deal contact damage in its current state.
 * Goblins and Hoverins only deal contact damage during their charge.
 */
export function canDealContactDamage(enemy) {
  const definition = ENEMY_DEFINITIONS[enemy?.id];
  if (!definition || !enemy.isAlive) return false;
  if (!definition.contactDamageOnlyWhileCharging) return true;
  return enemy.state === ENEMY_STATE.CHARGE || enemy.isCharging === true;
}

/**
 * A shared rule used by attacks: interrupting a Hoverin during its charge
 * makes it retreat toward its recorded launch position.
 */
export function interruptEnemyWithHit(enemy) {
  if (!enemy || !enemy.isAlive) return enemy;
  if (enemy.id === "hover" && enemy.state === ENEMY_STATE.CHARGE) {
    enemy.state = ENEMY_STATE.RETREAT;
    enemy.isCharging = false;
    enemy.stateTime = 0;
  }
  return enemy;
}
