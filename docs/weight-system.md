# 負重系統：L1J-TW 3.80c 核對與實作規格

狀態：來源核對完成第一輪；**尚未核定完整玩法、尚未接入背包與攻擊禁止邏輯**。原始碼取自 nonono44/l1j-tw-99nets 的 L1J-TW_3.80c。

## 來源
- model/L1PcInventory.java：getWeight242、calcWeight242、checkAddItem
- model/L1Attack.java：calcPcNpcHit、calcPcPcHit 的負重命中
- model/HpRegeneration.java：isOverWeight、HP 恢復
- model/MpRegeneration.java：isOverWeight、MP 恢復
- clientpackets/C_Attack.java：超重禁止一般攻擊

## 內部數值
- 正常負重：weight242 = round((getWeight() / getMaxWeight()) * 242)，Java Math.round；高於最大負重設 242；Config.RATE_WEIGHT_LIMIT==0 則為 0。
- 對外顯示百分比：getWeight()/getMaxWeight()*100；內部仍使用 weight242。負重單位、最大負重計算及裝備/技能容量加成待另查。
- 注意：原始碼 `(weight * 100 / maxWeight) * 242.00 / 100.00` 的運算以 double maxWeight 執行。

## 懲罰及門檻（精確使用內部數值）
| 條件 | 效果 | 來源 |
|---|---|---|
| 0–80 | 命中無負重懲罰 | L1Attack |
| 81–121 | 命中 -1 | L1Attack |
| 122–160 | 命中 -3 | L1Attack |
| 161–200 | 命中 -5 | L1Attack |
| >=201 | 此段無額外命中懲罰分支；但一般攻擊早已被禁止 | L1Attack + C_Attack |
| >=120 | MP 自然恢復：一般基礎恢復及正向裝備恢復被抑制；負值裝備恢復仍可生效 | MpRegeneration |
| >=121 | HP 自然恢復：一般基礎恢復及正向裝備恢復被抑制；負值裝備恢復仍可生效 | HpRegeneration |
| >=197 | C_Attack 一般攻擊禁止，送訊息 110 | C_Attack |
| 新增物品後 >=242 | checkAddItem 拒絕增加物品 | L1PcInventory |

### HP/MP 超重例外
- HP：EXOTIC_VITALIZE、ADDITIONAL_FIRE 或裝備 item 20049（Golden Wings）使 isOverWeight 回傳 false。
- MP：EXOTIC_VITALIZE、ADDITIONAL_FIRE 使 isOverWeight 回傳 false；**未見 Golden Wings 例外**。
- 飢餓（food < 3）也抑制自然恢復，但與負重是獨立條件。
- 注意「自然恢復停止」不是絕對無任何 HP/MP 變動：裝備負向恢復、其他環境減血等仍可能作用。

## 目前《類天堂》實作狀態
- V0.5.28 已有 lineageWeightHitPenalty(weight242)；尚未接通真實物品重量、最大負重、HP/MP 自然恢復、197 攻擊限制、242 撿物限制及畫面百分比。
- 待辦：資料庫 item.weight → 背包總重；角色最大負重；統一 weight242 換算；負重顯示；攻擊及撿物攔截；HP/MP regen 與例外；測試邊界值 80/81、119/120/121/122、160/161、196/197、200/201、241/242。
- 未核對：負重對移動速度、施法、道具使用等其他系統的影響；不可直接宣稱有這些懲罰。

## V0.5.30：最大負重公式已核對
來源：`model/Instance/L1PcInstance.java#getMaxWeight()`。
```
base = 150 * floor(0.6*STR + 0.4*CON + 1)
reduction = 1 + armorWeightReduction/100 + dollWeightReduction/100 + 0.04*(originalStrWeightReduction + originalConWeightReduction)
maxWeight = (base*reduction + (DECREASE_WEIGHT active ? 180 : 0))*Config.RATE_WEIGHT_LIMIT
```
V0.5.30 加入 `lineageMaxWeight(character)`，僅當 STR、CON 存在時回傳計算值。未接通的裝備/娃娃/技能補正預設為 0，伺服器倍率暫設 1（測試假設，非原服實際設定）。只有 inventoryWeight 是有限數值時，才使用最大負重計算 weight242；尚未核對物品重量資料，不假造背包總重。待續：原始 item SQL 重量、物品數量及背包接線。

