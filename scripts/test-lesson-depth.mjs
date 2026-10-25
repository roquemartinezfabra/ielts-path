import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";

const names=["curriculum","reading","lesson-archive","lesson-archive-v2","lesson-depth-grammar","lesson-depth-reading-vocab","lesson-depth-writing","foundation-word-order-v1"];
const data=Object.fromEntries(await Promise.all(names.map(async name=>[name,JSON.parse(await readFile(`app/data/${name}.json`,"utf8"))])));
const out=resolve(".sites-runtime/depth-tests");await mkdir(out,{recursive:true});
for(const [name,value] of Object.entries(data))await writeFile(resolve(out,name+".mjs"),"export default "+JSON.stringify(value));
for(const name of ["domain","lesson-practice","writing-resources"]){
 let source=await readFile(`app/lib/${name}.ts`,"utf8");
 for(const name of names)source=source.replaceAll(`"../data/${name}.json"`,`"./${name}.mjs"`);
 for(const name of ["domain","lesson-practice","writing-resources"])source=source.replaceAll(`"./${name}"`,`"./${name}.mjs"`);
 await writeFile(resolve(out,name+".mjs"),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
const p=await import(pathToFileURL(resolve(out,"lesson-practice.mjs"))),d=await import(pathToFileURL(resolve(out,"domain.mjs")));
const extensions=[...data["lesson-depth-grammar"],...data["lesson-depth-reading-vocab"],...data["lesson-depth-writing"]];
assert.equal(extensions.length,58);assert.equal(new Set(extensions.map(x=>x.skillId)).size,58);
assert.deepEqual(extensions.map(x=>x.skillId).sort(),data.curriculum.skills.map(x=>x.id).sort());
assert.deepEqual(data["lesson-archive-v2"].skills,data.curriculum.skills);
let checks=0,words=0;
for(const depth of extensions){
 const id=depth.skillId,skill=p.enrichLesson(data.curriculum.skills.find(x=>x.id===id));
 assert.equal(p.enrichLesson(skill),skill,id+" enrichment must be idempotent");
 assert(depth.why.trim().split(/\s+/).length>=35,id+" lacks a meaningful explanation");
 assert.equal(depth.decisions.length,2,id);assert(depth.decisions.every(x=>[x.cue,x.action,x.en,x.reason].every(x=>typeof x==="string"&&x.trim())),id);
 const example=depth.worked;assert(example.scenario&&example.task&&example.model&&example.alternative.text&&example.alternative.why,id+" incomplete worked case");
 const context=[example.scenario,example.task,example.model].join("\n");
 assert.equal(example.reasoning.length,3,id);for(const step of example.reasoning){assert(context.includes(step.quote),id+" quoted evidence is absent: "+step.quote);assert(step.explanation.trim(),id+" evidence unexplained");}
 assert.equal(depth.checks.length,3,id);assert(depth.checks.some(x=>x.type==="choice"),id);assert(depth.checks.some(x=>x.type==="input"),id);
 assert.deepEqual(depth.checks.map(x=>x.id),["deepen-1","deepen-2","deepen-3"],id);
 for(const check of depth.checks){
  assert(check.prompt&&check.explanation,id);assert(check.type==="choice"||check.type==="input",id);
  if(check.type==="choice"){assert(check.options.length>=3,id);assert.equal(new Set(check.options).size,check.options.length,id);assert(Number.isSafeInteger(check.answer)&&check.answer>=0&&check.answer<check.options.length,id);assert.equal(p.checkLessonAnswer(check,check.options[check.answer]),true,id);}
  else{assert(check.accepted.length>0&&check.accepted.every(x=>typeof x==="string"&&x.trim()),id);for(const accepted of check.accepted)assert.equal(p.checkLessonAnswer(check,accepted),true,id);}
  assert.equal(p.checkLessonAnswer(check,""),false,id);checks++;
 }
 const open=depth.retrieval;assert.equal(open.id,"stretch",id);assert.equal(open.type,"open",id);assert(open.prompt&&open.model&&open.explanation&&open.checklist.length>=3,id);assert(open.prompt.length<3000,id+" prompt leaves insufficient room for a learner response");
 assert.equal(p.checkLessonAnswer(open,open.model),null,id);if(open.minWords)assert(d.wordCount(open.model)>=open.minWords,id+" model below requested length");
 if(id==="t1-integrated-letter"){assert(d.wordCount(example.model)>=150,id);assert(open.minWords>=150,id);}
 if(id==="t2-integrated-essay"){assert(d.wordCount(example.model)>=250,id);assert(open.minWords>=250,id);}
 assert(depth.sources.length&&depth.sources.every(x=>x.title&&new URL(x.url).protocol==="https:"),id);
 const current=p.lessonChecks(skill),historic=p.lessonChecks(p.lessonForAttempt({resourceId:id,lessonVersion:2}));
 assert.equal(current.length,9,id);assert.equal(current.filter(x=>x.type==="open").length,2,id);assert.equal(historic.length,5,id);assert.equal(p.lessonChecks(p.lessonForAttempt({resourceId:id,lessonVersion:3})).length,9,id);
 assert.deepEqual(current.filter(x=>!x.id.startsWith("deepen-")&&x.id!=="stretch"),historic,id+" old checks changed");
 const longestAnswers=Object.fromEntries(current.map(c=>[c.id,c.type==="choice"?c.options[c.answer]:c.type==="input"?c.accepted[0]:"Z".repeat(4000)]));
 const capacity=p.recordLessonPractice(d.freshState(),skill,{answers:longestAnswers,assisted:false,selfChecks:[],elapsedSeconds:60},"capacity-attempt","capacity-note",new Date("2026-10-23T12:00:00Z"));
 assert(d.validateState(capacity),id+" maximum-length applications fail backup validation");
 words+=JSON.stringify(depth).split(/\s+/).length;
}
console.log(`PASS 58 individual expansions, ${checks} new checks, 58 worked cases, 116 decisions and 58 new open tasks`);
console.log("PASS quoted evidence exists, keys and variants work, models meet lengths, V2 is preserved and V3 enrichment is idempotent");
const skill=p.enrichLesson(data.curriculum.skills[0]);
const answers=Object.fromEntries(p.lessonChecks(skill).map(c=>[c.id,c.type==="choice"?c.options[c.answer]:c.type==="input"?c.accepted[0]:"A".repeat(4000)]));
const old=d.freshState();old.skills[skill.id]={status:"mastered",correct:2,total:2};
const updated=p.recordLessonPractice(old,skill,{answers,assisted:true,selfChecks:[],elapsedSeconds:300},"new-depth-attempt","new-depth-note",new Date("2026-10-23T12:00:00Z"));
assert(d.validateState(updated));assert.equal(updated.attempts[0].lessonVersion,3);assert.equal(updated.attempts[0].total,7);assert.equal(updated.learningNotes.length,2);assert.equal(new Set(updated.learningNotes.map(n=>n.id)).size,2);assert(updated.learningNotes.every(n=>n.mode==="assisted"));assert.equal(old.attempts.length,0);assert.equal(old.skills[skill.id].status,"mastered");
assert.equal(updated.attempts[0].answers.apply,answers.apply);assert.equal(updated.attempts[0].answers.stretch,answers.stretch);assert(updated.learningNotes.every(n=>n.text.includes("A".repeat(4000))));
console.log("PASS both 4000-character applications persist independently with assistance, valid backup and unchanged prior state");
