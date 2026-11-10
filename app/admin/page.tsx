"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import Icone from "../components/a2/Icone";
type Cadastro = {
  id: number;
  created_at: string;
  nome: string;
  empresa: string;
  cnpj: string;
  cpf: string;
  email: string;
  whatsapp: string;
  usuarios: string;
  conexoes: string;
  ia: string;
  plano: string;
  senha: string;
  autorizado: boolean;
};

type Usuario = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  perfil: string;
  grupo: string;
  workspace_id: string;
  ativo: boolean;
};

export default function Admin() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [autorizando, setAutorizando] = useState<number | null>(null);
  const [abaAdmin, setAbaAdmin] = useState("cadastros");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "autorizados">("todos");
  const [busca, setBusca] = useState("");
  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    confirmarSenha: "",
    perfil: "Atendente",
    grupo: "",
    workspace_id: "",
  });

  const fetchCadastros = async () => {
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoading(false);
  };

  const autorizar = async (cadastro: Cadastro) => {
    setAutorizando(cadastro.id);
    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cadastro.id,
          email: cadastro.email,
          senha: cadastro.senha,
          nome: cadastro.nome,
          empresa: cadastro.empresa,
          plano: cadastro.plano,
          ia: cadastro.ia,
          usuarios: cadastro.usuarios,
          conexoes: cadastro.conexoes,
          username: (cadastro as any).username,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`${cadastro.nome} foi autorizado com sucesso!`);
        fetchCadastros();
      } else {
        if (result.error?.includes("already been registered")) {
          await supabase.from("cadastros").update({ autorizado: true }).eq("id", cadastro.id);
          alert(`${cadastro.nome} foi autorizado!`);
          fetchCadastros();
        } else {
          alert("Erro ao autorizar: " + result.error);
        }
      }
    } catch (error) {
      alert("Erro ao autorizar usuário!");
    }
    setAutorizando(null);
  };

  const remover = async (id: number) => {
    if (confirm("Tem certeza que deseja remover esse cadastro?")) {
      await supabase.from("cadastros").delete().eq("id", id);
      fetchCadastros();
    }
  };

  const criarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email || !formUsuario.senha) {
      alert("Preencha Nome, E-mail e Senha!");
      return;
    }
    if (formUsuario.senha !== formUsuario.confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }
    setCriandoUsuario(true);
    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 0,
          email: formUsuario.email,
          senha: formUsuario.senha,
          nome: formUsuario.nome,
          empresa: formUsuario.grupo || formUsuario.nome,
          plano: formUsuario.perfil,
          ia: "",
          usuarios: "1",
          conexoes: "1",
          skipCadastro: true,
          trocarSenha: true,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Usuário ${formUsuario.nome} criado com sucesso!`);
        setShowFormUsuario(false);
        setFormUsuario({ nome: "", email: "", telefone: "", senha: "", confirmarSenha: "", perfil: "Atendente", grupo: "", workspace_id: "" });
      } else {
        alert("Erro ao criar usuário: " + result.error);
      }
    } catch (error) {
      alert("Erro ao criar usuário!");
    }
    setCriandoUsuario(false);
  };

  useEffect(() => { fetchCadastros(); }, []);

  // Estilos A2
  const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";
  const inputStyle = {
    width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12,
    padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600,
    boxSizing: "border-box" as const, outline: "none",
  };
  const cardStyle = { background: "#ffffff", borderRadius: 20, boxShadow: SOMBRA };
  const labelStyle = { color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 } as const;
  const btnVerde = { background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, cursor: "pointer", fontWeight: 800, boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)", display: "inline-flex", alignItems: "center", gap: 8 } as const;
  const btnClaro = { background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "11px 18px", fontSize: 14, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 } as const;

  const pendentes = cadastros.filter((c) => !c.autorizado).length;
  const autorizados = cadastros.length - pendentes;
  const termo = busca.trim().toLowerCase();
  const lista = cadastros
    .filter((c) => filtro === "todos" || (filtro === "pendentes" ? !c.autorizado : c.autorizado))
    .filter((c) => !termo || [c.nome, c.empresa, c.email, c.whatsapp].some((v) => (v || "").toLowerCase().includes(termo)));
  const iniciais = (nome: string) => (nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const CORES = ["#059669", "#0F766E", "#047857", "#0369A1", "#C2410C", "#BE185D"];
  const corDe = (s: string) => CORES[[...(s || "")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CORES.length];

  const campoSenha = (rotulo: string, valor: string, ver: boolean, setVer: (v: boolean) => void, campo: "senha" | "confirmarSenha") => (
    <div>
      <label style={labelStyle}>{rotulo}</label>
      <div style={{ position: "relative" }}>
        <input type={ver ? "text" : "password"} placeholder={rotulo.replace(" *", "")} value={valor}
          onChange={(e) => setFormUsuario({ ...formUsuario, [campo]: e.target.value })} style={{ ...inputStyle, paddingRight: 46 }} />
        <button type="button" onClick={() => setVer(!ver)} title={ver ? "Esconder senha" : "Mostrar senha"}
          style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: ver ? "#ECFDF5" : "transparent", border: "none", cursor: "pointer", color: ver ? "#059669" : "#94A3B8", width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nome="olho" tamanho={17} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F3F6F5", fontFamily: "var(--font-wolf), system-ui, sans-serif", padding: "24px 20px 40px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Barra superior */}
        <div style={{ ...cardStyle, padding: "12px 16px 12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(140deg, #059669 0%, #065F46 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, boxShadow: "0 6px 14px -4px rgba(5,150,105,.55)" }}>W</span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <b style={{ fontSize: 15, color: "#0F172A" }}>Wolf System</b>
              <small style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Administração da plataforma</small>
            </span>
          </div>
          <a href="/crm" style={{ ...btnClaro, textDecoration: "none", padding: "9px 16px", fontSize: 13.5 }}>Voltar ao CRM <Icone nome="seta" tamanho={15} /></a>
        </div>

        {/* Título */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Painel administrativo</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Autorize novos cadastros e crie usuários de qualquer empresa</p>
          </div>
          <button onClick={() => setShowFormUsuario(true)} style={btnVerde}>
            <Icone nome="mais" tamanho={17} espessura={2.4} /> Criar usuário
          </button>
        </div>

        {/* Resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          <div style={{ borderRadius: 20, padding: 20, color: "#fff", background: "linear-gradient(140deg, #10B981 0%, #059669 45%, #065F46 100%)", boxShadow: "0 18px 34px -18px rgba(5,150,105,.75)", display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="usuarios" tamanho={17} /></span>
              Cadastros recebidos
            </span>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.02em" }}>{cadastros.length}</span>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{autorizados} já com acesso liberado</span>
          </div>
          {[
            { l: "Aguardando autorização", v: pendentes, cor: "#C2410C", fundo: "#FFF7ED", icone: "relogio", sub: pendentes ? "precisam da sua aprovação" : "nada pendente" },
            { l: "Autorizados", v: autorizados, cor: "#059669", fundo: "#ECFDF5", icone: "check", sub: "empresas usando o sistema" },
          ].map((s) => (
            <div key={s.l} style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#64748B" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: s.fundo, color: s.cor, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome={s.icone as any} tamanho={17} /></span>
                {s.l}
              </span>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", letterSpacing: "-.02em" }}>{s.v}</span>
              <span style={{ fontSize: 12.5, color: "#94A3B8", fontWeight: 600 }}>{s.sub}</span>
            </div>
          ))}
        </div>

        {/* Tabela de cadastros */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 4, background: "#F3F6F5", borderRadius: 12, padding: 4 }}>
              {([["todos", "Todos", cadastros.length], ["pendentes", "Pendentes", pendentes], ["autorizados", "Autorizados", autorizados]] as const).map(([k, l, n]) => (
                <button key={k} onClick={() => setFiltro(k)}
                  style={{ border: "none", cursor: "pointer", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: filtro === k ? 800 : 600, background: filtro === k ? "#fff" : "transparent", color: filtro === k ? "#065F46" : "#64748B", boxShadow: filtro === k ? "0 1px 3px rgba(16,24,40,.12)" : "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {l}<span style={{ fontSize: 11.5, fontWeight: 800, color: filtro === k ? "#059669" : "#94A3B8" }}>{n}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 280px", justifyContent: "flex-end" }}>
              <div style={{ position: "relative", flex: "0 1 320px" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}><Icone nome="busca" tamanho={16} /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, empresa, e-mail…" style={{ ...inputStyle, paddingLeft: 38, height: 40, padding: "0 14px 0 38px" }} />
              </div>
              <button onClick={fetchCadastros} title="Atualizar lista" style={{ ...btnClaro, padding: 0, width: 40, height: 40, justifyContent: "center" }}><Icone nome="atualizar" tamanho={17} /></button>
            </div>
          </div>

          {loading ? (
            <p style={{ color: "#64748B", padding: 24, margin: 0 }}>Carregando…</p>
          ) : lista.length === 0 ? (
            <div style={{ padding: "36px 24px 44px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}><Icone nome={cadastros.length ? "busca" : "pasta"} tamanho={24} /></span>
              <b style={{ color: "#0F172A", fontSize: 15 }}>{cadastros.length ? "Nada encontrado" : "Nenhum cadastro ainda"}</b>
              <span style={{ color: "#64748B", fontSize: 13.5 }}>{cadastros.length ? "Tente outro filtro ou outra busca." : "Os cadastros feitos no site aparecem aqui."}</span>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F7FAF9" }}>
                    {["Cliente", "Contato", "Plano", "IA", "Usuários", "Conexões", "Status", ""].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", color: "#64748B", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="a2-tabela-fin">
                  {lista.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #EEF2F1" }}>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <span style={{ width: 38, height: 38, borderRadius: 12, background: `${corDe(c.empresa || c.nome)}18`, color: corDe(c.empresa || c.nome), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13.5, flexShrink: 0 }}>{iniciais(c.empresa || c.nome)}</span>
                          <span style={{ display: "flex", flexDirection: "column" }}>
                            <b style={{ color: "#0F172A", fontSize: 14 }}>{c.empresa || "—"}</b>
                            <span style={{ color: "#64748B", fontSize: 12.5 }}>{c.nome}</span>
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: "#334155", fontSize: 13.5 }}>{c.email}</span>
                          <span style={{ color: "#94A3B8", fontSize: 12.5 }}>{c.whatsapp}</span>
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span style={{ background: "#ECFDF5", color: "#047857", fontSize: 12, padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>{c.plano || "—"}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#475569", fontSize: 13.5, whiteSpace: "nowrap" }}>{c.ia || "—"}</td>
                      <td style={{ padding: "14px 16px", color: "#475569", fontSize: 13.5, whiteSpace: "nowrap", textAlign: "center" }}>{c.usuarios || "—"}</td>
                      <td style={{ padding: "14px 16px", color: "#475569", fontSize: 13.5, whiteSpace: "nowrap", textAlign: "center" }}>{c.conexoes || "—"}</td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.autorizado ? "#ECFDF5" : "#FFF7ED", color: c.autorizado ? "#047857" : "#C2410C", padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.autorizado ? "#10B981" : "#F97316" }} />
                          {c.autorizado ? "Autorizado" : "Pendente"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {!c.autorizado && (
                            <button onClick={() => autorizar(c)} disabled={autorizando === c.id}
                              style={{ ...btnVerde, padding: "8px 14px", fontSize: 13, opacity: autorizando === c.id ? 0.7 : 1, cursor: autorizando === c.id ? "not-allowed" : "pointer" }}>
                              <Icone nome="check" tamanho={15} espessura={2.4} /> {autorizando === c.id ? "Autorizando…" : "Autorizar"}
                            </button>
                          )}
                          <button onClick={() => remover(c.id)} title="Remover cadastro"
                            style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icone nome="lixeira" tamanho={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: criar usuário */}
      {showFormUsuario && (
        <div onClick={() => setShowFormUsuario(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, borderRadius: 24, padding: 26, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 18, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 13, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="usuario" tamanho={20} /></span>
                <div>
                  <h2 style={{ color: "#0F172A", fontSize: 19, fontWeight: 800, margin: 0 }}>Criar usuário</h2>
                  <p style={{ margin: "2px 0 0", color: "#64748B", fontSize: 13 }}>O acesso fica liberado na hora.</p>
                </div>
              </div>
              <button onClick={() => setShowFormUsuario(false)} title="Fechar"
                style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input placeholder="Nome completo" value={formUsuario.nome} onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>E-mail *</label>
                <input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Perfil</label>
                <select value={formUsuario.perfil} onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Empresa (grupo de permissão)</label>
                <select value={formUsuario.grupo} onChange={(e) => setFormUsuario({ ...formUsuario, grupo: e.target.value })} style={inputStyle}>
                  <option value="">Selecione a empresa…</option>
                  {cadastros.filter(c => c.autorizado).map((c) => (
                    <option key={c.id} value={c.empresa}>{c.empresa} — {c.nome}</option>
                  ))}
                </select>
              </div>
              {campoSenha("Senha *", formUsuario.senha, showSenha, setShowSenha, "senha")}
              {campoSenha("Confirmar senha *", formUsuario.confirmarSenha, showConfirmar, setShowConfirmar, "confirmarSenha")}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
              <button onClick={() => setShowFormUsuario(false)} style={btnClaro}>Cancelar</button>
              <button onClick={criarUsuario} disabled={criandoUsuario} style={{ ...btnVerde, opacity: criandoUsuario ? 0.7 : 1, cursor: criandoUsuario ? "not-allowed" : "pointer" }}>
                <Icone nome="check" tamanho={16} espessura={2.4} /> {criandoUsuario ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
