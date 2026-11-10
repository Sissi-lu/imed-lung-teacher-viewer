/* Teaching UI. Reference reports remain hidden until the learner submits. */
const teachingFields=[
 {id:'count',title:'肺内结节有多少？',label:'数目',kind:'radio',options:['单发','多发','无法判断']},
 {id:'lobe',title:'目标结节在哪个肺叶？',label:'肺叶',options:['右上叶','右中叶','右下叶','左上叶','左下叶']},
 {id:'segment',title:'还可以描述它的肺段吗？',label:'肺段',kind:'text'},
 {id:'long',title:'目标结节的长径是多少？',label:'长径',kind:'number',unit:'mm'},
 {id:'short',title:'垂直短径是多少？',label:'短径',kind:'number',unit:'mm'},
 {id:'height',title:'上下径是多少？',label:'上下径',kind:'number',unit:'mm'},
 {id:'density',title:'它呈现哪一种密度？',label:'密度',kind:'radio',options:['实性','纯磨玻璃','部分实性','无法判断']},
 {id:'shape',title:'整体形状更像哪一种？',label:'形态',options:['圆形','类圆形','不规则形']},
 {id:'boundary',title:'结节与周围的边界清楚吗？',label:'边界',kind:'radio',options:['清楚','模糊','无法判断']},
 {id:'lobulation',title:'你观察到分叶了吗？',label:'分叶',kind:'radio',options:['无','有','无法判断']},
 {id:'spiculation',title:'你观察到毛刺了吗？',label:'毛刺',kind:'radio',options:['无','有','无法判断']},
 {id:'signs',title:'周围结构有哪些表现？',label:'邻近征象',kind:'multi',options:['贴邻胸膜','胸膜牵拉','血管集束','空气支气管征']},
 {id:'enhance',title:'增强情况能评估吗？',label:'强化',options:['未行增强','无法可靠评估','无明确强化','轻度强化','中度强化','明显强化']},
 {id:'comparison',title:'有既往检查可供比较吗？',label:'既往对比',options:['无既往片可供比较','稳定','增大','缩小','无法判断']},
 {id:'risk',title:'你选择哪个分类？',label:'Lu-RADS',options:['0','1','2','3','4A','4B','4C','5','资料不足待评估']}
];
const doctorArt=`<svg viewBox="0 0 130 150" aria-hidden="true"><ellipse cx="65" cy="143" rx="45" ry="6" fill="#5f807629"/><path d="M28 141V114Q30 94 65 94Q100 94 102 114V141" fill="#fffaf0" stroke="#aac6be" stroke-width="3"/><path d="M58 97L65 113L74 97" fill="#80c9bb"/><path d="M47 105V125Q65 143 84 125V105" fill="none" stroke="#477979" stroke-width="3"/><circle cx="84" cy="127" r="6" fill="#80c9bb"/><rect x="58" y="79" width="16" height="24" rx="7" fill="#f8d8ba"/><ellipse cx="65" cy="55" rx="37" ry="39" fill="#f8d8ba"/><path d="M27 55Q18 7 66 9Q108 7 103 56L90 38Q51 48 45 31Z" fill="#55494e"/><path d="M31 25Q33 1 65 1Q97 1 100 25Z" fill="#fffaf0" stroke="#aac6be" stroke-width="2"/><path d="M65 8V20M59 14H71" stroke="#80bca4" stroke-width="5" stroke-linecap="round"/><g fill="#394c50"><ellipse cx="50" cy="60" rx="3" ry="4"/><ellipse cx="80" cy="60" rx="3" ry="4"/></g><path d="M57 76Q65 83 74 76" fill="none" stroke="#b87872" stroke-width="3" stroke-linecap="round"/><g fill="none" stroke="#527a78" stroke-width="2"><circle cx="49" cy="60" r="12"/><circle cx="81" cy="60" r="12"/><path d="M61 60H69"/></g><circle cx="40" cy="74" r="6" fill="#f1ad9d" opacity=".6"/><circle cx="90" cy="74" r="6" fill="#f1ad9d" opacity=".6"/><path d="M85 18L98 28" stroke="#f2ca83" stroke-width="5" stroke-linecap="round"/></svg>`;
const teachingDrafts=new Map();let teachingTab='structured',teachingQuestion=0,teachingBoard=false;
function draftKey(){return example&&meta?'case:'+meta.caseId:'local:'+$('#scanInfo').textContent}
function getDraft(){const key=draftKey();if(!teachingDrafts.has(key)){
 let saved;try{saved=JSON.parse(sessionStorage.getItem('lung-teaching:'+key)||'null')}catch{}
 teachingDrafts.set(key,saved?.version===1?saved:{version:1,answers:{},findings:'',diagnosis:'',confirmed:false,submitted:false});
 }const d=teachingDrafts.get(key);
 if(!d.localization){d.localization={attempts:0,outcome:'pending'};d.submitted=false;delete d.evaluation}
 return d}
