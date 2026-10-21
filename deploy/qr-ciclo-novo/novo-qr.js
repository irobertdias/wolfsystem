'use strict';
function criarNovoQr(ctx, deps) {
 const {comPrazoInicio,encerrarClienteWebjs,liberarPerfilWebjs}=deps;
 return async function novoQr(req,res) {
  const {canalId,workspaceId}=req.body||{};
  if(!/^\d+$/.test(String(canalId||''))||!workspaceId)return res.status(400).json({success:false,error:'Canal e workspace obrigatórios'});
  const acesso=await ctx.validarCanalDoWorkspace(canalId,workspaceId);
  if(!acesso.ok)return res.status(403).json({success:false,error:acesso.motivo});
  const chave=String(canalId);
  if(ctx.operacoesWebjsEmAndamento.has(chave))return res.status(409).json({success:false,error:'O navegador deste canal já está sendo recriado. Aguarde.'});
  const anterior=ctx.sessoes[canalId];
  if(anterior?.qrNovoSolicitado&&anterior.status==='inicializando'&&!anterior.substituida)return res.status(202).json({success:true,status:'inicializando'});
  ctx.operacoesWebjsEmAndamento.add(chave);
  try {
   const config=await comPrazoInicio(ctx.getConfigCanal(canalId),5000,'configuração do canal');
   if(!config||config.tipo!=='webjs')return res.status(400).json({success:false,error:'Canal WhatsApp Web não encontrado'});
   if(ctx.sessoes[canalId]!==anterior)throw Error('A sessão mudou durante a operação; tente novamente.');
   if(anterior){anterior.substituida=true;anterior.encerrando=true;anterior.qrCode=null;}
   ctx.canaisQrSobDemanda ||= new Set();ctx.canaisQrSobDemanda.add(chave);
   // Primeiro fecha o Client; depois aguarda initialize(), inclusive launch atrasado.
   await encerrarClienteWebjs(anterior?.client);
   if(anterior?.inicializacaoPromise)await comPrazoInicio(Promise.resolve(anterior.inicializacaoPromise).catch(()=>{}),20000,'encerramento da inicialização anterior');
   // initialize() pode ter criado um browser depois da primeira chamada a destroy().
   await encerrarClienteWebjs(anterior?.client);
   await liberarPerfilWebjs(canalId);
   if(ctx.sessoes[canalId]!==anterior)throw Error('A sessão foi substituída; novo navegador não iniciado.');
   const auth=ctx.path.resolve(ctx.ROOT_DIR,'.wwebjs_auth'),perfil=ctx.path.resolve(auth,'session-canal_'+canalId);
   if(ctx.path.dirname(perfil)!==auth)throw Error('Perfil fora do canal solicitado');
   ctx.limparLocksSessaoWebjs(canalId,'novo-qr');
   ctx.apagarPastaSeExistir(perfil);
   delete ctx.sessoes[canalId];
   await ctx.atualizarStatusCanal(canalId,'desconectado','');
   const nova=ctx.criarSessaoWebjs({...config,inicioAutomatico:false});
   if(!nova)throw Error('Não foi possível iniciar o navegador');
   nova.qrSolicitado=true;nova.qrNovoSolicitado=true;nova.ultimoPedidoQr=Date.now();
   console.log('[QR novo] Canal '+canalId+': navegador anterior encerrado; nova sessão solicitada');
   return res.status(202).json({success:true,status:nova.status||'inicializando',qr_novo:true});
  }catch(e){return res.status(503).json({success:false,error:e.message});}
  finally{ctx.operacoesWebjsEmAndamento.delete(chave);}
 };
}
module.exports={criarNovoQr};
