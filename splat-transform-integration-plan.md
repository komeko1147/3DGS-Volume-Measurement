# `splat-transform` 整合與測試規劃

## 目標

目前希望在 PlayCanvas 的 `gaussian-splatting/editor` 範例中，為被 bounding box 選取到的物體估計體積。

考量到直接從 Gaussian Splatting 資料估體積不夠穩定，下一步準備引入 `splat-transform`，把 splat 預處理成更適合幾何查詢的代理資料，再回到 PlayCanvas 中做體積計算。

這份規劃分成兩條路：

- 方案 A：CLI / build-time 預處理
- 方案 B：Library / Node script 測試

目前建議先做 **方案 B 的 Node 測試版**，確認資料與結果合理，再進一步接到 editor 中。

---

## 為什麼要先做方案 B

先做方案 B 的原因：

- 可以快速驗證 `splat-transform` 是否能正確處理目前使用的 splat 資產
- 可以先看輸出的 voxel / collision mesh 長什麼樣
- 可以先確認體積量級是否合理
- 不需要先大改 PlayCanvas editor
- 可以避免一開始就把前處理壓力放進 browser runtime

這一步的定位是：

**先驗證資料流與幾何結果，不先追求即時互動整合。**

---

## 方案 A 與方案 B 的定位

### 方案 A：CLI / build-time 預處理

做法：

- 離線先用 `splat-transform` 把 splat 轉成：
  - voxel octree
  - collision mesh
- 將輸出結果放入 `official-engine/examples` 的靜態資產資料夾
- 在 `editor.example.mjs` 載入這些代理資料
- 在 box 選取時查詢代理資料來算體積

優點：

- 最符合未來正式整合方向
- browser 端負擔最低
- 最適合做即時查詢

缺點：

- 需要先完成預處理流程
- 一開始不如方案 B 快速

### 方案 B：Library / Node script 測試

做法：

- 在本地 Node 環境安裝 `@playcanvas/splat-transform`
- 寫一支測試 script
- 直接讀取 splat 資產
- 輸出：
  - voxel
  - collision mesh
- 先確認輸出資料與體積估計路徑是否合理

優點：

- 上手快
- 最適合驗證資料格式與輸出品質
- 不需要先改 PlayCanvas editor

缺點：

- 不是最終產品架構
- 如果直接搬到 browser，可能會太重

---

## 目前建議的執行順序

### 第 1 階段：先做方案 B 的 Node 測試版

目標：

- 驗證目前使用的 splat 資產是否能順利轉換
- 觀察 `voxel` 與 `collision mesh` 的輸出
- 為之後的 editor 整合做準備

預計步驟：

1. 安裝 `@playcanvas/splat-transform`
2. 新增一支測試腳本，例如：
   - `tools/test-splat-transform.mjs`
3. 拿目前 editor 中的資產做測試：
   - `biker.compressed.ply`
   - `apartment.sog`
4. 輸出：
   - `.voxel.json`
   - `.voxel.bin`
   - `.collision.glb`
5. 記錄輸出大小、處理時間、結果品質

這一步重點不是接 PlayCanvas，而是確認：

- 哪種代理資料最適合後續體積計算
- 哪個資產最容易出現格式或精度問題

---

### 第 2 階段：比較 voxel 與 collision mesh 哪個比較適合

目標：

- 比較兩種體積代理資料在目前需求下的可用性

比較重點：

- 體積估計是否合理
- 與視覺表面的一致性
- 資料大小
- 查詢成本
- 是否適合 box 選取後即時計算

預期判斷：

- 如果目標是 **即時局部體積**
  - voxel 通常較適合
- 如果目標是 **較高品質整體幾何**
  - collision mesh 通常較適合

---

### 第 3 階段：再進行方案 A，正式接到 editor

目標：

- 將選定的代理資料整合回 PlayCanvas editor

預計步驟：

1. 將預處理結果移到 `official-engine/examples` 可載入的位置
2. 在 `editor.example.mjs` 中為每個 editable entity 掛上對應代理資料
3. 新增體積查詢邏輯
4. 將結果顯示在 `Selection Metrics`

---

## 建議的目錄與檔案規劃

### 測試 script

建議新增：

- `tools/test-splat-transform.mjs`

用途：

- 單純做本地轉換測試
- 不放進 PlayCanvas browser runtime

### 預處理輸出

建議輸出到：

- `generated/volumes/`

例如：

- `generated/volumes/apartment.voxel.json`
- `generated/volumes/apartment.voxel.bin`
- `generated/volumes/apartment.collision.glb`
- `generated/volumes/biker.voxel.json`
- `generated/volumes/biker.voxel.bin`
- `generated/volumes/biker.collision.glb`

### 未來接進 examples 的靜態資產位置

若要正式整合 editor，建議再搬到：

- `official-engine/examples/src/static/assets/volumes/`

---

## 測試時要記錄的重點

對每個資產建議記錄：

- 輸入 splat 格式
- 輸出檔案大小
- 處理時間
- 是否成功產生 voxel
- 是否成功產生 collision mesh
- 代理資料是否與原始 splat 視覺輪廓大致一致
- 如果未來用來算體積，量級是否合理

---

## 各方案可能的風險

### 方案 B 風險

- 資產格式相容性不一定完全一致
- `.sog` 與 `.compressed.ply` 可能有不同的輸出行為
- 只做 Node 測試時，還無法反映 editor 中的即時互動成本

### voxel 路線風險

- 精度受 voxel resolution 影響
- 解析度太低會失真
- 解析度太高會增加資料大小與查詢成本

### collision mesh 路線風險

- 若 mesh 不是 watertight，體積計算可能不穩
- 若之後要算 box 內局部體積，mesh clipping 會比較複雜

---

## 推薦的短期策略

目前最推薦的短期策略是：

1. 先做方案 B 的 Node 測試腳本
2. 拿 `apartment.sog` 和 `biker.compressed.ply` 做轉換
3. 比較 voxel 和 collision mesh 兩種輸出
4. 確定要採用哪種代理資料後，再開始接到 `editor.example.mjs`

---

## 下一步實作建議

下一步最適合直接做的是：

1. 安裝 `@playcanvas/splat-transform`
2. 新增 `tools/test-splat-transform.mjs`
3. 先用 `apartment.sog` 做第一個測試案例
4. 產出：
   - voxel
   - collision mesh
5. 根據輸出結果決定先接哪條路

---

## 一句話總結

先做 **方案 B 的 Node 測試版** 最划算：

- 成本低
- 風險可控
- 可以同時驗證 voxel 與 collision mesh
- 不會一開始就把複雜度塞進 PlayCanvas editor
