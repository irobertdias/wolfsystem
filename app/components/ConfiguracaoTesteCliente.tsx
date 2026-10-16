"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { TesteCliente } from "../lib/teste-cliente";
export type FormTesteCliente = TesteCliente & { renovar?: boolean };
export default function ConfiguracaoTesteCliente({ cadastroId, value, onChange }: {
  cadastroId?: number; value: FormTesteCliente | null; onChange: (value: FormTesteCliente | null) => void;
}) {
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setErro("");
    onChange(null);
    if (!cadastroId) {
      onChange({ modo: "cliente", duracao_horas: 24, iniciado_em: null, termina_em: null });
      return;
    }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`/api/admin/cliente?acao=teste&cadastroId=${cadastroId}`, { cache: "no-store", headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || "Não foi possível carregar o tipo de acesso.");
        if (ativo) onChange({ ...data.teste, renovar: false });
      } catch (error) { if (ativo) setErro(error instanceof Error ? error.message : "Falha ao carregar."); }
    })();
    return () => { ativo = false; };
  }, [cadastroId, tentativa, onChange]);
  const campo = { padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", color: "#0f172a" };
  return <section style={{ padding: 18, borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff" }}>
    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", margin: "0 0 12px" }}>Tipo de acesso</h3>
    {!value ? <p>{erro || "Carregando configuração…"} {erro && <button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button>}</p> : <>
      <select aria-label="Tipo de acesso do cliente" value={value.modo} onChange={e => onChange({ ...value, modo: e.target.value as "cliente" | "teste" })} style={{ ...campo, width: "100%" }}>
        <option value="cliente">Cliente — cobrança normal</option>
        <option value="teste">Teste gratuito — acesso por prazo</option>
      </select>
      {value.modo === "teste" && <>
        <label style={{ display: "block", marginTop: 14, fontSize: 12, color: "#1e40af" }}>Prazo do teste
          <select value={[24, 48, 72, 168].includes(value.duracao_horas) ? value.duracao_horas : "personalizado"}
            onChange={e => onChange({ ...value, duracao_horas: e.target.value === "personalizado" ? 96 : Number(e.target.value), renovar: true })}
            style={{ ...campo, width: "100%", marginTop: 6 }}>
            <option value={24}>24 horas</option><option value={48}>48 horas</option><option value={72}>3 dias</option><option value={168}>7 dias</option><option value="personalizado">Personalizado em horas</option>
          </select>
        </label>
        {![24, 48, 72, 168].includes(value.duracao_horas) && <label style={{ display: "block", marginTop: 10 }}>Quantidade de horas
          <input type="number" min={1} max={8760} value={value.duracao_horas} onChange={e => onChange({ ...value, duracao_horas: Number(e.target.value), renovar: true })} style={{ ...campo, width: "100%" }} />
        </label>}
        {value.termina_em && !value.renovar && <p style={{ fontSize: 12, marginTop: 12, color: "#1e40af" }}>Término: {new Date(value.termina_em).toLocaleString("pt-BR")}</p>}
        {value.termina_em && <button type="button" onClick={() => onChange({ ...value, renovar: true })} style={{ ...campo, marginTop: 8, cursor: "pointer" }}>Renovar teste por {value.duracao_horas}h ao salvar</button>}
        <p style={{ fontSize: 12, color: "#1e40af", margin: "12px 0 0" }}>{!value.termina_em || value.renovar ? "O prazo começa ao salvar. " : "Salvar outros dados não renova o prazo. "}Sem avisos de cobrança. Ao terminar, o acesso será bloqueado com a mensagem “Seu teste encerrou”.</p>
      </>}
    </>}
  </section>;
}
