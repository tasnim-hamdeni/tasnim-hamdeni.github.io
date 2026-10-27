import {node,id,validateFile,formatDate,formatSize} from './core.js';
import {CodeLibrary} from './code-access.js';

const $=id=>document.getElementById(id);
let client=null,catalog=null,busy=false,subjectId='',chapterId='';
function status(text,type=''){$('admin-status').className=`status ${type}`;$('admin-status').textContent=text;if(type==='error')$('admin-status').scrollIntoView?.({block:'nearest'});}
function controls(){
 document.querySelectorAll('fieldset').forEach(f=>{f.disabled=!client||busy;});
 $('chapter-form').querySelector('fieldset').disabled=!client||busy||!subjectId;
 $('upload-form').querySelector('fieldset').disabled=!client||busy||!chapterId;
 document.querySelectorAll('.remove,.item-select,#show-upload,#cancel-upload').forEach(b=>{b.disabled=!client||busy;});
 $('connect-button').disabled=busy||!!client;$('access-code').disabled=busy||!!client;
 $('disconnect').hidden=!client;$('disconnect').disabled=busy;$('admin-refresh').disabled=!client||busy;
 $('connection-badge').textContent=client?'Signed in':'Signed out';$('workspace').hidden=!client;$('login-panel').hidden=!!client;
 $('progress').hidden=!busy;if(busy)$('progress').removeAttribute('value');
}
async function run(action,success){
 if(busy)return;busy=true;controls();
 try{await action();if(success)status(success,'success');}
 catch(error){status(error.message,'error');}
 finally{busy=false;controls();}
}
function uploadEditor(open){$('upload-form').hidden=!open;$('show-upload').setAttribute('aria-expanded',String(open));if(!open)$('upload-form').reset();}
function selectSubject(value){subjectId=value;chapterId='';uploadEditor(false);status('');render();if(window.innerWidth<=760)$('selected-subject').scrollIntoView?.({block:'start'});}
function selectChapter(value){chapterId=value;uploadEditor(false);status('');render();if(window.innerWidth<=760)$('chapter-content').scrollIntoView?.({block:'start'});}
function confirmRemoval(title,message){
 return new Promise(resolve=>{const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;dialog.returnValue='cancel';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='remove'),{once:true});dialog.showModal();});
}
const counted=(count,word)=>`${count} ${word}${count===1?'':'s'}`;
function deletionPlan(kind,item){
 const chapters=kind==='subject'?catalog.chapters.filter(c=>c.subjectId===item.id):kind==='chapter'?[item]:[];
 const documents=kind==='subject'?catalog.lessons.filter(l=>l.subjectId===item.id):kind==='chapter'?catalog.lessons.filter(l=>l.chapterId===item.id):[item];
 const operations=documents.map(l=>({kind:'remove-lesson',id:l.id,path:l.path}));
 operations.push(...chapters.map(c=>({kind:'remove-chapter',id:c.id})));
 if(kind==='subject')operations.push({kind:'remove-subject',id:item.id});
 const details=kind==='subject'?`its ${counted(chapters.length,'chapter')} and ${counted(documents.length,'document')}`:kind==='chapter'?`its ${counted(documents.length,'document')}`:'';
 const name=kind==='document'?item.title:item.name;
 return {operations,message:`Delete “${name}”${details?' and '+details:''}? This removes ${kind==='document'?'it':'them'} from the student website.`};
}
function removeButton(kind,item){
 const label=kind==='document'?item.title:item.name,button=node('button','Delete','remove');button.type='button';button.setAttribute('aria-label',`Delete ${kind} ${label}`);
 button.addEventListener('click',async()=>{
  if(busy||!client)return;const plan=deletionPlan(kind,item);
  if(!await confirmRemoval(`Delete ${kind}?`,plan.message)||busy||!client)return;
  await run(async()=>{
   let completed=0;
   try{
    for(const operation of plan.operations){
     const report=()=>status(`Deleting ${completed+1} of ${plan.operations.length}…`);report();
     catalog=await client.publish(operation,null,report);completed++;
    }
    uploadEditor(false);render();
   }catch(error){
    // Each confirmed file removal is committed independently. Refresh after a
    // partial/ambiguous failure; never delete unconfirmed new concurrent items.
    let refreshed=false;try{catalog=(await client.snapshot()).catalog;refreshed=true;}catch{}
    uploadEditor(false);render();
    throw new Error(`Deletion stopped. ${refreshed?'Remaining items are shown.':'Refresh to check remaining items.'} ${error.message}`);
   }
  },`${kind[0].toUpperCase()+kind.slice(1)} deleted.`);
 });return button;
}
function choice(kind,item,count,selected,onClick){
 const row=node('div',undefined,'admin-item manager-item'),select=node('button',undefined,`item-select${selected?' selected':''}`);
 select.type='button';select.setAttribute('aria-pressed',String(selected));select.setAttribute('aria-label',`Open ${kind} ${item.name}`);
 select.append(node('strong',item.name),node('span',count,'item-count'));select.addEventListener('click',onClick);
 row.append(select,removeButton(kind,item));return row;
}
function render(){
 if(!catalog)return;
 if(!catalog.subjects.some(s=>s.id===subjectId))subjectId=catalog.subjects[0]?.id||'';
 const subject=catalog.subjects.find(s=>s.id===subjectId),chapters=catalog.chapters.filter(c=>c.subjectId===subjectId);
 if(!chapters.some(c=>c.id===chapterId))chapterId=chapters[0]?.id||'';
 const chapter=chapters.find(c=>c.id===chapterId);
 $('no-subject').hidden=!!subject;$('subject-content').hidden=!subject;$('chapter-content').hidden=!chapter;
 $('selected-subject').textContent=subject?.name||'';$('selected-chapter').textContent=chapter?.name||'';
 $('admin-subjects').replaceChildren();$('admin-chapters').replaceChildren();$('admin-lessons').replaceChildren();
 for(const s of catalog.subjects)$('admin-subjects').append(choice('subject',s,counted(catalog.chapters.filter(c=>c.subjectId===s.id).length,'chapter'),s.id===subjectId,()=>selectSubject(s.id)));
 if(!chapters.length)$('admin-chapters').append(node('p','No chapters.','muted'));
 for(const c of chapters)$('admin-chapters').append(choice('chapter',c,counted(catalog.lessons.filter(l=>l.chapterId===c.id).length,'document'),c.id===chapterId,()=>selectChapter(c.id)));
 const documents=catalog.lessons.filter(l=>l.chapterId===chapterId).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt));
 $('document-count').textContent=counted(documents.length,'document');
 if(!documents.length)$('admin-lessons').append(node('p','No documents.','muted'));
 for(const l of documents){
  const row=node('div',undefined,'admin-item'),copy=node('div');copy.append(node('strong',l.title),node('p',`${l.type.toUpperCase()} · ${l.example?'Example · ':''}${formatSize(l.size)} · ${formatDate(l.uploadedAt)}`));
  row.append(copy,removeButton('document',l));$('admin-lessons').append(row);
 }
 controls();
}
$('connect-form').addEventListener('submit',event=>{
 event.preventDefault();if(client||busy)return;
 let code=$('access-code').value.trim();$('access-code').value='';
 if(!/^[0-9]{4,12}$/.test(code)){status('Enter your access code.','error');return;}
 const signingIn=CodeLibrary.signIn(code);code='';
 run(async()=>{status('Signing in…');const candidate=await signingIn;try{catalog=await candidate.connect();client=candidate;render();status('');}catch(error){candidate.disconnect();throw error;}},'');
});
function disconnect(){
 client?.disconnect();client=null;catalog=null;subjectId='';chapterId='';$('access-code').value='';
 for(const name of ['subject-form','chapter-form','upload-form'])$(name).reset();
 for(const name of ['admin-subjects','admin-chapters','admin-lessons'])$(name).replaceChildren();
 uploadEditor(false);controls();status('Signed out.');
}
$('disconnect').addEventListener('click',disconnect);
window.addEventListener('pagehide',()=>{client?.disconnect();client=null;$('access-code').value='';});
window.addEventListener('pageshow',event=>{if(event.persisted)disconnect();});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
$('subject-form').addEventListener('submit',event=>{
 event.preventDefault();if(!client||busy)return;const name=$('subject-name').value.trim();if(!name){status('Enter a subject name.','error');return;}
 run(async()=>{const subject={id:id(),name};catalog=await client.publish({kind:'add-subject',subject},null,status);subjectId=subject.id;chapterId='';$('subject-form').reset();uploadEditor(false);render();},'Subject added.');
});
$('chapter-form').addEventListener('submit',event=>{
 event.preventDefault();if(!client||busy)return;const name=$('chapter-name').value.trim(),parent=subjectId;
 if(!name||!parent){status('Choose a subject and enter a chapter name.','error');return;}
 run(async()=>{const chapter={id:id(),subjectId:parent,name};catalog=await client.publish({kind:'add-chapter',chapter},null,status);chapterId=chapter.id;$('chapter-form').reset();uploadEditor(false);render();},'Chapter added.');
});
$('show-upload').addEventListener('click',()=>{uploadEditor(true);$('lesson-file').focus();});
$('cancel-upload').addEventListener('click',()=>uploadEditor(false));
$('lesson-file').addEventListener('change',()=>{const file=$('lesson-file').files[0];if(file&&!$('lesson-title').value.trim())$('lesson-title').value=file.name.replace(/\.(pdf|pptx)$/i,'').slice(0,160);});
$('upload-form').addEventListener('submit',event=>{
 event.preventDefault();if(!client||busy)return;
 run(async()=>{
  const title=$('lesson-title').value.trim(),parent=subjectId,chapter=chapterId,file=$('lesson-file').files[0];
  if(!title||!parent||!chapter)throw new Error('Choose a chapter and enter a document title.');
  status('Checking document…');const type=await validateFile(file),lessonId=id();
  const lesson={id:lessonId,subjectId:parent,chapterId:chapter,title,type,originalName:file.name,size:file.size,uploadedAt:new Date().toISOString(),path:`documents/${parent}/${chapter}/${lessonId}.${type}`};
  catalog=await client.publish({kind:'upload',lesson},file,status);uploadEditor(false);render();
 },'Published.');
});
$('admin-refresh').addEventListener('click',()=>run(async()=>{status('Refreshing…');catalog=(await client.snapshot()).catalog;uploadEditor(false);render();},'Refreshed.'));
controls();
