import { GAME_CONFIG } from "./config.js";
import { createStageRun, advanceStage, defeatActiveBoss, STAGE_RUN_STATUS } from "./stage.js";
import { createEnemy, ENEMY_STATE, canDealContactDamage, interruptEnemyWithHit } from "./enemies.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);

const ENEMY_STATS = {
  beast: { hp: 34, speed: 62, damage: 8, xp: 5, radius: 17 },
  goblin: { hp: 28, speed: 78, damage: 10, xp: 6, radius: 15 },
  skeleton: { hp: 24, speed: 38, damage: 7, xp: 6, radius: 14 },
  hover: { hp: 30, speed: 68, damage: 9, xp: 7, radius: 15 }
};

export function createCombatRun(stageNumber = 1, mode = "normal") {
  const stage = createStageRun(stageNumber, mode);
  return {
    stage,
    player: {
      x: 150, y: 330, vx: 0, vy: 0, width: 34, height: 58,
      hp: 100, maxHp: 100, mp: 50, maxMp: 50,
      stamina: 100, maxStamina: 100, level: 1, xp: 0, xpNext: 8,
      attack: 10, facing: 1, onGround: true, attackCooldown: 0,
      attackTime: 0, invulnerableTime: 0
    },
    enemies: [],
    projectiles: [],
    particles: [],
    kills: 0,
    spawnClock: 0,
    bossCounter: 0,
    pendingLevelUps: 0,
    paused: false,
    elapsedReal: 0,
    result: null
  };
}

function spawnEnemy(run, type = null) {
  const types = ["beast", "goblin", "skeleton", "hover"];
  const id = type || types[Math.floor(Math.random() * types.length)];
  const stats = ENEMY_STATS[id];
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -30 : 930;
  const enemy = createEnemy(id, {
    x,
    y: id === "hover" ? rand(205, 260) : 330,
    hp: stats.hp + run.stage.stageNumber * 2,
    maxHp: stats.hp + run.stage.stageNumber * 2,
    moveSpeed: stats.speed + run.stage.stageNumber * 1.2,
    attackPower: stats.damage + Math.floor(run.stage.stageNumber / 3),
    xpValue: stats.xp,
    radius: stats.radius,
    facing: fromLeft ? 1 : -1,
    homeX: x,
    windup: 0
  });
  run.enemies.push(enemy);
}

function spawnBoss(run, bossIndex) {
  const level = run.stage.stageNumber;
  const hp = 480 + level * 95 + bossIndex * 130;
  run.enemies.push(createEnemy("beast", {
    id: "boss-" + bossIndex,
    name: ["草原の守護獣", "古代の巨兵", "深淵の王"][bossIndex],
    role: "boss",
    x: 790,
    y: 286,
    hp,
    maxHp: hp,
    moveSpeed: 42 + level,
    attackPower: 18 + level * 2,
    xpValue: 45 + level * 8,
    radius: 46,
    facing: -1,
    isBoss: true,
    bossIndex,
    state: ENEMY_STATE.APPROACH,
    stateTime: 0,
    attackCooldown: 1.5
  }));
  run.bossCounter += 1;
}

function addXp(run, amount) {
  const p = run.player;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = Math.floor(p.xpNext * 1.35 + 3);
    run.pendingLevelUps += 1;
    p.maxHp += 4;
    p.hp = Math.min(p.maxHp, p.hp + 12);
    p.attack += 1;
  }
}

function damageEnemy(run, enemy, damage) {
  if (!enemy.isAlive) return;
  enemy.hp -= damage;
  enemy.flashTime = 0.12;
  interruptEnemyWithHit(enemy);
  for (let i = 0; i < 5; i++) {
    run.particles.push({ x: enemy.x, y: enemy.y - 15, vx: rand(-80, 80), vy: rand(-100, -20), life: 0.25, maxLife: 0.25 });
  }
  if (enemy.hp <= 0) {
    enemy.isAlive = false;
    run.kills += 1;
    addXp(run, enemy.xpValue || 5);
    if (enemy.isBoss) {
      const outcome = defeatActiveBoss(run.stage, enemy.bossIndex);
      if (outcome.events.some(event => event.type === "stage-cleared")) {
        run.result = "cleared";
      }
    }
  }
}

