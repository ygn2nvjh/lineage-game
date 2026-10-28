# Cloudflare WebSocket deployment

The current default entry is the [unified cloud adventure](unified-adventure.md) at `/play`. The text below documents the preserved `/dungeon` prototype. Both deploy together; the new adventure adds the ADVENTURE SQLite binding with migration v2.

This is a separate multiplayer test deployment. The existing solo game and HTTP guild site are preserved. A new domain uses a separate browser guest identity; existing characters are not automatically migrated. Google/Apple account linking is not enabled.

## Deploy from GitHub

Use a Free Cloudflare account and Workers Git integration. Select this repository and use:

- Project name: `lineage-game` (matches wrangler.jsonc).
- Build command: `npm run build:cloudflare`
- Deploy command: `npx wrangler deploy`
- Repository root directory: `/` (default).

The committed lockfile installs a pinned Wrangler. SQLite Durable Object migration `v1` creates the HUB binding automatically; no D1 database, domain purchase, API token shared in chat or paid Workers plan is required. Do not use the default `npm run build`: that builds the separate solo artifact.

Open the resulting workers.dev URL at `/dungeon`. `/health` identifies online-0.3.1-ws. Deploying does not prove acceptable mobile latency: compare two phones on different networks using the connection diagnostics. No existing Sites URL is automatically redirected.

## Release 0.3.1

Starting a room closes the guild panel for all members automatically. Victory keeps survivors in the dungeon with authoritative movement until the server deadline. A fixed countdown appears in the top-right HUD even when transient messages hide the journey bar; diagnostics and reloads do not reset the deadline. The diagnostic report includes the client version, room deadline and elapsed session seconds for traffic analysis.

## Runtime

A single SQLite-backed Durable Object coordinates up to 30 test guests and eight rooms, each with two or four members. This is intentionally a bounded friends-test architecture, not a large public MMO service. It uses the existing authoritative Game formulas and art. Clients cannot submit HP, equipment, gold or experience.

The WebSocket is authenticated in its first frame using the browser's random guest pass. Passes are not placed in URLs; only hashes are stored. The Worker accepts same-origin WebSocket handshakes. One active connection per guest avoids conflicting phone tabs. Room numbers locate rooms and do not authorize access to another character.

Combat advances in memory every 100ms while players are connected. State is pushed at 10Hz; client movement prediction remains visual only. Reads/movement do not make remote D1 calls. A SQLite transaction checkpoints users and rooms every five seconds, on room transitions and consumable use, and before publishing a successful reward settlement. Process failure may lose up to five seconds of movement/combat; acknowledged consumable use and settled rewards have already been saved. No connected combat means the timer stops, allowing hibernation. Expired rooms are also cleaned on the next command.

The expanded cemetery is 960 by 1600 world units. Three skeleton encounters are spaced apart, the entrance is outside their initial aggro range, and formal aggro/leash rules limit pursuit. Winning saves rewards and allows a 60-second exit buffer, with early exit available. Refreshing does not extend the deadline. The clean central viewport remains 15 by 15 tiles.

## Free-tier evaluation

Cloudflare's documented free SQLite DO limits include 100,000 requests and 13,000 GB-s per day; incoming WebSocket messages are billed at a 20:1 ratio and outgoing messages do not count as requests. Active sockets plus a combat timer still consume duration. These limits are provider policy, not a promise of perpetual free service.

With 30 players each spending 10 minutes/day in full rooms, room time is roughly 2.5 hours/day for pairs or 1.25 hours/day for four-player teams. Our shared hub may overlap those rooms; it is one object with a 128MB billing allocation. If all sessions were sequential this is roughly 1,125 GB-s/day before buffers and overhead, below the documented 13,000 free daily allowance. If the hub stays awake all day it would consume about 10,800 GB-s, leaving little margin; monitor actual usage and keep the Free plan.

Ten-Hz full snapshots increase downstream game-state traffic compared with the HTTP prototype. Art is downloaded as static assets once/cached; it is not sent each frame. Actual WebSocket payload totals are visible in diagnostics. Do not apply the previous HTTP traffic estimate unchanged. After two-phone tests, measure a ten-minute session and consider delta snapshots / a lower remote-state rate if necessary.

The solo cloud-save/authentication service, 30-user load endurance, real mobile latency, and provider billing are not validated by local tests. Guest caps/rate limits are basic protection, not full public abuse prevention. Never delete the HUB namespace/migration to "reset" a deploy: doing so loses cloud test roles.

Official references:
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/workers/ci-cd/builds/
