"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../hooks/useWorkspace";

type Conexao = { id: number; nome: string; provider: string; status: string };
type CanalWhatsApp = { id: number; nome: string; tipo: string; status: string };
type FilaUra = { id: string; nome: string };
type UsuarioUra = { email: string; nome: string; perfil?: string };
type IntencaoUra = { nome: string; exemplos?: string[]; proximo: string };
type NoUra = {
  id: string;
  tipo:
    | "fala"
    | "menu"
    | "audio"
    | "transferir"
    | "transferir_atendente"
    | "whatsapp"
    | "ia_voz"
    | "pausa"
    | "encerrar";
  texto?: string;
  url?: string;
  numero?: string;
  proximo?: string;
  opcoes?: Record<string, string>;
  rotulos?: Record<string, string>;
  resultado?: string;
  mensagem?: string;
  confirmacaoVoz?: string;
  atendenteEmail?: string;
  semResposta?: string;
  emErro?: string;
  intencaoPadrao?: string;
  intencoes?: IntencaoUra[];
};
type Fluxo = {
  id: string;
  nome: string;
  descricao?: string;
  configuracao: { inicio: string; nos: NoUra[] };
};
type Campanha = {
  id: string;
  nome: string;
  status: string;
  conexao_id: number;
  fluxo_id: string;
  total_contatos: number;
  total_processados: number;
  total_atendidos: number;
  total_falhas: number;
  conexoes_voip?: { nome: string; provider: string };
  voip_ura_fluxos?: { nome: string };
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 2px 8px rgba(15,23,42,.04)",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
};
const btn = (cor = "#16a34a"): React.CSSProperties => ({
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  background: cor,
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
});

