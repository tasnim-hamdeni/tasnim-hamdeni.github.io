import {node,readPublicCatalog,formatDate,formatSize,lessonURL} from './core.js';

const $=id=>document.getElementById(id);
let catalog=null,loading=false;
$('year').textContent=new Date().getFullYear();
function empty(title,message) {
  const box=node('div',undefined,'empty-state');
  box.append(node('div','✧','empty-icon'),node('h3',title),node('p',message));return box;
}
function render() {
  const query=$('search').value.trim().toLocaleLowerCase(), subject=$('subject-filter').value;
  const matchesSubject=s=>!query || s.name.toLocaleLowerCase().includes(query) || catalog.lessons.some(l=>l.subjectId===s.id && l.title.toLocaleLowerCase().includes(query));
  $('subject-cards').replaceChildren();
  for (const s of catalog.subjects.filter(matchesSubject)) {
    const count=catalog.lessons.filter(l=>l.subjectId===s.id).length;
    const card=node('button',undefined,`subject-card${subject===s.id?' selected':''}`);
    card.type='button';card.setAttribute('aria-pressed',String(subject===s.id));
    const copy=node('span');copy.append(node('span',s.name,'subject-name'),node('small',`${count} ${count===1?'lesson':'lessons'}`));
    const symbol=node('span','◫','subject-icon');symbol.setAttribute('aria-hidden','true');
    const arrow=node('span','↗','arrow');arrow.setAttribute('aria-hidden','true');
    card.append(symbol,copy,arrow);card.addEventListener('click',()=>{$('subject-filter').value=subject===s.id?'':s.id;render();});
    $('subject-cards').append(card);
  }
  const lessons=catalog.lessons.filter(l=>(!subject||l.subjectId===subject)&&(!query||l.title.toLocaleLowerCase().includes(query)||catalog.subjects.find(s=>s.id===l.subjectId).name.toLocaleLowerCase().includes(query))).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt));
  $('results-title').textContent=subject ? catalog.subjects.find(s=>s.id===subject)?.name || 'Lessons' : 'All lessons';
  $('result-count').textContent=`${lessons.length} ${lessons.length===1?'lesson':'lessons'}`;
  $('lessons').replaceChildren();
  if (!lessons.length) {
    $('lessons').append(empty(query?'No matching lessons':subject?'A little more learning is on its way':'Your next lesson starts here',query?'Try a different search or choose All subjects.':subject?'No lessons have been shared in this subject yet. Check back soon.':'Tasnim hasn’t shared any lessons yet. Once published, they’ll appear here for everyone.'));
  }
  for (const lesson of lessons) {
    const row=node('article',undefined,'lesson-row');
    const copy=node('div',undefined,'lesson-copy');copy.append(node('h3',lesson.title),node('p',`${catalog.subjects.find(s=>s.id===lesson.subjectId).name} · ${lesson.type.toUpperCase()} · ${formatSize(lesson.size)} · Uploaded ${formatDate(lesson.uploadedAt)}`,'lesson-meta'));
    const actions=node('div',undefined,'lesson-actions');
    const open=node('a','Open ↗','button secondary');open.href=lessonURL(lesson,true);open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label',`Open ${lesson.title} on GitHub`);
    const download=node('button','Download ↓','button');download.type='button';download.setAttribute('aria-label',`Download ${lesson.title}`);
    download.addEventListener('click',async()=>{
      download.disabled=true;download.textContent='Downloading…';
      try {
        const response=await fetch(lessonURL(lesson),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});
        if (!response.ok) throw new Error('The file could not be downloaded. Refresh the library and try again.');
        const blob=await response.blob();
        if (blob.size !== lesson.size) throw new Error('The download was incomplete. Try again or use Open to access the file on GitHub.');
        const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=lesson.originalName.replace(/[\\/\x00-\x1f]/g,'_');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        $('library-status').className='status success';$('library-status').textContent='The file was sent to your browser’s downloads.';
      } catch (error) {$('library-status').className='status error';$('library-status').textContent=error.name==='TimeoutError'?'The download timed out. Check your connection and try again.':error.message;}
      finally {download.disabled=false;download.textContent='Download ↓';}
    });
    actions.append(open,download);row.append(node('span',lesson.type.toUpperCase(),'file-icon'),copy,actions);$('lessons').append(row);
  }
}
async function load() {
  if (loading) return;loading=true;$('refresh').disabled=true;$('library-status').className='status';$('library-status').textContent='Loading the latest lessons…';
  try {
    const next=await readPublicCatalog();const selected=$('subject-filter').value;catalog=next;
    $('subject-filter').replaceChildren(new Option('All subjects',''),...catalog.subjects.map(s=>new Option(s.name,s.id)));
    if (catalog.subjects.some(s=>s.id===selected)) $('subject-filter').value=selected;
    render();$('library-status').textContent='';
  } catch (error) {
    $('library-status').className='status error';$('library-status').textContent=error.message;
    if (!catalog) {$('lessons').replaceChildren(empty('The library is not available yet','Please try Refresh library in a moment.'));$('result-count').textContent='';}
    else $('library-status').textContent+=' The lessons below are from your last successful refresh.';
  } finally {loading=false;$('refresh').disabled=false;}
}
$('search').addEventListener('input',()=>{if(catalog)render();});$('subject-filter').addEventListener('change',()=>{if(catalog)render();});$('refresh').addEventListener('click',load);
// Check for updates on return to the tab; no token, local database, or service worker.
let lastRefresh=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>60000){lastRefresh=Date.now();load();}});
load();
