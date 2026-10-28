# Unified cloud adventure

The default Cloudflare URL and `/play` now use `adventure-0.1.1`. The legacy `/dungeon` multiplayer prototype remains available with its existing identities and storage. This release starts fresh cloud test characters rather than importing older local or prototype saves.

## Interface preservation in 0.1.1

The original System button remains the entry for supply settings, save/backup, help, bestiary, journey records and data inspection. Connection diagnostics are a System tab. Single-player panels and hidden tabs pause solo simulation on the server; multiplayer rooms continue. Supply settings are validated and saved on the server, including live party settings. Creation allocation, bag categories, buy-ten/sell-all, warehouse bulk transfers, SVG navigation, original item-type symbols and village proximity interactions are retained.

Cloud data management is explicitly read-only for unauthenticated guests: viewing and exporting the authoritative catalog is supported, while editing live global balance requires a project deployment. Backup exports contain character/catalog data without credentials; role recovery uses the private access code. Creating another guest keeps the previous cloud role rather than deleting it.

Connected WebSocket commands preserve send order without waiting for each prior acknowledgement. Own movement uses the existing visual predictor directly, without an extra display smoothing layer; repeated route planning is cached. HP, item consumption and rewards remain authoritative. This reduces added client waits; it does not remove network latency. Diagnostics include active-frame and push-gap P95 values to distinguish rendering stalls from network round trips.

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

Core, legacy API, transport, room and adventure unit tests pass (50 tests). Coverage includes rejected forged stats, authoritative solo rewards, item/equipment/warehouse persistence after restart, command replay, same-role dungeon transfers and rollback on failed checkpoints. Local Cloudflare tests use two independent mobile-size browsers to buy/equip, deposit and reload, kill a solo monster, enter the dungeon with the same characters, clear it, return, reload rewards/warehouse and restore the role through the recovery UI in a fresh browser. Additional regressions verify System tabs, persisted potion settings, monster previews, credential-free backup export, navigation/item icons, village context buttons, solo pause/resume and 350ms ordered-response latency injection. These are local tests, not a claim of cross-network phone performance or measured production billing.

Optional browser regressions are included in `tests/adventure-preserve-browser.cjs` and `tests/adventure-latency-browser.cjs`. They require Playwright and a Chromium installation. The preservation test targets `ADVENTURE_URL` (default `http://127.0.0.1:8787/play`) with Wrangler running locally; `CHROMIUM_PATH` can select an existing browser. The latency test uses mocked WebSocket replies and local asset interception, with no cloud account needed.
