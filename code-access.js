import {config} from './config.js';
import {repoRoot} from './core.js';
import {GitHubLibrary} from './github.js';
const service=()=>{if(!config.adminService)throw new Error('Classroom access is being set up. Please try again later.');return config.adminService;};
export class CodeLibrary extends GitHubLibrary{
 #session;#request;
 constructor(session,request=fetch){
  super(session,(url,options)=>{
   if(!url.startsWith(repoRoot))throw new Error('Invalid library request.');
   return request(service()+'/api/github'+url.slice(repoRoot.length),{...options,redirect:'error'});
  });
  this.#session=session;this.#request=(...args)=>request(...args);
 }
 static async signIn(code,request=fetch){
  let response;try{response=await request(service()+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000),redirect:'error'});}catch(error){if(error.message?.includes('being set up'))throw error;throw new Error('Could not connect. Check your connection and try again.');}
  let data;try{data=await response.json();}catch{throw new Error('Classroom access is temporarily unavailable.');}
  if(!response.ok)throw new Error(data.message||'Could not sign in. Please try again.');
  if(typeof data.session!=='string'||!/^[a-f0-9]{64}$/.test(data.session))throw new Error('Could not start your session.');
  const candidate=new CodeLibrary(data.session,request);
  if(data.setupRequired){candidate.disconnect();throw new Error('Your classroom needs its one-time setup. Please contact the site owner.');}
  return candidate;
 }
 disconnect(){
  const session=this.#session;this.#session='';super.disconnect();
  if(session)this.#request(service()+'/api/session',{method:'DELETE',headers:{Authorization:`Bearer ${session}`},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,redirect:'error'}).catch(()=>{});
 }
}
