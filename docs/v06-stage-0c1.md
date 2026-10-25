# V0.6 0C-1：獨立裝備測試介面

起點 `fa40a81b8e93fb2447a8bb4099bac697dd7073e9`，分支 `refactor/l1j-core`。
本階段只新增隔離瀏覽器測試入口及 Adapter；沒有載入／修改 V0.5.83、正式角色、HUD、Combat、Canvas、地圖或存檔。沒有新舊角色同步機制。

## 開啟及操作

在專案根目錄執行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8000/dev/core-equipment.html`。使用 localhost HTTP 或 HTTPS，不以 file:// 開啟；ES Modules、fetch 與 Web Crypto 需要適當的瀏覽器來源環境。

頁面沿用人物裝備在左、背包在右的測試配置概念；窄螢幕改為上下排列。沒有遊戲場景、完整人物介面或美術改版。原測試頁保持不變。

選擇場景，在背包選目標槽再按「穿戴／替換」，從左側部位按「卸下」。戒指必須明確選ring1或ring2；不自動替換另一槽。「重新載入場景」會丟棄本次測試操作、建立同一固定場景，不讀取正式角色。錯誤原因顯示在上方。

## 資料及指紋

- `item-catalog-pin.mjs` 固定 baseline 的 manifest 與34個分片 SHA-256。catalogVersion 是排序後檔名／指紋清單的 SHA-256，載入時也重新核對此根指紋。
- `item-catalog.mjs` 驗證 bytes，再解析 JSON、來源目錄、表格、欄位數與列數；沿用舊catalog的數字轉換規則，交由同一createItemCatalog建立2992筆唯讀模板。
- `core-equipment-scenarios.json` 自身也有固定SHA-256，catalogVersion必須相符。改檔、缺檔或載入錯誤會停止初始化；不提供備援數值。
- 場景使用的24種物品完整SQL列，已逐欄比對 `nonono44/l1j-tw-99nets` SHA `8aa24617476a7d8f6a7072687279c77cf9f3d405` 的 `L1J-TW_3.80c/db/Taiwan/{armor,weapon}.sql`。固定rowHashes供離線回歸；未重新宣稱全部2992列都完成上游複核，也不宣稱為台灣官方公式。
- 沒有在fixture複製或覆寫任何物品能力／限制。角色基礎容量、目前HP／MP、測試實例數量是明確場景設定，不是新成長公式、真實角色所有權或舊存檔遷移證據。各等級EXP起點取自不變的V0.5.83表格。

## 十個場景

| 場景 | 來源與驗證內容 |
|---|---|
| 基礎騎士 | Lv1無物品，HP16／MP1固定起點；只顯示Snapshot |
| 套裝A | 原抗魔力量裝10件，Lv30；可逐件卸下與再穿戴 |
| 套裝B | 原武官敏捷裝10件，Lv40符合SQL最低等級；初始上限HP185／MP80、AC-10 |
| 等級不足 | Lv30穿20020武官頭盔（最低40）；失敗保留原20011頭盔 |
| 同款雙戒指 | 20280滅魔戒指兩個不同實例，明確選槽；拒絕同一實例再次穿戴 |
| 增加上限 | 20316靈魂腰帶HP+25／MP+25；80／10目前資源不補滿 |
| 卸裝截斷 | Lv45穿20075死亡斗篷HP+100／MP+50；固定目前180／60，卸下後100／20，只截斷一次 |
| 替換與回滾 | Lv45以20113武官護鎧替換20110抗魔法鏈甲；嘗試20092古老皮盔甲（騎士不可穿）失敗不改狀態 |
| 武器解析 | 31長劍、42細劍由實際實例解析；卸下回null，不回退測試武器 |
| 所有權 | 另一角色持有細劍，本角色背包不顯示它；拒絕案例按鈕嘗試穿戴時回ITEM_NOT_OWNED |

MR／ER／負重依Snapshot狀態顯示「未實作」，不將null轉為有效0。SQL直接裝備加總與最終MR等公式不是同一欄位。

## 寫入權與生命週期

每個場景只有一個createGame實例。Controller只初始化固定場景、讀Snapshot、發equipItem／unequipItem及訂閱；所有人物、部位、物品列表與數值皆由Snapshot渲染，不自行計算HP／MP／AC或裝備能力。

固定場景定義是凍結的初始化資料，不隨操作更新，不是另一份目前角色。背包顯示全部持有物（含穿戴物）並註記部位，引用同一instanceId。

切換時先成功建立新核心，再取消舊訂閱，才切換當前實例；失敗不拆掉原有效場景。dispose移除通知和DOM事件。createCore注入點僅供測試監測真實核心的訂閱數，沒有正式頁面的第二個寫入者。舊升級／領裝／存檔handler完全不載入。

## 測試

```sh
npm test                   # 全部舊測試及新增Node Adapter整合
npm run test:integration    # Node：資料驗證、Controller交易及生命週期
npm run test:browser        # 可選：安裝環境已有Playwright與Chromium時的真實瀏覽器
```

未新增框架或npm套件。browser測試使用環境已有的Playwright及`/usr/bin/chromium`，可用CHROMIUM_PATH指定已安裝的執行檔；缺少時明確SKIP，不算瀏覽器通過。測試只開本機臨時HTTP服務，結束自動關閉，不部署。

- **Node**：原101項保持不變；新增30項Adapter測試。檢查固定資料、竄改拒絕、真實模板、十場景、交易成功與失敗、替換／雙戒指、上限政策、唯讀、100次render、切換訂閱及舊遊戲依賴隔離。
- **桌面尺寸Headless Chromium**：實際模組載入與DOM點擊、左右排列、十場景、交易及資料竄改拒絕。顯示與等價輸入的獨立Node核心Snapshot比對；該比對核心只存在測試程式，不在頁面中另建權威狀態。
- **390×844 Chromium**：上下排列、無水平溢出、戒指明確選槽可操作；不是iPhone或Safari。
- **iPhone Safari**：尚未實測。沒有把Node／Chromium通過當成Safari驗收。

測試瀏覽器使用全新context，預放假的正式保存鍵哨兵並封鎖所有Storage寫入；操作後必須保持不變。資料及核心測試不連外部網路，只有本次開發時的選定SQL來源複核使用固定GitHub SHA。

CI只追加Node Adapter整合步驟，沒有瀏覽器下載、推送、部署或合併。此階段只建立本機提交，遠端Actions未執行新提交。

## 仍未完成／0C-2阻礙

正式遊戲D001～D005仍保留TODO。沒有正式角色捕捉、損傷／恢復／升級交易、Combat接線或保存切換。先前發現的等級EXP跨欄位驗證缺口未順便修改。新Adapter已固定此測試路徑的catalog內容身份，但不代表任意其他host傳入的catalog都可信。

0C-2仍需可信舊資料與實例ID、處理缺originalStats／物品／穿戴證據、以交易接管受傷／恢復／升級，以及一次轉移正式角色領域寫入權；不得沿用兩份可寫狀態作長期同步。MR／ER／負重／效果仍需另行完成相容輸入與規則驗證。沒有推測歷史物品，也沒有更換任何L1J公式。
