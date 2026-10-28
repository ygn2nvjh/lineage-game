# 第一組靜態美術驗收

使用者確認：一般區域採簡化場景，重點區域可中等細節；人物沿用原頭身方向與遊戲顯示高度，參考新髮型和鎧甲。女角紅髮／亮銀紅配色；男角深色短髮／黑鋼藍配色；無頭盔、無盾牌外觀、無長披風。動畫本輪不調整。

`/art-review.html` 是獨立的靜態素材檢視頁，不連線遊戲服務、不讀寫玩家存檔。兩角色三視角圖集以遊戲世界高度110.25單位顯示，另提供2倍與原版對照。圖集為第一稿待驗收，不是已確認人物定稿。簡化地面為渲染提案，建築與三種骷髏仍是現有正式素材；不是已全面改好怪物與場景。

- source: assets/art-review/sources/characters.webp（生成圖無損WebP來源，保留透明；原始PNG另留開發工作區）。
- runtime: assets/art-review/characters.webp（quality94 WebP，約321KB；只檢視頁載入）。
- pack: python3 scripts/prepare-art-review.py。
- build: npm run build:cloudflare，包含build-art-review.mjs。
- UI: src/art-review.mjs，原尺寸男女並列、場景切換與原版2倍比較。

本輪沒有覆寫assets/art正式人物圖集、ActorArt、任何動畫時序／戰鬥規則／Cloudflare binding／訪客key。檢視頁採用相同ActorArt顯示原版人物與三骷髏，獨立新站姿繪製新素材。不能把檢視頁的站姿切換當成完整動畫或已進正式遊戲。
