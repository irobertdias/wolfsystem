"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { protegerCicloWebjs } = require("./webjs-ciclo.js");
function fixture(inject = async () => {}) {
  const frame = {};
  const page = Object.assign(new EventEmitter(), { isClosed: () => false, mainFrame: () => frame });
  const browser = Object.assign(new EventEmitter(), { process: () => null });
  const falhas = [];
  let ativa = true;
  const client = { pupPage: page, pupBrowser: browser, inject, destroy: async () => { page.emit("close"); browser.emit("disconnected"); } };
  protegerCicloWebjs(client, { ativo: () => ativa, falhou: async (...args) => { falhas.push(args); } });
  return { client, page, browser, frame, falhas, substituir: () => { ativa = false; } };
}
test("inject concorrente é compartilhado; instância substituída não executa novamente", async () => {
  let chamadas = 0;
  const f = fixture(async () => { chamadas++; });
  await Promise.all([f.client.inject(), f.client.inject()]);
  assert.equal(chamadas, 1);
  f.substituir(); await f.client.inject();
  assert.equal(chamadas, 1);
});
test("frame transitório é repetido, mas não vira queda do canal", async () => {
  let chamadas = 0;
  const f = fixture(async () => { if (++chamadas === 1) throw Error("Attempted to use detached Frame"); });
  await f.client.inject();
  assert.equal(chamadas, 2);
  assert.equal(f.falhas.length, 0);
});
test("callback async da biblioteca não deixa TargetCloseError sem tratamento", async () => {
  const f = fixture(); await f.client.inject();
  f.page.on("framenavigated", async () => { throw Error("Protocol error (Runtime.evaluate): Target closed"); });
  await f.page.listeners("framenavigated")[0](f.frame);
  f.page.emit("close"); f.browser.emit("disconnected");
  assert.equal(f.falhas.length, 1);
  assert.equal(f.falhas[0][0], "navegacao");
});
test("navegação de iframe não reinjeta a página principal", async () => {
  const f = fixture(); await f.client.inject(); let chamadas = 0;
  f.page.on("framenavigated", async () => { chamadas++; });
  const callback = f.page.listeners("framenavigated")[0];
  await callback({}); assert.equal(chamadas, 0);
  await callback(f.frame); assert.equal(chamadas, 1);
});
test("encerramento intencional não dispara reconexão nem inject atrasado", async () => {
  let chamadas = 0;
  const f = fixture(async () => { chamadas++; }); await f.client.inject();
  await f.client.destroy(); await f.client.inject();
  assert.equal(chamadas, 1); assert.equal(f.falhas.length, 0);
});
test("página fechada rejeita inicialização para o tratamento existente; crash é reportado", async () => {
  const f = fixture(); f.page.isClosed = () => true;
  await assert.rejects(f.client.inject(), /fechada antes de inject/);
  f.page.emit("error", Error("Page crashed!"));
  assert.equal(f.falhas.length, 1); assert.equal(f.falhas[0][0], "pagina_crash");
});
