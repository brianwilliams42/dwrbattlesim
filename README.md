# Dragon Warrior Battle Simulator

This project provides a lightweight JavaScript simulator inspired by the NES game **Dragon Warrior**. Hero and monster statistics are fully configurable, allowing experimentation with arbitrary encounters.

## Features
- Monster ambushes determined by comparing `hero agility * rand(0-255)` with `enemy agility * 0.25 * rand(0-255)`.
- Turn order determined by agility each round.
- Supports hero spells HURT, HURTMORE, HEAL, and HEALMORE with per-spell MP costs and enemy resistance to HURT-category magic.
- Tracks MP spent by the hero across a battle.
- Hero picks the offensive action (attack, HURT, or HURTMORE) with the highest expected damage.
- Enemies have a configurable chance to dodge attacks (default 2/64).
- Tracks total battle time in frames (60 frames = 1 second) using default action timings:
  - Hero attack: 120 frames
  - Hero spell: 180 frames
  - Enemy attack: 150 frames
  - Enemy spell: 170 frames
  - Enemy breath: 160 frames
  - Enemy dodge: 60 frames when a dodge occurs
- Fixed overhead for battles: 140-frame pre-battle animation and 200-frame post-battle message
- Monster support abilities (Sleep, Stopspell, Heal, Healmore) with configurable likelihood each turn. Sleep causes the hero to skip turns with a 50% chance to wake starting the second turn; Stopspell can silence hero spellcasting.
- Monsters can also have an attack ability (HURT, HURTMORE, Small Breath, Big Breath) used with a configurable frequency. Hero armor (None, Magic Armor, Erdrick's Armor) determines mitigation: Magic Armor reduces HURT spells while Erdrick's Armor also mitigates breath attacks and grants Stopspell immunity.
- Computes experience gained and XP per minute.
- Browser interface for quick experimentation and a CLI example.
- Web UI includes preset enemy selector with stats; enemy HP is randomized each fight between 75% and 100% of its listed maximum.

## Usage
### Browser
Open `index.html` in any modern browser. Adjust the hero, monster, and simulation settings and click **Simulate** to see win rate and XP per minute along with a sample battle log.

### Command line
Run the test suite:

```bash
npm test
```

To execute the sample simulation CLI:

```bash
npm run cli
```
