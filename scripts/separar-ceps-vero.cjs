const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsTS={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/vero.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsTS});
const base=require('../app/lib/data/viabilidade-grupoprime.json'),adicionais=require('../app/lib/data/ceps-vero-adicionais.json'),root='deploy/vero/ceps';fs.mkdirSync(root,{recursive:true});
const resumo=[];
for(const c of exportsTS.CIDADES_VERO){
 const ceps=[...new Set([...base.cidades.filter(x=>x.uf===c.uf&&exportsTS.normalizarCidadeVero(x.cidade)===exportsTS.normalizarCidadeVero(c.cidade)).flatMap(x=>x.ceps.split('\n').map(l=>l.split(',')[0])),...adicionais.cidades.filter(x=>x.uf===c.uf&&exportsTS.normalizarCidadeVero(x.cidade)===exportsTS.normalizarCidadeVero(c.cidade)).flatMap(x=>x.ceps)].filter(x=>/^\d{8}$/.test(x)&&!['00000000','99999999'].includes(x)))].sort();
 const arquivo=exportsTS.normalizarCidadeVero(c.cidade).toLowerCase().replace(/ /g,'-')+'.csv';
 fs.writeFileSync(root+'/'+arquivo,'cep,cidade,uf,rede,classificacao\n'+ceps.map(cep=>[cep,c.cidade,c.uf,c.rede,c.classe].join(',')).join('\n')+'\n');resumo.push({...c,ceps:ceps.length,arquivo});
}
fs.writeFileSync(root+'/manifesto.json',JSON.stringify({origem:'Recorte geográfico da base histórica do cliente (2024/2025). Não comprova rede Vero e não é uma lista completa de CEPs. A nova API identifica cada CEP via ViaCEP, inclusive os ausentes destes arquivos.',cidades:resumo},null,2));console.log(JSON.stringify(resumo));
