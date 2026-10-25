import { config } from './config.js';

export const repoRoot = `https://api.github.com/repos/${config.owner}/${config.repository}`;
export const rawRoot = `https://raw.githubusercontent.com/${config.owner}/${config.repository}/${config.branch}`;
export const id = () => crypto.randomUUID();
export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function validateCatalog(data) {
  const fail = () => { throw new Error('The public catalog is invalid. Restore a valid catalog.json in the lesson-data repository.'); };
  if (!data || data.version !== 1 || !Array.isArray(data.subjects) || !Array.isArray(data.lessons)) fail();
  const ids = new Set();
  for (const s of data.subjects) {
    if (!s || typeof s.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) fail();
    ids.add(s.id);
  }
  const lessonIds = new Set();
  for (const l of data.lessons) {
    if (!l || typeof l.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(l.id) || lessonIds.has(l.id) || !ids.has(l.subjectId) || typeof l.title !== 'string' || !l.title.trim() || l.title.length > 160 || !['pdf','pptx'].includes(l.type) || typeof l.originalName !== 'string' || !Number.isInteger(l.size) || l.size < 1 || l.size > config.maxUploadBytes || typeof l.uploadedAt !== 'string' || !Number.isFinite(Date.parse(l.uploadedAt)) || l.path !== `documents/${l.subjectId}/${l.id}.${l.type}`) fail();
    lessonIds.add(l.id);
  }
  return data;
}
export async function readPublicCatalog() {
  let response;
  try { response = await fetch(`${rawRoot}/${config.catalogPath}?v=${Date.now()}`, {cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)}); }
  catch { throw new Error('The library could not be reached. Check your connection and try Refresh library.'); }
  if (!response.ok) throw new Error(response.status === 404 ? 'The lesson library has not been connected yet. The teacher needs to create the public lesson-data repository and catalog. Please check back soon.' : 'The library is temporarily unavailable. Please try Refresh library shortly.');
  try { return validateCatalog(await response.json()); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('The lesson catalog could not be read. Please let your teacher know.'); throw error; }
}
export function formatDate(date) { return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(date)); }
export function formatSize(size) { return size < 1024*1024 ? `${Math.max(1,Math.round(size/1024))} KB` : `${(size/(1024*1024)).toFixed(1)} MB`; }
export function lessonURL(lesson, preview = false) {
  const path = lesson.path.split('/').map(encodeURIComponent).join('/');
  return preview ? `https://github.com/${config.owner}/${config.repository}/blob/${encodeURIComponent(config.branch)}/${path}` : `${rawRoot}/${path}`;
}
export function applyChange(catalog, change) {
  const next = structuredClone(validateCatalog(catalog));
  if (change.kind === 'add-subject') {
    if (next.subjects.some(s => s.name.toLocaleLowerCase() === change.subject.name.toLocaleLowerCase())) throw new Error('A subject with this name already exists.');
    next.subjects.push(change.subject);
  } else if (change.kind === 'remove-subject') {
    if (!next.subjects.some(s => s.id === change.id)) throw new Error('This subject was already removed. Refresh to see the latest library.');
    if (next.lessons.some(l => l.subjectId === change.id)) throw new Error('Remove this subject’s lessons before removing the subject.');
    next.subjects = next.subjects.filter(s => s.id !== change.id);
  } else if (change.kind === 'upload') {
    if (!next.subjects.some(s => s.id === change.lesson.subjectId)) throw new Error('This subject no longer exists. Refresh and choose another subject.');
    if (next.lessons.some(l => l.id === change.lesson.id)) throw new Error('This lesson is already published. Refresh before trying again.');
    next.lessons.push(change.lesson);
  } else if (change.kind === 'remove-lesson') {
    const lesson = next.lessons.find(l => l.id === change.id);
    if (!lesson || lesson.path !== change.path) throw new Error('This lesson changed or was removed. Refresh before trying again.');
    next.lessons = next.lessons.filter(l => l.id !== change.id);
  } else throw new Error('Unknown library operation.');
  return validateCatalog(next);
}
export async function validateFile(file) {
  if (!file || file.size < 1) throw new Error('Choose a non-empty PDF or PPTX file.');
  if (file.size > config.maxUploadBytes) throw new Error('This file exceeds the 50 MB (50 MiB) upload limit.');
  const extension = file.name.split('.').pop().toLowerCase();
  const types = {pdf:['application/pdf','application/x-pdf'],pptx:['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/x-zip-compressed']};
  if (!types[extension] || (file.type && file.type !== 'application/octet-stream' && !types[extension].includes(file.type.toLowerCase()))) throw new Error('Only PDF and PPTX documents are accepted. Check the file extension and file type.');
  const signature = new Uint8Array(await file.slice(0,8).arrayBuffer());
  if (extension === 'pdf') {
    if (new TextDecoder().decode(signature).slice(0,5) !== '%PDF-') throw new Error('This file does not have a valid PDF signature.');
  } else {
    if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 3 || signature[3] !== 4) throw new Error('This file is not a valid PPTX archive.');
    // Read ZIP directory entries without unpacking untrusted documents.
    const tailStart = Math.max(0,file.size-65557);
    const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
    const view = new DataView(tail.buffer); let end = -1;
    for (let i=tail.length-22;i>=0;i--) if (view.getUint32(i,true) === 0x06054b50 && i+22+view.getUint16(i+20,true) === tail.length) {end=i;break;}
    if (end < 0) throw new Error('The PPTX archive is damaged or unsupported.');
    const length=view.getUint32(end+12,true), offset=view.getUint32(end+16,true);
    if (length > 4*1024*1024 || offset+length > file.size) throw new Error('The PPTX archive directory is invalid or too large.');
    const dir = new DataView(await file.slice(offset,offset+length).arrayBuffer());
    const names = new Set(); let pos=0;
    while (pos+46<=dir.byteLength && dir.getUint32(pos,true) === 0x02014b50) {
      const n=dir.getUint16(pos+28,true), extra=dir.getUint16(pos+30,true), comment=dir.getUint16(pos+32,true);
      if (pos+46+n+extra+comment>dir.byteLength) throw new Error('The PPTX archive directory is damaged.');
      names.add(new TextDecoder().decode(new Uint8Array(dir.buffer,pos+46,n)));
      pos+=46+n+extra+comment;
    }
    if (!names.has('[Content_Types].xml') || !names.has('ppt/presentation.xml')) throw new Error('Choose a PowerPoint PPTX document, rather than another ZIP file.');
  }
  return extension;
}
