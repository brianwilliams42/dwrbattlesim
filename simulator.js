export function baseMaxDamage(attack, defense) {
  return Math.max(0, (attack - defense) / 2);
}

export function computeDamage(
  attack,
  defense,
  rng = Math.random,
  heroAttack = false,
) {
  if (heroAttack && attack < defense + 2) {
    return rng() < 0.5 ? 0 : 1;
  }
  const maxDamage = baseMaxDamage(attack, defense);
  const minQ = Math.floor((maxDamage / 2) * 4);
  const maxQ = Math.floor(maxDamage * 4);
  const roll = minQ + Math.floor(rng() * (maxQ - minQ + 1));
  const dmg = Math.floor(roll / 4);
  return Math.max(0, dmg);
}

function averagePhysicalDamage(attack, defense, heroAttack = false) {
  if (heroAttack && attack < defense + 2) return 0.5;
  const maxDamage = baseMaxDamage(attack, defense);
  const minQ = Math.floor((maxDamage / 2) * 4);
  const maxQ = Math.floor(maxDamage * 4);
  let total = 0;
  for (let q = minQ; q <= maxQ; q++) {
    total += Math.floor(q / 4);
  }
  const count = maxQ - minQ + 1;
  return count > 0 ? total / count : 0;
}

export function castHurtSpell(
  name,
  resist = 0,
  caster = 'hero',
  rng = Math.random,
) {
  if (caster === 'hero' && rng() < resist) return 0;
  if (caster === 'monster') {
    if (name === 'HURTMORE') {
      return 30 + Math.floor(rng() * 16); // 30-45
    }
    return 3 + Math.floor(rng() * 8); // HURT: 3-10
  }
  if (name === 'HURTMORE') {
    return 58 + Math.floor(rng() * 8); // 58-65
  }
  return 9 + Math.floor(rng() * 8); // HURT: 9-16
}

function castHealSpell(name) {
  if (name === 'HEALMORE') {
    return 85 + Math.floor(Math.random() * 16); // 85-100
  }
  return 18 + Math.floor(Math.random() * 8); // HEAL: 18-25
}

export function castBreathAttack(kind, rng = Math.random) {
  if (kind === 'big') {
    return 65 + Math.floor(rng() * 8); // 65-72
  }
  return 22 + Math.floor(rng() * 9); // 22-30
}

export function mitigateDamage(dmg) {
  return Math.floor(dmg / 3) * 2;
}

