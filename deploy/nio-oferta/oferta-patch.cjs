const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function corrigir(s){
 if(s.includes('// nioOfertaDiretaV1:')){if((s.match(/decidirOfertaNio\(/g)||[]).length!==2)throw Error('Patch de oferta incompleto');return s;}
 const pre='      if (processarInput && estado.aguardando_confirmacao === true && clienteConfirmouResumoFluxoIA(entrada)) {';
 const pos='      if (consultas.executadas.length) {';
 if(s.split(pre).length!==2||s.split(pos).length!==2)throw Error('Encaixe da oferta Nio incompatível');
 const decidir=(apos)=>`      // nioOfertaDiretaV1: pergunta e catálogo completos não dependem da redação da IA.
      if(${apos?'consultas.executadas.length':'true'}){
        const decisao = require("../services/nio-oferta-direta.js").decidirOfertaNio(d,variaveis,entrada,estado,{aposConsulta:${apos}});
        if(decisao){
          Object.assign(variaveis,decisao.dados);estado.valores_coletados={...(estado.valores_coletados||{}),...decisao.dados};
          if(decisao.avancar){delete variaveis[estadoKey];return{proximoNoId:proximoNo(fluxo,no.id,0)?.id||null};}
          if(${!apos}&&processarInput)estado.historico=[...(estado.historico||[]),{role:"user",content:entrada}];
          estado.historico=[...(estado.historico||[]),{role:"assistant",content:JSON.stringify({mensagem:decisao.mensagem,dados:decisao.dados,cliente_confirmou:false,cliente_recusou:false})}];
          estado.aguardando_confirmacao=false;variaveis[estadoKey]=JSON.stringify(estado);
          await fnEnviar(decisao.mensagem);return{aguardarInput:true};
        }
      }
`;
 return s.replace(pre,decidir(false)+pre).replace(pos,decidir(true)+pos);
}
module.exports={corrigir};
if(require.main===module){const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),p=path.join(root,'src/routes/fluxos.js'),original=fs.readFileSync(p,'utf8'),codigo=corrigir(original),helper=fs.readFileSync(path.join(__dirname,'oferta-direta.js'),'utf8');for(const c of [codigo,helper]){const r=spawnSync(process.execPath,['--check'],{input:c,encoding:'utf8'});if(r.status)throw Error(r.stderr)}if(process.argv.includes('--check')){console.log('NIO_OFERTA_CHECK_OK');process.exit(0)}const b=path.join(root,'backups','nio-oferta-'+Date.now());fs.mkdirSync(b,{recursive:true});fs.writeFileSync(path.join(b,'fluxos.js'),original);const alvo=path.join(root,'src/services/nio-oferta-direta.js'),old=fs.existsSync(alvo)?fs.readFileSync(alvo):null;if(old)fs.writeFileSync(path.join(b,'nio-oferta-direta.js'),old);try{fs.writeFileSync(alvo,helper);fs.writeFileSync(p,codigo)}catch(e){fs.writeFileSync(p,original);if(old)fs.writeFileSync(alvo,old);else if(fs.existsSync(alvo))fs.unlinkSync(alvo);throw e}console.log('NIO_OFERTA_INSTALADA; backup: '+b);}
