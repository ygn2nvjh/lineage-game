# 紅髮女騎士角色資產 v1

兩張使用者提供的圖片已作視覺比對：紅色編髮高馬尾、銀色鎧甲、紅色布料、黑絲、右手劍與左手紅盾一致。原畫與靜態圖的比例、細節密度不同，屬遊戲化設計差異；不能將高細節圖當成最新遊戲圖的逐像素母版。

- `references/concept-original.jpg`：形象原畫1066×1280；原始附件位元不變。
- `references/static-design-original.jpg`：高細節靜態造型基準985×1280；原始附件位元不變。這是白底JPEG，不能直接當透明世界角色。
- `runtime/frames/*.png`：最新八向靜態基準，含右後修正。透明畫布128×128、可見輪廓約92–96px；地面原點64,112。
- `runtime/idle.png`：8格橫排圖集1024×128；每格RGBA與對應單張PNG相同。
- `runtime/idle.json`：八個方向的裁圖、原點、支撐點與指紋。只有靜態，每方向1格，不包含移動或攻擊動畫。
- `character.json`：角色識別、三層參考的用途與版本規則。
- `checksums.json`：檔案指紋。

最新遊戲稿沿用已討論的改動：胸甲降低零碎高光、銀灰裙甲包覆側背、紅色主要作內襯、馬尾較收斂、盾紋簡化。高細節靜態圖保留裝備設計語彙，未覆蓋這些遊戲化調整。後續動畫以runtime靜態圖和此角色規格共同核對，不只參考原畫重新生成。

本版本保存為可追溯工作基準；原圖身分比對通過，不等於八向藝術效果、精確攝影機角度或正式遊戲整合已全部驗收。原版本凍結保存；新的來源、造型或runtime修改建立新版本，不能自動覆蓋母版。

## 遊戲載入

建置後入口：`/game-assets/characters/red-knight/v1/character.json`。圖集與各圖的路徑都相對於所屬manifest；高解析參考不用跟隨角色載入。

```js
import {loadStaticCharacter} from '/game-assets/characters/static-character-assets.mjs';
const knight = await loadStaticCharacter('/game-assets/characters/red-knight/v1/character.json');
knight.draw(ctx, 'up-right', player.x, player.y, {scale: displayScale});
```

`displayScale`由遊戲鏡頭/角色顯示規格決定，不能拿128畫布當人物身高。載入器只讀兩份JSON和runtime圖集，不會自動下載原畫、修改人物存檔、觸發戰鬥或替換正式角色。正式移動/攻擊仍需另做動畫及整合。
