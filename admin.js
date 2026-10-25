import {config} from './config.js';
import {node,id,validateFile,formatDate,formatSize} from './core.js';
import {GitHubLibrary} from './github.js';

const $=id=>document.getElementById(id);
let client=null,catalog=null,busy=false;
$('repository-label').textContent=`${config.owner}/${config.repository} · ${config.branch}`;
$('token-repo').textContent=config.repository;
function status(text,type='') {$('admin-status').className=`status ${type}`;$('admin-status').textContent=text;}
function controls() {
  document.querySelectorAll('fieldset').forEach(f=>{f.disabled=!client || busy;});
  document.querySelectorAll('.remove').forEach(b=>{b.disabled=!client || busy;});
  $('connect-button').disabled=busy || !!client;$('token').disabled=busy || !!client;
  $('disconnect').hidden=!client;$('disconnect').disabled=busy;$('admin-refresh').disabled=!client || busy;
  $('connection-badge').textContent=client?'Connected':'Disconnected';
  $('progress').hidden=!busy;
  if (busy) $('progress').removeAttribute('value');
}
async function run(action,success) {
  if (busy) return;busy=true;controls();
  try {await action();if (success) status(success,'success');}
  catch(error) {status(error.message,'error');}
  finally {busy=false;controls();}
}
function confirmRemoval(message) {
  return new Promise(resolve=>{const dialog=$('confirm-dialog');$('confirm-message').textContent=message;dialog.returnValue='cancel';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='remove'),{once:true});dialog.showModal();});
}
function render() {
  $('admin-subjects').replaceChildren();$('admin-lessons').replaceChildren();
  const selected=$('lesson-subject').value;
  $('lesson-subject').replaceChildren(new Option('Choose a subject',''),...catalog.subjects.map(s=>new Option(s.name,s.id)));
  if (catalog.subjects.some(s=>s.id===selected)) $('lesson-subject').value=selected;
  if (!catalog.subjects.length) $('admin-subjects').append(node('p','No subjects yet. Add your first subject above.','muted'));
  if (!catalog.lessons.length) $('admin-lessons').append(node('p','No published lessons yet. Choose a subject and share your first lesson.','muted'));
  for (const s of catalog.subjects) {
    const count=catalog.lessons.filter(l=>l.subjectId===s.id).length,row=node('div',undefined,'admin-item'),copy=node('div');
    copy.append(node('strong',s.name),node('p',`${count} ${count===1?'lesson':'lessons'}`));
    const remove=node('button','Remove','remove');remove.type='button';remove.setAttribute('aria-label',`Remove subject ${s.name}`);
    remove.addEventListener('click',async()=>{
      if (busy) return;
      if (catalog.lessons.some(l=>l.subjectId===s.id)) {status('Remove this subject’s lessons before removing the subject.','error');return;}
      if (!await confirmRemoval(`Remove the subject “${s.name}” from the public library?`)) return;
      await run(async()=>{catalog=await client.publish({kind:'remove-subject',id:s.id},null,status);render();},'Subject removed from the public library.');
    });row.append(copy,remove);$('admin-subjects').append(row);
  }
  for (const l of [...catalog.lessons].sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt))) {
    const row=node('div',undefined,'admin-item'),copy=node('div');copy.append(node('strong',l.title),node('p',`${catalog.subjects.find(s=>s.id===l.subjectId).name} · ${l.type.toUpperCase()} · ${formatSize(l.size)} · ${formatDate(l.uploadedAt)}`));
    const remove=node('button','Remove','remove');remove.type='button';remove.setAttribute('aria-label',`Remove lesson ${l.title}`);
    remove.addEventListener('click',async()=>{
      if (busy || !await confirmRemoval(`Remove “${l.title}” and its document from the current public library?`)) return;
      await run(async()=>{catalog=await client.publish({kind:'remove-lesson',id:l.id,path:l.path},null,status);render();},'Lesson and current document removed. Git history can retain earlier copies.');
    });row.append(copy,remove);$('admin-lessons').append(row);
  }
  controls();
}
$('connect-form').addEventListener('submit',event=>{
  event.preventDefault();if (client||busy) return;
  let token=$('token').value.trim();$('token').value='';
  if (!token.startsWith('github_pat_')) {status('Use a fine-grained personal access token from GitHub (beginning with github_pat_).','error');return;}
  const candidate=new GitHubLibrary(token);token='';
  run(async()=>{
    status('Connecting to the public lesson-data repository…');
    try {catalog=await candidate.connect();client=candidate;render();}
    catch(error) {candidate.disconnect();throw error;}
  },'Connected. Your token is held only in this page’s memory. You can now manage the library.');
});
function disconnect() {
  client?.disconnect();client=null;catalog=null;$('token').value='';$('subject-form').reset();$('upload-form').reset();
  $('lesson-subject').replaceChildren(new Option('Choose a subject',''));$('admin-subjects').replaceChildren(node('p','Connect to view subjects.','muted'));$('admin-lessons').replaceChildren(node('p','Connect to view published lessons.','muted'));controls();status('Disconnected. The token has been cleared from this page.');
}
$('disconnect').addEventListener('click',disconnect);
window.addEventListener('pagehide',()=>{client?.disconnect();client=null;$('token').value='';});
window.addEventListener('pageshow',event=>{if(event.persisted)disconnect();});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
$('subject-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client||busy)return;const name=$('subject-name').value.trim();
  if(!name){status('Enter a subject name.','error');return;}
  run(async()=>{catalog=await client.publish({kind:'add-subject',subject:{id:id(),name}},null,status);$('subject-form').reset();render();},'Subject added. It is now available in the public library.');
});
$('upload-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client||busy)return;
  run(async()=>{
    const title=$('lesson-title').value.trim(),subjectId=$('lesson-subject').value,file=$('lesson-file').files[0];
    if (!title || !subjectId) throw new Error('Enter a lesson title and choose a subject.');
    status('Validating your document…');const type=await validateFile(file),lessonId=id();
    const lesson={id:lessonId,subjectId,title,type,originalName:file.name,size:file.size,uploadedAt:new Date().toISOString(),path:`documents/${subjectId}/${lessonId}.${type}`};
    catalog=await client.publish({kind:'upload',lesson},file,status);$('upload-form').reset();render();
  },'Lesson published. Students on any device can see it after refreshing the library; GitHub’s public cache may take a few minutes to update.');
});
$('admin-refresh').addEventListener('click',()=>run(async()=>{status('Refreshing the latest library…');catalog=(await client.snapshot()).catalog;render();},'Library refreshed.'));
controls();
