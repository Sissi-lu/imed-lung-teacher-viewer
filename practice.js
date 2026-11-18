/* Practice tools use native image coordinates; display transforms never change the saved mask. */
function practiceUUID(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')}
const practiceNames={learning:'🌿 学习',application:'✏ 应用',innovation:'✦ 创新'};
let practiceGesture=null,practiceDrawing=[],practiceVertex=null,practicePointKind=1,practiceRevision=0,practiceSession=null,practicePending=false,practiceTimer,practiceObject=0;
let anonymousSession;try{anonymousSession=sessionStorage.getItem('lung-practice-session');if(!anonymousSession){anonymousSession=practiceUUID();sessionStorage.setItem('lung-practice-session',anonymousSession)}}catch{anonymousSession=practiceUUID()}
const practiceView=$('#viewport');
practiceView.insertAdjacentHTML('beforeend','<svg id="practiceOverlay"></svg>');
$('.viewer-head').insertAdjacentHTML('afterend',`<div class="practice-tools" hidden><b class="practice-badge" id="practiceBadge"></b><button id="practiceFrame">选择此帧</button><button id="practiceReturn">返回标注帧</button><button id="practiceNew">新增病灶</button><select id="practiceObject" aria-label="选择病灶"></select><button id="practiceForeground" aria-pressed="true">前景点</button><button id="practiceBackground">背景点</button><button id="practiceUndo">撤销</button><button id="practiceDelete">删除病灶</button><button id="practiceClear">清空标注</button><button id="practiceRetry">重试分割</button><button id="practiceEdit">重新编辑</button><output id="practiceStatus" aria-live="polite"></output><a id="practiceDownloads" hidden>下载本次标注档案</a></div>`);
const oldFinished=localizationFinished,oldPoints=localizationPoints,oldUpdateLocalization=updateLocalization,oldStartLocalization=startLocalization;
localizationFinished=function(){return window.practiceMode!=='learning'&&ct&&example?!!getDraft().localization.practicePassed:oldFinished()};
localizationPoints=function(r){return r?.mode&&r.mode!=='learning'?(r.dice||0)*25:oldPoints(r)};
const originalFocus=focusGuideStep;
focusGuideStep=function(i,...rest){return originalFocus(i===0?0:Math.max(0,i-1),...rest)};
hints.splice(0,hints.length,['#import','第一步 · 阅片练习：选择病例与难度，完成影像中的挑战。'],['#report','第二步 · 报告填写：完成结构化问答与诊断。'],['#evaluate','第三步 · 评估与复盘：提交报告，查看评分。'],['#export','第四步 · 导出训练结果：保存报告、标注与评价。']);
$('#import span').childNodes[0].textContent='阅片练习';
['#import','#report','#evaluate','#export'].forEach((s,i)=>{$(s+' b').textContent=String(i+1).padStart(2,'0');$(s).setAttribute('aria-label',hints[i][1]);$(s).title=hints[i][1]});
$('#guideDialog .guide-cards').innerHTML=hints.map((h,i)=>`<div><b>0${i+1}</b><h3>${['阅片练习','报告填写','评估与复盘','导出训练结果'][i]}</h3><p>${h[1]}</p></div>`).join('');
$('#guideDialog .hint').textContent='学习：点击定位；应用：勾画轮廓；创新：与AI共同分割。';
function practiceData(){const d=getDraft();return d.practice||(d.practice={sliceIndex:null,polygons:[],groups:[]})}
function nativeZ(){return displayGeometry.reverseZ?dims[2]-1-Number($('#slice').value):Number($('#slice').value)}
function practiceXY(e){const index=localizationIndex(e);if(index===null)return null;return [index%dims[0],Math.floor(index/dims[0])%dims[1]]}
function practiceDirty(){practiceData().drawing=practiceDrawing;practiceRevision++;const r=getDraft().localization;r.practicePassed=false;r.outcome='pending';delete r.submissionId;updateDraft();$('#overlay').checked=false;segmented=false;updatePractice();render()}
async function practiceRequest(path,data,method='POST'){const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let out;try{out=await r.json()}catch{throw Error('服务响应异常，请查看服务日志后重试')}if(!r.ok)throw Error(out.error||out.detail||'请求失败');return out}
function updatePractice(){if(!ct)return;const mode=window.practiceMode||'learning',advanced=mode!=='learning'&&example,p=practiceData(),done=localizationFinished();document.body.dataset.practice=mode;$('.demo-label').textContent=mode==='innovation'?'SAM 交互分割 · AI辅助练习':'真实CT · 阅片练习';$('#practiceBadge').textContent=practiceNames[mode];$('.practice-tools').hidden=!advanced;$('.localization-tools').hidden=advanced;
 for(const id of ['practiceForeground','practiceBackground','practiceRetry','practiceObject'])$('#'+id).hidden=mode!=='innovation';
 $('#practiceEdit').hidden=!done;for(const id of ['practiceFrame','practiceNew','practiceUndo','practiceDelete','practiceClear','practiceRetry'])$('#'+id).disabled=done;
 if(advanced){$('#analyze').disabled=practicePending||done||p.sliceIndex===null;$('#analyze').textContent=practicePending?'处理中…':done?'练习完成 ✓':'提交标注 →';$('#locate').disabled=!done;$('#overlay').disabled=!done||!localizationRequired();$('#practiceStatus').textContent=p.message||(p.sliceIndex===null?'滚动浏览CT，选择想标注的一帧。':`标注第 ${displayGeometry.reverseZ?dims[2]-p.sliceIndex:p.sliceIndex+1} 帧 · ${done?'挑战已完成':'有参考时需 Dice ≥ 0.50，才可填写报告'}`)}
 $('#import').classList.toggle('done',done);const select=$('#practiceObject');select.replaceChildren();p.groups.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent='病灶 '+(i+1);select.append(o)});select.value=practiceObject;
 $('#practiceDownloads').hidden=!getDraft().localization.submissionId;if(!$('#practiceDownloads').hidden){$('#practiceDownloads').href='/api/practice/submissions/'+getDraft().localization.submissionId+'/download';$('#practiceDownloads').download='标注档案.zip'}
 drawPractice()}
