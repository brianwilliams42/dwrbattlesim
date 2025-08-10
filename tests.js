import assert from 'node:assert';
import {
  computeDamage,
  castBreathAttack,
  castHurtSpell,
  mitigateDamage,
  simulateBattle,
  simulateMany,
} from './simulator.js';

function averageDamage(attacker, defender) {
  const maxDamage = Math.max(0, (attacker.attack - defender.defense) / 2);
  const minQ = Math.floor((maxDamage / 2) * 4);
  const maxQ = Math.floor(maxDamage * 4);
  const n = maxQ - minQ + 1;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const rng = () => (i + 0.5) / n;
    total += computeDamage(attacker, defender, rng);
  }
  return total / n;
}

const avg = averageDamage({ attack: 130 }, { defense: 100 });
assert(Math.abs(avg - 10.875) < 0.01);

console.log('computeDamage average test passed');

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
  const seq = [0, 0, 0, 0.2, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 1,
    attack: 0,
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
  const seq = [0, 0, 0, 0, 0.5];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    attack: 100,
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
  const seq = [0.99, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = {
    hp: 10,
    attack: 100,
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

// Ambush uses full monster turn logic including support abilities
{
  const seq = [0, 0.99, 0, 0];
  let i = 0;
  const orig = Math.random;
  Math.random = () => seq[i++] ?? 0;
  const hero = { hp: 10, attack: 0, defense: 0, agility: 10 };
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
// simulateMany returns average battle time in seconds
{
  const hero = { hp: 10, attack: 100, defense: 0, agility: 10 };
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
  assert(Math.abs(summary.averageTimeSeconds - 1 / 60) < 1e-9);
  console.log('average time reporting test passed');
}

