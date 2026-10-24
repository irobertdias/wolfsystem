'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {criarVero}=require('./vero.cjs'),{CIDADES_VERO,planosVero}=require('./vero-tabelas.cjs');
const cep='35000000',entrada=(cidade,uf='MG')=>({cep,cidade,uf,numero:'52'});
const postal=(cidade,uf='MG')=>async()=>({cep,localidade:cidade,uf,logradouro:'Rua Exemplo',bairro:'Centro'});
test('oito cidades próprias usam exatamente as três classificações e preços informados',async()=>{
 const proprias=CIDADES_VERO.filter(c=>c.rede==='propria');a.equal(proprias.length,8);
 for(const c of proprias){const v=criarVero({resolverCep:postal(c.cidade),consultaVtal:async()=>{throw Error('Rede própria não consulta VTAL.');}});const r=await v.consultar(entrada(c.cidade));a.equal(r.operadora,'Vero');a.equal(r.status,'disponivel_na_base');a.equal(r.classificacao,c.classe);a.deepEqual(v.catalogo('MG',c.cidade).pessoa_fisica.map(p=>p.mensalidade),c.classe==='prata'?[69.99,109.99,118.99,129.99]:c.classe==='essencial'?[113.99,123.99,129.99]:[109.99,118.99,129.99]);}
});
test('seis cidades neutras exigem endereço exato na VTAL; CEP sozinho não confirma imóvel',async()=>{
 const neutras=CIDADES_VERO.filter(c=>c.rede==='neutra');a.equal(neutras.length,6);
 for(const c of neutras){const v=criarVero({resolverCep:postal(c.cidade,c.uf),consultaVtal:async e=>({status:e.numero?'disponivel_na_base':'complemento_necessario',cep,resultados:e.numero?[{logradouro:'Rua Exemplo',numero:e.numero}]:[]})});a.equal((await v.consultar({...entrada(c.cidade,c.uf),numero:''})).status,'complemento_necessario');const r=await v.consultar(entrada(c.cidade,c.uf));a.equal(r.operadora,'Vero');a.deepEqual(v.catalogo(c.uf,c.cidade).pessoa_fisica.map(p=>p.mensalidade),[114.99,124.99,129.99]);}
});
test('fora das cidades VERO oferece Nio apenas após confirmação VTAL, com preços Nio',async()=>{
 const v=criarVero({resolverCep:postal('Sorocaba','SP'),consultaVtal:async()=>({status:'disponivel_na_base',cep,resultados:[{logradouro:'Rua Exemplo'}]})});const r=await v.consultar(entrada('Sorocaba','SP'));a.equal(r.operadora,'Nio');a.equal(r.alternativa_vero,true);a.ok(v.catalogo('SP','Sorocaba').pessoa_fisica.every(p=>p.nome.startsWith('Nio')));
});
test('falha técnica, imóvel ausente e divergência postal não confirmam cobertura nem selecionam oferta',async()=>{
 for(const status of ['consulta_inconclusiva','sem_disponibilidade_na_base','endereco_ambiguo']){const v=criarVero({resolverCep:postal('Itabira'),consultaVtal:async()=>({status,resultados:[]})});a.equal((await v.consultar(entrada('Itabira'))).status,status);}
 const v=criarVero({resolverCep:postal('Outro município'),consultaVtal:async()=>{throw Error('Não consultar localidade divergente');}});a.equal((await v.consultar(entrada('Ipatinga'))).status,'localidade_divergente');
 const f=criarVero({resolverCep:async()=>{throw Error('offline');},consultaVtal:async()=>({status:'disponivel_na_base'})});a.equal((await f.consultar(entrada('Ipatinga'))).status,'consulta_inconclusiva');
});
test('móvel de 30GB só nas ofertas próprias informadas; neutra não inventa franquia',()=>{a.equal(planosVero('prata').at(-1).gb_movel,30);a.equal(planosVero('neutra').at(-1).gb_movel,null);});
