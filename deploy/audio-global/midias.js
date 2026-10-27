const { memorizarRecibo, obterStatusRecibo, aplicarRecibo } = require("../services/webjs-recibos");
const { execFile } = require("node:child_process");
const executarArquivo = require("node:util").promisify(execFile);
const { prepararAudio } = require("../services/audio-seguro.cjs");
module.exports = function carregar_midias(ctx) {
  let {
    formatarErroMetaWaba,
    sessoes,
    MessageMedia,
    fs,
    path,
    AUDIOS_DIR,
    multer,
    app,
    upload,
    supabase,
    validarCanalDoWorkspace,
    validarTemplateDoWorkspace,
    sessaoWebjsSalva,
    getConfigCanal,
    enviarTemplateWaba,
    criarSessaoWebjs,
    ehErroChromiumZumbi,
    reconectarCanalSilencioso,
    criarSessaoWaba,
    registrarDestinoConversaWebjs,
    variantesNumeroAtendimento
  } = ctx;

  const resolverDestinoWebjs = ctx.resolverDestinoWebjs;
async function salvarEnvioMidia(registro, sessao) {
  const { error } = await supabase.from("mensagens").insert([registro]);
  if (error) console.warn("[Midia] Envio confirmado, mas falhou ao salvar historico:", error.message);
  if (!error && sessao.tipo === "webjs" && registro.provider_message_id) await aplicarRecibo(supabase, registro.workspace_id, registro.canal_id, registro.provider_message_id);
}

async function restaurarDestinoPersistidoWebjs(client, workspaceId, canalId, numero) {
  if (!client || typeof registrarDestinoConversaWebjs !== "function") return null;

  const numeroSanitizado = String(numero || "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(numeroSanitizado) || !workspaceId || !canalId) return null;

  try {
    const numeros = typeof variantesNumeroAtendimento === "function"
      ? variantesNumeroAtendimento(numeroSanitizado)
      : [numeroSanitizado];
    const { data, error } = await supabase
      .from("mensagens")
      .select("provider_message_id")
      .eq("workspace_id", workspaceId)
      .eq("canal_id", canalId)
      .in("numero", numeros)
      .eq("de", "cliente")
      .not("provider_message_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const jid = String(data?.provider_message_id || "").match(/([0-9]{8,20}@(c\.us|lid))/)?.[1] || null;
    if (!jid) return null;

    registrarDestinoConversaWebjs(client, numeroSanitizado, jid);
    console.log(`[WebJS midia] Canal ${canalId}: destino persistido ${jid} restaurado para ${numeroSanitizado}`);
    return jid;
  } catch (erro) {
    console.warn(`[WebJS midia] Canal ${canalId}: nao foi possivel restaurar destino persistido: ${erro?.message || erro}`);
    return null;
  }
}

async function tratarFalhaEnvioWebjs(erro, sessao, canalId, descricao) {
  if (sessao?.tipo !== "webjs" || (!ehErroChromiumZumbi(erro) && !/timeout/i.test(String(erro?.message || erro)))) return null;
  let timer;
  let responde = false;
  try {
    responde = await Promise.race([
      Promise.resolve().then(() => sessao.client.pupPage.evaluate(() => 1)).then(valor => valor === 1),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); }),
    ]);
  } catch (_) {} finally { clearTimeout(timer); }
  if (!responde && sessoes[canalId] === sessao) reconectarCanalSilencioso(canalId, descricao + ": " + String(erro?.message || erro)).catch(falha => console.error("[Midia] Falha na recuperacao do canal " + canalId + ":", falha.message));
  return {
    success: false, code: "WEBJS_SEND_UNCONFIRMED", envioIncerto: true,
    autoReconectando: !responde,
    error: responde
      ? "O WhatsApp nao confirmou o envio. Confira a conversa antes de reenviar para evitar duplicidade."
      : "O canal ficou sem resposta e a reconexao foi solicitada. O envio nao foi confirmado; confira a conversa antes de reenviar.",
  };
}

