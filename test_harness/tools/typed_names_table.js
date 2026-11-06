// T197 (#250): for each published service (ui_taxonomy.display_name), type the exact name through the customer's free-text
// path (collectBookingContext_freeText -> executeWorkflow, tags affirmed) and compare with the quote the same service gives
// from its own catalog tile (collectBookingContext_catalog, nothing answered). 'reached' = the typed entry resolved to that
// service id. Expected = the service's own identity and tile quote, not a copy of what the typed path happens to return.
// usage: node typed_names_table.js <out.json>   (QR_ROOT=<tree> to measure another tree)
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.env.QR_ROOT?path.resolve(process.env.QR_ROOT):path.resolve(__dirname,'..','..');
const DB=JSON.parse(fs.readFileSync(path.join(ROOT,'btnyc.json'),'utf8'));
const sb={DB,SERVICE_DATA:DB,window:{DB},console:{log(){},warn(){},error(){},info(){},debug(){}}};sb.global=sb;vm.createContext(sb);
for(const f of ['pricing_engine.js','nlp_engine.js','orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),sb,{filename:f});
sb.initNlpSets(); if(typeof sb.refreshNlpPreviewBindings==='function') sb.refreshNlpPreviewBindings();
const facts=r=>({answers:r.answers&&Object.keys(r.answers).length?r.answers:undefined,tags:(r.activeTags||[]).map(t=>t&&t.id||t).join(',')||undefined,labor:r.quote&&r.quote.laborEstimate,mins:r.quote&&r.quote.totalMin,state:r.quote&&r.quote.checkoutStateKey,
  open:(r.visibleChain||[]).filter(m=>!(r.answers||{})[m.moduleKey]).map(m=>m.moduleKey).join(',')});
const rows=[];
for(const s of DB.services){
  const name=s.ui_taxonomy.display_name;
  // what the named service quotes from its own tile, nothing answered
  const c0=sb.collectBookingContext_catalog(s,s.ui_taxonomy.category_id); c0.answers={};
  const want=facts(sb.executeWorkflow(c0,DB));
  // what the customer gets typing the exact name
  let got;
  try{const c=sb.collectBookingContext_freeText(name);const r=sb.executeWorkflow(Object.assign({},c,{tagsAffirmed:true}),DB);
    const nlp=c.nlpIntent||{};
    got={entity:r.entity&&r.entity.id||null,entityName:r.entity&&(r.entity.name||r.entity.display_name||r.entity.label)||null,isDynamic:!(r.entity&&r.entity.id),key:nlp.key||null,sku:nlp.recommendedSku||null,conf:nlp._matchConfidence==null?null:nlp._matchConfidence,...facts(r)};}
  catch(e){got={error:String(e.message)};}
  rows.push({id:s.id,name,reached:got.entity===s.id,want,got});
}
fs.writeFileSync(process.argv[2],JSON.stringify({root:ROOT,rows},null,1));
const ok=rows.filter(r=>r.reached).length;
console.log(`names that reach their own service: ${ok} of ${rows.length}`);
for(const r of rows.filter(r=>!r.reached)) console.log(`  ${r.id.padEnd(40)} -> ${String(r.got.entity||('dynamic:'+r.got.entityName)).padEnd(34)} key=${r.got.key} sku=${r.got.sku} conf=${r.got.conf} | typed $${r.got.labor}/${r.got.mins}m ${r.got.state} open[${r.got.open}] | named $${r.want.labor}/${r.want.mins}m ${r.want.state} open[${r.want.open}]`);
