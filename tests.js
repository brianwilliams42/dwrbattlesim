import assert from 'node:assert';
import {
  computeDamage,
  castBreathAttack,
  castHurtSpell,
  mitigateDamage,
  simulateBattle,
  simulateMany,
  simulateRepeated,
  baseMaxDamage,
} from './simulator.js';

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

// Stopspell prevents enemy spells and shortens their casting time by 60 frames
{
  const seq = [0, 0, 0.5, 0.3, 0.99, 0.99, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    attack: 100,
    strength: 100,
    defense: 0,
    agility: 50,
    mp: 10,
    spells: ['STOPSPELL'],
    armor: 'none',
  };
  const monster = {
    name: 'Mage',
    hp: 25,
    attack: 0,
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
    enemySpellTime: 70,
    enemyAttackTime: 1,
    enemyBreathTime: 1,
  });
  Math.random = orig;
  assert(result.log.includes('Hero casts STOPSPELL. Monster is affected.'));
  assert(result.log.includes('Monster tries to cast SLEEP, but is stopspelled.'));
  assert.strictEqual(result.timeFrames, 12);
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

// Hero critical hits deal 50%-100% of attack and have configurable extra time
{
  const seq = [0, 0, 0.5, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, attack: 64, strength: 64, defense: 0, agility: 0 };
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
  const hero = { hp: 10, attack: 0, strength: 50, defense: 0, agility: 10 };
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
  assert.strictEqual(result.log[0], 'Monster ambushes!');
  assert.strictEqual(result.log[1], 'Monster casts SLEEP.');
  assert(result.log.includes('Hero is asleep.'));
  console.log('ambush support ability test passed');
}

// Monster fleeing during an ambush ends the battle before hero acts
{
  const seq = [0, 0.99, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, attack: 0, strength: 20, defense: 0, agility: 10 };
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
  assert.deepStrictEqual(result.log, ['Monster ambushes!', 'Monster runs away!']);
  assert.strictEqual(result.winner, 'fled');
  assert.strictEqual(result.rounds, 0);
  assert.strictEqual(result.timeFrames, 45);
  console.log('ambush flee logic test passed');
}

// Metal Slime ambush flee ends battle without hero action
{
  const seq = [0, 0.99, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 100,
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
  assert.deepStrictEqual(result.log, ['Monster ambushes!', 'Monster runs away!']);
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
  const hero = { hp: 10, attack: 100, strength: 100, defense: 0, agility: 10 };
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
  const hero = { hp: 10, attack: 0, strength: 50, defense: 0, agility: 10 };
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
  assert(!result.log.includes('Monster casts HEAL'));
  console.log('monster heal threshold (no heal) test passed');
}

{
  const seq = [0, 0, 0, 0, 0, 0.99, 0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 1, attack: 0, strength: 50, defense: 0, agility: 10 };
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
  assert(result.log.includes('Monster casts HEALMORE and heals 80 HP.'));
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
    hp: 1,
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
  const hero = { hp: 10, attack: 0, strength: 20, defense: 0, agility: 10 };
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
  assert.strictEqual(result.timeFrames, 45);
  assert(result.log.includes('Monster runs away!'));
  console.log('monster flee test passed');
}

// Hero uses an herb when no healing spells are available
{
  const seq = [0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, attack: 1, strength: 50, defense: 0, agility: 0, herbs: 1 };
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
  const hero = { hp: 10, attack: 1, strength: 50, defense: 0, agility: 0, herbs: 1 };
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
  });
  Math.random = orig;
  assert.strictEqual(result.timeFrames, 5);
  console.log('herb timing test passed');
}

// Herb is not used when HEAL is available and affordable
{
  const seq = [0, 0, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
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
  const hero = { hp: 10, attack: 0, strength: 50, defense: 0, agility: 0, fairyWater: 1 };
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
  const hero = { hp: 10, attack: 0, strength: 50, defense: 0, agility: 0, fairyWater: 1 };
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
    { preBattleTime: 0, postBattleTime: 0, framesBetweenFights: 0 },
    1,
  );
  assert.strictEqual(result.log[0], 'Starting fight against Slime (10 HP).');
  console.log('starting fight log hero HP test passed');
}

