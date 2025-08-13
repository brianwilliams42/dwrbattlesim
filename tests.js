import assert from 'node:assert';
import {
  computeDamage,
  castBreathAttack,
  castHurtSpell,
  mitigateDamage,
  simulateBattle,
  simulateMany,
  simulateRepeated,
  healBetweenFights,
  baseMaxDamage,
  simulateZone,
} from './simulator.js';
import LZString from 'lz-string';
const { compressToBase64, decompressFromBase64 } = LZString;

function averageDamage(attack, defense) {
  const maxDamage = baseMaxDamage(attack, defense);
  const minQ = Math.floor((maxDamage / 2) * 4);
  const maxQ = Math.floor(maxDamage * 4);
  const n = maxQ - minQ + 1;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const rng = () => (i + 0.5) / n;
    total += computeDamage(attack, defense, rng);
  }
  return total / n;
}

const avg = averageDamage(130, 100);
assert(Math.abs(avg - 10.875) < 0.01);

console.log('computeDamage average test passed');

// When hero attack is less than monster defense + 2, damage is 0 or 1
{
  const lowAttack = 5;
  const highDefense = 10;
  const dmgLow = computeDamage(lowAttack, highDefense, () => 0.49, true);
  const dmgHigh = computeDamage(lowAttack, highDefense, () => 0.5, true);
  assert.strictEqual(dmgLow, 0);
  assert.strictEqual(dmgHigh, 1);
  console.log('hero weak attack damage test passed');
}

const counts = {};
for (let i = 0; i < 8; i++) {
  const rng = () => (i + 0.5) / 8;
  const dmg = mitigateDamage(castBreathAttack('big', rng));
  counts[dmg] = (counts[dmg] || 0) + 1;
}
assert.deepStrictEqual(counts, { 42: 1, 44: 3, 46: 3, 48: 1 });
console.log('big breath mitigation distribution test passed');

// Zone grind basic XP per minute
{
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 10,
    mp: 1,
    spells: [],
    armor: 'none',
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 1,
    defense: 0,
    agility: 0,
    xp: 10,
  };
  const monsters = [monster, monster, monster, monster, monster];
  const result = simulateZone(hero, monsters, 8, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    maxMinutes: 0.1,
  }, 2);
  assert(result.xpGained > 0);
  assert(result.log[0].startsWith('Encountered'));
  assert(/Hero has \d+ HP and \d+ MP\./.test(result.log[0]));
  console.log('zone grind basic test passed');
}

// Zone grind repel skips weak enemies
{
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 100,
    strength: 100,
    defense: 20,
    agility: 10,
    mp: 2,
    spells: ['REPEL'],
    armor: 'none',
  };
  const weak = {
    name: 'Weak',
    hp: 1,
    attack: 10,
    defense: 0,
    agility: 0,
    xp: 5,
  };
  const monsters = [weak, weak, weak, weak, weak];
  const result = simulateZone(hero, monsters, 8, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    repelTime: 0,
    maxMinutes: 0.05,
  });
  assert.strictEqual(result.xpGained, 0);
  assert.strictEqual(result.mpSpent, 2);
  assert.strictEqual(result.log[0], 'Hero casts REPEL.');
  assert(result.log.includes('Weak was repelled.'));
  console.log('zone grind repel test passed');
}

// Zone grind heals based on strongest monster
{
  const seq = [0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0.5;
  const hero = {
    hp: 35,
    maxHp: 50,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 10,
    mp: 50,
    spells: ['HEAL'],
    armor: 'none',
  };
  const weak = { name: 'Weak', hp: 1, attack: 30, defense: 0, agility: 0, xp: 0 };
  const strong = { name: 'Strong', hp: 1, attack: 40, defense: 0, agility: 0, xp: 0 };
  const result = simulateZone(hero, [weak, strong], 1, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroCriticalTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    healSpellTime: 0,
    framesBetweenFights: 0,
    tileFrames: 1,
    maxMinutes: 1 / 3600,
  });
  Math.random = orig;
  assert(result.log.some((l) => l.startsWith('Hero casts HEAL')));
  console.log('zone grind heal between fights test passed');
}

// Zone grind ends when MP too low
{
  const seq = [0, 0, 0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 50,
    attack: 100,
    strength: 50,
    defense: 0,
    agility: 10,
    mp: 4,
    spells: ['HEAL'],
    armor: 'none',
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 20,
    defense: 0,
    agility: 0,
    xp: 0,
  };
  const result = simulateZone(hero, [monster], 1, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroCriticalTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    healSpellTime: 0,
    framesBetweenFights: 0,
    tileFrames: 1,
    maxMinutes: 1,
  });
  Math.random = orig;
  assert(
    result.log.includes('Hero abandons the grind with 28 HP and 1 MP.'),
  );
  console.log('zone grind low MP end test passed');
}

