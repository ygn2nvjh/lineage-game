# V0.6 0B-2：獨立最小核心

起點：`c717ae28adb097a36e68d8c6330e993700402289`。
保護的遊戲基準：`bb4a13f0765ae12b134a3fb98088f4879fc3778d` 的 V0.5.83，歷史樣本 V0.5.82。
L1J 參考 SHA：`8aa24617476a7d8f6a7072687279c77cf9f3d405`；這是社群來源參考，不等於台灣官方公式。

本階段核心獨立存在，沒有被任何正式 HTML 載入，沒有接管正式角色寫入權。D001～D005 仍保留 TODO；新核心測試通過不代表舊遊戲已修復。

## 核心邊界

單一 GameState → 複製命令 → 驗證與候選狀態 → 純推導 → P1 資源政策 → 不變量 → 唯一提交 → 通知。

每個 `createGame` 的權威 state 只有一份，封存在閉包內並深度凍結。交易建立的候選資料不對外發布；通過才取代權威 state。沒有可寫的 player、equipmentBonuses、DerivedStats 或另一份角色鏡像。

核心使用原生 `.mjs`，無外部套件、DOM、Canvas、瀏覽器全域、fetch、儲存、實際時鐘或隨機數。Node 已測試；Safari 模組載入、MIME、操作與遊戲流程尚未驗收。Catalog JSON 載入／字串轉數值與永久儲存由未來 host adapter 負責。

## 檔案及責任

| 模組 | 責任 |
|---|---|
| `src/core/index.mjs` | 公開入口、save 還原工廠 |
| `data.mjs` | 純資料複製、拒絕 accessor／非有限值／循環等非資料輸入、深凍結、型別／欄位邊界、錯誤碼、完整槽位 |
| `catalog.mjs` | 唯讀模板與重複 ID／數值驗證；保留 Taiwan weapon/armor 的 type 與 etcitem 的 item_type 差異 |
| `rules/legacy-v0583.mjs` | 明確公式輸入及來源、既有容量／AC 計算；不採用新的 L1J 公式 |
| `derived-stats.mjs` | 裝備加總、能力層分離、容量、AC、DR、MR／ER／重量／效果契約與武器解析 |
| `equipment.mjs` | 明確目標槽的穿脫／替換規劃、職業與等級、所有權及 revision 檢查 |
| `invariants.mjs` | schema、角色／物品／槽位、跨角色所有權唯一性、重複穿戴及資源範圍驗證 |
| `game.mjs` | 唯一權威 state、裝備交易、唯讀快照、同步通知、匯出 |
| `persistence/codec.mjs` | SaveEnvelope v1、版本／ruleset／catalog 一致性及格式驗證 |
| `persistence/migrations.mjs` | 舊資料及完整證據的純遷移；缺失或矛盾立即失敗 |

Inventory 的 `ownedInstanceIds` 包含穿戴物；Equipment 僅引用 instanceId。每件實例恰有一個角色所有者，不能同時佔兩槽。保留 head、neck、earring、weapon、body、shield、cloak、hands、feet、ring1、ring2、belt，另外保留 SQL shirt／guarder 的明確部位。規則未全面補完，不代表所有 L1J 穿戴組合都已驗證。

## 使用及公開接口

```js
import { createGame, createItemCatalog, createGameFromSave, migrateLegacySave }
  from './src/core/index.mjs';

const catalog = createItemCatalog({ version: 'host-pinned-catalog-id', templates });
const game = createGame({ state, catalog });
const result = game.equipItem({
  characterId: 'hero', instanceId: 'sword-instance', targetSlot: 'weapon',
  expectedRevision: game.getSnapshot('hero').revision
});
```

| 接口 | 行為 |
|---|---|
| `createGame({state,catalog})` | 複製、驗證及封存權威資料；格式錯誤拋具 code 的 CoreError |
| `getSnapshot(characterId)` | 角色、所有物、穿戴引用、模板、衍生數值的深凍結副本；無副作用 |
| `equipItem({characterId,instanceId,targetSlot,expectedRevision})` | 穿戴或替換指定槽；成功只增一次 revision |
| `unequipItem({characterId,targetSlot,expectedRevision})` | 明確卸下；不刪除所有權 |
| `resolveWeapon(characterId)` | 回傳實例、模板、強化及損傷副本；未穿戴回傳 null |
| `subscribe(fn)` | 同步接收已提交的 revision、events、snapshot；回傳取消訂閱函式 |
| `exportSave()` | 深凍結 SaveEnvelope，不寫任何儲存 |
| `createGameFromSave(envelope,{catalog})` | 成功 `{ok:true,game}`；錯誤 `{ok:false,error}` |
| `migrateLegacySave(raw,evidence,catalog)` | 純遷移，成功回傳 `{ok:true,save}`；不改 raw／evidence |
| `deriveStats(state,catalog,characterId)` | 對已驗證資料作無副作用計算；不調整目前 HP／MP |