export function setCombatInput(run, input) {
  if (!run || run.result || run.paused || run.pendingLevelUps > 0) return;
  const p = run.player;
  if (input.left) { p.vx = -235; p.facing = -1; }
  else if (input.right) { p.vx = 235; p.facing = 1; }
  else p.vx = 0;

  if (input.jump && p.onGround) {
    p.vy = -470;
    p.onGround = false;
  }
  if (input.attack && p.attackCooldown <= 0) {
    p.attackCooldown = 0.42;
    p.attackTime = 0.18;
    const reach = 78;
    for (const enemy of run.enemies) {
      if (!enemy.isAlive) continue;
      const dx = enemy.x - p.x;
      const dy = Math.abs((enemy.y - 20) - (p.y - 20));
      if (Math.abs(dx) < reach + (enemy.radius || 15) &&
          Math.sign(dx || p.facing) === p.facing && dy < (enemy.isBoss ? 90 : 65)) {
        damageEnemy(run, enemy, p.attack);
      }
    }
  }
}

function updateEnemy(run, enemy, dt) {
  if (!enemy.isAlive) return;
  const p = run.player;
  const dx = p.x - enemy.x;
  const direction = Math.sign(dx) || -1;
  enemy.facing = direction;
  enemy.stateTime += dt;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
  enemy.flashTime = Math.max(0, (enemy.flashTime || 0) - dt);

  if (enemy.id === "skeleton") {
    if (enemy.state === ENEMY_STATE.APPROACH && Math.abs(dx) < 310) {
      enemy.state = ENEMY_STATE.WARNING;
      enemy.stateTime = 0;
    } else if (enemy.state === ENEMY_STATE.WARNING && enemy.stateTime > 0.8) {
      enemy.state = ENEMY_STATE.ATTACK;
      enemy.stateTime = 0;
      run.projectiles.push({ x: enemy.x, y: enemy.y - 30, vx: direction * 270, vy: -45, damage: enemy.attackPower, fromEnemy: true, life: 2.8 });
    } else if (enemy.state === ENEMY_STATE.ATTACK && enemy.stateTime > 0.5) {
      enemy.state = ENEMY_STATE.RECOVER;
      enemy.stateTime = 0;
    } else if (enemy.state === ENEMY_STATE.RECOVER && enemy.stateTime > 1.1) {
      enemy.state = ENEMY_STATE.APPROACH;
      enemy.stateTime = 0;
    } else if (enemy.state === ENEMY_STATE.APPROACH) {
      enemy.x += direction * enemy.moveSpeed * dt;
    }
    return;
  }

  if (enemy.id === "hover" && enemy.state === ENEMY_STATE.APPROACH) {
    if (Math.abs(dx) < 260) {
      enemy.homeX = enemy.x;
      enemy.state = ENEMY_STATE.PAUSE;
      enemy.stateTime = 0;
    } else enemy.x += direction * enemy.moveSpeed * dt;
  } else if (enemy.state === ENEMY_STATE.PAUSE && enemy.stateTime > 0.65) {
    enemy.state = ENEMY_STATE.CHARGE;
    enemy.isCharging = true;
    enemy.stateTime = 0;
  } else if (enemy.state === ENEMY_STATE.CHARGE) {
    enemy.x += direction * enemy.moveSpeed * 3.2 * dt;
    if (Math.abs(dx) < 65 || enemy.stateTime > 1.2) {
      enemy.state = ENEMY_STATE.RETREAT;
      enemy.isCharging = false;
      enemy.stateTime = 0;
    }
  } else if (enemy.state === ENEMY_STATE.RETREAT) {
    const homeDirection = Math.sign(enemy.homeX - enemy.x);
    enemy.x += homeDirection * enemy.moveSpeed * 2.4 * dt;
    if (Math.abs(enemy.homeX - enemy.x) < 10) {
      enemy.x = enemy.homeX;
      enemy.state = ENEMY_STATE.APPROACH;
      enemy.stateTime = 0;
    }
  } else if (enemy.state === ENEMY_STATE.APPROACH) {
    if (enemy.isBoss && enemy.attackCooldown <= 0 && Math.abs(dx) < 260) {
      enemy.state = ENEMY_STATE.WINDUP;
      enemy.stateTime = 0;
    } else {
      enemy.x += direction * enemy.moveSpeed * dt;
    }
  } else if (enemy.state === ENEMY_STATE.WINDUP && enemy.stateTime > 0.75) {
    enemy.state = ENEMY_STATE.CHARGE;
    enemy.isCharging = true;
    enemy.stateTime = 0;
  } else if (enemy.state === ENEMY_STATE.CHARGE) {
    enemy.x += direction * enemy.moveSpeed * (enemy.isBoss ? 3.3 : 2.7) * dt;
    if (enemy.stateTime > 0.9) {
      enemy.state = ENEMY_STATE.RECOVER;
      enemy.isCharging = false;
      enemy.stateTime = 0;
      enemy.attackCooldown = enemy.isBoss ? 2.2 : 1.5;
    }
  } else if (enemy.state === ENEMY_STATE.RECOVER && enemy.stateTime > 0.65) {
    enemy.state = ENEMY_STATE.APPROACH;
    enemy.stateTime = 0;
  }

  if (canDealContactDamage(enemy) && enemy.attackCooldown <= 0 &&
      Math.abs(enemy.x - p.x) < (enemy.isBoss ? 58 : 30) &&
      Math.abs(enemy.y - p.y) < 65 && p.invulnerableTime <= 0) {
    p.hp -= enemy.attackPower;
    p.invulnerableTime = 0.65;
  }
}