// Zone grind ends when time limit reached
{
  const seq = [0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 10,
    mp: 0,
    spells: [],
    armor: 'none',
  };
  const monster = { name: 'Slime', hp: 1, attack: 0, defense: 0, agility: 0, xp: 0 };
  const result = simulateZone(hero, [monster], 1, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroCriticalTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    framesBetweenFights: 0,
    tileFrames: 60,
    maxMinutes: 1 / 3600,
  });
  Math.random = orig;
  assert(result.log.includes('Time limit reached.'));
  console.log('zone grind time limit test passed');
}

// Repeated grind ends when MP too low
{
  const seq = [0, 0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 50,
    attack: 100,
    strength: 50,
    defense: 0,
    agility: 10,
    mp: 4,
    spells: ['HEAL'],
    armor: 'none',
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 20,
    defense: 0,
    agility: 0,
    xp: 0,
  };
  const result = simulateRepeated(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroCriticalTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    healSpellTime: 0,
    framesBetweenFights: 0,
  });
  Math.random = orig;
  assert(result.log.includes('Hero abandons the grind with 28 HP and 1 MP.'));
  console.log('repeated grind low MP end test passed');
}

// Hero run success ends battle
{
  const seq = [0, 0, 0.8, 0.1];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 0,
    defense: 0,
    agility: 5,
  };
  const monster = {
    name: 'Test',
    hp: 10,
    attack: 0,
    defense: 0,
    agility: 5,
    group: 4,
    runFrom: true,
    xp: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroRunSuccessTime: 40,
    heroRunFailTime: 150,
    enemyAttackTime: 0,
  });
  Math.random = orig;
  assert.strictEqual(result.winner, 'hero_fled');
  assert.strictEqual(result.timeFrames, 40);
  console.log('hero run success test passed');
}

// Monster ambush flee preserves hero HP
{
  const seq = [0, 0.5, 0.1];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 20,
    maxHp: 20,
    strength: 50,
    attack: 40,
    defense: 0,
    agility: 5,
  };
  const monster = {
    name: 'Coward',
    hp: 10,
    attack: 20,
    defense: 0,
    agility: 5,
    xp: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    ambushTime: 0,
    enemyAttackTime: 0,
    monsterFleeTime: 0,
  });
  Math.random = orig;
  assert.deepStrictEqual(result.log, ['Coward ambushes!', 'Coward runs away!']);
  assert.strictEqual(result.heroHp, 20);
  console.log('monster ambush flee heroHp test passed');
}

// Monster HURT and HURTMORE damage is even after mitigation
{
  const hurtSet = new Set();
  for (let i = 0; i < 8; i++) {
    const rng = () => (i + 0.5) / 8;
    const dmg = mitigateDamage(castHurtSpell('HURT', 0, 'monster', rng));
    hurtSet.add(dmg);
  }
  assert.deepStrictEqual([...hurtSet].sort((a, b) => a - b), [2, 4, 6]);
  const hurtmoreSet = new Set();
  for (let i = 0; i < 16; i++) {
    const rng = () => (i + 0.5) / 16;
    const dmg = mitigateDamage(castHurtSpell('HURTMORE', 0, 'monster', rng));
    hurtmoreSet.add(dmg);
  }
  assert.deepStrictEqual(
    [...hurtmoreSet].sort((a, b) => a - b),
    [20, 22, 24, 26, 28, 30],
  );
  console.log('monster hurt spell mitigation test passed');
}
// Fairy Flute forces the Golem to sleep for one turn and gives a 33% wake chance afterward
{
  const seq = [0, 0, 0, 0.2, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 1,
    maxHp: 1,
    attack: 0,
    strength: 50,
    defense: 0,
    agility: 50,
    mp: 0,
    armor: 'none',
    fairyFlute: true,
  };
  const golem = { name: 'Golem', hp: 5, attack: 10, defense: 0, agility: 10, xp: 0 };
  const result = simulateBattle(hero, golem);
  Math.random = orig;
  assert.strictEqual(result.log[0], 'Hero plays the Fairy Flute!');
  assert(result.log.includes('Golem is asleep.'));
  assert(result.log.includes('Golem wakes up.'));
  console.log('fairy flute wake logic test passed');
}

