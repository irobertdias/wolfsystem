const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function troca(s,a,b){if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('Encaixe incompatível');return s.replace(a,b);}
function bridge(s){
 const a=s.slice(s.indexOf('function ladoEsperadoRegra('),s.indexOf('function identidadeDaAnalise('));
 const b=`function ladoEsperadoRegra(regra) {
  // primeLadoRegra: palavras de negação na descrição não determinam o lado.
  const chave = normalizarTexto(String(regra?.variavel || regra?.id || "")).replace(/_/g, " ");
  if (/\\bverso\\b/.test(chave)) return "verso";
  if (/\\bfrente\\b/.test(chave)) return "frente";
  const nome = normalizarTexto(regra?.nome || "");
  if (/\\bverso\\b/.test(nome)) return "verso";
  if (/\\bfrente\\b/.test(nome)) return "frente";
  return "";
}
`;
 if(!s.includes('// primeLadoRegra:')){if(!a)throw Error('Função de lado ausente');s=s.replace(a,b);}
 s=troca(s,'    const regra = localizarRegra(configuracao, analise.regraArquivoId);',`    let regra = localizarRegra(configuracao, analise.regraArquivoId);
    // primeLadoVisual: a face lida da imagem prevalece sobre um ID de regra inconsistente.
    if (workspaceId === "grupoprime" && regraEhDocumentoIdentidade(regra) && /^prime_/.test(regra.id)) {
      const lado = normalizarTexto(analise.ladoDocumento || "");
      if (!["frente", "verso"].includes(lado)) throw erroDocumento("LADO_DOCUMENTO_INCORRETO", "Não consegui identificar qual lado do RG aparece nesta foto. Envie uma foto legível de uma face por vez.");
      const correta = regrasConfiguradas(configuracao).find(r => regraEhDocumentoIdentidade(r) && ladoEsperadoRegra(r) === lado);
      if (!correta) throw erroDocumento("LADO_DOCUMENTO_INCORRETO", "Não consegui associar esta imagem ao lado solicitado do RG. Envie uma foto legível dessa face.");
      regra = correta;
    }`);
 s=troca(s,'      variaveis.documentos_privados = "SIM";',`      variaveis.documentos_privados = "SIM";
      if (workspaceId === "grupoprime" && /^prime_/.test(regra.id)) {
        variaveis.__wolf_followups_v1 = JSON.stringify({ aguardandoRespostaCliente: true, respondeuEm: new Date().toISOString(), lembretesEnviados: 0, ultimoLembreteEm: null });
      }`);
 s=troca(s,'        if (captura) {',`        if (captura && workspaceId === "grupoprime" && ["prime_documentos_ia", "prime_reversao_documentos_ia"].includes(sessaoAntes?.no_atual)) {
          // primeRespostaArquivos: orientar pelo estado salvo, sem deixar o modelo trocar frente/verso.
          const atual = await ctx.buscarSessaoFluxo(workspaceId, canalId, numero);
          const vars = atual?.variaveis || {};
          const pendente = regrasConfiguradas(configuracao?.dados || {}).find(r => vars[r.variavel + "_validado"] !== "SIM" || !listaAnexos(vars[r.variavel]).length);
          if (pendente) {
            const pedido = pendente.variavel === "rg_frente" ? "uma foto legível da frente do RG" : pendente.variavel === "rg_verso" ? "uma foto legível do verso do RG" : "o comprovante do endereço de instalação (foto ou PDF)";
            await fnEnviar("Recebi e salvei " + captura.regra.nome + ". ✅\\n\\nAgora envie " + pedido + ", por favor.");
            return true;
          }
        }
        if (captura) {`);
 s=troca(s,'    if ((!entradaEhMidia && !pedidoReanalise)',`    // primeTextoNaoValidaUpload: texto e confirmação não substituem arquivo armazenado.
    if (workspaceId === "grupoprime" && typeof ctx.buscarSessaoFluxo === "function" && typeof ctx.configuracaoExtensoesFluxoIA === "function" && !entradaEhMidia && !/encerrar|cancelar|desistir|parar|nao quero|não quero|sair/i.test(String(mensagemCliente))) {
      const sessaoDocs = await ctx.buscarSessaoFluxo(workspaceId, canalId, numero);
      if (["prime_documentos_ia", "prime_reversao_documentos_ia"].includes(sessaoDocs?.no_atual)) {
        const confDocs = await ctx.configuracaoExtensoesFluxoIA(workspaceId, canalId, numero, fluxoIdPreferido);
        const v = sessaoDocs.variaveis || {};
        const falta = regrasConfiguradas(confDocs?.dados || {}).find(r => v[r.variavel + "_validado"] !== "SIM" || !listaAnexos(v[r.variavel]).length);
        if (falta) {
          const nome = falta.variavel === "rg_frente" ? "a foto da frente do RG" : falta.variavel === "rg_verso" ? "a foto do verso do RG" : "o comprovante do endereço de instalação";
          await fnEnviar("Ainda não consta " + nome + " salvo neste atendimento. Pode enviar o arquivo por aqui? O comprovante pode ser boleto, fatura, conta, correspondência, contrato ou print com o endereço legível.");
          return true;
        }
      }
    }
    if ((!entradaEhMidia && !pedidoReanalise)`);
 s=troca(s,'      if (!analise?.tratado || analise.ignorado) return executarFluxoBase(...args);',`      if (!analise?.tratado || analise.ignorado) {
        if (workspaceId === "grupoprime" && ["prime_documentos_ia", "prime_reversao_documentos_ia"].includes(sessaoAntes?.no_atual)) {
          await fnEnviar("Não consegui ler e salvar esse anexo como documento do pedido. Pode enviar uma foto legível ou PDF, por favor?");
          return true;
        }
        return executarFluxoBase(...args);
      }`);
 s=troca(s,'      if (!analise.entrada) return executarFluxoBase(...args);',`      if (workspaceId === "grupoprime" && ["prime_documentos_ia", "prime_reversao_documentos_ia"].includes(sessaoAntes?.no_atual) && !analise.entrada?.includes("CAPTURA_SEGURA_ARQUIVO=SIM")) {
        await fnEnviar("Não consegui identificar e salvar este arquivo na documentação do pedido. Pode enviar uma imagem legível ou PDF? Se for comprovante, qualquer tipo de documento com o endereço legível pode ser usado.");
        return true;
      }
      if (!analise.entrada) return executarFluxoBase(...args);`);
 s=troca(s,'      if (analise.regraArquivoId && !pedidoReanalise) {',`      // primeCepDuplaLeitura: conferir novamente o arquivo antes de alegar divergência de CEP.
      if (workspaceId === "grupoprime" && analise.regraArquivoId === "prime_comprovante") {
        const esperado = String(sessaoAntes?.variaveis?.cep || "").replace(/\\D/g, "");
        const lido = String(analise.dadosExtraidos?.cep_comprovante || "").replace(/\\D/g, "");
        if (esperado.length === 8 && lido.length === 8 && lido !== esperado) {
          const revisao = await ctx.analisarMidiaFluxoIA({ ...(configuracao?.dados || {}), prompt: String(configuracao?.dados?.prompt || "") + "\\nREVISÃO DE LEITURA: releia com atenção o CEP impresso no endereço do destinatário, no cabeçalho da fatura. Não confunda CEP com código da conta, CPF ou vencimento. Transcreva os oito dígitos apenas se legíveis; nunca complete ou corrija por suposição." }, entradaParaAnalise, { workspaceId, canalId, numero, fluxoId: configuracao?.fluxo?.id || fluxoIdPreferido || null });
          const cepRevisado = String(revisao?.dadosExtraidos?.cep_comprovante || "").replace(/\\D/g, "");
          if (!revisao?.erro && cepRevisado.length === 8) {
            analise.dadosExtraidos = { ...(analise.dadosExtraidos || {}), cep_comprovante: cepRevisado };
            analise.entrada = String(revisao.entrada || analise.entrada || "");
          }
        }
      }
      if (analise.regraArquivoId && !pedidoReanalise) {`);
 s=troca(s,'      variaveis[nomeValidacao] = "SIM";',`      variaveis[nomeValidacao] = "SIM";
      if (workspaceId === "grupoprime" && regra.id === "prime_comprovante") {
        const cepLido = String(analise.dadosExtraidos?.cep_comprovante || "").replace(/\\D/g, "");
        if (cepLido.length === 8) {
          variaveis.cep_comprovante = cepLido;
          const k = "__fluxo_ia_" + (atual.no_atual || sessao.no_atual);
          let e;try {e=typeof variaveis[k] === "string" ? JSON.parse(variaveis[k]) : variaveis[k] || {};} catch {e={};}
          e.valores_coletados = { ...(e.valores_coletados || {}), cep_comprovante: cepLido };variaveis[k]=JSON.stringify(e);
        }
      }`);
 return s;
}
function visao(s){
 s=troca(s,'    "19. Responda somente JSON valido, sem markdown e sem explicacoes fora do JSON.",',`    "19. Responda somente JSON valido, sem markdown e sem explicacoes fora do JSON.",
    regrasArquivo.some(r => /^prime_rg_/.test(r.id)) ? "20. Para RG/CIN, identifique a face pelo conteúdo VISÍVEL, considerando a rotação da foto: a face com retrato é frente; a face de dados, filiação, CPF, registro ou impressão digital sem retrato é verso neste atendimento. Não deduza o lado pela ordem em que as fotos chegaram, pelo arquivo pendente ou pela legenda do cliente. Escolha a regra cujo nome/variável corresponda à face identificada. Ignore palavras em advertências como não aceitar frente como verso. Se não estiver seguro, use lado_documento=desconhecido e não confirme recebimento de um lado específico." : "",
    regrasArquivo.some(r => r.id === "prime_comprovante") ? "21. No Grupo Prime, aceite como comprovante de endereço QUALQUER boleto, fatura (inclusive Claro ou outra operadora), correspondência, conta de consumo, contrato, declaração, carnê, foto, print ou PDF que mostre o endereço da instalação. Não exija nome do titular nem prova de pagamento. Não classifique uma conta pessoal como oferta comercial externa. Extraia o endereço literal em endereco_comprovante e o CEP literal em cep_comprovante quando legíveis, e use regra_arquivo_id=prime_comprovante. Se não houver endereço legível, não invente: informe o que falta." : "",`);
 s=troca(s,'      const referenciaComercialExterna = comprovanteSeguroNoPrint ? false : referenciaComercialExternaLida;',`      // primeComprovanteAmplo: qualquer documento com endereço lido pode comprovar a instalação.
      const regraEnderecoPrime = listarRegrasArquivo(dados).find(r => r.id === "prime_comprovante");
      const enderecoPrime = String(dadosExtraidosLidos.endereco_comprovante || "").trim();
      const cepPrime = String(dadosExtraidosLidos.cep_comprovante || "").replace(/\\D/g, "");
      const comprovanteEnderecoPrime = !!regraEnderecoPrime && !/^prime_rg_/.test(regraArquivoId) && ((enderecoPrime.length >= 12 && /\\d/.test(enderecoPrime)) || cepPrime.length === 8);
      if (regraEnderecoPrime && regraArquivoId === regraEnderecoPrime.id && !comprovanteEnderecoPrime) regraArquivoId = "";
      if (comprovanteEnderecoPrime) {
        regraArquivoId = regraEnderecoPrime.id;
        for (const chave of Object.keys(dadosExtraidos)) delete dadosExtraidos[chave];
        if (enderecoPrime) dadosExtraidos.endereco_comprovante = enderecoPrime;
        if (cepPrime.length === 8) dadosExtraidos.cep_comprovante = cepPrime;
      }
      const referenciaComercialExterna = (comprovanteSeguroNoPrint || comprovanteEnderecoPrime) ? false : referenciaComercialExternaLida;`);
 return s;
}
module.exports={bridge,visao};
if(require.main===module){
 const raiz=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
 const plano=[['src/services/fluxo-ia-multimidia-bridge.js',bridge],['src/services/fluxo-ia-multimidia.js',visao]].map(([p,fn])=>[p,fn(fs.readFileSync(path.join(raiz,p),'utf8'))]);
 for(const [p,s]of plano){const r=spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8'});if(r.status)throw Error(p+': '+r.stderr);}
 if(process.argv.includes('--check')){console.log('DOCUMENTOS_CHECK_OK: nenhuma alteração feita.');process.exit(0);}
 const backup=path.join(raiz,'backups','prime-documentos-'+new Date().toISOString().replace(/[:.]/g,'-'));
 for(const [p,s]of plano){const alvo=path.join(raiz,p),b=path.join(backup,p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(alvo,b);fs.writeFileSync(alvo,s);}
 console.log('Instalado; backup: '+backup+'. Reinicie: pm2 restart wolf-whatsapp');
}
