"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Card, Btn, Pill, Vazio, C } from "../../financeiro/_sections/_ui";
import { etapa, rev, calcular, honorariosPrevistos, beneficioDoContrato, brl, dataBR, hoje, type Contrato } from "../_dados";
import Icone from "../../../components/a2/Icone";

// Ficha completa do cliente no CRM financeiro: contratos, cálculo, honorários,
// propostas enviadas, contratos assinados, atendimentos e linha do tempo.

const soDig = (s?: string | null) => String(s || "").replace(/\D/g, "");
const chaveCliente = (c: { cpf?: string | null; nome?: string | null }) => soDig(c.cpf) || `nome:${String(c.nome || "").trim().toLowerCase()}`;
const docFmt = (d = "") => d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : d;
const telFmt = (t = "") => { const s = soDig(t).replace(/^55(?=\d{10,11}$)/, ""); return s.length === 11 ? s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : s.length === 10 ? s.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") : t; };
const iniciais = (n = "") => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

async function token() { const { data: { session } } = await supabase.auth.getSession(); return session?.access_token || ""; }

export default function Clientes({ dados, ir, alvo }: any) {
  const { wsId, contratos, cfg, carregando } = dados;
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string>("");
  const [propostas, setPropostas] = useState<any[]>([]);

  // propostas da Análise contratual (para ligar ao cliente pelo CPF)
  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const t = await token();
      const r = await fetch(`/api/revisional/propostas?workspace=${encodeURIComponent(wsId)}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
      const j = r && r.ok ? await r.json() : null;
      setPropostas(j?.propostas || []);
    })();
  }, [wsId]);

  const clientes = useMemo(() => {
    const mapa = new Map<string, { chave: string; nome: string; cpf: string; telefone: string; email: string; cidade: string; contratos: Contrato[]; beneficio: number; honorarios: number; ultimo: string }>();
    for (const c of contratos as Contrato[]) {
      const k = chaveCliente(c);
      const calc0 = calcular(rev(c), c.plano, cfg);
      const calc = { ...calc0, beneficio: beneficioDoContrato(c, calc0) };
      const hon = honorariosPrevistos(rev(c), calc, cfg);
      const atual = mapa.get(k) || { chave: k, nome: c.nome, cpf: soDig(c.cpf), telefone: c.telefone1 || "", email: c.email || "", cidade: [c.cidade, c.estado].filter(Boolean).join(" / "), contratos: [], beneficio: 0, honorarios: 0, ultimo: "" };
      atual.contratos.push(c);
      atual.beneficio += calc.beneficio;
      atual.honorarios += hon.total;
      atual.telefone ||= c.telefone1 || ""; atual.email ||= c.email || "";
      const quando = c.updated_at || c.created_at;
      if (quando > atual.ultimo) atual.ultimo = quando;
      mapa.set(k, atual);
    }
    return [...mapa.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  }, [contratos, cfg]);

  useEffect(() => {
    if (alvo?.contratoId) {
      const c = (contratos as Contrato[]).find((x) => x.id === alvo.contratoId);
      if (c) setSel(chaveCliente(c));
    }
  }, [alvo?.t]);

  const termo = busca.trim().toLowerCase();
  const lista = clientes.filter((c) => !termo || `${c.nome} ${c.cpf} ${c.telefone}`.toLowerCase().includes(termo) || (soDig(termo) && c.cpf.includes(soDig(termo))));
  const cliente = clientes.find((c) => c.chave === sel) || null;

  return (
    <Page>
      <PageHeader titulo="Clientes" subtitulo={`${clientes.length} cliente(s) · ficha completa com contratos, propostas, honorários e atendimentos`}
        acao={<Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn>} />

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* lista */}
        <div style={{ flex: "1 1 300px", maxWidth: cliente ? 360 : "none", background: "#fff", borderRadius: 20, boxShadow: SOMBRA, overflow: "hidden" }}>
          <div style={{ padding: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, height: 44, borderRadius: 13, background: "#F3F6F5", padding: "0 14px", color: "#64748B" }}>
              <Icone nome="busca" tamanho={16} />
              <input className="a2-input-limpo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF ou telefone"
                style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 14, fontWeight: 600, color: "#0F172A" }} />
            </label>
          </div>
          {carregando ? <div style={{ padding: 24, color: "#94A3B8", fontSize: 14 }}>Carregando…</div>
            : lista.length === 0 ? <Vazio icone="👥" titulo={busca ? "Nada encontrado" : "Nenhum cliente ainda"} sub={busca ? "Tente outro nome ou CPF." : "Os clientes aparecem quando você cadastra um contrato ou quando uma proposta é aceita."} />
            : (
              <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
                {lista.map((c) => {
                  const ativo = c.chave === sel;
                  const e = etapa(c.contratos[0]?.status_venda);
                  return (
                    <button key={c.chave} onClick={() => setSel(c.chave)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: 0, borderTop: "1px solid #F1F5F4", cursor: "pointer", textAlign: "left", background: ativo ? "#FFFBEB" : "#fff" }}>
                      <span style={{ width: 38, height: 38, borderRadius: 12, background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{iniciais(c.nome)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: 14, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</b>
                        <span style={{ fontSize: 12.5, color: "#64748B" }}>{c.contratos.length} contrato(s) · {e.label}</span>
                      </span>
                      <b style={{ fontSize: 13, color: "#047857", whiteSpace: "nowrap" }}>{c.beneficio ? brl(c.beneficio) : ""}</b>
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {/* ficha */}
        {cliente && <Ficha cliente={cliente} wsId={wsId} cfg={cfg} propostas={propostas} ir={ir} fechar={() => setSel("")} />}
      </div>
    </Page>
  );
}

function Ficha({ cliente, wsId, cfg, propostas, ir, fechar }: any) {
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [assinados, setAssinados] = useState<any[]>([]);

  const props = propostas.filter((p: any) => (cliente.cpf && soDig(p.cliente_documento) === cliente.cpf) || p.cliente_nome?.trim().toLowerCase() === cliente.nome.trim().toLowerCase());
  const telefone = cliente.telefone || props.find((p: any) => p.cliente_telefone)?.cliente_telefone || "";

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ult = soDig(telefone).slice(-8);
      const [at, ct] = await Promise.all([
        ult.length === 8
          ? supabase.from("atendimentos").select("id, created_at, numero, nome, atendente, fila, status, finalizado_em").eq("workspace_id", wsId).ilike("numero", `%${ult}`).order("created_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [] as any[] }),
        (async () => {
          const t = await token();
          const r = await fetch(`/api/contratos?workspaceId=${encodeURIComponent(wsId)}&pagina=1&limite=25&status=todos&busca=${encodeURIComponent(cliente.nome)}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
          return r && r.ok ? await r.json() : { contratos: [] };
        })(),
      ]);
      if (!vivo) return;
      setAtendimentos((at as any).data || []);
      const ids = new Set(cliente.contratos.map((c: Contrato) => c.id));
      setAssinados(((ct as any).contratos || []).filter((x: any) => !x.proposta_id || ids.has(x.proposta_id)));
    })();
    return () => { vivo = false; };
  }, [cliente.chave, wsId, telefone]);

  const linhas = cliente.contratos.map((c: Contrato) => { const d = rev(c); const calc0 = calcular(d, c.plano, cfg); const calc = { ...calc0, beneficio: beneficioDoContrato(c, calc0) }; return { c, d, calc, hon: honorariosPrevistos(d, calc, cfg) }; });
  const parcelas = linhas.flatMap((l: any) => (l.d.honorarios_parcelas || []).map((p: any) => ({ ...p, contrato: l.c })));
  const recebido = parcelas.filter((p: any) => p.pago_em).reduce((s: number, p: any) => s + (p.valor || 0), 0);
  const aReceber = parcelas.filter((p: any) => !p.pago_em).reduce((s: number, p: any) => s + (p.valor || 0), 0);
  const atrasado = parcelas.filter((p: any) => !p.pago_em && p.vencimento < hoje()).reduce((s: number, p: any) => s + (p.valor || 0), 0);

  // linha do tempo: histórico dos contratos + propostas + contratos assinados + atendimentos
  const eventos = [
    ...linhas.flatMap((l: any) => (l.d.historico || []).map((h: any) => ({ em: h.em, icone: "pasta", texto: h.nota, sub: `${l.c.operadora || "Contrato"}${h.por ? ` · ${h.por}` : ""}` }))),
    ...props.flatMap((p: any) => [
      { em: p.created_at, icone: "documento", texto: `Proposta nº ${p.numero} enviada`, sub: p.consultor_nome },
      ...(p.respondida_em ? [{ em: p.respondida_em, icone: p.status === "aceita" ? "check" : "x", texto: `Proposta nº ${p.numero} ${p.status === "aceita" ? "aceita pelo cliente" : "recusada"}`, sub: p.motivo_recusa || "" }] : []),
    ]),
    ...assinados.map((x: any) => ({ em: x.created_at, icone: "editar", texto: `Contrato "${x.contrato_nome || "Contrato"}" enviado para assinatura`, sub: x.status === "concluida" ? "assinado" : x.status })),
    ...atendimentos.map((a: any) => ({ em: a.created_at, icone: "whatsapp", texto: "Atendimento no WhatsApp", sub: [a.atendente, a.status].filter(Boolean).join(" · ") })),
  ].filter((e) => e.em).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 30);

  const aceitaSemContrato = props.find((p: any) => p.status === "aceita" && !p.dados?.contrato_gerado);

  return (
    <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* cabeçalho */}
      <div style={{ borderRadius: 22, padding: "22px 24px", color: "#fff", background: "linear-gradient(130deg, #10B981 0%, #059669 42%, #065F46 100%)", boxShadow: "0 22px 44px -24px rgba(6,95,70,.8)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -60, top: -80, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>{iniciais(cliente.nome)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{cliente.nome}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 6, fontSize: 13.5, color: "rgba(255,255,255,.88)" }}>
              {cliente.cpf && <span>CPF/CNPJ {docFmt(cliente.cpf)}</span>}
              {telefone && <span>{telFmt(telefone)}</span>}
              {cliente.email && <span>{cliente.email}</span>}
              {cliente.cidade && <span>{cliente.cidade}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {telefone && <a href={`https://wa.me/${soDig(telefone).length <= 11 ? "55" + soDig(telefone) : soDig(telefone)}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: 12, background: "#fff", color: "#065F46", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}><Icone nome="whatsapp" tamanho={16} /> WhatsApp</a>}
            <button onClick={fechar} title="Fechar ficha" style={{ width: 38, height: 38, borderRadius: 12, border: 0, background: "rgba(255,255,255,.16)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
          </div>
        </div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 18 }}>
          {[["Benefício estimado", brl(cliente.beneficio)], ["Honorários previstos", brl(cliente.honorarios)], ["Recebido", brl(recebido)], ["A receber", brl(aReceber) + (atrasado ? ` (${brl(atrasado)} em atraso)` : "")]].map(([k, v]) => (
            <div key={k} style={{ background: "rgba(255,255,255,.13)", borderRadius: 14, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {aceitaSemContrato && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFBEB", boxShadow: "inset 0 0 0 1.5px #FDE68A", borderRadius: 16, padding: "12px 16px" }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="alerta" tamanho={16} /></span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 14, color: "#78350F" }}>O cliente aceitou a proposta nº {aceitaSemContrato.numero} e ainda falta o contrato.</span>
          <a href={`/crm/contratos?revisional=${aceitaSemContrato.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: 12, background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)", color: "#fff", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}><Icone nome="documento" tamanho={15} /> Gerar contrato</a>
        </div>
      )}

      {/* contratos */}
      <Card titulo={`Contratos (${linhas.length})`} acao={<Btn variante="ghost" onClick={() => ir("contratos", { novo: true })}>＋ Contrato</Btn>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {linhas.map(({ c, d, calc, hon }: any) => {
            const e = etapa(c.status_venda);
            return (
              <button key={c.id} onClick={() => ir("contratos", { contratoId: c.id })} style={{ textAlign: "left", border: 0, cursor: "pointer", background: "#F7FAF9", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 14, color: "#0F172A" }}>{c.operadora || "Banco não informado"}</b>
                    <Pill texto={e.label} cor={e.cor} />
                    {calc.abusiva && <Pill texto={`${calc.vezesMedia.toFixed(1)}× a média`} cor={C.red} />}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 3 }}>
                    {d.valor_financiado ? `${brl(d.valor_financiado)} em ${d.prazo || "?"}x` : "Valores pendentes"}{d.processo_numero ? ` · processo ${d.processo_numero}` : ""} · desde {dataBR(c.data_proposta || c.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: "#047857" }}>{beneficioDoContrato(c, calc) ? brl(beneficioDoContrato(c, calc)) : "sem cálculo"}</div>{!calc.valido && beneficioDoContrato(c, calc) > 0 && <div style={{ fontSize: 11.5, color: "#94A3B8" }}>da análise da proposta</div>}
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>honorários {brl(hon.total)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card titulo={`Propostas (${props.length})`}>
          {props.length === 0 ? <div style={{ fontSize: 13.5, color: "#94A3B8" }}>Nenhuma proposta da Análise contratual para este CPF.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {props.map((p: any) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 13.5 }}>
                  <span style={{ minWidth: 0 }}><b>nº {p.numero}</b> · {p.dados?.banco || (p.tipo === "imovel" ? "Imóvel" : "Veículo")}<br /><span style={{ color: "#94A3B8", fontSize: 12.5 }}>{new Date(p.created_at).toLocaleDateString("pt-BR")} · {p.consultor_nome}</span></span>
                  <Pill texto={p.status === "aceita" ? (p.dados?.contrato_gerado ? "Aceita · contrato gerado" : "Aceita") : p.status} cor={p.status === "aceita" ? C.green : p.status === "recusada" ? C.red : C.blue} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card titulo={`Contratos para assinatura (${assinados.length})`}>
          {assinados.length === 0 ? <div style={{ fontSize: 13.5, color: "#94A3B8" }}>Nenhum contrato enviado para assinatura.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assinados.map((x: any) => (
                <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 13.5 }}>
                  <span style={{ minWidth: 0 }}><b>{x.contrato_nome || "Contrato"}</b><br /><span style={{ color: "#94A3B8", fontSize: 12.5 }}>{new Date(x.created_at).toLocaleDateString("pt-BR")}</span></span>
                  <Pill texto={x.status === "concluida" ? "Assinado" : x.status === "pendente" ? "Aguardando" : x.status} cor={x.status === "concluida" ? C.green : C.amber} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card titulo="Honorários">
          {parcelas.length === 0 ? <div style={{ fontSize: 13.5, color: "#94A3B8" }}>Nenhuma parcela gerada. Gere as parcelas na tela do contrato.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {parcelas.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento)).map((p: any, k: number) => {
                const atraso = !p.pago_em && p.vencimento < hoje();
                return (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                    <span>Parcela {p.n} · {p.contrato.operadora || "contrato"}<br /><span style={{ color: "#94A3B8", fontSize: 12.5 }}>vence {dataBR(p.vencimento)}</span></span>
                    <span style={{ textAlign: "right" }}><b style={{ color: atraso ? C.red : "#0F172A" }}>{brl(p.valor)}</b><br /><span style={{ fontSize: 12.5, color: p.pago_em ? C.green : atraso ? C.red : "#94A3B8" }}>{p.pago_em ? `pago ${dataBR(p.pago_em)}` : atraso ? "em atraso" : "em aberto"}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card titulo={`Atendimentos (${atendimentos.length})`}>
          {atendimentos.length === 0 ? <div style={{ fontSize: 13.5, color: "#94A3B8" }}>{telefone ? "Nenhum atendimento encontrado para este telefone." : "Sem telefone cadastrado."}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {atendimentos.slice(0, 8).map((a: any) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                  <span>{new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}<br /><span style={{ color: "#94A3B8", fontSize: 12.5 }}>{a.atendente || "sem atendente"}{a.fila ? ` · ${a.fila}` : ""}</span></span>
                  <Pill texto={a.status || "—"} cor={a.status === "finalizado" ? C.green : C.blue} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card titulo="Linha do tempo">
        {eventos.length === 0 ? <div style={{ fontSize: 13.5, color: "#94A3B8" }}>Sem movimentações ainda.</div> : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eventos.map((ev: any, k: number) => (
              <div key={k} style={{ display: "flex", gap: 12, paddingBottom: 14, position: "relative" }}>
                {k < eventos.length - 1 && <span style={{ position: "absolute", left: 15, top: 32, bottom: 0, width: 2, background: "#EEF2F1" }} />}
                <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome={ev.icone} tamanho={15} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: "#0F172A", fontWeight: 700 }}>{ev.texto}</div>
                  <div style={{ fontSize: 12.5, color: "#94A3B8" }}>{new Date(ev.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}{ev.sub ? ` · ${ev.sub}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