// Sleep spell works like Fairy Flute and respects wake chance
{
  const seq = [0, 0, 0, 0, 0.2, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 1,
    maxHp: 1,
    attack: 0,
    strength: 50,
    defense: 0,
    agility: 50,
    mp: 10,
    spells: ['SLEEP'],
    armor: 'none',
  };
  const monster = { name: 'Golem', hp: 5, attack: 10, defense: 0, agility: 10, xp: 0 };
  const result = simulateBattle(hero, monster);
  Math.random = orig;
  assert.strictEqual(result.log[0], 'Hero casts SLEEP. Golem falls asleep.');
  assert(result.log.includes('Golem is asleep.'));
  assert(result.log.includes('Golem wakes up.'));
  console.log('sleep spell wake logic test passed');
}

// Sleep spell respects monster sleep resistance
{
  const seq = [0, 0, 0.4];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0.6;
  const hero = {
    hp: 1,
    maxHp: 1,
    attack: 0,
    strength: 0,
    defense: 0,
    agility: 0,
    mp: 10,
    spells: ['SLEEP'],
    armor: 'none',
  };
  const monster = {
    name: 'Slime',
    hp: 5,
    attack: 10,
    defense: 0,
    agility: 0,
    xp: 0,
    sleepResist: 0.5,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    heroSleepStopspellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert(result.log.includes('Hero casts SLEEP, but it fails.'));
  console.log('sleep resist test passed');
}

// Stopspell prevents enemy spells and uses a fixed casting time when blocked
// (165 frames by default)
{
  const seq = [0, 0, 0.5, 0.3, 0.99, 0.99, 0.5, 0.5, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 100,
    strength: 0,
    defense: 0,
    agility: 50,
    mp: 10,
    spells: ['STOPSPELL'],
    armor: 'none',
  };
  const monster = {
    name: 'Mage',
    hp: 60,
    attack: 1,
    defense: 0,
    agility: 10,
    xp: 0,
    supportAbility: 'sleep',
    supportChance: 1,
    stopspellResist: 1 / 16,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    heroSleepStopspellTime: 1,
    enemySpellTime: 70,
    enemyAttackTime: 1,
    enemyBreathTime: 1,
    enemyStopspelledSpellTime: 165,
  });
  Math.random = orig;
  assert(result.log.includes('Hero casts STOPSPELL. Mage is affected.'));
  assert(result.log.includes('Mage tries to cast SLEEP, but is stopspelled.'));
  console.log('stopspell logic test passed');
}

