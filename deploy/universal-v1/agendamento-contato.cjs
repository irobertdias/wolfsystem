'use strict';
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
function local(em,fuso){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(em)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));return {ano:p.year,mes:p.month,dia:p.day,hora:p.hour,minuto:p.minute};}
function utc(p,fuso){let v=Date.UTC(p.ano,p.mes-1,p.dia,p.hora,p.minuto);for(let i=0;i<3;i++){const l=local(v,fuso);v+=Date.UTC(p.ano,p.mes-1,p.dia,p.hora,p.minuto)-Date.UTC(l.ano,l.mes-1,l.dia,l.hora,l.minuto);}const l=local(v,fuso);return ['ano','mes','dia','hora','minuto'].every(k=>l[k]===p[k])?v:null;}
const numeros={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,quinze:15,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60};
const n=v=>/^\d+$/.test(v)?+v:numeros[v];
function interpretar(texto,{agora=Date.now(),fuso='America/Sao_Paulo',aguardandoHorario=false}={}){
 const t=normal(texto),contato=/\b(?:cham[ae]|chamar|lig[ae]|ligar|retorn[ae]|retornar|volte|voltar|fale|falar|manda[r]? mensagem|me proc ure|me procure|conversar depois|continuar depois|me avisa)\b/.test(t);
 if(!contato&&!aguardandoHorario)return null;
 if(/\b(?:nao (?:me )?(?:chame|liga|ligue|retorne)|pare|cancele o (?:retorno|agendamento))\b/.test(t))return {cancelar:true};
 if(!aguardandoHorario&&!/\b(?:depois|tarde|noite|manha|amanha|hoje|dia|dias|domingo|segunda|terca|quarta|quinta|sexta|sabado|minutos?|min|horas?|daqui|as?\s+\d)\b|\d[:h./]\d|\d{1,2}h\b/.test(t))return null;
 let depois=t.match(/\b(?:daqui(?: a)?|em)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|dez|quinze|vinte|trinta|quarenta|sessenta)\s*(minutos?|mins?|min|horas?|h|dias?)(?:\s*(?:e\s*)?(meia|\d+)\s*(?:minutos?|min)?)?/);
 if(depois){const valor=n(depois[1]),un=depois[2],extra=depois[3]==='meia'?30:+depois[3]||0,m=un.startsWith('d')?valor*1440:un.startsWith('h')?valor*60+extra:valor;if(m<=0||m>525600)return {esclarecer:true};return {em:new Date(agora+m*60000).toISOString(),fuso};}
 const h=t.match(/\b(?:as?|pelas?|horario(?: das?)?)\s+(\d{1,2}|uma|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?:(?:[:h.])(\d{1,2}))?(?:\s*(?:horas?|h))?(?:\s+e\s+(meia|quinze))?/)||t.match(/\b(\d{1,2})[:h](\d{1,2})?\b/);
 if(!h)return {esclarecer:true};
 let hora=n(h[1]),minuto=+(h[2]||0);if(h[3])minuto=h[3]==='meia'?30:15;
 if(/\b(?:tarde|noite)\b/.test(t)&&hora<12)hora+=12;if(hora>23||minuto>59)return {esclarecer:true};
 const l=local(agora,fuso),base=new Date(Date.UTC(l.ano,l.mes-1,l.dia)),data=t.replace(h[0],'').match(/\b(?:dia\s*)?(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}|\d{2}))?\b/);
 if(data){let ano=data[3]?+data[3]:l.ano;if(ano<100)ano+=2000;base.setUTCFullYear(ano,+data[2]-1,+data[1]);if(base.getUTCDate()!==+data[1]||base.getUTCMonth()!==+data[2]-1)return {esclarecer:true};}
 else if(/depois de amanha/.test(t))base.setUTCDate(base.getUTCDate()+2);
 else if(/amanha/.test(t))base.setUTCDate(base.getUTCDate()+1);
 else {const dias=['domingo','segunda','terca','quarta','quinta','sexta','sabado'],dia=dias.findIndex(d=>new RegExp('\\b'+d+'(?:-feira)?\\b').test(t));if(dia>=0){let salto=(dia-base.getUTCDay()+7)%7;if(!salto)salto=7;base.setUTCDate(base.getUTCDate()+salto);}}
 let em=utc({ano:base.getUTCFullYear(),mes:base.getUTCMonth()+1,dia:base.getUTCDate(),hora,minuto},fuso);
 if(em!==null&&em<=agora&&!data&&!/hoje|amanha|domingo|segunda|terca|quarta|quinta|sexta|sabado/.test(t)){base.setUTCDate(base.getUTCDate()+1);em=utc({ano:base.getUTCFullYear(),mes:base.getUTCMonth()+1,dia:base.getUTCDate(),hora,minuto},fuso);}
 if(em===null||em<=agora||em-agora>366*86400000)return {esclarecer:true};return {em:new Date(em).toISOString(),fuso};
}
function configurar(d={}){const c=d.lembretes_inteligentes||{};const ativo=c.ativo!==undefined?c.ativo===true:d.reengajamento_inteligente_ativo===true;const minutos=c.minutos||d.reengajamento_lembretes?.map(m=>m.minutos)||[];const valido=Array.isArray(minutos)&&minutos.length===5&&minutos.every((n,i)=>Number.isFinite(Number(n))&&Number(n)>0&&(!i||Number(n)>Number(minutos[i-1])));const fuso=c.fuso||'America/Sao_Paulo';try{local(Date.now(),fuso);}catch{return {ativo:false,erro:'Fuso inválido'};}return {ativo:ativo&&valido,minutos:Array.isArray(minutos)?minutos.map(Number):[],fuso,limite:5,erro:ativo&&!valido?'Configure os cinco horários crescentes':null};}
module.exports={interpretar,configurar,local,utc};
