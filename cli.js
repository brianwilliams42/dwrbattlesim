import { simulateMany } from './simulator.js';

const hero = {
  hp: 100,
  strength: 50,
  defense: 40,
  agility: 30,
  mp: 50,
  spells: ['HURT', 'HEAL', 'STOPSPELL'],
  armor: 'none',
  fairyFlute: true,
};
const weaponAttack = 20; // Broad Sword
const fightersRing = false;
const deathNecklace = false;
hero.attack = hero.strength + weaponAttack + (fightersRing ? 2 : 0) + (deathNecklace ? 10 : 0);
const monster = {
  name: 'Golem',
  hp: 80,
  attack: 40,
  defense: 30,
  agility: 20,
  xp: 120,
  hurtResist: 4 / 16,
  dodge: 2,
  stopspellResist: 8 / 16,
  supportAbility: 'sleep',
  supportChance: 0.25,
  attackAbility: 'hurt',
  attackChance: 0.25,
};
const settings = {
  preBattleTime: 140,
  postBattleTime: 200,
  heroAttackTime: 120,
  heroSpellTime: 180,
  enemyAttackTime: 150,
  enemySpellTime: 170,
  enemyBreathTime: 160,
  enemyDodgeTime: 60,
};

const { winRate, averageXPPerMinute, averageMPSpent, averageTimeSeconds } =
  simulateMany(hero, monster, settings, 100);

console.log(`Win Rate: ${(winRate * 100).toFixed(2)}%`);
console.log(`Average XP per minute: ${averageXPPerMinute.toFixed(2)}`);
console.log(`Average MP spent per battle: ${averageMPSpent.toFixed(2)}`);
console.log(`Average battle time (s): ${averageTimeSeconds.toFixed(2)}`);
