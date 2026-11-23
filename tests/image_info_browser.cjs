const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const zlib=require('node:zlib');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/cases',r=>r.fulfill({json:{cases:['30','6','7'].map(id=>({id,examId:'ORIGINAL-EXAM-'+id,hasMask:true}))}}));
 await page.route(/\/api\/cases\/(30|6|7)\/(meta|ct|mask)$/,route=>{
  const [,id,kind]=route.request().url().match(/\/cases\/(\d+)\/(\w+)$/);
  if(kind==='meta')return route.fulfill({json:{caseId:id,examId:'ORIGINAL-EXAM-'+id,dims:[64,64,2],spacing:[.7,.8,1.2],target:0,hasMask:true,maskVoxels:1,sections:[],patientAge:id==='30'?'61岁':id==='6'?'73岁':'',patientSex:id==='30'?'女':id==='6'?'男':'',displayGeometry:{flipX:false,flipY:false,reverseZ:false,verified:true}}});
  return route.fulfill({body:zlib.gzipSync(Buffer.alloc(kind==='ct'?16384:8192)),contentType:'application/octet-stream'});
 });
 await require('./account_fixture.cjs')(page);
await page.goto(process.env.PRACTICE_BASE_URL||'http://127.0.0.1:8765/');await page.click('#startExplore');
 async function select(id){await page.locator('.case-option').filter({hasText:'CASE '+id}).click();await page.waitForFunction(id=>!busy&&meta?.caseId===id,id);await page.waitForFunction(()=>!document.querySelector('#imageInfo').hidden)}
 async function checkBounds(){
  await page.waitForFunction(()=>{
   const canvas=document.querySelector('#ct'),v=document.querySelector('#viewport').getBoundingClientRect(),r=canvas.getBoundingClientRect();
   const scale=Math.min(r.width/canvas.width,r.height/canvas.height),x=r.left+(r.width-canvas.width*scale)/2,y=r.top+(r.height-canvas.height*scale)/2;
   const left=Math.max(v.left,x),right=Math.min(v.right,x+canvas.width*scale),top=Math.max(v.top,y),bottom=Math.min(v.bottom,y+canvas.height*scale);
   return ['.image-info .tl','.image-info .tr'].every(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return b.left>=left-2&&b.right<=right+2&&b.top>=top-2&&b.bottom<=bottom+2});
  });
 }
 await select('30');await page.click('#dismissHint');assert.match(await page.locator('#patientDemographics').textContent(),/61岁.*女/);
 const identity=await page.locator('#caseNo').textContent();assert.match(identity,/^SIM-\d+$/);assert.notEqual(identity,'30');assert.match(await page.locator('#patientLabel').textContent(),/姓名：/);assert.equal(await page.locator('.case-chip').count(),0);
 assert.ok(!(await page.locator('#imageInfo').textContent()).includes('ORIGINAL-EXAM'));await checkBounds();
 await page.screenshot({path:'/tmp/imed-image-info-desktop.png',fullPage:true});
 await page.click('#zoomIn');await checkBounds();
 await page.evaluate(()=>{panX=55;panY=30;render()});await checkBounds();await page.click('#homeView');
 await page.setViewportSize({width:390,height:844});await checkBounds();await page.screenshot({path:'/tmp/imed-image-info-mobile.png',fullPage:true});
 await page.setViewportSize({width:1600,height:1100});await checkBounds();
 await page.click('#selectCaseWork');await select('6');assert.match(await page.locator('#patientDemographics').textContent(),/73岁.*男/);assert.notEqual(await page.locator('#caseNo').textContent(),identity);
 await page.click('#selectCaseWork');await select('7');assert.equal((await page.locator('#patientDemographics').textContent()).match(/未提供/g).length,2);
 await page.click('#selectCaseWork');await select('30');assert.equal(await page.locator('#caseNo').textContent(),identity);await checkBounds();
 assert.deepEqual(errors,[]);console.log('PASS: report demographics, fictional identities, case isolation, image-bound corner layout, zoom/pan and mobile letterboxing');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
