/* Localization uses the existing mask as a teaching reference, never model inference. */
let localizationActive=false,localizationGesture=null;
function localizationPoints(record){return record?.outcome==='hit'?Math.max(0,25-2.5*(record.attempts-1)):0}
function localizationIndex(e){
 const r=canvas.getBoundingClientRect(),[nx,ny,nz]=dims,scale=Math.min(r.width/nx,r.height/ny);
 if(!(scale>0))return null;
 let x=Math.floor((e.clientX-r.left-(r.width-nx*scale)/2)/scale),y=Math.floor((e.clientY-r.top-(r.height-ny*scale)/2)/scale);
 if(x<0||y<0||x>=nx||y>=ny)return null;
 if(displayGeometry.flipX)x=nx-1-x;if(displayGeometry.flipY)y=ny-1-y;
 const z=displayGeometry.reverseZ?nz-1-Number($('#slice').value):Number($('#slice').value);
 return z*nx*ny+y*nx+x;
}
$('.viewer-head').insertAdjacentHTML('afterend','<div class="localization-tools"><output id="localizationProgress" aria-live="polite">先载入病例，再来找结节吧</output><button id="localizationHint" class="quiet" hidden>✦ 提示</button><p id="localizationBubble" role="status" hidden>再观察一下，也可以点击提示查看结节标注。使用提示后定位计0分。</p></div>');
function updateLocalization(){
 const required=localizationRequired(),done=localizationFinished(),record=ct?getDraft().localization:null;
 $('#localizationProgress').textContent=!ct?'先载入病例，再来找结节吧':!required?'定位不适用 · 当前影像无有效分割标签':done?`定位完成 · ${record.outcome==='hint'?'已使用提示':`第 ${record.attempts} 次尝试命中`}`:`${localizationActive?'试着点一下CT中的结节吧！':'点击第02步，开始找结节吧'} · 已尝试 ${record.attempts} 次`;
 $('#localizationHint').hidden=$('#localizationBubble').hidden=!required||done||record.attempts<10;
 $('#overlay').disabled=!required||!done;$('#overlay').checked=required&&done&&segmented;
 $('#locate').disabled=!required||!done;
 $('#segment').disabled=$('#analyze').disabled=!required||done;
 $('#analyze').textContent=done&&required?'定位已完成 ✓':localizationActive?'请点击CT中的结节 →':'开始定位 →';
 $('#segment').classList.toggle('done',required&&done);
 $('#viewport').classList.toggle('localizing',localizationActive&&!done);
}
function startLocalization(){
 if(busy||!ct||!localizationRequired()||localizationFinished())return;
 if(measureMode)$('#measureToggle').click();
 localizationActive=true;localizationGesture=null;$('#slice').value=0;zoom=1;panX=panY=0;
 updateLocalization();render();status('从第1帧开始，滚动切片寻找结节，再试着点击它吧！');
 document.dispatchEvent(new Event('segmentation-started'));
}
function completeLocalization(outcome){
 const record=getDraft().localization;record.outcome=outcome;localizationActive=false;segmented=true;
 updateDraft();updateLocalization();render();status(outcome==='hint'?'提示标注已显示 · 一起观察结节，再来编写报告吧':'找到啦！结节标注已显示，接下来一起编写报告吧');
 document.dispatchEvent(new Event('segmentation-complete'));
}
function submitLocalizationPoint(e){
 if(busy||!ct||!localizationActive||measureMode||localizationFinished())return;
 const index=localizationIndex(e);if(index===null)return;
 getDraft().localization.attempts++;
 if(mask[index]){completeLocalization('hit');return}
 saveDraft();updateLocalization();toast('这次还没找到，再观察一下结节的位置吧！');
}
$('#localizationHint').onclick=()=>{if(busy||!localizationRequired()||localizationFinished()||getDraft().localization.attempts<10)return;$('#slice').value=targetDisplaySlice();completeLocalization('hint')};
const localizationView=$('#viewport');
localizationView.addEventListener('pointerdown',e=>{localizationGesture=null;if(localizationActive&&!busy&&!measureMode&&e.button===0&&e.isPrimary!==false&&localizationIndex(e)!==null)localizationGesture={x:e.clientX,y:e.clientY,id:e.pointerId,slice:$('#slice').value,moved:false}},{capture:true});
localizationView.addEventListener('pointermove',e=>{if(localizationGesture&&Math.hypot(e.clientX-localizationGesture.x,e.clientY-localizationGesture.y)>5)localizationGesture.moved=true},{capture:true});
localizationView.addEventListener('pointerup',e=>{const g=localizationGesture;localizationGesture=null;if(g&&g.id===e.pointerId&&!g.moved&&g.slice===$('#slice').value&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<=5)submitLocalizationPoint(e)},{capture:true});
for(const event of ['pointercancel','wheel'])localizationView.addEventListener(event,()=>localizationGesture=null,{capture:true});
document.addEventListener('case-loading',()=>{localizationActive=false;localizationGesture=null;$('#localizationHint').hidden=$('#localizationBubble').hidden=true});
document.addEventListener('case-configured',()=>{
 localizationActive=false;localizationGesture=null;segmented=localizationRequired()&&localizationFinished();
 updateLocalization();saveDraft();
 if(segmented||!localizationRequired()){guideStage='ready';focusGuideStep(2,true)}
});
