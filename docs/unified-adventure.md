# Unified cloud adventure

The default Cloudflare URL and `/play` now use `adventure-0.1.0`. The legacy `/dungeon` multiplayer prototype remains available with its existing identities and storage. This release starts fresh cloud test characters rather than importing older local or prototype saves.

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

Core, legacy API, transport, room and adventure unit tests pass (46 tests). Coverage includes rejected forged stats, authoritative solo rewards, item/equipment/warehouse persistence after restart, command replay, same-role dungeon transfers and rollback on failed checkpoints. Local Cloudflare tests use two independent mobile-size browsers to buy/equip, deposit and reload, kill a solo monster, enter the dungeon with the same characters, clear it, return, reload rewards/warehouse and restore the role through the recovery UI in a fresh browser. These are local tests, not a claim of cross-network phone performance or measured production billing.