export function tickCombat(run, dt) {
  if (!run || run.result || run.paused || run.pendingLevelUps > 0) return run;
  dt = clamp(dt, 0, 0.05);
  run.elapsedReal += dt;
  const p = run.player;
  p.x = clamp(p.x + p.vx * dt, 28, 872);
  p.vy += 1050 * dt;
  p.y += p.vy * dt;
  if (p.y >= 330) { p.y = 330; p.vy = 0; p.onGround = true; }
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.attackTime = Math.max(0, p.attackTime - dt);
  p.invulnerableTime = Math.max(0, p.invulnerableTime - dt);
  p.stamina = Math.min(p.maxStamina, p.stamina + 12 * dt);
  p.mp = Math.min(p.maxMp, p.mp + 1.5 * dt);

  const stageResult = advanceStage(run.stage, dt);
  for (const event of stageResult.events) {
    if (event.type === "boss-spawn") spawnBoss(run, event.bossIndex);
    if (event.type === "stage-defeated") run.result = "defeated";
  }

  run.spawnClock += dt;
  if (run.spawnClock >= Math.max(0.65, 1.8 - run.stage.stageNumber * 0.025) &&
      run.enemies.filter(enemy => enemy.isAlive && !enemy.isBoss).length < 9) {
    run.spawnClock = 0;
    spawnEnemy(run);
  }

  for (const enemy of run.enemies) updateEnemy(run, enemy, dt);

  for (const projectile of run.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.vy += 220 * dt;
    projectile.life -= dt;
    if (projectile.fromEnemy && Math.abs(projectile.x - p.x) < 22 &&
        Math.abs(projectile.y - (p.y - 25)) < 28 && p.invulnerableTime <= 0) {
      p.hp -= projectile.damage;
      p.invulnerableTime = 0.65;
      projectile.life = 0;
    }
  }
  run.projectiles = run.projectiles.filter(projectile => projectile.life > 0 && projectile.x > -40 && projectile.x < 940);
  run.enemies = run.enemies.filter(enemy => enemy.isAlive);
  run.particles = run.particles.filter(particle => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 360 * dt;
    particle.life -= dt;
    return particle.life > 0;
  });

  if (p.hp <= 0) run.result = "defeated";
  return run;
}

export function chooseLevelUp(run, choice) {
  const upgrades = {
    power: () => { run.player.attack += 3; },
    vitality: () => { run.player.maxHp += 20; run.player.hp = Math.min(run.player.maxHp, run.player.hp + 20); },
    haste: () => { run.player.attackCooldown = Math.max(0.18, run.player.attackCooldown - 0.04); run.player.stamina = run.player.maxStamina; }
  };
  if (!upgrades[choice] || run.pendingLevelUps <= 0) return false;
  upgrades[choice]();
  run.pendingLevelUps -= 1;
  return true;
}

