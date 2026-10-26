import {node,id,validateFile,formatDate,formatSize} from './core.js';
import {CodeLibrary} from './code-access.js';

const $=id=>document.getElementById(id);
let client=null,catalog=null,busy=false,subjectId='',chapterId='';
function status(text,type=''){$('admin-status').className=`status ${type}`;$('admin-status').textContent=text;}
function controls(){
  document.querySelectorAll('fieldset').forEach(f=>{f.disabled=!client||busy;});
  document.querySelectorAll('.remove,.item-select').forEach(b=>{b.disabled=!client||busy;});
  $('connect-button').disabled=busy||!!client;$('access-code').disabled=busy||!!client;
  $('disconnect').hidden=!client;$('disconnect').disabled=busy;$('admin-refresh').disabled=!client||busy;
  $('connection-badge').textContent=client?'Signed in':'Signed out';$('workspace').hidden=!client;
  $('progress').hidden=!busy;if(busy)$('progress').removeAttribute('value');
}
async function run(action,success){
  if(busy)return;busy=true;controls();
  try{await action();if(success)status(success,'success');}
  catch(error){status(error.message,'error');}
  finally{busy=false;controls();}
}
function confirmRemoval(message){
  return new Promise(resolve=>{const dialog=$('confirm-dialog');$('confirm-message').textContent=message;dialog.returnValue='cancel';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='remove'),{once:true});dialog.showModal();});
}
function removeButton(label,operation,blocked,success){
  const button=node('button','Remove','remove');button.type='button';button.setAttribute('aria-label',`Remove ${label}`);
  button.addEventListener('click',async()=>{
    if(busy||!client)return;if(blocked){status(blocked,'error');return;}
    if(!await confirmRemoval(`Remove ${label}?`))return;
    await run(async()=>{catalog=await client.publish(operation,null,status);render();},success);
  });return button;
}
function selectSubject(value){subjectId=value;chapterId='';render();}
function render(){
  if(!catalog)return;
  if(!catalog.subjects.some(s=>s.id===subjectId))subjectId=catalog.subjects[0]?.id||'';
  const chapters=catalog.chapters.filter(c=>c.subjectId===subjectId);
  if(!chapters.some(c=>c.id===chapterId))chapterId=chapters[0]?.id||'';
  for(const name of ['chapter-subject','lesson-subject']){
    $(name).replaceChildren(new Option('Choose a subject',''),...catalog.subjects.map(s=>new Option(s.name,s.id)));$(name).value=subjectId;
  }
  $('lesson-chapter').replaceChildren(new Option('Choose a chapter',''),...chapters.map(c=>new Option(c.name,c.id)));$('lesson-chapter').value=chapterId;
  $('admin-subjects').replaceChildren();$('admin-chapters').replaceChildren();$('admin-lessons').replaceChildren();
  if(!catalog.subjects.length)$('admin-subjects').append(node('p','Add your first subject.','muted'));
  if(!chapters.length)$('admin-chapters').append(node('p',subjectId?'Add a chapter.':'Choose a subject first.','muted'));
  for(const s of catalog.subjects){
    const row=node('div',undefined,'admin-item'),select=node('button',s.name,`item-select${s.id===subjectId?' selected':''}`);select.type='button';select.setAttribute('aria-pressed',String(s.id===subjectId));select.addEventListener('click',()=>selectSubject(s.id));
    const blocked=catalog.chapters.some(c=>c.subjectId===s.id)?'Remove this subject’s chapters first.':'';
    row.append(select,removeButton(`subject “${s.name}”`,{kind:'remove-subject',id:s.id},blocked,'Subject removed.'));$('admin-subjects').append(row);
  }
  for(const c of chapters){
    const row=node('div',undefined,'admin-item'),select=node('button',c.name,`item-select${c.id===chapterId?' selected':''}`);select.type='button';select.setAttribute('aria-pressed',String(c.id===chapterId));select.addEventListener('click',()=>{chapterId=c.id;render();});
    const blocked=catalog.lessons.some(l=>l.chapterId===c.id)?'Remove this chapter’s documents first.':'';
    row.append(select,removeButton(`chapter “${c.name}”`,{kind:'remove-chapter',id:c.id},blocked,'Chapter removed.'));$('admin-chapters').append(row);
  }
  const documents=catalog.lessons.filter(l=>l.chapterId===chapterId).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt));
  $('document-count').textContent=chapterId?`${documents.length} in ${chapters.find(c=>c.id===chapterId).name}`:'';
  if(!documents.length)$('admin-lessons').append(node('p',chapterId?'No documents in this chapter.':'Choose a chapter above.','muted'));
  for(const l of documents){
    const row=node('div',undefined,'admin-item'),copy=node('div');copy.append(node('strong',l.title),node('p',`${l.type.toUpperCase()} · ${formatSize(l.size)} · ${formatDate(l.uploadedAt)}`));
    row.append(copy,removeButton(`document “${l.title}”`,{kind:'remove-lesson',id:l.id,path:l.path},'','Document removed.'));$('admin-lessons').append(row);
  }
  controls();
}
$('connect-form').addEventListener('submit',event=>{
  event.preventDefault();if(client||busy)return;
  let code=$('access-code').value.trim();$('access-code').value='';
  if(!/^[0-9]{4,12}$/.test(code)){status('Enter your access code.','error');return;}
  const signingIn=CodeLibrary.signIn(code);code='';
  run(async()=>{status('Signing in…');const candidate=await signingIn;try{catalog=await candidate.connect();client=candidate;render();}catch(error){candidate.disconnect();throw error;}},'Welcome, Tasnim.');
});
function disconnect(){
  client?.disconnect();client=null;catalog=null;subjectId='';chapterId='';$('access-code').value='';
  for(const name of ['subject-form','chapter-form','upload-form'])$(name).reset();
  for(const name of ['admin-subjects','admin-chapters','admin-lessons'])$(name).replaceChildren();
  controls();status('Signed out.');
}
$('disconnect').addEventListener('click',disconnect);
window.addEventListener('pagehide',()=>{client?.disconnect();client=null;$('access-code').value='';});
window.addEventListener('pageshow',event=>{if(event.persisted)disconnect();});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
$('subject-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client||busy)return;const name=$('subject-name').value.trim();if(!name){status('Enter a subject name.','error');return;}
  run(async()=>{const subject={id:id(),name};catalog=await client.publish({kind:'add-subject',subject},null,status);subjectId=subject.id;chapterId='';$('subject-form').reset();render();},'Subject added. Now add a chapter.');
});
$('chapter-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client||busy)return;const name=$('chapter-name').value.trim(),parent=$('chapter-subject').value;
  if(!name||!parent){status('Choose a subject and enter a chapter name.','error');return;}
  run(async()=>{const chapter={id:id(),subjectId:parent,name};catalog=await client.publish({kind:'add-chapter',chapter},null,status);subjectId=parent;chapterId=chapter.id;$('chapter-form').reset();render();},'Chapter added. You can upload documents.');
});
$('upload-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client||busy)return;
  run(async()=>{
    const title=$('lesson-title').value.trim(),parent=$('lesson-subject').value,chapter=$('lesson-chapter').value,file=$('lesson-file').files[0];
    if(!title||!parent||!chapter)throw new Error('Choose a subject, chapter and document title.');
    status('Checking document…');const type=await validateFile(file),lessonId=id();
    const lesson={id:lessonId,subjectId:parent,chapterId:chapter,title,type,originalName:file.name,size:file.size,uploadedAt:new Date().toISOString(),path:`documents/${parent}/${chapter}/${lessonId}.${type}`};
    catalog=await client.publish({kind:'upload',lesson},file,status);subjectId=parent;chapterId=chapter;$('upload-form').reset();render();
  },'Published. Students can refresh to see it; GitHub caching may take a few minutes.');
});
for(const name of ['chapter-subject','lesson-subject'])$(name).addEventListener('change',()=>selectSubject($(name).value));
$('lesson-chapter').addEventListener('change',()=>{chapterId=$('lesson-chapter').value;render();});
$('admin-refresh').addEventListener('click',()=>run(async()=>{status('Refreshing…');catalog=(await client.snapshot()).catalog;render();},'Library refreshed.'));
controls();
