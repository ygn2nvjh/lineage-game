# 暮色村莊・最初的遠征

原創瀏覽器 RPG：安全村莊補給、墓園打怪、經木橋進入密林，再回城整備。

## 開發與建置

需要 Node.js 24；執行 `npm test` 驗證核心規則，`npm run build` 建立 dist/index.html。可用 `npm start` 在本機開啟遊戲。建置後的 HTML 包含執行素材，無須外部遊戲服務。

## 資料

程式在 src，武器、道具、怪物、商店、地圖及公式在 data/game/catalog.json。assets 包含執行圖集與原始美術。scripts/prepare-world.py 和 prepare-monsters.py 可重新打包地景與怪物。

人物等級、裝備、背包等個人進度保存在各自瀏覽器；請使用遊戲系統選單匯出完整備份。GitHub 原始碼不會自動包含玩家存檔。

此公開版本不含私人部署設定、內部操作紀錄或實際玩家存檔。

## 0.9.0

新增免費個人倉庫（村莊建築或商店的倉庫分頁）、男女精細全身立繪、局部樹冠透明、城門分層與暗夜狼人朝向修正。舊角色自動升級，保留等級、裝備、財物與自訂平衡。角色及倉庫仍存於原瀏覽器，換裝置請先匯出完整備份；此版為單人遊戲。

遊玩：https://lineage-first-expedition.pearlymoth33.chatgpt.site

## 0.10.0 多人訪客測試

商店新增公會入口，獨立雲端訪客角色可參加雙人／四人房間；詳見docs/online.md。Google／Apple尚未接入，原本單人進度不會自動上雲。

## online0.2

新增移動預測、狀態／輸入分流、待送目標合併與分段連線診斷，見docs/latency.md。尚未部署WebSocket，真機RTT待驗證。

## WebSocket multiplayer deployment

Cloudflare Workers + SQLite Durable Object test setup: [docs/cloudflare.md](docs/cloudflare.md). Use `npm ci` then `npm run build:cloudflare`. This separate deployment preserves existing solo/browser characters.

For an existing Worker newly connected to GitHub, push a repository change after connecting to trigger its first build. Cloudflare documents build history under the bottom of the Worker's Deployments tab; it is not a separate top-level Builds tab. See the [official build setup](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Unified cloud character

The default Workers URL and `/play` now share a single cloud role across village facilities, solo combat and party dungeons. See [the unified adventure guide](docs/unified-adventure.md). Guests can back up a private recovery access code; Google/Apple binding is not enabled. The old `/dungeon` prototype is preserved.