function saveDraft(){try{sessionStorage.setItem('lung-teaching:'+draftKey(),JSON.stringify(getDraft()))}catch{}}
function updateDraft(){const d=getDraft();d.submitted=false;teachingBoard=false;$('#evaluate').classList.remove('done');$('#export').classList.remove('done');saveDraft()}
function composeFindings(a){const parts=[];if(a.count)parts.push('肺内见'+a.count+'结节');if(a.lobe||a.segment)parts.push('目标结节位于'+(a.lobe||'')+(a.segment||''));const size=[a.long,a.short,a.height].filter(v=>v!==undefined&&v!=='');if(size.length)parts.push('所填径线约'+size.join('×')+' mm');if(a.density&&a.density!=='无法判断')parts.push('呈'+a.density+'密度');if(a.shape)parts.push('形态'+a.shape);if(a.boundary)parts.push('边界'+a.boundary);if(a.lobulation&&a.lobulation!=='无法判断')parts.push(a.lobulation==='有'?'可见分叶':'未见分叶');if(a.spiculation&&a.spiculation!=='无法判断')parts.push(a.spiculation==='有'?'可见毛刺':'未见毛刺');if(a.signs?.length)parts.push('邻近征象：'+a.signs.join('、'));if(a.enhance)parts.push('增强评估：'+a.enhance);if(a.comparison)parts.push('既往对比：'+a.comparison);return parts.length?parts.join('；')+'。':''}
function referenceAnswers(){if(!example||!meta?.sections?.length)return{};
 const rows=meta.sections.flatMap(s=>s.rows);const text=label=>rows.filter(r=>r[0].includes(label)).map(r=>r[1]).join('\n');
 const checked=(t,options)=>{const matches=options.filter(v=>new RegExp('☑\\s*'+v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|□|☑|[；;：:（(]|$)').test(t));return matches.length===1?matches[0]:undefined};
 const ref={};const specs={count:['结节数量',teachingFields[0].options],lobe:['肺叶肺段',teachingFields[1].options],density:['密度类型',teachingFields[6].options],shape:['整体形状',teachingFields[7].options],risk:['分类输出',teachingFields[14].options]};
 for(const [key,[label,opts]]of Object.entries(specs)){const v=checked(text(label),opts);if(v)ref[key]=v}
 const edges=text('边界');for(const [k,label,opts]of [['boundary','边界',['清楚','模糊']],['lobulation','分叶',['无','有']],['spiculation','毛刺',['无','有']]]){const t=edges.match(new RegExp(label+'[：:]([^；;\\n]+)'));if(t){const v=checked(t[1],opts);if(v)ref[k]=v}}
 const sizes=text('结节径线');for(const [key,re]of [['long',/长径[_\s]*([\d.]+)/],['short',/短径[_\s]*([\d.]+)/],['height',/上下径[_\s]*([\d.]+)/]]){const m=sizes.match(re);if(m)ref[key]=m[1]}
 return ref;
}
function evaluateDraft(d,ref=referenceAnswers()){
 const complete=teachingFields.filter(f=>Array.isArray(d.answers[f.id])?d.answers[f.id].length:d.answers[f.id]!==undefined&&d.answers[f.id]!=='').length;
 const comparisons=teachingFields.filter(f=>ref[f.id]!==undefined).map(f=>({label:f.label,answer:d.answers[f.id]??'未填写',reference:ref[f.id],correct:f.kind==='number'?d.answers[f.id]!==''&&d.answers[f.id]!==undefined&&Math.abs(Number(d.answers[f.id])-Number(ref[f.id]))<=.5:String(d.answers[f.id]??'')===String(ref[f.id])}));
 const matched=comparisons.filter(c=>c.correct).length,applicable=localizationRequired();
 const reportMax=applicable?75:100,reportRaw=comparisons.length?reportMax/2*(complete/teachingFields.length+matched/comparisons.length):reportMax*complete/teachingFields.length;
 const localizationScore=applicable?localizationPoints(d.localization):null;
 return {complete,comparisons,matched,score:Math.round((reportRaw+(localizationScore||0))*10)/10,reportScore:Math.round(reportRaw*10)/10,reportMax,localizationScore,completionOnly:!comparisons.length};
}
function doctorSays(text){return `<div class="doctor-chat"><div class="doctor-portrait">${doctorArt}<span>林医生</span></div><div class="doctor-speech"><small>影像课堂 · 一起观察吧</small><p>${escape(text)}</p></div></div>`}
function teachingShell(){ $('.report-summary').hidden=true;$('.report-footer').hidden=true;$('.tabs').hidden=!reportUnlocked||teachingBoard;$('#reportPanel .panel-heading span').textContent=teachingBoard?'黑板复盘课堂':'医生问答课堂';$('#source').textContent='教学答题 · 参考答案在提交后开放';document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.tab===teachingTab);b.setAttribute('aria-selected',String(b.dataset.tab===teachingTab))}) }
report=function(){if(ct&&!localizationFinished())reportUnlocked=false;teachingShell();if(!reportUnlocked||!ct){$('#reportContent').innerHTML='<div class="report-locked">'+doctorArt+'<h3>今天，你来当小医生！</h3><p>先选择病例、完成结节定位，再点击第03步<br>开启问答课堂。参考答案会在提交后开放。</p></div>';return}if(teachingBoard){showReview();return}
 const d=getDraft();const root=$('#reportContent');root.classList.add('teaching-content');
 if(teachingTab==='structured'){
  const f=teachingFields[teachingQuestion],value=d.answers[f.id];let input='';
  if(['radio','multi'].includes(f.kind))input='<div class="answer-options">'+f.options.map((v,i)=>`<label class="answer-option"><input type="${f.kind==='multi'?'checkbox':'radio'}" name="answer" value="${escape(v)}" ${f.kind==='multi'?(value||[]).includes(v)?'checked':'':value===v?'checked':''}><span>${escape(v)}</span></label>`).join('')+'</div>';
  else if(f.options)input=`<select id="vqaAnswer" aria-label="${f.label}"><option value="">请选择你的观察</option>${f.options.map(v=>`<option ${value===v?'selected':''}>${escape(v)}</option>`).join('')}</select>`;
  else input=`<label class="numeric-answer"><input id="vqaAnswer" aria-label="${f.label}" type="${f.kind==='number'?'number':'text'}" ${f.kind==='number'?'min="0" max="500" step="0.1"':''} value="${escape(value??'')}" placeholder="${f.kind==='number'?'填写数值':'例如：背段'}">${f.unit||''}</label>`;
  root.innerHTML=doctorSays(f.title)+`<div class="lesson-progress"><span>问答 ${teachingQuestion+1} / ${teachingFields.length}</span><span>已填写 ${evaluateDraft(d,{}).complete} 项</span></div><progress value="${teachingQuestion+1}" max="${teachingFields.length}"></progress><div class="question-card"><span class="question-sticker">✦ 观察笔记</span><h3>${escape(f.label)}</h3>${input}</div><div class="question-navigation"><button id="questionPrev" ${!teachingQuestion?'disabled':''}>← 上一题</button><button id="questionNext" ${teachingQuestion===teachingFields.length-1?'disabled':''}>下一题 →</button></div><div class="question-dots">${teachingFields.map((x,i)=>`<button data-question="${i}" class="${i===teachingQuestion?'current':''}" aria-label="第${i+1}题 ${x.label}">${i+1}</button>`).join('')}</div><p class="teaching-note">按医生模板填写；不知道可留空。这里只保存你的答案，不展示GT。</p><button id="confirmVqa" class="lesson-primary">确认填写，生成影像所见 ✨</button>`;
  const answerChange=()=>{if(f.kind==='multi')d.answers[f.id]=Array.from(root.querySelectorAll('input:checked'),el=>el.value);else{const el=root.querySelector('#vqaAnswer')||root.querySelector('input:checked');if(el?.type==='number'&&!el.checkValidity()){el.reportValidity();return}d.answers[f.id]=el?.value??''}d.confirmed=false;updateDraft()};root.querySelectorAll('input,select').forEach(el=>{el.onchange=answerChange;if(el.type==='number'||el.type==='text')el.oninput=answerChange});
  $('#questionPrev').onclick=()=>{teachingQuestion--;report()};$('#questionNext').onclick=()=>{teachingQuestion++;report()};root.querySelectorAll('[data-question]').forEach(el=>el.onclick=()=>{teachingQuestion=+el.dataset.question;report()});
  $('#confirmVqa').onclick=()=>{const text=composeFindings(d.answers);if(!text){toast('先填写至少一项观察，再生成文字吧');return}if(d.findings&&d.findings!==text&&!confirm('重新生成会覆盖当前影像所见，是否继续？'))return;d.findings=text;d.confirmed=true;updateDraft();teachingTab='findings';report();chime()};
 }else if(teachingTab==='findings'){
  root.innerHTML=doctorSays('把刚才的观察整理成报告吧！你可以继续修改这张报告纸。')+`<div class="report-paper"><span>☁ 影像所见 · 我的草稿</span><label class="sr-label" for="findingEditor">编辑影像所见</label><textarea id="findingEditor" placeholder="先在结构化问答中填写并生成，也可以在这里手动编写。">${escape(d.findings)}</textarea></div><p class="teaching-note">根据你填写的字段组句，未填写的内容不会自动补成正常结论。</p><button id="goDiagnosis" class="lesson-primary">写好了，继续诊断意见 →</button>`;
  $('#findingEditor').oninput=e=>{d.findings=e.target.value;updateDraft()};$('#goDiagnosis').onclick=()=>{teachingTab='diagnosis';report()};
 }else{
  const snippets=['建议结合既往影像进行对比。','建议结合临床情况进一步评估。','建议定期影像随访。','建议相关专科会诊。','病灶性质待进一步明确。'];
  root.innerHTML=doctorSays('选择句子小卡片，把它放到光标的位置，再用自己的话补充。')+`<div class="report-paper"><span>✎ 诊断意见 · 我的草稿</span><label class="sr-label" for="diagnosisEditor">编辑诊断意见</label><textarea id="diagnosisEditor" placeholder="在这里组织你的诊断意见…">${escape(d.diagnosis)}</textarea></div><div class="snippet-heading">句子小卡片 <small>教学演示句式，待医生审核</small></div><div class="snippet-cards">${snippets.map((s,i)=>`<button data-snippet="${i}">＋ ${s}</button>`).join('')}</div><button id="undoSnippet" class="lesson-quiet" disabled>撤销刚才的插入</button><p class="teaching-note">提交后开放GT对比。分数为演示规则评分，不代表临床诊断能力。</p><button id="submitLesson" class="lesson-primary">提交报告，去黑板复盘 ★</button>`;
  const editor=$('#diagnosisEditor');let undo;
  editor.oninput=()=>{d.diagnosis=editor.value;updateDraft()};root.querySelectorAll('[data-snippet]').forEach(b=>b.onclick=()=>{const start=editor.selectionStart,end=editor.selectionEnd,text=snippets[+b.dataset.snippet];undo={start,text,previous:editor.value.slice(start,end)};editor.setRangeText(text,start,end,'end');editor.focus();editor.oninput();$('#undoSnippet').disabled=false});
  $('#undoSnippet').onclick=()=>{if(!undo)return;if(editor.value.slice(undo.start,undo.start+undo.text.length)!==undo.text){toast('这段文字已修改，请使用编辑器继续调整');return}editor.setRangeText(undo.previous,undo.start,undo.start+undo.text.length,'end');editor.oninput();undo=null;$('#undoSnippet').disabled=true};$('#submitLesson').onclick=submitLesson;
 }
 root.scrollTop=0;
};
function submitLesson(){if(busy||!ct||!requireLocalization())return;const d=getDraft();if(!d.findings.trim()||!d.diagnosis.trim()){toast('请先完成影像所见和诊断意见，再提交复盘');return}d.submitted=true;d.evaluation=evaluateDraft(d);d.submittedAt=new Date().toISOString();saveDraft();teachingBoard=true;$('#evaluate').classList.add('done');$('#report').classList.add('done');report();guideStage='ready';focusGuideStep(4,true,'复盘黑板已打开！看看哪些观察一致、哪些值得再看一遍。完成后可导出你的作业。');chime()}
function showReview(){const d=getDraft();if(!d.submitted){teachingBoard=false;report();return}const e=d.evaluation;
 $('#reportContent').innerHTML=`<div class="blackboard"><div class="board-title">✦ 林医生的复盘课堂 ✦</div><div class="chalk-score">${e.score}<small>/ 100</small></div><p>${e.localizationScore===null?'定位不适用，本次仅评价报告。':`结节定位 ${e.localizationScore} / 25 分 · 报告 ${e.reportScore} / 75 分。${d.localization.outcome==='hint'?'使用提示完成定位。':`第 ${d.localization.attempts} 次尝试命中。`}`} ${e.completionOnly?'本病例无可自动提取的Word参考字段，报告仅按填写完整度评分。':`报告完整度${e.reportMax/2}分＋参考字段一致性${e.reportMax/2}分。数值允许±0.5 mm。`}</p><div class="board-stats">已填 ${e.complete}/${teachingFields.length} 项 · 参考一致 ${e.matched}/${e.comparisons.length} 项</div><h3>一起来复盘</h3>${e.comparisons.length?e.comparisons.map(c=>`<div class="review-row ${c.correct?'right':'wrong'}"><b>${c.correct?'✓ 一致':'↻ 再观察'} · ${escape(c.label)}</b><span>你的答案：${escape(c.answer)}</span><span>Word参考：${escape(c.reference)}</span></div>`).join(''):'<p>参考字段缺失不判错。请结合下方原报告人工复盘。</p>'}<h3>老师的反馈</h3><p>你完成了${e.complete}项观察。${e.comparisons.length?`其中${e.matched}项与可提取的Word字段一致，${e.comparisons.length-e.matched}项需要复核。`:''}未比较的字段、自由文本和句式建议暂不评判对错。请特别检查报告与影像是否对应。</p></div><details class="gt-reference"><summary>打开GT参考档案（提交后可见）</summary><h3>Word结构化参考 · ${escape(meta?.structuredSource||'病例Word')}</h3>${example&&meta?.sections?.length?meta.sections.map(s=>`<h4>${escape(s.title)}</h4>${s.rows.map(r=>`<p>${escape(r.join('：'))}</p>`).join('')}`).join(''):'<p>无匹配Word报告。</p>'}<h3>Excel影像所见</h3><p>${escape(example?meta?.findings||'无参考':'无关联参考')}</p><h3>Excel诊断意见</h3><p>${escape(example?meta?.diagnosis||'无参考':'无关联参考')}</p><p>来源：${escape(example?meta?.source||'未匹配':'本地导入')}。不同来源可能存在差异，此处保留原文。</p></details><button id="reviseLesson" class="lesson-primary">回到作业，再观察一次 ↺</button>`;
 $('#reportContent').scrollTop=0;
 $('#reviseLesson').onclick=()=>{teachingBoard=false;teachingTab='structured';report();guideStage='ready';focusGuideStep(2,true,'回到第03步修改作业。修改后请重新提交，系统会重新计算分数。')};
}
// Navigation is kept in the existing mission guide, with five actual steps.
$('#export').insertAdjacentHTML('beforebegin','<button class="step" id="evaluate"><b>04</b><span>评估与复盘<small>查看得分与复盘</small></span><em>↗</em></button>');
$('#export b').textContent='05';$('#report span').childNodes[0].textContent='报告填写';$('#report small').textContent='完成结构化问答';
hints.splice(2,2,['#report','第三步 · 报告填写：跟着林医生回答问题，再完成影像所见和诊断意见。'],['#evaluate','第四步 · 评估与复盘：在诊断意见中提交整份报告，然后到黑板复盘。'],['#export','第五步 · 导出训练结果：保存你的填写、报告与评价结果。']);
$('#evaluate').onclick=()=>{if(!ct||busy){toast('请先选择病例并等待影像加载完成');return}if(!requireLocalization())return;reportUnlocked=true;const d=getDraft();if(d.submitted){teachingBoard=true;report()}else{teachingBoard=false;teachingTab='diagnosis';report();toast('请在这里完成报告，点击底部「提交报告」进入评价')}guideStage='ready';focusGuideStep(3,true)};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(!reportUnlocked)return;teachingTab=b.dataset.tab;teachingBoard=false;report()});
document.addEventListener('case-reset',()=>{teachingQuestion=0;teachingTab='structured';teachingBoard=false;$('#evaluate').classList.remove('done');report()});
document.addEventListener('report-opened',()=>{guideStage='ready';focusGuideStep(2,true)});
$('#export').onclick=()=>{if(!ct||!getDraft().submitted){toast('请先提交报告，完成第04步评价');return}const data={caseId:example?meta.caseId:null,examId:example?meta.examId:null,student:getDraft(),grading:'教学规则评分，非临床评价'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='肺部探索_作业_'+(example?meta.caseId:'本地')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#export').classList.add('done');document.dispatchEvent(new Event('report-exported'));$('#botMessage').textContent='五步探索完成！你的作业和复盘结果已导出。'};
// Cosmetic preferences do not change CT pixel rendering.
document.querySelector('header').insertAdjacentHTML('beforeend','<label class="skin-picker">🎨 <select id="skinPicker" aria-label="界面皮肤"><option value="mint">薄荷实验室</option><option value="peach">奶油桃子</option><option value="night">星空探索</option></select></label>');
function setSkin(value){document.body.dataset.skin=['mint','peach','night','sunshine','lavender','ocean','forest','sakura'].includes(value)?value:'mint';$('#skinPicker').value=document.body.dataset.skin;if(document.querySelector('#launchSkin'))$('#launchSkin').value=document.body.dataset.skin;try{localStorage.setItem('lung-skin',document.body.dataset.skin)}catch{}}
let initialSkin='mint';try{initialSkin=localStorage.getItem('lung-skin')||'mint'}catch{}setSkin(initialSkin);$('#skinPicker').onchange=e=>setSkin(e.target.value);
$('.mission .panel-heading').insertAdjacentHTML('beforeend','<button id="collapseMission" aria-label="收起流程" aria-expanded="true">◀</button>');
$('#collapseMission').onclick=()=>{const collapsed=document.body.classList.toggle('mission-collapsed');$('#collapseMission').textContent=collapsed?'▶':'◀';$('#collapseMission').setAttribute('aria-expanded',String(!collapsed));$('#collapseMission').setAttribute('aria-label',collapsed?'展开流程':'收起流程')};
document.querySelectorAll('.step').forEach(b=>{b.title=b.innerText.replace(/\s+/g,' ');b.setAttribute('aria-label',b.title)});
report();

document.querySelector('#startExplore').addEventListener('click',()=>{if(ct){guideStage='ready';focusGuideStep(reportUnlocked?(getDraft().submitted?4:2):segmented?2:1,true)}});

document.querySelector('.launch-nav').insertAdjacentHTML('beforeend','<label class="skin-picker">🎨 <select id="launchSkin" aria-label="启动页皮肤"><option value="mint">薄荷实验室</option><option value="peach">奶油桃子</option><option value="night">星空探索</option></select></label>');$('#launchSkin').value=document.body.dataset.skin;$('#launchSkin').onchange=e=>setSkin(e.target.value);

$('#report').onclick=()=>{if(busy||!ct){toast('请先等待CT影像加载完成');return}if(!requireLocalization())return;reportUnlocked=true;teachingBoard=false;report();$('#reportPanel').scrollIntoView({behavior:'smooth',block:'nearest'});$('#report').classList.add('done');document.dispatchEvent(new Event('report-opened'))};
