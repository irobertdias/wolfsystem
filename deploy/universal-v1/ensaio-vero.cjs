'use strict';
// Real postal / VTAL / AI queries with synthetic inputs. No CRM writes or WhatsApp sends.
const path=require('node:path'),fs=require('node:fs'),a=require('node:assert/strict');
const root=process.argv[2]||__dirname,{criarConsulta}=require(path.join(root,'vtal.cjs')),{criarVero}=require(path.join(root,'vero.cjs')),{avancar}=require(path.join(root,'conversa.cjs')),{criarInterpretador}=require(path.join(root,'interpretacao.cjs'));
const cred=JSON.parse(fs.readFileSync(path.join(root,'credencial.json'),'utf8'));
async function caso(cidade,uf,entradas,operadora,preco){let s;for(const texto of ['Oi',cidade+' '+uf,...entradas]){
 const vero=criarVero({consultaVtal:criarConsulta({diretorio:path.join(root,'indice-vtal')}),estado:s||{}}),ia=criarInterpretador({...cred,catalogo:vero.catalogo});
 const r=await avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:ia.extrair,consultar:vero.consultar,catalogo:vero.catalogo,config:{empresa:'Grupo Prime',apresentacao:'Olá! Sou a assistente virtual de vendas da Grupo Prime, parceira VERO.',promptNicho:'Ofereça VERO ou Nio somente conforme catálogo e operadora confirmados na consulta. Não invente preços ou cobertura.'}});s=r.estado;console.log(JSON.stringify({cidade,etapa:s.etapa,operadora:s.dados.operadora||null}));}
 a.equal(s.dados.operadora,operadora);a.equal(s.etapa,'plano');const v=criarVero({consultaVtal:criarConsulta(),estado:s}).catalogo(uf,cidade);a.equal(v.pessoa_fisica[0].mensalidade,preco);
}
(async()=>{await caso('Timóteo','MG',['35182327','CPF'],'Vero',109.99);await caso('Goiânia','GO',['74480150','q4 lt09','CPF'],'Vero',114.99);await caso('Queimados','RJ',['26381408','Rua Conde Aljezur número 52 QD G casa 2','CPF'],'Nio',110);console.log('VERO_VTAL_NIO_REAL_OK');})().catch(e=>{console.error(e.message);process.exitCode=1;});
