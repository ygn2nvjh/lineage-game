# V0.6 階段 0A：安全重構基準

基準提交：`bb4a13f0765ae12b134a3fb98088f4879fc3778d`。
基準遊戲：`lineage_v0583.html`；歷史比較：`lineage_v0582.html`。
分支：`refactor/l1j-core`，從指定提交建立，不依賴 main 之後是否前進。

本階段僅新增測試、設定與本說明。未修遊戲、資料、公式、畫面、存檔或玩法；未包含 0B／0C、PR、合併或部署。

## 執行

Node.js 24，使用原生 `node:test`、`vm`、`assert`，零外部套件，不需 npm install。

明確使用 `--test-isolation=none` 避免受限環境的子程序 reporter 傳輸只回報檔案層結果。各測例仍建立獨立 VM／記憶體儲存；測試檔案沒有共享遊戲實例。需確認 TAP 顯示個別斷言與 TODO／SKIP 數量，不能把「4個檔案成功退出」誤算成所有測例通過。

```sh
npm test
npm run test:regression
npm run test:diagnostics
npm run test:pending
```

- **正常回歸**：任何斷言／載入失敗都應使程序非零退出。
- **已知缺陷診斷**：實際執行「應有行為」的斷言。只有最後的斷言失敗被標成 TODO；準備資料、腳本求值或程式例外仍是普通失敗。TAP 的 `not ok ... # TODO` 表示缺陷重現，不是正常回歸通過。Node 允許 TODO 因而程序可成功結束；CI 綠燈不代表缺陷已修。
- **尚未實作**：以 `test.skip` 列出，不執行，不算通過。這與執行環境故障不同。

修正缺陷時保留應有行為斷言，不將預期值改成錯誤現況。診斷若通過會輸出升格提示；經審核後移入 regression，並移除缺陷登錄。不可用 TODO 隱藏新回歸或任意增加例外。

## 基準完整性

`tests/fixtures/baseline.json` 列出指定提交全部 187 個既有追蹤檔案的 Git blob SHA。測試直接對工作目錄 bytes 計算 Git blob 雜湊，不需要遠端、Git 歷史或完整 checkout。兩個指定 HTML 分別測試，其餘檔案也受到保護。

不得為了讓測試通過而重新產生 manifest。未來經明確授權改動遊戲，應審核雜湊變動、保留歷史樣本及新增行為斷言；本階段禁止該類修改。

## 非侵入式測試邊界

- 執行原 HTML 中的腳本，不複製公式。核心閉包只在記憶體副本結尾插入測試 probe；不改磁碟 HTML、不把 private player 或 TEST_EQUIP 洩漏成全域。
- 真正的創角 handler 分配 4 點 CON 並建立角色；裝備交易使用原腳本及實際台版 catalog loader 載入的資料。
- 最小 DOM adapter 僅供指定 handler 執行，不是完整瀏覽器。Canvas、動畫、MutationObserver 自動交付、觸控與排版沒有驗證。
- fetch 與瀏覽器儲存不接外部網路或真實 localStorage；catalog fetcher 從本地檔案讀取，遊戲非同步開場保持 pending，再由測試明確 init。
- 固定亂數傷害測例使用獨立常數期望值。兩版 core 比較只是差異保護，不是 L1J 官方公式證明。
- 正式 DR 入口測試注入 published equipment totals，驗證正式 wrapper 每次取值；不宣稱已驗證具 DR SQL 裝備的完整瀏覽器取得／穿戴／AI 扣血鏈。現有兩套領取裝備的 DR 都是 0。
- 過往遊戲版本不會在語法測試中被強制要求全部可執行；本次要求解析 V0.5.83 全部 script tags，external tag 的空內容另由本地資源存在性及實際 catalog loader 測試補足。

## 已知缺陷登錄

以下位置皆指 `lineage_v0583.html`；完整性雜湊是封存基準，不代表核定缺陷為玩法。

| ID | 應有行為／診斷 | 目前證據 |
|---|---|---|
| D001 | 裝備交易應能立即更新核心 AC，不依賴 HUD 刷新 | 第27行核心閉包；第715行裝備閉包；第728、731、733行跨閉包 `typeof` 判斷跳過直接接線；第732行仍能發布全域總值 |
| D002 | 戰鬥武器應是實際穿戴武器 | 第145、114–122行讀 TEST_WEAPON；第752行寫另一份 equipped |
| D003 | UI 刷新只能讀取核心 | 第78行 updateUI 改 max/maxMp、截斷 hp/mp、改寫 AC |
| D004 | 防禦驗證按鈕應能取得角色並執行現有核心 | 第782行跨閉包讀 player，提前輸出「戰鬥核心尚未就緒」 |
| D005 | DR 稽核不得宣稱正式 armorDR 固定0 | 第596行說明與第189行正式入口矛盾 |

另有未自動診斷的既有稽核項目：MR 分支／等級、六圍取值、負重、雙戒指、裝備保存、地區來源優先順序。新增驗證器第782行字串 `\\n` 輸出字面換行符的問題亦未覆蓋。沒有測試不等於沒有缺陷；本階段未改任何公式。

## 尚未實作的覆蓋

P001 真實瀏覽器裝備→AI命中→HP／死亡；P002 Safari操作／畫面；P003 保存與重載裝備往返；P004 獨立固定SHA的L1J公式對照。這些只是測試待辦，不表示已核定功能或公式。

## GitHub Actions

`.github/workflows/l1j-core-tests.yml` 僅在重構分支 push 及未來 PR 執行。正常回歸與缺陷診斷分開 job，TAP 會列出失敗檔名、斷言、expected／actual 及堆疊。工作流程只有 contents:read，沒有部署、Pages、PR建立或合併步驟。未使用 continue-on-error 隱藏普通失敗。

## 建議的 0B 範圍（本次不執行）

先審核角色／裝備的明確核心介面，拆開 render 與狀態重算；以 D001、D003、D004 作入口邊界的驗收候選。實際武器、存檔、MR／AC／DR 等行為變更須另定範圍與測試，不混入 0A；不要一併開始 0C。
