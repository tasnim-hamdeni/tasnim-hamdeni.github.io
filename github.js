import {config} from './config.js';
import {repoRoot, validateCatalog, applyChange} from './core.js';

export class GitHubLibrary {
  #token;
  constructor(token, request = fetch) { this.#token=token; this.request=(...args)=>request(...args); }
  disconnect() { this.#token=''; }
  async api(path, method='GET', body) {
    if (!this.#token) throw new Error('Connect with your token before managing lessons.');
    let response;
    try {
      response=await this.request(`${repoRoot}${path}`,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2022-11-28',...(body ? {'Content-Type':'application/json'} : {})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});
    } catch {
      throw new Error(method === 'PATCH' ? 'Publication could not be confirmed because the connection was interrupted. Refresh the library before retrying; the change may already be live.' : 'GitHub could not be reached or the request timed out. No publication has been confirmed. Check your connection and refresh before retrying.');
    }
    if (!response.ok) {
      const messages={401:'The token is invalid or expired. Disconnect and enter a new fine-grained token.',403:'GitHub denied this request. Check Contents: Read and write, token approval, repository rules, and API rate limits.',404:'The repository, main branch, or catalog was not found, or this token has no access. Complete repository setup and check the selected repository.',409:'The library changed during publication.',422:'GitHub rejected the update. The library may have changed, or a repository rule may prevent this commit.'};
      const error=new Error(messages[response.status] || `GitHub returned HTTP ${response.status}. The change has not been confirmed.`);
      error.status=response.status; throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async snapshot() {
    const ref=await this.api(`/git/ref/heads/${encodeURIComponent(config.branch)}`);
    const head=ref.object.sha;
    const commit=await this.api(`/git/commits/${head}`);
    const file=await this.api(`/contents/${config.catalogPath}?ref=${head}`);
    if (file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('The catalog is too large or is not a regular JSON file.');
    let catalog;
    try { catalog=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))); }
    catch { throw new Error('The repository catalog is not readable JSON. Restore catalog.json before continuing.'); }
    return {head,tree:commit.tree.sha,catalog:validateCatalog(catalog)};
  }
  async connect() {
    const repository=await this.api('');
    if (repository.private || repository.visibility === 'private') throw new Error('The lesson-data repository must be public so students can read lessons without a token.');
    if (repository.permissions?.push === false) throw new Error('This account cannot write to the lesson-data repository.');
    return (await this.snapshot()).catalog;
  }
  async publish(change, file, onStage=()=>{}) {
    let documentSHA;
    if (file) {
      onStage('Reading the document…');
      const content=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(',')[1]);
        reader.onerror=()=>reject(new Error('The selected file could not be read.'));
        reader.onabort=()=>reject(new Error('File reading was cancelled.'));
        reader.readAsDataURL(file);
      });
      onStage('Uploading the document to GitHub… Keep this page open.');
      documentSHA=(await this.api('/git/blobs','POST',{content,encoding:'base64'})).sha;
    }
    for (let attempt=0;attempt<3;attempt++) {
      onStage(attempt ? 'Another update arrived. Combining your change with the latest library…' : 'Checking the latest library…');
      const snapshot=await this.snapshot();
      const catalog=applyChange(snapshot.catalog,change);
      const entries=[{path:config.catalogPath,mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)+'\n'}];
      if (change.kind === 'upload') entries.push({path:change.lesson.path,mode:'100644',type:'blob',sha:documentSHA});
      if (change.kind === 'remove-lesson') entries.push({path:change.path,mode:'100644',type:'blob',sha:null});
      const tree=await this.api('/git/trees','POST',{base_tree:snapshot.tree,tree:entries});
      const commit=await this.api('/git/commits','POST',{message:`Lesson library: ${change.kind}`,tree:tree.sha,parents:[snapshot.head]});
      onStage('Publishing the catalog and documents together…');
      try {
        await this.api(`/git/refs/heads/${encodeURIComponent(config.branch)}`,'PATCH',{sha:commit.sha,force:false});
        return catalog;
      } catch (error) {
        // A non-fast-forward update cannot replace another teacher session's work.
        if (![409,422].includes(error.status)) throw error;
        const latest=await this.api(`/git/ref/heads/${encodeURIComponent(config.branch)}`);
        if (latest.object.sha === snapshot.head) throw error;
        if (attempt === 2) throw new Error('The library is changing frequently. Your change was not published. Refresh and try again.');
      }
    }
  }
}
