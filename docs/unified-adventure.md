# Unified cloud adventure

The default Cloudflare URL and `/play` now use `adventure-0.1.5`. The legacy `/dungeon` multiplayer prototype remains available with its existing identities and storage. The original 0.1.0 milestone introduced separate cloud test characters rather than importing old local/prototype saves. Subsequent ordinary releases preserve those cloud characters.

## Safe full-state transport in 0.1.5

A physical-phone report on 0.1.4 showed severe latency: most command round trips near 500ms, ping spikes to 1.6s and frequent soft position corrections, despite 19ms frame P95 and no baseline recoveries. The controlled traffic reduction did not establish acceptable production latency. The precise contribution of delta processing, server scheduling and network/platform latency is not yet isolated.

Delta generation is now disabled by default on the server, even if an older client requests it; new clients do not negotiate deltas. This returns the production path to complete world snapshots plus the existing compact movement acknowledgements and 0.1.3 input replay. Character storage, namespace, equipment, combat and UI remain unchanged. The codec remains available only to explicit in-process test fixtures; production bindings/config do not opt in. Prior delta-traffic reductions are historical test results, not the active production transport.

Diagnostics retain UTF-8 byte counts, identify `stateSync.mode` as `full-state`, count unframed complete snapshots and report `serverQueueMs` separately from client `queueMs`. An optional `edge` field identifies the Cloudflare ingress colo when supplied; it is not the Durable Object location. Timing zeros do not prove zero CPU/queue time. Actual phone recovery must be checked after refresh; no claim that this removes physical network latency.

## Delta world transport in 0.1.4

New unified clients negotiate `stateDeltas: 1` on their authenticated WebSocket. The first world snapshot is complete; subsequent packets carry only changed fields, including individual monster/member array fields. Unchanged equipment, inventory, warehouse, logs and events are retained locally. State is fully reconstructed before existing game/UI callbacks see it. Combat formulas, animations, 100ms world cadence, input replay and checkpoint rules are unchanged.

Each socket has an independent in-memory baseline and numbered frames. Map/role/room scope changes, large patches, periodic refresh and new connections send full snapshots. A missing baseline triggers one full-state recovery request; malformed/partial patches are not applied. Baselines are not written to character storage. Old clients that do not negotiate deltas continue receiving complete snapshots. The original legacy `/dungeon` prototype is retained.

Controlled 60-second comparisons encode the exact same authoritative snapshots both ways and verify every reconstructed field:

| World snapshot scenario | Full snapshots | Delta stream | Reduction |
| --- | ---: | ---: | ---: |
| Solo field movement, 600 snapshots | 3,183,631 bytes | 262,880 bytes | 91.7% |
| Two-player combat, both phones, 1,200 snapshots | 8,927,646 bytes | 970,425 bytes | 89.1% |

These measure world-state JSON including delta envelopes, not an entire production session or asset/protocol downloads. Existing compact movement acknowledgements are separate. Actual traffic depends on play; lower bytes do not reduce request counts or awake duration by the same percentage. Re-measure real phone reports and provider usage for capacity planning.

Diagnostics now count incoming UTF-8 JSON bytes (previous versions counted JavaScript string length, which undercounts Chinese text) and include `stateSync` full/delta frame and byte counts plus recovery attempts. This changes measurement accuracy; compare versioned reports accordingly.

Validation includes codec round trips, deletion/array/null/zero handling, per-socket isolation, backward compatibility, periodic/full recovery, private baseline isolation, actual WebSocket dropped-delta recovery without changing the panel/role, the full two-browser solo/dungeon/recovery flow, preserved UI and 150/300ms movement replay with real delta envelopes. `npm run test:sync` runs the codec and controlled traffic tests. Optional `tests/state-delta-browser.cjs` needs Playwright, Chromium and local Wrangler at `ADVENTURE_URL` (default port 8787).

## Solo input replay in 0.1.3

