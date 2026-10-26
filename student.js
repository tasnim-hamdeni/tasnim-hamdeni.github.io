import {node,readPublicCatalog,formatDate,formatSize,lessonURL} from './core.js';

const $=id=>document.getElementById(id);
let catalog=null,loading=false;
$('year').textContent=new Date().getFullYear();
function empty(message) {return node('div',message,'empty-state');}
function documentRow(lesson) {
  const row=node('article',undefined,'lesson-row'),copy=node('div',undefined,'lesson-copy');
  copy.append(node('h3',lesson.title),node('p',`${lesson.type.toUpperCase()} · ${formatSize(lesson.size)} · ${formatDate(lesson.uploadedAt)}`,'lesson-meta'));
  const actions=node('div',undefined,'lesson-actions');
  const open=node('a','Open ↗','button secondary');open.href=lessonURL(lesson,true);open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label',`Open ${lesson.title}`);
  const download=node('button','Download ↓','button');download.type='button';download.setAttribute('aria-label',`Download ${lesson.title}`);
  download.addEventListener('click',async()=>{
    download.disabled=true;download.textContent='Downloading…';
    try {
      const response=await fetch(lessonURL(lesson),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});
      if (!response.ok) throw new Error('Download failed. Refresh and try again.');
      const blob=await response.blob();
      if (blob.size!==lesson.size) throw new Error('Incomplete download. Please try again.');
      const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=lesson.originalName.replace(/[\\/\x00-\x1f]/g,'_');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('library-status').className='status success';$('library-status').textContent='Download ready.';
    }catch(error){$('library-status').className='status error';$('library-status').textContent=error.name==='TimeoutError'?'Download timed out. Try again.':error.message;}
    finally{download.disabled=false;download.textContent='Download ↓';}
  });
  actions.append(open,download);row.append(node('span',lesson.type.toUpperCase(),'file-icon'),copy,actions);return row;
}
function render() {
  const query=$('search').value.trim().toLocaleLowerCase(),selected=$('subject-filter').value;
  const contains=text=>text.toLocaleLowerCase().includes(query);
  const chapterMatches=c=>!query || contains(c.name) || contains(catalog.subjects.find(s=>s.id===c.subjectId).name) || catalog.lessons.some(l=>l.chapterId===c.id&&contains(l.title));
  const subjects=catalog.subjects.filter(s=>!query || contains(s.name) || catalog.chapters.some(c=>c.subjectId===s.id&&chapterMatches(c)));
  $('subject-cards').replaceChildren();
  for (const s of subjects) {
    const count=catalog.chapters.filter(c=>c.subjectId===s.id).length;
    const card=node('button',undefined,`subject-card${selected===s.id?' selected':''}`);card.type='button';card.setAttribute('aria-pressed',String(selected===s.id));
    const copy=node('span');copy.append(node('span',s.name,'subject-name'),node('small',`${count} ${count===1?'chapter':'chapters'}`));
    const symbol=node('span','◫','subject-icon');symbol.setAttribute('aria-hidden','true');
    const arrow=node('span','→','arrow');arrow.setAttribute('aria-hidden','true');
    card.append(symbol,copy,arrow);card.addEventListener('click',()=>{$('subject-filter').value=selected===s.id?'':s.id;render();});$('subject-cards').append(card);
  }
  $('results-title').textContent=selected?catalog.subjects.find(s=>s.id===selected)?.name||'Chapters':'Chapters';
  const chapters=catalog.chapters.filter(c=>(!selected||c.subjectId===selected)&&chapterMatches(c));
  $('result-count').textContent=chapters.length?`${chapters.length} ${chapters.length===1?'chapter':'chapters'}`:'';
  $('lessons').replaceChildren();
  if(!chapters.length){$('lessons').append(empty(query?'No matches. Try another search.':!catalog.subjects.length?'Lessons will appear here soon.':'No chapters yet.'));return;}
  for(const [index,c] of chapters.entries()){
    const section=node('details',undefined,'chapter');section.open=!!query||index===0;
    const summary=node('summary'),copy=node('span'),name=node('strong',c.name);
    const lessons=catalog.lessons.filter(l=>l.chapterId===c.id&&(!query||contains(l.title)||contains(c.name)||contains(catalog.subjects.find(s=>s.id===c.subjectId).name))).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt));
    copy.append(name);if(!selected)copy.append(node('small',catalog.subjects.find(s=>s.id===c.subjectId).name));
    summary.append(copy,node('span',`${lessons.length} ${lessons.length===1?'document':'documents'}`,'chapter-count'));
    const content=node('div',undefined,'chapter-content');
    if(!lessons.length)content.append(empty('No documents yet.'));else content.append(...lessons.map(documentRow));
    section.append(summary,content);$('lessons').append(section);
  }
}
async function load(){
  if(loading)return;loading=true;$('refresh').disabled=true;$('library-status').className='status';$('library-status').textContent='Loading…';
  try{
    const next=await readPublicCatalog(),selected=$('subject-filter').value;catalog=next;
    $('subject-filter').replaceChildren(new Option('All subjects',''),...catalog.subjects.map(s=>new Option(s.name,s.id)));
    if(catalog.subjects.some(s=>s.id===selected))$('subject-filter').value=selected;
    render();$('library-status').textContent='';
  }catch(error){$('library-status').className='status error';$('library-status').textContent=error.message;if(!catalog)$('lessons').replaceChildren(empty('Please try again shortly.'));else $('library-status').textContent+=' Showing the last loaded version.';}
  finally{loading=false;$('refresh').disabled=false;}
}
$('search').addEventListener('input',()=>{if(catalog)render();});$('subject-filter').addEventListener('change',()=>{if(catalog)render();});$('refresh').addEventListener('click',load);
let lastRefresh=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>60000){lastRefresh=Date.now();load();}});
load();
