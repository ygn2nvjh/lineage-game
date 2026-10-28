# 第一組靜態美術驗收

使用者確認：一般區域採簡化場景，重點區域可中等細節；人物沿用原頭身方向與遊戲顯示高度，參考新髮型和鎧甲。女角紅髮／亮銀紅配色；男角深色短髮／黑鋼藍配色；無頭盔、無盾牌外觀、無長披風。動畫本輪不調整。

`/art-review.html` 是獨立的靜態素材檢視頁，不連線遊戲服務、不讀寫玩家存檔。兩角色三視角圖集以遊戲世界高度110.25單位顯示，另提供2倍與原版對照。圖集為第一稿待驗收，不是已確認人物定稿。簡化地面為渲染提案，建築與三種骷髏仍是現有正式素材；不是已全面改好怪物與場景。

- source: assets/art-review/sources/characters.webp（生成圖無損WebP來源，保留透明；原始PNG另留開發工作區）。
- runtime: assets/art-review/characters.webp（quality94 WebP，約321KB；只檢視頁載入）。
- pack: python3 scripts/prepare-art-review.py。
- build: npm run build:cloudflare，包含build-art-review.mjs。
- UI: src/art-review.mjs，原尺寸男女並列、場景切換與原版2倍比較。

本輪沒有覆寫assets/art正式人物圖集、ActorArt、任何動畫時序／戰鬥規則／Cloudflare binding／訪客key。檢視頁採用相同ActorArt顯示原版人物與三骷髏，獨立新站姿繪製新素材。不能把檢視頁的站姿切換當成完整動畫或已進正式遊戲。

## 第二稿：普通骷髏＋地面（待驗收）

主入口/art-review.html更新為第二稿；第一稿原頁保留/art-review-v1.html，亦可在主頁按「地景與骷髏」固定人物/視角切換前後。新增普通骨白彎刀骷髏站姿，保留指定彎刀；骨骼以較完整面積表達、清楚深色輪廓。地面使用grass/dirt/flagstone/moss四材質atlas，保留大片裸土行走區、低對比局部石路與建物接地陰影。

男女人物素材、史巴托、骷髏鬥士、建物圖均未替換；其他怪物尚未統一。不更改正式/play的atlas、動畫、core、連線、存檔或binding。

來源：assets/art-review/sources/{skeleton-v2,terrain-v2}.webp（無損來源），原生成PNG另留開發工作區。runtime同名WebP、skeleton-v2.json為透明邊界。prepare-art-review-v2.py負責格式打包。本輪新增runtime約698KB，只有檢視頁首次載入，不新增持續連線。

同前量測口徑：土路tile128亮度P90-P10約34.7、相鄰亮度差10.6；草地44.0/13.9，較前稿土路取樣幾乎純色更有材質，低於原墓園圖塊68.9/22.9。取樣範圍不同，只供參考。新骷髏是輪廓/骨骼色塊試稿，局部亮度變化未全面降低，不宣稱所有數據改善或已驗收。

驗證：390/960px瀏覽器切換、第一稿原頁保留、無橫向overflow、零pageerror、零WebSocket，21核心與公開獨立build通過。
