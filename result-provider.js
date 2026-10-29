// UI loads data through this provider. A future model provider can implement
// the same result shape; there are currently no model calls or external uploads.
window.resultProvider={
 mode:'example',
 capabilities:{lungSegmentation:false,reportGeneration:false},
 async loadExample(){
  await this.ready;
  if(this.mode==='server'){
   const id=this.caseId||'30';
   const read=async kind=>{const r=await fetch('/api/cases/'+id+'/'+kind);if(!r.ok){const e=await r.json();throw Error(e.error||'病例读取失败')}return r};
   const meta=await (await read('meta')).json();
   const decode=async kind=>new Response((await read(kind)).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   const [ct,mask]=await Promise.all([decode('ct'),decode('mask')]);
   return {meta,ct:new Int16Array(ct),mask:new Uint8Array(mask)};
  }
  const read=async path=>{const r=await fetch(path);if(!r.ok)throw Error('读取失败：'+path);return r};
  const decode=async path=>{const r=await read(path);return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()};
  const [meta,ct,mask]=await Promise.all([read('data/case.json').then(r=>r.json()),decode('data/ct.bin.gz'),decode('data/mask.bin.gz')]);
  return {meta,ct:new Int16Array(ct),mask:new Uint8Array(mask)};
 }
};
window.resultProvider.ready=(async()=>{
 try{const r=await fetch('/api/cases');if(!r.ok)return;const data=await r.json();if(Array.isArray(data.cases)){window.resultProvider.mode='server';window.resultProvider.catalog=data.cases}}
 catch{/* Local preview retains its bundled example. */}
})();
