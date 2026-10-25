import assert from "node:assert/strict";
import {readFile,writeFile,mkdir,readdir} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";
const out=resolve('.sites-runtime/foundation-tests');await mkdir(out,{recursive:true});
for(const f of (await readdir('app/data')).filter(f=>f.endsWith('.json')))await writeFile(resolve(out,f.replace('.json','.mjs')),'export default '+await readFile('app/data/'+f,'utf8'));
for(const name of ['domain','writing-resources','lesson-practice','foundation-course','correction-reports']){let source=await readFile('app/lib/'+name+'.ts','utf8');source=source.replace(/"\.\.\/data\/([^\"]+)\.json"/g,'"./$1.mjs"').replace(/"\.\/([^\"]+)"/g,(_,file)=>'"./'+(file.endsWith('.mjs')?file:file+'.mjs')+'"');await writeFile(resolve(out,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
const load=n=>import(pathToFileURL(resolve(out,n+'.mjs'))),f=await load('foundation-course'),d=await load('domain'),p=await load('lesson-practice'),r=await load('correction-reports'),c=(await load('curriculum')).default;
const ids=c.skills.filter(s=>['grammar','vocab'].includes(s.group)).map(s=>s.id).sort();
assert.deepEqual(f.foundationOrder.slice().sort(),ids);assert.equal(new Set(f.foundationOrder).size,29);assert.equal(f.foundations.length,29);
for(const item of f.foundations){assert(ids.includes(item.skillId));assert(item.explanation.split(/\s+/).length>=85,item.skillId);assert(item.explanationEs);assert(item.goal&&item.takeaway&&item.title);assert(item.uses.length>=3);assert(item.glossary.length>=2);assert(item.sources.every(x=>x.url.startsWith('https://')));for(const use of item.uses){assert(use.when&&use.form&&use.why&&use.es&&use.title);assert(use.examples.length>=2);for(const ex of use.examples)assert(ex.en&&ex.es&&ex.note);}assert(item.writingBridge.prompt&&item.writingBridge.checklist.length>=3);}
console.log('PASS 29 ordered lessons, complete bilingual theory, uses, examples, glossary and short production');
const original=d.freshState();assert.equal(f.nextFoundation(original),'g-word-order');assert.throws(()=>f.markFoundation(original,'g-word-order','completedAt'));assert.throws(()=>f.markFoundation(original,'bad','theoryAt'));
let state=f.markFoundation(original,'g-word-order','theoryAt');state=f.markFoundation(state,'g-word-order','examplesAt');assert(d.validateState(state));assert.equal(original.foundationRoute,undefined);
const base=p.enrichLesson(c.skills.find(s=>s.id==='g-word-order'));const bankId=p.nextLessonVariant([],base.id,[]);assert.equal(bankId,'word-order-a-v1');assert.equal(p.nextLessonVariant([],base.id,[{resourceId:'lesson:'+bankId}]),'word-order-b-v1');
for(const bank of p.wordOrderPilot.banks){
 assert.equal(new Set(bank.checks.map(q=>q.id)).size,bank.checks.length);
 for(const q of bank.checks){assert.equal(q.feedback.length,q.options.length);assert.equal(q.hints.length,2);assert(q.feedback[q.answer]);assert(q.followup.accepted.length);}
 const skill=p.withLessonVariant(base,bank.id),checks=p.lessonChecks(skill),answers=Object.fromEntries(checks.map(q=>[q.id,q.type==='open'?q.model:q.options[q.answer]]));
 const support={hints:{[bank.checks[0].id]:1},corrections:{[bank.checks[1].id]:'My revised explanation'},followups:{[bank.checks[1].id]:bank.checks[1].followup.accepted[0]},diagnostic:{'d-order':p.wordOrderPilot.diagnostic[0].options[0]}};
 const input={variantId:bank.id,answers,assisted:true,selfChecks:[],elapsedSeconds:200,openedAt:'2026-10-24T12:00:00Z',exposure:'unseen',support};
 const id=bank.id;state=p.recordLessonPractice(state,base,input,id,'note-'+id,new Date('2026-10-24T12:05:00Z'));assert(d.validateState(state));assert.equal(state.attempts.at(-1).total,5);assert.deepEqual(state.attempts.at(-1).lessonSupport,support);assert(state.learningNotes.slice(-2).every(n=>n.mode==='assisted'));assert.equal(p.lessonForAttempt(state.attempts.at(-1)).checks[0].prompt,bank.checks[0].prompt);assert.equal(p.recordLessonPractice(state,base,input,id,'duplicate'),state);
 assert.throws(()=>p.recordLessonPractice(state,base,{...input,support:{...support,hints:{bad:1}}},'invalid','invalid-note'));
 const longAnswers={...answers,apply:'x'.repeat(4000),stretch:'y'.repeat(4000)};assert(d.validateState(p.recordLessonPractice(state,base,{...input,answers:longAnswers},'long-'+id,'long-note-'+id)));
}
assert.equal(p.lessonChecks(p.lessonForAttempt({resourceId:base.id,lessonVersion:3})).length,9);assert.equal(p.lessonChecks(p.lessonForAttempt({resourceId:base.id,lessonVersion:2})).length,5);
state=f.markFoundation(state,base.id,'completedAt');assert.equal(f.nextFoundation(state),'g-be-auxiliaries');assert.equal(state.skills[base.id].status,'learning');assert(d.validateState(state));assert.equal(state.attempts.length,2);assert.equal(original.attempts.length,0);
console.log('PASS variants, original answers, hints, separate corrections, historical keys, persistence and route completion');
const bad=structuredClone(state);bad.attempts[0].answers['wo-a-do']='Does the class provides ingredients?';bad.attempts[0].score=4;
bad.attempts.push({id:'write-1',type:'writing',resourceId:'w2-transport-priorities',title:'Test writing',date:'2026-10-24T10:00:00Z',mode:'practice',elapsedSeconds:60,completed:true,taskTexts:{'w2-transport-priorities':'Test response'},feedback:{'w2-transport-priorities':{bands:{ta:5,cc:5,lr:5,gra:5},summary:'Test feedback',evidence:['Example'],priorities:['Order'],errors:[{original:'it depends how good is it',corrected:'it depends on how good it is',rule:'Statement order',skillId:'g-word-order'}]}}});
bad.learningNotes[0].review={date:'2026-10-24T13:00:00Z',feedback:'Review the subject and verb.'};
let reports=r.correctionReports(bad);assert.equal(reports.find(x=>x.id.startsWith('writing:')).date,undefined);assert.equal(reports.find(x=>x.id.startsWith('note:')).date,'2026-10-24T13:00:00Z');assert.equal(reports.find(x=>x.id==='lesson:word-order-a-v1').observations[0].skillId,'g-word-order');
const item=f.recentMistakes(bad).find(x=>x.id.startsWith('writing:'));assert(item&&item.corrected&&item.skillId==='g-word-order');assert.equal(item.practised,false);
bad.learningNotes.push({id:'review-practice',date:'2026-10-24T14:00:00Z',kind:'lesson-application',title:'Review',resourceId:item.skillId,attemptId:'write-1',reviewOf:item.id,text:'A different sentence.',mode:'assisted'});assert(d.validateState(bad));assert.equal(f.recentMistakes(bad).find(x=>x.id===item.id).practised,true);assert.equal(bad.skills[base.id].status,'learning');
const invalid=structuredClone(bad);invalid.foundationRoute.steps.bad={theoryAt:'today'};assert.equal(d.validateState(invalid),false);
console.log('PASS reports use real correction dates, connect actual errors to theory and track review without declaring mastery');