Solo joystick, screen drag and keyboard movement now integrate locally every frame. Direction changes do not wait for the old 400ms target-update cadence. Small movement frames are batched roughly every 120ms, with earlier direction/stop delivery; the server returns the last processed frame ID and authoritative position. The client replays remaining local frames, ignores minor differences and smoothly corrects meaningful differences. Invalid/large positions, map changes and death still obey server state. Client prediction stops after a prolonged missing acknowledgement.

The server accepts direction/time frames only, never uploaded positions, HP or rewards. It checks packet shape, increasing frame IDs, canonical collision/speed and a server-wall-time movement budget with at most 250ms of credit for jitter. Replayed frames cannot move twice. Missing frames are not extrapolated on the server. Map-scoped packets from the previous map are ignored after transition. Movement is checkpointed under the existing rules; combat, loot, inventory, warehouse and commerce remain authoritative.

Movement acknowledgements carry only position/ID metadata and do not trigger a full-world broadcast on every input. The existing 100ms world push remains. Input messages are more frequent than the old goal cadence, so previous request-only free-capacity estimates must be remeasured for this version. This is a targeted reduction of redundant movement responses, not a complete delta-state protocol or measured production traffic saving. Multiplayer keeps its established goal-based controls. Immediate attack animation prediction is not part of this movement release.

`tests/solo-input-browser.cjs` runs the real AdventureService with simulated 150ms and 300ms round trips. Both scenarios verify immediate starting, two quick direction changes, stopping, no large correction and unchanged rewards. Observed post-stop drift was zero in these controlled tests; this is not a guarantee for real mobile networks. `tests/solo-movement.test.mjs` covers replay, old responses, collision, disconnection and death. Real local Wrangler preservation tests also exercise left/right keyboard movement and saved cloud state.

## Interface preservation in 0.1.1

The original System button remains the entry for supply settings, save/backup, help, bestiary, journey records and data inspection. Connection diagnostics are a System tab. Opening panels does not pause either solo or multiplayer simulation. Hidden tabs pause solo simulation on the server; multiplayer rooms continue. Supply settings are validated and saved on the server, including live party settings. Creation allocation, bag categories, buy-ten/sell-all, warehouse bulk transfers, SVG navigation, original item-type symbols and village proximity interactions are retained.

Cloud data management is explicitly read-only for unauthenticated guests: viewing and exporting the authoritative catalog is supported, while editing live global balance requires a project deployment. Backup exports contain character/catalog data without credentials; role recovery uses the private access code. Creating another guest keeps the previous cloud role rather than deleting it.

Connected WebSocket commands preserve send order without waiting for each prior acknowledgement. Own movement uses the existing visual predictor directly, without an extra display smoothing layer; repeated route planning is cached. HP, item consumption and rewards remain authoritative. This reduces added client waits; it does not remove network latency. Diagnostics include active-frame and push-gap P95 values to distinguish rendering stalls from network round trips.

## Continuity and movement in 0.1.2

Ordinary releases retain the same browser guest key, `ADVENTURE` binding, `unified-v1` object and append-only migrations. This update does not reset characters or create a new namespace. Changing origin or losing browser storage can lose the local credential; the private recovery code restores the existing cloud role.

Actor walking phases now use stable map/actor identifiers rather than snapshot object identity. This keeps all six lateral step frames across server updates and local prediction frames. Monster movement directions use the same persistent history. Sprite art, scale, combat rules and balances remain unchanged. Unit regressions cover replacement snapshots, alternating steps, stopping, teleports and monster direction changes.

## Player flow

Create a guest, buy a short sword and cloth armor in the village facilities, equip them from the bag/character page, and go north to practice in the field. The village has a guild building and a guild entry in village facilities. Choose the cemetery expedition, create a two/four-person room or enter a friend's room number. Members enter automatically when the leader starts. The character's equipment, inventory, warehouse and progress follow the same identity throughout solo play and the dungeon. Victory retains the server-backed 60-second countdown and movement; early return is available.

