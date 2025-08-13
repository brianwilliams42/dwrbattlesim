import { simulateMany, simulateRepeated, simulateZone } from './simulator.js';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${minutes}m ${secs}s`;
}

const hero = {
  hp: 100,
  maxHp: 100,
  strength: 50,
  defense: 40,
  agility: 30,
  mp: 50,
  spells: ['HURT', 'HEAL', 'STOPSPELL', 'SLEEP', 'REPEL'],
  armor: 'none',
  fairyFlute: true,
  herbs: 0,
  fairyWater: 0,
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
  sleepResist: 8 / 16,
  supportAbility: 'sleep',
  supportChance: 0.25,
  attackAbility: 'hurt',
  attackChance: 0.25,
};
const settings = {
  preBattleTime: 140,
  postBattleTime: 200,
  heroAttackTime: 145,
  heroSpellTime: 180,
  heroSleepStopspellTime: 240,
  heroSleepTime: 35,
  heroCriticalTime: 30,
  herbTime: 130,
  herbBetweenTime: 135,
  fairyWaterTime: 245,
  healSpellTime: 190,
  fairyFluteTime: 470,
  enemyAttackTime: 130,
  enemyHurtSpellTime: 190,
  enemyHealSpellTime: 165,
  enemySpellTime: 170,
  enemyBreathTime: 135,
  enemyDodgeTime: 80,
  enemySleepTime: 50,
  framesBetweenFights: 30,
  refillTimeSeconds: 75,
  ambushTime: 50,
  monsterFleeTime: 100,
  enemyStopspelledSpellTime: 165,
  dodgeRateRiskFactor: 0,
};

const {
  winRate,
  monsterWinRate,
  monsterFleeRate,
  averageXPPerMinute,
  averageMPSpent,
  averageTimeSeconds,
  averageHerbsUsed,
  averageFairyWatersUsed,
} = simulateMany(hero, monster, settings, 100);

console.log(`Hero Win Rate: ${(winRate * 100).toFixed(2)}%`);
console.log(`Monster Win Rate: ${(monsterWinRate * 100).toFixed(2)}%`);
console.log(`Monster Flee Rate: ${(monsterFleeRate * 100).toFixed(2)}%`);
console.log(`Average XP per minute: ${averageXPPerMinute.toFixed(2)}`);
console.log(`Average MP spent per battle: ${averageMPSpent.toFixed(2)}`);
console.log(`Average battle time (s): ${averageTimeSeconds.toFixed(2)}`);
console.log(`Average herbs used per battle: ${averageHerbsUsed.toFixed(2)}`);
console.log(
  `Average fairy waters used per battle: ${averageFairyWatersUsed.toFixed(2)}`,
);

const repeated = simulateRepeated(hero, monster, settings, 100);
console.log(`Average XP per life: ${repeated.averageXPPerLife.toFixed(2)}`);
console.log(`Average XP per minute: ${repeated.averageXPPerMinute.toFixed(2)}`);
console.log(
  `Average XP per minute (incl. refill): ${repeated.averageXPPerMinuteWithRefill.toFixed(2)}`,
);
console.log(`Average enemies killed per life: ${repeated.averageKills.toFixed(2)}`);
console.log(`Average MP spent per fight: ${repeated.averageMPPerFight.toFixed(2)}`);
console.log(`Average time per life: ${formatTime(repeated.averageTimeSeconds)}`);

const zone = simulateZone(hero, [monster, monster, monster, monster, monster], 8, settings);
console.log(`Zone XP per minute: ${zone.xpPerMinute.toFixed(2)}`);
console.log(`Zone MP per minute: ${zone.mpPerMinute.toFixed(2)}`);
zone.log.forEach((line) => console.log(line));
