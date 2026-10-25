import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";

const out=resolve(".sites-runtime/learning-plan-tests");await mkdir(out,{recursive:true});
const data={};
for(const name of ["curriculum","reading","learning-map"]){data[name]=JSON.parse(await readFile(`app/data/${name}.json`,"utf8"));await writeFile(resolve(out,name+".mjs"),"export default "+JSON.stringify(data[name]));}
for(const name of ["domain","writing-resources","learning-plan","planning"]){
 let source=await readFile(`app/lib/${name}.ts`,"utf8");
 for(const json of Object.keys(data))source=source.replaceAll(`"../data/${json}.json"`,`"./${json}.mjs"`);
 for(const module of ["domain","writing-resources","learning-plan"])source=source.replaceAll(`"./${module}"`,`"./${module}.mjs"`);
 await writeFile(resolve(out,name+".mjs"),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
const p=await import(pathToFileURL(resolve(out,"learning-plan.mjs"))),d=await import(pathToFileURL(resolve(out,"domain.mjs")));
const now=Date.parse("2026-11-04T12:00:00Z"),start=()=>d.freshState();
const test=data.reading.tests.find(test=>test.questions.length===40);
const one=data.curriculum.writingTasks.filter(task=>task.type==="task1"),two=data.curriculum.writingTasks.filter(task=>task.type==="task2");
const conditions={exposure:"unseen",assistance:"none",timing:"continuous"};
const feedback=(skillId="g-word-order",reviewedAt="2026-10-24T10:00:00Z")=>({bands:{ta:5,cc:5,lr:5,gra:4},summary:"Synthetic feedback",evidence:["A sentence needs repair"],priorities:["Subject and verb"],errors:[{skillId,original:"Synthetic",corrected:"Synthetic correction",rule:"Synthetic rule"}],reviewedAt});
function read(id,date="2026-10-23T10:00:00Z",answers={}){return {id,type:"reading",resourceId:"reading:"+test.id,title:test.title,date,mode:"exam",elapsedSeconds:3600,score:0,total:40,answers,completed:true,conditions:{...conditions}};}
function write(id,task,date){return {id,type:"writing",resourceId:task.id,title:task.title,date,mode:"practice",elapsedSeconds:900,taskTexts:{[task.id]:"A synthetic original response about a new situation."},completed:true,conditions:{...conditions}};}
function planState(){const s=start();s.learningPlan=p.createLearningPlan("recommended_12h",Date.parse("2026-10-23T10:00:00Z"));return s;}

// An actual wrong answer can score zero; an empty save has no linguistic evidence.
{
 const s=start();s.attempts=[read("empty")];let x=p.diagnosticEvidence(s);assert.equal(x.reading.status,"missing");assert.equal(x.reading.score,undefined);assert.equal(x.emptyAttempts,1);
 s.attempts.push(read("real","2026-10-24T10:00:00Z",{[String(test.questions[0].id)]:"Definitely incorrect"}));
 x=p.diagnosticEvidence(s);assert.equal(x.reading.attemptId,"real");assert.equal(x.reading.status,"confirmed");assert.equal(x.reading.score,0);
 assert.equal(s.attempts.length,2);
}
console.log("PASS empty versus real zero; eligibility before deduplication; history intact");
{
 const s=start(),a=read("legacy","2026-10-23T10:00:00Z",{[String(test.questions[0].id)]:"Incorrect"});delete a.conditions;s.attempts=[a];
 assert.equal(p.diagnosticEvidence(s).reading.status,"provisional");
 s.attempts.push(read("later","2026-10-24T10:00:00Z",a.answers));assert.equal(p.diagnosticEvidence(s).reading.status,"provisional");
 s.attempts=[{...read("practice","2026-10-23T10:00:00Z",a.answers),mode:"practice"}];assert.equal(p.diagnosticEvidence(s).reading.status,"provisional");
 for(const assistance of ["allowed","unknown"]){s.attempts=[{...read("help","2026-10-23T10:00:00Z",a.answers),conditions:{...conditions,assistance}}];assert.equal(p.diagnosticEvidence(s).reading.status,"provisional");}
}
console.log("PASS repetition, legacy unknown and assistance never confirm a diagnostic");
{
 const s=start(),a=read("late-save","2026-10-23T10:05:00Z",{[String(test.questions[0].id)]:"Incorrect"});a.conditions.openedAt="2026-10-23T09:00:00Z";s.attempts=[a];
 s.resourceExposures=[{resourceId:a.resourceId,date:"2026-10-23T09:00:00Z",reason:"opened"}];assert.equal(p.diagnosticEvidence(s).reading.status,"confirmed");
 s.resourceExposures.push({resourceId:a.resourceId,date:"2026-10-23T09:59:00Z",reason:"solution"});assert.equal(p.diagnosticEvidence(s).reading.status,"provisional");
}
console.log("PASS delayed saving does not invalidate own opening; prior solution does");
{
 const s=start(),a={...write("partial",one[0],"2026-10-23T10:00:00Z"),resourceId:"diagnostic-writing",mode:"exam",taskTexts:{[one[0].id]:"A real short letter.",[two[0].id]:" "},feedback:{[one[0].id]:feedback(),[two[0].id]:feedback()}};s.attempts=[a];
 const x=p.diagnosticEvidence(s);assert.equal(x.writing.fullEstimate,null);assert.equal(x.writing.task1.estimate,4.75);assert.equal(x.writing.task1.wordCount,4);assert.equal(x.writing.task2,null);
 const objectives=p.selectObjectives(s,now);assert(objectives.some(o=>o.skillId==="g-word-order"));assert(objectives.some(o=>o.group==="reading"));assert(objectives.filter(o=>o.group!=="reading").length<=2);
 a.taskTexts[two[0].id]="A short but real essay attempt.";assert.equal(p.diagnosticEvidence(s).writing.status,"confirmed");assert.equal(p.diagnosticEvidence(s).writing.fullEstimate,4.75);
}
console.log("PASS partial Task 1 guides route without Task 2; short text is not treated as empty");

for(const minutes of [20,10,120,NaN])for(const b of p.weeklyBudgets(minutes)){
 assert.equal(b.blocks.reduce((s,x)=>s+x.minutes,0),b.readingWritingMinutes);assert.equal(b.existingCardsMinutes+b.readingWritingMinutes,b.totalMinutes);assert.equal(b.allSkillsMinutes,b.totalMinutes+120);assert(b.blocks.every(x=>x.minutes>=0));
}
assert.deepEqual(p.weeklyBudgets(20).map(b=>b.readingWritingMinutes),[400,580,760]);
{
 const s=start(),before=JSON.stringify(s),overview=p.learningOverview(s,Date.parse("2026-10-23T10:00:00Z"));
 assert.equal(overview.horizon.days,84);assert.equal(overview.horizon.plannedHours,144);assert.equal(overview.selectedBudget.phase,"diagnostic");assert.equal(overview.selectedBudget.blocks.reduce((sum,b)=>sum+b.minutes,0),580);assert.equal(JSON.stringify(s),before);
 assert.equal(p.remainingStudyDays("2026-02-30",now),null);assert.equal(p.remainingStudyDays("2027-01-15",Date.parse("2027-01-15T10:00:00Z")),0);
 s.learningPlan=p.createLearningPlan("recommended_12h",Date.parse("2026-10-23T10:00:00Z"));assert.equal(p.weeklyReview(s,Date.parse("2026-10-29T10:00:00Z")).due,false);assert.equal(p.weeklyReview(s,Date.parse("2026-10-30T10:00:00Z")).due,true);
 s.learningPlan.reviews.push({id:"r",date:"2026-10-30T10:00:00Z",decision:"method",note:"Change method"});assert.equal(p.weeklyReview(s,now).due,false);
}
console.log("PASS budgets and diagnostic blocks sum exactly, current profile is immutable, dates and weekly review");

function transferFixture(){
 const s=planState(),teach=write("teaching",one[0],"2026-10-23T10:00:00Z"),source=write("new-production",one[1],"2026-11-02T10:00:00Z");
 teach.feedback={[one[0].id]:feedback()};s.attempts=[teach,source];
 s.learningPlan.evidence=[{id:"ev",date:source.date,skillId:"g-word-order",kind:"transfer",attemptId:source.id,anchorAttemptId:teach.id,anchorDate:"2026-10-24T10:00:00Z",independent:true,help:false,exposure:"unseen",conditions:"practice",outcome:"met",note:"Synthetic observation; intermediate practice recorded."}];return s;
}
{
 const s=transferFixture(),before=JSON.stringify(s);assert.equal(p.gateProgress(s,"g-word-order",now).status,"transfer-recorded");assert.equal(JSON.stringify(s),before);assert.equal(s.skills["g-word-order"],undefined);
 for(const assistance of ["allowed","unknown"]){const x=structuredClone(s);x.attempts[1].conditions.assistance=assistance;assert.notEqual(p.gateProgress(x,"g-word-order",now).status,"transfer-recorded");}
 const tooSoon=structuredClone(s);tooSoon.attempts[1].date="2026-10-25T10:00:00Z";tooSoon.learningPlan.evidence[0].date="2026-11-02T10:00:00Z";assert.notEqual(p.gateProgress(tooSoon,"g-word-order",now).status,"transfer-recorded");
 const noAnchor=structuredClone(s);delete noAnchor.learningPlan.evidence[0].anchorAttemptId;assert.notEqual(p.gateProgress(noAnchor,"g-word-order",now).status,"transfer-recorded");
 const wrongSkill=structuredClone(s);wrongSkill.attempts[0].feedback[one[0].id]=feedback("g-conditionals");assert.notEqual(p.gateProgress(wrongSkill,"g-word-order",now).status,"transfer-recorded");
 const later=structuredClone(s);later.attempts[1].feedback={[one[1].id]:feedback("g-word-order","2026-11-03T10:00:00Z")};assert.notEqual(p.gateProgress(later,"g-word-order",now).status,"transfer-recorded");
 const fabricated=structuredClone(s);fabricated.learningPlan.evidence[0].anchorDate="2026-10-23T10:00:00Z";assert.notEqual(p.gateProgress(fabricated,"g-word-order",now).status,"transfer-recorded");
 const timed=structuredClone(s);timed.attempts[1].mode="exam";timed.attempts[1].conditions.openedAt="2026-10-25T10:00:00Z";assert.notEqual(p.gateProgress(timed,"g-word-order",now).status,"transfer-recorded");
 const otherPattern=structuredClone(s);otherPattern.attempts[1].feedback={[one[1].id]:feedback("g-conditionals","2026-11-03T10:00:00Z")};assert.equal(p.gateProgress(otherPattern,"g-word-order",now).status,"transfer-recorded");
}
console.log("PASS transfer uses source date, real relevant teaching, known assistance and new cycles; no automatic mastery");

{
 const ids=new Set(data.curriculum.skills.map(s=>s.id));assert.equal(p.learningMap.length,58);assert.equal(new Set(p.learningMap.map(m=>m.skillId)).size,58);
 const visiting=new Set(),done=new Set(),byId=new Map(p.learningMap.map(m=>[m.skillId,m]));
 function visit(id){assert(ids.has(id));assert(!visiting.has(id),"prerequisite cycle");if(done.has(id))return;visiting.add(id);for(const parent of byId.get(id).prerequisiteSkillIds)visit(parent);visiting.delete(id);done.add(id);}
 for(const m of p.learningMap)visit(m.skillId);
 const s=start(),before=JSON.stringify(s);for(const objective of p.selectObjectives(s,now))if(objective.resourceId&&objective.group==="reading"){assert(p.resourceContext(s).find(r=>r.id===objective.resourceId).questionCount<40);}
 assert.equal(JSON.stringify(s),before);
 s.resourceExposures=[{resourceId:one[0].id,date:"2026-10-23T10:00:00Z",reason:"opened"}];assert.equal(p.resourceContext(s).find(r=>r.id===one[0].id).independentCandidate,false);
}
console.log("PASS 58 skill IDs and acyclic conditional prerequisites; objective drills reserve full tests");
console.log("PASS learning-plan diagnostic, budget, transfer, exposure and route contract");
