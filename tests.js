import assert from 'node:assert';
import {
  computeDamage,
  castBreathAttack,
  mitigateDamage,
  simulateBattle,
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

