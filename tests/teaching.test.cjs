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
 ]}]},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},console});
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
