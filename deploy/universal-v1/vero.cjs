'use strict';
const {normalizar,ufSigla}=require('./vtal.cjs');
const {CIDADES_VERO,planosVero,resolverCepVero}=require('./vero-tabelas.cjs');
const {planosDaCidade}=require('./planos-grupoprime.cjs');
function criarVero({consultaVtal,resolverCep=resolverCepVero,estado={},politica}={}){
 const config=politica||{cidades:CIDADES_VERO,ofertas:Object.fromEntries(['prata','especial','essencial','neutra'].map(c=>[c,planosVero(c)]))};
 if(!Array.isArray(config.cidades)||!config.ofertas)throw Error('Configure cidades e tabelas VERO.');
 for(const c of config.cidades)if(!c.cidade||!/^[A-Z]{2}$/.test(c.uf)||!['propria','neutra'].includes(c.rede)||!Array.isArray(config.ofertas[c.classe]))throw Error('Cidade ou classificação VERO inválida.');
 for(const lista of Object.values(config.ofertas)){if(!Array.isArray(lista)||!lista.length||lista.some(p=>!p.id||!p.nome||!Number.isFinite(p.mensalidade)||p.mensalidade<=0||!Number.isFinite(p.velocidade_mbps)||p.velocidade_mbps<=0))throw Error('Confira nomes, velocidades e preços VERO.');}
 let ultima=estado.consulta||{};
 const cidade=(uf,nome)=>config.cidades.find(c=>c.uf===ufSigla(uf)&&normalizar(c.cidade)===normalizar(nome));
 function catalogo(uf,nome){const c=cidade(uf,nome),vero=ultima.operadora==='Vero'||(!ultima.operadora&&c);if(!vero)return planosDaCidade(uf,nome);const planos=config.ofertas[ultima.classificacao||c?.classe]||[];return {pessoa_fisica:planos,pessoa_juridica:planos,tabela:'Vero '+(ultima.classificacao||c?.classe)};}
 async function consultar(e){
  let postal;
  if(e.cep){try{postal=await resolverCep(String(e.cep).replace(/\D/g,''));}catch{return {status:'consulta_inconclusiva',origem:'postal'};}
   if(!postal?.erro&&(!postal?.localidade||!postal?.uf||String(postal.cep||'').replace(/\D/g,'')!==String(e.cep).replace(/\D/g,'')))return {status:'consulta_inconclusiva',origem:'postal'};
   if(!postal.erro&&(normalizar(postal.localidade)!==normalizar(e.cidade)||ufSigla(postal.uf)!==ufSigla(e.uf||e.estado))){
    if(normalizar(postal.bairro)===normalizar(e.cidade)&&ufSigla(postal.uf)===ufSigla(e.uf||e.estado))e={...e,bairro:e.cidade,cidade:postal.localidade};
    else return {status:'localidade_divergente',cep:e.cep,cidade:postal.localidade,uf:postal.uf,localidades:[postal.localidade+' / '+postal.uf]};
   }
  }
  const c=cidade(e.uf||e.estado,e.cidade);
  if(c?.rede==='propria'&&(!e.cep||!postal?.erro)){
   ultima={status:'disponivel_na_base',operadora:'Vero',rede:'propria',classificacao:c.classe,cep:e.cep||'',origem:'Cobertura municipal informada pelo administrador',confirmacao_tecnica_necessaria:true,resultados:[{logradouro:e.logradouro||postal?.logradouro||'',bairro:e.bairro||postal?.bairro||'',numero:e.numero||'',cidade:c.cidade,uf:c.uf}]};return ultima;
  }
  const r=await consultaVtal(e);
  ultima={...r,operadora:c?.rede==='neutra'?'Vero':'Nio',rede:'neutra',...(c?.rede==='neutra'?{classificacao:'neutra'}:{alternativa_vero:true})};
  return ultima;
 }
 return {consultar,catalogo,get resultado(){return ultima;}};
}
module.exports={criarVero};