未公開任意改 state／HP／EXP 的接口；沒有實作 applyDamage、gainExperience、升級、死亡或復活。這些是未來可信解析器的工作，不能由 UI 傳入任意最終值。獨立測試武器用另一個測試核心／fixture catalog 建立，不是正式無武器時的 fallback。

成功命令回傳 `{ok:true,revision,events,notificationErrors}`；失敗回傳 `{ok:false,revision,error:{code,message}}`。常見錯誤包含 STALE_REVISION、ITEM_NOT_FOUND、ITEM_NOT_OWNED、INCOMPATIBLE_SLOT、CLASS_RESTRICTED、LEVEL_RESTRICTED、ITEM_ALREADY_EQUIPPED、SLOT_EMPTY。

預期驗證失敗回傳錯誤，不吞掉程式錯誤。同步訂閱者拋錯回報 SUBSCRIBER_ERROR，已提交交易不回滾；訂閱期間再寫入回報 REENTRANT_COMMAND。異步訂閱回報 ASYNC_SUBSCRIBER_UNSUPPORTED 並處理其 rejection，保存等異步 I/O 應由 host 管理。沒有事件溯源、網路命令重送／去重或伺服器授權；不能宣稱具備完整多人同步。

## 五項已核定政策

- **P1**：容量增加不補滿；減少僅在成功裝備交易截斷。純推導／讀快照不改資源。甚至候選已截斷但最後驗證失敗時，也不改權威 HP／MP 或 revision。載入超界資源直接拒絕，不藉載入靜默修復。
- **P2**：遷移純函式不覆寫原保存鍵。缺失關鍵資料、矛盾金幣或補正時明確失敗。保留原始資料是 host 的責任，本核心沒有儲存 API。
- **P3**：同款戒指須不同實例，明確指定 ring1／ring2；替換只影響指定槽，被換下物品仍持有，不自動移動另一槽。
- **P4**：缺 originalStats 停止，不回退到 base.stats 或 initialStats。
- **P5**：新核心僅由 Equipment → instanceId → ItemInstance → ItemCatalog 解析武器，空槽為 null；V0.5.83 正式 Combat 尚未改接。

## 公式及未實作契約

原始能力與基礎能力分開保存；裝備能力每次由穿戴引用重新加總。`equipmentAdjusted` 只表示 base + SQL 六圍之算術投影，不能當成所有公式的共同輸入；沒有將裝備 CON／WIS 重新計算過去成長。

| 項目 | 實作／來源／限制 |
|---|---|
| HP／MP 上限 | V0.5.83 updateUI 第78行：base capacity + SQL add_hp/add_mp，兩者最低1；保留原 HUD 規則，不改成其他 L1J 上限規則 |
| AC | 同第78行：level、base DEX、original DEX、SQL AC。未使用裝備 DEX 改等級 AC，未加強化／魔法 AC。參考 CalcStat.calcAc、L1PcInstance.resetBaseAc/resetOriginalAc |
| DR | SQL damage_reduction 加總後 Math.max(0, Math.trunc(raw))；對應第185、189、724行；沒有改 Combat 或傷害公式 |
| 裝備限制 | 保留第752行騎士 use_knight／min_lvl／max_lvl。未私自新增雙手武器與盾牌互斥、詛咒、套裝等來源規則 |
| MR | `status:not-implemented,value:null`。保留 base/original WIS、level、直接MR及裝備WIS／effects 輸入契約。舊HUD漏 level/2、高WIS分支且忽略裝備WIS；L1J CalcStat.calcStatMr／resetBaseMr 不同。未選新公式補入 |
| ER | 明確未實作；level、original/base/equipment DEX 及 effects 分開輸入。尚未建立舊 statusBonuses/statusEffects 的完整映射，不猜旗標／堆疊規則 |
| 負重 | 明確未實作；所有持有實例、數量、SQL重量、wallet、容量相關輸入分開列出。V0.5.83 第46行僅算部分測試物品；本階段不直接將完整背包契約變成新的懲罰規則 |
| effects | `{effectId,kind,data}` 的唯一權威列表；驗證唯一ID，值為純資料。效果評估／堆疊及有效六圍尚未實作，輸出 null／reason，未默默加進公式 |