async function enviarMidiaWebjs(client, numero, media, opts = {}) {
  let numeroSanitizado = String(numero || "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(numeroSanitizado)) throw new Error("Numero de destino invalido");

  const comTimeout = async (promise, ms, label) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + " timeout " + ms + "ms")), ms); })]); }
    finally { clearTimeout(timer); }
  };
  const ehErroLid = (erro) => {
    const mensagem = String(erro?.message || erro || "").toLowerCase();
    return mensagem.includes("no lid") || mensagem.includes("lid is missing") ||
      mensagem.includes("missing in chat table") || mensagem.includes("chat table") ||
      mensagem.includes("memoize") || mensagem.includes("widfactory");
  };

  // Um LID persistido sem sufixo se parece com telefone. Resolve primeiro o
  // telefone real usando a API oficial da versao instalada do whatsapp-web.js.
  if (/^\d{12,15}$/.test(numeroSanitizado) && !numeroSanitizado.startsWith("55")
      && typeof client.getContactLidAndPhone === "function") {
    try {
      const mapeamentos = await comTimeout(
        client.getContactLidAndPhone([`${numeroSanitizado}@lid`]), 5000, "resolver LID persistido da midia"
      );
      const telefoneReal = String(mapeamentos?.[0]?.pn || "").replace(/\D/g, "");
      if (/^\d{8,15}$/.test(telefoneReal)) numeroSanitizado = telefoneReal;
    } catch (_) {}
  }

  const candidatos = [];
  const adicionarCandidato = (jid, via) => {
    const normalizado = String(jid || "").trim();
    if (!/^\d{8,20}@(c\.us|lid)$/.test(normalizado)) return;
    if (!candidatos.some((item) => item.jid === normalizado)) candidatos.push({ jid: normalizado, via });
  };

  let ultimoErro = null;
  try {
    const destino = await resolverDestinoWebjs(client, numeroSanitizado, { timeoutMs: 15000 });
    adicionarCandidato(destino?.jid, destino?.via || "resolver");
  } catch (erro) {
    ultimoErro = erro;
  }
  adicionarCandidato(`${numeroSanitizado}@c.us`, "telefone");

  for (let indice = 0; indice < candidatos.length; indice += 1) {
    const candidato = candidatos[indice];
    try {
      return await comTimeout(client.sendMessage(candidato.jid, media, opts), 30000, `envio de midia via ${candidato.via}`);
    } catch (erro) {
      ultimoErro = erro;
      // Retenta apenas quando o WhatsApp recusou o JID antes do envio. Nao
      // repete timeout/rede para impedir que a mesma midia seja enviada duas vezes.
      if (!ehErroLid(erro)) throw erro;
      if (typeof client.getContactLidAndPhone === "function") {
        try {
          const mapeamentos = await comTimeout(
            client.getContactLidAndPhone([`${numeroSanitizado}@c.us`]), 8000, "materializar LID da midia"
          );
          adicionarCandidato(mapeamentos?.[0]?.lid, "lid-materializado");
          adicionarCandidato(mapeamentos?.[0]?.pn, "telefone-materializado");
        } catch (_) {}
      }
    }
  }

  throw ultimoErro || new Error("Nao foi possivel resolver o destinatario da midia");
}

function mimePeloNomeArquivo(nome) {
  const ext = path.extname(String(nome || "")).toLowerCase();
  const tipos = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".m4a": "audio/mp4", ".wav": "audio/wav",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
  return tipos[ext] || "application/octet-stream";
}

function normalizarMimeMidia(contentType, filename) {
  const recebido = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  if (recebido && recebido !== "application/octet-stream" && recebido !== "binary/octet-stream") return recebido;
  return mimePeloNomeArquivo(filename);
}

