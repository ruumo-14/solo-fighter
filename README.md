# SOLO FIGHTER

SOLO FIGHTER is an original browser-based side-view action game for solo play, with friend events and competitive features planned.

## Development branch
The rebuild is in `rebuild-v1`. The existing `main` branch remains unchanged.

## Design source of truth
See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the consolidated decisions from previous design sessions and the 80-question design pass.

## Current playable prototype
- Side-view action combat, movement, jump, and melee attack
- Four enemy behavior types; aerial charger retreats when interrupted
- Bosses at 2:00, 4:00, and 6:00; clear after all three are defeated
- Seven-minute stage limit
- Experience, level-ups, three-choice run upgrades
- Local stage progression and 魔晶 rewards

## Implemented foundations
- Game configuration for rarity, gacha rates, equipment slots, level caps, and modes
- Local data-operation functions for collection, equipment, skills, missions, achievements, titles, rankings, market listings, chat history, and event claims
- Initial Supabase schema for accounts, saves, inventory, chat, market, rankings, and related data

## Important distinction
The foundations and design records do not mean every system is already playable or online. The remaining screens, actual content data, trusted server transactions, Supabase setup, and end-to-end tests are tracked in [REBUILD_STATUS.md](REBUILD_STATUS.md).

Never put Supabase `service_role` keys in browser code or the repository. Currency, gacha outcomes, trades, rankings, and account privileges must be validated server-side.