The character page preserves thirteen equipment slots and the detailed portrait, with the six abilities in a separate view. The warehouse can deposit/withdraw items using the same shared Game rules. The map page sets a movement goal; it cannot teleport the player.

## Identity and recovery

A random guest pass is kept under a separate browser storage key for this adventure. The server stores its SHA-256 identity, not the pass. Character → Guest/save can copy a recovery access code. Keep that code private: it is a bearer credential, not a public room number. A new browser can restore a role from the create-character screen without creating another role first. The code is verified against an existing cloud role before replacing the browser identity. One connection per role is supported; restoring on a second device replaces the first connection.

Google and Apple account binding are not implemented. A browser that loses its guest credential and has no recovery code cannot prove ownership. Do not clear browser storage as a troubleshooting step.

## Authority and persistence

Both solo combat and multiplayer run on the server, using the same catalog and Game combat rules. Clients send goals, attack targets and commerce actions; they cannot upload gold, XP, equipment snapshots or item counts. Solo field monsters and their respawn timers persist with that role. There is no offline progression: an active connection is required.

The new SQLite Durable Object binding `ADVENTURE` uses the append-only `v2` migration, alongside the preserved `HUB`/`v1`. Inventory, equipment, warehouse and room data are saved together in a storage transaction. Transactions/consumables, economic changes and rewards are checkpointed before acknowledgement or publishing the changed world. Movement and transient combat state checkpoint every five seconds. A sudden process loss can roll back a few seconds of movement/HP. Failed storage writes do not return a successful purchase response and reload the last durable checkpoint.

A room locks village commerce/equipment changes until leaving. Joining/creating requires the role to be in the village. Leaving or automatic room expiry restores the same role to solo village play, without issuing dungeon rewards again.

## Capacity and deployment

Use the same `npm run build:cloudflare` and `npx wrangler deploy` configuration. No paid plan or manual database creation is required for this migration. Existing namespace bindings must not be deleted. Static assets include the existing map/actor atlases plus portraits; no source PNGs are downloaded by players.

The 30-guest test cap remains. Solo simulation now runs remotely, so earlier estimates assuming entirely local solo play do not describe this release. Field sessions keep the adventure service active; full-health/full-mana idle village roles can stop ticking. Re-measure mixed solo/dungeon traffic, CPU and SQLite writes before expanding capacity. This is not an offline mode or a validated 100-player service.

## Validation

Core, legacy API, transport, room and adventure unit tests pass (74 tests). Coverage includes rejected forged stats, authoritative solo rewards, item/equipment/warehouse persistence after restart, command replay, same-role dungeon transfers and rollback on failed checkpoints. Local Cloudflare tests use two independent mobile-size browsers to buy/equip, deposit and reload, kill a solo monster, enter the dungeon with the same characters, clear it, return, reload rewards/warehouse and restore the role through the recovery UI in a fresh browser. Additional regressions verify System tabs, persisted potion settings, monster previews, credential-free backup export, navigation/item icons, village context buttons, live solo panels, background pause/resume unit coverage and 350ms ordered-response latency injection. These are local tests, not a claim of cross-network phone performance or measured production billing.

Additional solo-input browser regression: `tests/solo-input-browser.cjs` (mock network with real service simulation). Optional browser regressions are included in `tests/adventure-preserve-browser.cjs` `tests/adventure-latency-browser.cjs` and `tests/adventure-motion-browser.cjs`. They require Playwright and a Chromium installation. The preservation test targets `ADVENTURE_URL` (default `http://127.0.0.1:8787/play`) with Wrangler running locally; `CHROMIUM_PATH` can select an existing browser. The motion test captures actual renderer inputs across 100ms replacement snapshots and verifies all six lateral frames for both player and monster. The latency test uses mocked WebSocket replies and local asset interception, with no cloud account needed.