## V0.5.31：掉落物品 SQL 重量資料
- 已從 L1J-TW_3.80c/db/Japan/MyISAM/{etcitem,weapon,armor}.sql 提取目前 L1J_DROPS 中全部 113 個 itemId 的 `weight` 欄位，保存於 `data/item-weights.json`；113/113 均找到。
- 背包顯示已核對戰利品重量小計，採 `sum(trunc(item.weight*count/1000))`，單位與 L1J 背包重量一致。
- **尚未接入角色完整負重**：藥水、裝備及其他物品重量尚未整合；未將小計寫入 character.inventoryWeight，避免錯誤觸發命中/恢復/禁止攻擊等懲罰。
- 待辦：核對目前測試武器與藥水 itemId、實際背包存取及重量加總、撿物前重量上限檢查、負重百分比 UI、HP/MP 恢復限制、禁止攻擊。

## V0.5.32：已知背包重量動態計算
- `data/item-weights.json` 加入短劍 24=30000、細劍 42=60000、紅水 40010=3900、透明藥水 40012=5850（測試白水暫映射）。
- `lineageInventoryWeight()` 加總目前戰利品、測試武器、紅水與白水的 L1J 重量單位；`lineageLiveWeight()` 配合角色 STR/CON 計算最大負重及 weight242。
- `lineageWeightState()` 在可取得完整測試物品及角色屬性時使用即時負重，命中公式會取得即時懲罰；`strike()` 新增 >=197 的禁止攻擊判定。
- 背包顯示重量、最大負重、比例與命中補正。
- **限制**：角色屬性如未以 `character.stats.str/con` 提供，負重仍顯示等待資料；尚未包含其他裝備與物品、未做 >=242 撿物拒絕、HP/MP 自然恢復限制與技能例外。測試背包重量不是完整真實遊戲角色重量。

## V0.5.33：怪物戰利品負重上限
- 已核對角色建立資料以 `stats.str`、`stats.con` 保存，供 `lineageMaxWeight()` 取用。
- 怪物自動取得戰利品前，以當前已知背包重量加上物品 SQL 重量，並依 `L1PcInventory.checkAddItem` 的 `+1` 預估及 `weight242>=242` 條件阻止取得；被拒絕的物品會提示數量，但不留在地面。
- 修正 `lineageWeightState` 備援計算原先誤要求 `maxWeight` 欄位已存在的問題。
- 仍未涵蓋未建模裝備/物品、完整 HP/MP 自然恢復與其技能例外；背包負重上限目前僅於已取得角色與重量資料時生效。

## V0.5.34：HP/MP 自然恢復測試邏輯
- 原始碼來源 `model/HpRegeneration.java`、`model/MpRegeneration.java`：HP 等級恢復門檻（騎士 >=30 使用 2*4 點）、MP 64 點，`run()` 每次累積 `_curPoint`（預設 4）。
- 原型 `lineageRegenStep(dt)` 暫用每秒累積 4 點，**一秒排程尚未從伺服器排程核對，不代表正式 L1J 恢復時間**。
- HP 在負重值 >=121 時停止正向基礎恢復；MP 在 >=120 時停止。EXOTIC_VITALIZE / ADDITIONAL_FIRE 可豁免兩者；黃金之翼（item 20049）只豁免 HP。例外旗標已預留 `character.regenBonuses`，尚無遊戲操作介面。
- 原型角色 MP 使用 `baseMaxMp` 初始化，沒有完整 MP 消耗及 UI；HP/MP 恢復量尚未涵蓋原始碼所有加成、負向裝備效果、飢餓、水中等情境。
- 下一步：核對 L1J 排程呼叫頻率、完善恢復公式、裝備/技能/飽食度條件與可見 MP UI。

