const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function carregar(arquivo, extras = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", arquivo), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Response, Blob, FormData, process: { env: {} }, ...extras });
  return exports;
}
const audio = carregar("app/lib/audio-envio.ts");
const { traduzirErro } = carregar("app/lib/traduzir_erro.ts");
test("respostas de falha nunca confirmam envio", async () => {
  await assert.rejects(audio.lerRespostaAudio(new Response("Payload too large", { status: 413 })), /limite/);
  await assert.rejects(audio.lerRespostaAudio(new Response("<html>erro</html>", { status: 502 })), /resposta válida/);
  await assert.rejects(audio.lerRespostaAudio(Response.json({ success: true }, { status: 500 })), /Não foi possível/);
  await assert.rejects(audio.lerRespostaAudio(Response.json({ success: false, error: "canal desconectado" })), /canal desconectado/);
});
test("aceita contratos WhatsApp e Meta", async () => {
  await audio.lerRespostaAudio(Response.json({ success: true }));
  await audio.lerRespostaAudio(Response.json({ sucesso: true }));
});
test("traduz a falha de ID sem expor stack do WhatsApp", () => {
  const message = traduzirErro("Data passed to getter must include an id property (it's how we memoize) but got undefined (https://static.whatsapp.net/example.js:85:180)");
  assert.match(message, /Falha interna.*WhatsApp Web/);
  assert.doesNotMatch(message, /undefined|https/);
});
for (const [mime, ext] of [["audio/webm;codecs=opus", "webm"], ["audio/ogg;codecs=opus", "ogg"], ["audio/mp4", "m4a"]]) {
  test(`proxy preserva bytes, MIME e extensao de ${mime}`, async () => {
    let calls = 0;
    const route = carregar("app/api/whatsapp-audio/route.ts", {
      require(name) {
        if (name === "next/server") return { NextResponse: Response };
        if (name.includes("audio-envio")) return audio;
        if (name === "../_auth") return {
          autenticarWorkspace: async () => ({ workspaceId: "autenticado" }),
          exigirPermissao() {}, exigirAtendimentoDoUsuario: async () => {},
          segredoInternoWolf: () => "test-secret",
          respostaErroAcesso: (err) => ({ message: err.message, status: 500 }),
        };
        throw new Error(name);
      },
      fetch: async (url, init) => {
        calls++;
        const file = init.body.get("audio");
        assert.ok(file.name.endsWith(`.${ext}`));
        assert.equal(file.type, mime);
        assert.equal(await file.text(), "audio-bytes");
        assert.equal(init.body.get("workspaceId"), "autenticado");
        assert.equal(init.body.get("numero"), "5511999999999");
        assert.equal(init.body.get("canalId"), "7");
        return Response.json({ success: true });
      },
    });
    const form = new FormData();
    form.append("audio", new Blob(["audio-bytes"], { type: mime }));
    form.append("numero", "5511999999999"); form.append("canalId", "7");
    const response = await route.POST({ formData: async () => form });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    for (const invalid of ["string-invalida", new Blob([])]) {
      form.set("audio", invalid);
      assert.equal((await route.POST({ formData: async () => form })).status, 400);
    }
    assert.equal(calls, 1);
  });
}
