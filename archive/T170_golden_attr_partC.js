// Attribution for the golden's tag scenario "B": the golden samples the LAST 3 valid tags in catalog order. Part C appended 15 tags, so the sample moved. Re-price the OLD sample on the NEW engine and catalog and compare with the golden's old values.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=process.env.QR_ROOT||path.resolve(__dirname,'..');
const DB=JSON.parse(fs.readFileSync(ROOT+'/btnyc.json','utf8'));
const old=JSON.parse(fs.readFileSync(ROOT+'/archive/golden_master_T166_extended.json','utf8'));
const NEW=new Set(Object.keys(DB.smart_tags).filter(k=>!JSON.parse(fs.readFileSync('' + (process.env.BTNYC_BEFORE || 'btnyc_before_c.json') + '','utf8')).smart_tags[k]));
const sb={DB,SERVICE_DATA:DB,window:{DB},console:{log(){},warn(){},error(){},info(){},debug(){}}};sb.global=sb;vm.createContext(sb);
for(const f of ['pricing_engine.js','nlp_engine.js','orchestrator_engine.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),sb,{filename:f});
const smart=Object.keys(DB.smart_tags).filter(k=>!NEW.has(k));
const validFor=(cat,grp)=>smart.filter(t=>{try{return sb.tagValidForCategory(t,cat,grp)}catch(e){return false}});
const stateRec=r=>[r.laborCalc,r.totalMin,r.meetsConfidenceBar,r.detTagsChargeable,r.checkoutStateKey,(r.activeTagIds||[]).slice().sort().join(',')];
const mk=(s,cat,q,extra)=>Object.assign({qty:q,intent:{key:s.id,category:cat,label:'x',qtyLabel:'item'},stype:'Repair',answers:{},detTagIds:[],manTagIds:[],negatedTagIds:[],inherentTagIds:[],userTagIds:[],_svc:s,_tagsAffirmed:false},extra||{});
let n=0,same=0; const bad=[];
for(const s of DB.services){const cat=s.ui_taxonomy.category_id,grp=s.ui_taxonomy.group_id;const v=validFor(cat,grp);const tags=v.slice(-3);
  for(const q of [1,2]){
    const k1=`state-tags|${s.id}|B|${q}`,k2=`state-det|${s.id}|B|${q}`,k3=`orch-tags|${s.id}|B|${q}`;
    const got1=stateRec(sb.computeQuoteFromState(mk(s,cat,q,{manTagIds:tags.slice()})));
    const got2=stateRec(sb.computeQuoteFromState(mk(s,cat,q,{detTagIds:tags.slice()})));
    const c=sb.collectBookingContext_catalog(s,cat);c.manuallyToggledTagIds=tags.slice();c.extractedQty=q;const r=sb.executeWorkflow(c,DB);
    const got3=[r.quote.laborEstimate,r.quote.totalMin,r.confidence&&r.confidence.score,r.confidence&&r.confidence.minConf,r.confidence&&r.confidence.escalatedBy||null,(r.activeTags||[]).slice().sort().join(',')];
    for(const [k,g] of [[k1,got1],[k2,got2],[k3,got3]]){n++; if(JSON.stringify(old[k])===JSON.stringify(g))same++; else bad.push(k+' old '+JSON.stringify(old[k])+' new '+JSON.stringify(g));}
  }}
console.log('old-sample points re-priced:',n,'identical to the golden:',same,'differ:',bad.length); console.log(bad.slice(0,8).join('\n'));
