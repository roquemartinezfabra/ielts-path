import {readFile} from "node:fs/promises";
const config=JSON.parse(await readFile(new URL("../wrangler.json",import.meta.url),"utf8"));
const id=config.d1_databases?.find(x=>x.binding==="DB")?.database_id;
if(!id||id==="00000000-0000-4000-8000-000000000000")throw new Error("Configura tu database_id real en wrangler.json. Lee docs/GUIA-INSTALACION.md antes de publicar.");
if(config.vars?.APP_ORIGIN&&!/^https:\/\/[^/]+$/.test(config.vars.APP_ORIGIN))throw new Error("APP_ORIGIN debe ser un origen HTTPS sin ruta.");
console.log("Independent deployment configuration checked.");
