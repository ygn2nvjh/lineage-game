# V0.6 stage 0C-2A: isolated HUD integration

Source baseline: `lineage_v0583.html` at `bb4a13f0765ae12b134a3fb98088f4879fc3778d`.
Starting refactor commit: `9ea5aabd19ed6d7d8b17db2b82434ab675c6be3e`.

## Scope and authority

Open `dev/core-hud-integration.html` through an HTTP server, e.g. run
`python3 -m http.server 8000 --bind 0.0.0.0` from the repository root, then open
`http://localhost:8000/dev/core-hud-integration.html` on the server computer.
For iPhone testing use an authorized HTTPS static host containing the same directory
structure. Plain LAN HTTP may lack Web Crypto; file:// is unsupported. This stage
itself does not publish a site or update the preview repository.

The page borrows the dark/gold palette, HUD values and character/equipment/bag
field concepts of V0.5.83. It contains no map, Canvas, game loop or legacy script.
No localStorage API, old character key, save function or legacy character object
is used by the runtime. Merely using a different URL path would not isolate storage.

The existing pinned catalog loader and fixed 0C-1 scenarios initialize one active
core. These are declared test scenarios, never a claimed migration of real saves.
Changing scenarios disposes the old subscription before activating the new one.
The existing controller delivers one immutable snapshot per successful transaction
to a coordinator which passes that exact reference to HUD, character, equipment
(including bag) renderers. Only UI panel visibility is independently mutable.
Equipment legality, resources and ownership remain exclusively in the core.
All slots are selectable; invalid choices return the core error without partial
view updates. Explicitly select the target slot, including ring1/ring2.

EXP is shown only as the snapshot's raw cumulative value, labelled with the
outstanding level/EXP consistency limitation. No progress percentage is invented.
MR, ER, weight and effects display 未實作. No damage, healing, level, experience,
item-grant, save migration or persistence command is introduced.

## Automated validation

- `npm test`: existing tests plus coordinator/controller tests.
- `npm run test:browser`: existing Chromium tests plus actual HUD DOM operations.
- Node tests compare all three callback references using strict identity, not just
  revision. Frozen input and repeated-render invariance are tested.
- Chromium compares displayed values/slots/owned items with an independent actual
  core test oracle given identical commands; it is not another app state.
- Chromium prohibits Storage getItem/setItem/removeItem/clear/key and animation
  frame calls from page initialization onward, across scene changes, actions,
  panel toggles, reload, and initialization failures. The test waits by timer
  polling to avoid Playwright itself using the forbidden animation frame API.
- Disabled fieldsets are inspected by their disabled attribute; descendants are
  thereby disabled by HTML semantics. No failed test is skipped to achieve a pass.

The five pre-existing D001–D005 TODOs remain unresolved in the formal game;
P001–P004 remain skipped. This integration does not claim to fix them.

## iPhone Safari acceptance (pending user execution)

1. Open the entry over HTTPS; verify successful initialization and no console errors.
2. Check portrait layout, touch targets, selectors and panel scrolling.
3. Choose weapon-resolution: equip long-sword then rapier in weapon; all views agree.
4. Choose double-rings: equip ring-a in ring1 and ring-b in ring2; try the same
   instance twice and confirm rejection with unchanged values.
5. Choose replace-rollback: replace body, then try forbidden body; confirm rollback.
6. Choose level-restricted and reject the level-40 head item.
7. Choose capacity-increase (belt) and capacity-clamp (unequip cloak); verify
   no healing on increase and a single current-resource clamp on decrease.
8. Toggle panels, rerender, switch apps and return; values remain consistent.
9. Reload: fixed basic scenario resets, no formal save is loaded or written.
10. Test blocked/tampered catalog or scenario via a controlled test host/network
    override: initialization stops visibly with controls disabled, no fallback.

Chromium mobile viewport results are not iPhone Safari acceptance.
Rollback: leave this isolated entry and open unchanged lineage_v0583.html. No
save conversion or downgrade is necessary; no automatic fallback engine starts.

## Recorded local verification

- Full Node: 141 tests, 132 pass, 0 fail, 5 pre-existing TODO, 4 pre-existing skip.
- Full installed Chromium: 7 tests, 7 pass, 0 fail, 0 skip (4 prior + 3 HUD).
- V0.5.83 byte comparison against baseline succeeded; SHA-256:
  `59c9e69024b0f13b770dde95d9c28ecd113252ff56f57aed2375a25e095773c0`.
- No existing core, catalog, scenario, game or previous test file was changed.
- Safari verification of this entry remains pending; no hosted URL is published.