export function maxMonsterDamage(heroStats, monsterStats) {
  const armor = heroStats.armor || 'none';
  const hurtMitigation = armor === 'magic' || armor === 'erdrick';
  const breathMitigation = armor === 'erdrick';
  let maxDamage = Math.floor(
    baseMaxDamage(monsterStats.attack, heroStats.defense / 2),
  );
  if (monsterStats.attackAbility) {
    let abilityMax = 0;
    switch (monsterStats.attackAbility) {
      case 'hurt':
        abilityMax = 10;
        if (hurtMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'hurtmore':
        abilityMax = 45;
        if (hurtMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'smallbreath':
        abilityMax = 30;
        if (breathMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'bigbreath':
        abilityMax = 72;
        if (breathMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
    }
    maxDamage = Math.max(maxDamage, abilityMax);
  }
  return maxDamage;
}

const HERO_SPELL_COST = {
  HURT: 2,
  HURTMORE: 5,
  HEAL: 3,
  HEALMORE: 8,
  STOPSPELL: 2,
  SLEEP: 2,
};

export function simulateBattle(heroStats, monsterStats, settings = {}) {
  const {
    heroAttackTime = 120,
    heroSpellTime = 180,
    heroCriticalTime = 30,
    herbTime = 150,
    fairyWaterTime = 220,
    healSpellTime = 230,
    enemyAttackTime = 130,
    enemyHurtSpellTime = 190,
    enemyHealSpellTime = 165,
    enemySpellTime = 170,
    enemyBreathTime = 135,
    enemyDodgeTime = 60,
    preBattleTime = 140,
    postBattleTime = 200,
    dodgeRateRiskFactor = 0,
  } = settings;

  let log = [];
  let timeFrames = preBattleTime;
  let rounds = 0;
  let mpSpent = 0;
  let herbsUsed = 0;
  let fairyWatersUsed = 0;

  const armor = heroStats.armor || 'none';
  const hero = {
    ...heroStats,
    armor,
    mp: heroStats.mp ?? 0,
    maxHp: heroStats.maxHp,
    stopspelled: false,
    asleep: false,
    sleepTurns: 0,
    fairyFlute: heroStats.fairyFlute || false,
    herbs: heroStats.herbs || 0,
    fairyWater: heroStats.fairyWater || 0,
  };
  hero.hurtMitigation = armor === 'magic' || armor === 'erdrick';
  hero.breathMitigation = armor === 'erdrick';
  hero.stopspellImmune = armor === 'erdrick';
  const monster = { ...monsterStats };
  monster.dodge = monster.dodge ?? 2;
  monster.maxHp = monster.maxHp ?? monster.hp;
  monster.asleep = false;
  monster.sleepTurns = 0;
  monster.stopspelled = monster.stopspelled || false;
  monster.stopspellResist = monster.stopspellResist || 0;
  monster.sleepResist = monster.sleepResist || 0;
  monster.fled = false;
  let monsterMaxDamage = maxMonsterDamage(hero, monster);
  let monsterHpKnownMax = monster.maxHp;

  const heroRoll = hero.agility * Math.floor(Math.random() * 256);
  const enemyRoll = monster.agility * 0.25 * Math.floor(Math.random() * 256);
  if (heroRoll < enemyRoll) {
    log.push(`${monster.name} ambushes!`);
    timeFrames += 50;
    runMonsterTurn();
  }
  if (hero.hp <= 0 || monster.fled) {
    timeFrames += monster.fled ? 45 : postBattleTime;
    const winner = monster.fled ? 'fled' : 'monster';
    const timeSeconds = timeFrames / 60;
    return {
      winner,
      rounds,
      timeFrames,
      timeSeconds,
      xpGained: 0,
      xpPerMinute: 0,
      mpSpent,
      log,
    };
  }

  function determineHeroAction() {
    const currentMaxDamage =
      monster.stopspelled &&
      (monster.attackAbility === 'hurt' || monster.attackAbility === 'hurtmore')
        ? Math.floor(baseMaxDamage(monster.attack, hero.defense / 2))
        : monsterMaxDamage;

    if (hero.fairyFlute && monster.name === 'Golem' && !monster.asleep) {
      return 'FAIRY_FLUTE';
    }

    const killOptions = [];

    let minPhysical;
    if (hero.attack < monster.defense + 2) {
      minPhysical = 0;
    } else {
      minPhysical = Math.floor(
        baseMaxDamage(hero.attack, monster.defense) / 2,
      );
    }
    killOptions.push({
      action: 'attack',
      min: minPhysical,
      fail: (monster.dodge || 0) / 64,
    });

    if (!hero.stopspelled && hero.spells) {
      if (
        hero.spells.includes('HURTMORE') &&
        hero.mp >= HERO_SPELL_COST.HURTMORE
      ) {
        killOptions.push({
          action: 'HURTMORE',
          min: 58,
          fail: monster.hurtResist || 0,
        });
      }
      if (hero.spells.includes('HURT') && hero.mp >= HERO_SPELL_COST.HURT) {
        killOptions.push({
          action: 'HURT',
          min: 9,
          fail: monster.hurtResist || 0,
        });
      }
    }

    if (hero.fairyWater > 0) {
      const minFW = monster.name === 'Metal Slime' ? 0 : 9;
      const failFW = monster.name === 'Metal Slime' ? 0.5 : 0;
      killOptions.push({
        action: 'FAIRY_WATER',
        min: minFW,
        fail: failFW,
      });
    }

    const kill = killOptions.find(
      (o) =>
        o.min >= monsterHpKnownMax &&
        (dodgeRateRiskFactor === 0 || o.fail <= dodgeRateRiskFactor),
    );
    if (kill) return kill.action;

    if (hero.hp <= currentMaxDamage) {
      if (!hero.stopspelled && hero.spells) {
        if (hero.spells.includes('HEALMORE') && hero.mp >= HERO_SPELL_COST.HEALMORE)
          return 'HEALMORE';
        if (hero.spells.includes('HEAL') && hero.mp >= HERO_SPELL_COST.HEAL)
          return 'HEAL';
      }
      if (hero.herbs > 0) return 'HERB';
    }

    if (
      !hero.stopspelled &&
      hero.spells &&
      hero.spells.includes('SLEEP') &&
      hero.mp >= HERO_SPELL_COST.SLEEP &&
      !monster.asleep
    ) {
      return 'SLEEP';
    }

    if (
      !hero.stopspelled &&
      hero.spells &&
      hero.spells.includes('STOPSPELL') &&
      hero.mp >= HERO_SPELL_COST.STOPSPELL &&
      !monster.stopspelled &&
      (monster.supportAbility || monster.attackAbility === 'hurt' || monster.attackAbility === 'hurtmore')
    ) {
      return 'STOPSPELL';
    }

    let best = 'attack';
    let bestDamage = averagePhysicalDamage(hero.attack, monster.defense, true);

    if (!hero.stopspelled && hero.spells) {
      if (hero.spells.includes('HURTMORE') && hero.mp >= HERO_SPELL_COST.HURTMORE) {
        const avg = 61.5 * (1 - (monster.hurtResist || 0));
        if (avg > bestDamage) {
          bestDamage = avg;
          best = 'HURTMORE';
        }
      }
      if (hero.spells.includes('HURT') && hero.mp >= HERO_SPELL_COST.HURT) {
        const avg = 12.5 * (1 - (monster.hurtResist || 0));
        if (avg > bestDamage) {
          bestDamage = avg;
          best = 'HURT';
        }
      }
    }

    if (hero.fairyWater > 0) {
      const avg = monster.name === 'Metal Slime' ? 0.5 : 12.5;
      if (avg > bestDamage) {
        bestDamage = avg;
        best = 'FAIRY_WATER';
      }
    }

    if (best === 'HURTMORE' || best === 'HURT') {
      let minPhysicalDamage;
      if (hero.attack < monster.defense + 2) {
        minPhysicalDamage = 0;
      } else {
        // Minimum physical damage when attack succeeds is half of the maximum
        // damage, rounded down.
        minPhysicalDamage = Math.floor(
          baseMaxDamage(hero.attack, monster.defense) / 2,
        );
      }
      if (minPhysicalDamage >= monsterHpKnownMax) {
        best = 'attack';
      }
    }

    return best;
  }

  function runHeroTurn() {
    if (hero.asleep) {
      if (hero.sleepTurns >= 1 && Math.random() < 0.5) {
        hero.asleep = false;
        hero.sleepTurns = 0;
      } else {
        timeFrames += 60;
        hero.sleepTurns++;
        log.push('Hero is asleep.');
        return;
      }
    }

    const action = determineHeroAction();
    if (action === 'FAIRY_FLUTE') {
      monster.asleep = true;
      monster.sleepTurns = 0;
      timeFrames += 480;
      log.push('Hero plays the Fairy Flute!');
      return;
    }
    if (action === 'SLEEP') {
      const success = Math.random() >= (monster.sleepResist || 0);
      hero.mp -= HERO_SPELL_COST.SLEEP;
      mpSpent += HERO_SPELL_COST.SLEEP;
      timeFrames += heroSpellTime;
      if (success) {
        monster.asleep = true;
        monster.sleepTurns = 0;
        log.push(`Hero casts SLEEP. ${monster.name} falls asleep.`);
      } else {
        log.push('Hero casts SLEEP, but it fails.');
      }
      return;
    }
    if (action === 'STOPSPELL') {
      const success = Math.random() >= (monster.stopspellResist || 0);
      hero.mp -= HERO_SPELL_COST.STOPSPELL;
      mpSpent += HERO_SPELL_COST.STOPSPELL;
      timeFrames += heroSpellTime;
      if (success) {
        monster.stopspelled = true;
        log.push(`Hero casts STOPSPELL. ${monster.name} is affected.`);
      } else {
        log.push('Hero casts STOPSPELL, but it fails.');
      }
      return;
    }
    if (action === 'HURTMORE' || action === 'HURT') {
      const dmg = castHurtSpell(action, monster.hurtResist || 0);
      monster.hp -= dmg;
      monsterHpKnownMax = Math.max(0, monsterHpKnownMax - dmg);
      hero.mp -= HERO_SPELL_COST[action];
      mpSpent += HERO_SPELL_COST[action];
      timeFrames += heroSpellTime;
      log.push(
        dmg > 0
          ? `Hero casts ${action} for ${dmg} damage.`
          : `${monster.name} resists ${action}.`
      );
      return;
    }
    if (action === 'HEAL' || action === 'HEALMORE') {
      const heal = castHealSpell(action);
      const actual = Math.min(heal, hero.maxHp - hero.hp);
      hero.hp += actual;
      hero.mp -= HERO_SPELL_COST[action];
      mpSpent += HERO_SPELL_COST[action];
      timeFrames += heroSpellTime;
      log.push(`Hero casts ${action} and heals ${actual} HP.`);
      return;
    }
    if (action === 'HERB') {
      const heal = 23 + Math.floor(Math.random() * 8);
      const actual = Math.min(heal, hero.maxHp - hero.hp);
      hero.hp += actual;
      hero.herbs--;
      herbsUsed++;
      timeFrames += herbTime;
      log.push(`Hero uses an herb and heals ${actual} HP.`);
      return;
    }
    if (action === 'FAIRY_WATER') {
      const dmg =
        monster.name === 'Metal Slime'
          ? Math.random() < 0.5
            ? 0
            : 1
          : 9 + Math.floor(Math.random() * 8);
      monster.hp -= dmg;
      monsterHpKnownMax = Math.max(0, monsterHpKnownMax - dmg);
      hero.fairyWater--;
      fairyWatersUsed++;
      timeFrames += fairyWaterTime;
      log.push(`Hero uses Fairy Water for ${dmg} damage.`);
      return;
    }

    const dodgeChance = (monster.dodge || 0) / 64;
    if (Math.random() < dodgeChance) {
      timeFrames += enemyDodgeTime;
      log.push('Hero attacks, but the monster dodges!');
    } else {
      if (Math.random() < 1 / 32) {
        const min = Math.floor(hero.attack / 2);
        const max = hero.attack;
        const dmg = min + Math.floor(Math.random() * (max - min + 1));
        monster.hp -= dmg;
        monsterHpKnownMax = Math.max(0, monsterHpKnownMax - dmg);
        timeFrames += heroAttackTime + heroCriticalTime;
        log.push(`Hero performs a critical hit for ${dmg} damage.`);
      } else {
        const dmg = computeDamage(hero.attack, monster.defense, Math.random, true);
        monster.hp -= dmg;
        monsterHpKnownMax = Math.max(0, monsterHpKnownMax - dmg);
        timeFrames += heroAttackTime;
        log.push(`Hero attacks for ${dmg} damage.`);
      }
    }
  }

  function getEnemySpellTime(spell) {
    switch (spell) {
      case 'hurt':
      case 'hurtmore':
        return enemyHurtSpellTime;
      case 'heal':
      case 'healmore':
        return enemyHealSpellTime;
      default:
        return enemySpellTime;
    }
  }

  function runMonsterTurn() {
    if (monster.asleep) {
      if (monster.sleepTurns === 0) {
        timeFrames += 60;
        monster.sleepTurns++;
        log.push(`${monster.name} is asleep.`);
        return;
      }
      if (Math.random() < 1 / 3) {
        monster.asleep = false;
        monster.sleepTurns = 0;
        log.push(`${monster.name} wakes up.`);
      } else {
        timeFrames += 60;
        monster.sleepTurns++;
        log.push(`${monster.name} is asleep.`);
        return;
      }
    }
    if (
      hero.strength != null &&
      hero.strength >= 2 * monster.attack &&
      Math.random() < 0.25
    ) {
      monster.fled = true;
        log.push(`${monster.name} runs away!`);
      return;
    }
    if (monster.supportAbility) {
      let useSupport = Math.random() < (monster.supportChance || 0);
      const ability = monster.supportAbility;
      if (ability === 'sleep' && hero.asleep) useSupport = false;
      if (ability === 'stopspell' && hero.stopspelled) useSupport = false;
      if ((ability === 'heal' || ability === 'healmore') && monster.hp >= monster.maxHp / 4) {
        useSupport = false;
      }
      if (useSupport) {
        const frames = getEnemySpellTime(ability);
        if (monster.stopspelled) {
          timeFrames += frames - 60;
          log.push(
            `${monster.name} tries to cast ${ability.toUpperCase()}, but is stopspelled.`
          );
          return;
        }
        if (ability === 'sleep') {
          hero.asleep = true;
          hero.sleepTurns = 0;
          timeFrames += frames;
          log.push(`${monster.name} casts SLEEP.`);
          return;
        }
        if (ability === 'stopspell') {
          timeFrames += frames;
          log.push(`${monster.name} casts STOPSPELL.`);
          if (!hero.stopspellImmune && Math.random() < 0.5) {
            hero.stopspelled = true;
            log.push('Hero is affected by STOPSPELL.');
          } else {
            log.push('But nothing happens.');
          }
          return;
        }
        if (ability === 'heal' || ability === 'healmore') {
          const heal = castHealSpell(ability.toUpperCase());
          const actual = Math.min(heal, monster.maxHp - monster.hp);
          monster.hp += actual;
          const healMax = ability === 'heal' ? 25 : 100;
          monsterHpKnownMax = Math.min(
            monster.maxHp,
            monsterHpKnownMax + healMax,
          );
          timeFrames += frames;
          log.push(
            `${monster.name} casts ${ability.toUpperCase()} and heals ${actual} HP.`
          );
          return;
        }
      }
    }

    if (monster.attackAbility && Math.random() < (monster.attackChance || 0)) {
      let dmg = 0;
      if (monster.attackAbility === 'hurt' || monster.attackAbility === 'hurtmore') {
        const ability = monster.attackAbility;
        const spell = ability.toUpperCase();
        const frames = getEnemySpellTime(ability);
        if (monster.stopspelled) {
          timeFrames += frames - 60;
          log.push(`${monster.name} tries to cast ${spell}, but is stopspelled.`);
        } else {
          dmg = castHurtSpell(spell, 0, 'monster');
          if (hero.hurtMitigation) dmg = mitigateDamage(dmg);
          hero.hp -= dmg;
          timeFrames += frames;
          log.push(`${monster.name} casts ${spell} for ${dmg} damage.`);
        }
        return;
      }
      if (monster.attackAbility === 'smallbreath' || monster.attackAbility === 'bigbreath') {
        const kind = monster.attackAbility === 'smallbreath' ? 'small' : 'big';
        dmg = castBreathAttack(kind);
        if (hero.breathMitigation) dmg = mitigateDamage(dmg);
        hero.hp -= dmg;
        timeFrames += enemyBreathTime;
        log.push(
          `${monster.name} uses ${monster.attackAbility === 'smallbreath' ? 'SMALL BREATH' : 'BIG BREATH'} for ${dmg} damage.`
        );
        return;
      }
    }
    const dmg = computeDamage(monster.attack, hero.defense / 2);
    hero.hp -= dmg;
    timeFrames += enemyAttackTime;
    log.push(`${monster.name} attacks for ${dmg} damage.`);
  }

  while (hero.hp > 0 && monster.hp > 0 && !monster.fled) {
    rounds++;
    runHeroTurn();
    if (monster.hp <= 0) {
      log.push(`${monster.name} is defeated.`);
      break;
    }
    if (hero.hp <= 0 || monster.fled) break;
    runMonsterTurn();
    if (hero.hp <= 0) {
      log.push('Hero is defeated.');
      break;
    }
    if (monster.fled) break;
  }

  timeFrames += monster.fled ? 45 : postBattleTime;
  const winner = monster.fled ? 'fled' : hero.hp > 0 ? 'hero' : 'monster';
  const xpGained = winner === 'hero' ? monsterStats.xp : 0;
  const timeSeconds = timeFrames / 60;
  const xpPerMinute = xpGained * 60 / timeSeconds;

  return {
    winner,
    rounds,
    timeFrames,
    timeSeconds,
    xpGained,
    xpPerMinute,
    mpSpent,
    herbsUsed,
    fairyWatersUsed,
    heroHp: hero.hp,
    log,
  };
}

export function simulateMany(hero, monster, settings = {}, iterations = 1) {
  let totalXP = 0;
  let totalFrames = 0;
  let heroWins = 0;
  let monsterWins = 0;
  let monsterFlees = 0;
  let totalMP = 0;
  let totalHerbs = 0;
  let totalFairyWater = 0;
  for (let i = 0; i < iterations; i++) {
    const hpMax = monster.hp;
    const hpMin = Math.ceil(hpMax * 0.75);
    const m = {
      ...monster,
      hp: hpMin + Math.floor(Math.random() * (hpMax - hpMin + 1)),
      maxHp: hpMax,
    };
    const result = simulateBattle(hero, m, settings);
    totalXP += result.xpGained;
    totalFrames += result.timeFrames;
    totalMP += result.mpSpent;
    totalHerbs += result.herbsUsed;
    totalFairyWater += result.fairyWatersUsed;
    if (result.winner === 'hero') heroWins++;
    else if (result.winner === 'monster') monsterWins++;
    else if (result.winner === 'fled') monsterFlees++;
  }
  const averageXPPerMinute = totalFrames === 0 ? 0 : (totalXP * 3600) / totalFrames;
  const averageTimeSeconds = totalFrames / iterations / 60;
  return {
    winRate: heroWins / iterations,
    monsterWinRate: monsterWins / iterations,
    monsterFleeRate: monsterFlees / iterations,
    averageXPPerMinute,
    averageMPSpent: totalMP / iterations,
    averageTimeSeconds,
    averageHerbsUsed: totalHerbs / iterations,
    averageFairyWatersUsed: totalFairyWater / iterations,
  };
}

function healBetweenFights(hero, monster, settings) {
  const healSpellTime = settings.healSpellTime;
  const herbTime = settings.herbTime;
  let framesBetweenFights = settings.framesBetweenFights;
  let mp = 0;
  let herbsUsed = 0;
  const log = [];
  const maxDmg = maxMonsterDamage(hero, monster);
  while (hero.hp < hero.maxHp && hero.hp <= 2 * maxDmg) {
    const deficit = hero.maxHp - hero.hp;
    if (
      hero.spells?.includes('HEAL') &&
      hero.mp >= HERO_SPELL_COST.HEAL &&
      deficit <= 50
    ) {
      const heal = castHealSpell('HEAL');
      const actual = Math.min(heal, hero.maxHp - hero.hp);
      hero.hp += actual;
      hero.mp -= HERO_SPELL_COST.HEAL;
      mp += HERO_SPELL_COST.HEAL;
      framesBetweenFights += healSpellTime;
      log.push(`Hero casts HEAL and heals ${actual} HP.`);
      continue;
    }
    if (
      (!hero.spells?.includes('HEAL') || hero.mp < HERO_SPELL_COST.HEAL) &&
      hero.herbs > 0
    ) {
      const heal = 23 + Math.floor(Math.random() * 8);
      const actual = Math.min(heal, hero.maxHp - hero.hp);
      hero.hp += actual;
      hero.herbs--;
      herbsUsed++;
      framesBetweenFights += herbTime;
      log.push(`Hero uses an herb and heals ${actual} HP.`);
      continue;
    }
    if (
      hero.spells?.includes('HEALMORE') &&
      hero.mp >= HERO_SPELL_COST.HEALMORE
    ) {
      const heal = castHealSpell('HEALMORE');
      const actual = Math.min(heal, hero.maxHp - hero.hp);
      hero.hp += actual;
      hero.mp -= HERO_SPELL_COST.HEALMORE;
      mp += HERO_SPELL_COST.HEALMORE;
      framesBetweenFights += healSpellTime;
      log.push(`Hero casts HEALMORE and heals ${actual} HP.`);
      continue;
    }
    break;
  }
  return { frames: framesBetweenFights, mpSpent: mp, herbsUsed, log };
}

export function simulateRepeated(heroStats, monsterStats, settings = {}, iterations = 1) {
  let totalXP = 0;
  let totalFrames = 0;
  let totalKills = 0;
  let totalMP = 0;
  let totalFights = 0;
  let sampleLog = [];
  let sampleMpSpent = 0;
  let sampleHerbsUsed = 0;
  let sampleFairyWatersUsed = 0;
  let sampleFrames = 0;
  for (let i = 0; i < iterations; i++) {
    let hero = {
      ...heroStats,
      mp: heroStats.mp ?? 0,
      maxHp: heroStats.maxHp,
      herbs: heroStats.herbs || 0,
      fairyWater: heroStats.fairyWater || 0,
    };
    let xp = 0;
    let frames = 0;
    let kills = 0;
    let mpSpent = 0;
    let fights = 0;
    let herbsUsed = 0;
    let fairyWatersUsed = 0;
    const lifeLog = [];
    while (hero.hp > 0) {
      const hpMax = monsterStats.hp;
      const hpMin = Math.ceil(hpMax * 0.75);
      const m = {
        ...monsterStats,
        hp: hpMin + Math.floor(Math.random() * (hpMax - hpMin + 1)),
        maxHp: hpMax,
      };
      if (i === 0) {
        lifeLog.push(
          fights === 0
            ? `Starting fight against ${m.name} (${hero.hp} HP).`
            : `Starting next fight against ${m.name} (${hero.hp} HP).`
        );
      }
      const result = simulateBattle(hero, m, settings);
      frames += result.timeFrames;
      mpSpent += result.mpSpent;
      herbsUsed += result.herbsUsed;
      fairyWatersUsed += result.fairyWatersUsed;
      fights++;
      hero.hp = result.heroHp;
      hero.mp -= result.mpSpent;
      hero.herbs -= result.herbsUsed;
      hero.fairyWater -= result.fairyWatersUsed;
      if (i === 0) {
        lifeLog.push(...result.log);
      }
      if (result.winner === 'hero') {
        xp += result.xpGained;
        kills++;
      }
      if (hero.hp <= 0) break;
      const heal = healBetweenFights(hero, monsterStats, settings);
      frames += heal.frames;
      mpSpent += heal.mpSpent;
      herbsUsed += heal.herbsUsed;
      if (i === 0 && heal.log.length > 0) {
        lifeLog.push(...heal.log);
      }
    }
    totalXP += xp;
    totalFrames += frames;
    totalKills += kills;
    totalMP += mpSpent;
    totalFights += fights;
    if (i === 0) {
      sampleLog = lifeLog;
      sampleMpSpent = mpSpent;
      sampleHerbsUsed = herbsUsed;
      sampleFairyWatersUsed = fairyWatersUsed;
      sampleFrames = frames;
    }
  }
  const averageXPPerMinute = totalFrames === 0 ? 0 : (totalXP * 3600) / totalFrames;
  const averageTimeSeconds = totalFrames / iterations / 60;
  return {
    averageXPPerLife: totalXP / iterations,
    averageXPPerMinute,
    averageTimeSeconds,
    averageKills: totalKills / iterations,
    averageMPPerFight: totalFights === 0 ? 0 : totalMP / totalFights,
    mpSpent: sampleMpSpent,
    herbsUsed: sampleHerbsUsed,
    fairyWatersUsed: sampleFairyWatersUsed,
    timeFrames: sampleFrames,
    log: sampleLog,
  };
}
