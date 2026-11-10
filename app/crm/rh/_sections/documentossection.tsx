"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍💼 RH · Documentos  (CONECTADO — tabela 'documentos' + Storage 'documentos-rh')
// ───────────────────────────────────────────────────────────────────────
// - Upload real do arquivo pro bucket privado 'documentos-rh'.
// - Coluna arquivo_url guarda o CAMINHO no bucket (não a URL, que expira).
// - "Ver / Baixar" gera um link assinado temporário (120s) — bucket privado.
// - Excluir remove o registro E o arquivo do bucket.
// ═══════════════════════════════════════════════════════════════════════

const BUCKET = "documentos-rh";
const COR = "#059669";
const COR_TEXTO = "#065F46";

const card = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)",
};
const inputStyle = {
  width: "100%",
  background: "#F7FAF9",
  border: "1px solid #E6ECEA",
  borderRadius: 12,
  padding: "11px 14px",
  color: "#0F172A",
  fontSize: 14,
  fontWeight: 600,
  boxSizing: "border-box" as const,
  outline: "none",
};

const TIPOS = [
  "Contrato de trabalho",
  "Carteira de trabalho",
  "RG / CPF",
  "Comprovante de residência",
  "ASO (exame ocupacional)",
  "Certificado NR",
  "Ficha de registro",
];

type Documento = {
  id: string;
  funcionario: string;
  tipo: string;
  validade: string;
  arquivoUrl: string; // caminho dentro do bucket (vazio = sem arquivo)
};

const FORM_VAZIO: Documento = { id: "", funcionario: "", tipo: TIPOS[0], validade: "", arquivoUrl: "" };

