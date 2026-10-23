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
