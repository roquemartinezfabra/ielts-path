import assert from "node:assert/strict";
import {readFile,writeFile,mkdir,readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";
import {DatabaseSync} from "node:sqlite";

// Transpile the actual application modules; no second implementation of the
// scheduler or persistence rules is used by these tests.
const out=resolve(".sites-runtime/cards-tests");await mkdir(out,{recursive:true});
const sourceFiles={domain:"app/lib/cards-domain.ts",csv:"app/lib/cards-csv.ts",storage:"app/lib/cards-storage.ts",route:"app/api/cards/route.ts",study:"app/lib/domain.ts",planning:"app/lib/planning.ts",legacy:"app/lib/storage.ts",mcp:"app/mcp/route.ts",attempts:"app/lib/attempts.ts",lessons:"app/lib/lesson-practice.ts",writingResources:"app/lib/writing-resources.ts",learningPlan:"app/lib/learning-plan.ts"};
for(const name of ["curriculum","reading","lesson-archive","learning-map","lesson-archive-v2","lesson-depth-grammar","lesson-depth-reading-vocab","lesson-depth-writing","foundation-word-order-v1"])await writeFile(resolve(out,name+".mjs"),"export default "+(await readFile("app/data/"+name+".json","utf8")).replace(/^\uFEFF/,""));
for(const [name,path] of Object.entries(sourceFiles)){
 let source=await readFile(path,"utf8");
 source=source.replaceAll('export {requestUser} from \"./auth\";', 'export const requestUser = request => request.headers.get(\"oai-authenticated-user-id\");').replaceAll('"../data/lesson-archive-v2.json"','"./lesson-archive-v2.mjs"').replaceAll('"../data/lesson-depth-grammar.json"','"./lesson-depth-grammar.mjs"').replaceAll('"../data/lesson-depth-reading-vocab.json"','"./lesson-depth-reading-vocab.mjs"').replaceAll('"../data/lesson-depth-writing.json"','"./lesson-depth-writing.mjs"').replaceAll('"../data/foundation-word-order-v1.json"','"./foundation-word-order-v1.mjs"').replaceAll('"./writing-resources"','"./writingResources.mjs"').replaceAll('"./learning-plan"','"./learningPlan.mjs"').replaceAll('"../lib/learning-plan"','"./learningPlan.mjs"').replaceAll('"../data/learning-map.json"','"./learning-map.mjs"').replaceAll('"./lesson-practice"','"./lessons.mjs"').replaceAll('"../lib/attempts"','"./attempts.mjs"').replaceAll('"cloudflare:workers"','"./env.mjs"').replaceAll('"./cards-domain"','"./domain.mjs"').replaceAll('"../../lib/cards-domain"','"./domain.mjs"').replaceAll('"../../lib/cards-storage"','"./storage.mjs"').replaceAll('"../../lib/storage"','"./auth.mjs"').replaceAll('"./domain"','"./study.mjs"').replaceAll('"../lib/domain"','"./study.mjs"').replaceAll('"../lib/storage"','"./legacy.mjs"').replaceAll('"../lib/cards-storage"','"./storage.mjs"').replaceAll('"../lib/planning"','"./planning.mjs"').replaceAll('"../data/curriculum.json"','"./curriculum.mjs"').replaceAll('"../data/reading.json"','"./reading.mjs"').replaceAll('"../data/lesson-archive.json"','"./lesson-archive.mjs"');
 await writeFile(resolve(out,name+".mjs"),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
await writeFile(resolve(out,"env.mjs"),'export const env = globalThis.__cardsTestEnvironment;');
await writeFile(resolve(out,"auth.mjs"),'export const requestUser = request => request.headers.get("oai-authenticated-user-id");');
const sql=new DatabaseSync(":memory:");
for(const filename of (await readdir("drizzle")).filter(name=>name.endsWith(".sql")).sort())sql.exec(await readFile("drizzle/"+filename,"utf8"));
sql.prepare("INSERT INTO learner_state(user_id,payload,revision,updated_at) VALUES(?,?,?,?)").run("alice",'{"legacy":"unchanged"}',7,"2026-10-11T00:00:00.000Z");
class Statement {
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Statement(this.query,args);}
 execute(){const result=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:Number(result.changes)}};}
 async run(){return this.execute();}
 async first(){return sql.prepare(this.query).get(...this.args)||null;}
 async all(){return {success:true,results:sql.prepare(this.query).all(...this.args)};}
}
globalThis.__cardsTestEnvironment={DB:{prepare(query){return new Statement(query);},async batch(statements){sql.exec("BEGIN");try{const values=statements.map(statement=>statement.execute());sql.exec("COMMIT");return values;}catch(error){sql.exec("ROLLBACK");throw error;}}}};
const load=name=>import(pathToFileURL(resolve(out,name+".mjs")).href);
const d=await load("domain"),csv=await load("csv"),storage=await load("storage"),api=await load("route"),study=await load("study"),planning=await load("planning"),legacy=await load("legacy"),mcp=await load("mcp");
const content=(id,extra={})=>({id,deck:"Original",category:"vocabulary",mode:"production",prompt:"Complete: We ___ a decision.",answer:"made",explanation:"make a decision",example:"We made a decision.",ipa:"",lemma:id,skillId:"",sourceUrl:"",source:"Original",...extra});
let checks=0;const test=async(name,fn)=>{await fn();checks++;process.stdout.write("PASS "+name+"\n");};
const settings=d.defaultCardSettings(),now=new Date("2026-10-11T10:00:00.000Z");
await test("FSRS learns, graduates, records a delayed lapse and rejects early repeats",()=>{
 const fresh=d.newCard(content("fsrs"),now);assert(d.validateStudyCard(fresh));
 const first=d.scheduleReview(fresh,1,settings,"e1",12,now);assert.equal(first.review.isNew,true);assert.equal(first.review.delayedRecall,false);assert.equal(first.card.schedule.due,"2026-10-11T10:10:00.000Z");
 assert.throws(()=>d.scheduleReview(first.card,3,settings,"early",12,now));
 const second=d.scheduleReview(first.card,3,settings,"e2",12,new Date(first.card.schedule.due));assert.equal(second.card.schedule.state,2);assert.equal(second.review.delayedRecall,false);
 const delayed=d.scheduleReview(second.card,1,settings,"e3",12,new Date(Math.max(Date.parse(second.card.schedule.due),now.getTime()+3*86400000)));assert(delayed.review.delayedRecall);assert.equal(delayed.review.success,false);assert.equal(delayed.card.schedule.lapses,1);assert(d.validateReview(delayed.review));
});
await test("date boundaries respect Madrid and daylight-saving changes",()=>{assert.equal(d.dayKey("2026-10-24T22:30:00.000Z","Europe/Madrid"),"2026-10-25");assert.equal(d.dayKey("2026-10-25T23:30:00.000Z","Europe/Madrid"),"2026-10-26");});
await test("daily allocations, sibling burying and overdue pauses",()=>{
 const cards=Array.from({length:30},(_,i)=>d.newCard(content("n"+i,{category:i<15?"vocabulary":i<25?"grammar":"pronunciation"}),now));
 assert.equal(d.buildCardQueue(cards,[],settings,now).length,10);
 assert.deepEqual(d.buildCardQueue(cards,[],settings,now).reduce((map,c)=>(map[c.category]++,map),{vocabulary:0,grammar:0,pronunciation:0}),{vocabulary:6,grammar:3,pronunciation:1});
 const siblings=[d.newCard(content("a",{lemma:"same"}),now),d.newCard(content("b",{lemma:"same",mode:"recognition"}),now)];assert.equal(d.buildCardQueue(siblings,[],settings,now).length,1);
 const done=d.scheduleReview(siblings[0],3,settings,"bury",5,now);assert.equal(d.buildCardQueue([done.card,siblings[1]],[done.review],settings,now).length,0);
 const lateNow=new Date(now.getTime()+5*86400000),queue=d.buildCardQueue([done.card,...cards],[done.review],settings,lateNow);assert.equal(queue.length,1);assert.equal(queue[0].id,"a");assert(d.cardSummary([done.card,...cards],[done.review],settings,lateNow).newPaused);
});
await test("budget pauses new cards but due reviews remain available",()=>{
 const first=d.scheduleReview(d.newCard(content("budget"),now),1,settings,"budget-e",600,now);const reviews=[first.review,{...first.review,id:"budget-e2",isNew:false,elapsedSeconds:600}];
 const tenLater=new Date(now.getTime()+600000);assert.equal(d.buildCardQueue([first.card,d.newCard(content("extra"),now)],reviews,settings,tenLater)[0].id,"budget");assert.equal(d.buildCardQueue([first.card,d.newCard(content("extra"),now)],reviews,settings,tenLater).length,1);
});
await test("adaptive suggestions require enough days and differentiated delayed evidence",()=>{
 const base=d.scheduleReview(d.newCard(content("measure"),new Date(now.getTime()-20*86400000)),3,settings,"measure0",10,new Date(now.getTime()-20*86400000));
 const reviews=[base.review];for(let day=0;day<14;day++)for(let n=0;n<4;n++){const time=new Date(now.getTime()-day*86400000);reviews.push({...base.review,id:`measure-${day}-${n}`,cardId:"card"+n,mode:n%2?"recognition":"production",reviewedAt:time.toISOString(),isNew:false,delayedRecall:true,elapsedSeconds:10,previousSchedule:{...base.card.schedule,last_review:new Date(time.getTime()-86400000).toISOString()}});}
 const summary=d.cardSummary([],reviews,settings,now);assert.equal(summary.suggestion.kind,"increase");assert.equal(summary.delayed.distinctCards,4);assert.equal(summary.delayed.production.total,28);assert.equal(summary.activeDays,14);assert.equal(summary.totalSeconds,570);
 const low=reviews.map((r,i)=>i%2?{...r,success:false,rating:1}:r);assert.equal(d.cardSummary([],low,settings,now).suggestion.kind,"reduce");
 assert.equal(d.cardSummary([],reviews.slice(0,20),settings,now).suggestion.kind,"collect");
});
await test("CSV BOM, quoted delimiters, multiline fields and quote escaping",async()=>{
 const parsed=csv.parseCSV('\uFEFFterm;question;answer\r\nrun;"Line one;\nLine ""two""";ran\r\n');assert.equal(parsed.delimiter,";");assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows[0][1],'Line one;\nLine "two"');
 const preview=await csv.previewCSV(parsed,{prompt:"question",answer:"answer",lemma:"term"},{deck:"CSV",category:"vocabulary",mode:"production"});assert.equal(preview.cards.length,1);assert(d.validateCardContent(preview.cards[0]));assert(csv.parseCSV('a,b\n"unclosed,b').errors.length);
});
await test("CSV identity survives answer edits, distinguishes senses and directions, and blocks ambiguous duplicates",async()=>{
 const defaults={deck:"CSV",category:"vocabulary",mode:"production"};
 const first=await csv.previewCSV(csv.parseCSV("key,question,answer,lemma\n1,q,a,word\n2,q2,b,word"),{id:"key",prompt:"question",answer:"answer",lemma:"lemma"},defaults);assert.equal(first.cards.length,2);assert.notEqual(first.cards[0].id,first.cards[1].id);
 const edited=await csv.previewCSV(csv.parseCSV("key,question,answer\n1,edited,edited answer"),{id:"key",prompt:"question",answer:"answer"},defaults);assert.equal(first.cards[0].id,edited.cards[0].id);
 const recognized=await csv.previewCSV(csv.parseCSV("key,question,answer\n1,q,a"),{id:"key",prompt:"question",answer:"answer"},{...defaults,mode:"recognition"});assert.notEqual(first.cards[0].id,recognized.cards[0].id);
 const conflict=await csv.previewCSV(csv.parseCSV("q,a\nsame,one\nsame,two"),{prompt:"q",answer:"a"},defaults);assert.equal(conflict.cards.length,0);assert.equal(conflict.errors.length,1);
 const senses=await csv.previewCSV(csv.parseCSV("q,a,lemma\nq1,a,word\nq2,b,word"),{prompt:"q",answer:"a",lemma:"lemma"},defaults);assert.equal(senses.cards.length,2);
});
await test("settings updates use revision checks and are isolated by user",async()=>{assert.equal((await storage.saveCardSettings("alice",settings,0)).revision,1);assert.equal((await storage.saveCardSettings("alice",{...settings,budgetMinutes:25},1)).revision,2);await assert.rejects(()=>storage.saveCardSettings("alice",settings,0));assert.equal((await storage.readCardSettings("bob")).revision,0);});
await test("review retries are idempotent, concurrent stale writes fail, and imports retain schedules",async()=>{
 await storage.upsertCardContents("alice",[content("persist")]);const start=(await storage.readCardsOverview("alice")).queue[0],input={cardId:start.id,revision:start.revision,eventId:"persist-event",rating:3,elapsedSeconds:20};
 const saved=await storage.reviewCard("alice",input);assert.equal(saved.duplicate,false);assert.equal((await storage.reviewCard("alice",input)).duplicate,true);await assert.rejects(()=>storage.reviewCard("alice",{...input,eventId:"stale-event"}));
 await storage.upsertCardContents("alice",[content("persist",{answer:"updated"})]);const after=(await storage.readCards("alice"))[0];assert.deepEqual(after.schedule,saved.card.schedule);assert.equal(after.answer,"updated");assert.equal((await storage.readCardReviews("alice")).length,1);assert.equal((await storage.readCards("bob")).length,0);
 await assert.rejects(()=>storage.upsertCardContents("alice",[content("persist",{mode:"recognition"}),content("must-not-insert")]));assert.equal((await storage.readCards("alice")).length,1);
});
await test("5000-card library remains paginated and backup merge keeps newer data and deduplicates history",async()=>{
 const cards=Array.from({length:5000},(_,i)=>content("bulk"+String(i).padStart(4,"0")));for(let i=0;i<cards.length;i+=50)await storage.upsertCardContents("bulk-user",cards.slice(i,i+50));
 const page=await storage.readCardLibrary("bulk-user",{q:"",category:"",offset:4975,limit:30});assert.equal(page.total,5000);assert.equal(page.cards.length,25);assert.equal((await storage.readCardsOverview("bulk-user")).queue.length,6);
 const backup=await storage.readCardBackup("alice");assert(d.validateCardBackup(backup));await storage.restoreCardBackup("bob",backup,0);assert.equal((await storage.readCards("bob")).length,1);await storage.restoreCardBackup("bob",backup,1);assert.equal((await storage.readCardReviews("bob")).length,1);
 await storage.upsertCardContents("bob",[content("extra")]);await storage.restoreCardBackup("bob",backup,2);assert.equal((await storage.readCards("bob")).length,2);
});
await test("invalid backups and unauthorized/cross-origin requests cannot mutate data",async()=>{
 const backup=await storage.readCardBackup("alice");const bad=structuredClone(backup);bad.cards[0].schedule.due="yesterday";assert.equal(d.validateCardBackup(bad),false);
 assert.equal((await api.GET(new Request("https://site.test/api/cards"))).status,401);
 const send=(body,origin="https://site.test")=>api.POST(new Request("https://site.test/api/cards",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin,"oai-authenticated-user-id":"alice"},body:JSON.stringify(body)}));
 assert.equal((await send({action:"restore",backup:bad,revision:2})).status,400);assert.equal((await send({action:"import",cards:[content("csrf")]},"https://foreign.test")).status,403);assert.equal((await storage.readCards("alice")).length,1);
 assert.equal(sql.prepare("SELECT payload FROM learner_state WHERE user_id='alice'").get().payload,'{"legacy":"unchanged"}');assert.equal(sql.prepare("SELECT revision FROM learner_state WHERE user_id='alice'").get().revision,7);
});
await test("legacy backups remain valid and optional learning notes reject null or double-counted minutes",()=>{
 const state=study.freshState();assert(study.validateState(state));assert.equal(study.validateState({...state,learningNotes:[null]}),false);
 const note={id:"grammar-note",date:now.toISOString(),kind:"grammar",title:"Word order",text:"I usually read in the evening.",mode:"independent",resourceId:"g-word-order"};assert(study.validateLearningNote(note));assert.equal(study.validateLearningNote({...note,minutes:5}),false);
 const reading={id:"reading-note",date:now.toISOString(),kind:"reading",title:"A new library",text:"The town opened a library with free courses.",mode:"independent",minutes:12,difficulty:"suitable",url:"https://example.org"};assert(study.validateLearningNote(reading));state.learningNotes=[note,reading];assert(study.validateState(state));assert.equal(study.extensiveReadingMinutes(state),12);assert(study.reportMarkdown(state,{totalSeconds:180,totalReviews:8}).includes("12 minutos declarados"));
});
await test("weekly planning includes the chosen card budget once and retains the extensive-reading block",async()=>{
 const state=study.freshState(),engine=await load("learningPlan"),twenty={selectedBudget:engine.weeklyBudgets(20)[0]},ten={selectedBudget:engine.weeklyBudgets(10)[0]};assert.equal(twenty.selectedBudget.totalMinutes,540);assert.equal(twenty.selectedBudget.existingCardsMinutes,140);assert.equal(twenty.selectedBudget.readingWritingMinutes,400);assert.equal(ten.selectedBudget.readingWritingMinutes,470);assert.equal(twenty.selectedBudget.blocks.reduce((sum,block)=>sum+block.minutes,0),400);
});
await test("MCP feedback preserves original production and exposes distinct card and reading time",async()=>{
 const state=study.freshState();state.learningNotes=[{id:"mcp-note",date:now.toISOString(),kind:"grammar",title:"Word order",text:"I read often books.",mode:"independent",resourceId:"g-word-order"}];await legacy.writeState("learner",state,0);
 const call=async(name,args={})=>{const response=await mcp.POST(new Request("https://site.test/mcp",{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://site.test","oai-authenticated-user-id":"learner"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})}));const rpc=await response.json();assert.equal(rpc.result.isError,false);return JSON.parse(rpc.result.content[0].text);};
 await call("save_learning_feedback",{noteId:"mcp-note",feedback:"I often read books. Place the frequency adverb before the main verb."});const saved=await legacy.readState("learner");assert.equal(saved.state.learningNotes[0].text,"I read often books.");assert(saved.state.learningNotes[0].review.feedback.startsWith("I often"));assert.equal((await call("get_learning_notes",{pendingOnly:true})).length,0);
 const summary=await call("get_learning_summary");assert.equal(summary.time.cardSeconds,0);assert.equal(summary.time.extensiveReadingMinutes,0);assert.equal(summary.cards.settings.budgetMinutes,20);assert.equal(summary.recentLearningNotes[0].id,"mcp-note");
});
const attemptsModule=await load("attempts");
const readingSource=JSON.parse(await readFile("app/data/reading.json","utf8")).tests[0];
const writingTask=JSON.parse(await readFile("app/data/curriculum.json","utf8")).writingTasks[0];
const callAttemptTool=async(name,args={},user="attempt-owner")=>{
 const headers={"Content-Type":"application/json","Origin":"https://site.test"};if(user)headers["oai-authenticated-user-id"]=user;
 const response=await mcp.POST(new Request("https://site.test/mcp",{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})}));
 const result=(await response.json()).result;return {error:result.isError,value:result.isError?result.content[0].text:JSON.parse(result.content[0].text)};
};
await test("online attempts return original answers, full passages, criteria and newest-first pagination",async()=>{
 const state=study.freshState();state.attempts=[
  {id:"reading-first",type:"reading",resourceId:"reading:"+readingSource.id,title:readingSource.title,date:now.toISOString(),mode:"exam",elapsedSeconds:300,answers:{"1":readingSource.questions[0].answer,"2":"wrong"},score:1,total:40,completed:true},
  {id:"writing-second",type:"writing",resourceId:writingTask.id,title:writingTask.title,date:"2026-10-12T10:00:00.000Z",mode:"practice",elapsedSeconds:180,taskTexts:{[writingTask.id]:"Dear Sir, I am writing about the course."},completed:true}
 ];assert(study.validateState(state));await legacy.writeState("attempt-owner",state,0);
 const list=await callAttemptTool("list_attempts",{limit:1});assert.equal(list.error,false);assert.equal(list.value.total,2);assert.equal(list.value.attempts[0].id,"writing-second");assert.equal(list.value.nextOffset,1);
 const reading=await callAttemptTool("get_reading_attempt",{attemptId:"reading-first"});assert.equal(reading.error,false);assert.equal(reading.value.attempt.answers["2"],"wrong");assert.equal(reading.value.questions.length,40);assert.equal(reading.value.analysis.recalculatedScore,1);assert.equal(reading.value.test.sections.length,3);assert.equal(reading.value.questions[0].evidence,readingSource.questions[0].evidence);
 const summary=await callAttemptTool("get_learning_summary");assert.equal(summary.value.latestReadingAttempt.attempt.id,"reading-first");assert.equal(summary.value.latestReadingAttempt.questions.length,40);
 const subset=await callAttemptTool("get_reading_attempt",{attemptId:"reading-first",includePassages:false,questionIds:["2"]});assert.equal(subset.value.questions.length,1);assert.equal(subset.value.test.sections,undefined);assert.equal(subset.value.analysis.total,40);
 const writing=await callAttemptTool("get_attempt",{attemptId:"writing-second"});assert.equal(writing.value.attempt.taskTexts[writingTask.id],state.attempts[1].taskTexts[writingTask.id]);assert.equal(writing.value.tasks[0].prompt,writingTask.prompt);
});
await test("attempt queries are user scoped, authenticated and reject invalid filters",async()=>{
 assert.equal((await callAttemptTool("list_attempts",{},"stranger")).value.total,0);
 assert.equal((await callAttemptTool("get_attempt",{attemptId:"reading-first"},"stranger")).error,true);
 assert.equal((await callAttemptTool("get_reading_attempt",{attemptId:"reading-first"},null)).error,true);
 assert.equal((await callAttemptTool("list_attempts",{limit:-1})).error,true);
 assert.equal((await callAttemptTool("get_reading_attempt",{attemptId:"reading-first",questionIds:["999"]})).error,true);
});
await test("Reading feedback persists without rewriting the attempt and rejects unknown question IDs",async()=>{
 const before=await legacy.readState("attempt-owner");const original=structuredClone(before.state.attempts[0]);
 const feedback={summary:"Review the membership information.",priorities:["Find direct evidence before choosing."],observations:[{questionId:"2",feedback:"Copy the number from the fee notice."}]};
 assert.equal((await callAttemptTool("save_reading_feedback",{attemptId:"reading-first",feedback})).error,false);
 const after=await legacy.readState("attempt-owner"),saved=after.state.attempts[0];assert.deepEqual(saved.answers,original.answers);assert.equal(saved.score,original.score);assert.equal(saved.elapsedSeconds,original.elapsedSeconds);assert.equal(saved.readingFeedback.summary,feedback.summary);assert(study.validateState(after.state));
 assert.equal((await callAttemptTool("save_reading_feedback",{attemptId:"reading-first",feedback:{...feedback,observations:[{questionId:"999",feedback:"invalid"}]}})).error,true);
 assert.deepEqual((await legacy.readState("attempt-owner")).state,after.state);
});
await test("explicit draft pause excludes time away, downgrade preserves conditions, discard preserves results",()=>{
 const nowMs=now.getTime(),draft={resourceId:"reading:"+readingSource.id,texts:{"1":"B"},mode:"exam",startedAt:nowMs};
 const paused=attemptsModule.pausedDraft(draft,nowMs+120000);assert.equal(paused.elapsedSeconds,120);assert.equal(paused.mode,"practice");
 const resumed=attemptsModule.resumedDraft(paused,nowMs+86400000);assert.equal(attemptsModule.sessionElapsed(resumed,nowMs+86415000),135);assert.equal(resumed.texts["1"],"B");
 const state=study.freshState();state.drafts.active=paused;assert(study.validateState(state));const discarded=attemptsModule.withoutActiveDraft(state);assert.deepEqual(discarded.drafts,{});assert.deepEqual(discarded.attempts,state.attempts);assert.equal(state.drafts.active,paused);
 const legacyDraft={...draft,mode:"exam"};assert.equal(attemptsModule.resumedDraft(legacyDraft,nowMs+90000).elapsedSeconds,90);
 assert.equal(attemptsModule.pausedDraft({...draft,mode:"revision"},nowMs+1000).mode,"revision");
});
await test("learning-plan backups retain originals and qualitative controls while official results require real bands",()=>{
 const original=study.freshState();original.attempts=[{id:"kept-original",type:"reading",resourceId:"reading:"+readingSource.id,title:readingSource.title,date:now.toISOString(),mode:"exam",elapsedSeconds:60,answers:{},score:0,total:40,completed:true}];
 const next=structuredClone(original);next.learningPlan={scenario:"recommended_12h",activatedAt:now.toISOString(),objectives:[{id:"focus-1",skillId:"g-word-order",createdAt:now.toISOString(),status:"active"}],reviews:[{id:"cycle-1",date:now.toISOString(),decision:"method",note:"Use contextual feedback, then a new task."}],evidence:[]};
 next.resourceExposures=[{resourceId:"reading:"+readingSource.id,date:now.toISOString(),reason:"opened"}];next.external=[{id:"qualitative-control",date:now.toISOString(),skill:"speaking",source:"Tutor",feedback:"Develop the example before concluding.",conditions:"New prompt; no model.",nextObjective:"Develop a two-minute response."}];
 assert(study.validateState(next));assert.deepEqual(next.attempts,original.attempts);assert.equal(next.profile.weeklyHours,9);assert.equal(study.validateState({...next,external:[{...next.external[0],feedback:""}]}),false);
 assert.equal(study.validateState({...next,official:{date:"2026-10-11",source:"IELTS",listening:7.5,reading:7.5,writing:7.5}}),false);
 assert.equal(study.validateState({...next,learningPlan:{...next.learningPlan,scenario:"automatic-25h"}}),false);assert.equal(study.validateState({...next,learningPlan:{...next.learningPlan,evidence:[null]}}),false);
});
await test("new Writing pairs use unexposed prompts and remain valid through pause, save and tutor lookup",async()=>{
 const resources=await load("writingResources"),state=study.freshState(),pair=resources.nextWritingPair(state),tasks=resources.writingTasksForResource(pair);assert.equal(tasks.length,2);assert.equal(tasks[0].type,"task1");assert.equal(tasks[1].type,"task2");
 state.resourceExposures=[{resourceId:tasks[0].id,date:now.toISOString(),reason:"opened"}];assert.notEqual(resources.nextWritingPair(state),pair);assert.equal(resources.resourceExposure(state,pair),"seen");
 state.attempts=[{id:"paired-writing",type:"writing",resourceId:pair,title:"Paired Writing",date:now.toISOString(),mode:"exam",elapsedSeconds:3600,completed:true,conditions:{exposure:"unseen",assistance:"none",timing:"continuous"},taskTexts:{[tasks[0].id]:"Dear Sir, I am writing about the course.",[tasks[1].id]:"Some people prefer studying online. I believe access matters."}}];assert(study.validateState(state));
 const draft={resourceId:pair,texts:state.attempts[0].taskTexts,startedAt:now.getTime(),mode:"exam",conditions:state.attempts[0].conditions};const paused=attemptsModule.pausedDraft(draft,now.getTime()+1000);assert.equal(paused.conditions.timing,"resumed");assert.equal(paused.conditions.assistance,"allowed");state.drafts.active=paused;assert(study.validateState(state));
 await legacy.writeState("pair-owner",state,0);const result=await callAttemptTool("get_attempt",{attemptId:"paired-writing"},"pair-owner");assert.equal(result.error,false);assert.equal(result.value.tasks.length,2);assert.equal(result.value.attempt.conditions.exposure,"unseen");
 assert.equal(resources.writingTasksForResource("writing-pair:missing:missing").length,0);
 const plan=await callAttemptTool("get_learning_plan",{},"pair-owner");assert.equal(plan.error,false);assert.equal(plan.value.profile.examDate,"2027-01-15");assert.equal(plan.value.overview.activated,false);
});
sql.close();process.stdout.write(`Completed ${checks} meaningful card, learning and attempt checks.\n`);
