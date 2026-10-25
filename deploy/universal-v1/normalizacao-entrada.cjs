'use strict';
// Remove apenas separadores: não inventa, troca ou completa dígitos.
function cepDoTexto(texto){
 const t=String(texto||''),m=/(?<!\d)(\d{5})[\s_./–—-]*(\d{3})(?!\d)/u.exec(t);
 if(m)return m[1]+m[2];
 if(/^(?:\s*(?:meu\s+)?cep\s*[:=]?\s*)?[\d\s_./–—-]+$/iu.test(t)){const d=t.replace(/\D/g,'');if(d.length===8)return d;}
 return '';
}
const campoCep=c=>/(?:^|_)cep$/i.test(c.variavel||'')||/^cep$/i.test(c.tipo||'')||/^cep\b/i.test(c.rotulo||'');
function numeroPorExtenso(t){
 const valores={ZERO:0,UM:1,UMA:1,DOIS:2,DUAS:2,TRES:3,QUATRO:4,CINCO:5,SEIS:6,SETE:7,OITO:8,NOVE:9,DEZ:10,ONZE:11,DOZE:12,TREZE:13,QUATORZE:14,QUINZE:15,DEZESSEIS:16,DEZESSETE:17,DEZOITO:18,DEZENOVE:19,VINTE:20,TRINTA:30,QUARENTA:40,CINQUENTA:50,SESSENTA:60,SETENTA:70,OITENTA:80,NOVENTA:90,CEM:100,CENTO:100,DUZENTOS:200,TREZENTOS:300,QUATROCENTOS:400,QUINHENTOS:500,SEISCENTOS:600,SETECENTOS:700,OITOCENTOS:800,NOVECENTOS:900};
 const tokens=t.replace(/^OLA[, ]*/,'').replace(/^(?:NUMERO|FACHADA|CASA)\s*(?:E\s+)?/,'').replace(/[!?.]/g,'').trim().split(/\s+/).filter(p=>p!=='E');
 if(!tokens.length||tokens.some(p=>valores[p]===undefined))return '';
 return String(tokens.reduce((n,p)=>n+valores[p],0));
}
function dadosContextuais(campos,pendente,texto){
 const t=String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),r={};
 const e=require('./vtal.cjs').interpretarEndereco(texto);
 if(pendente==='numero'&&!e.numero&&!/\b(?:CEP|CPF|CNPJ|TELEFONE|CELULAR)\b/.test(t)){const ns=[...t.matchAll(/\b\d{1,6}\b/g)];if(ns.length===1)e.numero=ns[0][0];}
 if(pendente==='numero'&&!e.numero)e.numero=numeroPorExtenso(t.trim());
 for(const c of campos){const k=String(c.variavel||'').split('_').at(-1);if(k==='numero'&&(!/^\d{1,6}[A-Z]?$/.test(e[k]||'')||c.variavel!==pendente&&!/\b(?:NUMERO|FACHADA|RUA|AVENIDA)\b/.test(t)))continue;if(['quadra','lote','numero','casa','apartamento','bloco'].includes(k)&&e[k])r[c.variavel]=e[k];}
 if(campos.some(c=>c.variavel===pendente)&&/(?:^|_)tipo_pessoa$/.test(pendente||'')){
  if(/\b(?:CNPJ|PJ|JURIDICA)\b/.test(t))r[pendente]='PJ';else if(/\b(?:CPF|PF|FI[ZS]ICA)\b/.test(t))r[pendente]='PF';
 }
 if(pendente==='vencimento'){
  const n=t.match(/\b(?:DIA[ _]*)?(\d{1,2})\b/),palavras={'UM':1,'DOIS':2,'TRES':3,'QUATRO':4,'CINCO':5,'SEIS':6,'SETE':7,'OITO':8,'NOVE':9,'DEZ':10,'ONZE':11,'DOZE':12,'TREZE':13,'QUATORZE':14,'CATORZE':14,'QUINZE':15,'DEZESSEIS':16,'DEZESSETE':17,'DEZOITO':18,'DEZENOVE':19,'VINTE':20,'TRINTA':30};
  const composto=t.match(/\b(VINTE|TRINTA) E (UM|DOIS|TRES|QUATRO|CINCO|SEIS|SETE|OITO|NOVE)\b/),valor=n?Number(n[1]):composto?palavras[composto[1]]+palavras[composto[2]]:Object.entries(palavras).find(([p])=>new RegExp('\\b'+p+'\\b').test(t))?.[1];if(valor>=1&&valor<=31)r[pendente]=String(valor);
 }
 if(pendente==='forma_pagamento'&&!/\bNAO\b/.test(t)&&/\b(?:B[OU]L+E?T[OU]|BO\s+LETO|BOLETT?O)\b/.test(t))r[pendente]='Boleto';
 if(pendente==='email'){
  const direto=String(texto).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if(direto)r[pendente]=direto[0].toLowerCase();else if(/ARROBA/.test(t)){const v=t.toLowerCase().replace(/^ola[,\s]*/,'').replace(/[!?,]+$/,'').replace(/\bponto\b/g,'.').replace(/\barroba\b/g,'@').replace(/\s/g,'');if(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v))r[pendente]=v;}
 }
 return r;
}
module.exports={cepDoTexto,campoCep,dadosContextuais};
