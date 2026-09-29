/* Kaisyuan full-site intelligent search: static, GitHub Pages friendly. */
let SEARCH_INDEX = null;
let PINYIN_MAP = {};
let SYNONYMS = {};

const HOMOPHONES = {
  '健':'建件鍵見劍','康':'慷糠','中':'忠鐘終種','心':'新欣薪','請':'情清晴親','假':'甲家價架',
  '行':'型形醒','動':'洞','載':'在再','具':'據句俱','手':'首守','機':'基雞','圖':'途','書':'輸舒',
  '館':'管','交':'教郊','通':'同','安':'按案','全':'泉','霸':'罷爸','凌':'陵','獎':'講蔣','懲':'成程',
  '補':'捕','考':'烤','學':'穴','習':'席','評':'平','量':'亮','升':'生','閱':'越','讀':'毒獨',
  '作':'做坐','業':'頁','冷':'愣','氣':'器','財':'材','物':'務','晤':'務悟','談':'彈','輔':'甫','導':'島倒',
  '性':'姓','別':'北','申':'深','訴':'素','緊':'錦','急':'級','防':'房','災':'栽','地':'第','震':'振',
  '朝':'招','會':'慧','午':'五','休':'修','放':'方','校':'效','徽':'揮','歌':'哥','面':'免','處':'觸',
  '室':'市','志':'至','工':'公','垃':'拉','圾':'級','衛':'位','生':'聲','棉':'眠','運':'孕','材':'才',
  '社':'射','團':'圓','費':'廢','規':'歸','定':'訂','規':'歸','範':'犯','絡':'落','資':'滋','源':'原'
};
const DEFAULT_SYNONYMS = {
  '手機':['行動載具','行動電話','手機使用','手機管理'],
  '請假':['請假規定','請假注意事項','缺席','病假','事假'],
  '考試':['定期評量','考試規則','試場規則','補考'],
  '健康中心':['保健室','護理師','健康服務','傷病處理','衛教'],
  '霸凌':['校園霸凌','霸凌防制'],
  '交通':['交通安全','騎車','通學安全'],
  '冷氣':['冷氣使用管理','教室冷氣'],
  '申訴':['學生申訴','申訴評議'],
  '晤談':['學生晤談','輔導晤談'],
  '上學':['上學時間','到校'],
  '第七節':['15:15','16:00','第七節'],
  '晨間閱讀':['晨讀','閱讀']
};

