import {NextRequest,NextResponse} from 'next/server';
import {autenticarWorkspace,exigirPermissao,exigirModulo,respostaErroAcesso} from '../../_auth';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const responder=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 try{
  const acesso=await autenticarWorkspace(req,new URL(req.url).searchParams.get('workspaceId')||'');
  try{exigirPermissao(acesso,'voip_usar','voip_conexoes');await exigirModulo(acesso,'modulo_voip');}
  catch(e){const erro=respostaErroAcesso(e);if(erro.status===403)return responder({permitido:false});throw e;}
  return responder({permitido:true});
 }catch(e){const erro=respostaErroAcesso(e);return responder({permitido:false,error:erro.message},erro.status);}
}
