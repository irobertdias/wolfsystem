const {test}=require('node:test'),a=require('node:assert/strict');
const {inicial,avancar}=require('./conversa.cjs'),{planosDaCidade}=require('./planos-grupoprime.cjs');
function inicio(){const s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',logradouro:'RUA ANTIGA',numero:'12',casa:'2',bairro:'ANTIGO'};return s;}
const run=(s,texto,dados={},consultar=async()=>({status:'sem_disponibilidade_na_base'}))=>avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:async()=>({dados}),consultar,catalogo:planosDaCidade});
test('primeiro endereço inviável pede outro; segundo inviável avisa e encerra',async()=>{
 let r=await run(inicio(),'consultar');a.equal(r.estado.etapa,'outro_endereco');a.equal(r.acao,undefined);a.equal(r.inviavel,true);a.match(r.mensagem,/não temos disponibilidade/);
 let recebido;r=await run(r.estado,'Rua Nova número 42',{logradouro:'Rua Nova',numero:'42'},async d=>{recebido=d;return {status:'sem_disponibilidade_na_base'}});
 a.equal(recebido.cep,undefined);a.equal(recebido.casa,undefined);a.equal(recebido.bairro,undefined);a.equal(recebido.cidade,'Goiânia');a.equal(recebido.numero,'42');a.equal(r.acao,'encerrar');a.equal(r.inviavel,true);a.match(r.mensagem,/também não há disponibilidade/);
});
test('segundo endereço viável segue para oferta sem herdar número e bairro antigos',async()=>{
 let r=await run(inicio(),'consultar');r=await run(r.estado,'74480151',{cep:'74480151'},async d=>{a.equal(d.numero,undefined);a.equal(d.logradouro,undefined);return {status:'complemento_necessario',cep:d.cep,logradouros:['RUA NOVA']}});a.equal(r.estado.etapa,'complemento');
 r=await run(r.estado,'54',{numero:'54'},async()=>({status:'disponivel_na_base',cep:'74480151',resultados:[{logradouro:'RUA NOVA',numero:'54',bairro:'CENTRO'}]}));a.equal(r.estado.etapa,'tipo_pessoa');a.equal(r.inviavel,false);a.equal(r.acao,undefined);
});
test('cliente sem outro endereço encerra; dúvida não consulta novamente o imóvel inviável',async()=>{
 const r=await run(inicio(),'consultar');const q=await run(r.estado,'como assim?',{},async()=>{throw Error('Não deve consultar endereço antigo')});a.equal(q.estado.etapa,'outro_endereco');const fim=await run(q.estado,'não tenho');a.equal(fim.acao,'encerrar');a.equal(fim.inviavel,true);
});
test('erro temporário na consulta não cria tentativa de inviabilidade',async()=>{const r=await run(inicio(),'consultar',{},async()=>({status:'consulta_inconclusiva'}));a.equal(r.inviavel,false);a.equal(r.estado.enderecosInviaveis,undefined);a.equal(r.acao,undefined);});
const tags=require('./etiquetas-vendas.cjs');
function banco(){let id=0;const t={atendimentos:[{id:1,workspace_id:'prime',canal_id:164,numero:'55'},{id:2,workspace_id:'outro',canal_id:164,numero:'55'},{id:3,workspace_id:'prime',canal_id:165,numero:'55'}],etiquetas:[],atendimento_etiquetas:[]};return {t,from(nome){let filtros=[],modo='select',payload;const q={select(){return q},order(){return q},eq(k,v){filtros.push(r=>r[k]===v);return q},limit(){return q},insert(v){modo='insert';payload=v;return q},delete(){modo='delete';return q},then(ok,erro){return Promise.resolve().then(()=>{let rows=t[nome].filter(r=>filtros.every(f=>f(r)));if(modo==='insert'){rows=[{id:++id,...payload}];t[nome].push(rows[0]);}if(modo==='delete')t[nome]=t[nome].filter(r=>!rows.includes(r));return {data:rows,error:null}}).then(ok,erro)}};return q}}}
test('etiqueta tem número real do pedido, é idempotente e respeita workspace/canal',async()=>{const db=banco();await tags.venda(db,'prime',164,'55',542);await tags.venda(db,'prime',164,'55',542);a.equal(db.t.etiquetas[0].nome,'VENDA REALIZADA 542');a.equal(db.t.atendimento_etiquetas.length,1);a.equal(db.t.atendimento_etiquetas[0].atendimento_id,1);});
test('inviável é aplicado uma vez e retirado quando a outra consulta encontra cobertura',async()=>{const db=banco();await Promise.all([tags.inviavel(db,'prime',164,'55'),tags.inviavel(db,'prime',164,'55')]);a.equal(db.t.atendimento_etiquetas.length,1);await tags.limparInviavel(db,'prime',165,'55');a.equal(db.t.atendimento_etiquetas.length,1);await tags.limparInviavel(db,'prime',164,'55');a.equal(db.t.atendimento_etiquetas.length,0);});
