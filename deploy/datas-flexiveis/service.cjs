'use strict';
function normalizarData(valor){
 let t=String(valor??'').trim();let m,dia,mes,ano;
 const meses=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const texto=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^(?:nasci(?: em)?|nascimento|data de nascimento)\s*:?\s*/,'').trim();
 t=texto;
 const extenso=/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?\s+(?:de\s+)?(\d{2}|\d{4})$/.exec(texto);
 if(extenso){const indice=meses.findIndex(v=>v===extenso[2]||v.slice(0,3)===extenso[2]);if(indice<0)return '';t=extenso[1]+'/'+(indice+1)+'/'+extenso[3];}
 if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))){[,ano,mes,dia]=m;}
 else if((m=/^(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{2}|\d{4})$/.exec(t))){[,dia,mes,ano]=m;}
 else if(/^\d{6}$/.test(t)){dia=t.slice(0,2);mes=t.slice(2,4);ano=t.slice(4);}
 else if(/^\d{8}$/.test(t)){dia=t.slice(0,2);mes=t.slice(2,4);ano=t.slice(4);}
 else return '';
 if(ano.length===2)ano=String(Number(ano)>=30?1900+Number(ano):2000+Number(ano));
 const d=Number(dia),mm=Number(mes),y=Number(ano);if(y<1900||y>2199||mm<1||mm>12||d<1||d>31)return '';
 const data=new Date(Date.UTC(y,mm-1,d));if(data.getUTCFullYear()!==y||data.getUTCMonth()!==mm-1||data.getUTCDate()!==d)return '';
 return `${String(d).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${y}`;
}
module.exports={normalizarData};
