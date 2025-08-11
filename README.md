# Dragon Warrior Battle Simulator

This project provides a lightweight JavaScript simulator inspired by the NES game **Dragon Warrior**. Hero and monster statistics are fully configurable, allowing experimentation with arbitrary encounters.

## Features
- Monster ambushes determined by comparing `hero agility * rand(0-255)` with `enemy agility * 0.25 * rand(0-255)`. If the monster ambushes, it takes a full turn before the hero acts.
- After any ambush, the hero always acts before the monster each round.
- Supports hero spells HURT, HURTMORE, HEAL, HEALMORE, STOPSPELL, and SLEEP with per-spell MP costs and enemy resistances.
- Tracks MP spent by the hero across a battle.
- Optional consumables: Herbs heal 23–30 HP (150 frames) while Fairy Water deals 9–16 damage (210 frames, 0–1 against Metal Slimes) and both ignore Stopspell.
- Hero attack is derived from Strength, chosen weapon, and optional gear (Fighter's Ring +2 attack, Death Necklace +10 attack).
- Hero picks the offensive action (attack, HURT, HURTMORE, or Fairy Water) with the highest expected damage.
- When the monster's known remaining HP is lower than the potential damage from an attack, the hero will attempt the finishing blow instead of healing. A `dodgeRateRiskFactor` setting (0–1, default 0) lets the hero heal instead when the chance of a dodge or resist exceeds the chosen threshold; the default 0 ignores the risk entirely.
- Physical attacks have a 1/32 chance to become critical hits dealing 50–100% of attack power and adding 40 frames.
- When the hero's attack is less than the monster's defense + 2, normal attack damage is replaced with a 50% chance of dealing 0 or 1 damage.
- Monsters may flee at the start of their turn if the hero's strength is at least twice the monster's attack (25% chance), ending the battle early with a 45-frame message and no experience.
- Enemies have a configurable chance to dodge attacks.
- Tracks total battle time in frames (60 frames = 1 second) using default action timings:
  - Hero attack: 120 frames
  - Hero spell: 180 frames
  - Critical hit bonus: 40 frames
  - Herb use: 150 frames
  - Fairy Water use: 210 frames
  - Enemy attack: 150 frames
  - Enemy spell: 170 frames
  - Enemy breath: 160 frames
  - Enemy dodge: 60 frames when a dodge occurs
- Fixed overhead for battles: 140-frame pre-battle animation and 200-frame post-battle message
- Monster support abilities (Sleep, Stopspell, Heal, Healmore) with configurable likelihood each turn. Sleep causes the hero to skip turns with a 50% chance to wake starting the second turn; Stopspell can silence hero spellcasting.
- Monsters can also have an attack ability (HURT: 3–10 dmg, HURTMORE: 30–45 dmg, Small Breath, Big Breath) used with a configurable frequency. Hero armor (None, Magic Armor, Erdrick's Armor) determines mitigation: Magic Armor reduces HURT spells while Erdrick's Armor also mitigates breath attacks and grants Stopspell immunity.
- Heroes can cast STOPSPELL to silence enemy spellcasting and SLEEP to incapacitate foes. Success depends on the monster's Stopspell or Sleep resistance (0–15 out of 16). Stopspelled monsters still attempt to cast but their spells fail and cost 60 fewer frames than normal, while sleeping monsters skip their turn with a 33% wake chance starting the second turn.
- When fighting the Golem, the hero can optionally carry the Fairy Flute. Playing it (480 frames) puts the Golem to sleep for one guaranteed turn and gives it a 33% wake chance on later turns.
- Computes experience gained, average battle duration, and XP per minute.
- Repeated fight mode chains battles until the hero dies, allowing healing between fights and reporting total XP per life, XP per minute, enemies defeated, and MP used per fight, with a configurable 30-frame pause between battles.
- Browser interface for quick experimentation and a CLI example.
- Web UI includes preset enemy selector with stats and an option to override them; enemy HP is randomized each fight between 75% and 100% of its listed maximum. Timing values default to the NES speeds but can be tweaked in a hidden advanced section.

## Usage
### Browser
Open `index.html` in any modern browser. Adjust the hero, monster, and simulation settings and click **Simulate**. Choose between single battles or repeated fights to see either win rates and XP per minute or total XP per life, kill counts, and MP usage, along with a sample battle log.

### Command line
Run the test suite:

```bash
npm test
```

To execute the sample simulation CLI:

```bash
npm run cli
```
