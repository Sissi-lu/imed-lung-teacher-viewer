/* Axial in-plane measurements in display pixels, converted with voxel spacing. */
let measureMode=false,measureDrag=null,lastMeasurement=null;
const view=$('#viewport');
view.insertAdjacentHTML('beforeend','<svg id="measurementOverlay" aria-hidden="true"></svg><div id="measureHint" hidden>点击并拖动测量 · 距离单位 mm</div>');
$('.viewer-head').insertAdjacentHTML('afterend','<div class="measurement-tools"><button id="measureToggle" aria-pressed="false">📏 测量</button><button id="measureLong">填入长径</button><button id="measureShort">填入短径</button><button id="measureClear" title="清除当前病例测量">清除测量</button><output id="measureValue" aria-live="polite">尚未测量</output></div>');
function measurementSpacing(){return currentVoxelSpacing?.length>=2&&currentVoxelSpacing.slice(0,2).every(n=>Number.isFinite(n)&&n>0)?currentVoxelSpacing.slice(0,2):null}
function measurementFrame(){if(!ct)return null;const r=canvas.getBoundingClientRect(),v=view.getBoundingClientRect(),scale=Math.min(r.width/dims[0],r.height/dims[1]);return {x:r.left-v.left+(r.width-dims[0]*scale)/2,y:r.top-v.top+(r.height-dims[1]*scale)/2,scale,v}}
function measurementPoint(e){const f=measurementFrame();if(!f)return null;const x=(e.clientX-f.v.left-f.x)/f.scale,y=(e.clientY-f.v.top-f.y)/f.scale;if(x<0||y<0||x>dims[0]-1||y>dims[1]-1)return null;return {x,y}}
function measurementLength(a,b,spacing){return Math.hypot((b.x-a.x)*spacing[0],(b.y-a.y)*spacing[1])}
function caseMeasurements(){return ct?(getDraft().measurements||[]):[]}
function drawMeasurements(){const svg=$('#measurementOverlay'),f=measurementFrame();svg.replaceChildren();if(!f)return;const z=+$('#slice').value;const measurements=caseMeasurements().filter(m=>m.slice===z);if(measureDrag&&measureDrag.slice===z)measurements.push(measureDrag);
 for(const m of measurements){const p=m.start,q=m.end,x=f.x+p.x*f.scale,y=f.y+p.y*f.scale,x2=f.x+q.x*f.scale,y2=f.y+q.y*f.scale;const distance=measurementLength(p,q,m.spacing);const make=(name,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);return el};make('line',{x1:x,y1:y,x2,y2,stroke:'#ffdd85','stroke-width':2});for(const [cx,cy]of [[x,y],[x2,y2]])make('circle',{cx,cy,r:4,fill:'#ffdd85',stroke:'#223c41','stroke-width':1});const tx=Math.max(5,Math.min(view.clientWidth-110,(x+x2)/2+8)),ty=Math.max(20,Math.min(view.clientHeight-8,(y+y2)/2-10));const text=make('text',{x:tx,y:ty,fill:'#ffedba','font-size':15,'font-family':'Segoe UI, sans-serif','paint-order':'stroke',stroke:'#122d36','stroke-width':4});text.textContent=distance.toFixed(1)+' mm';}
}
const baseRender=render;render=function(){baseRender();drawMeasurements()};
const baseDown=view.onpointerdown,baseMove=view.onpointermove,baseUp=view.onpointerup,baseCancel=view.onpointercancel;
view.onpointerdown=e=>{if(!measureMode){baseDown?.(e);return}if(busy||!ct||e.button!==0)return;const start=measurementPoint(e),spacing=measurementSpacing();if(!start||!spacing)return;measureDrag={start,end:start,spacing,slice:+$('#slice').value};view.setPointerCapture(e.pointerId);e.preventDefault();drawMeasurements()};
view.onpointermove=e=>{if(!measureMode){baseMove?.(e);drawMeasurements();return}if(!measureDrag)return;const p=measurementPoint(e);if(p)measureDrag.end=p;$('#measureValue').textContent=measurementLength(measureDrag.start,measureDrag.end,measureDrag.spacing).toFixed(1)+' mm';drawMeasurements()};
view.onpointerup=e=>{if(!measureMode){baseUp?.(e);return}if(!measureDrag)return;const m=measureDrag;const end=measurementPoint(e);if(end)m.end=end;measureDrag=null;const value=measurementLength(m.start,m.end,m.spacing);if(value>=.1){lastMeasurement={...m,mm:Math.round(value*10)/10};const d=getDraft();d.measurements=[...(d.measurements||[]),lastMeasurement].slice(-30);saveDraft();$('#measureValue').textContent=lastMeasurement.mm.toFixed(1)+' mm';toast('测量完成，可点击「填入长径」或「填入短径」')}drawMeasurements()};
view.onpointercancel=e=>{measureDrag=null;baseCancel?.(e);drawMeasurements()};
$('#measureToggle').onclick=()=>{if(!ct){toast('请先导入CT');return}if(!displayGeometry.verified){toast('该影像方向尚未标准化，暂不开放毫米测量');return}measureMode=!measureMode;measureDrag=null;$('#measureToggle').setAttribute('aria-pressed',String(measureMode));$('#measureHint').hidden=!measureMode;view.classList.toggle('measuring',measureMode);drawMeasurements()};
function useMeasurement(field){if(!lastMeasurement){toast('请先在CT上拖动完成一次测量');return}const d=getDraft();d.answers[field]=String(lastMeasurement.mm);d.confirmed=false;updateDraft();if(reportUnlocked&&!teachingBoard&&teachingTab==='structured'){teachingQuestion=teachingFields.findIndex(f=>f.id===field);report()}toast('已填入'+(field==='long'?'长径':'短径')+' '+lastMeasurement.mm.toFixed(1)+' mm')}
$('#measureLong').onclick=()=>useMeasurement('long');$('#measureShort').onclick=()=>useMeasurement('short');
$('#measureClear').onclick=()=>{if(!ct)return;getDraft().measurements=[];lastMeasurement=null;measureDrag=null;saveDraft();$('#measureValue').textContent='尚未测量';drawMeasurements()};
document.addEventListener('case-reset',()=>{measureDrag=null;lastMeasurement=null;measureMode=false;$('#measureToggle').setAttribute('aria-pressed','false');$('#measureHint').hidden=true;view.classList.remove('measuring');$('#measureValue').textContent='尚未测量';requestAnimationFrame(drawMeasurements)});
document.addEventListener('segmentation-started',()=>{measureDrag=null;drawMeasurements()});
window.addEventListener('resize',drawMeasurements);new ResizeObserver(drawMeasurements).observe(view);
// Redraw after animated panel layout changes or a browser fullscreen change.
document.addEventListener('fullscreenchange',()=>requestAnimationFrame(drawMeasurements));
$('#collapseMission').addEventListener('click',()=>requestAnimationFrame(drawMeasurements));

view.addEventListener('wheel',()=>{measureDrag=null},{capture:true});
$('#reportPanel .panel-heading').insertAdjacentHTML('beforeend','<button id="expandReport" aria-expanded="false">⛶ 放大报告</button>');$('#expandReport').onclick=()=>{const expanded=$('#reportPanel').classList.toggle('report-expanded');$('#expandReport').textContent=expanded?'↙ 恢复大小':'⛶ 放大报告';$('#expandReport').setAttribute('aria-expanded',String(expanded))};
