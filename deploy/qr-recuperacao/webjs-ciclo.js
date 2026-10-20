"use strict";

// Proteção por Client: não altera o handler global de unhandledRejection.
function protegerCicloWebjs(client, { ativo, falhou, diagnostico = () => {} }) {
  if (typeof client.inject !== "function") return;
  let encerrando = false;
  let emAndamento = null;
  let falhaReportada = false;
  const paginas = new WeakSet();
  const browsers = new WeakSet();
  const atual = () => !encerrando && ativo();
  const reportar = async (origem, erro) => {
    if (!atual() || falhaReportada) return;
    falhaReportada = true;
    try { await falhou(origem, erro); }
    catch (falha) { diagnostico("falha ao recuperar: " + falha.message); }
  };
  const destroyOriginal = client.destroy?.bind(client);
  if (destroyOriginal) client.destroy = (...args) => {
    encerrando = true; // antes de fechar a página, inclusive em reconexões manuais.
    return destroyOriginal(...args);
  };

  function protegerPagina() {
    const page = client.pupPage;
    if (page?.on && !paginas.has(page)) {
      paginas.add(page);
      const onOriginal = page.on.bind(page);
      // A biblioteca registra este callback depois do primeiro inject(). O
      // EventEmitter não captura rejeições de callbacks async por conta própria.
      page.on = (evento, callback) => {
        if (evento !== "framenavigated") return onOriginal(evento, callback);
        return onOriginal(evento, async (...args) => {
          if (!atual()) return;
          const frame = args[0];
          if (frame && page.mainFrame && frame !== page.mainFrame()) return;
          try { await callback(...args); }
          catch (erro) { await reportar("navegacao", erro); }
        });
      };
      onOriginal("close", () => { void reportar("pagina_fechada", new Error("Página do WhatsApp fechada")); });
      onOriginal("error", erro => { void reportar("pagina_crash", erro); });
    }
    const browser = client.pupBrowser;
    if (browser?.on && !browsers.has(browser)) {
      browsers.add(browser);
      browser.on("disconnected", () => { void reportar("browser_desconectado", new Error("Chromium desconectado")); });
      const processo = browser.process?.();
      processo?.once?.("exit", (codigo, sinal) => diagnostico(`Chromium encerrou: codigo=${codigo}, sinal=${sinal || "nenhum"}, intencional=${!atual()}`));
    }
  }

  const injectOriginal = client.inject.bind(client);
  client.inject = (...args) => {
    protegerPagina();
    if (!atual()) return Promise.resolve();
    if (emAndamento) return emAndamento;
    emAndamento = (async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        if (!atual()) return;
        if (client.pupPage?.isClosed?.()) throw new Error("Página do WhatsApp fechada antes de inject");
        try { return await injectOriginal(...args); }
        catch (erro) {
          if (!atual()) return; // Client foi substituído ou encerrado durante a operação.
          const transitorio = /Execution context was destroyed|Cannot find context|detached Frame/i.test(String(erro?.message || erro));
          if (!transitorio || client.pupPage?.isClosed?.() || tentativa === 3) throw erro;
          await new Promise(resolve => setTimeout(resolve, tentativa * 400));
        }
      }
    })().finally(() => { emAndamento = null; });
    return emAndamento;
  };
}
module.exports = { protegerCicloWebjs };