function norm(s){
  return (s||'').normalize('NFKC').toLowerCase()
    .replace(/[\s　\u200b\ufeff，。！？、；：：「」『』（）()【】\[\]<>《》〈〉“”‘’"'、/\\|_\-—–·…]+/g,'');
}
function compact(s){return (s||'').replace(/\s+/g,' ').trim()}
function editDistance(a,b){
  if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<cur.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}
function sameSound(q,t){
  q=norm(q);t=norm(t);if(!q||q.length!==t.length)return false;
  for(let i=0;i<q.length;i++){
    if(q[i]===t[i])continue;
    if(!(HOMOPHONES[t[i]]||'').includes(q[i]) && !(HOMOPHONES[q[i]]||'').includes(t[i]))return false;
  }
  return true;
}
function expandTerms(q){
  const terms=[q];
  Object.entries(SYNONYMS).forEach(([k,vals])=>{
    if(q.includes(k)) terms.push(...vals);
    vals.forEach(v=>{if(q.includes(v))terms.push(k,...vals)});
  });
  return [...new Set(terms.map(norm).filter(Boolean))];
}
function pinyinOf(s){
  return [...norm(s)].map(c=>PINYIN_MAP[c]||c).join('');
}
function scoreItem(q,item){
  const qn=norm(q), title=norm(item.title), content=norm(item.content), kws=(item.keywords||[]).map(norm).join('');
  let score=0, reasons=[];
  const terms=expandTerms(qn);
  for(const t of terms){
    if(title.includes(t)){score+=t===qn?130:105; reasons.push(t===qn?'標題完全符合':'同義詞／關聯詞符合')}
    else if(content.includes(t)){score+=t===qn?72:55; reasons.push(t===qn?'內文符合':'同義詞／關聯詞符合')}
    else if(kws.includes(t)){score+=45; reasons.push('關鍵字符合')}
    if(t.length>=2 && sameSound(t,title)){score+=90; reasons.push('同音／近音符合')}
    else if(t.length>=2){
      const d=editDistance(t,title.slice(0,Math.max(t.length,title.length)));
      if(d<=1){score+=60;reasons.push('錯字容錯')}
      else if(d<=2 && t.length>=3){score+=42;reasons.push('近似字符合')}
    }
    const py=pinyinOf(t);
    if(py && item.pinyin && item.pinyin.includes(py)){score+=38;reasons.push('拼音符合')}
  }
  // Natural-language intent boosts.
  const intents=[
    [/手機|行動載具|上課.*手機|手機.*上課/,'行動載具管理規範'],
    [/生病|受傷|不舒服|去哪裡/,'健康中心服務要點'],
    [/請假|怎麼請假|請假怎麼辦/,'學生請假注意事項'],
    [/第七節|第7節|下午.*課/,'生活作息表｜第七節'],
    [/幾點上學|何時到校|上學幾點/,'生活作息表｜上學時間']
  ];
  for(const [re,label] of intents)if(re.test(q)){
    if(title.includes(norm(label))||content.includes(norm(label))) {score+=95;reasons.push('問題語意符合')}
  }
  return {score,reasons:[...new Set(reasons)].slice(0,3)};
}
function getSnippet(text,q){
  const clean=compact(text); const terms=expandTerms(q); let pos=-1;
  for(const t of terms){const i=norm(clean).indexOf(norm(t));if(i>=0){pos=i;break}}
  if(pos<0)return clean.slice(0,150)+(clean.length>150?'…':'');
  const start=Math.max(0,pos-55);const end=Math.min(clean.length,pos+120);
  return (start?'…':'')+clean.slice(start,end)+(end<clean.length?'…':'');
}
async function loadSearchIndex(){
  if(SEARCH_INDEX)return;
  const [idx,py,syn]=await Promise.all([
    fetch('search-index.json').then(r=>r.json()),
    fetch('pinyin-map.json').then(r=>r.json()).catch(()=>({})),
    fetch('synonyms.json').then(r=>r.json()).catch(()=>DEFAULT_SYNONYMS)
  ]);
  SEARCH_INDEX=idx.documents||[];PINYIN_MAP=py;SYNONYMS={...DEFAULT_SYNONYMS,...syn};
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderResults(q,true){
  const box=document.getElementById('searchResults');
  const hits=SEARCH_INDEX.map(item=>({item,...scoreItem(q,item)})).filter(x=>x.score>25)
    .sort((a,b)=>b.score-a.score).slice(0,10);
  box.style.display='block';
  if(!hits.length){box.className='card';box.innerHTML=`<b>找不到完全符合的內容</b><p style="color:#9aaabd">可以換個說法、少打一個字，或試試「健康中心、請假、手機、交通安全、冷氣、申訴」。</p>`;return}
  box.className='card';
  box.innerHTML=`<b>${'✨ AI智慧模糊搜尋結果'}</b><p style="margin:6px 0 12px;color:#9aaabd;font-size:13px">已搜尋網站文字、學生手冊 PDF 全 83 頁與生活作息表內容。</p>`;
  const wrap=document.createElement('div');wrap.className='searchHitList';
  hits.forEach(({item,score,reasons})=>{
    const a=document.createElement('a');a.className='searchHit';a.href=item.url||'#';a.target='_blank';a.rel='noopener';
    const icon=item.type==='pdf'?'📄':'🌐';
    a.innerHTML=`<span class="searchHitIcon">${icon}</span><span class="searchHitBody"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.department||item.type)}${item.page?' ｜ 手冊第 '+item.page+' 頁':''}</small><em>${escapeHtml(getSnippet(item.content,q))}</em><i>${escapeHtml(reasons.join(' · '))}</i></span><span class="searchHitArrow">→</span>`;
    wrap.appendChild(a);
  });
  box.appendChild(wrap);box.scrollIntoView({behavior:'smooth',block:'center'});
}
async function doSearch(ai=true){
  const input=document.getElementById('searchInput');const q=input.value.trim();const box=document.getElementById('searchResults');
  if(!q){box.style.display='none';return}
  box.style.display='block';box.className='card';box.textContent='搜尋網站全文中…';
  try{await loadSearchIndex();renderResults(q,true)}catch(e){box.textContent='搜尋索引載入失敗，請重新整理頁面後再試。';console.error(e)}
}
window.doSearch=doSearch;
document.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('searchInput');
  if(input)input.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch(true)});
});
