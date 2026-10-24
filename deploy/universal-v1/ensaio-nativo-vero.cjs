'use strict';
// In-memory sessions and CRM sink. Real read-only config queries and AI calls.
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||'/root/wolf-whatsapp';require(root+'/node_modules/dotenv').config({path:root+'/.env',quiet:true});
const db=require(root+'/node_modules/@supabase/supabase-js').createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY);
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'definicao-vero.json'),'utf8'));f.id=31;
const no=f.nos.find(n=>n.tipo==='nicho_atendimento'),fim=f.nos.find(n=>n.tipo==='concluir_venda_universal'),vars={},vendas=[];
const ctx={supabase:db,executarFluxo:async()=>true,persistirVariaveis:async()=>{},salvarSessaoFluxo:async()=>{},universalOperacoes:{registrar:async(...args)=>{vendas.push(args);return 999999;},entregarPendentes:async()=>{}},tratarRetornoBko:async()=>false};
const controle=require(root+'/src/services/universal-v1/nativo.cjs')(ctx),meta={workspaceId:'grupoprime',canalId:165,numero:'5500000000000'};
(async()=>{for(const [texto,etapa]of [['Oi','localidade'],['Timóteo MG','cep'],['35182327','tipo_pessoa'],['CPF','plano'],['109,99 pode ser esse','endereco'],['Rua Exemplo, número 52, bairro Centro','nome'],['Maria Exemplo','cpf'],['52998224725','data_nascimento'],['23 janeiro 2002','nome_mae'],['Ana Exemplo','email'],['maria@example.com','endereco_confirmado'],['tudo certo','telefone1'],['esse mesmo','vencimento'],['20','forma_pagamento'],['boleto','__confirmacao'],['tudo ok','rg_frente']]){
 await ctx.processarUniversalNativo(f,no,vars,texto,true,async()=>{},meta);const s=JSON.parse(vars.__universal_v2);a.equal(s.aberturaConcluida?s.pendente:s.nio.etapa,etapa);console.log(JSON.stringify({etapa,ok:true}));}
 const s=JSON.parse(vars.__universal_v2);for(const d of no.dados.documentos_config)s.documentos[d.variavel]=[{path:'fixture/'+d.variavel,nome:'documento-sintetico',privado:true}];vars.__universal_v2=JSON.stringify(s);
 const r=await ctx.processarUniversalNativo(f,no,vars,'Já enviei os documentos',true,async()=>{},meta);a.equal(r.proximoNoId,fim.id);
 await ctx.processarUniversalNativo(f,fim,vars,'',false,async()=>{},meta);a.equal(vendas.length,1);a.equal(vendas[0][3].dados.operadora,'Vero');a.equal(vendas[0][3].plano.mensalidade,109.99);a.equal(vars.proposta_id,'999999');console.log('VERO_CADASTRO_NATIVO_OK_SEM_ESCRITA_CRM');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>controle.parar());
