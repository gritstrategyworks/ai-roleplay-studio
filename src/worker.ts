// @ts-ignore Plain JavaScript module shared with Node unit tests.
import { onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/roleplay.js';

interface Env { AI?: Ai; ASSETS: Fetcher }
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const MODEL_LIBS:Record<string,string>={
  'Qwen3-0.6B-q4f32_1-MLC':'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3-0.6B-q4f32_1_cs1k-webgpu.wasm',
  'Qwen3-1.7B-q4f32_1-MLC':'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3-1.7B-q4f32_1_cs1k-webgpu.wasm',
  'Qwen3-4B-q4f32_1-MLC':'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3-4B-q4f32_1_cs1k-webgpu.wasm',
};

async function proxyLocalModel(request:Request,url:URL):Promise<Response>{
  if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
  const parts=url.pathname.split('/').filter(Boolean);
  const kind=parts[2];
  const modelId=decodeURIComponent(parts[3]||'');
  if(!Object.hasOwn(MODEL_LIBS,modelId))return json({error:'Model not allowed.'},404);
  let target:string;
  if(kind==='model'){
    const relative=decodeURIComponent(parts.slice(4).join('/'));
    if(!relative.startsWith('resolve/main/')||relative.includes('..')||!/^[A-Za-z0-9._/-]+$/.test(relative))return json({error:'Invalid model path.'},400);
    target=`https://huggingface.co/mlc-ai/${encodeURIComponent(modelId)}/${relative}`;
  }else if(kind==='lib'&&parts.length===4){target=MODEL_LIBS[modelId]}
  else return json({error:'Not found.'},404);
  const upstreamHeaders=new Headers();
  for(const name of ['range','if-none-match','if-modified-since']){const value=request.headers.get(name);if(value)upstreamHeaders.set(name,value)}
  let upstream:Response;
  try{upstream=await fetch(target,{method:request.method,headers:upstreamHeaders,redirect:'follow'})}
  catch{return json({error:'Model source unavailable.'},502)}
  const headers=new Headers({'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'});
  for(const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){const value=upstream.headers.get(name);if(value)headers.set(name,value)}
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
}

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(url.pathname.startsWith('/api/local-model/'))return proxyLocalModel(request,url);
  if(url.pathname==='/api/health')return request.method==='GET'?json({ok:true,service:'AI Roleplay Studio',aiConfigured:Boolean(env.AI)}):json({error:'Method not allowed.'},405);
  if(url.pathname==='/api/roleplay'||url.pathname==='/api/analyze'){
    const context:{request:Request,env:Env}={request,env};
    if(request.method==='OPTIONS')return onRequestOptions(context);
    if(request.method==='GET')return onRequestGet(context);
    if(request.method==='POST'){
      if(url.pathname==='/api/analyze'){
        const payload=await request.json() as Record<string,unknown>;
        context.request=new Request(request,{body:JSON.stringify({...payload,action:'evaluate'})});
      }
      return onRequestPost(context);
    }
    return json({error:'Method not allowed.'},405);
  }
  return json({error:'Not found.'},404);
}} satisfies ExportedHandler<Env>;