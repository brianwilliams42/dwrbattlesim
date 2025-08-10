import assert from 'node:assert';
import { computeDamage, castBreathAttack, mitigateDamage } from './simulator.js';

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

