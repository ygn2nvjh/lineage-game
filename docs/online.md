# 多人副本測試

正式遊戲商店的公會分頁可進入訪客多人測試。

副本網址：https://lineage-party-proof.pearlymoth33.chatgpt.site/dungeon

- 支援2／4人房號、至少2人開始，無門票等級限制。
- 使用獨立雲端訪客角色；原本單人瀏覽器角色保留，沒有匯入客戶端財物。
- 共用Game正式戰鬥、命中、傷害與成長；伺服器判定位置、血量與通關獎勵。
- 房間與玩家分表，CAS與D1 batch交易保存；刷新不重複領獎，隊長離開交接，45秒掉線停止自動攻擊，20分鐘房間過期。
- 當前HTTP回應後500ms再同步，非WebSocket。Google／Apple未啟用；清除瀏覽器訪客資格可能失去角色存取。
- 四人與雙人獨立瀏覽器已通關，尚需兩支真實手機跨網路量測；未宣稱30人長時負載通過。

`npm run test:online`驗證API與房間規則；`npm run build:online`建立dist-online/worker.mjs。自行部署需要D1綁定DB、套用tests/fixtures/online.sql所示schema（正式使用請保留逐版遷移），以及GAME_ASSET_ORIGIN所指定靜態站的/game-assets。建置主遊戲會產生靜態圖片。

服務商免費額度與用量推算見free-online-options.md；並非目前託管服務的免費帳單保證。

目前版本online0.2，延遲與診斷修正見latency.md；HTTP改為查詢起點500ms節奏，不再回覆後額外等待。
