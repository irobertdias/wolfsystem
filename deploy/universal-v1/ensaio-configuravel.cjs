'use strict';
// Synthetic, in-memory test. Never writes CRM or sends WhatsApp messages.
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||__dirname;
const {criarIA}=require(path.join(root,'ia-configuravel.cjs')),{avancar}=require(path.join(root,'generico.cjs'));
const cred=JSON.parse(fs.readFileSync(path.join(root,'credencial.json'),'utf8'));
const ia=criarIA({apiKey:cred.apiKey,modelo:cred.model});
const nicho={prompt:'Ajude o cliente a escolher um serviço e confirme os dados.',exigir_oferta:true,catalogo:[{id:'corte',nome:'Corte',preco:50},{id:'barba',nome:'Barba',preco:30}],coleta:[{variavel:'cliente_nome',rotulo:'Nome',pergunta:'Qual seu nome?',tipo:'texto',obrigatorio:true},{variavel:'contato',rotulo:'Telefone',pergunta:'Qual telefone de contato?',tipo:'telefone',obrigatorio:true}],documentos_config:[]};
(async()=>{let s;for(const [texto,etapa]of [['Oi','__oferta'],['Quero o corte de 50','cliente_nome'],['Cliente Exemplo','contato'],['esse mesmo','__confirmacao'],['tudo certo','__concluir']]){const r=await avancar({estado:s,texto,numero:'5500000000000',nicho,assistente:{nome:'Ana',empresa:'Barbearia Exemplo'},vars:{},extrair:async x=>{const v=await ia.extrair(x);console.log(JSON.stringify({entrada:texto,interpretacao:v}));return v;}});s=r.estado;a.equal(s.pendente,etapa);console.log(JSON.stringify({etapa,ok:true}));}a.equal(s.dados.valor_plano,50);a.equal(s.dados.contato,'5500000000000');console.log('CONFIGURAVEL_REAL_OK');})().catch(e=>{console.error(e.message);process.exitCode=1;});