app.post("/enviar-audio", upload.single("audio"), async (req, res) => {
  try {
    const { numero, canalId, workspaceId } = req.body;
    if (!canalId) return res.status(400).json({ success: false, error: "canalId obrigatorio" });
    // 🔒 MULTI-TENANT: workspaceId obrigatório + validação.
    if (!workspaceId) return res.status(400).json({ success: false, error: "workspaceId obrigatório (segurança multi-tenant)" });
    const v = await validarCanalDoWorkspace(canalId, workspaceId);
    if (!v.ok) {
      try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ success: false, error: v.motivo });
    }

    const file = req.file;
    if (!file || !numero) return res.status(400).json({ success: false, error: "Arquivo e número obrigatórios" });

    let sessao = sessoes[canalId];
    if (!sessao) {
      const config = await getConfigCanal(canalId);
      if (!config) return res.status(404).json({ success: false, error: "Canal não encontrado" });
      // 🆕 Suporte WABA — antes era só WebJS. Agora carrega sessão correspondente ao tipo do canal.
      if (config.tipo === "waba") {
        criarSessaoWaba(config);
        sessao = sessoes[canalId];
      } else if (config.tipo === "webjs") {
        if (!sessaoWebjsSalva(canalId)) return res.status(500).json({ success: false, error: "Canal não conectado" });
        console.log(`🔄 Canal ${canalId} (WebJS): restaurando para envio de áudio`);
        criarSessaoWebjs(config);
        sessao = sessoes[canalId];
        for (let i = 0; i < 30; i++) {
          if (sessao.status === "conectado") break;
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        return res.status(500).json({ success: false, error: "Tipo de canal desconhecido" });
      }
    }

    const numeroSanitizado = String(numero).replace(/\D/g, "");
    let providerMessageId = null;
    let filepath = file.path; let filename = file.filename;

    // 🆕 Conversão pra OGG opus serve pros DOIS canais — WABA exige "audio/ogg; codecs=opus"
    // pra mensagem ser exibida como áudio nativo (mensagem de voz), e WebJS já usa esse formato.
    const oggPath = filepath.replace(/\.[^.]+$/, "") + "_converted.ogg";
    const oggFilename = filename.replace(/\.[^.]+$/, "") + "_converted.ogg";
    let audioConvertidoParaOgg = false;
    try {
      const analise = await prepararAudio(filepath, oggPath);
      const streamAudio = { channels: analise.channels, sample_rate: analise.sampleRate };
      const duracao = analise.duracao;
      const tamanhoOgg = fs.statSync(oggPath).size;
      try { fs.unlinkSync(filepath); } catch (e) {}
      filepath = oggPath; filename = oggFilename;
      audioConvertidoParaOgg = true;
      console.log(`🎤 [Canal:${canalId}] Áudio validado: OGG/Opus, ${streamAudio.channels} canal(is), ${streamAudio.sample_rate}Hz, ${duracao.toFixed(2)}s, ${tamanhoOgg} bytes`);
    } catch (convErr) {
      const stderr = convErr.stderr ? convErr.stderr.toString() : "";
      console.error(`❌ [Canal:${canalId}] Conversão de áudio falhou:`, convErr.message, stderr.slice(-500));
      try { if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath); } catch (e) {}
      return res.status(422).json({ success: false, code: convErr.code || "AUDIO_INVALIDO", error: convErr.code ? convErr.message : "Não foi possível validar o som da gravação. Confira o microfone e grave novamente. O áudio não foi enviado." });
    }

    // 🆕 BIFURCAÇÃO: WABA segue caminho próprio (upload + send via Graph API)
    //                WebJS continua exatamente como antes (MessageMedia + sendAudioAsVoice)
    if (sessao.tipo === "waba") {
      try {
        if (!audioConvertidoParaOgg) {
          throw new Error("Não foi possível preparar o áudio no formato OGG/Opus aceito pelo WhatsApp. Verifique o FFmpeg do servidor e grave novamente.");
        }
        // 1) Upload do áudio pro endpoint /media da Meta — igual ao /enviar-midia
        const fileBuffer = fs.readFileSync(filepath);
        const blob = new Blob([fileBuffer], { type: "audio/ogg" });

        const fd = new FormData();
        fd.append("messaging_product", "whatsapp");
        fd.append("type", "audio/ogg");
        fd.append("file", blob, filename);

        const uploadResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/media`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${sessao.configIA.token}` },
          body: fd
        });
        const uploadData = await uploadResp.json();
        if (!uploadResp.ok || uploadData.error || !uploadData.id) {
          console.error(`❌ [Canal:${canalId}] WABA áudio upload falhou:`, JSON.stringify(uploadData));
          throw new Error(formatarErroMetaWaba("upload_audio", uploadData, uploadResp.status));
        }
        const mediaId = uploadData.id;
        console.log(`📤 [Canal:${canalId}] WABA upload áudio OK, media_id=${mediaId}`);

        // 2) Envia mensagem com type=audio + media_id — Meta exibe como mensagem de voz nativa
        const sendResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${sessao.configIA.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: numeroSanitizado,
            type: "audio",
            audio: { id: mediaId, voice: true }
          })
        });
        const sendData = await sendResp.json();
        providerMessageId = sendData.messages?.[0]?.id || null;
        if (!sendResp.ok || sendData.error) {
          // Erros típicos:
          //  (#131047) Re-engagement message — passou da janela de 24h, precisa template antes
          //  (#131026) Message undeliverable — número não tem WhatsApp
          console.error(`❌ [Canal:${canalId}] WABA áudio envio falhou:`, JSON.stringify(sendData));
          throw new Error(formatarErroMetaWaba("send_audio", sendData, sendResp.status));
        }
        console.log(`✅ [Canal:${canalId}] WABA áudio enviado pra ${numeroSanitizado}`);
      } catch (e) {
        console.error(`❌ [Canal:${canalId}] WABA áudio erro detalhado:`, e.message);
        try { fs.unlinkSync(filepath); } catch (eDel) {}
        return res.status(500).json({ success: false, error: "WABA: " + e.message });
      }

      // Move o arquivo pra /audios pra preview no chat (mesma lógica do WebJS)
      const finalName = filename;
      // arquivo já tá em AUDIOS_DIR porque o multer salva lá; só salvamos no banco e respondemos
      await salvarEnvioMidia({
        numero: numeroSanitizado,
        mensagem: `[audio:${finalName}]`,
        de: "humano",
      provider_message_id: providerMessageId,
      status_entrega: obterStatusRecibo(workspaceId, canalId, providerMessageId) || "enviado",
        workspace_id: sessao.workspaceId,
        canal_id: parseInt(canalId)
      }, sessao);
      console.log(`🎤 [Canal:${canalId}] Áudio WABA enviado: ${finalName}`);
      return res.json({ success: true, filename: finalName, canal: "waba" });
    }

    // ─── WebJS (caminho original, intacto) ───
    if (!sessao?.client || sessao.tipo !== "webjs") return res.status(500).json({ success: false, error: "Sessão WebJS não disponível" });
    const media = MessageMedia.fromFilePath(filepath);
    media.mimetype = "audio/ogg; codecs=opus";
    let enviado = false;
    try { await restaurarDestinoPersistidoWebjs(sessao.client, workspaceId, canalId, numeroSanitizado); const enviada = await enviarMidiaWebjs(sessao.client, numeroSanitizado, media, { sendAudioAsVoice: true }); providerMessageId = enviada?.id?._serialized || null; if (providerMessageId) memorizarRecibo(workspaceId, canalId, providerMessageId, enviada.ack ?? 1); enviado = true; }
    catch (e2) {
        console.error("[Canal:" + canalId + "] Falha no envio de audio:", e2.message);
        const falha = await tratarFalhaEnvioWebjs(e2, sessao, canalId, "envio de audio");
        if (falha) {
          try { fs.unlinkSync(filepath); } catch (_) {}
          return res.status(503).json(falha);
        }
        return res.status(500).json({ success: false, error: e2.message });
    }
    if (enviado) {
      await salvarEnvioMidia({ numero: numeroSanitizado, mensagem: `[audio:${filename}]`, de: "humano", provider_message_id: providerMessageId, status_entrega: obterStatusRecibo(workspaceId, canalId, providerMessageId) || "enviado", workspace_id: sessao.workspaceId, canal_id: canalId }, sessao);
      console.log(`🎤 [Canal:${canalId}] Áudio enviado: ${filename}`);
      res.json({ success: true, filename, canal: "webjs" });
    }
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 🆕 ENVIAR MÍDIA — aceita qualquer arquivo (imagem/vídeo/PDF/Excel/doc) via FormData.
app.post("/enviar-midia", upload.single("arquivo"), async (req, res) => {
  try {
    const { numero, canalId, legenda, workspaceId } = req.body;
    const file = req.file;
    if (!canalId) return res.status(400).json({ success: false, error: "canalId obrigatorio" });
    // 🔒 MULTI-TENANT: workspaceId obrigatório + validação.
    if (!workspaceId) {
      try { if (file?.path) fs.unlinkSync(file.path); } catch (e) {}
      return res.status(400).json({ success: false, error: "workspaceId obrigatório (segurança multi-tenant)" });
    }
    const v = await validarCanalDoWorkspace(canalId, workspaceId);
    if (!v.ok) {
      try { if (file?.path) fs.unlinkSync(file.path); } catch (e) {}
      return res.status(403).json({ success: false, error: v.motivo });
    }
    if (!file || !numero) return res.status(400).json({ success: false, error: "Arquivo e número obrigatórios" });

    let sessao = sessoes[canalId];
    if (!sessao) {
      const config = await getConfigCanal(canalId);
      if (!config) return res.status(404).json({ success: false, error: "Canal não encontrado" });
      if (config.tipo === "waba") {
        criarSessaoWaba(config);
        sessao = sessoes[canalId];
      } else if (config.tipo === "webjs" && sessaoWebjsSalva(canalId)) {
        criarSessaoWebjs(config);
        sessao = sessoes[canalId];
        for (let i = 0; i < 30; i++) {
          if (sessao.status === "conectado") break;
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        return res.status(500).json({ success: false, error: "Canal não conectado" });
      }
    }

    const numeroSanitizado = String(numero).replace(/\D/g, "");
    let providerMessageId = null;
    const filepath = file.path;
    const filename = file.originalname || file.filename;
    const mimetype = file.mimetype || "application/octet-stream";
    console.log(`📎 [Canal:${canalId}/${sessao.nome}] Enviando mídia "${filename}" (${mimetype}) para ${numeroSanitizado}`);

    const ehImagem = mimetype.startsWith("image/");
    const ehVideo = mimetype.startsWith("video/");
    const ehAudio = mimetype.startsWith("audio/");
    const tipoMidia = ehImagem ? "image" : ehVideo ? "video" : ehAudio ? "audio" : "document";

    // 🆕 VALIDAÇÃO POR TIPO — limites reais do WhatsApp (defesa em profundidade caso frontend seja burlado)
    // Imagem: 5MB · Vídeo: 16MB · Áudio: 16MB · Documento: 100MB
    const tamanhoMB = file.size / 1024 / 1024;
    const limiteMB = ehImagem ? 5 : (ehVideo || ehAudio) ? 16 : 100;
    if (tamanhoMB > limiteMB) {
      try { fs.unlinkSync(filepath); } catch (e) {}
      const tipoLabel = ehImagem ? "imagem" : ehVideo ? "vídeo" : ehAudio ? "áudio" : "documento";
      console.warn(`⚠️ [/enviar-midia] Arquivo rejeitado: ${tipoLabel} de ${tamanhoMB.toFixed(1)}MB > limite ${limiteMB}MB`);
      return res.status(400).json({
        success: false,
        error: `${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} muito grande (${tamanhoMB.toFixed(1)}MB). WhatsApp aceita até ${limiteMB}MB pra ${tipoLabel}.`
      });
    }

    if (sessao.tipo === "waba") {
      try {
        const fileBuffer = fs.readFileSync(filepath);
        const blob = new Blob([fileBuffer], { type: mimetype });

        const fd = new FormData();
        fd.append("messaging_product", "whatsapp");
        fd.append("type", mimetype);
        fd.append("file", blob, filename);

        const uploadResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/media`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${sessao.configIA.token}` },
          body: fd
        });
        const uploadData = await uploadResp.json();
        if (uploadData.error || !uploadData.id) {
          throw new Error(uploadData.error?.message || "Upload WABA falhou: " + JSON.stringify(uploadData));
        }
        const mediaId = uploadData.id;
        console.log(`📤 [Canal:${canalId}] WABA upload OK, media_id=${mediaId}`);

        const body = {
          messaging_product: "whatsapp",
          to: numeroSanitizado,
          type: tipoMidia,
          [tipoMidia]: { id: mediaId }
        };
        if (legenda && (ehImagem || ehVideo || tipoMidia === "document")) {
          body[tipoMidia].caption = legenda;
        }
        if (tipoMidia === "document") body[tipoMidia].filename = filename;

        const sendResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${sessao.configIA.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const sendData = await sendResp.json();
        providerMessageId = sendData.messages?.[0]?.id || null;
        if (sendData.error) throw new Error(sendData.error.message);
        console.log(`✅ [Canal:${canalId}] WABA mídia enviada (${tipoMidia})`);
      } catch (e) {
        console.error(`❌ [Canal:${canalId}] WABA mídia erro:`, e.message);
        try { fs.unlinkSync(filepath); } catch (eDel) {}
        return res.status(500).json({ success: false, error: "WABA: " + e.message });
      }
    } else {
      if (!sessao.client || sessao.status !== "conectado") {
        try { fs.unlinkSync(filepath); } catch (e) {}
        return res.status(500).json({ success: false, error: "Canal WebJS desconectado" });
      }
      try {
        const media = MessageMedia.fromFilePath(filepath);
        media.filename = filename;
        const opts = legenda ? { caption: legenda } : {};
        await restaurarDestinoPersistidoWebjs(sessao.client, workspaceId, canalId, numeroSanitizado);
        const enviada = await enviarMidiaWebjs(sessao.client, numeroSanitizado, media, opts);
        providerMessageId = enviada?.id?._serialized || null;
        if (providerMessageId) memorizarRecibo(workspaceId, canalId, providerMessageId, enviada.ack ?? 1);
        console.log(`✅ [Canal:${canalId}] WebJS mídia enviada (${tipoMidia})`);
      } catch (e) {
        console.error(`❌ [Canal:${canalId}] WebJS mídia erro:`, e.message);
        try { fs.unlinkSync(filepath); } catch (eDel) {}

        const falha = await tratarFalhaEnvioWebjs(e, sessao, canalId, "envio de midia");
        if (falha) return res.status(503).json(falha);

        return res.status(500).json({ success: false, error: e.message });
      }
    }

    const finalName = `midia_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${filename.replace(/[^\w.-]/g, "_")}`;
    const finalPath = path.join(AUDIOS_DIR, finalName);
    try { fs.renameSync(filepath, finalPath); } catch (e) {
      try { fs.copyFileSync(filepath, finalPath); fs.unlinkSync(filepath); } catch (e2) {}
    }

    const prefixo = ehImagem ? "[img:" : ehVideo ? "[video:" : ehAudio ? "[audio:" : "[file:";
    const mensagemSalva = `${prefixo}${finalName}]${legenda ? `\n${legenda}` : ""}`;

    await salvarEnvioMidia({
      numero: numeroSanitizado,
      mensagem: mensagemSalva,
      de: "humano",
      provider_message_id: providerMessageId,
      status_entrega: obterStatusRecibo(workspaceId, canalId, providerMessageId) || "enviado",
      workspace_id: sessao.workspaceId,
      canal_id: parseInt(canalId)
    }, sessao);

    res.json({ success: true, tipo: tipoMidia, filename: finalName });
  } catch (error) {
    console.error("❌ /enviar-midia:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🆕 ENVIAR MÍDIA POR URL — usado pelas Respostas Rápidas com mídia pré-anexada.
// O arquivo já está no Supabase Storage (bucket respostas-rapidas-midia, pasta /{workspaceId}/).
// O backend baixa a URL, salva em disco temporariamente e usa o mesmo fluxo do /enviar-midia.
// 🔒 MULTI-TENANT: workspaceId obrigatório + validação de canal igual ao /enviar-midia.
app.post("/enviar-midia-url", async (req, res) => {
  const tmpPath = path.join(AUDIOS_DIR, `tmp_resprapida_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  try {
    const { midiaUrl, midiaNome, numero, canalId, workspaceId, legenda } = req.body;
    if (!midiaUrl || !numero || !canalId || !workspaceId) {
      return res.status(400).json({ success: false, error: "midiaUrl, numero, canalId e workspaceId são obrigatórios" });
    }

    // 🔒 MULTI-TENANT: valida que o canal pertence ao workspace informado
    const v = await validarCanalDoWorkspace(canalId, workspaceId);
    if (!v.ok) return res.status(403).json({ success: false, error: v.motivo });

    // 🔒 MULTI-TENANT: valida que a URL pertence ao workspace (path começa com /{workspaceId}/)
    // Impede que um workspace tente mandar mídia de outro workspace só mudando a URL.
    const urlCheck = decodeURIComponent(midiaUrl);
    if (!urlCheck.includes(`/respostas-rapidas-midia/${workspaceId}/`)) {
      console.warn(`⚠️ [/enviar-midia-url] URL suspeita (workspaceId=${workspaceId}): ${midiaUrl}`);
      return res.status(403).json({ success: false, error: "Acesso negado: mídia não pertence a este workspace" });
    }

    // Baixa o arquivo da URL do Storage pro disco temporário
    console.log(`📥 [/enviar-midia-url] Baixando mídia: ${midiaNome || midiaUrl}`);
    const fetchResp = await fetch(midiaUrl);
    if (!fetchResp.ok) return res.status(502).json({ success: false, error: `Não foi possível baixar a mídia: HTTP ${fetchResp.status}` });

    const contentType = fetchResp.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await fetchResp.arrayBuffer());
    if (!buffer.length) return res.status(502).json({ success: false, error: "A midia baixada esta vazia" });
    fs.writeFileSync(tmpPath, buffer);

    const filename = midiaNome || path.basename(new URL(midiaUrl).pathname);
    const mimetype = normalizarMimeMidia(contentType, filename);
    if (/^(text\/html|application\/json|text\/plain)$/.test(mimetype)) {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      return res.status(502).json({ success: false, error: "O endereco da midia retornou " + mimetype + ", nao o arquivo solicitado" });
    }
    const tamanhoMB = buffer.length / 1024 / 1024;

    const ehImagem = mimetype.startsWith("image/");
    const ehVideo = mimetype.startsWith("video/");
    const ehAudio = mimetype.startsWith("audio/");
    const tipoMidia = ehImagem ? "image" : ehVideo ? "video" : ehAudio ? "audio" : "document";

    // Mesmos limites do /enviar-midia
    const limiteMB = ehImagem ? 5 : (ehVideo || ehAudio) ? 16 : 100;
    if (tamanhoMB > limiteMB) {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      return res.status(400).json({ success: false, error: `Arquivo muito grande (${tamanhoMB.toFixed(1)}MB). Limite: ${limiteMB}MB.` });
    }

    let sessao = sessoes[canalId];
    if (!sessao) {
      const config = await getConfigCanal(canalId);
      if (!config) { try { fs.unlinkSync(tmpPath); } catch (e) {} return res.status(404).json({ success: false, error: "Canal não encontrado" }); }
      if (config.tipo === "waba") { criarSessaoWaba(config); sessao = sessoes[canalId]; }
      else if (config.tipo === "webjs" && sessaoWebjsSalva(canalId)) {
        criarSessaoWebjs(config); sessao = sessoes[canalId];
        for (let i = 0; i < 30; i++) { if (sessao.status === "conectado") break; await new Promise(r => setTimeout(r, 500)); }
      } else { try { fs.unlinkSync(tmpPath); } catch (e) {} return res.status(500).json({ success: false, error: "Canal não conectado" }); }
    }

    const numeroSanitizado = String(numero).replace(/\D/g, "");
    let providerMessageId = null;
    console.log(`📎 [Canal:${canalId}] Resposta rápida c/ mídia "${filename}" (${mimetype}) → ${numeroSanitizado}`);

    if (sessao.tipo === "waba") {
      const fileBuffer = fs.readFileSync(tmpPath);
      const blob = new Blob([fileBuffer], { type: mimetype });
      const fd = new FormData();
      fd.append("messaging_product", "whatsapp");
      fd.append("type", mimetype);
      fd.append("file", blob, filename);
      const uploadResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/media`, {
        method: "POST", headers: { "Authorization": `Bearer ${sessao.configIA.token}` }, body: fd
      });
      const uploadData = await uploadResp.json();
      if (uploadData.error || !uploadData.id) throw new Error(uploadData.error?.message || "Upload WABA falhou");
      const body = { messaging_product: "whatsapp", to: numeroSanitizado, type: tipoMidia, [tipoMidia]: { id: uploadData.id } };
      if (legenda && (ehImagem || ehVideo || tipoMidia === "document")) body[tipoMidia].caption = legenda;
      if (tipoMidia === "document") body[tipoMidia].filename = filename;
      const sendResp = await fetch(`https://graph.facebook.com/v19.0/${sessao.configIA.phone_number_id}/messages`, {
        method: "POST", headers: { "Authorization": `Bearer ${sessao.configIA.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const sendData = await sendResp.json();
        providerMessageId = sendData.messages?.[0]?.id || null;
      if (sendData.error) throw new Error(sendData.error.message);
      console.log(`✅ [Canal:${canalId}] Resposta rápida WABA mídia enviada (${tipoMidia})`);
    } else {
      if (!sessao.client || sessao.status !== "conectado") {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        return res.status(500).json({ success: false, error: "Canal WebJS desconectado" });
      }
      // O temporario nao possui extensao. fromFilePath(tmpPath) inferia
      // application/octet-stream e fazia videos MP4 chegarem como "Sem titulo".
      // Envia o buffer com MIME e nome originais.
      const media = new MessageMedia(mimetype, buffer.toString("base64"), filename);
      const opts = legenda ? { caption: legenda } : {};
      await restaurarDestinoPersistidoWebjs(sessao.client, workspaceId, canalId, numeroSanitizado);
        const enviada = await enviarMidiaWebjs(sessao.client, numeroSanitizado, media, opts);
        providerMessageId = enviada?.id?._serialized || null;
        if (providerMessageId) memorizarRecibo(workspaceId, canalId, providerMessageId, enviada.ack ?? 1);
      console.log(`✅ [Canal:${canalId}] Resposta rápida WebJS mídia enviada (${tipoMidia})`);
    }

    // Salva no histórico de mensagens
    const finalName = `midia_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${filename.replace(/[^\w.-]/g, "_")}`;
    const finalPath = path.join(AUDIOS_DIR, finalName);
    try { fs.renameSync(tmpPath, finalPath); } catch (e) {
      try { fs.copyFileSync(tmpPath, finalPath); fs.unlinkSync(tmpPath); } catch (e2) { try { fs.unlinkSync(tmpPath); } catch (e3) {} }
    }
    const prefixo = ehImagem ? "[img:" : ehVideo ? "[video:" : ehAudio ? "[audio:" : "[file:";
    const mensagemSalva = `${prefixo}${finalName}]${legenda ? `\n${legenda}` : ""}`;
    await salvarEnvioMidia({
      numero: numeroSanitizado,
      mensagem: mensagemSalva,
      de: "humano",
      provider_message_id: providerMessageId,
      status_entrega: obterStatusRecibo(workspaceId, canalId, providerMessageId) || "enviado",
      workspace_id: sessao.workspaceId,
      canal_id: parseInt(canalId)
    }, sessao);

    res.json({ success: true, tipo: tipoMidia, filename: finalName });
  } catch (error) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
    console.error("❌ /enviar-midia-url:", error.message);
    const falha = await tratarFalhaEnvioWebjs(error, sessoes[req.body.canalId], req.body.canalId, "envio de midia por URL");
    if (falha) return res.status(503).json(falha);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🆕 ENVIAR TEMPLATE — dispara template aprovado pra um único contato.
app.post("/enviar-template", async (req, res) => {
  try {
    const { numero, canalId, templateId, variaveis, workspaceId } = req.body;
    if (!canalId || !templateId || !numero) {
      return res.status(400).json({ success: false, error: "canalId, templateId e numero obrigatórios" });
    }
    // 🔒 MULTI-TENANT: workspaceId obrigatório + valida canal E template.
    // Antes, atacante podia usar canal/template alheios pra enviar mensagem em nome do cliente.
    if (!workspaceId) return res.status(400).json({ success: false, error: "workspaceId obrigatório (segurança multi-tenant)" });
    const vc = await validarCanalDoWorkspace(canalId, workspaceId);
    if (!vc.ok) return res.status(403).json({ success: false, error: vc.motivo });
    const vt = await validarTemplateDoWorkspace(templateId, workspaceId);
    if (!vt.ok) return res.status(403).json({ success: false, error: vt.motivo });

    // 🆕 FIX: o helper validarTemplateDoWorkspace retorna o template com campos limitados
    // (id, workspace_id, canal_id, meta_template_name, idioma, etc) — NÃO traz `status`.
    // Antes, isso fazia template.status ser undefined e o código rejeitar como "não aprovado"
    // mesmo quando o template estava aprovado de verdade. Recarrega o registro completo.
    const { data: template } = await supabase.from("templates_waba").select("*").eq("id", templateId).single();
    if (!template) return res.status(404).json({ success: false, error: "Template não encontrado" });
    if (template.status !== "aprovado") return res.status(400).json({ success: false, error: `Template não aprovado (status: ${template.status})` });

    const { data: canal } = await supabase.from("conexoes").select("*").eq("id", canalId).eq("tipo", "waba").single();
    if (!canal || !canal.phone_number_id || !canal.token_waba) {
      return res.status(400).json({ success: false, error: "Canal WABA sem credenciais" });
    }

    // 🆕 Reaproveita o template já carregado acima (antes era uma 2ª query desnecessária)
    const tplFull = template;

    const numeroSanitizado = String(numero).replace(/\D/g, "");
    const varsInput = variaveis || {};

    const components = [];
    for (const comp of tplFull?.componentes || []) {
      if (comp.type === "BODY" && comp.text) {
        const vars = [...(comp.text.matchAll(/\{\{(\d+)\}\}/g) || [])].map(m => m[1]);
        if (vars.length > 0) {
          components.push({
            type: "body",
            parameters: vars.map(varNum => ({
              type: "text",
              text: String(varsInput[varNum] ?? `{{${varNum}}}`)
            }))
          });
        }
      }
      if (comp.type === "HEADER" && comp.format === "TEXT" && comp.text) {
        const vars = [...(comp.text.matchAll(/\{\{(\d+)\}\}/g) || [])].map(m => m[1]);
        if (vars.length > 0) {
          components.push({
            type: "header",
            parameters: vars.map(varNum => ({
              type: "text",
              text: String(varsInput[varNum] ?? `{{${varNum}}}`)
            }))
          });
        }
      }
    }

    const configEnvio = { phone_number_id: canal.phone_number_id, token: canal.token_waba };
    const respostaMeta = await enviarTemplateWaba(configEnvio, numeroSanitizado, template.meta_template_name, template.idioma, components);
    const providerMessageId = respostaMeta?.messages?.[0]?.id || null;

    let previewMsg = `[Template: ${tplFull?.nome_amigavel || template.meta_template_name}]`;
    try {
      const bodyComp = (tplFull?.componentes || []).find(c => c.type === "BODY");
      if (bodyComp?.text) {
        previewMsg = bodyComp.text.replace(/\{\{(\d+)\}\}/g, (match, num) => varsInput[num] ?? match);
      }
    } catch (e) {}

    await supabase.from("mensagens").insert([{
      numero: numeroSanitizado,
      mensagem: previewMsg,
      de: "humano",
      workspace_id: workspaceId,
      canal_id: parseInt(canalId),
      provider_message_id: providerMessageId,
      status_entrega: "enviado"
    }]);

    console.log(`📋 [Canal:${canalId}] Template "${template.meta_template_name}" enviado pra ${numeroSanitizado} (wamid: ${providerMessageId?.substring(0, 20)}...)`);
    res.json({ success: true, template: template.meta_template_name, provider_message_id: providerMessageId });
  } catch (error) {
    console.error("❌ /enviar-template:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
  ctx.enviarMidiaWebjs = enviarMidiaWebjs;
  ctx.restaurarDestinoPersistidoWebjs = restaurarDestinoPersistidoWebjs;
  return ctx;
};
