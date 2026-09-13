#!/usr/bin/env python3
"""Build a static full-text index for the Kaisyuan Junior High website.
Scans index.html and every PDF listed in documents.json, page by page.
Requires: pypdf, beautifulsoup4. Optional: pypinyin for pinyin fields.
"""
import json, re, unicodedata
from pathlib import Path
from html import unescape
from pypdf import PdfReader
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None
try:
    from pypinyin import lazy_pinyin
except ImportError:
    lazy_pinyin = None

ROOT=Path(__file__).resolve().parent
DOCS=ROOT/'documents.json'
OUT=ROOT/'search-index.json'

def norm(s):
    s=unicodedata.normalize('NFKC', s or '').lower()
    s=re.sub(r'[\s\u3000\u200b\ufeff]+','',s)
    s=re.sub(r'[，。！？、；：：「」『』（）()【】\[\]<>《》〈〉“”‘’"\'、/\\|_\-—–·…]+','',s)
    return s

def pinyin(s):
    if lazy_pinyin: return ''.join(lazy_pinyin(s))
    return ''

def snippet(text,q='',n=150):
    text=re.sub(r'\s+',' ',text).strip()
    if not q: return text[:n]
    i=text.lower().find(q.lower())
    if i<0: return text[:n]
    a=max(0,i-55); b=min(len(text),i+n-55)
    return ('…' if a else '')+text[a:b]+('…' if b<len(text) else '')

def html_text(path):
    raw=path.read_text(encoding='utf-8',errors='ignore')
    if BeautifulSoup:
        soup=BeautifulSoup(raw,'html.parser')
        for t in soup(['script','style','noscript']): t.decompose()
        return soup.get_text(' ',strip=True)
    raw=re.sub(r'<(script|style)[^>]*>.*?</\1>',' ',raw,flags=re.S|re.I)
    return re.sub(r'<[^>]+>',' ',unescape(raw))

index=[]
# Website visible text
text=html_text(ROOT/'index.html')
index.append({'id':'site-home','title':'凱旋國中 115 學年度數位學生手冊網站','content':text,'department':'網站','source':'index.html','type':'html','page':None,'url':'#top','pinyin':pinyin(text[:4000])})

# PDF pages
for doc in json.loads(DOCS.read_text(encoding='utf-8')):
    path=ROOT/doc['file']
    reader=PdfReader(str(path))
    for page_no,page in enumerate(reader.pages,1):
        txt=page.extract_text() or ''
        # Keep every page even if text extraction is empty; it can still be opened.
        title=f"{doc['title']}｜第 {page_no} 頁"
        index.append({'id':f"{path.stem}-{page_no}",'title':title,'content':txt,'department':doc.get('department',''),'source':doc['file'],'type':'pdf','page':page_no,'url':f"{doc['file']}#page={page_no}",'pinyin':pinyin(txt[:6000])})

# A small set of schedule facts because schedule.pdf is image-only in the supplied file.
schedule_facts=[
('生活作息表｜上學時間','07:10–07:30 上學時間'),('生活作息表｜晨間閱讀','07:30–07:55 晨間閱讀'),('生活作息表｜晨讀分享','07:55–08:00 晨讀分享'),('生活作息表｜早自習','08:00–08:10 早自習／室內廣播'),('生活作息表｜第一節','08:20–09:05 第一節'),('生活作息表｜第二節','09:15–10:00 第二節'),('生活作息表｜課間活動','10:00–10:15 課間活動（推展健康體適能活動）'),('生活作息表｜第三節','10:15–11:00 第三節'),('生活作息表｜第四節','11:10–11:55 第四節'),('生活作息表｜午餐','11:55–12:35 午餐時間（推展潔牙運動）暨午間打掃'),('生活作息表｜午休','12:35–13:10 午休'),('生活作息表｜第五節','13:20–14:05 第五節'),('生活作息表｜第六節','14:15–15:00 第六節'),('生活作息表｜第七節','15:15–16:00 第七節'),('生活作息表｜放學','16:00～放學'),('生活作息表｜朝會','每週三 7:45 召開朝會；遇重大考試當天或前一天，朝會暫停乙次'),('生活作息表｜校園開放','學校校園為開放校園，請於上午 7:10 後進入校園，以維護安全')]
for title,txt in schedule_facts:
    index.append({'id':'schedule-'+str(len(index)),'title':title,'content':txt,'department':'學務處','source':'schedule.pdf','type':'pdf','page':1,'url':'schedule.pdf#page=1','pinyin':pinyin(txt)})

OUT.write_text(json.dumps({'version':1,'count':len(index),'documents':index},ensure_ascii=False,indent=2),encoding='utf-8')
print('built',len(index),'records')
