"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type Atendimento = {
  id: number;
  status: string;
  created_at: string;
  fila?: string;
  canal_id?: number;
  atendente?: string;
};
type Canal = { id: number; nome: string; tipo: string };
type Fila = { id: number; nome: string };
type UsuarioWs = { email: string; nome: string };

type Periodo = "hoje" | "semana" | "mes" | "ano" | "todos" | "personalizado";

export function DashboardSection() {
  const { workspace, wsId } = useWorkspace();

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [carregando, setCarregando] = useState(true);

  // 🆕 Filtros
  const [periodo, setPeriodo] = useState<Periodo>("mes"); // default = últimos 30 dias
  const [canalFiltro, setCanalFiltro] = useState<string>("todos"); // "todos" ou String(id)
  const [filaFiltro, setFilaFiltro] = useState<string>("todas"); // "todas" ou nome da fila
  const [atendenteFiltro, setAtendenteFiltro] = useState<string>("todos"); // "todos" ou email

  // 🆕 Data personalizada — quando periodo === "personalizado", esses dois states ditam o range.
  // Padrão: últimos 30 dias quando o user clica "Personalizado" pela primeira vez.
  const hojeStr = new Date().toISOString().slice(0, 10);
  const trintaDiasAtrasStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dataCustomInicio, setDataCustomInicio] = useState<string>(trintaDiasAtrasStr);
  const [dataCustomFim, setDataCustomFim] = useState<string>(hojeStr);

  // 🆕 Botão atualizar com feedback visual (estado de loading + spin do emoji 🔄)
  const [atualizando, setAtualizando] = useState(false);

  // Busca dados (atendimentos + canais + filas)
  // 🆕 fetchTudo extraído pra fora do useEffect — agora pode ser chamado pelo botão Atualizar.
  // O parâmetro `silencioso` evita mostrar "🔄 Carregando..." no header quando é refresh manual
  // (assim o spin do botão é o único feedback, fica mais limpo).
  const fetchTudo = async (silencioso = false) => {
    if (!wsId) return;
    if (!silencioso) setCarregando(true);
    try {
      // 🆕 ATENDIMENTOS — paginação até 5000 (limite combinado com o ChatSection).
      // Antes era query única, então o Supabase cortava em 1000 e o dashboard mostrava
      // estatística incompleta (ex: workspace com 16k atendimentos mostrava só "1000 total").
      // Agora pega 1000 em 1000 ordenado por created_at desc, até bater 5000 ou acabar.
      const fetchAtendimentosPaginado = async (): Promise<Atendimento[]> => {
        const PAGE_SIZE = 1000;
        const TOTAL_LIMITE = 5000;
        let lista: Atendimento[] = [];
        let offset = 0;
        while (offset < TOTAL_LIMITE) {
          const { data: pagina, error } = await supabase
            .from("atendimentos")
            .select("id, status, created_at, fila, canal_id, atendente")
            .eq("workspace_id", wsId)
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) {
            console.error("Erro fetchAtendimentos paginado (Dashboard):", error);
            break;
          }
          if (!pagina || pagina.length === 0) break;
          lista = lista.concat(pagina as Atendimento[]);
          if (pagina.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }
        return lista;
      };

      const [listaAtendimentos, resCx, resFi, resUs] = await Promise.all([
        fetchAtendimentosPaginado(),
        supabase
          .from("conexoes")
          .select("id, nome, tipo")
          .eq("workspace_id", wsId),
        supabase
          .from("filas")
          .select("id, nome")
          .eq("workspace_id", wsId)
          .order("nome", { ascending: true }),
        supabase
          .from("usuarios_workspace")
          .select("email, nome")
          .eq("workspace_id", wsId),
      ]);
      setAtendimentos(listaAtendimentos);
      setCanais((resCx.data as Canal[]) || []);
      setFilas((resFi.data as Fila[]) || []);
      const subs: UsuarioWs[] = (resUs.data as UsuarioWs[]) || [];
      if (workspace?.owner_email) {
        subs.push({ email: workspace.owner_email, nome: workspace.nome || "Dono" });
      }
      setUsuariosWs(subs);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  };

  // 🆕 Botão atualizar manual com feedback (mín. 600ms de spin pra UX)
  const atualizarManual = async () => {
    if (atualizando) return;
    setAtualizando(true);
    const t0 = Date.now();
    try {
      await fetchTudo(true);
    } catch (e) {
      console.error("Erro ao atualizar dashboard:", e);
    }
    const passou = Date.now() - t0;
    if (passou < 600) await new Promise(r => setTimeout(r, 600 - passou));
    setAtualizando(false);
  };

  useEffect(() => {
    if (!wsId) return;
    let cancel = false;

    fetchTudo();


    // Realtime — atualiza sozinho quando entram novos leads
    const ch = supabase
      .channel(`dash_${wsId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conexoes", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [wsId, workspace?.owner_email, workspace?.nome]);

  // 🆕 Calcula data de início conforme o período selecionado
  const dataInicio = useMemo(() => {
    const agora = new Date();
    if (periodo === "hoje") {
      const d = new Date(agora);
      d.setHours(0, 0, 0, 0); // começo do dia de hoje
      return d;
    }
    if (periodo === "semana") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (periodo === "mes") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (periodo === "ano") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 365);
      return d;
    }
    // 🆕 Período personalizado — usa as datas escolhidas pelo user
    if (periodo === "personalizado") {
      const d = new Date(dataCustomInicio + "T00:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    return null; // "todos" = sem limite
  }, [periodo, dataCustomInicio]);

  // 🆕 Data fim — só relevante pra período personalizado (os outros filtram só por início).
  // Inclui o dia inteiro: T23:59:59.999
  const dataFim = useMemo(() => {
    if (periodo !== "personalizado") return null;
    const d = new Date(dataCustomFim + "T23:59:59.999");
    return isNaN(d.getTime()) ? null : d;
  }, [periodo, dataCustomFim]);

  // 🆕 Aplica todos os filtros
  const atendimentosFiltrados = useMemo(() => {
    return atendimentos.filter(a => {
      const dt = new Date(a.created_at);
      if (dataInicio && dt < dataInicio) return false;
      if (dataFim && dt > dataFim) return false; // 🆕 só relevante pra período personalizado
      if (canalFiltro !== "todos" && String(a.canal_id || "") !== canalFiltro) return false;
      if (filaFiltro !== "todas" && (a.fila || "") !== filaFiltro) return false;
      if (atendenteFiltro !== "todos" && (a.atendente || "") !== atendenteFiltro) return false;
      return true;
    });
  }, [atendimentos, dataInicio, dataFim, canalFiltro, filaFiltro, atendenteFiltro]);

  // 🆕 Helper de classificação — usa MESMA lógica do ChatSection.classificarAba()
  // pra os números do dashboard baterem com as abas do chat. Antes os cards filtravam
  // por status do banco direto ("aberto", "em_atendimento", "resolvido"), mas o banco
  // só tem "pendente"/"aberto"/"resolvido" — então "Em Atendimento" e "Abertos" sempre
  // davam 0 porque os atendimentos com humano vinham com status "pendente" + atendente
  // setado, ou status "aberto". Resultado: cards zerados mesmo com 100+ atendimentos.
  type AbaCalc = "automatico" | "aguardando" | "abertos" | "finalizados";
  const classificarAtendimento = (a: Atendimento): AbaCalc => {
    if (a.status === "resolvido") return "finalizados";
    if (a.atendente === "BOT") return "automatico";
    const atendenteEhReal = !!a.atendente && !["BOT", "Humano"].includes(a.atendente);
    if (atendenteEhReal) return "abertos";
    if (a.status === "pendente") return "aguardando";
    return "abertos";
  };

  // Cards principais — agora 4 categorias que batem com as abas do chat
  const cards = [
    {
      label: "Aguardando",
      value: atendimentosFiltrados.filter(a => classificarAtendimento(a) === "aguardando").length,
      color: "#f59e0b",
      icon: "⏳",
    },
    {
      label: "Em Atendimento",
      value: atendimentosFiltrados.filter(a => classificarAtendimento(a) === "abertos").length,
      color: "#3b82f6",
      icon: "👤",
    },
    {
      label: "Resolvidos",
      value: atendimentosFiltrados.filter(a => classificarAtendimento(a) === "finalizados").length,
      color: "#16a34a",
      icon: "✅",
    },
    {
      label: "Total",
      value: atendimentosFiltrados.length,
      color: "#8b5cf6",
      icon: "📊",
    },
  ];

  // 🆕 Breakdown por canal (quantos leads chegaram de cada conexão)
  const porCanal = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentosFiltrados.forEach(a => {
      const id = String(a.canal_id || "sem-canal");
      map[id] = (map[id] || 0) + 1;
    });
    return Object.entries(map)
      .map(([id, count]) => {
        const canal = canais.find(c => String(c.id) === id);
        return {
          id,
          nome: canal ? canal.nome : id === "sem-canal" ? "— Sem canal —" : `Canal ${id}`,
          tipo: canal?.tipo || "",
          count,
          cor: canal?.tipo === "waba" ? "#3b82f6" : "#16a34a",
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [atendimentosFiltrados, canais]);

  // 🆕 Breakdown por fila (quantos leads por cada fila)
  const porFila = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentosFiltrados.forEach(a => {
      const fila = a.fila || "— Sem fila —";
      map[fila] = (map[fila] || 0) + 1;
    });
    return Object.entries(map)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);
  }, [atendimentosFiltrados]);

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // CARDS POR TIPO DE CANAL — agrupa por TIPO (webjs/waba), não por canal individual
  // ═══════════════════════════════════════════════════════════════════════
  // Pra mostrar o card "WhatsApp" (todos webjs somados) e "API Oficial" (todos waba somados)
  // Antes era 1 card por canal individual, mas pro dashboard executivo faz mais sentido por tipo.
  const porTipoCanal = useMemo(() => {
    const map: Record<string, number> = { webjs: 0, waba: 0, outros: 0 };
    atendimentosFiltrados.forEach(a => {
      const canal = canais.find(c => String(c.id) === String(a.canal_id));
      const tipo = canal?.tipo || "outros";
      if (tipo === "webjs") map.webjs++;
      else if (tipo === "waba") map.waba++;
      else map.outros++;
    });
    return map;
  }, [atendimentosFiltrados, canais]);

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // STATUS DOS ATENDENTES — usa atendimentosFiltrados pra ver quem tá ativo HOJE
  // ═══════════════════════════════════════════════════════════════════════
  // Como NÃO temos campo last_seen no banco, usamos heurística: atendente que tem
  // pelo menos 1 atendimento atribuído nas últimas 4h tá considerado "ativo".
  // Não é "online em tempo real" igual o print, mas é o melhor que dá com os dados atuais.
  const statusAtendentes = useMemo(() => {
    const agoraTs = Date.now();
    const QUATRO_HORAS = 4 * 60 * 60 * 1000;
    // Pega os atendimentos recentes (últimas 4h) E que tem atendente humano
    const atendimentosRecentes = atendimentos.filter(a => {
      const ts = new Date(a.updated_at || a.created_at).getTime();
      return (agoraTs - ts) <= QUATRO_HORAS && a.atendente && !["BOT", "Humano"].includes(a.atendente);
    });
    const ativosEmail = new Set(atendimentosRecentes.map(a => a.atendente));
    return usuariosWs.map(u => ({
      email: u.email,
      nome: u.nome || u.email.split("@")[0],
      online: ativosEmail.has(u.email),
      // Conta atendimentos ativos do dia desse atendente (pro tooltip)
      atendendoAgora: atendimentosFiltrados.filter(a =>
        a.atendente === u.email && a.status !== "resolvido"
      ).length,
    })).sort((a, b) => {
      // Online primeiro
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [atendimentos, atendimentosFiltrados, usuariosWs]);

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // EVOLUÇÃO POR HORA — só HOJE, 24h, pra gráfico de linha
  // ═══════════════════════════════════════════════════════════════════════
  // Sempre 24 buckets (00h–23h). Conta atendimentos criados em cada hora HOJE.
  const evolucaoPorHora = useMemo(() => {
    const buckets: { hora: string; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({ hora: `${String(h).padStart(2, "0")}:00`, count: 0 });
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    atendimentosFiltrados.forEach(a => {
      const dt = new Date(a.created_at);
      if (dt < hoje) return; // só hoje
      buckets[dt.getHours()].count++;
    });
    return buckets;
  }, [atendimentosFiltrados]);

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // GRÁFICO DE DESEMPENHO — agrupa atendimentos por dia (ou hora se período curto)
  // ═══════════════════════════════════════════════════════════════════════
  // Decisão de granularidade:
  //   - hoje              → agrupa por hora (24 buckets)
  //   - semana / mes      → agrupa por dia (7 ou ~30 buckets)
  //   - ano / todos       → agrupa por mês
  //   - personalizado     → decide pelo range em dias
  //
  // Cada bucket tem: { rotulo, abertos, em_atendimento, resolvidos, total }
  // O SVG renderiza barras stacked (azul/laranja/verde) representando esses status.
  const serieGrafico = useMemo(() => {
    if (atendimentosFiltrados.length === 0) return { buckets: [], granularidade: "dia" as "hora" | "dia" | "mes" };

    // Decide granularidade pelo range
    let granularidade: "hora" | "dia" | "mes" = "dia";
    if (periodo === "hoje") granularidade = "hora";
    else if (periodo === "ano" || periodo === "todos") granularidade = "mes";
    else if (periodo === "personalizado") {
      const inicio = dataInicio?.getTime() || 0;
      const fim = dataFim?.getTime() || Date.now();
      const dias = (fim - inicio) / (1000 * 60 * 60 * 24);
      if (dias <= 2) granularidade = "hora";
      else if (dias > 90) granularidade = "mes";
      else granularidade = "dia";
    }

    // Agrupa
    // 🆕 Buckets agora usam a MESMA classificação dos cards (em vez de status crus do banco).
    // Antes: aberto/em_atendimento/resolvido → "em_atendimento" não existe no banco, então
    // tudo caia em "abertos" (azul) — gráfico ficava 100% azul mesmo tendo resolvidos no dia.
    // Agora: aguardando(pendente sem atendente) / em_atendimento(tem atendente humano) / resolvidos
    const map: Record<string, { aguardando: number; em_atendimento: number; resolvidos: number; total: number; ts: number }> = {};
    atendimentosFiltrados.forEach(a => {
      const dt = new Date(a.created_at);
      let chave: string;
      let ts: number;
      if (granularidade === "hora") {
        chave = `${String(dt.getHours()).padStart(2, "0")}h`;
        ts = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours()).getTime();
      } else if (granularidade === "dia") {
        chave = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
        ts = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
      } else {
        const mesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][dt.getMonth()];
        chave = `${mesNome}/${String(dt.getFullYear()).slice(2)}`;
        ts = new Date(dt.getFullYear(), dt.getMonth(), 1).getTime();
      }
      if (!map[chave]) map[chave] = { aguardando: 0, em_atendimento: 0, resolvidos: 0, total: 0, ts };
      map[chave].total++;
      const cat = classificarAtendimento(a);
      if (cat === "finalizados") map[chave].resolvidos++;
      else if (cat === "abertos") map[chave].em_atendimento++;
      else if (cat === "aguardando") map[chave].aguardando++;
      // "automatico" (BOT) também conta no total mas não tem cor própria — engloba em "aguardando"
      // pra não criar 4 cores no gráfico (fica visualmente poluído). Decisão de design.
      else if (cat === "automatico") map[chave].aguardando++;
    });

    // Ordena cronologicamente
    const buckets = Object.entries(map)
      .map(([rotulo, v]) => ({ rotulo, ...v }))
      .sort((a, b) => a.ts - b.ts);

    return { buckets, granularidade };
  }, [atendimentosFiltrados, periodo, dataInicio, dataFim]);

  // 🆕 Breakdown por atendente — mostra quantos cada usuário tá tratando e quantos já resolveu
  // Útil pra ver produtividade da equipe no período filtrado
  const porAtendente = useMemo(() => {
    type Bucket = { chave: string; emAtendimento: number; resolvidos: number; total: number };
    const map: Record<string, Bucket> = {};

    atendimentosFiltrados.forEach(a => {
      const chave = a.atendente || "sem-atendente";
      if (!map[chave]) map[chave] = { chave, emAtendimento: 0, resolvidos: 0, total: 0 };
      map[chave].total++;
      if (a.status === "resolvido") map[chave].resolvidos++;
      else map[chave].emAtendimento++;
    });

    // Pega o nome amigável pelo email, com tratamento especial pro BOT e vazio
    const nomeDe = (chave: string): string => {
      if (chave === "sem-atendente") return "— Sem atendente —";
      if (chave === "BOT") return "🤖 BOT (automático)";
      if (chave === "Humano") return "👤 Humano (legado)"; // atendimentos antigos antes do fix do email
      const u = usuariosWs.find(us => us.email?.toLowerCase() === chave.toLowerCase());
      if (u?.nome) return u.nome;
      return chave.includes("@") ? chave.split("@")[0] : chave;
    };

    const corDe = (chave: string): string => {
      if (chave === "BOT") return "#8b5cf6";
      if (chave === "sem-atendente") return "#6b7280";
      if (chave === "Humano") return "#64748b";
      return "#00a884";
    };

    return Object.values(map)
      .map(b => ({
        ...b,
        nome: nomeDe(b.chave),
        cor: corDe(b.chave),
        inicial: (nomeDe(b.chave).replace(/[^a-zA-Z0-9À-ÿ]/g, "").charAt(0) || "?").toUpperCase(),
      }))
      .sort((a, b) => b.total - a.total);
  }, [atendimentosFiltrados, usuariosWs]);

  // Helpers de estilo
  const botaoPeriodo = (p: Periodo, label: string, icone: string) => {
    const ativo = periodo === p;
    return (
      <button
        onClick={() => setPeriodo(p)}
        style={{
          background: ativo ? "#8b5cf6" : "#1f2937",
          color: ativo ? "white" : "#9ca3af",
          border: `1px solid ${ativo ? "#8b5cf6" : "#374151"}`,
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: "bold",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span>{icone}</span> {label}
      </button>
    );
  };

  const temFiltroAtivo =
    periodo !== "todos" || canalFiltro !== "todos" || filaFiltro !== "todas" || atendenteFiltro !== "todos";

  // Label amigável do período ativo (aparece nos cards)
  const labelPeriodo = (() => {
    const map: Record<Periodo, string> = {
      hoje: "hoje",
      semana: "últimos 7 dias",
      mes: "últimos 30 dias",
      ano: "últimos 365 dias",
      todos: "período total",
      personalizado: `${dataCustomInicio.split("-").reverse().join("/")} → ${dataCustomFim.split("-").reverse().join("/")}`,
    };
    return map[periodo];
  })();

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
      {/* 🆕 CSS de animação spin pro botão atualizar */}
      <style>{`
        @keyframes spin-icon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📊 Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
            {carregando ? "🔄 Carregando..." : `📍 Mostrando: ${labelPeriodo}`}
          </p>
          {/* 🆕 Botão atualizar — recarrega dados manualmente com feedback visual */}
          <button
            onClick={atualizarManual}
            disabled={atualizando || carregando}
            title="Atualizar dados"
            style={{
              background: atualizando ? "#16a34a22" : "#1f2937",
              border: "1px solid #374151",
              color: atualizando ? "#16a34a" : "#e5e7eb",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: "bold",
              cursor: atualizando ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ display: "inline-block", animation: atualizando ? "spin-icon 0.6s linear infinite" : "none" }}>🔄</span>
            {atualizando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* 🆕 BARRA DE FILTROS */}
      <div
        style={{
          background: "#111",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Período */}
        <div>
          <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>
            Período
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {botaoPeriodo("hoje", "Hoje", "📅")}
            {botaoPeriodo("semana", "7 dias", "🗓️")}
            {botaoPeriodo("mes", "30 dias", "📆")}
            {botaoPeriodo("ano", "365 dias", "🗃️")}
            {botaoPeriodo("todos", "Todos", "∞")}
            {botaoPeriodo("personalizado", "Personalizado", "🎯")}
          </div>

          {/* 🆕 Inputs de data — só aparecem se "personalizado" estiver selecionado */}
          {periodo === "personalizado" && (
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px", minWidth: 160 }}>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
                  De
                </p>
                <input
                  type="date"
                  value={dataCustomInicio}
                  max={dataCustomFim}
                  onChange={e => setDataCustomInicio(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 13,
                    boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
              <div style={{ flex: "1 1 180px", minWidth: 160 }}>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
                  Até
                </p>
                <input
                  type="date"
                  value={dataCustomFim}
                  min={dataCustomInicio}
                  max={hojeStr}
                  onChange={e => setDataCustomFim(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 13,
                    boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
              <p style={{ color: "#6b7280", fontSize: 11, margin: 0, paddingBottom: 12 }}>
                💡 Escolha o intervalo que quer analisar
              </p>
            </div>
          )}
        </div>

        {/* Canal e Fila */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Canal / Conexão
            </p>
            <select
              value={canalFiltro}
              onChange={e => setCanalFiltro(e.target.value)}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "white",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="todos">📡 Todos os canais</option>
              {canais.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.tipo === "waba" ? "🔗" : "📱"} {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Fila
            </p>
            <select
              value={filaFiltro}
              onChange={e => setFilaFiltro(e.target.value)}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "white",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="todas">📋 Todas as filas</option>
              {filas.map(f => (
                <option key={f.id} value={f.nome}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          {/* 🆕 Filtro por atendente */}
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Atendente
            </p>
            <select
              value={atendenteFiltro}
              onChange={e => setAtendenteFiltro(e.target.value)}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "white",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="todos">👥 Todos os atendentes</option>
              <option value="BOT">🤖 BOT (automático)</option>
              {usuariosWs.map((u, i) => (
                <option key={u.email + i} value={u.email}>
                  👤 {u.nome || u.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>

          {temFiltroAtivo && (
            <button
              onClick={() => {
                setPeriodo("todos");
                setCanalFiltro("todos");
                setFilaFiltro("todas");
                setAtendenteFiltro("todos");
              }}
              style={{
                background: "#7f1d1d",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {cards.map(card => (
          <div
            key={card.label}
            style={{
              flex: "1 1 200px",
              background: "#111",
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${card.color}33`,
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>
              {card.icon} {card.label}
            </p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          GRÁFICO DE DESEMPENHO — atendimentos ao longo do tempo (SVG inline)
          ═══════════════════════════════════════════════════════════════
          Renderiza barras stacked: laranja=aguardando, azul=em_atendimento, verde=resolvidos.
          Usa serieGrafico pra agrupar por hora/dia/mês conforme o período selecionado.
      */}
      <div
        style={{
          background: "#111",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #1f2937",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>
            📈 Desempenho ({serieGrafico.granularidade === "hora" ? "por hora" : serieGrafico.granularidade === "mes" ? "por mês" : "por dia"})
          </p>
          {/* Legenda — bate com os cards de cima (Aguardando/Em Atendimento/Resolvidos) */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f59e0b", fontSize: 11 }}>
              <span style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2 }} /> Aguardando
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#3b82f6", fontSize: 11 }}>
              <span style={{ width: 10, height: 10, background: "#3b82f6", borderRadius: 2 }} /> Em atendimento
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#16a34a", fontSize: 11 }}>
              <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: 2 }} /> Resolvidos
            </span>
          </div>
        </div>

        {serieGrafico.buckets.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 12, margin: "20px 0", textAlign: "center" }}>
            Nenhum atendimento no período selecionado.
          </p>
        ) : (() => {
          const buckets = serieGrafico.buckets;
          const maxTotal = Math.max(...buckets.map(b => b.total), 1);
          const w = 1000;
          const h = 280;
          const padL = 40, padR = 12, padT = 16, padB = 36;
          const innerW = w - padL - padR;
          const innerH = h - padT - padB;
          const slotW = innerW / buckets.length;
          const barW = slotW * 0.7;
          const gridLines = [0.25, 0.5, 0.75, 1].map(p => ({
            y: padT + innerH - innerH * p,
            valor: Math.round(maxTotal * p),
          }));
          const passoRotulo = Math.max(1, Math.ceil(buckets.length / 12));

          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
              {gridLines.map((g, i) => (
                <g key={i}>
                  <line x1={padL} y1={g.y} x2={w - padR} y2={g.y} stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={padL - 6} y={g.y + 4} fontSize="10" fill="#6b7280" textAnchor="end">{g.valor}</text>
                </g>
              ))}

              {buckets.map((b, i) => {
                const x = padL + slotW * i + (slotW - barW) / 2;
                const totalH = (b.total / maxTotal) * innerH;
                // 🆕 Empilha de cima pra baixo: aguardando(laranja, no topo) → em_atendimento(azul, meio) → resolvidos(verde, base)
                const hAguardando = (b.aguardando / maxTotal) * innerH;
                const hAtend = (b.em_atendimento / maxTotal) * innerH;
                const hResolv = (b.resolvidos / maxTotal) * innerH;
                const yCursor = padT + innerH - totalH;

                return (
                  <g key={b.rotulo + i}>
                    <title>
                      {b.rotulo}: {b.total} total ({b.aguardando} aguardando, {b.em_atendimento} em atendimento, {b.resolvidos} resolvidos)
                    </title>
                    {hAguardando > 0 && (
                      <rect x={x} y={yCursor} width={barW} height={hAguardando} fill="#f59e0b" rx="2" />
                    )}
                    {hAtend > 0 && (
                      <rect x={x} y={yCursor + hAguardando} width={barW} height={hAtend} fill="#3b82f6" />
                    )}
                    {hResolv > 0 && (
                      <rect x={x} y={yCursor + hAguardando + hAtend} width={barW} height={hResolv} fill="#16a34a" />
                    )}
                    {i % passoRotulo === 0 && (
                      <text
                        x={x + barW / 2}
                        y={h - padB + 16}
                        fontSize="10"
                        fill="#9ca3af"
                        textAnchor="middle"
                      >
                        {b.rotulo}
                      </text>
                    )}
                    {totalH > 18 && (
                      <text
                        x={x + barW / 2}
                        y={yCursor - 4}
                        fontSize="9"
                        fill="#e5e7eb"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {b.total}
                      </text>
                    )}
                  </g>
                );
              })}

              <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#374151" strokeWidth="1" />
            </svg>
          );
        })()}

        <p style={{ color: "#6b7280", fontSize: 11, margin: "8px 0 0", textAlign: "center" }}>
          💡 Passe o mouse sobre as barras pra ver detalhes
        </p>
      </div>

      {/* 🆕 BREAKDOWNS — quantos leads por canal e por fila */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Por canal */}
        <div
          style={{
            flex: "1 1 320px",
            background: "#111",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #1f2937",
            minHeight: 140,
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", fontWeight: "bold" }}>
            📡 Por Canal / Conexão
          </p>
          {porCanal.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
          ) : (
            porCanal.map((c, i) => {
              const max = porCanal[0]?.count || 1;
              const pct = (c.count / max) * 100;
              return (
                <div key={c.id + i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                    <span style={{ color: "white", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.tipo === "waba" ? "🔗" : c.tipo === "webjs" ? "📱" : "📡"} {c.nome}
                    </span>
                    <span style={{ color: c.cor, fontSize: 13, fontWeight: "bold", flexShrink: 0 }}>{c.count}</span>
                  </div>
                  <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: c.cor, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Por fila */}
        <div
          style={{
            flex: "1 1 320px",
            background: "#111",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #1f2937",
            minHeight: 140,
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", fontWeight: "bold" }}>
            📋 Por Fila
          </p>
          {porFila.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
          ) : (
            porFila.map((f, i) => {
              const max = porFila[0]?.count || 1;
              const pct = (f.count / max) * 100;
              return (
                <div key={f.nome + i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                    <span style={{ color: "white", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.nome}
                    </span>
                    <span style={{ color: "#00a884", fontSize: 13, fontWeight: "bold", flexShrink: 0 }}>{f.count}</span>
                  </div>
                  <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#00a884", transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🆕 POR ATENDENTE — quem tá tratando e quem tratou */}
      {/* Barra stacked (laranja = em atendimento, verde = resolvidos) pra ver produtividade de cada um */}
      <div
        style={{
          background: "#111",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #1f2937",
          minHeight: 140,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>
            👥 Por Atendente
          </p>
          {/* Legenda */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: 10, fontWeight: "bold" }}>
              <span style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2, display: "inline-block" }} />
              Em atendimento
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontSize: 10, fontWeight: "bold" }}>
              <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: 2, display: "inline-block" }} />
              Resolvidos
            </span>
          </div>
        </div>

        {porAtendente.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
        ) : (
          porAtendente.map((a, i) => {
            const maxTotal = porAtendente[0]?.total || 1;
            const pctBarra = (a.total / maxTotal) * 100;
            const pctAtendendo = a.total > 0 ? (a.emAtendimento / a.total) * 100 : 0;
            // barra externa representa proporção do total dessa pessoa vs quem mais atendeu;
            // dentro dela, divisão laranja/verde mostra split entre "em atendimento" vs "resolvidos"
            return (
              <div key={a.chave + i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {/* Avatar com inicial */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: a.cor + "33", color: a.cor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: "bold", fontSize: 12, flexShrink: 0,
                  }}>
                    {a.inicial}
                  </div>
                  <span style={{ color: "white", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.nome}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: 11, flexShrink: 0 }}>
                    <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{a.emAtendimento}</span>
                    <span style={{ opacity: 0.5, margin: "0 4px" }}>·</span>
                    <span style={{ color: "#16a34a", fontWeight: "bold" }}>{a.resolvidos}</span>
                    <span style={{ opacity: 0.5, margin: "0 4px" }}>·</span>
                    <span style={{ color: "white", fontWeight: "bold" }}>{a.total}</span>
                  </span>
                </div>
                {/* Barra stacked */}
                <div style={{
                  height: 8, background: "#1f2937", borderRadius: 4, overflow: "hidden",
                  width: `${pctBarra}%`, // a largura da barra mostra o peso desse atendente vs o top
                  minWidth: 40,
                  transition: "width 0.3s",
                  display: "flex",
                }}>
                  <div style={{ width: `${pctAtendendo}%`, height: "100%", background: "#f59e0b" }} />
                  <div style={{ flex: 1, height: "100%", background: "#16a34a" }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          DESEMPENHO POR CANAL — cards com bordas coloridas (igual print)
          ═══════════════════════════════════════════════════════════════
          WhatsApp (webjs) e API Oficial (waba) só.
          Bordas coloridas no topo: verde pra WhatsApp, roxo pra API Oficial. */}
      <div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 16px" }}>
          Desempenho por Canal
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* WhatsApp Web */}
          <div style={{
            background: "#111",
            borderRadius: 12,
            border: "1px solid #1f2937",
            borderTop: "3px solid #16a34a",
            padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#16a34a22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📱</div>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>WhatsApp</p>
            </div>
            <p style={{ color: "#16a34a", fontSize: 32, fontWeight: "bold", margin: 0 }}>{porTipoCanal.webjs}</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>tickets {labelPeriodo}</p>
          </div>
          {/* API Oficial */}
          <div style={{
            background: "#111",
            borderRadius: 12,
            border: "1px solid #1f2937",
            borderTop: "3px solid #8b5cf6",
            padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#8b5cf622", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔗</div>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>API Oficial</p>
            </div>
            <p style={{ color: "#8b5cf6", fontSize: 32, fontWeight: "bold", margin: 0 }}>{porTipoCanal.waba}</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>tickets {labelPeriodo}</p>
          </div>
        </div>
      </div>

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          ANÁLISES — Pizza (Distribuição de Status) + Barras (Tickets por Status)
          ═══════════════════════════════════════════════════════════════ */}
      <div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 16px" }}>
          📊 Análises
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
          {/* Pizza */}
          <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold" }}>🥧 Distribuição de Status</p>
              <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: "bold" }}>Total: {atendimentosFiltrados.length}</span>
            </div>
            {(() => {
              const aguardando = cards[0].value;
              const emAtend = cards[1].value;
              const resolvidos = cards[2].value;
              const total = aguardando + emAtend + resolvidos;
              if (total === 0) return <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center", padding: "40px 0" }}>Sem dados no período</p>;
              // Calcula ângulos pra desenhar arcos do donut
              const r = 80;
              const cx = 110, cy = 110;
              let anguloAcumulado = -Math.PI / 2; // começa do topo
              const fatias = [
                { valor: aguardando, cor: "#f59e0b", label: "Aguardando" },
                { valor: emAtend, cor: "#3b82f6", label: "Em Atendimento" },
                { valor: resolvidos, cor: "#16a34a", label: "Resolvidos" },
              ].filter(f => f.valor > 0);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
                  <svg viewBox="0 0 220 220" style={{ width: 200, height: 200 }}>
                    {fatias.map((f, i) => {
                      const fracao = f.valor / total;
                      const anguloFim = anguloAcumulado + fracao * 2 * Math.PI;
                      const x1 = cx + r * Math.cos(anguloAcumulado);
                      const y1 = cy + r * Math.sin(anguloAcumulado);
                      const x2 = cx + r * Math.cos(anguloFim);
                      const y2 = cy + r * Math.sin(anguloFim);
                      const largeArc = fracao > 0.5 ? 1 : 0;
                      // Se for fatia única (100%), desenha círculo cheio (path arc não funciona com 100%)
                      const path = fracao >= 0.999
                        ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
                        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      // Texto no centro da fatia (só se for grande o suficiente)
                      const anguloMeio = (anguloAcumulado + anguloFim) / 2;
                      const tx = cx + (r * 0.65) * Math.cos(anguloMeio);
                      const ty = cy + (r * 0.65) * Math.sin(anguloMeio);
                      const path_jsx = (
                        <g key={f.label}>
                          <path d={path} fill={f.cor}>
                            <title>{f.label}: {f.valor} ({(fracao * 100).toFixed(1)}%)</title>
                          </path>
                          {fracao > 0.05 && (
                            <text x={tx} y={ty + 4} fontSize="13" fill="white" textAnchor="middle" fontWeight="bold">
                              {f.valor}
                            </text>
                          )}
                        </g>
                      );
                      anguloAcumulado = anguloFim;
                      return path_jsx;
                    })}
                    {/* Buraco do donut */}
                    <circle cx={cx} cy={cy} r={r * 0.55} fill="#111" />
                    <text x={cx} y={cy - 4} fontSize="11" fill="#9ca3af" textAnchor="middle">Total</text>
                    <text x={cx} y={cy + 14} fontSize="18" fill="white" textAnchor="middle" fontWeight="bold">{total}</text>
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {fatias.map(f => (
                      <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, background: f.cor, borderRadius: 2 }} />
                        <span style={{ color: "#e5e7eb", fontSize: 12 }}>{f.label}: <b style={{ color: f.cor }}>{f.valor}</b></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Barras agrupadas por Status */}
          <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold" }}>📊 Tickets por Status</p>
              <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: "bold" }}>Total: {atendimentosFiltrados.length}</span>
            </div>
            {(() => {
              const dados = [
                { label: "Aguardando", valor: cards[0].value, cor: "#f59e0b" },
                { label: "Em Atendimento", valor: cards[1].value, cor: "#3b82f6" },
                { label: "Resolvidos", valor: cards[2].value, cor: "#16a34a" },
              ];
              const max = Math.max(...dados.map(d => d.valor), 1);
              const w = 400, h = 220;
              const padL = 36, padR = 12, padT = 16, padB = 36;
              const innerW = w - padL - padR;
              const innerH = h - padT - padB;
              const slotW = innerW / dados.length;
              const barW = slotW * 0.55;
              return (
                <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
                  {[0.25, 0.5, 0.75, 1].map((p, i) => (
                    <g key={i}>
                      <line x1={padL} y1={padT + innerH - innerH * p} x2={w - padR} y2={padT + innerH - innerH * p} stroke="#1f2937" strokeDasharray="3 3" />
                      <text x={padL - 5} y={padT + innerH - innerH * p + 4} fontSize="9" fill="#6b7280" textAnchor="end">{Math.round(max * p)}</text>
                    </g>
                  ))}
                  {dados.map((d, i) => {
                    const x = padL + slotW * i + (slotW - barW) / 2;
                    const altura = (d.valor / max) * innerH;
                    const y = padT + innerH - altura;
                    return (
                      <g key={d.label}>
                        <rect x={x} y={y} width={barW} height={altura} fill={d.cor} rx="3">
                          <title>{d.label}: {d.valor}</title>
                        </rect>
                        {altura > 18 && (
                          <text x={x + barW / 2} y={y + altura / 2 + 4} fontSize="13" fill="white" textAnchor="middle" fontWeight="bold">{d.valor}</text>
                        )}
                        <text x={x + barW / 2} y={h - padB + 16} fontSize="10" fill="#9ca3af" textAnchor="middle">{d.label}</text>
                      </g>
                    );
                  })}
                  <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#374151" />
                </svg>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          EVOLUÇÃO DOS TICKETS — gráfico de linha suave (Aguardando → Em → Finalizado)
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold" }}>📈 Evolução dos Tickets</p>
          <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: "bold" }}>Total: {atendimentosFiltrados.length}</span>
        </div>
        {(() => {
          const pontos = [
            { x: "Aguardando", valor: cards[0].value },
            { x: "Em Atendimento", valor: cards[1].value },
            { x: "Finalizado", valor: cards[2].value },
          ];
          const max = Math.max(...pontos.map(p => p.valor), 1);
          const w = 1000, h = 240;
          const padL = 40, padR = 24, padT = 20, padB = 36;
          const innerW = w - padL - padR;
          const innerH = h - padT - padB;
          const stepX = innerW / (pontos.length - 1);
          const coords = pontos.map((p, i) => ({
            x: padL + stepX * i,
            y: padT + innerH - (p.valor / max) * innerH,
            valor: p.valor,
            label: p.x,
          }));
          // Curva suave Bezier
          let path = `M ${coords[0].x} ${coords[0].y}`;
          for (let i = 0; i < coords.length - 1; i++) {
            const cur = coords[i];
            const next = coords[i + 1];
            const cpX1 = cur.x + (next.x - cur.x) / 2;
            const cpY1 = cur.y;
            const cpX2 = cur.x + (next.x - cur.x) / 2;
            const cpY2 = next.y;
            path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
          }
          // Path da área (mesma curva + fechamento embaixo)
          const pathArea = path + ` L ${coords[coords.length - 1].x} ${padT + innerH} L ${coords[0].x} ${padT + innerH} Z`;
          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
              <defs>
                <linearGradient id="gradEvolucao" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((p, i) => (
                <g key={i}>
                  <line x1={padL} y1={padT + innerH - innerH * p} x2={w - padR} y2={padT + innerH - innerH * p} stroke="#1f2937" strokeDasharray="3 3" />
                  <text x={padL - 5} y={padT + innerH - innerH * p + 4} fontSize="10" fill="#6b7280" textAnchor="end">{Math.round(max * p)}</text>
                </g>
              ))}
              <path d={pathArea} fill="url(#gradEvolucao)" />
              <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
              {coords.map((c, i) => (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r="6" fill="#3b82f6">
                    <title>{c.label}: {c.valor}</title>
                  </circle>
                  <circle cx={c.x} cy={c.y} r="3" fill="white" />
                  <text x={c.x} y={h - padB + 18} fontSize="11" fill="#9ca3af" textAnchor="middle">{c.label}</text>
                </g>
              ))}
              <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#374151" />
            </svg>
          );
        })()}
      </div>

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          STATUS DOS ATENDENTES + EVOLUÇÃO POR HORA (lado a lado)
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        {/* Status dos Atendentes */}
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
          <p style={{ color: "white", fontSize: 13, margin: "0 0 14px", fontWeight: "bold" }}>🟢 Status dos Atendentes</p>
          {statusAtendentes.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhum atendente cadastrado</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {statusAtendentes.map(a => (
                <div key={a.email} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 12px", background: "#0d0d0d", borderRadius: 8,
                  border: `1px solid ${a.online ? "#16a34a33" : "#1f2937"}`,
                }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "#16a34a22",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#16a34a", fontWeight: "bold", fontSize: 13,
                    }}>{a.nome.charAt(0).toUpperCase()}</div>
                    <span style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 10, height: 10, borderRadius: "50%",
                      background: a.online ? "#16a34a" : "#6b7280",
                      border: "2px solid #0d0d0d",
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</p>
                    <p style={{ color: a.online ? "#16a34a" : "#6b7280", fontSize: 10, margin: 0 }}>{a.online ? "🟢 Ativo agora" : "⚫ Inativo"}</p>
                  </div>
                  {a.atendendoAgora > 0 && (
                    <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {a.atendendoAgora} ativo{a.atendendoAgora > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p style={{ color: "#6b7280", fontSize: 10, margin: "10px 0 0", lineHeight: 1.4 }}>
            💡 "Ativo" = atendente que tratou pelo menos 1 chat nas últimas 4h
          </p>
        </div>

        {/* Evolução de Tickets por Hora */}
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
          <p style={{ color: "white", fontSize: 13, margin: "0 0 14px", fontWeight: "bold" }}>📈 Evolução de Tickets por Hora</p>
          {(() => {
            const total = evolucaoPorHora.reduce((s, b) => s + b.count, 0);
            const max = Math.max(...evolucaoPorHora.map(b => b.count), 1);
            const w = 600, h = 240;
            const padL = 30, padR = 12, padT = 30, padB = 30;
            const innerW = w - padL - padR;
            const innerH = h - padT - padB;
            const stepX = innerW / 23;
            const coords = evolucaoPorHora.map((b, i) => ({
              x: padL + stepX * i,
              y: padT + innerH - (b.count / max) * innerH,
              count: b.count,
              hora: b.hora,
            }));
            return (
              <>
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textAlign: "center" }}>
                  📈 Atendimentos hoje: ({total})
                </p>
                <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
                  <defs>
                    <linearGradient id="gradHora" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.5, 1].map((p, i) => (
                    <line key={i} x1={padL} y1={padT + innerH - innerH * p} x2={w - padR} y2={padT + innerH - innerH * p} stroke="#1f2937" strokeDasharray="3 3" />
                  ))}
                  {/* Linha conectando os pontos */}
                  {(() => {
                    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
                    const pathArea = path + ` L ${coords[coords.length - 1].x} ${padT + innerH} L ${coords[0].x} ${padT + innerH} Z`;
                    return (
                      <>
                        <path d={pathArea} fill="url(#gradHora)" />
                        <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="2" />
                      </>
                    );
                  })()}
                  {/* Pontos com valor (só de 3 em 3 pra não amontoar) */}
                  {coords.map((c, i) => (
                    <g key={i}>
                      <circle cx={c.x} cy={c.y} r="3" fill="#8b5cf6">
                        <title>{c.hora}: {c.count} atendimentos</title>
                      </circle>
                      {i % 3 === 0 && (
                        <text x={c.x} y={h - padB + 14} fontSize="9" fill="#9ca3af" textAnchor="middle">{c.hora}</text>
                      )}
                    </g>
                  ))}
                  <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#374151" />
                </svg>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}