// Hero always acts before the monster after any ambush check
{
  const seq = [0.99, 0, 0.5, 0.99, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 1,
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 100,
    defense: 0,
    agility: 200,
    xp: 0,
    dodge: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert.strictEqual(result.log[0], 'Hero attacks for 25 damage.');
  assert.strictEqual(result.winner, 'hero');
  console.log('hero first turn order test passed');
}

// Hero casts HURTMORE again when a physical attack cannot guarantee a kill
{
  const seq = [0, 0, 0, 0.25, 0, 0.5, 0.5, 0.99];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 20,
    strength: 0,
    defense: 0,
    agility: 10,
    mp: 10,
    spells: ['HURTMORE'],
    armor: 'none',
  };
  const monster = {
    name: 'Tanky',
    hp: 70,
    maxHp: 70,
    attack: 1,
    defense: 0,
    agility: 0,
    xp: 0,
    dodge: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  const hurtmoreCasts = result.log.filter((l) =>
    l.startsWith('Hero casts HURTMORE'),
  ).length;
  assert.strictEqual(hurtmoreCasts, 2);
  assert.strictEqual(result.mpSpent, 10);
  console.log(
    'second hurtmore used when physical attack is not a guaranteed kill test passed',
  );
}

// Hero uses HURTMORE to guarantee a kill even if physical has higher average damage
{
  const seq = [0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 180,
    strength: 0,
    defense: 0,
    agility: 10,
    mp: 5,
    spells: ['HURTMORE'],
    armor: 'none',
  };
  const monster = {
    name: 'Average',
    hp: 50,
    maxHp: 50,
    attack: 1,
    defense: 0,
    agility: 0,
    xp: 0,
    dodge: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert(result.log[0].startsWith('Hero casts HURTMORE'));
  console.log('hurtmore chosen over higher average attack test passed');
}

// Hero casts HURTMORE again despite resist chance when using default dodge rate risk factor
{
  const seq = [0, 0, 0.6, 0, 0.99, 0.6, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 50,
    maxHp: 100,
    attack: 10,
    strength: 0,
    defense: 0,
    agility: 10,
    mp: 16,
    spells: ['HURTMORE', 'HEALMORE'],
    armor: 'none',
  };
  const monster = {
    name: 'Resister',
    hp: 70,
    maxHp: 70,
    attack: 80,
    defense: 0,
    agility: 0,
    xp: 0,
    dodge: 0,
    hurtResist: 0.5,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  const hurtmoreCasts = result.log.filter((l) =>
    l.startsWith('Hero casts HURTMORE'),
  ).length;
  const healmoreCasts = result.log.filter((l) =>
    l.startsWith('Hero casts HEALMORE'),
  ).length;
  assert.strictEqual(hurtmoreCasts, 2);
  assert.strictEqual(healmoreCasts, 0);
  console.log(
    'second hurtmore used despite hurt resist when risk factor is default test passed',
  );
}

// When low on HP, hero heals if a killing blow is not guaranteed
{
  const seq = [0, 0, 0, 0.5, 0.99];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 20,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 10,
    mp: 3,
    spells: ['HEAL'],
    armor: 'none',
  };
  const monster = {
    name: 'Finisher',
    hp: 40,
    maxHp: 40,
    attack: 120,
    defense: 0,
    agility: 10,
    xp: 0,
    dodge: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert(result.log[0].startsWith('Hero casts HEAL'));
  console.log('hero heals instead of attacking when kill is not guaranteed test passed');
}

// Hero heals instead of risking a high dodge or resist rate
{
  const seq = [0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 20,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 10,
    mp: 10,
    spells: ['HEAL'],
    armor: 'none',
  };
  const monster = {
    name: 'Dodgy',
    hp: 40,
    maxHp: 40,
    attack: 120,
    defense: 0,
    agility: 10,
    xp: 0,
    dodge: 15,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    dodgeRateRiskFactor: 0.1,
  });
  Math.random = orig;
  assert(result.log[0].startsWith('Hero casts HEAL'));
  console.log('hero heals when attack dodge rate exceeds threshold test passed');
}

// Hero critical hits deal 50%-100% of attack and have configurable extra time
{
  const seq = [0, 0, 0.5, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 64, strength: 64, defense: 0, agility: 0 };
  const monster = {
    name: 'Dummy',
    hp: 30,
    attack: 0,
    defense: 999,
    agility: 0,
    xp: 0,
    dodge: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroCriticalTime: 2,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert.strictEqual(result.log[0], 'Hero performs a critical hit for 48 damage.');
  assert.strictEqual(result.timeFrames, 3);
  console.log('hero critical hit test passed');
}

// Ambush uses full monster turn logic including support abilities
{
  const seq = [0, 0.99, 0.5, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 50, defense: 0, agility: 10 };
  const monster = {
    name: 'Mage',
    hp: 10,
    attack: 10,
    defense: 0,
    agility: 10,
    xp: 0,
    supportAbility: 'sleep',
    supportChance: 1,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert.strictEqual(result.log[0], 'Mage ambushes!');
  assert.strictEqual(result.log[1], 'Mage casts SLEEP.');
  assert(result.log.includes('Hero is asleep.'));
  console.log('ambush support ability test passed');
}

// Monster fleeing during an ambush ends the battle before hero acts
  {
    const seq = [0, 0.99, 0];
    let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 20, defense: 0, agility: 10 };
  const monster = {
    name: 'Runner',
    hp: 10,
    attack: 10,
    defense: 0,
    agility: 10,
    xp: 5,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert.deepStrictEqual(result.log, ['Runner ambushes!', 'Runner runs away!']);
  assert.strictEqual(result.winner, 'fled');
  assert.strictEqual(result.rounds, 0);
  assert.strictEqual(result.timeFrames, 150);
  console.log('ambush flee logic test passed');
  }

  // Hero sleep time is configurable
  {
    const seq = [0, 0.5, 0, 0];
    let i = 0;
    const orig = Math.random;
    Math.random = () => seq[i++] ?? 0;
    const hero = {
      hp: 1,
      maxHp: 1,
      attack: 0,
      strength: 0,
      defense: 0,
      agility: 0,
    };
    const monster = {
      name: 'Mage',
      hp: 1,
      attack: 100,
      defense: 0,
      agility: 10,
      xp: 0,
      supportAbility: 'sleep',
      supportChance: 1,
    };
    const result = simulateBattle(hero, monster, {
      preBattleTime: 0,
      postBattleTime: 0,
      heroAttackTime: 0,
      heroSpellTime: 0,
      heroSleepStopspellTime: 0,
      heroSleepTime: 7,
      herbTime: 0,
      herbBetweenTime: 0,
      fairyWaterTime: 0,
      fairyFluteTime: 0,
      healSpellTime: 0,
      enemyAttackTime: 0,
      enemyHurtSpellTime: 0,
      enemyHealSpellTime: 0,
      enemySpellTime: 0,
      enemyBreathTime: 0,
      enemyDodgeTime: 0,
      enemySleepTime: 0,
      framesBetweenFights: 0,
      ambushTime: 0,
      monsterFleeTime: 0,
    });
    Math.random = orig;
    assert.strictEqual(result.timeFrames, 7);
    assert(result.log.includes('Hero is asleep.'));
    console.log('hero sleep time test passed');
  }

// Metal Slime ambush flee ends battle without hero action
{
  const seq = [0, 0.99, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 50,
    strength: 50,
    defense: 40,
    agility: 30,
    mp: 0,
  };
  const monster = {
    name: 'Metal Slime',
    hp: 3,
    attack: 10,
    defense: 127,
    agility: 255,
    xp: 255,
    hurtResist: 15,
    dodge: 1,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert.deepStrictEqual(result.log, ['Metal Slime ambushes!', 'Metal Slime runs away!']);
  assert.strictEqual(result.winner, 'fled');
  assert.strictEqual(result.rounds, 0);
  console.log('metal slime ambush flee test passed');
}
// simulateMany returns average battle time in seconds
{
  const seq = [0.5, 0, 0, 0.5, 0.5, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 100, strength: 100, defense: 0, agility: 10 };
  const monster = { name: 'Slime', hp: 1, attack: 0, defense: 0, agility: 0, xp: 0 };
  const summary = simulateMany(
    hero,
    monster,
    {
      preBattleTime: 0,
      postBattleTime: 0,
      heroAttackTime: 1,
      heroSpellTime: 1,
      enemyAttackTime: 1,
      enemySpellTime: 1,
      enemyBreathTime: 1,
      enemyDodgeTime: 1,
    },
    1,
  );
  Math.random = orig;
  assert(Math.abs(summary.averageTimeSeconds - 1 / 60) < 1e-9);
  console.log('average time reporting test passed');
}

// simulateMany tracks hero wins, monster wins, and monster flees
{
  const orig = Math.random;
  Math.random = () => 0;
  const settings = {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  };
  const heroWinSummary = simulateMany(
    { hp: 10, attack: 50, strength: 5, defense: 0, agility: 10 },
    { name: 'Slime', hp: 1, attack: 10, defense: 0, agility: 0, xp: 0, dodge: 0 },
    settings,
    1,
  );
  assert.strictEqual(heroWinSummary.winRate, 1);
  assert.strictEqual(heroWinSummary.monsterWinRate, 0);
  assert.strictEqual(heroWinSummary.monsterFleeRate, 0);

  const monsterWinSummary = simulateMany(
    { hp: 1, attack: 0, strength: 0, defense: 0, agility: 10 },
    { name: 'Drakee', hp: 10, attack: 20, defense: 0, agility: 0, xp: 0, dodge: 0 },
    settings,
    1,
  );
  assert.strictEqual(monsterWinSummary.winRate, 0);
  assert.strictEqual(monsterWinSummary.monsterWinRate, 1);
  assert.strictEqual(monsterWinSummary.monsterFleeRate, 0);

  const fleeSummary = simulateMany(
    { hp: 10, attack: 0, strength: 20, defense: 0, agility: 10 },
    { name: 'Ghost', hp: 10, attack: 5, defense: 0, agility: 0, xp: 0, dodge: 0 },
    settings,
    1,
  );
  Math.random = orig;
  assert.strictEqual(fleeSummary.winRate, 0);
  assert.strictEqual(fleeSummary.monsterWinRate, 0);
  assert.strictEqual(fleeSummary.monsterFleeRate, 1);
  console.log('simulateMany outcome rate tests passed');
}

// Monsters only heal when below 25% HP and healing is capped
{
  const seq = [0, 0, 0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 50, defense: 0, agility: 10 };
  const monster = {
    name: 'Healer',
    hp: 25,
    maxHp: 100,
    attack: 50,
    defense: 0,
    agility: 10,
    xp: 0,
    supportAbility: 'heal',
    supportChance: 1,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert(!result.log.includes('Healer casts HEAL'));
  console.log('monster heal threshold (no heal) test passed');
}

{
  const seq = [0, 0, 0, 0, 0, 0.99, 0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 1, maxHp: 1, attack: 0, strength: 50, defense: 0, agility: 10 };
  const monster = {
    name: 'Healer',
    hp: 20,
    maxHp: 100,
    attack: 50,
    defense: 0,
    agility: 10,
    xp: 0,
    supportAbility: 'healmore',
    supportChance: 1,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert(result.log.includes('Healer casts HEALMORE and heals 80 HP.'));
  console.log('monster heal threshold (heal and cap) test passed');
}

// Hero healing is capped at maximum HP
{
  const seq = [0, 0.5, 0, 0, 0.99];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
    maxHp: 100,
    attack: 0,
    strength: 200,
    defense: 0,
    agility: 0,
    mp: 8,
    spells: ['HEALMORE'],
    armor: 'none',
  };
  const monster = {
    name: 'BadGuy',
    hp: 2,
    maxHp: 2,
    attack: 300,
    defense: 0,
    agility: 1,
    xp: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 1,
    heroSpellTime: 1,
    enemyAttackTime: 1,
    enemySpellTime: 1,
    enemyBreathTime: 1,
    enemyDodgeTime: 1,
  });
  Math.random = orig;
  assert(result.log.includes('Hero casts HEALMORE and heals 75 HP.'));
  console.log('hero heal cap test passed');
}

// Monster may flee if the hero's strength is at least twice its attack
{
  const seq = [0, 0, 0.5, 0.5, 0, 0.1];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 20, defense: 0, agility: 10 };
  const monster = { name: 'Runner', hp: 10, attack: 10, defense: 0, agility: 10, xp: 5 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 200,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert.strictEqual(result.winner, 'fled');
  assert.strictEqual(result.timeFrames, 100);
  assert(result.log.includes('Runner runs away!'));
  console.log('monster flee test passed');
}

// Hero uses an herb when no healing spells are available
{
  const seq = [0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 1, strength: 50, defense: 0, agility: 0, herbs: 1 };
  const monster = { name: 'Slime', hp: 1, attack: 40, defense: 0, agility: 0, xp: 0 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    dodgeRateRiskFactor: 0.01,
  });
  Math.random = orig;
  assert(result.log.includes('Hero uses an herb and heals 0 HP.'));
  assert.strictEqual(result.herbsUsed, 1);
  console.log('herb usage test passed');
}

// Herb usage time is configurable
{
  const seq = [0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 1, strength: 50, defense: 0, agility: 0, herbs: 1 };
  const monster = { name: 'Slime', hp: 1, attack: 40, defense: 0, agility: 0, xp: 0 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    herbTime: 5,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    dodgeRateRiskFactor: 0.01,
  });
  Math.random = orig;
  assert.strictEqual(result.timeFrames, 5);
  console.log('herb timing test passed');
}

// Herb usage between fights time is configurable
{
  const hero = { hp: 5, maxHp: 10, herbs: 1, defense: 0, armor: 'none' };
  const monster = { attack: 200, defense: 0 };
  const orig = Math.random;
  Math.random = () => 0;
  const result = healBetweenFights(hero, monster, {
    healSpellTime: 0,
    herbBetweenTime: 5,
    framesBetweenFights: 0,
  });
  Math.random = orig;
  assert.strictEqual(result.frames, 5);
  assert.strictEqual(result.herbsUsed, 1);
  console.log('herb between fights timing test passed');
}

// Herb is not used when HEAL is available and affordable
{
  const seq = [0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 1,
    strength: 50,
    defense: 0,
    agility: 0,
    mp: 3,
    spells: ['HEAL'],
    herbs: 1,
  };
  const monster = { name: 'Slime', hp: 1, attack: 40, defense: 0, agility: 0, xp: 0 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    dodgeRateRiskFactor: 0.01,
  });
  Math.random = orig;
  assert(result.log.some((l) => l.startsWith('Hero casts HEAL')));
  assert.strictEqual(result.herbsUsed, 0);
  console.log('herb spell priority test passed');
}

// Hero uses Fairy Water for damage
{
  const seq = [0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 50, defense: 0, agility: 0, fairyWater: 1 };
  const monster = { name: 'Slime', hp: 9, attack: 0, defense: 0, agility: 0, xp: 0 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert(result.log.includes('Hero uses Fairy Water for 9 damage.'));
  assert.strictEqual(result.fairyWatersUsed, 1);
  console.log('fairy water usage test passed');
}

// Fairy Water usage time is configurable
{
  const seq = [0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, maxHp: 10, attack: 0, strength: 50, defense: 0, agility: 0, fairyWater: 1 };
  const monster = { name: 'Slime', hp: 9, attack: 0, defense: 0, agility: 0, xp: 0 };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    fairyWaterTime: 7,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert.strictEqual(result.timeFrames, 7);
  console.log('fairy water timing test passed');
}

// Fairy Water does 0 or 1 damage to Metal Slimes
{
  const seq = [0, 0, 0, 0.5, 0, 0.75];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 2,
    strength: 50,
    defense: 0,
    agility: 0,
    fairyWater: 2,
  };
  const monster = {
    name: 'Metal Slime',
    hp: 1,
    attack: 0,
    defense: 0,
    agility: 0,
    xp: 0,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
  });
  Math.random = orig;
  assert(result.log.includes('Hero uses Fairy Water for 0 damage.'));
  assert(result.log.includes('Hero uses Fairy Water for 1 damage.'));
  assert.strictEqual(result.fairyWatersUsed, 2);
  console.log('metal slime fairy water test passed');
}

// simulateRepeated logs hero HP at start of each fight
{
  const hero = {
    hp: 10,
    maxHp: 10,
    attack: 0,
    strength: 0,
    defense: 0,
    agility: 0,
  };
  const monster = {
    name: 'Slime',
    hp: 5,
    attack: 100,
    defense: 0,
    agility: 0,
    xp: 0,
  };
  const result = simulateRepeated(
    hero,
    monster,
    {
      preBattleTime: 0,
      postBattleTime: 0,
      framesBetweenFights: 0,
      herbBetweenTime: 0,
    },
    1,
  );
  assert.strictEqual(result.log[0], 'Starting fight against Slime (10 HP).');
  console.log('starting fight log hero HP test passed');
}

// simulateRepeated reports average time per life in seconds
{
  const seq = [0, 0.5, 0.5, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 1,
    maxHp: 1,
    attack: 0,
    strength: 0,
    defense: 0,
    agility: 0,
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 100,
    defense: 0,
    agility: 1,
    xp: 0,
  };
  const result = simulateRepeated(
    hero,
    monster,
    {
      preBattleTime: 60,
      postBattleTime: 0,
      enemyAttackTime: 0,
      enemySpellTime: 0,
      enemyBreathTime: 0,
      enemyDodgeTime: 0,
      heroAttackTime: 0,
      heroSpellTime: 0,
      herbTime: 0,
      fairyWaterTime: 0,
      framesBetweenFights: 0,
      herbBetweenTime: 0,
    },
    1,
  );
  Math.random = orig;
  assert(Math.abs(result.averageTimeSeconds - 110 / 60) < 1e-9);
  assert.strictEqual(result.timeFrames, 110);
  console.log('repeated battle average time test passed');
}

// simulateRepeated reports XP per minute including refill time
{
  const hero = {
    hp: 1,
    maxHp: 1,
    attack: 0,
    strength: 0,
    defense: 0,
    agility: 0,
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 100,
    defense: 0,
    agility: 1,
    xp: 1,
  };
  const result = simulateRepeated(
    hero,
    monster,
    {
      preBattleTime: 60,
      postBattleTime: 0,
      enemyAttackTime: 0,
      enemySpellTime: 0,
      enemyBreathTime: 0,
      enemyDodgeTime: 0,
      framesBetweenFights: 0,
      herbBetweenTime: 0,
      refillTimeSeconds: 75,
    },
    1,
  );
  assert.strictEqual(result.averageXPPerMinuteWithRefill, 0);
  console.log('repeated battle xp/min with refill test passed');
}

// simulateBattle preserves hero's max HP between fights
{
  const seq = [0, 0, 0, 0, 0.5, 0.5, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 50,
    maxHp: 100,
    attack: 200,
    strength: 200,
    defense: 0,
    agility: 100,
    mp: 8,
    spells: ['HEALMORE'],
  };
  const monster = {
    name: 'Slime',
    hp: 1,
    attack: 200,
    defense: 0,
    agility: 0,
    xp: 0,
    dodge: 1,
  };
  const result = simulateBattle(hero, monster, {
    preBattleTime: 0,
    postBattleTime: 0,
    heroAttackTime: 0,
    heroSpellTime: 0,
    enemyAttackTime: 0,
    enemySpellTime: 0,
    enemyBreathTime: 0,
    enemyDodgeTime: 0,
    dodgeRateRiskFactor: 0.01,
  });
  Math.random = orig;
  assert(result.log.includes('Hero casts HEALMORE and heals 50 HP.'));
  assert.strictEqual(result.winner, 'hero');
  console.log('max HP healing test passed');
}

// URL encoding length and readability tests
function toBase64Url(str) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}

