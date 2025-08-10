import { simulateMany } from './simulator.js';

const hero = {
  hp: 100,
  attack: 50,
  defense: 40,
  agility: 30,
  mp: 50,
  spells: ['HURT', 'HEAL', 'STOPSPELL'],
  armor: 'none',
  fairyFlute: true,
};
const monster = {
  name: 'Golem',
  hp: 80,
  attack: 40,
  defense: 30,
  agility: 20,
  xp: 120,
  hurtResist: 0.25,
  dodge: 2,
  stopspellResist: 0.5,
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

const { winRate, averageXPPerMinute, averageMPSpent } = simulateMany(
  hero,
  monster,
  settings,
  100
);

console.log(`Win Rate: ${(winRate * 100).toFixed(2)}%`);
console.log(`Average XP per minute: ${averageXPPerMinute.toFixed(2)}`);
console.log(`Average MP spent per battle: ${averageMPSpent.toFixed(2)}`);
