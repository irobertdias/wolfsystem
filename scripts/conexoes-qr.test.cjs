const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/chatbot/_sections/ConexoesSection.tsx','utf8');
function montar(nome,proximo,respostas){
 const calls=[],updates=[];const setters=['setQrPolling','setQrCanalId','setResetando','setShowModalQR','setQrImageUrl','setQrConectado','setQrNumero','setQrTentativas','setQrRecuperarAusentes','setQrRecuperacaoHoras','setShowMenuEngrenagem'];
 const ctx={conexoes:[{id:134,workspace_id:'ws'}],wa:async(rota,body)=>{calls.push([rota,body]);return respostas.shift();},fetchConexoes:async()=>{},notify(){},traduzirErro:String,confirm:()=>true,recuperacaoQrIniciadaRef:{current:null},supabase:{from(){throw Error('frontend nao deve sobrescrever status conectado');}}};
 for(const setter of setters)ctx[setter]=v=>updates.push([setter,v]);
 const a=source.indexOf('  const '+nome+' ='),b=source.indexOf('  const '+proximo+' =',a);
 assert.ok(a>=0&&b>a);
 vm.runInNewContext(ts.transpileModule(source.slice(a,b)+'\napi = '+nome+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 return {run:ctx.api,calls,updates};
}
test('abrir QR reaproveita imagem existente e nao reseta login',async()=>{
 const app=montar('abrirQR','reconectarCanal',[{success:true,qr:'qr-pronto'}]);await app.run(134);
 assert.deepEqual(app.calls.map(c=>c[0]),['iniciar-qr']);
 assert.ok(app.updates.some(([k,v])=>k==='setQrImageUrl'&&v==='qr-pronto'));
 assert.ok(app.updates.some(([k,v])=>k==='setQrPolling'&&v===true));
});
test('backend anterior usa reconectar sem apagar sessao, apenas em 404',async()=>{
 const app=montar('abrirQR','reconectarCanal',[{success:false,upstreamStatus:404},{success:true}]);await app.run(134);
 assert.deepEqual(app.calls.map(c=>c[0]),['iniciar-qr','reconectar']);
});
test('recusa de acesso nao dispara reconexao alternativa',async()=>{
 const app=montar('abrirQR','reconectarCanal',[{success:false,upstreamStatus:403,error:'negado'}]);await app.run(134);
 assert.deepEqual(app.calls.map(c=>c[0]),['iniciar-qr']);
});
test('reconectar canal conectado nao escreve desconectado no banco',async()=>{
 const app=montar('reconectarCanal','dataParaInputLocal',[{success:true,conectado:true}]);await app.run({id:134,workspace_id:'ws',nome:'MEL'});
 assert.deepEqual(app.calls.map(c=>c[0]),['reconectar']);
});
