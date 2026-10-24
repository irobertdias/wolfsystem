const {test}=require('node:test'),a=require('node:assert/strict');
const criar=require('./pos-venda.cjs'),{lerRetorno,prepararAcoes}=criar;
test('retornos reconhecem pendente de instalação e agenda com data válida',()=>{
 a.equal(lerRetorno('PENDENTE DE INSTALAÇÃO','GERADA').status,'AGUARDANDO INSTALAÇÃO');
 a.deepEqual(lerRetorno('DATA: 27/10/2026\nPERIODO: tarde','GERADA'),{status:'GERADA',data_agendamento:'27/10/2026',periodo_instalacao:'Tarde'});
 a.equal(lerRetorno('DATA: 31/02/2026','GERADA').data_agendamento,undefined);
});
test('CPF pede titular autorizado sem inventar causas; mensagens e pedido de agenda não duplicam',()=>{
 const c={bko_ref:'BKO-541-1234567890ABCDEF'},p={id:541,cpf:'52998224725',status_venda:'CPF REPROVADO'};
 prepararAcoes(p,c);prepararAcoes(p,c);a.equal(c.universal_acoes.length,1);a.match(c.universal_acoes[0].texto,/inconsistência cadastral/);a.doesNotMatch(c.universal_acoes[0].texto,/score|vacina|votação|receita federal|reprovad/i);
 prepararAcoes({...p,status_venda:'APROVADA'},c);a.match(c.universal_acoes[1].texto,/biometria/);
 prepararAcoes({...p,status_venda:'GERADA'},c);prepararAcoes({...p,status_venda:'AGUARDANDO INSTALAÇÃO'},c);a.equal(c.universal_acoes.filter(a=>a.alvo==='bko').length,1);
 prepararAcoes({...p,status_venda:'GERADA',data_agendamento:'27/10/2026',periodo_instalacao:'Tarde'},c);a.match(c.universal_acoes.at(-1).texto,/27\/10\/2026/);
});
function ambiente(){
 let p={id:541,workspace_id:'grupoprime',cpf:'52998224725',canal_id:164,status_venda:'AGUARDANDO AUDITORIA',updated_at:'v1',dados_customizados:{universal_v1:'SIM',bko_ref:'BKO-541-1234567890ABCDEF',bko_reply_ids:['origem'],numero_origem_whatsapp:'5562999998888',universal_entrega:{concluido:true,numero:'5562981072373',canal_id:164}}};
 const envios=[],recibos=new Map(),db={from(t){let filtros=[];const q={select(){return q},eq(k,v){filtros.push([k,v]);return q},contains(k,v){filtros.push([k,v]);return q},limit(){return q},single(){return Promise.resolve({data:structuredClone(p)})},upsert(){return Promise.resolve({error:null})},then(r){let ok=filtros.every(([k,v])=>k==='dados_customizados'?v.bko_reply_ids.every(id=>p.dados_customizados.bko_reply_ids.includes(id)):k.includes('->>')?p.dados_customizados[k.split('->>')[1]]===v:p[k]===v);return Promise.resolve({data:ok?[structuredClone(p)]:[]}).then(r)}};return q}};
 const ctx={sessoes:{164:{status:'conectado',client:{getMessageById:async id=>recibos.get(id)}}},getConfigCanal:async()=>({workspaceId:'grupoprime',tipo:'webjs'}),salvarMensagem:async()=>{}};
 const pos=criar({ctx,db,telefoneBko:n=>String(n),configBko:async()=>({contatos:[{numero:'5562981072373'}]}),salvarEntrega:async(old,c,patch={})=>{a.equal(old.updated_at,p.updated_at);p={...p,...patch,dados_customizados:structuredClone(c),updated_at:'v'+(+p.updated_at.slice(1)+1)};return structuredClone(p)},enviarBko:async(client,numero,texto)=>{const id='id'+envios.length;envios.push({numero,texto});recibos.set(id,{ack:2});return{id:{_serialized:id},ack:2}},confirmarBko:async()=>{}});
 return {pos,envios,p:()=>p};
}
test('retorno autenticado atualiza CRM, envia biometria uma vez e bloqueia remetente estranho',async()=>{
 const x=ambiente(),e={workspaceId:'grupoprime',verificado:true,canalId:164,numero:'5562981072373',messageId:'r1',quotedId:'origem',mensagem:'APROVADO'};
 a.equal(await x.pos.tratar({...e,numero:'551111111111'}),true);a.equal(x.p().status_venda,'AGUARDANDO AUDITORIA');
 a.equal(await x.pos.tratar(e),true);a.equal(x.p().status_venda,'APROVADA');a.equal(x.envios.length,1);a.match(x.envios[0].texto,/biometria/);
 await x.pos.tratar(e);await x.pos.tratar({...e,messageId:'r2'});a.equal(x.envios.length,1);
 await x.pos.tratar({...e,messageId:'r3',mensagem:'GERADA'});a.equal(x.envios.length,2);a.equal(x.envios[1].numero,'5562981072373');
 const agendaId=x.p().dados_customizados.universal_acoes.find(a=>a.alvo==='bko').id;
 await x.pos.tratar({...e,messageId:'r4',quotedId:agendaId,mensagem:'27/10/2026 tarde'});a.equal(x.p().data_agendamento,'27/10/2026');a.equal(x.p().periodo_instalacao,'Tarde');a.equal(x.envios.length,3);
});
test('outro CPF atualiza o mesmo pedido e solicita reanálise sem cadastrar venda duplicada',async()=>{
 const x=ambiente();await x.pos.tratar({workspaceId:'grupoprime',verificado:true,canalId:164,numero:'5562981072373',messageId:'r1',quotedId:'origem',mensagem:'CPF REPROVADO'});
 const r=await x.pos.cliente(x.p(),'111.444.777-35');a.match(r.mensagem,/reanálise/);a.equal(x.p().id,541);a.equal(x.p().cpf,'11144477735');a.equal(x.p().dados_customizados.universal_cpf_anterior,'52998224725');a.equal(x.p().status_venda,'AGUARDANDO AUDITORIA');a.match(x.envios.at(-1).texto,/Conferir e atualizar/);
});
