import {node,readPublicCatalog,formatDate,formatSize,lessonURL} from './core.js';
const $=id=>document.getElementById(id);
let catalog=null,loading=false,selected='';
$('year').textContent=new Date().getFullYear();
function empty(message){return node('div',message,'empty-state');}
function chooseSubject(subjectId,push=true){
 selected=subjectId;$('search').value='';$('file-filter').value='';
 if(push){const url=new URL(window.location.href);url.searchParams.set('subject',subjectId);url.hash='';history.pushState(null,'',url);}
 render();
}
function documentRow(lesson){
 const row=node('article',undefined,'lesson-row'),copy=node('div',undefined,'lesson-copy'),heading=node('div',undefined,'resource-title');
 heading.append(node('h3',lesson.title));if(lesson.example===true)heading.append(node('span','Example','sample-badge'));
 copy.append(heading,node('p',`${lesson.type.toUpperCase()} · ${formatSize(lesson.size)} · ${formatDate(lesson.uploadedAt)}`,'lesson-meta'));
 const actions=node('div',undefined,'lesson-actions');
 const open=node('a','View PDF ↗','button secondary');open.href=`viewer.html?lesson=${encodeURIComponent(lesson.id)}`;open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label',`View ${lesson.title} PDF`);
 const download=node('button','Download ↓','button');download.type='button';download.setAttribute('aria-label',`Download ${lesson.title}`);
 download.addEventListener('click',async()=>{
  download.disabled=true;download.textContent='Downloading…';
  try{
   const response=await fetch(lessonURL(lesson),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});
   if(!response.ok)throw new Error('Download failed. Refresh and try again.');
   const blob=await response.blob();if(blob.size!==lesson.size)throw new Error('Incomplete download. Please try again.');
   const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=lesson.originalName.replace(/[\\/\x00-\x1f]/g,'_');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('library-status').className='status success';$('library-status').textContent='Download ready.';
  }catch(error){$('library-status').className='status error';$('library-status').textContent=error.name==='TimeoutError'?'Download timed out. Try again.':error.message;}
  finally{download.disabled=false;download.textContent='Download ↓';}
 });
 if(lesson.type==='pdf')actions.append(open);actions.append(download);const icon=node('span',lesson.type.toUpperCase(),'file-icon');icon.setAttribute('aria-hidden','true');row.append(icon,copy,actions);return row;
}
function render(){
 if(!catalog)return;
 if(!catalog.subjects.some(s=>s.id===selected))selected=catalog.subjects[0]?.id||'';
 const subject=catalog.subjects.find(s=>s.id===selected);
 document.body.className='student-page';
 document.title=subject?`${subject.name} · Tasnim Hamdeni`:'Resources · Tasnim Hamdeni';
 $('subject-nav').replaceChildren();
 for(const s of catalog.subjects){
  const link=node('a',s.name,`subject-tab${s.id===selected?' active':''}`);const target=new URL('./',window.location.href);target.searchParams.set('subject',s.id);link.href=target.href;
  if(s.id===selected)link.setAttribute('aria-current','page');
  link.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();chooseSubject(s.id);});$('subject-nav').append(link);
 }
 $('course-title').textContent=subject?.name||'Subjects';
 const allChapters=catalog.chapters.filter(c=>c.subjectId===selected),allDocuments=catalog.lessons.filter(l=>l.subjectId===selected);
 $('course-meta').replaceChildren(node('span',`${allChapters.length} ${allChapters.length===1?'chapter':'chapters'}`),node('span','·'),node('span',`${allDocuments.length} ${allDocuments.length===1?'resource':'resources'}`));
 const query=$('search').value.trim().toLocaleLowerCase(),fileType=$('file-filter').value,contains=value=>value.toLocaleLowerCase().includes(query);
 const matches=new Map();
 for(const c of allChapters){const wholeChapter=!query||contains(c.name)||contains(subject.name);const documents=catalog.lessons.filter(l=>l.chapterId===c.id&&(!fileType||l.type===fileType)&&(wholeChapter||contains(l.title)));if(documents.length||(!fileType&&wholeChapter))matches.set(c.id,documents);}
 $('chapter-index').replaceChildren();$('lessons').replaceChildren();
 const matchedCount=[...matches.values()].reduce((total,docs)=>total+docs.length,0);$('result-count').textContent=`${matchedCount} ${matchedCount===1?'resource':'resources'}`;
 $('results-title').textContent='Chapters & resources';
 if(!matches.size){$('lessons').append(empty(query||fileType?'No matches. Try another search or file type.':!subject?'No subjects available.':'No chapters yet.'));return;}
 for(const [index,c] of allChapters.entries()){
  if(!matches.has(c.id))continue;
  const number=String(index+1).padStart(2,'0'),anchor=node('a',undefined,'chapter-index-link');anchor.href='#chapter-'+c.id;anchor.append(node('span',number),node('span',c.name));$('chapter-index').append(anchor);
  const section=node('section',undefined,'chapter');section.id='chapter-'+c.id;section.setAttribute('aria-labelledby','heading-'+c.id);
  const header=node('div',undefined,'chapter-heading'),title=node('h2',c.name);title.id='heading-'+c.id;const documents=matches.get(c.id);
  header.append(node('span',number,'chapter-number'),title,node('span',`${documents.length} ${documents.length===1?'file':'files'}`,'chapter-count'));
  const content=node('div',undefined,'chapter-content');if(!documents.length)content.append(empty('No resources yet.'));else content.append(...documents.map(documentRow));section.append(header,content);$('lessons').append(section);
 }
}
async function load(){
 if(loading)return;loading=true;$('refresh').disabled=true;$('library-status').className='status';$('library-status').textContent='Loading resources…';
 try{catalog=await readPublicCatalog();if(!selected)selected=new URL(window.location.href).searchParams.get('subject')||'';render();$('library-status').textContent='';}
 catch(error){$('library-status').className='status error';$('library-status').textContent=error.message;if(!catalog)$('lessons').replaceChildren(empty('Unable to load resources.'));else $('library-status').textContent+=' Showing the last loaded version.';}
 finally{loading=false;$('refresh').disabled=false;}
}
$('search').addEventListener('input',render);$('file-filter').addEventListener('change',render);$('refresh').addEventListener('click',load);
window.addEventListener('popstate',()=>{if(catalog)chooseSubject(new URL(window.location.href).searchParams.get('subject')||catalog.subjects[0]?.id||'',false);});
let lastRefresh=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>60000){lastRefresh=Date.now();load();}});
load();