以上未實作項目的測試只驗證契約／明確標記，不代表公式測試已通過。沒有把未知值填成0當作已完成。provenance 固定來源 SHA；公式正確性仍需獨立 L1J 對照，不將兩份程式一致宣稱為官方驗證。

## 保存與舊資料相容

SaveEnvelope v1 保存 rulesetId、catalogVersion、GameState schemaVersion、revision、角色身分／原始與基礎值／目前資源／effects／金幣／死亡損失紀錄，以及實例、所有權、穿戴引用。沒有保存衍生值、快取或物品模板副本。catalogVersion 必須由 host 綁定到不可變的資料版本；核心不自行下載或驗證遠端 catalog。

金幣唯一表示為 `character.wallet.adena`，沿用舊角色可支出的 coins；不能同時另有40308實例而再算一次。遇兩種表示或 evidence 與 coins 不一致直接拒絕，不決定合併或匯率。貨幣重量仍未實作。這是遷移衝突邊界，不是正式背包玩法變更。

純舊 localStorage 角色鍵沒有保存目前 HP／MP、完整物品與穿戴，所以單靠該 JSON 無法無損遷移。`migrateLegacySave` 要求額外完整、可驗證的捕捉證據：

```js
const evidence = {
  characterId,
  resources: { hp, mp },
  itemInstances,                         // 每件具有明確實例ID，不用templateId去重
  inventory: { ownedInstanceIds },
  equipment: { slots },                  // 含所有明確空槽，不推測遺漏槽為空
  effects,
  adenaEvidence                         // 若存在，必須與 raw.coins 相等
};
```

證據缺失回報 LEGACY_EVIDENCE_REQUIRED。若原保存帶 equipmentBonuses，先對實際穿戴推導值逐項核對，矛盾回報 LEGACY_BONUS_CONFLICT；一致後不保存舊補正，避免重複累加。未知舊欄位先拒絕，避免丟掉技能／恢復等未支援資料。此階段沒有建立瀏覽器捕捉 adapter，也不從舊頁面私有閉包讀取或雙向同步。

有效且完整的捕捉資料可往返；無法補齊證據的真實舊檔仍保留，等待後續遷移方案，不清空／重新創角。沒有位置、冷卻、技能計時或多人session的保存保證。

## 測試與執行

```sh
npm test                       # 舊0A + 新核心全部測試
npm run test:regression         # 原24項基準回歸
npm run test:diagnostics        # 原D001～D005，仍TODO
npm run test:core               # 全部新增單元／交易／保存遷移
npm run test:core:unit
npm run test:core:transactions
npm run test:migration
```

新增測試分類：`tests/core/unit.test.mjs`、`tests/core/transactions.test.mjs`、`tests/migration/save.test.mjs`；共用建立器與合成資料在 `tests/core/fixture.mjs`、`tests/fixtures/core-v1.json`。合成裝備只用於架構測試，不修改正式遊戲資料。實際2992筆台版 catalog 另有完整接受測試；容量／AC 與原始HTML handler 在固定輸入交叉比較。

0A 測試與其期望值沒有改動，原187檔雜湊仍驗證。package scripts 加入新測試；Actions 新增獨立核心 job，沒有新增部署。若只建立本機commit而未推送，該commit的遠端Actions仍未執行，不能宣稱成功。

## 0C 前置條件

先審核並授權最小 adapter：明確捕捉舊狀態與實例ID、完成原子寫入權轉移、UI只讀快照；不得長期維持兩份可寫角色。需明確裁定如何處理舊頁面實際穿戴與 TEST_WEAPON 不一致的既有玩家資料，不能在正式導入時無聲挑選。已核定P5決定新正式武器來源，卻不構成缺失歷史物品的證據。

先完成獨立整合場景的裝備→快照→UI驗證，再接正式傷害入口並驗證DR／武器／死亡流程。MR／ER／負重／效果映射、完整保存、Safari與L1J獨立公式對照仍是分開的驗收邊界；尚未接管正式 Combat，不能移除D001～D005或宣稱舊遊戲已修復。