export default function UraDiscadorSection() {
  const { wsId, user } = useWorkspace();
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [canais, setCanais] = useState<CanalWhatsApp[]>([]);
  const [filas, setFilas] = useState<FilaUra[]>([]);
  const [usuariosUra, setUsuariosUra] = useState<UsuarioUra[]>([]);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [aba, setAba] = useState<"campanhas" | "fluxos">("campanhas");
  const [nomeFluxo, setNomeFluxo] = useState("URA de atendimento");
  const [descricao, setDescricao] = useState("");
  const [nos, setNos] = useState<NoUra[]>([
    {
      id: "inicio",
      tipo: "fala",
      texto:
        "Olá {{nome}}. Você está falando com a assistente virtual da nossa equipe.",
      proximo: "menu",
    },
    {
      id: "menu",
      tipo: "menu",
      texto:
        "Digite 1 para receber atendimento pelo WhatsApp, 2 para continuar comigo, 3 para falar com um atendente ou 9 para não receber novas ligações.",
      opcoes: {
        "1": "whatsapp",
        "2": "ia",
        "3": "atendente",
        "9": "optout",
      },
      rotulos: {
        "1": "WhatsApp",
        "2": "IA por voz",
        "3": "Atendente",
        "9": "Opt-out",
      },
      proximo: "ia",
    },
    {
      id: "whatsapp",
      tipo: "whatsapp",
      mensagem:
        "Olá, {{nome}}! Conforme sua escolha na ligação, abrimos seu atendimento por aqui. Como podemos ajudar?",
      confirmacaoVoz:
        "Pronto. Enviei uma mensagem no seu WhatsApp e nossa equipe continuará por lá.",
      proximo: "fim_whatsapp",
      emErro: "menu",
    },
    {
      id: "ia",
      tipo: "ia_voz",
      texto: "Pode me contar, em poucas palavras, como podemos ajudar?",
      intencaoPadrao: "continuar_ia",
      semResposta: "menu",
      emErro: "menu",
      intencoes: [
        {
          nome: "whatsapp",
          exemplos: ["whatsapp", "mensagem"],
          proximo: "whatsapp",
        },
        {
          nome: "atendente",
          exemplos: ["atendente", "pessoa", "humano"],
          proximo: "atendente",
        },
        {
          nome: "encerrar",
          exemplos: ["encerrar", "tchau", "não quero"],
          proximo: "fim",
        },
      ],
    },
    {
      id: "continuar_ia",
      tipo: "ia_voz",
      texto:
        "Entendi. Posso enviar seu atendimento ao WhatsApp, chamar um atendente ou continuar por aqui. O que prefere?",
      intencaoPadrao: "continuar_ia",
      semResposta: "menu",
      emErro: "menu",
      intencoes: [
        {
          nome: "whatsapp",
          exemplos: ["whatsapp", "mensagem"],
          proximo: "whatsapp",
        },
        {
          nome: "atendente",
          exemplos: ["atendente", "pessoa", "humano"],
          proximo: "atendente",
        },
        { nome: "encerrar", exemplos: ["encerrar", "tchau"], proximo: "fim" },
      ],
    },
    {
      id: "atendente",
      tipo: "transferir_atendente",
      texto: "Aguarde enquanto localizo um atendente autorizado.",
      emErro: "whatsapp",
    },
    {
      id: "optout",
      tipo: "encerrar",
      texto: "Seu pedido foi registrado. Obrigado.",
      resultado: "Opt-out",
    },
    {
      id: "fim_whatsapp",
      tipo: "encerrar",
      texto: "Obrigado. Continue pelo WhatsApp.",
      resultado: "WhatsApp iniciado",
    },
    {
      id: "fim",
      tipo: "encerrar",
      texto: "Obrigado pelo contato.",
      resultado: "Encerrado",
    },
  ]);
  const [campNome, setCampNome] = useState("");
  const [conexaoId, setConexaoId] = useState("");
  const [fluxoId, setFluxoId] = useState("");
  const [canalWhatsappId, setCanalWhatsappId] = useState("");
  const [filaDestinoId, setFilaDestinoId] = useState("");
  const [modoAtribuicao, setModoAtribuicao] = useState<
    "fila" | "roleta" | "atendente"
  >("fila");
  const [atendenteEmail, setAtendenteEmail] = useState("");
  const [atendentesPermitidos, setAtendentesPermitidos] = useState<string[]>(
    [],
  );
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [agendada, setAgendada] = useState("");
  const [simultaneas, setSimultaneas] = useState(1);
  const [intervalo, setIntervalo] = useState(5);
  const [loading, setLoading] = useState(false);
  const wa = useCallback(
    async (rota: string, body?: unknown) => {
      const resp = await fetch(
        `/api/whatsapp?rota=${rota}${!body && wsId ? `&workspaceId=${encodeURIComponent(wsId)}` : ""}`,
        body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : undefined,
      );
      const json = await resp.json().catch(() => ({
        success: false,
        error: "Resposta inválida do servidor",
      }));
      if (!resp.ok || !json.success)
        throw new Error(json.error || `HTTP ${resp.status}`);
      return json;
    },
    [wsId],
  );
  const carregar = useCallback(async () => {
    if (!wsId) return;
    try {
      const [f, c, x, o] = await Promise.all([
        wa("voip/ura/fluxos"),
        wa("voip/ura/campanhas"),
        wa("voip/conexoes/listar"),
        wa("voip/ura/opcoes"),
      ]);
      setFluxos(f.fluxos || []);
      setCampanhas(c.campanhas || []);
      setConexoes(x.conexoes || []);
      setCanais(o.canais || []);
      setFilas(o.filas || []);
      setUsuariosUra(o.usuarios || []);
    } catch (e: any) {
      setErro(e.message);
    }
  }, [wsId, wa]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    if (!wsId) return;
    let ativo = true;
    const filtros =
      "&conexaoId=" +
      encodeURIComponent(conexaoId || "0") +
      "&canalId=" +
      encodeURIComponent(canalWhatsappId || "0") +
      "&filaId=" +
      encodeURIComponent(filaDestinoId || "0");
    wa("voip/ura/opcoes" + filtros)
      .then((dados) => {
        if (!ativo) return;
        const permitidos = dados.usuarios || [];
        setUsuariosUra(permitidos);
        const emails = new Set(
          permitidos.map((u: UsuarioUra) => u.email.toLowerCase()),
        );
        setAtendentesPermitidos((atuais) =>
          atuais.filter((email) => emails.has(email.toLowerCase())),
        );
        setAtendenteEmail((atual) =>
          atual && !emails.has(atual.toLowerCase()) ? "" : atual,
        );
      })
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [wsId, conexaoId, canalWhatsappId, filaDestinoId, wa]);
  const twilio = useMemo(
    () => conexoes.filter((c) => c.provider === "twilio"),
    [conexoes],
  );
  const salvarFluxo = async () => {
    setLoading(true);
    setErro("");
    try {
      await wa("voip/ura/fluxo/salvar", {
        workspaceId: wsId,
        nome: nomeFluxo,
        descricao,
        configuracao: { inicio: nos[0]?.id, nos },
        criadoPor: user?.email,
      });
      setOk("Fluxo salvo.");
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };
  const atualizarNo = (i: number, patch: Partial<NoUra>) =>
    setNos((v) => v.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const lerArquivo = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets[wb.SheetNames[0]],
      { defval: "" },
    );
    return rows
      .map((r) => {
        const entries = Object.entries(r);
        const achar = (nomes: string[]) =>
          entries.find(([k]) => nomes.includes(k.toLowerCase().trim()))?.[1];
        return {
          nome: String(achar(["nome", "cliente"]) || ""),
          telefone: String(
            achar(["telefone", "numero", "número", "celular", "whatsapp"]) ||
              "",
          ),
          variaveis: Object.fromEntries(entries),
        };
      })
      .filter((x) => x.telefone);
  };
  const criarCampanha = async () => {
    if (!arquivo) return setErro("Selecione uma planilha CSV ou XLSX.");
    setLoading(true);
    setErro("");
    try {
      const contatos = await lerArquivo(arquivo);
      const criado = await wa("voip/ura/campanha/criar", {
        workspaceId: wsId,
        conexaoId: Number(conexaoId),
        fluxoId,
        nome: campNome,
        agendadaPara: agendada || null,
        simultaneas,
        intervaloSegundos: intervalo,
        criadoPor: user?.email,
        canalWhatsappId: canalWhatsappId ? Number(canalWhatsappId) : null,
        filaDestinoId: filaDestinoId || null,
        modoAtribuicao,
        atendenteEmail: modoAtribuicao === "atendente" ? atendenteEmail : null,
        atendentesPermitidos,
      });
      const imp = await wa("voip/ura/campanha/importar", {
        workspaceId: wsId,
        campanhaId: criado.campanha.id,
        contatos,
      });
      setOk(
        `Campanha criada: ${imp.importados} contatos válidos, ${imp.invalidos} inválidos.`,
      );
      setCampNome("");
      setArquivo(null);
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };
  const acao = async (id: string, tipo: string) => {
    if (
      tipo === "iniciar" &&
      !confirm(
        "Esta ação iniciará ligações reais e poderá gerar cobrança no provedor. Continuar?",
      )
    )
      return;
    setLoading(true);
    setErro("");
    try {
      await wa("voip/ura/campanha/acao", {
        workspaceId: wsId,
        campanhaId: id,
        acao: tipo,
      });
      setOk(`Ação ${tipo} aplicada.`);
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <main
      style={{
        padding: 32,
        fontFamily: "Arial,sans-serif",
        maxWidth: 1500,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 25 }}>URA e discador automático</h1>
          <p style={{ color: "#64748b" }}>
            Campanhas multi-tenant, planilhas, DTMF, transferência e resultados
            por conexão.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={btn(aba === "campanhas" ? "#16a34a" : "#64748b")}
            onClick={() => setAba("campanhas")}
          >
            Campanhas
          </button>
          <button
            style={btn(aba === "fluxos" ? "#16a34a" : "#64748b")}
            onClick={() => setAba("fluxos")}
          >
            Editor de URA
          </button>
        </div>
      </div>
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          padding: 12,
          borderRadius: 10,
          color: "#92400e",
          marginBottom: 16,
        }}
      >
        🔐 A discagem só funciona após ativar <b>VOIP_URA_ENABLED=true</b> no
        servidor. Atualmente a origem automática está pronta para Twilio. PABX
        manual exige API, AMI ou ARI do fornecedor.
      </div>
      {erro && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          ❌ {erro}
        </div>
      )}
      {ok && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#047857",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          ✅ {ok}
        </div>
      )}
      {aba === "fluxos" ? (
        <section style={card}>
          <h2>Editor do fluxo</h2>
          <div
            style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}
          >
            <input
              style={input}
              value={nomeFluxo}
              onChange={(e) => setNomeFluxo(e.target.value)}
              placeholder="Nome do fluxo"
            />
            <input
              style={input}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição"
            />
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {nos.map((n, i) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "150px 150px 1fr 160px 44px",
                  gap: 8,
                }}
              >
                <select
                  style={input}
                  value={n.tipo}
                  onChange={(e) =>
                    atualizarNo(i, { tipo: e.target.value as NoUra["tipo"] })
                  }
                >
                  <option value="fala">Falar</option>
                  <option value="menu">Menu DTMF</option>
                  <option value="audio">Áudio URL</option>
                  <option value="transferir">Transferir</option>
                  <option value="transferir_atendente">
                    Atendente autorizado
                  </option>
                  <option value="whatsapp">Abrir WhatsApp</option>
                  <option value="ia_voz">IA por voz</option>
                  <option value="pausa">Pausa</option>
                  <option value="encerrar">Encerrar</option>
                </select>
                <input
                  style={input}
                  value={n.id}
                  onChange={(e) => atualizarNo(i, { id: e.target.value })}
                  placeholder="ID da etapa"
                />
                <input
                  style={input}
                  value={
                    n.tipo === "audio"
                      ? n.url || ""
                      : n.tipo === "transferir"
                        ? n.numero || ""
                        : n.tipo === "whatsapp"
                          ? n.mensagem || ""
                          : n.texto || ""
                  }
                  onChange={(e) =>
                    atualizarNo(
                      i,
                      n.tipo === "audio"
                        ? { url: e.target.value }
                        : n.tipo === "transferir"
                          ? { numero: e.target.value }
                          : n.tipo === "whatsapp"
                            ? { mensagem: e.target.value }
                            : { texto: e.target.value },
                    )
                  }
                  placeholder={
                    n.tipo === "audio"
                      ? "URL HTTPS do áudio"
                      : n.tipo === "transferir"
                        ? "Número de transferência"
                        : n.tipo === "whatsapp"
                          ? "Mensagem enviada pelo WhatsApp"
                          : "Texto falado"
                  }
                />
                <input
                  style={input}
                  value={n.proximo || ""}
                  onChange={(e) => atualizarNo(i, { proximo: e.target.value })}
                  placeholder="Próximo ID"
                />
                <button
                  style={btn("#ef4444")}
                  onClick={() => setNos((v) => v.filter((_, j) => j !== i))}
                >
                  ×
                </button>
                {n.tipo === "menu" && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <textarea
                      style={input}
                      rows={3}
                      value={JSON.stringify(n.opcoes || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          atualizarNo(i, {
                            opcoes: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder='Opções: {"1":"whatsapp","2":"ia"}'
                    />
                    <textarea
                      style={input}
                      rows={3}
                      value={JSON.stringify(n.rotulos || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          atualizarNo(i, {
                            rotulos: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder='Rótulos: {"1":"WhatsApp"}'
                    />
                  </div>
                )}
                {n.tipo === "whatsapp" && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <input
                      style={input}
                      value={n.confirmacaoVoz || ""}
                      onChange={(e) =>
                        atualizarNo(i, { confirmacaoVoz: e.target.value })
                      }
                      placeholder="Confirmação falada após o envio"
                    />
                    <input
                      style={input}
                      value={n.emErro || ""}
                      onChange={(e) =>
                        atualizarNo(i, { emErro: e.target.value })
                      }
                      placeholder="ID em caso de erro"
                    />
                  </div>
                )}
                {n.tipo === "ia_voz" && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 2fr",
                      gap: 8,
                    }}
                  >
                    <input
                      style={input}
                      value={n.intencaoPadrao || ""}
                      onChange={(e) =>
                        atualizarNo(i, { intencaoPadrao: e.target.value })
                      }
                      placeholder="ID padrão"
                    />
                    <input
                      style={input}
                      value={n.semResposta || ""}
                      onChange={(e) =>
                        atualizarNo(i, { semResposta: e.target.value })
                      }
                      placeholder="ID sem resposta"
                    />
                    <textarea
                      style={input}
                      rows={4}
                      value={JSON.stringify(n.intencoes || [], null, 2)}
                      onChange={(e) => {
                        try {
                          atualizarNo(i, {
                            intencoes: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder="Intenções da IA em JSON"
                    />
                  </div>
                )}
                {n.tipo === "transferir_atendente" && (
                  <select
                    style={{ ...input, gridColumn: "1 / -1" }}
                    value={n.atendenteEmail || ""}
                    onChange={(e) =>
                      atualizarNo(i, { atendenteEmail: e.target.value })
                    }
                  >
                    <option value="">Distribuir conforme a campanha</option>
                    {usuariosUra.map((u) => (
                      <option key={u.email} value={u.email}>
                        {u.nome} · {u.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              style={btn("#475569")}
              onClick={() =>
                setNos((v) => [
                  ...v,
                  {
                    id: `passo_${v.length + 1}`,
                    tipo: "fala",
                    texto: "",
                    proximo: "",
                  },
                ])
              }
            >
              + Etapa
            </button>
            <button style={btn()} disabled={loading} onClick={salvarFluxo}>
              Salvar fluxo
            </button>
          </div>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px,420px) 1fr",
            gap: 18,
          }}
        >
          <section style={card}>
            <h2>Nova campanha</h2>
            <label>Nome</label>
            <input
              style={input}
              value={campNome}
              onChange={(e) => setCampNome(e.target.value)}
              placeholder="Ex.: Pesquisa de satisfação"
            />
            <label style={{ display: "block", marginTop: 10 }}>
              Conexão de saída
            </label>
            <select
              style={input}
              value={conexaoId}
              onChange={(e) => setConexaoId(e.target.value)}
            >
              <option value="">Selecione</option>
              {twilio.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · Twilio
                </option>
              ))}
            </select>
            <label style={{ display: "block", marginTop: 10 }}>Fluxo</label>
            <select
              style={input}
              value={fluxoId}
              onChange={(e) => setFluxoId(e.target.value)}
            >
              <option value="">Selecione</option>
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <label style={{ display: "block", marginTop: 10 }}>
              Canal WhatsApp da URA
            </label>
            <select
              style={input}
              value={canalWhatsappId}
              onChange={(e) => setCanalWhatsappId(e.target.value)}
            >
              <option value="">Sem abertura automática no WhatsApp</option>
              {canais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.tipo} · {c.status}
                </option>
              ))}
            </select>
            <label style={{ display: "block", marginTop: 10 }}>
              Fila de destino
            </label>
            <select
              style={input}
              value={filaDestinoId}
              onChange={(e) => setFilaDestinoId(e.target.value)}
            >
              <option value="">Sem fila específica</option>
              {filas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <label style={{ display: "block", marginTop: 10 }}>
              Distribuição do atendimento
            </label>
            <select
              style={input}
              value={modoAtribuicao}
              onChange={(e) =>
                setModoAtribuicao(
                  e.target.value as "fila" | "roleta" | "atendente",
                )
              }
            >
              <option value="fila">Fila — alguém autorizado assume</option>
              <option value="roleta">Roleta entre autorizados</option>
              <option value="atendente">Atendente fixo</option>
            </select>
            {modoAtribuicao === "atendente" && (
              <>
                <label style={{ display: "block", marginTop: 10 }}>
                  Atendente fixo
                </label>
                <select
                  style={input}
                  value={atendenteEmail}
                  onChange={(e) => setAtendenteEmail(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {usuariosUra.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.nome} · {u.email}
                    </option>
                  ))}
                </select>
              </>
            )}
            <fieldset
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                marginTop: 10,
                padding: 10,
              }}
            >
              <legend style={{ fontWeight: 700 }}>
                Atendentes autorizados nesta URA
              </legend>
              {usuariosUra.length === 0 ? (
                <small>
                  Nenhum usuário possui simultaneamente acesso à URA, VOIP,
                  chat, conexão, canal e fila selecionados.
                </small>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {usuariosUra.map((u) => (
                    <label
                      key={u.email}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={atendentesPermitidos.includes(u.email)}
                        onChange={(e) =>
                          setAtendentesPermitidos((atuais) =>
                            e.target.checked
                              ? Array.from(new Set([...atuais, u.email]))
                              : atuais.filter((email) => email !== u.email),
                          )
                        }
                      />
                      {u.nome} · {u.email}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label style={{ display: "block", marginTop: 10 }}>Planilha</label>
            <input
              style={input}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
            <small>
              Colunas: nome e telefone/celular/WhatsApp. As demais viram
              variáveis do fluxo.
            </small>
            <label style={{ display: "block", marginTop: 10 }}>
              Agendar (opcional)
            </label>
            <input
              style={input}
              type="datetime-local"
              value={agendada}
              onChange={(e) => setAgendada(e.target.value)}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 10,
              }}
            >
              <div>
                <label>Simultâneas</label>
                <input
                  style={input}
                  type="number"
                  min={1}
                  max={20}
                  value={simultaneas}
                  onChange={(e) => setSimultaneas(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Intervalo (s)</label>
                <input
                  style={input}
                  type="number"
                  min={1}
                  value={intervalo}
                  onChange={(e) => setIntervalo(Number(e.target.value))}
                />
              </div>
            </div>
            <button
              style={{ ...btn(), width: "100%", marginTop: 14 }}
              disabled={
                loading ||
                !campNome ||
                !conexaoId ||
                !fluxoId ||
                (modoAtribuicao === "atendente" && !atendenteEmail)
              }
              onClick={criarCampanha}
            >
              Criar e importar
            </button>
          </section>
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>Campanhas</h2>
              <button style={btn("#475569")} onClick={carregar}>
                Atualizar
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "Campanha",
                      "Canal / fluxo",
                      "Status",
                      "Progresso",
                      "Atendidos",
                      "Falhas",
                      "Ações",
                    ].map((x) => (
                      <th
                        key={x}
                        style={{
                          textAlign: "left",
                          padding: 10,
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campanhas.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: 10 }}>
                        <b>{c.nome}</b>
                      </td>
                      <td>
                        {c.conexoes_voip?.nome || c.conexao_id}
                        <br />
                        <small>{c.voip_ura_fluxos?.nome}</small>
                      </td>
                      <td>
                        <b>{c.status}</b>
                      </td>
                      <td>
                        {c.total_processados}/{c.total_contatos}
                      </td>
                      <td style={{ color: "#059669" }}>{c.total_atendidos}</td>
                      <td style={{ color: "#dc2626" }}>{c.total_falhas}</td>
                      <td style={{ display: "flex", gap: 5, padding: 8 }}>
                        {!["executando", "concluida", "cancelada"].includes(
                          c.status,
                        ) && (
                          <button
                            style={btn()}
                            onClick={() => acao(c.id, "iniciar")}
                          >
                            Iniciar
                          </button>
                        )}
                        {c.status === "executando" && (
                          <button
                            style={btn("#d97706")}
                            onClick={() => acao(c.id, "pausar")}
                          >
                            Pausar
                          </button>
                        )}
                        {!["concluida", "cancelada"].includes(c.status) && (
                          <button
                            style={btn("#dc2626")}
                            onClick={() => acao(c.id, "cancelar")}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!campanhas.length && (
                <p style={{ color: "#64748b" }}>Nenhuma campanha criada.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
