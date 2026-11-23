# SOLO FIGHTER — Clean Rebuild

This work is being developed on the `rebuild-v1` branch. The existing `main` branch is left untouched as the rollback point.

## Confirmed core rules

- Side-view action combat.
- Stage-based progression; cleared stages can be replayed.
- Stage timer: maximum 7 minutes (420 seconds).
- Bosses appear at 2:00, 4:00, and 6:00. The stage clears after the final boss is defeated.
- Initial stage progression is prepared for 20 stages and can expand through updates.
- Primary currency: 魔晶.
- Rarities: ノーマル / レア / エピック / レジェンド / S1.
- Equipment slots: 頭 / 胴 / 脚 / 足 / 手 / 武器.
- Equipment upgrade cap: Lv.10.
- Pet level cap: Lv.20.
- Character level cap: Lv.100 for the current design.
- Normal gacha: items 50%, Normal 10%, Rare 35%, Epic 4%, Legendary 1%.
- S1 gacha: items 50%, Normal 10%, Rare 33%, Epic 4%, Legendary 2%, S1 1%.
- Separate 100-pull pity counters for each banner.

## Implementation order

1. Core state, configuration, and save schema.
2. Combat engine and stage/boss progression.
3. Character, pet, equipment, skill, and gacha systems.
4. Modes, missions, achievements, titles, events, and rankings.
5. Server-backed accounts, persistence, chat, trading, and cooperative events.
6. Testing, balancing, and deployment.

## Important

- Do not overwrite `main` during development.
- Do not expose server secrets in browser code.
- Online rewards and gacha results must be validated server-side.
- Existing browser saves are not automatically migrated into the new save schema.
