import { env } from "cloudflare:workers";
import { freshState, StudyState } from "./domain";
export async function readState(userId:string):Promise<{state:StudyState;revision:number}> {
 const row=await env.DB!.prepare("SELECT payload, revision FROM learner_state WHERE user_id = ?").bind(userId).first<{payload:string;revision:number}>();
 return row?{state:JSON.parse(row.payload),revision:row.revision}:{state:freshState(),revision:0};
}
export async function writeState(userId:string,state:StudyState,revision:number) {
 const result=await env.DB!.prepare("INSERT INTO learner_state (user_id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload, revision=learner_state.revision+1, updated_at=excluded.updated_at WHERE learner_state.revision=?")
 .bind(userId,JSON.stringify(state),new Date().toISOString(),revision).run();
 return result.meta.changes===1?revision+1:null;
}
export {requestUser} from "./auth";

