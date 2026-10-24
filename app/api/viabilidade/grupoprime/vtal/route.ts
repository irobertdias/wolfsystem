import { NextRequest, NextResponse } from 'next/server';
import { autenticarConsulta } from '../_auth';
import { respostaErroAcesso, segredoInternoWolf } from '../../../_auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:NextRequest){
 try{
  await autenticarConsulta(req);
  const p=new URLSearchParams({workspaceId:'grupoprime'});
  for(const k of ['cep','cidade','uf','logradouro','quadra','lote','numero','casa','apartamento','bloco','texto']){const v=req.nextUrl.searchParams.get(k);if(v&&v.length>500)return NextResponse.json({success:false,error:'Consulta muito longa.'},{status:400});if(v)p.set(k,v);}
  const health=req.nextUrl.searchParams.get('health')==='1';
  const base=process.env.WHATSAPP_URL||process.env.NEXT_PUBLIC_WHATSAPP_URL||'https://api.wolfgyn.com.br';
  const r=await fetch(`${base}/universal/${health?'health':'vtal?'+p}`,{headers:{'x-wolf-internal-secret':segredoInternoWolf()},signal:AbortSignal.timeout(health?5000:55000),cache:'no-store'});
  if(!r.ok)return NextResponse.json({success:false,error:'Serviço de consulta temporariamente indisponível.'},{status:503});
  return NextResponse.json(await r.json(),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const {status,message}=respostaErroAcesso(e);return NextResponse.json({success:false,error:status===500?'Consulta temporariamente indisponível.':message},{status,headers:{'Cache-Control':'private, no-store'}});}
}
