import {config} from './config.js';
let session=null;
const base=location.hostname==='localhost'||location.hostname==='127.0.0.1'?location.origin+'/api/lms':config.adminService+'/api/lms';
export const clearSession=()=>{session=null;};
export async function api(path,method='GET',data,binary=false){
 const headers=session?{Authorization:'Bearer '+session}:{};if(data!==undefined)headers['Content-Type']='application/json';
 let r;try{r=await fetch(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(binary?180000:45000)});}catch{throw new Error('Could not reach the classroom. Check your connection and retry.');}
 if(!r.ok){const e=await r.json().catch(()=>({}));const error=new Error(e.error||'The request could not be completed.');error.status=r.status;throw error;}
 return binary?r.blob():r.json();
}
export async function signIn(role,code){const result=await api('/session','POST',{role,code,teacher:'tasnim'});session=result.session;return result;}
export async function signOut(){try{await api('/session','DELETE');}finally{clearSession();}}
export const command=(action,data={})=>api('/command','POST',{action,...data});
export async function upload(file,category,parentId,title,progress){
 const intent=await api('/uploads','POST',{name:file.name,mime:file.type,size:file.size,category,parentId});
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',base+'/uploads/'+encodeURIComponent(intent.id)+(title?'?title='+encodeURIComponent(title):''));xhr.setRequestHeader('Authorization','Bearer '+session);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.timeout=240000;
  xhr.upload.onprogress=e=>progress(e.lengthComputable?Math.round(e.loaded/e.total*100):0,'Uploading '+file.name);
  xhr.upload.onload=()=>progress(100,'Saving '+file.name+'…');
  xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300&&result?.uploaded)resolve(result);else reject(new Error(result?.error||'Upload was not confirmed. Please refresh before retrying.'));};
  xhr.onerror=()=>reject(new Error('The upload connection failed. Refresh before retrying.'));xhr.ontimeout=()=>reject(new Error('Upload timed out. Refresh to check before retrying.'));xhr.send(file);
 });
}