updateLocalization=function(){oldUpdateLocalization();updatePractice()};
startLocalization=function(){if(window.practiceMode==='learning')oldStartLocalization();else submitPractice()};
function screenXY(p){const f=measurementFrame();const x=displayGeometry.flipX?dims[0]-1-p[0]:p[0],y=displayGeometry.flipY?dims[1]-1-p[1]:p[1];return [f.x+(x+.5)*f.scale,f.y+(y+.5)*f.scale]}
function drawPractice(){practiceView.classList.toggle('practice-drawing',!!ct&&example&&window.practiceMode==='application'&&!localizationFinished()&&practiceData().sliceIndex!==null&&practiceData().sliceIndex===nativeZ());const svg=$('#practiceOverlay');svg.replaceChildren();if(!ct||!example||window.practiceMode==='learning')return;const p=practiceData();if(nativeZ()!==p.sliceIndex)return;
 const element=(name,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));svg.append(n);return n};
 if(window.practiceMode==='application')for(const points of [...p.polygons,practiceDrawing]){element(points===practiceDrawing?'polyline':'polygon',{points:points.map(screenXY).map(v=>v.join(',')).join(' '),fill:points===practiceDrawing?'none':'#ffbd5e55',stroke:'#ffce80','stroke-width':2});for(const point of points){const [cx,cy]=screenXY(point);element('circle',{cx,cy,r:4,fill:'#ffda8d'})}}
 else for(const g of p.groups){if(g.maskPng){const f=measurementFrame();element('image',{href:'data:image/png;base64,'+g.maskPng,x:0,y:0,width:dims[0],height:dims[1],opacity:.4,style:'image-rendering:pixelated;mix-blend-mode:screen',transform:`translate(${f.x+(displayGeometry.flipX?dims[0]*f.scale:0)} ${f.y+(displayGeometry.flipY?dims[1]*f.scale:0)}) scale(${f.scale*(displayGeometry.flipX?-1:1)} ${f.scale*(displayGeometry.flipY?-1:1)})`})}g.points.forEach(point=>{const [cx,cy]=screenXY(point);element('circle',{cx,cy,r:5,fill:point[2]?'#68edac':'#ff7676',stroke:'#fff','stroke-width':1})})}
}
const practiceRender=render;render=function(){practiceRender();drawPractice()};
function closePolygon(){if(practiceDrawing.length<3){toast('至少需要三个顶点');return}const p=practiceData();p.polygons.push(practiceDrawing);practiceDrawing=[];p.message=`第 ${p.polygons.length} 个病灶已闭合，可新增病灶或提交标注。`;practiceDirty()}
$('#practiceFrame').onclick=()=>{const p=practiceData();if(p.sliceIndex!==null&&(p.polygons.length||p.groups.length)&&!confirm('重新选帧会清除当前草稿标注，已有提交档案保留。继续？'))return;releasePractice();p.sliceIndex=nativeZ();p.polygons=[];p.groups=[];practiceDrawing=[];practiceObject=0;p.message='';practiceDirty()};
$('#practiceReturn').onclick=()=>{const z=practiceData().sliceIndex;if(z!==null){$('#slice').value=displayGeometry.reverseZ?dims[2]-1-z:z;render()}};
$('#practiceNew').onclick=()=>{
 if(window.practiceMode==='application'){
  if(practiceData().sliceIndex===null)$('#practiceFrame').click();
  if(practiceDrawing.length&&practiceDrawing.length<3){toast('当前轮廓至少需要三个顶点，请继续绘制或按 Escape 取消');return}
  if(practiceDrawing.length)closePolygon();
  $('#practiceReturn').click();
  if(measureMode)$('#measureToggle').click();
  const p=practiceData();p.message=`正在绘制第 ${p.polygons.length+1} 个病灶：点击CT添加顶点，点击起点或按 Enter 闭合轮廓。`;
  practiceDirty();toast('已开始新病灶，请在CT图像上逐点勾画轮廓');
 }else{
  if(practiceData().sliceIndex===null)return toast('请先选择标注帧');
  practiceData().groups.push({id:practiceUUID(),points:[]});practiceObject=practiceData().groups.length-1;practiceDirty();
 }
};
$('#practiceObject').onchange=e=>{practiceObject=+e.target.value};
for(const [id,kind]of [['practiceForeground',1],['practiceBackground',0]])$('#'+id).onclick=()=>{practicePointKind=kind;$('#practiceForeground').setAttribute('aria-pressed',String(!!kind));$('#practiceBackground').setAttribute('aria-pressed',String(!kind))};
$('#practiceUndo').onclick=()=>{const p=practiceData();if(window.practiceMode==='application'){if(practiceDrawing.length)practiceDrawing.pop();else practiceDrawing=p.polygons.pop()||[]}else{const g=p.groups[practiceObject];if(g){g.points.pop();delete g.maskPng;schedulePractice()}}practiceDirty()};
$('#practiceDelete').onclick=()=>{const p=practiceData();if(window.practiceMode==='application'){p.polygons.pop();practiceDrawing=[]}else p.groups.splice(practiceObject,1);practiceObject=Math.max(0,practiceObject-1);practiceDirty()};
$('#practiceClear').onclick=()=>{if(!confirm('清空当前帧标注？已提交档案仍会保留。'))return;const p=practiceData();p.polygons=[];p.groups=[];practiceDrawing=[];practiceDirty()};
$('#practiceEdit').onclick=()=>{practiceData().message='请修改标注后重新提交。';practiceDirty();report()};
$('#practiceRetry').onclick=()=>schedulePractice();
function releasePractice(){clearTimeout(practiceTimer);practiceRevision++;if(practiceSession)fetch('/api/sam/sessions/'+practiceSession,{method:'DELETE'}).catch(()=>{});practiceSession=null}
function schedulePractice(){clearTimeout(practiceTimer);practiceTimer=setTimeout(runPracticeSam,250)}
async function runPracticeSam(){if(practicePending){schedulePractice();return}const p=practiceData(),g=p.groups[practiceObject];if(!g||!g.points.some(p=>p[2]===1)||!g.points.some(p=>p[2]===0)){p.message='每个病灶需要至少一个前景点和一个背景点。';updatePractice();return}const revision=practiceRevision,gid=g.id;practicePending=true;p.message='SAM 正在分割…';updatePractice();try{if(!practiceSession){const r=await practiceRequest('/api/sam/sessions',{caseId:meta.caseId,sliceIndex:p.sliceIndex});if(revision!==practiceRevision)return;practiceSession=r.sessionId;p.model={backend:r.backend,checkpoint:r.checkpoint}}const r=await practiceRequest('/api/sam/sessions/'+practiceSession+'/predict',{objectId:gid,revision,points:g.points});if(revision!==practiceRevision)return;g.maskPng=r.maskPng;g.modelScore=r.modelScore;p.message='分割已更新，可继续调整点位或提交。';saveDraft()}catch(e){if(revision===practiceRevision){practiceSession=null;p.message=e.message+'；点击重试分割。'}}finally{practicePending=false;updatePractice()}}
practiceView.addEventListener('pointerdown',e=>{if(window.practiceMode==='learning'||!ct||!example||measureMode||localizationFinished()||e.button!==0)return;const p=practiceData(),xy=practiceXY(e);if(!xy||p.sliceIndex!==nativeZ())return;practiceVertex=null;const lists=window.practiceMode==='application'?p.polygons:p.groups.map(g=>g.points);for(let i=0;i<lists.length;i++)for(let j=0;j<lists[i].length;j++)if(Math.hypot(...screenXY(lists[i][j]).map((v,k)=>v-(k?e.clientY-practiceView.getBoundingClientRect().top:e.clientX-practiceView.getBoundingClientRect().left)))<9)practiceVertex={i,j};practiceGesture={x:e.clientX,y:e.clientY,xy,moved:false};e.stopImmediatePropagation();e.preventDefault();practiceView.setPointerCapture(e.pointerId)},{capture:true});
practiceView.addEventListener('pointermove',e=>{if(!practiceGesture)return;e.stopImmediatePropagation();if(Math.hypot(e.clientX-practiceGesture.x,e.clientY-practiceGesture.y)>5)practiceGesture.moved=true;if(practiceVertex){const xy=practiceXY(e);if(xy){const p=practiceData(),point=window.practiceMode==='application'?p.polygons[practiceVertex.i][practiceVertex.j]:p.groups[practiceVertex.i].points[practiceVertex.j];point[0]=xy[0];point[1]=xy[1];drawPractice()}}},{capture:true});
practiceView.addEventListener('pointerup',e=>{const g=practiceGesture;if(!g)return;e.stopImmediatePropagation();practiceGesture=null;const p=practiceData();if(g.moved&&!practiceVertex)return;if(!g.moved&&!practiceVertex){if(window.practiceMode==='application'){if(practiceDrawing.length>=3&&Math.hypot(...screenXY(practiceDrawing[0]).map((v,k)=>v-(k?e.clientY-practiceView.getBoundingClientRect().top:e.clientX-practiceView.getBoundingClientRect().left)))<10)closePolygon();else practiceDrawing.push(g.xy)}else{if(!p.groups[practiceObject])p.groups.push({id:practiceUUID(),points:[]});p.groups[practiceObject].points.push([...g.xy,practicePointKind])}}if(window.practiceMode==='innovation'){if(practiceVertex)practiceObject=practiceVertex.i;delete p.groups[practiceObject].maskPng;schedulePractice()}practiceDirty();practiceVertex=null},{capture:true});
for(const event of ['pointercancel','wheel'])practiceView.addEventListener(event,()=>{practiceGesture=null;practiceVertex=null},{capture:true});
document.addEventListener('keydown',e=>{if(window.practiceMode!=='application'||!practiceDrawing.length||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='Enter'){e.preventDefault();closePolygon()}if(e.key==='Escape'){practiceDrawing=[];drawPractice()}});
async function mergedPracticeMask(groups){const c=document.createElement('canvas');[c.width,c.height]=dims;const context=c.getContext('2d'),out=context.createImageData(c.width,c.height);for(const g of groups){if(!g.maskPng)throw Error('请等待所有病灶分割完成，或重试分割');const im=new Image();im.src='data:image/png;base64,'+g.maskPng;await im.decode();context.drawImage(im,0,0);const pixels=context.getImageData(0,0,c.width,c.height).data;for(let i=0;i<pixels.length;i+=4){if(pixels[i])out.data[i]=out.data[i+1]=out.data[i+2]=255;out.data[i+3]=255}}context.putImageData(out,0,0);return c.toDataURL('image/png').split(',')[1]}
async function submitPractice(){if(practicePending||!ct||!example)return;const mode=window.practiceMode,p=practiceData(),caseId=meta.caseId,revision=practiceRevision;if(mode!=='learning'&&p.sliceIndex===null)return toast('请先选择标注帧');if(practiceDrawing.length)return toast('请先点击起点或按Enter闭合轮廓');practicePending=true;updatePractice();try{const maskPng=mode==='innovation'?await mergedPracticeMask(p.groups):undefined;const r=await practiceRequest('/api/practice/submissions',{caseId,mode,anonymousSession,sliceIndex:mode==='learning'?nativeZ():p.sliceIndex,polygons:p.polygons,groups:p.groups.map(({maskPng,...g})=>g),maskPng,localization:getDraft().localization,model:p.model});if(caseId!==meta.caseId||revision!==practiceRevision)return;Object.assign(getDraft().localization,r,{mode,practicePassed:r.passed,outcome:mode==='learning'?getDraft().localization.outcome:r.passed?'hit':'pending'});p.message=r.message||(!r.applicable?'无参考标签，不计标注分。':r.passed?`挑战完成！Dice ${r.dice===null?'—':r.dice.toFixed(3)}`:`Dice ${r.dice.toFixed(3)}，需达到 0.50。请调整轮廓或点位。`);updateDraft();segmented=r.passed&&localizationRequired();$('#overlay').checked=segmented;if(r.passed){document.dispatchEvent(new Event('segmentation-complete'));$('#import').classList.add('practice-win')}saveDraft();render()}catch(e){toast(e.message)}finally{practicePending=false;updatePractice()}}
const practiceComplete=completeLocalization;completeLocalization=function(outcome){practiceComplete(outcome);if(example)submitPractice()};
document.addEventListener('case-loading',()=>{releasePractice();practiceDrawing=[];practiceGesture=null});
document.addEventListener('case-configured',()=>{practiceDrawing=practiceData().drawing||[];practiceObject=0;updatePractice();if(window.practiceMode==='learning'&&localizationRequired()&&!localizationFinished())setTimeout(()=>startLocalization(),0);originalFocus(localizationFinished()?1:0,true);setTimeout(()=>status('病例已就绪 · '+practiceNames[window.practiceMode]+' · 请完成阅片练习'),0)});
$('#startExplore').addEventListener('click',()=>{if(!ct)showCases()});
window.addEventListener('resize',drawPractice);new ResizeObserver(drawPractice).observe(practiceView);

practiceView.addEventListener('contextmenu',e=>{
 if(!ct||measureMode||localizationFinished()||window.practiceMode==='learning')return;
 e.preventDefault();const p=practiceData(),r=practiceView.getBoundingClientRect();
 if(nativeZ()!==p.sliceIndex)return;
 const lists=window.practiceMode==='application'?p.polygons:p.groups.map(g=>g.points);
 for(let i=0;i<lists.length;i++)for(let j=0;j<lists[i].length;j++){
  const [x,y]=screenXY(lists[i][j]);if(Math.hypot(e.clientX-r.left-x,e.clientY-r.top-y)>10)continue;
  lists[i].splice(j,1);
  if(window.practiceMode==='application'&&lists[i].length<3)p.polygons.splice(i,1);
  if(window.practiceMode==='innovation'){delete p.groups[i].maskPng;practiceObject=i;schedulePractice()}
  practiceDirty();return;
 }
});

const practicePan=practiceView.onpointermove;practiceView.onpointermove=e=>{practicePan?.(e);drawPractice()};
