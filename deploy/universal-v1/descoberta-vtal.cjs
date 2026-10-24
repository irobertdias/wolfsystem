'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {normalizar,ufSigla,ruaBase,similaridade}=require('./vtal.cjs');
function criarDescoberta({diretorio,fetcher=fetch}){
 const cache=new Map(),postais=new Map();
 function ruas(cidade,uf){
  const nome=normalizar(cidade).replace(/[^A-Z0-9]+/g,'_'),file=path.join(diretorio,ufSigla(uf)+'-'+nome+'.json.gz');
  if(!fs.existsSync(file))return null;
  if(!cache.has(file)){if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(file,JSON.parse(zlib.gunzipSync(fs.readFileSync(file))));}
  return cache.get(file);
 }
 function candidatos(rows,rua,bairro){
  const iguais=rows.filter(r=>ruaBase(r.logradouro)===ruaBase(rua));
  const exatos=iguais.length?iguais:[];
  if(exatos.length)return {ceps:[...new Set(exatos.map(r=>r.cep))],logradouros:[...new Set(exatos.map(r=>r.logradouro))]};
  const sugestoes=[...new Map(rows.map(r=>[r.logradouro,{logradouro:r.logradouro,similaridade:similaridade(r.logradouro,rua),cep:r.cep,bairro:r.bairro||''}])).values()].filter(r=>r.similaridade>=0.65).sort((a,b)=>b.similaridade-a.similaridade).slice(0,3);
  return {ceps:[],sugestoes};
 }
 async function buscar({cidade,uf,logradouro,bairro}){
  uf=ufSigla(uf);if(!cidade||!/^[A-Z]{2}$/.test(uf)||!logradouro)return {ceps:[]};
  const local=ruas(cidade,uf),r=local?candidatos(local.map(([logradouro,cep])=>({logradouro,cep})),logradouro,bairro):null;
  if(r?.ceps.length)return {...r,fonte:'indice_local'};
  // Postal discovery only identifies CEP; commercial availability remains VTAL-only.
  const chave=JSON.stringify([normalizar(cidade),uf,ruaBase(logradouro)]);let rows=postais.get(chave);
  if(!rows){
   const rua=String(logradouro).replace(/^(?:rua|avenida|av|r)\.?\s+/i,'');if(rua.length<3)return {ceps:[],logradouro_necessario:true};
   const consultar=async consulta=>{
    const url='https://viacep.com.br/ws/'+[uf,cidade,consulta].map(encodeURIComponent).join('/')+'/json/';
    const resp=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!resp.ok)throw Error('Descoberta postal indisponível: '+resp.status);
    const j=await resp.json();if(!Array.isArray(j))throw Error('Resposta postal incompleta');return j;
   };
   let j;try{j=await consultar(rua);const tokens=rua.split(/\s+/);if(!j.length&&tokens.length>=3)j=await consultar(tokens[0].length>=3?tokens[0]:tokens.at(-1));}catch(e){if(r?.sugestoes.length)return r;throw e;}
   rows=j.filter(r=>!r.erro&&normalizar(r.localidade)===normalizar(cidade)&&ufSigla(r.uf)===uf&&/^\d{8}$/.test(String(r.cep).replace(/\D/g,''))).map(r=>({...r,cep:r.cep.replace(/\D/g,'')}));
   if(postais.size>=100)postais.delete(postais.keys().next().value);postais.set(chave,rows);
  }
  const resultado=candidatos(rows,logradouro,bairro);if(!resultado.ceps.length&&r?.sugestoes.length)resultado.sugestoes=[...(resultado.sugestoes||[]),...r.sugestoes].sort((a,b)=>b.similaridade-a.similaridade).filter((v,i,a)=>a.findIndex(x=>x.logradouro===v.logradouro)===i).slice(0,3);
  if(resultado.sugestoes?.[0]?.similaridade>=0.85&&(!resultado.sugestoes[1]||resultado.sugestoes[0].similaridade-resultado.sugestoes[1].similaridade>=0.12))resultado.sugestoes=resultado.sugestoes.slice(0,1);
  return {...resultado,origem:'Descoberta postal; cobertura exige consulta VTAL'};
 }
 return {buscar};
}
function localidadeDaBase(cidade,diretorio=path.join(__dirname,'indice-vtal')){
 if(!cidade||!fs.existsSync(diretorio))return null;
 const alvo=normalizar(cidade).replace(/[^A-Z0-9]+/g,'_');const arquivos=fs.readdirSync(diretorio).filter(f=>/^[A-Z]{2}-.+\.json\.gz$/.test(f)&&f.slice(3,-8)===alvo);
 return arquivos.length===1?{cidade:alvo.replace(/_/g,' '),estado:arquivos[0].slice(0,2)}:null;
}
module.exports={criarDescoberta,localidadeDaBase};
