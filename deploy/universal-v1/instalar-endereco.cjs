'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp');
if(root!=='/root/wolf-whatsapp')throw Error('Raiz inesperada');
const dir=path.join(root,'src/services/universal-v1'),manager=path.join(root,'src/services/webjs-manager.js');
const arquivos=['configuracao-universal.cjs','descoberta-vtal.cjs','endereco-midia.cjs','interpretacao.cjs','ia-configuravel.cjs','documentos.cjs','conversa.cjs','vtal.cjs','runtime.cjs','nativo.cjs','vero.cjs','generico.cjs','entrega-resposta.cjs','etiquetas-vendas.cjs','disponibilidade-retentativa.cjs','finalizar-conversa.cjs','objecao-documentos.cjs','retencao-venda.cjs','inviaveis-inativos.cjs','entradas-sem-resposta.cjs'];
for(const f of [...arquivos,'midia-corpo.cjs'])execFileSync(process.execPath,['--check',path.join(__dirname,f)]);
let fonte=fs.readFileSync(manager,'utf8');
const ancora='if (msg.hasMedia && (msg.type === "ptt" || msg.type === "audio")) {';
if(!fonte.includes('textoLocalizacao(msg)')){
 if(fonte.split(ancora).length!==2)throw Error('Entrada de mídia mudou; instalação interrompida.');
 fonte=fonte.replace(ancora,'if (msg.type === "location") {\n      texto = require("./midia-corpo.cjs").textoLocalizacao(msg);\n    } else '+ancora);
}
const antigo='texto = "[Mídia recebida — conteúdo não processado]";';
if(!fonte.includes('recuperarCorpo(texto)')){
 if(fonte.split(antigo).length!==2)throw Error('Proteção de mídia mudou; instalação interrompida.');
 fonte=fonte.replace(antigo,`const recuperada = require("./midia-corpo.cjs").recuperarCorpo(texto);
      if (recuperada) {
        const filename = \`midia_\${Date.now()}_\${require("node:crypto").randomBytes(8).toString("hex")}\.\${recuperada.ext}\`;
        fs.writeFileSync(path.join(AUDIOS_DIR, filename), recuperada.buffer);
        texto = \`[\${recuperada.prefixo}:\${filename}]\`;
      } else ${antigo}`);
}
const backup=path.join(root,'backups','endereco-midia-'+Date.now());fs.mkdirSync(backup,{mode:0o700});
fs.cpSync(dir,path.join(backup,'universal-v1'),{recursive:true});fs.copyFileSync(manager,path.join(backup,'webjs-manager.js'));
const helper=path.join(root,'src/services/midia-corpo.cjs');if(fs.existsSync(helper))fs.copyFileSync(helper,path.join(backup,'midia-corpo.cjs'));
const tmp=path.join(backup,'webjs-manager-novo.js');fs.writeFileSync(tmp,fonte);execFileSync(process.execPath,['--check',tmp]);
for(const f of arquivos)fs.copyFileSync(path.join(__dirname,f),path.join(dir,f));
fs.copyFileSync(path.join(__dirname,'midia-corpo.cjs'),helper);fs.copyFileSync(tmp,manager);
console.log('Instalado. Backup: '+backup+'; reinicie wolf-whatsapp para aplicar.');
