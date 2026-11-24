const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../teaching.js'),'utf8');
const storage=new Map();
const context=vm.createContext({example:true,meta:{caseId:'30',sections:[{rows:[
 ['肺叶肺段','□右下叶 ☑左下叶\n肺段名称：__背段__'],
 ['密度类型','□实性 ☑纯磨玻璃 □部分实性'],
 ['结节径线','长径__11__ mm × 垂直短径__7__ mm；另测上下径__14__ mm'],
 ['分类输出','□4A ☑4B □4C □5'],
 ['边界及征象','边界：☑清楚 □模糊；分叶：☑无 □有；毛刺：☑无 □有'],
 ['结节数量','□单发 □多发：☑散在']
 ]}]},localizationRequired:()=>false,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},console});
vm.runInContext(source.slice(0,source.indexOf('// Navigation is kept')),context);
const run=code=>vm.runInContext(code,context);
assert.equal(run('referenceAnswers().lobe'),'左下叶');
assert.equal(run('referenceAnswers().density'),'纯磨玻璃');
assert.equal(run('referenceAnswers().risk'),'4B');
assert.equal(run('referenceAnswers().long'),'11');
assert.equal(run('referenceAnswers().count'),undefined,'unselected count is not a negative finding');
assert.equal(run('composeFindings({lobe:"左下叶"})'),'目标结节位于左下叶。','missing fields must not become normal findings');
assert.match(run('composeFindings({long:"11",short:"7",height:"14"})'),/11×7×14/);
run('getDraft().answers.long="11";saveDraft();meta.caseId="6"');
assert.equal(run('getDraft().answers.long'),undefined,'case drafts must not bleed into other cases');
run('meta.caseId="30"');
assert.equal(run('getDraft().answers.long'),'11');
assert.equal(run('evaluateDraft({answers:{long:"11.4"}},{long:"11"}).matched'),1);
assert.equal(run('evaluateDraft({answers:{long:"12"}},{long:"11"}).matched'),0);
assert.equal(run('evaluateDraft({answers:{}},{long:"0"}).matched'),0,'empty answer must not match a numeric zero');
assert.equal(run('evaluateDraft({answers:{}},{}).completionOnly'),true);
assert.equal(run('evaluateDraft({answers:{}},{}).score'),0);
console.log('PASS: reference extraction, missing GT, sentence generation, case isolation, grading tolerance');

const full=()=>run('Object.fromEntries(teachingFields.map(f=>[f.id,"x"]))');
context.d={answers:{...full(),long:'14',short:'7'}};
context.e={comparisons:[{id:'long',label:'长径',answer:'14',reference:'11',correct:false}],localizationScore:null};
assert.match(run('reviewFeedback(d,e).fields.find(f=>f.id==="long").text'),/偏大 3 mm/);
context.d.answers.long='7';context.d.answers.short='11';
context.e.comparisons=[{label:'长径',answer:'7',reference:'11',correct:false},{label:'短径',answer:'11',reference:'7',correct:false}];
assert.match(run('reviewFeedback(d,e).fields[0].text'),/可能把长短径填反/,'old comparisons without IDs remain supported');
context.e.comparisons=[{id:'long',label:'长径',answer:'7',reference:'11',correct:true}];
assert.equal(run('reviewFeedback(d,e).fields.length'),0,'existing correctness/tolerance is authoritative');
context.d.answers.long='';
assert.match(run('reviewFeedback(d,e).fields[0].text'),/暂未记录/);
assert.equal(run('practiceAdvice({mode:"application",precision:.8,recall:.8,dice:.8})[0].kind'),'positive');
assert.match(run('practiceAdvice({mode:"application",precision:1,recall:.7,dice:.82})[0].text'),/补全遗漏/);
assert.match(run('practiceAdvice({mode:"innovation",precision:.7,recall:1,dice:.82})[0].text'),/背景点/);
assert.equal(run('practiceAdvice({mode:"innovation",precision:.5,recall:.5,dice:.5}).length'),2);
assert.match(run('practiceAdvice({mode:"application",dice:.7})[0].text'),/暂不能判断/);
assert.match(run('practiceAdvice({mode:"application",dice:0,precision:null,recall:null,message:"该帧没有参考病灶，请重新选择切片后标注。"})[0].text'),/重新选择/);
assert.equal(run('practiceAdvice({applicable:false,mode:"innovation",dice:0})[0].kind'),'info');
assert.match(run('practiceAdvice({outcome:"hit",attempts:4})[0].text'),/第 4 次/);
assert.match(run('practiceAdvice({outcome:"hint"})[0].text'),/提示/);
context.d={answers:{},localization:{mode:'application',dice:.6,precision:.5,recall:.7}};
context.e={comparisons:[],localizationScore:15,completionOnly:true};
assert.equal(run('reviewFeedback(d,e).summary.length'),3);
assert.match(run('reviewFeedback(d,e).summary[2]'),/覆盖率/,'segmentation gets a reserved summary slot');
context.d={answers:full()};context.e={comparisons:[],localizationScore:null,completionOnly:true};
assert.match(run('reviewFeedback(d,e).summary[0]'),/缺少可比较/);
assert.equal(run('reviewFeedback(d,e).fields.length'),0,'unreferenced filled fields must not be judged incorrect');
console.log('PASS: report coaching, swapped sizes, missing references, practice coaching, target boundary and summary priority');
