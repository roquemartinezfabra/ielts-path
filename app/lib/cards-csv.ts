import {validateCardContent,type CardContent,type CardCategory,type CardMode} from "./cards-domain";

export type CSVDelimiter=","|";"|"\t";
export type ParsedCSV={headers:string[];rows:string[][];delimiter:CSVDelimiter;errors:string[]};
export type CardCSVMapping=Partial<Record<keyof CardContent,string>>;
export type CardCSVDefaults={deck:string;category:CardCategory;mode:CardMode;source?:string};
const normalize=(s:string)=>s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
function detectDelimiter(text:string):CSVDelimiter {
 const counts:{[K in CSVDelimiter]:number}={",":0,";":0,"\t":0};let quoted=false;
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted && text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted){if(char==='\n'||char==='\r')break;if(char in counts)counts[char as CSVDelimiter]++;}}
 return ([",",";","\t"] as CSVDelimiter[]).sort((a,b)=>counts[b]-counts[a])[0];
}
export function parseCSV(input:string,delimiter?:CSVDelimiter):ParsedCSV {
 const data=input.replace(/^\uFEFF/,""),separator=delimiter||detectDelimiter(data),errors:string[]=[],records:string[][]=[];
 let row:string[]=[],cell="",quoted=false,closed=false,line=1;
 const commitCell=()=>{row.push(cell);cell="";closed=false;};
 const commitRow=()=>{commitCell();if(row.some(value=>value.length>0))records.push(row);row=[];};
 for(let i=0;i<data.length;i++){
  const char=data[i];
  if(quoted){if(char==='"'){if(data[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=char;if(char==='\n')line++;}continue;}
  if(char===separator){commitCell();continue;}
  if(char==='\r'||char==='\n'){if(char==='\r'&&data[i+1]==='\n')i++;commitRow();line++;continue;}
  if(char==='"'){if(cell.length===0 && !closed){quoted=true;}else{errors.push(`Línea ${line}: comillas inesperadas.`);cell+=char;}continue;}
  if(closed && char.trim()){errors.push(`Línea ${line}: texto después de cerrar una celda entre comillas.`);closed=false;}cell+=char;
 }
 if(quoted)errors.push(`Línea ${line}: falta cerrar una celda entre comillas.`);
 if(cell.length||row.length||closed)commitRow();
 if(!records.length)return {headers:[],rows:[],delimiter:separator,errors:[...errors,"El archivo está vacío."]};
 const headers=records.shift()!.map(header=>header.trim());
 if(headers.some(header=>!header))errors.push("Todas las columnas deben tener un encabezado.");
 if(new Set(headers.map(normalize)).size!==headers.length)errors.push("Hay encabezados repetidos; cambia sus nombres antes de importar.");
 for(let i=0;i<records.length;i++)if(records[i].length!==headers.length)errors.push(`Fila ${i+2}: ${records[i].length} celdas; se esperaban ${headers.length}.`);
 if(records.length>20000)errors.push("El archivo supera el límite de 20.000 tarjetas por importación.");
 return {headers,rows:records,delimiter:separator,errors:[...new Set(errors)].slice(0,100)};
}
async function hash(value:string):Promise<string> {const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}
export async function previewCSV(parsed:ParsedCSV,mapping:CardCSVMapping,defaults:CardCSVDefaults):Promise<{cards:CardContent[];errors:{row:number;message:string}[];duplicates:number;validRows:number}> {
 const errors:{row:number;message:string}[]=parsed.errors.map(message=>({row:0,message})),cards:CardContent[]=[],seen=new Map<string,CardContent>();let duplicates=0;
 if(errors.length)return {cards,errors,duplicates,validRows:0};
 if(!mapping.prompt || !mapping.answer) return {cards,errors:[{row:0,message:"Asigna las columnas de pregunta y respuesta."}],duplicates,validRows:0};
 const indices=new Map(Object.entries(mapping).filter(([,header])=>header).map(([field,header])=>[field,parsed.headers.indexOf(header!)]));
 if([...indices.values()].some(index=>index<0))return {cards,errors:[{row:0,message:"Una columna asignada no existe en este archivo."}],duplicates,validRows:0};
 for(let i=0;i<parsed.rows.length;i++){
  const values=parsed.rows[i],get=(field:keyof CardContent,fallback="")=>indices.has(field)?(values[indices.get(field)!]||"").trim():fallback;
  const card:CardContent={id:"pending",deck:get("deck",defaults.deck),category:get("category",defaults.category) as CardCategory,mode:get("mode",defaults.mode) as CardMode,prompt:get("prompt"),answer:get("answer"),explanation:get("explanation"),example:get("example"),ipa:get("ipa"),lemma:get("lemma"),skillId:get("skillId"),sourceUrl:get("sourceUrl"),source:get("source",defaults.source||"Importación personal")};
  if(get("audioUrl"))card.audioUrl=get("audioUrl");if(get("audioLicense"))card.audioLicense=get("audioLicense");
  // Explicit source IDs survive wording edits. Without one, prompt is the identity;
  // lemma alone would incorrectly merge different senses of the same word.
  card.id="csv_"+await hash(JSON.stringify([normalize(card.deck),card.category,card.mode,get("id")?"id:"+get("id"):"prompt:"+normalize(card.prompt)]));
  if(!validateCardContent(card)){errors.push({row:i+2,message:"Faltan pregunta/respuesta, hay un valor inválido o un texto/URL supera el límite. Las categorías admitidas son vocabulary, grammar y pronunciation; los modos son production y recognition."});continue;}
  const existing=seen.get(card.id);
  if(existing){duplicates++;if(JSON.stringify(existing)!==JSON.stringify(card))errors.push({row:i+2,message:"La misma identidad aparece con contenido diferente. Asigna un identificador único por sentido o corrige el duplicado."});continue;}
  seen.set(card.id,card);cards.push(card);
 }
 return {cards:errors.length?[]:cards,errors,duplicates,validRows:cards.length};
}