const fieldOrder = [
  'hero-hp',
  'hero-strength',
  'hero-weapon',
  'hero-fighters-ring',
  'hero-death-necklace',
  'hero-defense',
  'hero-agility',
  'hero-mp',
  'hero-herbs',
  'hero-fairy-water',
  'hero-hurt',
  'hero-hurtmore',
  'hero-heal',
  'hero-healmore',
  'hero-stopspell',
  'hero-armor',
  'hero-flute',
  'enemy-select',
  'use-preset',
  'mon-hp',
  'mon-attack',
  'mon-defense',
  'mon-agility',
  'hurt-resist',
  'mon-dodge',
  'mon-xp',
  'stopspell-resist',
  'mon-support',
  'mon-support-chance',
  'mon-attack-ability',
  'mon-attack-chance',
  'hero-attack-time',
  'hero-spell-time',
  'hero-sleep-stopspell-time',
  'hero-sleep-time',
  'hero-critical-time',
  'herb-time',
  'fairy-water-time',
  'fairy-flute-time',
  'herb-between-time',
  'heal-spell-time',
  'enemy-attack-time',
  'enemy-hurt-spell-time',
  'enemy-heal-spell-time',
  'enemy-stopspelled-spell-time',
  'enemy-spell-time',
  'enemy-breath-time',
  'enemy-dodge-time',
  'enemy-sleep-time',
  'pre-battle-time',
  'ambush-time',
  'monster-flee-time',
  'post-battle-time',
  'frames-between-fights',
  'refill-seconds',
  'sim-mode',
  'iterations',
];

