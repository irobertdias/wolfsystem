import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso } from '../../_auth';
import { consultarVero, type RedeVero } from '../../../lib/vero';
export function tokenVero(tipo='viabilidade') {
  const segredo=process.env.WOLF_VIABILIDADE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!segredo)throw Object.assign(Error('Integração Vero não configurada.'),{statusCode:503});
  return createHmac('sha256',segredo).update(`wolf:${tipo}:grupoprime:vero:v1`).digest('hex');
}
export async function consultar(request:NextRequest,rede?:RedeVero) {
  try {
    const token=request.headers.get('x-wolf-viabilidade-token');
    if(token!==null){if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(tokenVero())))throw Object.assign(Error('Credencial de consulta inválida.'),{statusCode:401});}
    else {const a=await autenticarWorkspace(request,'grupoprime');exigirPermissao(a,'chat_proprio','chat_todos','proposta_criar');}
    return NextResponse.json(await consultarVero(request.nextUrl.searchParams.get('cep'),rede),{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){const r=respostaErroAcesso(e);return NextResponse.json({success:false,error:r.status===500?'Falha na consulta Vero.':r.message},{status:r.status,headers:{'Cache-Control':'private, no-store'}});}
}
