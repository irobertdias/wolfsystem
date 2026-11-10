"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { usePermissao } from "../../../hooks/usePermissao";
import { useEquipeFiltro } from "../../../hooks/useEquipeFiltro";
import * as XLSX from "xlsx";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
type Atendimento = {
  id: number; created_at: string; numero: string; nome: string;
  mensagem: string; status: string; fila: string; atendente: string;
  workspace_id: string;
  equipe_id?: string | null;
};

type Etiqueta = { id: number; nome: string; cor: string; icone: string; };

type Contato = {
  numero: string;
  nome: string;
  ultimaMensagem: string;
  ultimaData: string;
  ultimoStatus: string;
  ultimaFila: string;
  ultimoAtendente: string;
  totalAtendimentos: number;
  etiquetasIds: number[];
  atendimentos: Atendimento[]; // pra histórico no modal
};


// A2: iniciais e cor do avatar do contato.
function iniciaisContato(t?: string | null) {
  const p = String(t || "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}
const CORES_AVATAR_CONTATO = [
  { bg: "linear-gradient(140deg, #D1FAE5, #A7F3D0)", fg: "#065F46" },
  { bg: "#FFF7ED", fg: "#C2410C" },
  { bg: "#ECFDF5", fg: "#047857" },
  { bg: "#F1F5F9", fg: "#334155" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#E0F2F1", fg: "#0F766E" },
];
function corAvatarContato(t?: string | null) {
  let h = 0; for (const c of String(t || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_AVATAR_CONTATO[h % CORES_AVATAR_CONTATO.length];
}
const filtroSel: React.CSSProperties = { height: 42, borderRadius: 12, border: 0, background: "#F3F6F5", color: "#334155", fontSize: 13, fontWeight: 600, padding: "0 12px", cursor: "pointer", maxWidth: 200 };

export default function Contatos() {
  const router = useRouter();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasPorAtend, setEtiquetasPorAtend] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [wsId, setWsId] = useState<string | null>(null);
  const [truncado, setTruncado] = useState(false);

  // 🔒 Permissões + equipe do usuário logado
  const { equipeId: minhaEquipeId, veTudo } = usePermissao();
  // 👥 Filtro por equipe (dropdown que aparece pro admin)
  const { equipes, equipeId, EquipeSelector } = useEquipeFiltro(wsId || "");

  // 🔒 TRAVA POR EQUIPE — Diretor preso à equipe dele; dono/admin escolhe.
  const travadoEquipe = !veTudo && minhaEquipeId != null;
  const equipeEfetiva = travadoEquipe ? String(minhaEquipeId) : (equipeId || "");
  const minhaEquipeNome = minhaEquipeId
    ? (equipes.find((e: any) => e.id === minhaEquipeId)?.nome || "Minha equipe")
    : "";

  // Busca e filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todos" | "hoje" | "semana" | "mes">("todos");

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const PAGINA_SIZE = 20;

  // Modal de edição
  const [contatoEditando, setContatoEditando] = useState<Contato | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<Set<number>>(new Set());
  const [salvandoContato, setSalvandoContato] = useState(false);

  const [exportando, setExportando] = useState(false);

  // 🆕 FASE 3 MOBILE
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🎨 ESTILOS
  const inputStyle = {
    width: "100%", background: "#ffffff", border: "1px solid #E6ECEA", borderRadius: 10,
    padding: "10px 14px", color: "#0F172A", fontSize: 13, boxSizing: "border-box" as const,
    outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff", borderRadius: 14, border: "1px solid #E6ECEA",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  // ═══ Descobre workspace (dono OU sub-usuário) ═══
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      let workspaceId: string | null = null;
      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono) {
        workspaceId = wsDono.username || wsDono.id.toString();
      } else {
        const { data: uw } = await supabase.from("usuarios_workspace")
          .select("workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (uw?.workspace_id) workspaceId = uw.workspace_id;
      }
      if (!workspaceId) { setLoading(false); return; }
      setWsId(workspaceId);
    };
    init();
  }, []);

  // ═══ Carrega atendimentos + etiquetas ═══
  const carregarDados = async (ws: string) => {
    setLoading(true);
    // Paginação até 10.000 atendimentos (cobre ~99% dos workspaces)
    const PAGE_SIZE = 1000;
    const LIMITE = 10000;
    let lista: Atendimento[] = [];
    let offset = 0;
    while (offset < LIMITE) {
      const { data: pagina } = await supabase.from("atendimentos")
        .select("*").eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (!pagina || pagina.length === 0) break;
      lista = lista.concat(pagina as Atendimento[]);
      if (pagina.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    setAtendimentos(lista);
    setTruncado(lista.length >= LIMITE);

    // Etiquetas do workspace
    const { data: etiqs } = await supabase.from("etiquetas").select("*").eq("workspace_id", ws);
    setEtiquetas(etiqs || []);

    // Relações atendimento_etiquetas (em lotes de 500)
    if (lista.length > 0) {
      const ids = lista.map(a => a.id);
      const LOTE = 500;
      const mapa: Record<number, number[]> = {};
      for (let i = 0; i < ids.length; i += LOTE) {
        const lote = ids.slice(i, i + LOTE);
        const { data: rels } = await supabase.from("atendimento_etiquetas")
          .select("atendimento_id, etiqueta_id")
          .in("atendimento_id", lote);
        (rels || []).forEach(r => {
          if (!mapa[r.atendimento_id]) mapa[r.atendimento_id] = [];
          mapa[r.atendimento_id].push(r.etiqueta_id);
        });
      }
      setEtiquetasPorAtend(mapa);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!wsId) return;
    carregarDados(wsId);
    const ch = supabase.channel("contatos_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` }, () => carregarDados(wsId))
      .on("postgres_changes", { event: "*", schema: "public", table: "etiquetas", filter: `workspace_id=eq.${wsId}` }, () => carregarDados(wsId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId]);

  // ═══ AGREGA atendimentos por número = contatos únicos ═══
  // 🔒 Aplica filtro de equipe ANTES da agregação:
  //    • Diretor travado → só os atendimentos da equipe dele
  //    • admin com Equipe X escolhida → só os atendimentos da X
  //    • admin sem escolha → todos
  const contatos: Contato[] = useMemo(() => {
    const fonte = equipeEfetiva
      ? atendimentos.filter(a => String(a.equipe_id ?? "") === String(equipeEfetiva))
      : atendimentos;
    const mapa = new Map<string, Contato>();
    for (const a of fonte) {
      if (!a.numero) continue;
      const existente = mapa.get(a.numero);
      if (!existente) {
        mapa.set(a.numero, {
          numero: a.numero,
          nome: a.nome || a.numero,
          ultimaMensagem: a.mensagem || "",
          ultimaData: a.created_at,
          ultimoStatus: a.status,
          ultimaFila: a.fila || "",
          ultimoAtendente: a.atendente || "",
          totalAtendimentos: 1,
          etiquetasIds: etiquetasPorAtend[a.id] || [],
          atendimentos: [a],
        });
      } else {
        existente.totalAtendimentos++;
        existente.atendimentos.push(a);
        // Se este atendimento for mais recente, atualiza dados "atuais"
        if (new Date(a.created_at) > new Date(existente.ultimaData)) {
          existente.ultimaMensagem = a.mensagem || existente.ultimaMensagem;
          existente.ultimaData = a.created_at;
          existente.ultimoStatus = a.status;
          existente.ultimaFila = a.fila || existente.ultimaFila;
          existente.ultimoAtendente = a.atendente || existente.ultimoAtendente;
          // Nome: se o mais recente tem nome diferente do número, usa
          if (a.nome && a.nome !== a.numero) existente.nome = a.nome;
        }
        // Acumula etiquetas únicas do contato (de todos os atendimentos)
        const etiqs = etiquetasPorAtend[a.id] || [];
        for (const eid of etiqs) {
          if (!existente.etiquetasIds.includes(eid)) existente.etiquetasIds.push(eid);
        }
      }
    }
    return Array.from(mapa.values()).sort((a, b) => new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime());
  }, [atendimentos, etiquetasPorAtend, equipeEfetiva]);

  // ═══ FILTROS ═══
  const contatosFiltrados = useMemo(() => {
    let lista = contatos;
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(c =>
        c.nome.toLowerCase().includes(b) ||
        c.numero.includes(busca.replace(/\D/g, "")) ||
        c.ultimaMensagem.toLowerCase().includes(b)
      );
    }
    if (filtroStatus !== "todos") lista = lista.filter(c => c.ultimoStatus === filtroStatus);
    if (filtroEtiqueta !== "todas") {
      const eid = parseInt(filtroEtiqueta);
      lista = lista.filter(c => c.etiquetasIds.includes(eid));
    }
    if (filtroAtendente !== "todos") lista = lista.filter(c => c.ultimoAtendente === filtroAtendente);
    if (filtroPeriodo !== "todos") {
      const agora = new Date();
      const lim = filtroPeriodo === "hoje" ? 1 : filtroPeriodo === "semana" ? 7 : 30;
      const dataLim = new Date(agora.getTime() - lim * 24 * 60 * 60 * 1000);
      lista = lista.filter(c => new Date(c.ultimaData) >= dataLim);
    }
    return lista;
  }, [contatos, busca, filtroStatus, filtroEtiqueta, filtroAtendente, filtroPeriodo]);

  // Reset paginação quando filtros mudam
  useEffect(() => { setPaginaAtual(1); }, [busca, filtroStatus, filtroEtiqueta, filtroAtendente, filtroPeriodo]);

  const totalPaginas = Math.max(1, Math.ceil(contatosFiltrados.length / PAGINA_SIZE));
  const contatosPagina = contatosFiltrados.slice((paginaAtual - 1) * PAGINA_SIZE, paginaAtual * PAGINA_SIZE);

  // Listas únicas pra filtros
  const atendentesUnicos = useMemo(() => {
    const set = new Set<string>();
    contatos.forEach(c => { if (c.ultimoAtendente) set.add(c.ultimoAtendente); });
    return Array.from(set).sort();
  }, [contatos]);

  // ═══ STATS ═══
  const stats = useMemo(() => {
    const agora = new Date();
    const seteDias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: contatos.length,
      novosSemana: contatos.filter(c => new Date(c.ultimaData) >= seteDias).length,
      ativos: contatos.filter(c => c.ultimoStatus === "aberto" || c.ultimoStatus === "em_atendimento").length,
      bot: contatos.filter(c => c.ultimoAtendente === "BOT").length,
    };
  }, [contatos]);

  // ═══ ABRIR MODAL DE EDIÇÃO ═══
  const abrirEditar = (c: Contato) => {
    setContatoEditando(c);
    setNomeEditado(c.nome);
    setEtiquetasSelecionadas(new Set(c.etiquetasIds));
  };

  const fecharModal = () => {
    setContatoEditando(null);
    setNomeEditado("");
    setEtiquetasSelecionadas(new Set());
  };

  // ═══ SALVAR (nome + etiquetas) ═══
  const salvarContato = async () => {
    if (!contatoEditando || !wsId) return;
    if (!nomeEditado.trim()) { alert("Nome não pode ficar vazio."); return; }
    setSalvandoContato(true);
    try {
      // 1) Atualiza nome em TODOS atendimentos com esse número (workspace_id no filtro = multi-tenant safe)
      if (nomeEditado.trim() !== contatoEditando.nome) {
        const { error } = await supabase.from("atendimentos")
          .update({ nome: nomeEditado.trim() })
          .eq("numero", contatoEditando.numero)
          .eq("workspace_id", wsId);
        if (error) { alert("Erro ao atualizar nome: " + error.message); setSalvandoContato(false); return; }
      }

      // 2) Atualiza etiquetas: como elas são por atendimento, aplica ao MAIS RECENTE
      // (o agregado já junta etiquetas de todos os atendimentos do contato)
      const ultimoAtend = contatoEditando.atendimentos
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (ultimoAtend) {
        const atuais = new Set(etiquetasPorAtend[ultimoAtend.id] || []);
        const novas = etiquetasSelecionadas;

        // Adicionar as que estão em novas mas não em atuais
        const paraAdd = Array.from(novas).filter(eid => !atuais.has(eid));
        // Remover as que estão em atuais mas não em novas
        const paraRemover = Array.from(atuais).filter(eid => !novas.has(eid));

        if (paraAdd.length > 0) {
          const inserts = paraAdd.map(eid => ({ atendimento_id: ultimoAtend.id, etiqueta_id: eid }));
          await supabase.from("atendimento_etiquetas").insert(inserts);
        }
        for (const eid of paraRemover) {
          await supabase.from("atendimento_etiquetas").delete()
            .eq("atendimento_id", ultimoAtend.id)
            .eq("etiqueta_id", eid);
        }
      }

      await carregarDados(wsId);
      fecharModal();
      alert("Contato atualizado!");
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
    setSalvandoContato(false);
  };

  // ═══ EXCLUIR CONTATO (todos atendimentos do número) ═══
  const excluirContato = async (c: Contato) => {
    if (!wsId) return;
    if (!confirm(`Excluir TODOS os ${c.totalAtendimentos} atendimento(s) do contato "${c.nome}"?\n\nNúmero: ${c.numero}\n\nEsta ação NÃO pode ser desfeita.`)) return;
    try {
      const ids = c.atendimentos.map(a => a.id);
      // Apaga relações de etiquetas primeiro
      const LOTE = 500;
      for (let i = 0; i < ids.length; i += LOTE) {
        const lote = ids.slice(i, i + LOTE);
        await supabase.from("atendimento_etiquetas").delete().in("atendimento_id", lote);
      }
      // Apaga atendimentos (multi-tenant safe)
      const { error } = await supabase.from("atendimentos").delete()
        .eq("numero", c.numero)
        .eq("workspace_id", wsId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await carregarDados(wsId);
      fecharModal();
      alert("Contato excluído!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // ═══ EXPORTAR EXCEL ═══
  const exportar = () => {
    if (contatosFiltrados.length === 0) { alert("Nenhum contato pra exportar."); return; }
    setExportando(true);
    try {
      const dados = contatosFiltrados.map(c => ({
        "Nome": c.nome,
        "Telefone": c.numero.replace(/\D/g, ""),
        "Total Atendimentos": c.totalAtendimentos,
        "Etiquetas": c.etiquetasIds.map(id => {
          const e = etiquetas.find(x => x.id === id);
          return e ? `${e.icone} ${e.nome}` : "";
        }).filter(Boolean).join(", "),
        "Última Mensagem": c.ultimaMensagem,
        "Última Fila": c.ultimaFila || "",
        "Último Atendente": c.ultimoAtendente || "",
        "Último Status": c.ultimoStatus === "resolvido" ? "Resolvido" : c.ultimoStatus === "aberto" ? "Aberto" : c.ultimoStatus === "em_atendimento" ? "Em atendimento" : c.ultimoStatus === "pendente" ? "Pendente" : c.ultimoStatus,
        "Última Interação": new Date(c.ultimaData).toLocaleString("pt-BR"),
      }));
      const ws = XLSX.utils.json_to_sheet(dados);
      ws["!cols"] = [
        { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 40 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contatos");
      const hoje = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `contatos_wolf_${hoje}.xlsx`);
    } catch (e: any) { alert("Erro ao exportar: " + e.message); }
    setExportando(false);
  };

  const corStatus = (s: string) => ({
    resolvido: "#059669", aberto: "#3b82f6", em_atendimento: "#f59e0b", pendente: "#f59e0b",
  }[s] || "#64748B");
  const labelStatus = (s: string) => ({
    resolvido: "Resolvido", aberto: "Aberto", em_atendimento: "Em atendimento", pendente: "Pendente",
  }[s] || s);

  const limparFiltros = () => {
    setBusca(""); setFiltroStatus("todos"); setFiltroEtiqueta("todas");
    setFiltroAtendente("todos"); setFiltroPeriodo("todos");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 18 : 24 }}>

      {/* ═══ MODAL DE EDIÇÃO ═══ */}
      {contatoEditando && (
        <div onClick={fecharModal}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...cardStyle, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Header do modal */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E6ECEA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 18, fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(5,150,105,0.25)",
                }}>
                  {contatoEditando.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: 0 }}>{contatoEditando.nome}</h3>
                  <p style={{ color: "#64748B", fontSize: 12, margin: "2px 0 0", fontFamily: "monospace" }}>{contatoEditando.numero}</p>
                </div>
              </div>
              <button onClick={fecharModal}
                style={{ background: "#F1F5F4", border: "none", color: "#64748B", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Nome editável */}
              <div>
                <label style={{ color: "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome do Contato</label>
                <input value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} style={inputStyle} placeholder="Nome do contato" />
                <p style={{ color: "#94A3B8", fontSize: 10, margin: "4px 0 0" }}>Alterar aqui atualiza o nome em TODOS os atendimentos deste número.</p>
              </div>

              {/* Stats do contato */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <p style={{ color: "#059669", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{contatoEditando.totalAtendimentos}</p>
                  <p style={{ color: "#64748B", fontSize: 10, margin: "3px 0 0", fontWeight: 600, textTransform: "uppercase" }}>Atendimentos</p>
                </div>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <p style={{ color: "#059669", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{contatoEditando.atendimentos.filter(a => a.status === "resolvido").length}</p>
                  <p style={{ color: "#64748B", fontSize: 10, margin: "3px 0 0", fontWeight: 600, textTransform: "uppercase" }}>Resolvidos</p>
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <p style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{contatoEditando.atendimentos.filter(a => a.status === "aberto" || a.status === "em_atendimento" || a.status === "pendente").length}</p>
                  <p style={{ color: "#64748B", fontSize: 10, margin: "3px 0 0", fontWeight: 600, textTransform: "uppercase" }}>Em aberto</p>
                </div>
              </div>

              {/* Etiquetas */}
              <div>
                <label style={{ color: "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Etiquetas</label>
                {etiquetas.length === 0 ? (
                  <p style={{ color: "#94A3B8", fontSize: 12, fontStyle: "italic", margin: 0 }}>Nenhuma etiqueta cadastrada. Vá em Chatbot → Etiquetas para criar.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {etiquetas.map(e => {
                      const marcada = etiquetasSelecionadas.has(e.id);
                      return (
                        <button key={e.id} onClick={() => {
                          const nova = new Set(etiquetasSelecionadas);
                          if (nova.has(e.id)) nova.delete(e.id); else nova.add(e.id);
                          setEtiquetasSelecionadas(nova);
                        }}
                          style={{
                            background: marcada ? `${e.cor}15` : "#ffffff",
                            border: `1.5px solid ${marcada ? e.cor : "#E6ECEA"}`,
                            color: marcada ? e.cor : "#64748B",
                            borderRadius: 20, padding: "6px 12px", fontSize: 12,
                            cursor: "pointer", fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 6,
                            transition: "all 0.15s",
                            boxShadow: marcada ? `0 2px 6px ${e.cor}25` : "none",
                          }}>
                          <span>{<IconeEmoji e={e.icone} />}</span>
                          <span>{e.nome}</span>
                          {marcada && <span style={{ marginLeft: 2 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Histórico recente (últimos 5 atendimentos) */}
              <div>
                <label style={{ color: "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Histórico de atendimentos</label>
                <div style={{ background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 10, padding: 12, maxHeight: 240, overflowY: "auto" }}>
                  {contatoEditando.atendimentos
                    .slice()
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 10)
                    .map(a => (
                      <div key={a.id}
                        style={{
                          padding: "8px 10px", borderRadius: 8,
                          background: "#ffffff", marginBottom: 6,
                          borderLeft: `3px solid ${corStatus(a.status)}`,
                          fontSize: 12,
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <span style={{ color: corStatus(a.status), fontSize: 11, fontWeight: 700 }}>{labelStatus(a.status)}</span>
                          <span style={{ color: "#94A3B8", fontSize: 10 }}>{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p style={{ color: "#334155", fontSize: 12, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.mensagem || "—"}</p>
                        <p style={{ color: "#94A3B8", fontSize: 10, margin: "3px 0 0" }}>
                          {a.fila && <>{a.fila} · </>}
                          {a.atendente && (a.atendente === "BOT" ? "BOT" : `${a.atendente}`)}
                        </p>
                      </div>
                    ))}
                  {contatoEditando.atendimentos.length > 10 && (
                    <p style={{ color: "#94A3B8", fontSize: 11, textAlign: "center", margin: "8px 0 0", fontStyle: "italic" }}>
                      +{contatoEditando.atendimentos.length - 10} atendimentos mais antigos
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer com ações */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E6ECEA", display: "flex", gap: 10, justifyContent: "space-between", background: "#F7FAF9", flexWrap: "wrap" }}>
              <button onClick={() => excluirContato(contatoEditando)}
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                Excluir contato
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { fecharModal(); router.push("/chatbot"); }}
                  style={{ background: "#ffffff", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                  Abrir chat
                </button>
                <button onClick={salvarContato} disabled={salvandoContato}
                  style={{
                    background: salvandoContato ? "#047857" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 12,
                    cursor: salvandoContato ? "not-allowed" : "pointer", fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(5,150,105,0.3)",
                  }}>
                  {salvandoContato ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CABEÇALHO (A2) ═══ */}
      <section style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, padding: "4px 4px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: "-.02em", color: "#0F172A" }}>Contatos</h1>
          <span style={{ color: "#64748B", fontSize: 14 }}>Todos os clientes e leads que chegaram pelas suas conexões · <b style={{ color: "#0F172A" }}>{contatos.length}</b> contato(s)</span>
        </div>
        <div style={{ marginLeft: isMobile ? 0 : "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {veTudo && <EquipeSelector />}
          {travadoEquipe && minhaEquipeNome && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", borderRadius: 13, height: 44, padding: "0 14px", boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 6px 16px -10px rgba(16,24,40,.2)" }}>
              <Icone nome="usuarios" tamanho={16} cor="#059669" />
              <span style={{ color: "#64748B", fontSize: 12, fontWeight: 700 }}>Equipe</span>
              <span style={{ color: "#047857", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{minhaEquipeNome}</span>
            </div>
          )}
          <button onClick={exportar} disabled={exportando || contatosFiltrados.length === 0}
            style={{
              height: 44, borderRadius: 13, border: 0, padding: "0 18px", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8,
              background: (exportando || contatosFiltrados.length === 0) ? "#F1F5F4" : "linear-gradient(140deg, #10B981, #059669)",
              color: (exportando || contatosFiltrados.length === 0) ? "#94A3B8" : "#FFFFFF",
              cursor: (exportando || contatosFiltrados.length === 0) ? "not-allowed" : "pointer",
              boxShadow: (exportando || contatosFiltrados.length === 0) ? "none" : "0 10px 22px -10px rgba(5,150,105,.75)",
            }}>
            <Icone nome="download" tamanho={16} /> {exportando ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
      </section>

      {/* Aviso de truncamento */}
      {truncado && (
        <div style={{ background: "#FFFBEB", borderRadius: 14, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <Icone nome="info" tamanho={16} cor="#B45309" />
          <p style={{ color: "#92400E", fontSize: 13, margin: 0, fontWeight: 600 }}>
            Mostrando os 10.000 atendimentos mais recentes. Se você precisa de tudo, use os <b>Relatórios</b> com filtros de período.
          </p>
        </div>
      )}

      {/* ═══ RESUMO ═══ */}
      <section aria-label="Resumo" style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: isMobile ? 10 : 18 }}>
        {[
          { label: "Total de contatos", value: stats.total, icone: "usuarios", bg: "#ECFDF5", fg: "#059669" },
          { label: "Novos nos últimos 7 dias", value: stats.novosSemana, icone: "calendario", bg: "#ECFDF5", fg: "#059669" },
          { label: "Conversas em aberto", value: stats.ativos, icone: "chat", bg: "#FFF7ED", fg: "#EA580C" },
          { label: "Atendidos pelo bot", value: stats.bot, icone: "robo", bg: "#ECFDF5", fg: "#059669" },
        ].map(card => (
          <div key={card.label} style={{ background: "#FFFFFF", borderRadius: 18, padding: isMobile ? "14px 16px" : "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 28px -16px rgba(16,24,40,.18)", minWidth: 0 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: card.bg, color: card.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome={card.icone} tamanho={20} /></span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{card.label}</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }}>{card.value.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ═══ LISTA (filtros + tabela num cartão só) ═══ */}
      <section aria-label="Lista de contatos" style={{ background: "#FFFFFF", borderRadius: 22, boxShadow: "0 2px 4px rgba(16,24,40,.04), 0 24px 48px -24px rgba(16,24,40,.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: isMobile ? 14 : "18px 22px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#F3F6F5", borderRadius: 12, height: 42, padding: "0 12px", flex: "1 1 260px", maxWidth: isMobile ? "none" : 380, color: "#64748B" }}>
            <Icone nome="busca" tamanho={16} />
            <input aria-label="Buscar contato" className="a2-input-limpo" placeholder="Buscar por nome, número ou mensagem" value={busca} onChange={e => setBusca(e.target.value)}
              style={{ border: 0, outline: "none", background: "transparent", fontSize: 14, width: "100%", minWidth: 0, color: "#0F172A", padding: 0 }} />
          </label>
          {[
            { key: "todos", label: "Todos" },
            { key: "hoje", label: "Hoje" },
            { key: "semana", label: "7 dias" },
            { key: "mes", label: "30 dias" },
          ].map(p => {
            const ativo = filtroPeriodo === p.key;
            return (
              <button key={p.key} onClick={() => setFiltroPeriodo(p.key as any)}
                style={{ height: 42, borderRadius: 12, border: 0, background: ativo ? "#ECFDF5" : "#F3F6F5", color: ativo ? "#047857" : "#475569", fontSize: 13, fontWeight: ativo ? 800 : 600, padding: "0 14px", cursor: "pointer" }}>
                {p.label}
              </button>
            );
          })}
          <select aria-label="Situação" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={filtroSel}>
            <option value="todos">Situação: todas</option>
            <option value="aberto">Aberto</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="pendente">Pendente</option>
            <option value="resolvido">Resolvido</option>
          </select>
          <select aria-label="Etiqueta" value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={filtroSel}>
            <option value="todas">Etiqueta: todas</option>
            {etiquetas.map(e => <option key={e.id} value={e.id.toString()}>{e.nome}</option>)}
          </select>
          <select aria-label="Atendente" value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={filtroSel}>
            <option value="todos">Atendente: todos</option>
            {atendentesUnicos.map(a => <option key={a} value={a}>{a === "BOT" ? "BOT" : a}</option>)}
          </select>
          {(busca || filtroStatus !== "todos" || filtroEtiqueta !== "todas" || filtroAtendente !== "todos" || filtroPeriodo !== "todos") && (
            <button onClick={limparFiltros} style={{ height: 42, borderRadius: 12, border: 0, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, fontWeight: 700, padding: "0 14px", cursor: "pointer" }}>
              Limpar filtros
            </button>
          )}
          <span style={{ marginLeft: "auto", color: "#64748B", fontSize: 13 }}>
            {contatosFiltrados.length === contatos.length ? `${contatos.length} contato(s)` : `${contatosFiltrados.length} de ${contatos.length} contato(s)`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#64748B", borderTop: "1px solid #EEF2F1" }}>Carregando contatos...</div>
        ) : contatos.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", borderTop: "1px solid #EEF2F1" }}>
            <span style={{ width: 64, height: 64, borderRadius: 20, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icone nome="usuarios" tamanho={28} /></span>
            <h3 style={{ color: "#0F172A", fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>Nenhum contato ainda</h3>
            <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>Os leads que chegarem pelo WhatsApp aparecem aqui automaticamente.</p>
          </div>
        ) : contatosFiltrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", borderTop: "1px solid #EEF2F1" }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "#F3F6F5", color: "#64748B", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="busca" tamanho={22} /></span>
            <p style={{ color: "#64748B", fontSize: 13.5, margin: 0 }}>Nenhum contato com esses filtros.</p>
          </div>
        ) : isMobile ? (
          /* ═══ CELULAR: CARTÕES ═══ */
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" }}>
            {contatosPagina.map(c => {
              const cor = corStatus(c.ultimoStatus);
              const etiqs = c.etiquetasIds.map(id => etiquetas.find(e => e.id === id)).filter(Boolean) as Etiqueta[];
              return (
                <button key={c.numero} onClick={() => abrirEditar(c)} style={{ textAlign: "left", border: 0, background: "#F7FAF9", borderRadius: 16, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: corAvatarContato(c.nome).bg, color: corAvatarContato(c.nome).fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{iniciaisContato(c.nome)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#0F172A", fontSize: 14, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</p>
                      <p style={{ color: "#64748B", fontSize: 12, margin: "2px 0 0" }}>{c.numero}</p>
                    </div>
                    <span style={{ background: `${cor}14`, color: cor, fontSize: 11, padding: "3px 9px", borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>{labelStatus(c.ultimoStatus)}</span>
                  </div>
                  <p style={{ color: "#475569", fontSize: 12.5, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{c.ultimaMensagem || "—"}</p>
                  {etiqs.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {etiqs.slice(0, 3).map(e => (
                        <span key={e.id} style={{ background: e.cor + "1A", color: e.cor, fontSize: 11, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{e.nome}</span>
                      ))}
                      {etiqs.length > 3 && <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600 }}>+{etiqs.length - 3}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* ═══ COMPUTADOR: TABELA ═══ */
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr>
                  {["Contato", "Telefone", "Etiquetas", "Atendente", "Situação", "Conversas", "Última conversa"].map((h, i) => (
                    <th key={h} style={{ padding: "12px 22px", color: "#64748B", fontSize: 12, textAlign: i === 6 ? "right" : "left", whiteSpace: "nowrap", fontWeight: 700, background: "#F7FAF9", borderTop: "1px solid #EEF2F1", borderBottom: "1px solid #EEF2F1" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contatosPagina.map(c => {
                  const cor = corStatus(c.ultimoStatus);
                  const etiqs = c.etiquetasIds.map(id => etiquetas.find(e => e.id === id)).filter(Boolean) as Etiqueta[];
                  return (
                    <tr key={c.numero} onClick={() => abrirEditar(c)} className="a2-linha-contato" style={{ borderTop: "1px solid #F1F5F4", cursor: "pointer" }}>
                      <td style={{ padding: "14px 22px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ width: 40, height: 40, borderRadius: 12, background: corAvatarContato(c.nome).bg, color: corAvatarContato(c.nome).fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{iniciaisContato(c.nome)}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: "#0F172A", fontSize: 14, fontWeight: 700, margin: 0, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</p>
                            <p style={{ color: "#94A3B8", fontSize: 12.5, margin: "2px 0 0", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimaMensagem || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 22px", color: "#334155", fontSize: 13.5, whiteSpace: "nowrap" }}>{c.numero}</td>
                      <td style={{ padding: "14px 22px" }}>
                        {etiqs.length === 0 ? <span style={{ color: "#CBD5E1", fontSize: 13 }}>—</span> : (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
                            {etiqs.slice(0, 2).map(e => (
                              <span key={e.id} style={{ background: e.cor + "1A", color: e.cor, fontSize: 11.5, padding: "3px 10px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}>{e.nome}</span>
                            ))}
                            {etiqs.length > 2 && <span style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 600, padding: "3px 2px" }}>+{etiqs.length - 2}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 22px", color: "#334155", fontSize: 13 }}>
                        {c.ultimoAtendente ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 26, height: 26, borderRadius: 8, background: "#ECFDF5", color: "#047857", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.ultimoAtendente === "BOT" ? <Icone nome="robo" tamanho={14} /> : iniciaisContato(c.ultimoAtendente)}</span>
                            <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimoAtendente === "BOT" ? "Bot" : c.ultimoAtendente}</span>
                          </span>
                        ) : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 22px" }}>
                        <span style={{ background: `${cor}14`, color: cor, fontSize: 12, padding: "3px 10px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}>{labelStatus(c.ultimoStatus)}</span>
                      </td>
                      <td style={{ padding: "14px 22px", color: "#0F172A", fontSize: 13.5, fontWeight: 700 }}>{c.totalAtendimentos}</td>
                      <td style={{ padding: "14px 22px", color: "#64748B", fontSize: 12.5, whiteSpace: "nowrap", textAlign: "right" }}>
                        {new Date(c.ultimaData).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ═══ PAGINAÇÃO ═══ */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "12px 0", flexWrap: "wrap" }}>
          <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}
            style={{
              background: paginaAtual === 1 ? "#F1F5F4" : "#ffffff",
              color: paginaAtual === 1 ? "#94A3B8" : "#334155",
              border: "none", borderRadius: 11, boxShadow: "inset 0 0 0 1px #EEF2F1",
              padding: "9px 16px", fontSize: 13,
              cursor: paginaAtual === 1 ? "not-allowed" : "pointer", fontWeight: 600,
            }}>
            Anterior
          </button>
          <span style={{ color: "#64748B", fontSize: 13, padding: "0 12px", fontWeight: 600 }}>
            Página <b style={{ color: "#0F172A" }}>{paginaAtual}</b> de <b style={{ color: "#0F172A" }}>{totalPaginas}</b>
          </span>
          <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}
            style={{
              background: paginaAtual === totalPaginas ? "#F1F5F4" : "#ffffff",
              color: paginaAtual === totalPaginas ? "#94A3B8" : "#334155",
              border: "none", borderRadius: 11, boxShadow: "inset 0 0 0 1px #EEF2F1",
              padding: "9px 16px", fontSize: 13,
              cursor: paginaAtual === totalPaginas ? "not-allowed" : "pointer", fontWeight: 600,
            }}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}