export function drawCombat(ctx, run, width = 900, height = 440) {
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#182f50");
  gradient.addColorStop(1, "#6a805e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#314e43";
  ctx.beginPath();
  ctx.moveTo(0, 305); ctx.lineTo(180, 205); ctx.lineTo(390, 295);
  ctx.lineTo(610, 190); ctx.lineTo(900, 300); ctx.lineTo(900, 440); ctx.lineTo(0, 440);
  ctx.fill();

  ctx.fillStyle = "#4b4938";
  ctx.fillRect(0, 385, width, 55);
  ctx.fillStyle = "#77704e";
  for (let x = 0; x < width; x += 48) ctx.fillRect(x, 385, 25, 4);

  for (const enemy of run.enemies) {
    if (!enemy.isAlive) continue;
    const boss = enemy.isBoss;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.flashTime > 0 ? "#fff" : boss ? "#9d4260" : enemy.id === "skeleton" ? "#d5d2c2" : enemy.id === "hover" ? "#7bc4db" : enemy.id === "goblin" ? "#7d9b55" : "#a56a45";
    ctx.strokeStyle = "#18202b"; ctx.lineWidth = boss ? 5 : 3;
    ctx.beginPath();
    ctx.ellipse(0, boss ? -35 : -19, boss ? 42 : enemy.radius || 15, boss ? 42 : 21, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f8e9c2";
    ctx.fillRect(-8, boss ? -49 : -25, 5, 5);
    ctx.fillRect(5, boss ? -49 : -25, 5, 5);
    if (boss) {
      ctx.fillStyle = "#221a27"; ctx.fillRect(-48, -94, 96, 8);
      ctx.fillStyle = "#f05265"; ctx.fillRect(-48, -94, 96 * Math.max(0, enemy.hp / enemy.maxHp), 8);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(enemy.name, 0, -103);
    }
    ctx.restore();
  }

  for (const projectile of run.projectiles) {
    ctx.fillStyle = "#f3d27a";
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const particle of run.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = "#ffe29a"; ctx.fillRect(particle.x, particle.y, 4, 4);
    ctx.globalAlpha = 1;
  }

  const p = run.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnerableTime > 0 && Math.floor(run.elapsedReal * 18) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#d6a36c"; ctx.strokeStyle = "#1a2029"; ctx.lineWidth = 3;
  ctx.fillRect(-12, -54, 24, 26); ctx.strokeRect(-12, -54, 24, 26);
  ctx.fillStyle = "#365d91"; ctx.fillRect(-14, -28, 28, 25); ctx.strokeRect(-14, -28, 28, 25);
  ctx.fillStyle = "#503b32"; ctx.fillRect(-12, -4, 10, 8); ctx.fillRect(2, -4, 10, 8);
  ctx.fillStyle = "#f0d6a9"; ctx.fillRect(p.facing > 0 ? 2 : -8, -47, 4, 4);
  ctx.strokeStyle = "#dfe7f2"; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.facing * 10, -25);
  ctx.lineTo(p.facing * (p.attackTime > 0 ? 62 : 26), p.attackTime > 0 ? -50 : -13);
  ctx.stroke();
  ctx.restore();

  const seconds = Math.floor(run.stage.elapsedSeconds);
  const time = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("STAGE " + run.stage.stageNumber + "  " + time, 18, 28);
  ctx.textAlign = "right"; ctx.fillText("BOSS " + run.stage.defeatedBosses.length + "/3", width - 18, 28);
}

export function getCombatStatus(run) {
  return {
    hp: Math.max(0, run.player.hp),
    maxHp: run.player.maxHp,
    mp: run.player.mp,
    maxMp: run.player.maxMp,
    stamina: run.player.stamina,
    maxStamina: run.player.maxStamina,
    xp: run.player.xp,
    xpNext: run.player.xpNext,
    level: run.player.level,
    kills: run.kills,
    elapsedSeconds: run.stage.elapsedSeconds,
    status: run.result || run.stage.status,
    bossesDefeated: run.stage.defeatedBosses.length,
    pendingLevelUps: run.pendingLevelUps
  };
}
