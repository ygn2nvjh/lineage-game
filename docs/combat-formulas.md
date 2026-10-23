# 戰鬥公式核對簿

最後整理：2026-10-23；目前遊戲：V0.5.16。

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
