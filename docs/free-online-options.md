# 免費多人方案比較與容量推算

查核：2026-10-27，官方文件。這是服務商自有帳號的免費方案，並非Sites帳單承諾；本輪未開通任何付費方案。

| 方案 | 官方免費條件／主要上限 | 適用性與限制 |
|---|---|---|
| Cloudflare Workers + D1 | Workers 100,000請求/日、10ms CPU/次；D1讀5M列/日、寫100k列/日、總5GB | 現有請求式版本容易搬移；不能每幀寫DB，CPU須用雲端實測 |
| Cloudflare SQLite Durable Objects | 100k請求/日、13,000 GB-s/日；入站WebSocket訊息計費20:1、出站訊息不按請求收費 | 適合短命、伺服器判定的副本房間；需要自有帳號與DO綁定，Sites現有部署契約未提供該綁定；未部署DO |
| Supabase Free | Auth 50k MAU、DB500MB、一般egress5GB/月、Realtime 2M訊息/月、200尖峰連線；閒置1週暫停 | 匿名登入及綁定OAuth適合，頻繁廣播可能先碰訊息或流量；Realtime本身不替遊戲判定戰鬥 |
| Firebase Spark | Auth支援匿名及Google；Realtime DB100同時連線、1GB儲存、下載10GB/月 | 登入方便、30人容量小；DB不是可信戰鬥伺服器，Cloud Functions不是Spark免費可直接依賴的運算方案 |

來源：
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/realtime/pricing
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://firebase.google.com/pricing

## 目前輪詢版推算

30人×600副本秒=18,000玩家秒/日；2Hz上限約36,000狀態請求/日。加平均每5秒一次操作3,600次，以及未實作的單人每30秒檢查點1,200次，規劃約40,800請求/日；若所有副本時間都在每400ms送移動目標，約82,200次/日。未含重試、登入、載頁或同帳號其他專案；後者只剩約18%請求餘裕，不應直接提高輪詢到10Hz。

以本機短流程回應平均：雙人4144 bytes／四人4787 bytes；每日39,600次副本狀態／操作回應，月JSON約4.92GB／5.69GB。未含協定、圖片、初始下載、重試；Supabase一般egress5GB已偏緊。此估計沿用短樣本的回應大小，不等於實際30人整月帳單。真實RTT會令回應後500ms查詢的頻率低於2Hz。

同時最多4位副本玩家：2間雙人房或1間四人房，另8人單練，尖峰合計12人。每日全員滿隊副本房總時數2.5h（雙人）／1.25h（四人），月75h／37.5h；四人同步較複雜，不代表消耗減半。

DO若按每活躍房128MB保守估算，房間活躍日GB-s約1152（雙人）／576（四人），對照13,000GB-s免費量約9%／4.5%；只是架構估算，尚未實作或量測DO。不能只看WebSocket20:1而漏算房間持續運作時間。

Supabase若集中由伺服器每房2Hz發布，發送與每位接收皆可能計訊息，兩人月約1.62M、四人約1.35M；再加玩家控制與重連，2M免費量並不寬裕。若改成每位玩家自行廣播位置，扇出會進一步增加。具體須依實作的Realtime計數規則實測。

## 建議

目前先用可發布的Sites＋D1版本完成雙人實機，保留傳輸量測。若體感仍受查詢間隔／資料庫往返影響，正式多人優先比較Cloudflare DO WebSocket房間，Auth另用Firebase或Supabase；不再以提高HTTP輪詢頻率硬撐。Google／Apple綁定選定服務後才接，需專案設定；免費不能保證永久、服務商條款可能變動。

未完成項目：雲端D1 meta長期採樣、CPU/次、實際4G/Wi-Fi延遲、10分鐘與長時混合負載、服務商帳號的實際額度與超額行為。未宣稱30人已壓測通過，沒有將本機RTT當跨網路延遲。
