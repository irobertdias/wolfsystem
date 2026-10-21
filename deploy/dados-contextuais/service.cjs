'use strict';
function telefone(v){let n=String(v||'').replace(/\D/g,'');if((n.length===12||n.length===13)&&n.startsWith('55'))n=n.slice(2);return /^[1-9]\d[2-9]\d{7,8}$/.test(n)?'55'+n:'';}
function candidato(input,numero){const atual=telefone(numero),n=String(input||'').replace(/\D/g,'');if(!n||!atual)return'';const local=atual.slice(4);if(n.length>=4&&n.length<=9&&local.endsWith(n))return atual;if(n.length===8||n.length===9)return telefone(atual.slice(2,4)+n);return'';}
function endereco(campo,vars,entrada,e){
 const texto=String(entrada||'').trim(),t=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/^nao\b/.test(t)){delete e.endereco_sugerido;return null;}
 if(/\?|^(qual|como|por que|porque)\b/.test(t))return null;
 if(/^(sim|isso|isso mesmo|correto|confirmo|certo|esta certo|esta correto)[.!]*$/.test(t)&&e.endereco_sugerido?.campo===campo.nome){const dados={[campo.nome]:e.endereco_sugerido.valor};delete e.endereco_sugerido;return{dados,continuar:true};}
 let local;try{local=typeof vars.resposta_viabilidade==='string'?JSON.parse(vars.resposta_viabilidade):vars.resposta_viabilidade;}catch{}
 const cidade=vars.cidade||local?.cidade||'',uf=vars.uf||local?.uf||'';
 let valor='';
 if(/^(sim|isso|isso mesmo|correto|confirmo|certo)[.!]*$/.test(t)&&vars.endereco_proposto)valor=String(vars.endereco_proposto);
 else if(/\b(rua|avenida|av\.?|travessa|estrada|rodovia|alameda|quadra)\b/i.test(texto)){
  if(!/\d/.test(texto)){e.endereco_rua=texto;return{dados:{},mensagem:`Entendi: ${texto}${cidade?', '+cidade:''}. Qual é o número do imóvel?`};}
  valor=texto;
 }else if(/^(?:n(?:umero)?[º°.\s:]*)?\d+[a-z]?$/i.test(t)&&e.endereco_rua)valor=e.endereco_rua+', '+texto;
 if(!valor)return null;
 if(cidade&&!valor.toLowerCase().includes(String(cidade).toLowerCase()))valor+=', '+cidade+(uf?'/'+uf:'');
 e.endereco_sugerido={campo:campo.nome,valor};return{dados:{},mensagem:`Entendi o endereço como: ${valor}. Está correto?`};
}
function decidir(campos,vars,entrada,estado,validar){
 const valores={...vars,...(estado.valores_coletados||{})};const campo=campos.find(c=>c.obrigatoria&&!validar(c.tipo,valores[c.nome]));
 if(campo&&/endereco/.test(campo.nome))return endereco(campo,vars,entrada,estado);
 if(campo?.tipo!=='telefone')return null;
 const t=String(entrada||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!]+$/,'');
 if(/^nao\b/.test(t)){delete estado.telefone_sugerido;return null;}
 const confirmar=/^(sim|isso|isso mesmo|esse mesmo|correto|confirmo|certo|pode ser|pode cadastrar|pode sim)$/.test(t);
 const sugestao=estado.telefone_sugerido;
 let numero='';
 if(confirmar&&sugestao?.campo===campo.nome)numero=telefone(sugestao.numero);
 else if(!/[a-z?]/i.test(t))numero=telefone(entrada);
 if(numero){
  const outro=campos.find(c=>c.tipo==='telefone'&&c.nome!==campo.nome&&telefone(valores[c.nome])===numero);
  if(outro){delete estado.telefone_sugerido;return{mensagem:'Esse número já está salvo como primeiro contato. Qual outro telefone podemos usar para ligação?',dados:{}};}
  delete estado.telefone_sugerido;
  const dados={[campo.nome]:numero},proximo=campos.find(c=>c.obrigatoria&&!validar(c.tipo,({...valores,...dados})[c.nome]));
  return{dados,mensagem:proximo?'Certo, telefone confirmado. Agora me informe '+String(proximo.label||proximo.nome)+', por favor.':null,continuar:!proximo};
 }
 let proposto=candidato(entrada,vars.numero);
 if(/^(esse mesmo|esse aqui|este numero|o mesmo|o que estou usando|esse numero)$/.test(t))proposto=telefone(vars.numero);
 if(!proposto&&confirmar&&!sugestao){const usuario=[...(estado.historico||[])].reverse().find(m=>m.role==='user'&&/^\s*[\d\s()+.-]{4,}\s*$/.test(String(m.content)));if(usuario)proposto=candidato(usuario.content,vars.numero);}
 if(!proposto)return null;
 estado.telefone_sugerido={campo:campo.nome,numero:proposto};const nacional=proposto.slice(2),ddd=nacional.slice(0,2),local=nacional.slice(2);
 return{dados:{},mensagem:`Você quis dizer (${ddd}) ${local.slice(0,-4)}-${local.slice(-4)}? Confirma que posso cadastrar esse número?`};
}
module.exports={telefone,candidato,decidir};
