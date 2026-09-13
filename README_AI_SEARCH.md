# 凱旋國中 AI 全站智慧搜尋

本版本使用「建置時爬蟲 + 靜態全文索引 + 瀏覽器模糊搜尋」架構，適合 GitHub Pages。

## 搜尋範圍
- index.html 全部可見文字
- student-handbook.pdf 每一頁
- schedule.pdf 的作息內容
- 同義詞、常見同音／錯字
- PDF 頁碼與原始連結

## 核心檔案
- `search-engine.js`：瀏覽器搜尋核心
- `search-index.json`：全站索引
- `synonyms.json`：同義詞
- `pinyin-map.json`：拼音資料
- `documents.json`：要爬取的文件清單
- `build-search-index.py`：建置索引的爬蟲
- `.github/workflows/build-search-index.yml`：GitHub Actions 自動重建索引

更新 PDF 後 push 到 main，GitHub Actions 會重新建立搜尋索引。
