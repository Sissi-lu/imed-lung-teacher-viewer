const assert=require('node:assert/strict');const {chromium}=require('playwright');const zlib=require('zlib');const fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1600,height:1100}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
const dims=[32,32,2],ct=Buffer.alloc(4096),mask=Buffer.alloc(2048);for(let y=10;y<=20;y++)for(let x=10;x<=20;x++)mask[y*32+x]=mask[1024+y*32+x]=1;
await page.route('**/api/cases',r=>r.fulfill({json:{cases:[{id:'30',examId:'TEST',hasMask:true,hasReport:true}]}}));
await page.route('**/api/cases/30/*',r=>{let kind=r.request().url().split('/').pop();if(kind==='meta')return r.fulfill({json:{caseId:'30',examId:'TEST',dims,spacing:[1,1,1],target:0,maskVoxels:121,hasMask:true,sections:[{title:'径线',rows:[['结节径线','长径__11__ mm × 垂直短径__7__ mm；另测上下径__14__ mm']]}],displayGeometry:{flipX:false,flipY:false,reverseZ:false,verified:true}}});return r.fulfill({body:zlib.gzipSync(kind==='ct'?ct:mask),contentType:'application/octet-stream'})});
await page.route('**/api/practice/submissions',r=>r.fulfill({json:{submissionId:'test',passed:true,dice:.75,score:18.75,applicable:true,precision:.6,recall:1}}));
await require('./account_fixture.cjs')(page);
await page.goto(process.env.PRACTICE_BASE_URL||'http://127.0.0.1:8765/');
assert.equal(await page.locator('.launch-actions button').count(),1);assert.equal(await page.locator('.launch-actions button').getAttribute('id'),'startExplore');assert.equal(await page.locator('#selectCaseLaunch, #startImport').count(),0);
await page.click('#startExplore');await page.waitForSelector('#caseDialog[open]');await page.click('#closeCases');assert.equal(await page.locator('.app').isVisible(),true);assert.match(await page.locator('#import').textContent(),/阅片练习/);await page.click('#import');await page.waitForSelector('#caseDialog[open]');assert.equal(await page.locator('[data-level]').count(),3);console.log('single homepage entry and first practice step passed');await page.click('[data-level="application"]');await page.click('.case-option');await page.waitForFunction(()=>!!document.querySelector('#practiceBadge').textContent);
await page.click('#practiceNew');assert.match(await page.locator('#practiceStatus').textContent(),/正在绘制第 1 个病灶/);assert.equal(await page.evaluate(()=>practiceData().sliceIndex),0);const rect=await page.locator('#ct').boundingBox();const xy=(x,y)=>[rect.x+(x+.5)*rect.width/32,rect.y+(y+.5)*rect.height/32];for(const p of [[10,10],[20,10],[20,20],[10,20]])await page.mouse.click(...xy(...p));await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>practiceData().polygons.length),1);
await page.click('#measureToggle');await page.click('#practiceNew');assert.match(await page.locator('#practiceStatus').textContent(),/正在绘制第 2 个病灶/);assert.equal(await page.evaluate(()=>measureMode),false);assert.equal(await page.evaluate(()=>practiceData().polygons.length),1);
for(const point of [[23,13],[27,13],[27,17],[23,17]]){const at=await page.evaluate(([x,y])=>{const f=measurementFrame();return[f.v.left+f.x+(x+.5)*f.scale,f.v.top+f.y+(y+.5)*f.scale]},point);await page.mouse.click(...at)}
await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>practiceData().polygons.length),2);await page.click('#analyze');await page.waitForFunction(()=>document.querySelector('#analyze').textContent.includes('完成'));await page.click('#report');await page.waitForSelector('#vqaAnswer, .answer-options');if(process.env.PRACTICE_SCREENSHOT)await page.screenshot({path:process.env.PRACTICE_SCREENSHOT,fullPage:true});
async function assertNoGtPixels(){assert.equal(await page.evaluate(()=>{const [r,g,b]=ctx.getImageData(15,15,1,1).data;return r===g&&g===b}),true,'CT canvas must not contain GT overlay in application/innovation')}
async function assertOwnMasksOnly(){
 await assertNoGtPixels();assert.equal(await page.locator('#practiceOverlay image').count(),1);
 await page.locator('#slice').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input'))});await assertNoGtPixels();assert.equal(await page.locator('#practiceOverlay image').count(),0);assert.match(await page.locator('#overlayStatus').textContent(),/无我的标注/);
 await page.click('#locate');assert.equal(await page.locator('#slice').inputValue(),'0');assert.equal(await page.locator('#practiceOverlay image').count(),1);
 await page.locator('#overlay').uncheck();assert.equal(await page.locator('#practiceOverlay image').count(),0);await assertNoGtPixels();await page.locator('#overlay').check();assert.equal(await page.locator('#practiceOverlay image').count(),1);
 await page.evaluate(()=>{displayGeometry.reverseZ=true;render()});await assertNoGtPixels();assert.equal(await page.locator('#practiceOverlay image').count(),0);await page.click('#locate');assert.equal(await page.locator('#slice').inputValue(),'1');assert.equal(await page.locator('#practiceOverlay image').count(),1);
 await page.evaluate(()=>{displayGeometry.reverseZ=false;document.querySelector('#slice').value=0;render()});console.log('own masks only on annotated slice passed');
}
await assertNoGtPixels();
assert.match(await page.locator('#practiceFeedback').textContent(),/收紧多画/);
await page.evaluate(()=>{const d=getDraft();d.answers={long:'7',short:'11'};d.findings='教学测试影像所见';d.diagnosis='教学测试诊断意见';submitLesson()});
assert.match(await page.locator('.blackboard').textContent(),/可能把长短径填反/);
assert.equal(await page.locator('.blackboard > .feedback-list').first().locator('li').count(),3);
assert.equal(await page.evaluate(()=>getDraft().evaluation.localizationScore),18.75);
assert.equal(await page.evaluate(()=>getDraft().evaluation.feedback.summary.length),3);
for(const skin of ['mint','peach','sunshine','lavender','ocean','forest','sakura','night']){await page.selectOption('#skinPicker',skin);assert.match(await page.locator('.blackboard').textContent(),/可能把长短径填反/)}
await page.selectOption('#skinPicker','mint');
if(process.env.FEEDBACK_REVIEW_SCREENSHOT)await page.screenshot({path:process.env.FEEDBACK_REVIEW_SCREENSHOT,fullPage:true});
const downloadEvent=page.waitForEvent('download');await page.click('#export');const download=await downloadEvent;
const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
assert.match(exported.student.evaluation.feedback.summary.join(' '),/长短径填反/);
await page.evaluate(()=>{delete getDraft().evaluation.feedback;showReview()});
assert.match(await page.locator('.blackboard').textContent(),/长短径填反/);
assert.equal(await page.evaluate(()=>getDraft().evaluation.feedback),undefined,'historical feedback fallback never rewrites saved evaluation');
await page.click('#reviseLesson');await page.evaluate(()=>{getDraft().answers.long='11';updateDraft()});
assert.equal(await page.evaluate(()=>getDraft().evaluation),undefined,'editing invalidates suggestions');
await page.click('#practiceEdit');
await page.route('**/api/practice/submissions',r=>r.fulfill({json:{submissionId:'retry',passed:false,dice:.4,score:10,applicable:true,precision:.4,recall:.4}}));
await page.click('#analyze');await page.waitForFunction(()=>!practicePending);
assert.match(await page.locator('#practiceFeedback').textContent(),/尚未覆盖/);
assert.match(await page.locator('#practiceFeedback').textContent(),/超出参考/);
await page.click('#report');assert.equal(await page.evaluate(()=>reportUnlocked),false);
await page.route('**/api/practice/submissions',r=>r.fulfill({json:{submissionId:'pass',passed:true,dice:.75,score:18.75,applicable:true,precision:.6,recall:1}}));
await page.click('#analyze');await page.waitForFunction(()=>localizationFinished());
if(process.env.FEEDBACK_SCREENSHOT)await page.screenshot({path:process.env.FEEDBACK_SCREENSHOT,fullPage:true});
console.log('feedback: coaching, grading invariants, export, historical fallback and failed submission passed');
async function restartAndCheck(){
 page.once('dialog',dialog=>dialog.accept());await page.click('#practiceRestart');
 assert.deepEqual(await page.evaluate(()=>({frame:practiceData().sliceIndex,polygons:practiceData().polygons.length,groups:practiceData().groups.length,drawing:practiceDrawing.length,done:localizationFinished(),overlay:document.querySelector('#overlay').checked,reportUnlocked,submitted:getDraft().submitted})),{frame:null,polygons:0,groups:0,drawing:0,done:false,overlay:false,reportUnlocked:false,submitted:false});
}
page.once('dialog',dialog=>dialog.dismiss());await page.click('#practiceRestart');assert.equal(await page.evaluate(()=>practiceData().polygons.length),2);
await restartAndCheck();assert.equal(await page.locator('#practiceFrame').isEnabled(),true);await page.click('#practiceNew');assert.equal(await page.evaluate(()=>practiceData().sliceIndex),0);console.log('application restart passed');
assert.equal(await page.locator('.steps .step:visible').count(),4);console.log('visible steps 4');console.log('application',await page.locator('#practiceStatus').textContent());
await page.click('#selectCaseWork');await page.click('[data-level="learning"]');await page.click('.case-option');await page.waitForFunction(()=>document.querySelector('#viewport').classList.contains('localizing'));const r=await page.locator('#ct').boundingBox();await page.mouse.click(r.x+15.5*r.width/32,r.y+15.5*r.height/32);await page.waitForFunction(()=>document.querySelector('#localizationProgress').textContent.includes('完成'));
assert.equal(await page.locator('.practice-tools').isVisible(),false);console.log('learning passed');await restartAndCheck();assert.equal(await page.evaluate(()=>localizationActive),true);assert.equal(await page.evaluate(()=>getDraft().localization.attempts),0);console.log('learning restart passed');
await page.route('**/api/sam/sessions',r=>r.fulfill({json:{sessionId:'a'.repeat(32),backend:'sam2',checkpoint:'fixture'}}));
await page.route('**/api/sam/sessions/*/predict',r=>r.fulfill({json:{revision:JSON.parse(r.request().postData()).revision,maskPng:'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAAAAABWESUoAAAAGUlEQVR4nGP8z4AfMBGQH1UwqmBUwbBVAACjPQE/b0XQuQAAAABJRU5ErkJggg==',modelScore:.9}}));
await page.click('#selectCaseWork');await page.click('[data-level="innovation"]');await page.click('.case-option');await page.waitForFunction(()=>document.body.dataset.practice==='innovation');await page.click('#practiceFrame');
const ir=await page.locator('#ct').boundingBox();const click=async(x,y)=>{const p=await page.evaluate(([x,y])=>{const f=measurementFrame();return[f.v.left+f.x+(x+.5)*f.scale,f.v.top+f.y+(y+.5)*f.scale]},[x,y]);await page.mouse.click(...p)};
await click(15,15);await page.click('#practiceBackground');await click(2,2);await page.waitForFunction(()=>document.querySelector('#practiceStatus').textContent.includes('分割已更新'));await page.click('#analyze');await page.waitForFunction(()=>document.querySelector('#analyze').textContent.includes('完成'));console.log('innovation passed');await assertOwnMasksOnly();await page.click('#selectCaseWork');await page.click('.case-option');await page.waitForFunction(()=>localizationFinished()&&!busy);await assertOwnMasksOnly();await restartAndCheck();assert.equal(await page.evaluate(()=>practiceSession),null);assert.equal(await page.locator('#practiceFrame').isEnabled(),true);console.log('innovation restart passed');
let releasePrediction;await page.route('**/api/sam/sessions/*/predict',async route=>{await new Promise(resolve=>releasePrediction=resolve);await route.fulfill({json:{revision:JSON.parse(route.request().postData()).revision,maskPng:'stale-mask',modelScore:.9}})});
await page.click('#practiceFrame');await click(15,15);await page.click('#practiceBackground');await click(2,2);await page.waitForFunction(()=>practicePending&&!!practiceSession);
await restartAndCheck();releasePrediction();await page.waitForFunction(()=>!practicePending);assert.equal(await page.evaluate(()=>practiceData().groups.length),0);assert.equal(await page.evaluate(()=>practiceSession),null);console.log('pending prediction restart passed');console.log('errors',errors);if(errors.length)throw Error(errors.join('\n'));await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
