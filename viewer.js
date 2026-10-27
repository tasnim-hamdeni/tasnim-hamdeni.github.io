import {readPublicCatalog,lessonURL,formatSize} from './core.js';
import {getDocument,GlobalWorkerOptions} from './vendor/pdfjs/build/pdf.min.mjs';
const $=id=>document.getElementById(id);
GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/build/pdf.worker.min.mjs',import.meta.url).href;
let documentURL,pdf,pageNumber=1,rendering=false,queued=false;
async function renderPage(){
 if(!pdf)return;if(rendering){queued=true;return;}rendering=true;
 $('previous-page').disabled=true;$('next-page').disabled=true;$('pdf-zoom').disabled=true;
 try{
  const page=await pdf.getPage(pageNumber),base=page.getViewport({scale:1});
  const width=Math.max(200,Math.min(1100,$('pdf-surface').clientWidth-32));
  const viewport=page.getViewport({scale:width/base.width*Number($('pdf-zoom').value)});
  const outputScale=Math.min(window.devicePixelRatio||1,2,Math.sqrt(8000000/(viewport.width*viewport.height)));
  const canvas=$('pdf-canvas');canvas.width=Math.floor(viewport.width*outputScale);canvas.height=Math.floor(viewport.height*outputScale);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
  await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:outputScale===1?null:[outputScale,0,0,outputScale,0,0]}).promise;
  $('page-count').textContent=`Page ${pageNumber} of ${pdf.numPages}`;canvas.setAttribute('aria-label',`PDF page ${pageNumber} of ${pdf.numPages}`);
  const content=await page.getTextContent();$('page-text').textContent=content.items.map(item=>item.str||'').join(' ')||'This page is blank.';
  $('viewer-status').textContent='';page.cleanup();
 }catch{$('viewer-status').className='status error';$('viewer-status').textContent='This page could not be displayed. Download the PDF to open it.';}
 finally{rendering=false;$('previous-page').disabled=pageNumber<=1;$('next-page').disabled=pageNumber>=pdf.numPages;$('pdf-zoom').disabled=false;if(queued){queued=false;renderPage();}}
}
async function load(){
 try{
  const catalog=await readPublicCatalog(),lesson=catalog.lessons.find(item=>item.id===new URL(location.href).searchParams.get('lesson'));
  if(!lesson||lesson.type!=='pdf')throw new Error('This PDF is unavailable. Return to the resources and refresh.');
  $('document-title').textContent=lesson.title;document.title=`${lesson.title} · Tasnim Hamdeni`;
  const subject=catalog.subjects.find(item=>item.id===lesson.subjectId),chapter=catalog.chapters.find(item=>item.id===lesson.chapterId);
  $('document-details').textContent=`${subject.name} / ${chapter.name} · PDF · ${formatSize(lesson.size)}`;
  $('back-link').href=`./?subject=${encodeURIComponent(lesson.subjectId)}`;
  const response=await fetch(lessonURL(lesson),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error('Could not load this PDF. Please refresh and try again.');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==lesson.size||new TextDecoder().decode(new Uint8Array(bytes,0,Math.min(5,bytes.byteLength)))!=='%PDF-')throw new Error('The PDF download is incomplete or invalid. Please try again.');
  documentURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  $('download-pdf').href=documentURL;$('download-pdf').download=lesson.originalName.replace(/[\\/\x00-\x1f]/g,'_');$('download-pdf').hidden=false;
  $('blank-notice').hidden=lesson.example!==true;
  const assets=new URL('./vendor/pdfjs/',import.meta.url).href;
  pdf=await getDocument({data:new Uint8Array(bytes),cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',isEvalSupported:false}).promise;
  $('pdf-reader').hidden=false;await renderPage();
 }catch(error){$('viewer-status').className='status error';$('viewer-status').textContent=error.name==='TimeoutError'?'The PDF took too long to load. Please refresh.':error.name==='PasswordException'?'This PDF is password protected. Download it to open it.':error.message;}
}
$('previous-page').addEventListener('click',()=>{if(pdf&&!rendering&&pageNumber>1){pageNumber--;renderPage();}});
$('next-page').addEventListener('click',()=>{if(pdf&&!rendering&&pageNumber<pdf.numPages){pageNumber++;renderPage();}});
$('pdf-zoom').addEventListener('change',renderPage);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderPage,150);});
window.addEventListener('pagehide',event=>{if(!event.persisted&&documentURL)URL.revokeObjectURL(documentURL);});
load();
