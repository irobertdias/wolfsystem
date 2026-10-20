const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function troca(s,a,b){if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('Encaixe incompatível com o servidor');return s.replace(a,b);}
function corrigir(s){
 s=troca(s,'    case "email":','    case "publico":\n      return ["PF", "PJ"].includes(normalizarValorFluxoIA("publico", valor));\n    case "email":');
 s=troca(s,'  if (tipo === "cep" || tipo === "cpf") return texto.replace(/\\D/g, "");','  if (tipo === "publico") {\n    const n = texto.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase();\n    return /^(PF|CPF|PESSOA FISICA)$/.test(n) ? "PF" : /^(PJ|CNPJ|PESSOA JURIDICA)$/.test(n) ? "PJ" : "";\n  }\n  if (tipo === "cep" || tipo === "cpf") return texto.replace(/\\D/g, "");');
 s=troca(s,'  // Campos criticos sao reconhecidos pelo significado, mesmo quando o editor','  // primePublico: PF/PJ é uma categoria, nunca o número do CPF.\n  if (configurado === "publico") return "publico";\n  // Campos criticos sao reconhecidos pelo significado, mesmo quando o editor');
 s=troca(s,'      if (processarInput && estado.aguardando_confirmacao === true && clienteConfirmouResumoFluxoIA(entrada)) {',`      // primePublicoEstado: um estado antigo corrompido não pode liberar a etapa.
      if (ctx.workspaceId === "grupoprime" && Number(fluxo.id) === 27 && no.id === "prime_vendedor") {
        const publico = normalizarValorFluxoIA("publico", estado.valores_coletados?.tipo_pessoa || variaveis.tipo_pessoa);
        if (!publico) {
          delete variaveis.tipo_pessoa;
          if (estado.valores_coletados) delete estado.valores_coletados.tipo_pessoa;
          estado.aguardando_confirmacao = false;
        } else {
          variaveis.tipo_pessoa = publico;
          if (estado.valores_coletados) estado.valores_coletados.tipo_pessoa = publico;
        }
      }
      if (processarInput && estado.aguardando_confirmacao === true && clienteConfirmouResumoFluxoIA(entrada)) {`);
 s=troca(s,'      if (estado.aguardando_confirmacao && resultado.clienteConfirmou) {',`      // primeEtapas: só o cadastro completo recebe resumo final; plano/endereço seguem sem resumo técnico.
      if (ctx.workspaceId === "grupoprime" && Number(fluxo.id) === 27 && ["prime_vendedor", "prime_endereco_ia"].includes(no.id)) {
        Object.assign(variaveis, estado.valores_coletados || {}, resultado.consolidados || {});
        delete variaveis[estadoKey];
        return { proximoNoId: proximoNo(fluxo, no.id, 0)?.id || null };
      }
      if (estado.aguardando_confirmacao && resultado.clienteConfirmou) {`);
 // Reconhecer a confirmação coloquial sem aceitar ressalvas: o filtro de negações acima continua ativo.
 s=troca(s,'|| /\\b(esta correto|esta certo|','|| /\\b(esta sim|esta correto|esta certo|');
 return s;
}
module.exports={corrigir};
if(require.main===module){
 const raiz=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),alvo=path.join(raiz,'src/routes/fluxos.js');
 const codigo=corrigir(fs.readFileSync(alvo,'utf8')),r=spawnSync(process.execPath,['--check'],{input:codigo,encoding:'utf8'});if(r.status)throw Error(r.stderr);
 if(process.argv.includes('--check')){console.log('CADASTRO_CHECK_OK: nenhuma alteração feita.');process.exit(0);}
 const backup=path.join(raiz,'backups','prime-cadastro-'+new Date().toISOString().replace(/[:.]/g,'-')+'/fluxos.js');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(alvo,backup);fs.writeFileSync(alvo,codigo);console.log('Correção instalada. Backup: '+backup+'. Reinicie: pm2 restart wolf-whatsapp');
}
