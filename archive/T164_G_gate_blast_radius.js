#!/usr/bin/env node
/**
 * T164 (item G), ledger #161: how many quotes change if an unaffirmed detected tag may not price through the answers it synthesises.
 *
 *   node archive/T164_G_gate_blast_radius.js <root_with_the_fix>        (the "before" root is the repo root, i.e. the tree as it is)
 *
 * <root_with_the_fix> is a scratch directory holding btnyc.json and COPIES of pricing_engine.js, nlp_engine.js, orchestrator_engine.js with the experiment applied
 * (nothing in the repo is changed; the generated root copies are gitignored). The experiment, option (A2) of #161, in pricing_engine.js's computeQuoteFromState,
 * after `const activeTagIds = resolveSessionTagIds(state, !!detTagsChargeable);` and before `const u = ...`:
 *
 *     const pricedAnswers = Object.assign({}, state.answers || {});
 *     if (!detTagsChargeable) for (const [m, tid] of Object.entries(state._tagSynthesizedModules || {})) if (!activeTagIds.includes(tid)) delete pricedAnswers[m];
 *     // ... and `answers: pricedAnswers` in the gated computeUnifiedQuote({...}) call
 *
 * and in orchestrator_engine.js's orch_compute_quote, in the gated branch, the answers the gated quote is computed from drop the modules synthesised from ALL the tags in
 * force and take instead those synthesised from the customer-chosen tags only (synthesizeAnswersFromTags over closeTagsOverRequires(manuallyToggledTagIds)).
 * Option (A) (re-synchronise state.answers from the chargeable tags only) prices the same on all 1,014 pairs and drops the answers, which re-asks the questions.
 * The output of the run that backs #161 is archive/T164_G_gate_blast_radius.txt.
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
function load(root){ const DB=JSON.parse(fs.readFileSync(path.join(root,'btnyc.json'),'utf8')); const sb={DB,SERVICE_DATA:DB,window:{DB},console}; sb.global=sb; vm.createContext(sb);
  for(const f of ['pricing_engine.js','nlp_engine.js','orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sb,{filename:f}); return {DB,sb}; }
const cur=load(path.resolve(__dirname,'..')), opt=load(process.argv[2]);
const {DB}=cur; const smart=Object.keys(DB.smart_tags||{});
let pairs=0, moved=0; const svcMoved=new Set(), tagMoved={}, deltas=[], viaModule={};
for(const s of DB.services){ const cat=s.ui_taxonomy.category_id, grp=s.ui_taxonomy.group_id;
  const valid=smart.filter(t=>{try{return cur.sb.tagValidForCategory(t,cat,grp)}catch(e){return false}});
  for(const t of valid){ pairs++;
    const mk=()=>({qty:1,intent:{key:s.id,category:cat,label:'x',qtyLabel:'item'},stype:'Repair',answers:{},detTagIds:[t],manTagIds:[],negatedTagIds:[],inherentTagIds:[],userTagIds:[],_svc:s,_tagsAffirmed:false});
    const a=cur.sb.computeQuoteFromState(mk()), b=opt.sb.computeQuoteFromState(mk());
    if(a.laborCalc!==b.laborCalc||a.totalMin!==b.totalMin){ moved++; svcMoved.add(s.id); tagMoved[t]=(tagMoved[t]||0)+1; deltas.push(a.laborCalc-b.laborCalc);
      for(const m of Object.keys(DB.smart_tags[t].answers||{})) viaModule[m]=(viaModule[m]||0)+1; } } }
deltas.sort((x,y)=>x-y);
console.log('(service, ONE detected tag valid for its category) pairs:',pairs,'| reprice when unaffirmed tags may not answer questions:',moved,'| services:',svcMoved.size,'of',DB.services.length);
console.log('labor $ difference: min',deltas[0],'median',deltas[deltas.length>>1],'max',deltas[deltas.length-1]);
console.log('tags involved:',Object.keys(tagMoved).length,'of',smart.length,'|',Object.entries(tagMoved).sort((x,y)=>y[1]-x[1]).slice(0,8).map(e=>e.join(' ')).join(', '));
console.log('answer modules that carry the fee (count of pairs):',Object.entries(viaModule).sort((x,y)=>y[1]-x[1]).slice(0,8).map(e=>e.join(' ')).join(', '));
