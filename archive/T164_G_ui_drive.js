// T164 (item G) evidence, not a test: drives the four services that lost their only question (microwave_setup, washer_install, dishwasher_install, refrigerator_install) through the
// real page in headless Chrome -- real clicks on the category, group, type and service tiles; real typing in the free-text bar; the real "Looks right" and "Add to Request" buttons --
// and reports what the customer sees and what lands in the cart. Run on the pre-G tree (BTNYC_PAGE_ROOT=<tree> BTNYC_QR_FILE=<tree>/qr.html) and the post-G tree, and compare.
//   CHROME_PATH=... node archive/T164_G_ui_drive.js > out.json
const fs=require('fs');
const path=require('path');
const H=path.resolve(__dirname,'..');                       // the repo: the harness (puppeteer, _page.js) always comes from here
const R=process.env.BTNYC_PAGE_ROOT||H;                    // the tree whose qr.html + btnyc.json are driven
const PAGE=require(H+'/test_harness/_page.js');
const puppeteer=require(H+'/test_harness/node_modules/puppeteer-core');
const chrome=[process.env.CHROME_PATH,'/opt/pw-browsers/chromium'].filter(Boolean).find(p=>fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SERVICES={microwave_setup:['Microwave Setup','Microwave','install my microwave'],washer_install:['Washer Install','Washer','install a washing machine'],dishwasher_install:['Dishwasher Install','Dishwasher','install a dishwasher'],refrigerator_install:['Refrigerator Install','Refrigerator','install a refrigerator']};
(async()=>{
 const browser=await puppeteer.launch({headless:'new',executablePath:chrome,args:['--no-sandbox','--disable-setuid-sandbox']});
 const DATA=fs.readFileSync(R+'/btnyc.json','utf8'); const DB=JSON.parse(DATA);
 const open=async()=>{const page=await browser.newPage(); await page.setViewport({width:1280,height:2400}); await page.setRequestInterception(true);
  page.on('request',r=>{const d=PAGE.documentResponse(r.url()); if(d) return r.respond(d); r.url().includes('btnyc.json')?r.respond({status:200,contentType:'application/json',body:DATA}):r.continue();});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await page.goto('file://'+R+'/qr.html',{waitUntil:'networkidle0',timeout:60000});
  await page.waitForFunction(()=>window.DB&&window.DB.services,{timeout:20000}); return {page,errs};};
 const clickText=async(page,sel,text,exact)=>{const h=await page.evaluateHandle((sel,text,exact)=>[...document.querySelectorAll(sel)].find(e=>e.offsetHeight>0&&(exact?e.textContent.trim()===text:e.textContent.includes(text)))||null,sel,text,!!exact); const el=h.asElement(); if(!el) return false; await el.click(); await sleep(500); return true;};
 const cart=page=>page.evaluate(()=>({store:window.__store.getState().cart.serviceRequest.map(i=>({id:i.serviceId,price:i.price,qty:i.qty,answers:i.intakeAnswers||null})),summary:[...document.querySelectorAll('#serviceRequestList .summary-service-item')].map(e=>e.textContent.trim().replace(/\s+/g,' ').slice(0,100)),total:(document.querySelector('#summaryTotal,#cartTotal')||{}).textContent||null}));
 const results={};
 for(const [id,[name,tile,text]] of Object.entries(SERVICES)){
  const svc=DB.services.find(s=>s.id===id); const R2={price:svc.financial_engine.base_price,minutes:svc.operational_metrics&&svc.operational_metrics.expected_minutes};
  // ---- A. catalog browse
  {const {page,errs}=await open();
   const ok=[await clickText(page,'.category-card','Minor Home Repairs'),await clickText(page,'.group-tile','Appliances'),await clickText(page,'.group-tile',tile)];
   R2.A_navigated=ok.every(Boolean);
   if(!(await page.evaluate((name)=>!![...document.querySelectorAll('h4')].find(e=>e.offsetHeight>0&&e.textContent.trim()===name),name))){ R2.A_typeStep=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.offsetHeight>0&&e.children.length===0&&e.textContent.trim().length>1&&e.textContent.length<40).map(e=>e.textContent.trim()).slice(0,14)); await clickText(page,'.type-chip,.tile-name,.chip,button,div','Install',true); }
   const card=await page.evaluateHandle((name)=>{const h=[...document.querySelectorAll('h4')].find(e=>e.offsetHeight>0&&e.textContent.trim()===name); return h? h.closest('.service-tile'):null;},name);
   if(card.asElement()){await card.asElement().click(); await sleep(900);}
   R2.A_view=await page.evaluate(()=>({chips:document.querySelectorAll('.ims-chip').length,questions:document.querySelectorAll('.intake-module-step').length,text:[...document.querySelectorAll('body *')].filter(e=>e.offsetHeight>0&&e.children.length===0&&e.textContent.trim().length>2&&e.textContent.length<100).map(e=>e.textContent.trim().replace(/\s+/g,' ')).filter(t=>/Total labor|\$\d|Add to Request|dispatch|\?|Answer \d/.test(t)).slice(0,12)}));
   const addH=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(e=>e.offsetHeight>0&&/^Add to Request/.test(e.textContent.trim()))||null);
   if(addH.asElement()){await addH.asElement().click(); await sleep(800);}
   R2.A_cart=await cart(page); R2.A_errors=errs; await page.close();}
  // ---- B. free text
  {const {page,errs}=await open();
   await page.type('#sqDescIn',text,{delay:5}); await sleep(400);
   R2.B_preview=await page.evaluate(()=>(document.getElementById('sqLivePreview')||{}).innerText||null);
   const btn=await page.$('#sqUnifiedActionBtn'); if(btn){await btn.click(); await sleep(1200);}
   R2.B_view=await page.evaluate(()=>({chips:document.querySelectorAll('.ims-chip').length,questions:document.querySelectorAll('.intake-module-step').length,text:[...document.querySelectorAll('body *')].filter(e=>e.offsetHeight>0&&e.children.length===0&&e.textContent.trim().length>2&&e.textContent.length<100).map(e=>e.textContent.trim().replace(/\s+/g,' ')).filter(t=>/Total labor|\$\d|Add to Request|dispatch|\?|Answer \d/.test(t)).slice(0,12)}));
   const addB=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(e=>e.offsetHeight>0&&/^Add to Request/.test(e.textContent.trim()))||null);
   if(addB.asElement()){await addB.asElement().click(); await sleep(800);}
   R2.B_cart=await cart(page);
   R2.B_errors=errs; await page.close();}
  results[id]=R2;
 }
 console.log(JSON.stringify(results,null,1)); await browser.close();
})();