const dataBR = (iso: string) => {
  if (!iso) return "Sem validade";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

// status calculado pela validade
function statusDoc(validade: string): {
  key: "valido" | "vencendo" | "vencido" | "permanente";
  label: string;
  cor: string;
} {
  if (!validade) return { key: "permanente", label: "Permanente", cor: "#64748B" };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(validade + "T00:00:00");
  const dias = Math.round((v.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { key: "vencido", label: "Vencido", cor: "#dc2626" };
  if (dias <= 30) return { key: "vencendo", label: `Vence em ${dias}d`, cor: "#C2410C" };
  return { key: "valido", label: "Válido", cor: "#059669" };
}

// transforma "João Silva" → "joao-silva" pra usar no caminho do arquivo
function slug(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const tamanhoLegivel = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};

export function DocumentosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "vencendo" | "vencido">("todos");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Documento>(FORM_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // 🔌 carrega da tabela
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Erro ao carregar documentos: " + error.message);
    } else {
      setLista(
        (data || []).map((r: any) => ({
          id: r.id,
          funcionario: r.funcionario,
          tipo: r.tipo || "",
          validade: r.validade || "",
          arquivoUrl: r.arquivo_url || "",
        }))
      );
    }
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const filtrados = useMemo(() => {
    let l = lista;
    if (busca) {
      const b = busca.toLowerCase();
      l = l.filter((d) => d.funcionario.toLowerCase().includes(b) || d.tipo.toLowerCase().includes(b));
    }
    if (filtro !== "todos") l = l.filter((d) => statusDoc(d.validade).key === filtro);
    return l;
  }, [lista, busca, filtro]);

  const stats = useMemo(
    () => ({
      total: lista.length,
      comArquivo: lista.filter((d) => d.arquivoUrl).length,
      vencendo: lista.filter((d) => statusDoc(d.validade).key === "vencendo").length,
      vencidos: lista.filter((d) => statusDoc(d.validade).key === "vencido").length,
    }),
    [lista]
  );

  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setArquivo(null);
    setModal(true);
  };
  const fechar = () => {
    setModal(false);
    setForm(FORM_VAZIO);
    setArquivo(null);
  };

  // 🔌 salvar: faz upload (se escolheu arquivo) e grava o registro
  const salvar = async () => {
    if (!form.funcionario.trim()) {
      alert("Informe o colaborador.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setEnviando(true);

    let arquivoUrl = "";
    if (arquivo) {
      const ext = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
      const caminho = `${wsId}/${slug(form.funcionario) || "colaborador"}/${Date.now()}-${slug(form.tipo) || "doc"}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
      });
      if (up.error) {
        setEnviando(false);
        alert(
          "Erro ao enviar o arquivo: " +
            up.error.message +
            "\n\nVerifique se o bucket 'documentos-rh' foi criado no Supabase."
        );
        return;
      }
      arquivoUrl = caminho;
    }

    const payload = {
      funcionario: form.funcionario,
      tipo: form.tipo,
      validade: form.validade || null,
      arquivo_url: arquivoUrl || null,
      workspace_id: wsId,
    };
    const { error } = await supabase.from("documentos").insert(payload);
    setEnviando(false);
    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }
    fechar();
    carregar();
  };

  // 🔌 ver/baixar: gera link assinado temporário (bucket privado)
  const verArquivo = async (d: Documento) => {
    if (!d.arquivoUrl) return;
    setAbrindo(d.id);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.arquivoUrl, 120);
    setAbrindo(null);
    if (error || !data?.signedUrl) {
      alert("Não consegui abrir o arquivo: " + (error?.message || "link indisponível"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // 🔌 excluir: remove o arquivo do bucket e depois o registro
  const excluir = async (d: Documento) => {
    if (!wsId) return;
    if (!confirm(`Remover o documento de ${d.funcionario}?`)) return;
    if (d.arquivoUrl) {
      const rm = await supabase.storage.from(BUCKET).remove([d.arquivoUrl]);
      if (rm.error) console.warn("Falha ao remover arquivo do bucket:", rm.error.message);
    }
    const { error } = await supabase.from("documentos").delete().eq("id", d.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    carregar();
  };

  const set = (campo: keyof Documento, valor: any) => setForm((f) => ({ ...f, [campo]: valor }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
              Documentos
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Arquivos dos colaboradores — upload, validade e download
            </p>
          </div>
        </div>
        <button
          onClick={abrirNovo}
          style={{
            background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "11px 20px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
            boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
            whiteSpace: "nowrap",
          }}
        >
          + Adicionar Documento
        </button>
      </div>

      {/* ALERTA validade */}
      {stats.vencidos + stats.vencendo > 0 && (
        <div
          style={{
            background: "#FFF7ED",
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <IconeEmoji e="⚠️" tamanho={16} />
          <p style={{ color: "#92400e", fontSize: 13, margin: 0, fontWeight: 600 }}>
            <b>{stats.vencidos}</b> vencido(s) e <b>{stats.vencendo}</b> vencendo em 30 dias.
          </p>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {[
          { label: "Documentos", value: String(stats.total), cor: "#059669", icon: "📁" },
          { label: "Com arquivo", value: String(stats.comArquivo), cor: "#059669", icon: "📎" },
          { label: "Vencendo", value: String(stats.vencendo), cor: "#C2410C", icon: "⏳" },
          { label: "Vencidos", value: String(stats.vencidos), cor: "#dc2626", icon: "🚨" },
        ].map((s) => (
          <div key={s.label} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${s.cor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                {<IconeEmoji e={s.icon} />}
              </div>
              <p
                style={{
                  color: "#64748B",
                  fontSize: 13,
                  margin: 0,
                  fontWeight: 700,
                }}
              >
                {s.label}
              </p>
            </div>
            <p style={{ color: "#0F172A", fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por colaborador ou tipo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 280px", maxWidth: 460, borderRadius: 20 }}
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as any)}
          style={{ ...inputStyle, maxWidth: 200 }}
        >
          <option value="todos">Status: Todos</option>
          <option value="vencendo">Vencendo</option>
          <option value="vencido">Vencidos</option>
        </select>
      </div>

      {/* LISTA */}
      {carregando ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Carregando...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="busca" tamanho={24} /></span>
          <p style={{ color: "#64748B", fontSize: 13 }}>
            {lista.length === 0 ? "Nenhum documento cadastrado." : "Nada encontrado"}
          </p>
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7FAF9" }}>
                  {["Colaborador", "Documento", "Arquivo", "Validade", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        color: "#64748B",
                        fontSize: 11,
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                        borderBottom: "1px solid #E6ECEA",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d, i) => {
                  const st = statusDoc(d.validade);
                  return (
                    <tr
                      key={d.id}
                      style={{
                        borderTop: "1px solid #F1F5F4",
                        background: "#ffffff",
                      }}
                    >
                      <td style={{ padding: "12px 16px", color: "#0F172A", fontSize: 13, fontWeight: 700 }}>
                        {d.funcionario}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#475569", fontSize: 12 }}>{d.tipo}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {d.arquivoUrl ? (
                          <span
                            style={{
                              background: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid #A7F3D0",
                              fontSize: 11,
                              padding: "3px 10px",
                              borderRadius: 10,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Anexado
                          </span>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: 12 }}>— sem arquivo</span>
                        )}
                      </td>
                      <td
                        style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        {dataBR(d.validade)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            background: `${st.cor}15`,
                            color: st.cor,
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {d.arquivoUrl && (
                          <button
                            onClick={() => verArquivo(d)}
                            disabled={abrindo === d.id}
                            style={{
                              background: "#ECFDF5",
                              color: COR_TEXTO,
                              border: "1px solid #A7F3D0",
                              borderRadius: 8,
                              padding: "5px 11px",
                              fontSize: 11,
                              cursor: abrindo === d.id ? "wait" : "pointer",
                              fontWeight: 600,
                              marginRight: 6,
                            }}
                          >
                            {abrindo === d.id ? "Abrindo..." : "Ver / Baixar"}
                          </button>
                        )}
                        <button
                          onClick={() => excluir(d)}
                          style={{
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            border: "none",
                            borderRadius: 8,
                            padding: "5px 9px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          <Icone nome="lixeira" tamanho={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div
          onClick={fechar}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...card, width: "100%", maxWidth: 520, overflow: "hidden" }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #E6ECEA",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>
                Adicionar Documento
              </h3>
              <button
                onClick={fechar}
                style={{
                  background: "#F3F6F5",
                  border: "none",
                  color: "#64748B",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                }}
              >
                <Icone nome="x" tamanho={16} />
              </button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <Campo label="Colaborador">
                <input
                  value={form.funcionario}
                  onChange={(e) => set("funcionario", e.target.value)}
                  style={inputStyle}
                  placeholder="Nome"
                />
              </Campo>
              <Campo label="Tipo de documento">
                <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputStyle}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Validade (em branco se permanente)">
                <input
                  type="date"
                  value={form.validade}
                  onChange={(e) => set("validade", e.target.value)}
                  style={inputStyle}
                />
              </Campo>

              {/* UPLOAD */}
              <Campo label="Arquivo">
                <input
                  ref={inputArquivoRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => setArquivo(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                {arquivo ? (
                  <div
                    style={{
                      border: "1px solid #A7F3D0",
                      background: "#ECFDF5",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <IconeEmoji e="📎" tamanho={18} />
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            color: "#0F172A",
                            fontSize: 13,
                            fontWeight: 700,
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {arquivo.name}
                        </p>
                        <p style={{ color: "#64748B", fontSize: 11, margin: "2px 0 0" }}>
                          {tamanhoLegivel(arquivo.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setArquivo(null);
                        if (inputArquivoRef.current) inputArquivoRef.current.value = "";
                      }}
                      style={{
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        border: "none",
                        borderRadius: 8,
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => inputArquivoRef.current?.click()}
                    style={{
                      border: "2px dashed #A7F3D0",
                      borderRadius: 12,
                      padding: 20,
                      textAlign: "center",
                      background: "#F7FAF9",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="pasta" tamanho={24} /></span>
                    <p style={{ color: COR_TEXTO, fontSize: 13, margin: 0, fontWeight: 700 }}>
                      Clique para escolher o arquivo
                    </p>
                    <p style={{ color: "#94A3B8", fontSize: 11, margin: "4px 0 0" }}>
                      PDF, imagem ou documento
                    </p>
                  </div>
                )}
              </Campo>
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E6ECEA",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                background: "#F7FAF9",
              }}
            >
              <button
                onClick={fechar}
                style={{
                  background: "#F3F6F5",
                  color: "#334155",
                  borderRadius: 10,
                  padding: "9px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={enviando}
                style={{
                  background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 22px",
                  fontSize: 13,
                  cursor: enviando ? "wait" : "pointer",
                  fontWeight: 700,
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando ? (arquivo ? "Enviando arquivo..." : "Salvando...") : "+ Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          color: "#64748B",
          fontSize: 11,
          fontWeight: 700,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}