const sampleParams = {
  'hero-hp': '100',
  'hero-strength': '50',
  'hero-weapon': '0',
  'hero-fighters-ring': 0,
  'hero-death-necklace': 0,
  'hero-defense': '40',
  'hero-agility': '30',
  'hero-mp': '50',
  'hero-herbs': '0',
  'hero-fairy-water': '0',
  'hero-hurt': 0,
  'hero-hurtmore': 0,
  'hero-heal': 0,
  'hero-healmore': 0,
  'hero-stopspell': 0,
  'hero-armor': 'none',
  'hero-flute': 0,
  'enemy-select': 'Slime',
  'use-preset': 1,
  'mon-hp': '2',
  'mon-attack': '5',
  'mon-defense': '1',
  'mon-agility': '3',
  'hurt-resist': '0',
  'mon-dodge': '1',
  'mon-xp': '1',
  'stopspell-resist': '0',
  'mon-support': '',
  'mon-support-chance': '0.25',
  'mon-attack-ability': '',
  'mon-attack-chance': '0.25',
  'hero-attack-time': '90',
  'hero-spell-time': '180',
  'hero-sleep-stopspell-time': '240',
  'hero-sleep-time': '35',
  'hero-critical-time': '30',
  'herb-time': '130',
  'fairy-water-time': '245',
  'fairy-flute-time': '470',
  'herb-between-time': '135',
  'heal-spell-time': '190',
  'enemy-attack-time': '130',
  'enemy-hurt-spell-time': '190',
  'enemy-heal-spell-time': '165',
  'enemy-stopspelled-spell-time': '165',
  'enemy-spell-time': '170',
  'enemy-breath-time': '135',
  'enemy-dodge-time': '80',
  'enemy-sleep-time': '50',
  'pre-battle-time': '140',
  'ambush-time': '50',
  'monster-flee-time': '100',
  'post-battle-time': '200',
  'frames-between-fights': '30',
  'refill-seconds': '75',
  'sim-mode': 'single',
  'iterations': '1000',
};

const dataArray = fieldOrder.map((id) => sampleParams[id]);
const encoded = toBase64Url(compressToBase64(JSON.stringify(dataArray)));
const decoded = JSON.parse(decompressFromBase64(fromBase64Url(encoded)));
assert.deepStrictEqual(decoded, dataArray);
console.log('URL encode/decode round trip test passed');

const humanParams = new URLSearchParams(sampleParams).toString();
console.log(`Encoded params length: ${encoded.length}`);
console.log(`Human-readable params length: ${humanParams.length}`);
assert(encoded.length < humanParams.length);
console.log('encoded vs human-readable length test passed');

const fullEncodedUrl = `https://example.com/#${encoded}`;
const fullHumanUrl = `https://example.com/?${humanParams}`;
console.log(`Full encoded URL length: ${fullEncodedUrl.length}`);
console.log(`Full human-readable URL length: ${fullHumanUrl.length}`);

