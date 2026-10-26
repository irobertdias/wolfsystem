'use strict';
const ANTES=`    if (resultado.parar) {
      await persistirVariaveis(workspaceId, canalId, numero, variaveis);
      variaveis.__fluxo_terminal = true;
      await salvarSessaoFluxo(
        workspaceId, canalId, numero, fluxo.id,
        null, variaveis,
        false, null
      );
      return true;
    }`;
const DEPOIS=`    if (resultado.parar) {
      await persistirVariaveis(workspaceId, canalId, numero, variaveis);
      variaveis.__fluxo_terminal = true;
      let encerramentoUniversal = {};
      try { const bruto=variaveis.__universal_v2; encerramentoUniversal=typeof bruto==='string'?JSON.parse(bruto):bruto||{}; } catch (_) {}
      const chatEncerrado=no.tipo==='nicho_atendimento'&&(encerramentoUniversal.encerrado||encerramentoUniversal.nio?.etapa==='encerrado');
      if(chatEncerrado)await finalizarSessaoFluxo(workspaceId,numero,canalId);
      else await salvarSessaoFluxo(
        workspaceId, canalId, numero, fluxo.id,
        null, variaveis,
        false, null
      );
      return true;
    }`;
function corrigir(codigo){if(codigo.includes('const chatEncerrado=no.tipo==='))return codigo;if(codigo.split(ANTES).length!==2)throw Error('Trecho de encerramento diferente; não alterar automaticamente');return codigo.replace(ANTES,DEPOIS);}
if(require.main===module){const fs=require('fs'),cp=require('child_process'),root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp');if(root!=='/root/wolf-whatsapp')throw Error('Raiz inesperada');const p=root+'/src/routes/fluxos.js',orig=fs.readFileSync(p,'utf8'),novo=corrigir(orig),backup=root+'/backups/fluxos-encerramento-'+Date.now()+'.js';fs.copyFileSync(p,backup);fs.writeFileSync(p,novo);try{cp.execFileSync(process.execPath,['--check',p]);}catch(e){fs.writeFileSync(p,orig);throw e;}console.log(JSON.stringify({corrigido:orig!==novo,backup}));}
module.exports={corrigir,ANTES,DEPOIS};
