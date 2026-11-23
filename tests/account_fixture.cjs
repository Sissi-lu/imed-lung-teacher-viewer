// Existing UI regressions isolate account transport; account_browser covers real authentication.
module.exports=async page=>{
 await page.route('**/api/sam/**',r=>r.request().method()==='DELETE'?r.fulfill({json:{ok:true}}):r.fallback());
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'fixture',username:'fixture',role:'user',csrf:'fixture'}}));
 await page.route('**/api/progress?*',r=>r.fulfill({json:{value:null,revision:0}}));
 await page.route('**/api/play-records',r=>r.fulfill({json:{id:'fixture',value:null,revision:0}}));
 await page.route('**/api/play-records/*',r=>r.fulfill({json:{revision:1}}));
};
