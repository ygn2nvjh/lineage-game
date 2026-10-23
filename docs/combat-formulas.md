# 戰鬥公式核對簿

最後整理：2026-10-23；目前遊戲：V0.5.19。

## 資料等級
- **verified-source**：已直接核對指定 L1J 版本原始碼／SQL，附來源路徑。
- **implemented**：遊戲已實作，不等於與原版完全一致。
- **provisional**：暫定測試值，不得當成台版事實。
- **unverified**：尚未核實；不得推算成確定值。

## 已核對原始碼
來源倉庫：`nonono44/l1j-tw-99nets`；檔案：`L1J-TW_3.80c/src/l1j/server/server/model/L1Attack.java`。

| 項目 | 原始碼核對結果 | 遊戲現況 | 後續 |
|---|---|---|---|
| PC→NPC 命中 | 等級 + STR/DEX 命中 + 武器命中 + 強化/2；d20、NPC AC | V0.5.16 已接入核心路徑 | 追加 dodge、重量與增益狀態 |
| 武器大小型 | NPC template size=large 使用大型傷害，其餘小型 | V0.5.16 已接入 | 核實每隻 NPC size |
| 材質特效 | 銀(14)、米索莉(17)、奧里哈魯根(22) 對 undead=1/3/5 加 1–20；米索莉/奧里哈魯根對 undead=2 加 1–3 | V0.5.16 已接入部分材質規則 | 核實武器材質與 NPC undead 值 |
| 祝福武器 | bless=0 且 undead=1/2/3，額外 1–4 | 尚未完整實作 | 加入武器祝福欄位 |
| NPC AC 與 DR | AC 用於命中；固定減傷不是直接由 AC 推得 | AC 已用於命中；DR=0 暫定 | 核對 NPC 資料及減傷處理 |
| NPC→PC 戰鬥 | 原始碼有獨立 calcNpcPcHit | 目前未完整對齊 | 後續整合 |

## 怪物資料
正式資料表：`data/monsters.json`。初始 14 隻從 V0.5.16 遊戲內 `L1J_ROSTER` 原樣抽出；原有基本屬性**不表示本次已重新驗證 SQL**。大小型／不死／DR 均標記 provisional 或 unverified。

## 開發約束
每次新增或修正怪物，先更新 JSON 並寫明資料來源與驗證狀態，再更新遊戲；不得默默把 provisional 改成 verified。遊戲目前仍含內嵌怪物資料，**尚未改為直接讀取 JSON**，屬下一個工程工作。

## V0.5.19：NPC 攻擊玩家公式拆分
- 將原本混在遊戲更新迴圈中的 NPC→PC 命中獨立為 `calculateNpcPcHit`，傷害獨立為 `calculateNpcPcDamage`。
- 新增怪物命中時的 d20、攻擊值、防禦值、基傷與 AC 減傷紀錄。
- **現有 NPC 基傷及 AC 減傷係數暫時維持舊版測試公式，未宣稱與 L1J 原版一致。**
- 下一步：核對 `L1Attack.java` NPC→PC 完整公式、怪物原始攻擊參數及武器損壞判定，再替換暫定公式。

## V0.5.20：L1J NPC→PC 基礎傷害核對
原始碼：`L1J-TW_3.80c/src/l1j/server/server/model/L1Attack.java`。
- `calcNpcPcHit()`：NPC 等級 + hitup，d20；AC >= 0 為 `10-AC`，AC < 0 為 `10+Random(1..-AC)`；Dodge/NDodge、遠程 ER、娃娃等特殊條件仍未接入。
- `calcNpcPcDamage()`：等級低於 10 時，`Random(0..lvl-1)+10+STR/2+1`；等級 10 以上為 `Random(0..lvl-1)+STR/2+1`。V0.5.20 已修正低等級 +10 與整數 STR/2。
- `calcPcDefense()`：AC 防禦最大值透過 `_targetPc.getClassFeature().getAcDefenseMax(ac)` 取得，`ac=max(0,10-PC_AC)`；**目前遊戲仍以 AC/2 暫代，尚未驗證騎士 class feature 公式**。
- NPC 原始 STR、hitup、dmgup、undead 與攻擊狀態資料尚待核實；目前遊戲 NPC STR 為等級推算值，不能視為原版。

## V0.5.21：騎士 AC 防禦已核實
來源：`L1J-TW_3.80c/src/l1j/server/server/model/classes/L1KnightClassFeature.java` 的 `getAcDefenseMax(int ac) { return ac / 2; }`；`L1Attack.java` 的 `calcPcDefense()`：`ac=Math.max(0,10-_targetPc.getAc())`，`Random.nextInt(acDefMax+1)`。
- 已確認：騎士 AC 物理減傷隨機值為 0 到 `floor(max(0,10-AC)/2)`，含兩端。
- V0.5.20 實際運算與原版一致；V0.5.21 移除錯誤的「暫定係數」標示。
- 尚未核實：怪物資料庫的真實 STR、hitup、dmgup，玩家 Dodge/NDodge、ER、額外防具 DR 與技能效果。

## V0.5.22：14 隻怪物原始 NPC 資料核對與接入
來源：`nonono44/l1j-tw-99nets/L1J-TW_3.80c/db/Japan/MyISAM/npc.sql`，每列 64 欄。已把 14 隻怪物完整原始欄位保存至 `data/monsters.json` 的 `originalL1J`；等級、HP、AC 與先前遊戲數值核對一致。
- 遊戲怪物生成改使用資料庫 `str`；NPC 命中與傷害額外加值接上資料庫（原始 npc.sql 沒有獨立 hitup/dmgup 欄位時預設 0）。
- `size`、`undead`、`damage_reduction`、`hard`、`poison_atk`、`paralysis_atk` 皆保存，硬皮與中毒機制尚未實作。
- 目前只匯入正在測試的 14 隻，不代表整個原始 npc.sql 全部已匯入；原始來源為 Japan 資料目錄，並非獨立驗證的台服資料。
