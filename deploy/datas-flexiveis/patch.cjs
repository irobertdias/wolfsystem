function fluxos(s){
 if(s.includes('// datasFlexiveisV1:'))return s;
 const re=/    case "data":\r?\n      return [^\r\n]+;/g;if([...s.matchAll(re)].length!==1)throw Error('Validação de data incompatível');
 s=s.replace(re,'    case "data":\n      // datasFlexiveisV1: a pontuação do cliente não bloqueia a coleta.\n      return !!require("../services/datas-flexiveis.js").normalizarData(valor);');
 const a='  const texto = String(valor ?? "").trim();';const p=s.indexOf('function normalizarValorFluxoIA('),q=s.indexOf(a,p);if(p<0||q<0)throw Error('Normalizador de dados incompatível');
 s=s.slice(0,q)+s.slice(q).replace(a,a+'\n  if(tipo === "data") return require("../services/datas-flexiveis.js").normalizarData(valor);');
 const data=/^  const dataEncontrada = [^\r\n]+;$/m;if(!data.test(s))throw Error('Extração da data incompatível');
 s=s.replace(data,'  const dataEncontrada = require("../services/datas-flexiveis.js").normalizarData(mensagemUsuario);');return s;
}
function captura(s){
 if(s.includes('// datasCapturaV1:'))return s;
 const a='  if (pendentes.length !== 1 || mensagemEhControle(mensagem)) return dados;';if(s.split(a).length!==2)throw Error('Captura determinística incompatível');
 return s.replace(a,`  // datasCapturaV1: data legível não depende do modelo nem de extensão habilitada.
  const datasPendentes=pendentes.filter(c=>c.tipo==="data");
  if(datasPendentes.length===1){
    const data=normalizar("data",mensagem);
    const campo=datasPendentes[0];
    const nascimento=/nascimento/i.test(String(campo.nome)+" "+String(campo.label));
    const partes=data&&data.split("/");
    const futura=nascimento&&partes&&Date.UTC(Number(partes[2]),Number(partes[1])-1,Number(partes[0]))>Date.now();
    if(data&&!futura&&validar("data",data))dados[campo.nome]=data;
  }
`+a);
}
module.exports={fluxos,captura};
