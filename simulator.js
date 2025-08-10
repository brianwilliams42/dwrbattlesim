export function baseMaxDamage(attack, defense) {
  return Math.max(0, (attack - defense) / 2);
}

export function computeDamage(attack, defense, rng = Math.random) {
  const maxDamage = baseMaxDamage(attack, defense);
  const minQ = Math.floor((maxDamage / 2) * 4);
  const maxQ = Math.floor(maxDamage * 4);
  const roll = minQ + Math.floor(rng() * (maxQ - minQ + 1));
  const dmg = Math.floor(roll / 4);
  return Math.max(0, dmg);
}

function averagePhysicalDamage(attack, defense) {
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

const HERO_SPELL_COST = {
  HURT: 2,
  HURTMORE: 5,
  HEAL: 3,
  HEALMORE: 8,
  STOPSPELL: 2,
};

export function simulateBattle(heroStats, monsterStats, settings = {}) {
  const {
    heroAttackTime = 120,
    heroSpellTime = 180,
    enemyAttackTime = 150,
    enemySpellTime = 170,
    enemyBreathTime = 160,
    enemyDodgeTime = 60,
    preBattleTime = 140,
    postBattleTime = 200,
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
    maxHp: heroStats.hp,
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
  monster.fled = false;
  let monsterMaxDamage = Math.floor(
    baseMaxDamage(monster.attack, hero.defense / 2),
  );
  if (monster.attackAbility) {
    let abilityMax = 0;
    switch (monster.attackAbility) {
      case 'hurt':
        abilityMax = 10;
        if (hero.hurtMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'hurtmore':
        abilityMax = 45;
        if (hero.hurtMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'smallbreath':
        abilityMax = 30;
        if (hero.breathMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
      case 'bigbreath':
        abilityMax = 72;
        if (hero.breathMitigation) abilityMax = mitigateDamage(abilityMax);
        break;
    }
    monsterMaxDamage = Math.max(monsterMaxDamage, abilityMax);
  }

  const heroRoll = hero.agility * Math.floor(Math.random() * 256);
  const enemyRoll = monster.agility * 0.25 * Math.floor(Math.random() * 256);
  if (heroRoll < enemyRoll) {
    log.push('Monster ambushes!');
    runMonsterTurn();
    if (hero.hp <= 0) {
      timeFrames += postBattleTime;
      const timeSeconds = timeFrames / 60;
      return {
        winner: 'monster',
        rounds,
        timeFrames,
        timeSeconds,
        xpGained: 0,
        xpPerMinute: 0,
        mpSpent,
        log,
      };
    }
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
      hero.spells.includes('STOPSPELL') &&
      hero.mp >= HERO_SPELL_COST.STOPSPELL &&
      !monster.stopspelled &&
      (monster.supportAbility || monster.attackAbility === 'hurt' || monster.attackAbility === 'hurtmore')
    ) {
      return 'STOPSPELL';
    }

    let best = 'attack';
    let bestDamage = averagePhysicalDamage(hero.attack, monster.defense);

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
      const avg = 12.5;
      if (avg > bestDamage) {
        bestDamage = avg;
        best = 'FAIRY_WATER';
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
    if (action === 'STOPSPELL') {
      const success = Math.random() >= (monster.stopspellResist || 0);
      hero.mp -= HERO_SPELL_COST.STOPSPELL;
      mpSpent += HERO_SPELL_COST.STOPSPELL;
      timeFrames += heroSpellTime;
      if (success) {
        monster.stopspelled = true;
        log.push('Hero casts STOPSPELL. Monster is affected.');
      } else {
        log.push('Hero casts STOPSPELL, but it fails.');
      }
      return;
    }
    if (action === 'HURTMORE' || action === 'HURT') {
      const dmg = castHurtSpell(action, monster.hurtResist || 0);
      monster.hp -= dmg;
      hero.mp -= HERO_SPELL_COST[action];
      mpSpent += HERO_SPELL_COST[action];
      timeFrames += heroSpellTime;
      log.push(
        dmg > 0
          ? `Hero casts ${action} for ${dmg} damage.`
          : `Monster resists ${action}.`
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
      timeFrames += 150;
      log.push(`Hero uses an herb and heals ${actual} HP.`);
      return;
    }
    if (action === 'FAIRY_WATER') {
      const dmg = 9 + Math.floor(Math.random() * 8);
      monster.hp -= dmg;
      hero.fairyWater--;
      fairyWatersUsed++;
      timeFrames += 210;
      log.push(`Hero uses Fairy Water for ${dmg} damage.`);
      return;
    }

    const dodgeChance = (monster.dodge || 0) / 64;
    if (Math.random() < dodgeChance) {
      timeFrames += enemyDodgeTime;
      log.push('Hero attacks, but the monster dodges!');
    } else {
      const dmg = computeDamage(hero.attack, monster.defense);
      monster.hp -= dmg;
      timeFrames += heroAttackTime;
      log.push(`Hero attacks for ${dmg} damage.`);
    }
  }

  function runMonsterTurn() {
    if (monster.asleep) {
      if (monster.sleepTurns === 0) {
        timeFrames += 60;
        monster.sleepTurns++;
        log.push('Golem is asleep.');
        return;
      }
      if (Math.random() < 1 / 3) {
        monster.asleep = false;
        monster.sleepTurns = 0;
        log.push('Golem wakes up.');
      } else {
        timeFrames += 60;
        monster.sleepTurns++;
        log.push('Golem is asleep.');
        return;
      }
    }
    if (
      hero.strength != null &&
      hero.strength >= 2 * monster.attack &&
      Math.random() < 0.25
    ) {
      monster.fled = true;
      log.push('Monster runs away!');
      return;
    }
    if (monster.supportAbility) {
      let useSupport = Math.random() < (monster.supportChance || 0);
      if (monster.supportAbility === 'sleep' && hero.asleep) useSupport = false;
      if (monster.supportAbility === 'stopspell' && hero.stopspelled) useSupport = false;
      if (
        (monster.supportAbility === 'heal' || monster.supportAbility === 'healmore') &&
        monster.hp >= monster.maxHp / 4
      ) {
        useSupport = false;
      }
      if (useSupport) {
        if (monster.stopspelled) {
          timeFrames += enemySpellTime - 60;
          log.push(
            `Monster tries to cast ${monster.supportAbility.toUpperCase()}, but is stopspelled.`
          );
          return;
        }
        if (monster.supportAbility === 'sleep') {
          hero.asleep = true;
          hero.sleepTurns = 0;
          timeFrames += enemySpellTime;
          log.push('Monster casts SLEEP.');
          return;
        }
        if (monster.supportAbility === 'stopspell') {
          timeFrames += enemySpellTime;
          log.push('Monster casts STOPSPELL.');
          if (!hero.stopspellImmune && Math.random() < 0.5) {
            hero.stopspelled = true;
            log.push('Hero is affected by STOPSPELL.');
          } else {
            log.push('But nothing happens.');
          }
          return;
        }
        if (monster.supportAbility === 'heal' || monster.supportAbility === 'healmore') {
          const heal = castHealSpell(monster.supportAbility.toUpperCase());
          const actual = Math.min(heal, monster.maxHp - monster.hp);
          monster.hp += actual;
          timeFrames += enemySpellTime;
          log.push(
            `Monster casts ${monster.supportAbility.toUpperCase()} and heals ${actual} HP.`
          );
          return;
        }
      }
    }

    if (monster.attackAbility && Math.random() < (monster.attackChance || 0)) {
      let dmg = 0;
      if (monster.attackAbility === 'hurt' || monster.attackAbility === 'hurtmore') {
        const spell = monster.attackAbility.toUpperCase();
        if (monster.stopspelled) {
          timeFrames += enemySpellTime - 60;
          log.push(`Monster tries to cast ${spell}, but is stopspelled.`);
        } else {
          dmg = castHurtSpell(spell, 0, 'monster');
          if (hero.hurtMitigation) dmg = mitigateDamage(dmg);
          hero.hp -= dmg;
          timeFrames += enemySpellTime;
          log.push(`Monster casts ${spell} for ${dmg} damage.`);
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
          `Monster uses ${monster.attackAbility === 'smallbreath' ? 'SMALL BREATH' : 'BIG BREATH'} for ${dmg} damage.`
        );
        return;
      }
    }
    const dmg = computeDamage(monster.attack, hero.defense / 2);
    hero.hp -= dmg;
    timeFrames += enemyAttackTime;
    log.push(`Monster attacks for ${dmg} damage.`);
  }

  while (hero.hp > 0 && monster.hp > 0) {
    rounds++;
    runHeroTurn();
    if (hero.hp <= 0 || monster.hp <= 0) break;
    runMonsterTurn();
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
    log,
  };
}

export function simulateMany(hero, monster, settings = {}, iterations = 1) {
  let totalXP = 0;
  let totalFrames = 0;
  let wins = 0;
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
    if (result.winner === 'hero') wins++;
  }
  const averageXPPerMinute = totalFrames === 0 ? 0 : (totalXP * 3600) / totalFrames;
  const averageTimeSeconds = totalFrames / iterations / 60;
  return {
    winRate: wins / iterations,
    averageXPPerMinute,
    averageMPSpent: totalMP / iterations,
    averageTimeSeconds,
    averageHerbsUsed: totalHerbs / iterations,
    averageFairyWatersUsed: totalFairyWater / iterations,
  };
}