## V0.5.35：左上角 HP/MP HUD 與恢復週期核對
- HUD 左上角保留角色名稱、HP 紅條、MP 藍條與 `HP current/max　MP current/max` 數值；移除擊殺數與紅水數量（快捷藥水數量不變）。
- `L1PcInstance.java#startHpRegeneration()` 和 `#startMpRegeneration()` 均以 `scheduleAtFixedRate(...,1000,1000)` 每 1000ms 執行，確認 V0.5.34 原型採用的一秒排程週期。
- HP/MP 恢復量及其他情境仍是部分模擬，尚待逐項核對原始碼；MP UI 已連動實際 MP 數值。

## V0.5.36：EXP HUD 整合及恢復公式核對
- 左上 HUD：EXP 條移到 HP/MP 下方，只顯示本等級 EXP 百分比（4 位小數），不再顯示原始經驗數字。`人物／裝備` 增加本級經驗值/需求值/距離升級詳細數據。XP 條寬度 142px 與 HP/MP 對齊。
- 已核對 `HpRegeneration.java#regenHp`：Lv>11、CON>=14 時 `maxBonus=min(CON-12,14)`，`Random.nextInt(maxBonus)+1`；原型 V0.5.35 尚未套用 CON>25 的 14 上限，下一輪需修正。
- HP 裝備 HPR + getHpr，Nature's Touch +15、住宅/旅館 +5、料理及原始 HPR 等，飢餓 food<3 / weight242>=121 / BERSERKERS 抑制正向基本與正向裝備恢復，但負向裝備 HPR 保留；水中及特定地圖可能額外扣血。
- 已核對 `MpRegeneration.java#regenMp`：WIS 15-16=2，>=17=3，其餘=1；藍水、住宅/旅館、料理、原始 MPR 等可加成；food<3 / weight242>=120 抑制正向基本與正向裝備恢復，負向裝備 MPR 保留。
- 本輪先完成 HUD 與來源核對，尚未宣稱上述全部恢復修正已寫入遊戲；後續分階段接入。

## V0.5.39：自然恢復公式修正
- HP 恢復等級表 `[30,25,20,16,14,12,11,10,9,3,2]`，騎士 Lv30+ 使用第 11 段，即 8 點/每秒累積 4 點，約 2 秒一次；MP 64 點，約 16 秒一次。
- HP CON 14+ 且 Lv>11：`maxBonus=min(CON-12,14)`，恢復隨機 1..maxBonus；其餘 1。
- 支援可選 `regenBonuses`：`naturesTouch`, `inHouse`, `inInn`, `inLifeStream`, `cookingHpr`, `originalHpr`, `equipmentHpr`, `otherHpr`, `bluePotion`, `cookingMpr`, `originalMpr`, `equipmentMpr`, `otherMpr`, `berserkers`, `exoticVitalize`, `additionalFire`, `goldenWings`；角色 `food` 低於 3 抑制基礎及正向裝備恢復。
- HP 最低 1、MP 最低 0；恢復值不得超過最大值。
- 注意：可選旗標尚未接到裝備/技能/飽食度 UI；水下與特殊地圖扣血尚未接入，不能宣稱完全等同 L1J。左上角 HUD 沿用 V0.5.38，未再修改。

## V0.5.40：裝備屬性連動測試
- 人物／裝備新增明確標記為「測試」的 AC、HPR、MPR、裝備重量數值輸入。
- AC 連動 `player.ac` 與怪物命中；HPR/MPR 連動自然恢復；重量加到已知背包重量並連動負重懲罰。
- 不宣稱這些測試補正是正式 L1J 物品屬性，亦尚未建立可穿脫的實際防具資料庫、物品裝備欄位及伺服器權威驗證。
- 下階段：從 L1J armor SQL 核對實際物品的 AC、HPR、MPR、重量，再設計裝備槽及穿脫操作。
