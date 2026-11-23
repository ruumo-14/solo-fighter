# SOLO FIGHTER

SOLO FIGHTER is being rebuilt as an original browser-based side-view action game.

## Development branch

The clean rebuild is in `rebuild-v1`. The existing `main` branch remains unchanged as the rollback version.

## Current prototype

- Canvas-based side-view action battle
- Left/right movement, jump, and melee attack
- Four basic enemy behavior types
- Enemy warning and charge behavior
- Aerial charger retreats when interrupted by an attack
- Experience, level-ups, and three-choice upgrades
- Bosses scheduled at 2:00, 4:00, and 6:00
- Seven-minute stage limit
- Stage clear after all three bosses are defeated
- Mobile touch controls

The current browser prototype exposes only Normal mode while the additional modes are being implemented. This branch is a combat prototype, not yet the complete game.

## Core design settings

- Stage duration: maximum 7 minutes (420 seconds)
- Boss appearance: 2, 4, and 6 minutes
- Initial stage progression: 20 stages, expandable later
- Primary currency: 魔晶
- Rarities: ノーマル / レア / エピック / レジェンド / S1
- Equipment slots: 頭 / 胴 / 脚 / 足 / 手 / 武器
- Equipment upgrade cap: Lv.10
- Pet level cap: Lv.20
- Character level cap: Lv.100
- Normal gacha: items 50%, Normal 10%, Rare 35%, Epic 4%, Legendary 1%
- S1 gacha: items 50%, Normal 10%, Rare 33%, Epic 4%, Legendary 2%, S1 1%
- Independent 100-pull pity counters

## Project structure

- `index.html`: prototype screen
- `src/main.js`: browser input, rendering loop, and UI
- `src/combat.js`: combat simulation and canvas renderer
- `src/stage.js`: stage clock and boss progression
- `src/enemies.js`: enemy definitions and shared behavior rules
- `src/config.js`: game-wide configuration
- `src/state.js`: new save-data schema (not yet connected to the prototype UI)

## Deployment

The rebuild uses native browser ES modules and does not require a build step. Vercel should use the Other framework preset with the repository root as the output directory. Do not merge `rebuild-v1` into `main` until the prototype has been tested.

## Not yet implemented

Permanent account progression, save integration, character and pet collection, equipment inventory, gacha UI, online accounts, cross-device saves, rankings, chat, trading, and cooperative events are still pending.

Never place private server keys in browser code or in the repository.
