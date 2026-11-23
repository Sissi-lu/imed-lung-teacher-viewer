/* Patient names and IDs are fictional; only age and sex come from the matched report. */
function updateImageInfo(){
 const layer=$('#imageInfo'),f=measurementFrame();
 if(!ct||!f){layer.hidden=true;return}
 const left=Math.max(0,f.x),top=Math.max(0,f.y),right=Math.min(view.clientWidth,f.x+dims[0]*f.scale),bottom=Math.min(view.clientHeight,f.y+dims[1]*f.scale);
 layer.hidden=right<=left||bottom<=top;
 Object.assign(layer.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
 const reportMeta=example?meta:null,key=String(reportMeta?.caseId||'LOCAL');
 const seed=Array.from(key).reduce((n,c)=>n*31+c.charCodeAt(0),0)>>>0;
 const names=['林知远','陈清和','沈星宁','苏予安','许云舒','周景初'];
 $('#patientLabel').textContent='姓名：'+names[seed%names.length];
 $('#caseNo').textContent='SIM-'+String(100000+seed%900000);
 $('#patientDemographics').textContent=`年龄：${reportMeta?.patientAge||'未提供'} · 性别：${reportMeta?.patientSex||'未提供'}`;
 $('#exam').textContent='教学示例 · 姓名及ID为虚构';
 $('#scanInfo').textContent=`${dims[0]} × ${dims[1]} · ${dims[2]} 层`;
 $('#spacing').textContent='体素间距 '+(currentVoxelSpacing?.length>=3?currentVoxelSpacing.map(n=>Number.isFinite(n)&&n>0?n.toFixed(2):'—').join(' × ')+' mm':'未提供');
 $('.intro h1').textContent='肺部 CT 阅片训练';
}
const imageInfoRender=render;render=function(){imageInfoRender();updateImageInfo()};
const imageInfoPan=view.onpointermove;view.onpointermove=e=>{imageInfoPan?.(e);updateImageInfo()};
window.addEventListener('resize',updateImageInfo);
new ResizeObserver(updateImageInfo).observe(view);
document.addEventListener('fullscreenchange',()=>requestAnimationFrame(updateImageInfo));
document.addEventListener('case-loading',()=>$('#imageInfo').hidden=true);
updateImageInfo();
