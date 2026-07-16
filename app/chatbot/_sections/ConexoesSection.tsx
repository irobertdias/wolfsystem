"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useToast } from "../../hooks/useToast";
import { traduzirErro } from "../../lib/traduzir_erro";
import { montarCamposUnificados, type CampoUnificado, type ConfigCampoPadrao, type CampoCustom } from "../../lib/campos_proposta_definicao";

// 🆕 Tipagem do Facebook SDK (carregado dinamicamente)
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}
// import { usePermissao } from "../../hooks/usePermissao";  // desativado — não usa mais isDono aqui

// 🔒 Super admin do sistema Wolf — único que tem bypass de limites de plano
// Dono de workspace NÃO É super admin: respeita o plano que ele paga.
const ADMIN_EMAIL = "robert.dias@live.com";

// 🆕 Backend wolf-meta + Facebook Login pra Empresas
const META_BASE = process.env.NEXT_PUBLIC_META_URL || "https://meta.api.wolfgyn.com.br";
const FB_APP_ID = "1658330965492693";
const FB_CONFIG_ID = "852551211216508";

type Conexao = {
  id: number; nome: string; tipo: string; status: string; numero: string;
  modo: string; ia: string; fluxo_id: string | number | null; fluxo_nome: string;
  fila: string; api_key: string; prompt: string; parar_se_atendente: boolean;
  phone_number_id?: string; waba_id?: string; token_waba?: string; webhook_token?: string;
  workspace_id: string;
  // 🆕 Typebot
  typebot_url?: string; typebot_msg_invalida?: string; typebot_msg_boas_vindas?: string;
  // 🆕 Meta flags
  messenger_ativo?: boolean;
  instagram_ativo?: boolean;
  instagram_business_id?: string;
  instagram_username?: string;
  ia_crm_ativo?: boolean;
  ia_crm_mapeamento?: Record<string, string>;
  ia_crm_campos_obrigatorios?: string[];
  ia_agrupamento_ms?: number;
  // 📂 Módulos onde este canal aparece (array de strings tipo ["chatbot","cobranca"])
  modulos?: string[];
};
type FluxoItem = { id: number; nome: string; ativo: boolean; };
type FilaItem = { id: number; nome: string; conexao?: string; equipe_id?: string | null; };
// 👥 Equipe (time/empresa dentro do workspace) — usada pra filtrar quais filas aparecem
type Equipe = { id: string; nome: string; ativo?: boolean; };
type LimitesPlano = { conexoes: number; webjs: boolean; waba: boolean; instagram: boolean; };
type IntegridadeWaba = {
  carregando: boolean;
  conectado: boolean;
  qualidade: "Alta" | "Média" | "Baixa" | "Desconhecida";
  limite24h: number;
  tier: string;
  enviados24h: number | null;
  falhas24h: number | null;
  score: number;
  erro: string | null;
  atualizadoEm: string | null;
  nome: string;
  fonteLimite: string;
};
type JobRecuperacao = {
  id: string;
  canalId: number;
  status: "aguardando" | "processando" | "concluido" | "erro";
  etapa: string;
  inicio: string;
  fim: string;
  totalConversas: number;
  conversasProcessadas: number;
  mensagensAnalisadas: number;
  importadas: number;
  recebidas: number;
  enviadas: number;
  duplicadas: number;
  ignoradas: number;
  falhas: number;
  percentual: number;
  limitado?: boolean;
  erro?: string | null;
  avisos?: string[];
};

export function ConexoesSection() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { notify } = useToast();

  // 🔒 Só o super admin do Wolf tem bypass de limites — dono de workspace respeita plano
  const isSuperAdmin = (user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [fluxos, setFluxos] = useState<FluxoItem[]>([]);
  const [filasBanco, setFilasBanco] = useState<FilaItem[]>([]);
  // 👥 Equipes do workspace — alimenta o seletor que filtra as filas no modal de canal
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [showModalQR, setShowModalQR] = useState(false);
  const [showMenuEngrenagem, setShowMenuEngrenagem] = useState<number | null>(null);
  const [qrCanalId, setQrCanalId] = useState<number | null>(null);
  const [resetando, setResetando] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrPolling, setQrPolling] = useState(false);
  const [qrConectado, setQrConectado] = useState(false);
  const [qrNumero, setQrNumero] = useState("");
  const [qrTentativas, setQrTentativas] = useState(0);
  const [showModalNovoCanal, setShowModalNovoCanal] = useState(false);
  const [conectandoMeta, setConectandoMeta] = useState(false);
  const [resultadoMeta, setResultadoMeta] = useState<{ sucesso?: boolean; mensagem?: string; pages?: any[] } | null>(null);
  const [pagesDisponiveis, setPagesDisponiveis] = useState<any[]>([]);
  const [pagesSelecionadas, setPagesSelecionadas] = useState<Set<string>>(new Set());
  const [showSelecaoPages, setShowSelecaoPages] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [testandoWABA, setTestandoWABA] = useState(false);
  const [wabaTeste, setWabaTeste] = useState<any | null>(null);
  const [integridadesWaba, setIntegridadesWaba] = useState<Record<number, IntegridadeWaba>>({});
  const [canalRecuperacao, setCanalRecuperacao] = useState<Conexao | null>(null);
  const [periodoRecuperacao, setPeriodoRecuperacao] = useState("24");
  const [inicioRecuperacao, setInicioRecuperacao] = useState("");
  const [fimRecuperacao, setFimRecuperacao] = useState("");
  const [jobRecuperacao, setJobRecuperacao] = useState<JobRecuperacao | null>(null);
  const [iniciandoRecuperacao, setIniciandoRecuperacao] = useState(false);
  const jobsRecuperacaoNotificados = useRef<Set<string>>(new Set());

  const [encerrandoMassa, setEncerrandoMassa] = useState(false);
  const [registrandoWaba, setRegistrandoWaba] = useState(false);

  const [limites, setLimites] = useState<LimitesPlano>({ conexoes: 1, webjs: true, waba: false, instagram: false });
  const [camposCrm, setCamposCrm] = useState<CampoUnificado[]>(montarCamposUnificados([], []));

  // 👥 equipeId no form = filtro de equipe (não é salvo na conexão — a fila escolhida já carrega o equipe_id)
  const formInicial = { nome: "", tipo: "webjs", phoneNumberId: "", wabaId: "", token: "", webhookToken: "", modo: "nenhum", ia: "gpt", apiKey: "", prompt: "", fluxoId: "", equipeId: "", fila: "", pararSeAtendente: true, typebot_url: "", typebot_msg_invalida: "", typebot_msg_boas_vindas: "", modulos: ["chatbot"] as string[], iaCrmAtivo: false, iaCrmMapeamento: {} as Record<string, string>, iaCrmCamposObrigatorios: [] as string[], iaAgrupamentoMs: 3500 };
  const [form, setForm] = useState(formInicial);

  const [apiKeyTocada, setApiKeyTocada] = useState(false);
  const [tokenTocado, setTokenTocado] = useState(false);

  const wsIdsRef = useRef<string[]>([]);

  // 🆕 Carrega Facebook SDK uma vez (necessário pro popup OAuth)
  useEffect(() => {
    if (window.FB) return;
    if (document.getElementById("facebook-jssdk")) return;
    window.fbAsyncInit = function () {
      window.FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: "v21.0" });
    };
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const ids: string[] = [];
    if (workspace?.username) ids.push(workspace.username);
    if (workspace?.id) ids.push(workspace.id.toString());
    wsIdsRef.current = ids;
  }, [workspace]);

  // 🎨 ESTILOS LIGHT TECH
  useEffect(() => {
    if (!wsId) return;
    let cancelado = false;
    (async () => {
      const [{ data: configs }, { data: customs }] = await Promise.all([
        supabase.from("proposta_campos_padrao_config")
          .select("id, campo_slug, label_custom, obrigatorio, visivel, ordem, opcoes, placeholder_custom")
          .eq("workspace_id", wsId),
        supabase.from("proposta_campos_customizados")
          .select("id, slug, label, tipo, obrigatorio, ordem, opcoes, placeholder, ativo")
          .eq("workspace_id", wsId)
          .order("ordem", { ascending: true }),
      ]);
      if (!cancelado) setCamposCrm(montarCamposUnificados(
        (configs as ConfigCampoPadrao[]) || [],
        (customs as CampoCustom[]) || []
      ));
    })();
    return () => { cancelado = true; };
  }, [wsId]);
  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };
  const TA = { ...IS, height: 90, resize: "vertical" as const };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    transition: "all 0.15s",
  };

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const fetchLimites = async () => {
    if (!user?.email && !workspace?.owner_email) return;
    const emailAlvo = workspace?.owner_email || user?.email;
    if (!emailAlvo) return;
    try {
      const { data } = await supabase.from("cadastros").select("conexoes_liberadas, permite_webjs, permite_waba, permite_instagram").eq("email", emailAlvo).maybeSingle();
      if (data) {
        setLimites({
          conexoes: data.conexoes_liberadas || 1,
          webjs: data.permite_webjs !== false,
          waba: !!data.permite_waba,
          instagram: !!data.permite_instagram,
        });
      }
    } catch (e) {}
  };

  const fetchConexoes = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    const { data } = await supabase.from("conexoes").select("*").in("workspace_id", ids).order("created_at", { ascending: false });
    setConexoes(data || []);
  };

  const fetchFluxos = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    const { data } = await supabase.from("fluxos").select("id, nome, ativo").in("workspace_id", ids).order("created_at", { ascending: false });
    setFluxos(data || []);
  };

  const fetchFilas = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    try {
      // 👥 traz equipe_id pra conseguir filtrar as filas por equipe no modal de canal
      const { data } = await supabase.from("filas").select("id, nome, conexao, equipe_id").in("workspace_id", ids).order("nome", { ascending: true });
      setFilasBanco(data || []);
    } catch (e) {
      console.error("Erro ao buscar filas:", e);
      setFilasBanco([]);
    }
  };

  // 👥 Busca as equipes ativas do workspace (alimenta o seletor de equipe no modal)
  const fetchEquipes = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    try {
      const { data } = await supabase.from("equipes").select("id, nome, ativo").in("workspace_id", ids).eq("ativo", true).order("nome", { ascending: true });
      setEquipes(data || []);
    } catch (e) {
      console.error("Erro ao buscar equipes:", e);
      setEquipes([]);
    }
  };

  const verificarStatusWaba = async (canalId: number, workspaceIdDoCanal: string) => {
    const qs = `canalId=${canalId}&workspaceId=${encodeURIComponent(workspaceIdDoCanal)}`;
    try {
      const resp = await fetch(`https://api.wolfgyn.com.br/waba/verificar-status?${qs}`, { cache: "no-store" });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Falha ao consultar o canal");
      return json;
    } catch (_erroDireto) {
      try {
        const resp = await fetch(`/api/whatsapp?rota=waba/verificar-status&${qs}`, { cache: "no-store" });
        return await resp.json();
      } catch (erro) {
        return { success: false, status: "desconectado", error: traduzirErro(erro) };
      }
    }
  };

  const resolverLimiteMeta = (...valores: any[]) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined || valor === "") continue;
      const numeroDireto = Number(valor);
      if (Number.isFinite(numeroDireto) && numeroDireto > 0) return numeroDireto;
      const texto = String(valor).toUpperCase();
      if (texto.includes("UNLIMITED")) return Number.MAX_SAFE_INTEGER;
      const mil = texto.match(/(\d+(?:[.,]\d+)?)\s*K/);
      if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000);
      const numero = texto.match(/(\d+)/);
      if (numero) return Number(numero[1]);
    }
    return 0;
  };

  const normalizarQualidadeMeta = (valor: any): IntegridadeWaba["qualidade"] => {
    const qualidade = String(valor || "").toLowerCase();
    if (["green", "alta", "high"].some(item => qualidade.includes(item))) return "Alta";
    if (["yellow", "media", "média", "medium"].some(item => qualidade.includes(item))) return "Média";
    if (["red", "baixa", "low"].some(item => qualidade.includes(item))) return "Baixa";
    return "Desconhecida";
  };

  const normalizarIntegridadeWaba = (resposta: any): IntegridadeWaba => {
    const status = String(resposta?.status || resposta?.meta_status || "").toLowerCase();
    const conectado = ["conectado", "connected", "registered", "ativo", "online", "ready"].some(item => status.includes(item));
    const qualidade = normalizarQualidadeMeta(resposta?.quality_rating || resposta?.qualidade);
    const limite24h = resolverLimiteMeta(
      resposta?.limite24h,
      resposta?.whatsapp_business_manager_messaging_limit,
      resposta?.messaging_limit_tier
    );
    const enviados24h = resposta?.enviados24h === undefined ? null : Math.max(0, Number(resposta.enviados24h || 0));
    const falhas24h = resposta?.falhas24h === undefined ? null : Math.max(0, Number(resposta.falhas24h || 0));
    const tentativas = (enviados24h || 0) + (falhas24h || 0);
    const taxaFalha = tentativas > 0 ? (falhas24h || 0) / tentativas : 0;
    let score = conectado ? 100 : 0;
    if (qualidade === "Média") score -= 15;
    if (qualidade === "Baixa") score -= 35;
    if (qualidade === "Desconhecida") score -= 5;
    score -= Math.min(40, Math.round(taxaFalha * 100));
    if (resposta?.error || resposta?.metricas_fonte === "indisponivel") score = Math.min(score, 40);

    return {
      carregando: false,
      conectado,
      qualidade,
      limite24h,
      tier: String(resposta?.whatsapp_business_manager_messaging_limit || resposta?.messaging_limit_tier || ""),
      enviados24h,
      falhas24h,
      score: Math.max(0, Math.min(100, Math.round(score))),
      erro: resposta?.error ? traduzirErro({ ...resposta, code: resposta?.error_code }) : null,
      atualizadoEm: new Date().toISOString(),
      nome: resposta?.nome || resposta?.verified_name || resposta?.numero || "",
      fonteLimite: resposta?.limite_fonte || (limite24h ? "meta" : ""),
    };
  };

  const carregarIntegridadeWaba = async (canal: Conexao) => {
    setIntegridadesWaba(atuais => ({
      ...atuais,
      [canal.id]: { ...(atuais[canal.id] || normalizarIntegridadeWaba({})), carregando: true }
    }));
    const resposta = await verificarStatusWaba(canal.id, canal.workspace_id);
    const integridade = normalizarIntegridadeWaba(resposta);
    setIntegridadesWaba(atuais => ({ ...atuais, [canal.id]: integridade }));

    if (resposta?.success) {
      const numeroReal = resposta.numero || canal.numero;
      if (canal.status !== resposta.status || canal.numero !== numeroReal) {
        await supabase.from("conexoes").update({ status: resposta.status, numero: numeroReal })
          .eq("id", canal.id)
          .eq("workspace_id", canal.workspace_id);
      }
    }
    return integridade;
  };

  useEffect(() => {
    if (!workspace?.id) return;
    fetchConexoes();
    fetchFluxos();
    fetchFilas();
    fetchEquipes();
    fetchLimites();

    const channelName = `conexoes_rt_${wsId || "anon"}`;
    const ch = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes", filter: `workspace_id=eq.${wsId}` }, () => fetchConexoes())
      .on("postgres_changes", { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${wsId}` }, () => fetchFilas())
      .on("postgres_changes", { event: "*", schema: "public", table: "equipes", filter: `workspace_id=eq.${wsId}` }, () => fetchEquipes())
      .subscribe();

    const interval = setInterval(async () => {
      try {
        if (!wsId) return;
        const resp = await fetch(`https://api.wolfgyn.com.br/status?workspaceId=${encodeURIComponent(wsId)}`);
        const data = await resp.json();
        if (data.sessoes && Array.isArray(data.sessoes)) {
          const ids = wsIdsRef.current;
          if (ids.length === 0) return;
          const { data: canaisBanco } = await supabase.from("conexoes").select("*").in("workspace_id", ids);
          if (!canaisBanco) return;
          for (const c of canaisBanco) {
            if (c.tipo === "webjs") {
              const sessaoVPS = data.sessoes.find((s: any) => s.canalId === c.id);
              if (!sessaoVPS) continue;
              const statusReal = sessaoVPS.status === "conectado" ? "conectado" : "desconectado";
              const numeroReal = sessaoVPS.numero || "";
              if (c.status !== statusReal || (statusReal === "conectado" && c.numero !== numeroReal)) {
                await supabase.from("conexoes").update({ status: statusReal, numero: numeroReal })
                  .eq("id", c.id).eq("workspace_id", c.workspace_id);
              }
            }
          }
        }
      } catch (e) {}
      fetchConexoes();
    }, 5000);

    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [workspace, user?.email]);

  const chaveCanaisWaba = conexoes
    .filter(canal => canal.tipo === "waba")
    .map(canal => `${canal.id}:${canal.workspace_id}`)
    .join("|");

  // A Meta não precisa ser consultada a cada 5 segundos. Uma leitura inicial e
  // atualização a cada 30 segundos mantém o painel atual sem pressionar a API.
  useEffect(() => {
    const canaisWaba = conexoes.filter(canal => canal.tipo === "waba");
    if (canaisWaba.length === 0) return;
    let ativo = true;

    const atualizar = async () => {
      for (const canal of canaisWaba) {
        if (!ativo) return;
        await carregarIntegridadeWaba(canal);
      }
    };

    atualizar();
    const intervalo = setInterval(atualizar, 30000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, [chaveCanaisWaba]);

  // 🆕 POLLING RÁPIDO + DETECÇÃO VIA ESTADO
  useEffect(() => {
    if (!qrPolling || !showModalQR || !qrCanalId) return;
    let tentativas = 0;
    const interval = setInterval(async () => {
      tentativas++;
      setQrTentativas(tentativas);
      try {
        const resp = await fetch(`https://api.wolfgyn.com.br/qr-data?canalId=${qrCanalId}&workspaceId=${encodeURIComponent(wsId || "")}`, { cache: "no-store" });
        if (!resp.ok) { console.warn(`[QR poll] status HTTP ${resp.status} — tentativa ${tentativas}`); return; }
        const data = await resp.json();
        if (data.qr && data.qr !== qrImageUrl) setQrImageUrl(data.qr);
        console.log(`[QR poll #${tentativas}] canal=${qrCanalId} status=${data.status} numero=${data.numero || "—"}`);
        if (data.status === "conectado") {
          console.log(`[QR poll] ✅ DETECTOU CONEXÃO — fechando modal`);
          setQrConectado(true);
          setQrNumero(data.numero || "");
          setQrPolling(false);
          await supabase.from("conexoes").update({ status: "conectado", numero: data.numero || "Conectado" })
            .eq("id", qrCanalId).in("workspace_id", wsIdsRef.current);
          await fetchConexoes();
          setTimeout(() => { setShowModalQR(false); setQrImageUrl(""); setQrTentativas(0); }, 800);
        }
      } catch (e: any) { console.warn(`[QR poll] erro fetch:`, e?.message || e); }
    }, 1500);
    return () => clearInterval(interval);
  }, [qrPolling, showModalQR, qrCanalId]);

  // 🆕 PLANO B — observa estado `conexoes` via Realtime
  useEffect(() => {
    if (!showModalQR || !qrCanalId || qrConectado) return;
    const canal = conexoes.find(c => c.id === qrCanalId);
    if (canal && canal.status === "conectado") {
      console.log(`[QR state] ✅ DETECTOU CONEXÃO via realtime/banco — canal ${qrCanalId}`);
      setQrConectado(true);
      setQrNumero(canal.numero || "");
      setQrPolling(false);
      setTimeout(() => { setShowModalQR(false); setQrImageUrl(""); setQrTentativas(0); }, 800);
    }
  }, [conexoes, showModalQR, qrCanalId, qrConectado]);

  const registrarNumeroWaba = async (c: Conexao) => {
    const usarPinPadrao = confirm(`🟢 Ativar o número na Meta?\n\nCanal: ${c.nome}\nNúmero: ${c.numero}\n\nClique OK pra usar o PIN padrão (000000).\nClique CANCELAR se você configurou um PIN personalizado (2FA).`);
    let pin = "000000";
    if (!usarPinPadrao) {
      const pinCustom = prompt("Digite seu PIN de 6 dígitos (2FA):", "");
      if (!pinCustom) return;
      if (!/^\d{6}$/.test(pinCustom)) { notify("PIN deve ter exatamente 6 dígitos", "aviso", "Digite os 6 números do seu PIN de 2 fatores"); return; }
      pin = pinCustom;
    }
    setRegistrandoWaba(true); setShowMenuEngrenagem(null);
    try {
      const resp = await fetch(`/api/whatsapp?rota=waba/registrar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canalId: c.id, pin, workspaceId: c.workspace_id }),
      });
      const data = await resp.json();
      if (data.success) {
        notify("Número ativado na Meta!", "sucesso", "Agora está conectado e pode receber mensagens");
        await fetchConexoes();
      } else {
        const codigo = data.codigo;
        let mensagemErro = data.error || "Erro desconhecido";
        let dica = "";
        if (codigo === 131000 || mensagemErro.includes("PIN")) dica = "\n\n💡 Dica: o número tem 2FA. Clique Cancelar no primeiro popup pra digitar PIN.";
        else if (mensagemErro.toLowerCase().includes("too many")) dica = "\n\n💡 Aguarde uns minutos antes de tentar de novo.";
        else if (codigo === 133010) dica = "\n\n💡 Número já está registrado!";
        notify(traduzirErro({ error: mensagemErro, codigo }), "erro", dica.replace(/^\n\n💡 ?/, "") || undefined);
      }
    } catch (e: any) { notify("Operação falhou", "erro", traduzirErro(e)); }
    setRegistrandoWaba(false);
  };

  const encerrarAtendimentosEmMassa = async (tipo: "aguardando" | "abertos", c: Conexao) => {
    const statusAlvo = tipo === "aguardando" ? ["pendente"] : ["aberto", "em_atendimento"];
    const labelTipo = tipo === "aguardando" ? "aguardando" : "abertos";
    const { data: atendimentos, error: errBusca } = await supabase.from("atendimentos").select("id, numero, nome").eq("workspace_id", c.workspace_id).eq("canal_id", c.id).in("status", statusAlvo);
    if (errBusca) { notify("Erro ao buscar atendimentos", "erro", traduzirErro(errBusca)); return; }
    const total = atendimentos?.length || 0;
    if (total === 0) { notify(`Não há atendimentos ${labelTipo} em "${c.nome}"`, "info"); setShowMenuEngrenagem(null); return; }
    const confirmacao = confirm(`⚠️ ATENÇÃO — Canal: ${c.nome}\n\nVocê está prestes a ENCERRAR ${total} atendimento(s) ${labelTipo}.\n\nDeseja continuar?`);
    if (!confirmacao) return;
    setEncerrandoMassa(true); setShowMenuEngrenagem(null);
    try {
      const meuNome = user?.email ? user.email.split("@")[0] : "Sistema";
      const { error: errUpdate } = await supabase.from("atendimentos").update({ status: "resolvido" }).eq("workspace_id", c.workspace_id).eq("canal_id", c.id).in("status", statusAlvo);
      if (errUpdate) throw errUpdate;
      const mensagensSistema = (atendimentos || []).map(a => ({ numero: a.numero, mensagem: `Chat encerrado em massa (${labelTipo}) por: ${meuNome}`, de: "sistema", workspace_id: c.workspace_id, canal_id: c.id }));
      if (mensagensSistema.length > 0) { for (let i = 0; i < mensagensSistema.length; i += 100) { const lote = mensagensSistema.slice(i, i + 100); await supabase.from("mensagens").insert(lote); } }
      try { await supabase.from("fluxo_sessoes").update({ status: "finalizado" }).eq("workspace_id", c.workspace_id).eq("status", "ativo"); } catch (e) {}
      notify(`${total} atendimento(s) ${labelTipo} encerrado(s)`, "sucesso");
    } catch (e: any) { notify("Operação falhou", "erro", traduzirErro(e)); }
    setEncerrandoMassa(false);
  };

  const testarWABA = async () => {
    if (!form.phoneNumberId || !form.token) { notify("Preencha o ID do número e o token permanente", "aviso"); return; }
    setTestandoWABA(true); setWabaTeste(null);
    try {
      const resp = await fetch(`/api/whatsapp?rota=waba/testar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumberId: form.phoneNumberId, wabaId: form.wabaId, token: form.token }) });
      const data = await resp.json();
      setWabaTeste(data?.success ? data : { ...data, error: traduzirErro({ ...data, code: data?.error_code }) });
    } catch (erro) { setWabaTeste({ success: false, error: traduzirErro(erro) }); }
    setTestandoWABA(false);
  };

  const abrirEditar = (c: Conexao) => {
    setEditandoId(c.id);
    // 👥 deriva a equipe a partir da fila atual do canal (a fila carrega o equipe_id)
    const equipeDaFila = filasBanco.find(f => f.nome === c.fila)?.equipe_id || "";
    setForm({ nome: c.nome, tipo: c.tipo, phoneNumberId: c.phone_number_id || "", wabaId: c.waba_id || "", token: "", webhookToken: c.webhook_token || "", modo: c.modo, ia: c.ia, apiKey: "", prompt: c.prompt || "", fluxoId: c.fluxo_id == null ? "" : String(c.fluxo_id), equipeId: equipeDaFila, fila: c.fila || "", pararSeAtendente: c.parar_se_atendente, typebot_url: c.typebot_url || "", typebot_msg_invalida: c.typebot_msg_invalida || "", typebot_msg_boas_vindas: c.typebot_msg_boas_vindas || "", modulos: Array.isArray(c.modulos) ? c.modulos : ["chatbot"], iaCrmAtivo: c.ia_crm_ativo === true, iaCrmMapeamento: c.ia_crm_mapeamento && typeof c.ia_crm_mapeamento === "object" ? c.ia_crm_mapeamento : {}, iaCrmCamposObrigatorios: Array.isArray(c.ia_crm_campos_obrigatorios) ? c.ia_crm_campos_obrigatorios : [], iaAgrupamentoMs: Number(c.ia_agrupamento_ms || 3500) });
    setApiKeyTocada(false); setTokenTocado(false); setWabaTeste(null); setShowModalNovoCanal(true); setShowMenuEngrenagem(null);
    fetchFluxos(); fetchFilas(); fetchEquipes();
  };

  const toggleMetaFlag = async (canal: any, flag: "instagram_ativo" | "messenger_ativo") => {
    try {
      const novoValor = !canal[flag];
      const { error } = await supabase.from("conexoes").update({ [flag]: novoValor }).eq("id", canal.id).eq("workspace_id", canal.workspace_id);
      if (error) { notify("Falha ao atualizar canal", "erro", traduzirErro(error)); return; }
      await fetchConexoes();
    } catch (err: any) { notify("Falha de rede", "erro", traduzirErro(err)); }
  };

  const conectarMeta = () => {
    if (!wsId) { notify("Workspace não identificado", "aviso", "Recarregue a página (F5)"); return; }
    if (!window.FB) { notify("Sistema do Facebook carregando", "aviso", "Aguarde 2 segundos e tente novamente"); return; }
    setConectandoMeta(true);
    setResultadoMeta(null);
    window.FB.login(
      (response: any) => {
        if (!response.authResponse) { setConectandoMeta(false); setResultadoMeta({ sucesso: false, mensagem: "Você cancelou a conexão." }); return; }
        const accessToken = response.authResponse.accessToken;
        (async () => {
          try {
            const r = await fetch(`${META_BASE}/auth/listar-pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
            const data = await r.json();
            if (data.sucesso && Array.isArray(data.pages)) {
              if (data.pages.length === 0) { setResultadoMeta({ sucesso: false, mensagem: "Nenhuma página do Facebook foi encontrada nessa conta." }); }
              else { setPagesDisponiveis(data.pages); setPagesSelecionadas(new Set()); setShowSelecaoPages(true); }
            } else { setResultadoMeta({ sucesso: false, mensagem: data.erro || "Erro ao listar as páginas." }); }
          } catch (err: any) { setResultadoMeta({ sucesso: false, mensagem: "Erro de rede: " + (err.message || "desconhecido") }); }
          finally { setConectandoMeta(false); }
        })();
      },
      { config_id: FB_CONFIG_ID, response_type: "token" }
    );
  };

  const togglePage = (pageId: string) => {
    setPagesSelecionadas(prev => { const novo = new Set(prev); if (novo.has(pageId)) novo.delete(pageId); else novo.add(pageId); return novo; });
  };

  const confirmarSelecaoPages = async () => {
    if (pagesSelecionadas.size === 0) { notify("Selecione pelo menos uma página do Facebook", "aviso"); return; }
    const pagesEscolhidas = pagesDisponiveis.filter(p => pagesSelecionadas.has(p.id));
    setConectandoMeta(true);
    try {
      const r = await fetch(`${META_BASE}/auth/conectar-pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: wsId, pages: pagesEscolhidas }) });
      const data = await r.json();
      if (data.sucesso) { setResultadoMeta({ sucesso: true, mensagem: `${data.pages_processadas} página(s) conectada(s)!`, pages: data.resultados }); await fetchConexoes(); setShowSelecaoPages(false); }
      else { setResultadoMeta({ sucesso: false, mensagem: data.erro || "Erro ao conectar as páginas." }); }
    } catch (err: any) { setResultadoMeta({ sucesso: false, mensagem: "Erro de rede: " + (err.message || "desconhecido") }); }
    finally { setConectandoMeta(false); }
  };

  const salvarCanal = async () => {
    if (!editandoId && form.tipo === "meta_oauth") { notify("Canal Meta já conectado", "info", "Clique em 'Concluir' pra fechar este modal"); return; }
    if (!wsId) { notify("Aguarde o workspace carregar", "aviso"); return; }
    if (!form.nome.trim()) { notify("Digite o nome do canal", "aviso"); return; }
    if (!form.fila) { notify("Selecione uma fila", "aviso", "Se não tem fila cadastrada, vá em Configurações → Filas"); return; }
    if (!editandoId && form.tipo === "waba" && (!form.phoneNumberId || !form.token)) { notify("Preencha o ID do número e o token permanente", "aviso"); return; }
    if (!editandoId && form.modo === "ia" && !form.apiKey) { notify("Digite a chave da API da inteligência artificial", "aviso"); return; }
    if (form.modo === "fluxo" && !form.fluxoId) { notify("Selecione o fluxo deste canal", "aviso"); return; }
    if (form.modo === "typebot" && !form.typebot_url?.trim()) { notify("Cole a URL de publicação do Typebot", "aviso"); return; }
    if (form.modo === "ia" && form.iaCrmAtivo) {
      if (form.ia !== "gpt") { notify("Cadastro automático disponível no ChatGPT", "aviso", "Selecione ChatGPT para usar as ferramentas do CRM"); return; }
      if (Object.keys(form.iaCrmMapeamento).length === 0) { notify("Mapeie pelo menos uma variável para o CRM", "aviso"); return; }
      if (form.iaCrmCamposObrigatorios.length === 0) { notify("Marque pelo menos um campo obrigatório", "aviso"); return; }
    }

    if (!editandoId && !isSuperAdmin) {
      if (conexoes.length >= limites.conexoes) { notify("Limite do plano atingido", "erro", `Seu plano permite até ${limites.conexoes} canal(is). Você já tem ${conexoes.length}. Atualize o plano para criar mais.`); return; }
      if (form.tipo === "webjs" && !limites.webjs) { notify("Seu plano não inclui WhatsApp Web", "erro", "Atualize o plano para usar este canal"); return; }
      if (form.tipo === "waba" && !limites.waba) { notify("Seu plano não inclui API Meta (WABA)", "erro", "Atualize para o plano Intermediário ou Ultra"); return; }
    }

    setSalvandoCanal(true);
    try {
      const fluxoSel = fluxos.find(f => f.id.toString() === form.fluxoId);
      const fluxoIdSelecionado = form.modo === "fluxo" && form.fluxoId ? Number(form.fluxoId) : null;
      if (form.modo === "fluxo" && !Number.isFinite(fluxoIdSelecionado)) throw new Error("Fluxo selecionado inválido");
      const payload: any = {
        nome: form.nome, modo: form.modo, ia: form.ia, fluxo_id: fluxoIdSelecionado, fluxo_nome: fluxoSel?.nome || "",
        fila: form.fila, prompt: form.prompt, parar_se_atendente: form.pararSeAtendente,
        typebot_url: form.typebot_url || "",
        typebot_msg_invalida: form.typebot_msg_invalida || "Desculpe, não entendi sua resposta. Pode tentar de novo?",
        typebot_msg_boas_vindas: form.typebot_msg_boas_vindas || "",
        ia_crm_ativo: form.iaCrmAtivo,
        ia_crm_mapeamento: form.iaCrmMapeamento,
        ia_crm_campos_obrigatorios: form.iaCrmCamposObrigatorios,
        ia_agrupamento_ms: form.iaAgrupamentoMs,
        modulos: Array.isArray(form.modulos) ? form.modulos : ["chatbot"],  // 📂 onde o canal aparece no sistema
      };
      if (apiKeyTocada || !editandoId) payload.api_key = form.apiKey;

      if (editandoId) {
        const conexaoEditada = conexoes.find(c => c.id === editandoId);
        if (!conexaoEditada) throw new Error("Conexão não encontrada para edição");
        if (form.tipo === "waba") {
          if (form.phoneNumberId) payload.phone_number_id = form.phoneNumberId;
          if (form.wabaId) payload.waba_id = form.wabaId;
          if (form.webhookToken) payload.webhook_token = form.webhookToken;
          if (tokenTocado && form.token) payload.token_waba = form.token;
        }
        const { data: canalAtualizado, error: erroAtualizacao } = await supabase.from("conexoes")
          .update(payload)
          .eq("id", editandoId)
          .eq("workspace_id", conexaoEditada.workspace_id)
          .select("id, fluxo_id, fluxo_nome, modo")
          .maybeSingle();
        if (erroAtualizacao) throw erroAtualizacao;
        if (!canalAtualizado) throw new Error("A conexão não foi atualizada. Confira sua permissão no workspace.");
        if (String(canalAtualizado.fluxo_id || "") !== String(fluxoIdSelecionado || "")) throw new Error("O fluxo selecionado não foi confirmado pelo banco de dados.");
        setEditandoId(null);
        try {
          const runtime = await wa("configurar-ia", { canalId: editandoId, workspaceId: conexaoEditada.workspace_id, ia: form.ia, apiKey: form.apiKey, prompt: form.prompt, fila: form.fila, modo: form.modo, fluxoId: fluxoIdSelecionado, fluxoNome: fluxoSel?.nome || "", iaCrmAtivo: form.iaCrmAtivo, iaCrmMapeamento: form.iaCrmMapeamento, iaCrmCamposObrigatorios: form.iaCrmCamposObrigatorios, iaAgrupamentoMs: form.iaAgrupamentoMs });
          if (runtime?.success === false) throw new Error(runtime.error || "Falha ao atualizar o canal no servidor");
        } catch (e: any) {
          notify("Fluxo salvo, mas o servidor precisa sincronizar", "aviso", traduzirErro(e));
        }
        notify("Canal atualizado", "sucesso");
      } else {
        let novoId: number | null = null;
        if (form.tipo === "waba") {
          const webhookToken = form.webhookToken || `wolf_${wsId}_${Date.now()}`;
          const { data: inserted, error: insErr } = await supabase.from("conexoes").insert([{
            workspace_id: wsId, tipo: "waba", status: "desconectado",
            numero: wabaTeste?.nome || form.phoneNumberId,
            phone_number_id: form.phoneNumberId, waba_id: form.wabaId,
            token_waba: form.token, webhook_token: webhookToken,
            ...payload
          }]).select().single();
          if (insErr) throw insErr;
          novoId = inserted.id;
        } else {
          const { data: inserted, error: insErr } = await supabase.from("conexoes").insert([{
            workspace_id: wsId, tipo: "webjs", status: "desconectado", numero: "", ...payload
          }]).select().single();
          if (insErr) throw insErr;
          novoId = inserted.id;
        }
        if (novoId) { try { await wa("canal/criar", { canalId: novoId, workspaceId: wsId }); } catch (e) { console.error("Erro ao criar sessão no VPS:", e); } }
        notify("Canal criado", "sucesso");
      }
      await fetchConexoes();
      setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null);
      setApiKeyTocada(false); setTokenTocado(false);
    } catch (e: any) { notify("Operação falhou", "erro", traduzirErro(e)); }
    setSalvandoCanal(false);
  };

  const abrirQR = async (id: number) => {
    const canal = conexoes.find(c => c.id === id);
    if (!canal) return;
    setQrCanalId(id); setResetando(true); setShowModalQR(true);
    setQrImageUrl(""); setQrConectado(false); setQrNumero(""); setQrTentativas(0);
    try { await wa("resetar", { canalId: id, workspaceId: canal.workspace_id }); } catch (e) {}
    await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", id).eq("workspace_id", canal.workspace_id);
    await fetchConexoes(); setResetando(false); setQrPolling(true);
  };

  const reconectarCanal = async (c: Conexao) => {
    if (!confirm(`🔄 Reconectar ${c.nome}?\n\nA conexão atual será recriada sem perder a sessão salva do WhatsApp.\nUse isso quando o canal travar ou apresentar erro.\n\nPara trocar o número ou a conta, use "Resetar" no menu de configurações.`)) return;
    setShowMenuEngrenagem(null);
    try {
      const data = await wa("reconectar", { canalId: c.id, workspaceId: c.workspace_id });
      if (!data.success) { notify("Falha ao reconectar", "erro", traduzirErro(data)); return; }
      await supabase.from("conexoes").update({ status: "desconectado" }).eq("id", c.id).eq("workspace_id", c.workspace_id);
      await fetchConexoes();
      if (data.sessao_salva === false) {
        notify(`${c.nome} não tem sessão salva`, "aviso", "O código QR será aberto para leitura");
        setQrCanalId(c.id); setResetando(false); setShowModalQR(true);
        setQrImageUrl(""); setQrConectado(false); setQrNumero(""); setQrTentativas(0);
        setQrPolling(true);
      } else {
        notify(`${c.nome} reconectando...`, "sucesso", "A sessão será restaurada automaticamente. Não é necessário ler outro código QR");
      }
    } catch (e: any) { notify("Falha ao reconectar", "erro", traduzirErro(e)); }
  };

  const dataParaInputLocal = (data: Date) => {
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const abrirRecuperacao = (canal: Conexao) => {
    const agora = new Date();
    setShowMenuEngrenagem(null);
    setCanalRecuperacao(canal);
    setPeriodoRecuperacao("24");
    setInicioRecuperacao(dataParaInputLocal(new Date(agora.getTime() - 24 * 60 * 60 * 1000)));
    setFimRecuperacao(dataParaInputLocal(agora));
    setJobRecuperacao(null);
  };

  const iniciarRecuperacao = async () => {
    if (!canalRecuperacao || iniciandoRecuperacao) return;
    const body: Record<string, any> = {
      canalId: canalRecuperacao.id,
      workspaceId: canalRecuperacao.workspace_id,
    };
    if (periodoRecuperacao === "personalizado") {
      const inicio = new Date(inicioRecuperacao);
      const fim = new Date(fimRecuperacao);
      if (!inicioRecuperacao || !fimRecuperacao || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        notify("Informe o período completo", "aviso", "Preencha a data e o horário inicial e final");
        return;
      }
      body.inicio = inicio.toISOString();
      body.fim = fim.toISOString();
    } else {
      body.horas = Number(periodoRecuperacao);
    }

    setIniciandoRecuperacao(true);
    try {
      const data = await wa("sincronizar-conversas", body);
      if (!data?.success || !data?.job) {
        notify("Não foi possível iniciar a recuperação", "erro", traduzirErro(data));
        return;
      }
      setJobRecuperacao(data.job);
      notify(
        data.existente ? "Recuperação já estava em andamento" : "Recuperação iniciada",
        "sucesso",
        "O trabalho continuará em segundo plano e sempre dará prioridade às mensagens ao vivo"
      );
    } catch (e: any) {
      notify("Falha ao iniciar a recuperação", "erro", traduzirErro(e));
    } finally {
      setIniciandoRecuperacao(false);
    }
  };

  useEffect(() => {
    if (!canalRecuperacao || !jobRecuperacao?.id || ["concluido", "erro"].includes(jobRecuperacao.status)) return;
    let ativo = true;
    const consultar = async () => {
      try {
        const qs = new URLSearchParams({
          jobId: jobRecuperacao.id,
          canalId: String(canalRecuperacao.id),
          workspaceId: canalRecuperacao.workspace_id,
        });
        const resp = await fetch(`/api/whatsapp?rota=sincronizar-conversas/status&${qs.toString()}`, { cache: "no-store" });
        const data = await resp.json();
        if (!ativo || !data?.success || !data?.job) return;
        const atualizado = data.job as JobRecuperacao;
        setJobRecuperacao(atualizado);
        if (["concluido", "erro"].includes(atualizado.status) && !jobsRecuperacaoNotificados.current.has(atualizado.id)) {
          jobsRecuperacaoNotificados.current.add(atualizado.id);
          if (atualizado.status === "concluido") {
            notify(
              `${atualizado.importadas} mensagem(ns) recuperada(s)`,
              "sucesso",
              `${atualizado.recebidas} recebida(s), ${atualizado.enviadas} enviada(s) e ${atualizado.duplicadas} já existente(s)`
            );
          } else {
            notify("Recuperação interrompida", "erro", atualizado.erro || "Consulte os logs do canal");
          }
        }
      } catch (e) {}
    };
    consultar();
    const timer = window.setInterval(consultar, 2500);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [canalRecuperacao?.id, canalRecuperacao?.workspace_id, jobRecuperacao?.id, jobRecuperacao?.status]);

  const desconectarCanal = async (c: Conexao) => {
    if (!confirm(`Desconectar ${c.nome}? Isso vai desconectar o WhatsApp.`)) return;
    try {
      await wa("desconectar", { canalId: c.id, workspaceId: c.workspace_id });
      await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", c.id).eq("workspace_id", c.workspace_id);
      await fetchConexoes();
      notify("Canal desconectado", "sucesso");
    } catch (e: any) { notify("Operação falhou", "erro", traduzirErro(e)); }
  };

  const excluirCanal = async (id: number) => {
    if (!confirm("Excluir esse canal?\n\nTodo o histórico vai ser preservado mas o canal será removido.")) return;
    const canal = conexoes.find(c => c.id === id);
    if (!canal) { notify("Canal não encontrado", "erro"); return; }
    if (canal.tipo === "webjs") { try { await wa("desconectar", { canalId: id, workspaceId: canal.workspace_id }); } catch (e) {} }
    await supabase.from("conexoes").delete().eq("id", id).eq("workspace_id", canal.workspace_id);
    await fetchConexoes(); setShowMenuEngrenagem(null);
  };

  const modoColor: Record<string, string> = { nenhum: "#6b7280", ia: "#10b981", fluxo: "#8b5cf6", typebot: "#a78bfa" };
  const iaLabel: Record<string, string> = { gpt: "ChatGPT", claude: "Claude AI", gemini: "Gemini", deepseek: "DeepSeek" };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{ width: 44, height: 24, background: value ? "#16a34a" : "#d1d5db", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0, transition: "background 0.2s", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );

  const formatarLimiteMeta = (integridade: IntegridadeWaba) => {
    if (!integridade.limite24h) return "Não retornado pela Meta";
    if (integridade.limite24h === Number.MAX_SAFE_INTEGER) return "Sem limite definido";
    return `${integridade.limite24h.toLocaleString("pt-BR")} contatos em 24h`;
  };

  const PainelIntegridadeWaba = ({
    dados,
    titulo = "Integridade da API",
    onAtualizar,
  }: {
    dados: IntegridadeWaba;
    titulo?: string;
    onAtualizar?: () => void;
  }) => {
    const cor = dados.score >= 85 ? "#059669" : dados.score >= 60 ? "#d97706" : "#dc2626";
    const corQualidade = dados.qualidade === "Alta" ? "#059669" : dados.qualidade === "Média" ? "#d97706" : dados.qualidade === "Baixa" ? "#dc2626" : "#64748b";
    return (
      <div style={{ background: "#f8fafc", border: `1px solid ${cor}40`, borderLeft: `4px solid ${cor}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <b style={{ color: "#0f172a", fontSize: 12 }}>{titulo}</b>
            <span style={{ background: `${cor}14`, color: cor, border: `1px solid ${cor}45`, borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>{dados.carregando ? "Lendo..." : `${dados.score}/100`}</span>
            <span style={{ background: `${corQualidade}14`, color: corQualidade, border: `1px solid ${corQualidade}45`, borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>Qualidade {dados.qualidade}</span>
            <span style={{ background: dados.conectado ? "#dcfce7" : "#fee2e2", color: dados.conectado ? "#15803d" : "#b91c1c", border: `1px solid ${dados.conectado ? "#86efac" : "#fecaca"}`, borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>{dados.conectado ? "Conectada" : "Desconectada"}</span>
          </div>
          {onAtualizar && (
            <button onClick={onAtualizar} disabled={dados.carregando} title="Atualizar integridade" style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, width: 30, height: 28, cursor: dados.carregando ? "wait" : "pointer", fontSize: 13 }}>
              {dados.carregando ? "…" : "↻"}
            </button>
          )}
        </div>
        <p style={{ color: "#64748b", fontSize: 10.5, margin: "7px 0 0", lineHeight: 1.6 }}>
          Limite: <b>{formatarLimiteMeta(dados)}</b>
          {dados.enviados24h !== null && <> · Enviadas em 24h: <b>{dados.enviados24h.toLocaleString("pt-BR")}</b></>}
          {dados.falhas24h !== null && <> · Falhas em 24h: <b style={{ color: dados.falhas24h ? "#dc2626" : "#15803d" }}>{dados.falhas24h.toLocaleString("pt-BR")}</b></>}
        </p>
        {dados.nome && <p style={{ color: "#64748b", fontSize: 10.5, margin: "2px 0 0" }}>Conta consultada: <b>{dados.nome}</b></p>}
        {dados.erro && <p style={{ color: "#b45309", fontSize: 10.5, fontWeight: 700, margin: "6px 0 0", lineHeight: 1.45 }}>{dados.erro}</p>}
      </div>
    );
  };

  const limiteAtingido = !isSuperAdmin && conexoes.length >= limites.conexoes;
  const webjsPermitido = isSuperAdmin || limites.webjs;
  const wabaPermitido = isSuperAdmin || limites.waba;
  const instagramPermitido = isSuperAdmin || limites.instagram;

  // 👥 Filas mostradas no modal: filtradas pela equipe escolhida (vazio = todas as equipes)
  const filasFiltradas = filasBanco.filter(f => !form.equipeId || (f.equipe_id || "") === form.equipeId);

  // Helper pra fechar modal novo canal
  const fecharModalNovoCanal = () => { setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null); setEditandoId(null); setApiKeyTocada(false); setTokenTocado(false); setResultadoMeta(null); setPagesDisponiveis([]); setPagesSelecionadas(new Set()); };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", height: "100vh", background: "#f8fafc" }}>

      {/* ═══ MODAL QR CODE ═══ */}
      {showModalQR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...cardStyle, padding: 32, width: 420, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 8px 20px rgba(22,163,74,0.25)" }}>
              <span style={{ filter: "saturate(0) brightness(2)" }}>📱</span>
            </div>
            <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Conectar WhatsApp</h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Leia o código QR com seu WhatsApp</p>
            <div style={{ background: "#f9fafb", borderRadius: 14, padding: 16, minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "1px solid #e5e7eb" }}>
              {resetando ? <p style={{ color: "#f59e0b", fontSize: 14, fontWeight: 600 }}>⏳ Iniciando sessão...</p>
                : qrConectado ? <div><p style={{ fontSize: 48, margin: "0 0 8px" }}>✅</p><p style={{ color: "#16a34a", fontSize: 16, fontWeight: 700, margin: 0 }}>WhatsApp Conectado!</p>{qrNumero && <p style={{ color: "#6b7280", fontSize: 13, margin: "8px 0 0" }}>{qrNumero}</p>}</div>
                : qrImageUrl ? <img src={qrImageUrl} alt="Código QR" style={{ width: 220, height: 220, borderRadius: 8 }} />
                : <div><p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 8px" }}>⏳ Gerando código QR...</p><p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>Aguarde alguns segundos</p></div>}
            </div>

            {qrPolling && !qrConectado && qrTentativas > 0 && (
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 10px" }}>🔄 Verificando conexão... ({qrTentativas}x)</p>
            )}

            {qrPolling && !qrConectado && qrTentativas >= 20 && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 14, marginBottom: 14, textAlign: "left" }}>
                <p style={{ color: "#92400e", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>⚠️ Tá demorando mais que o normal</p>
                <p style={{ color: "#78350f", fontSize: 11, margin: "0 0 10px", lineHeight: 1.4 }}>
                  Se já aparece conectado no celular, clica em <b>Já Conectei!</b> pra atualizar. Senão, tenta gerar um novo QR.
                </p>
                <button
                  onClick={async () => {
                    if (!qrCanalId) return;
                    try {
                      const resp = await fetch(`https://api.wolfgyn.com.br/qr-data?canalId=${qrCanalId}&workspaceId=${encodeURIComponent(wsId || "")}`, { cache: "no-store" });
                      const data = await resp.json();
                      if (data.status === "conectado") {
                        await supabase.from("conexoes").update({ status: "conectado", numero: data.numero || "Conectado" }).eq("id", qrCanalId).in("workspace_id", wsIdsRef.current);
                        await fetchConexoes();
                        setQrConectado(true); setQrNumero(data.numero || "");
                        setTimeout(() => { setShowModalQR(false); setQrImageUrl(""); setQrTentativas(0); }, 800);
                      } else { notify("Backend ainda não reconheceu a conexão", "aviso", `Status atual: ${data.status}. Tenta de novo ou recria o QR.`); }
                    } catch (e: any) { notify("Falha ao verificar QR", "erro", traduzirErro(e)); }
                  }}
                  style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                  🔍 Verificar agora
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setShowModalQR(false); setQrPolling(false); setQrImageUrl(""); setQrTentativas(0); }} style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Fechar</button>
              {!qrConectado && <button onClick={async () => { if (qrCanalId) { await supabase.from("conexoes").update({ status: "conectado", numero: qrNumero || "Conectado" }).eq("id", qrCanalId).in("workspace_id", wsIdsRef.current); await fetchConexoes(); } setShowModalQR(false); setQrPolling(false); setQrTentativas(0); }} style={{ background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>✅ Já Conectei!</button>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL NOVO/EDITAR CANAL ═══ */}
      {showModalNovoCanal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden" }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: 0 }}>{editandoId ? "✏️ Editar Canal" : "➕ Novo Canal"}</h2>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>
                  {editandoId ? "Altere as configurações" : isSuperAdmin ? `${conexoes.length} canais (ilimitado 👑)` : `${conexoes.length} de ${limites.conexoes} canais usados`}
                </p>
              </div>
              <button onClick={fecharModalNovoCanal} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
              {!editandoId && (
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>1. Tipo de Canal</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { key: "webjs", icon: "📱", label: "WhatsApp Web", desc: "Conexão por código QR", disabled: !webjsPermitido, cor: "#16a34a" },
                      { key: "waba", icon: "🔗", label: "API Meta (WABA)", desc: "API oficial do WhatsApp", disabled: !wabaPermitido, cor: "#3b82f6" },
                      { key: "meta_oauth", icon: "📲", label: "Facebook / Instagram", desc: "Entrar com Facebook", disabled: !instagramPermitido, cor: "#e1306c" }
                    ].map(t => (
                      <button key={t.key}
                        onClick={() => !t.disabled && setForm(p => ({ ...p, tipo: t.key }))}
                        disabled={t.disabled}
                        title={t.disabled ? "Seu plano não inclui esse tipo" : ""}
                        style={{
                          background: form.tipo === t.key ? `${t.cor}10` : "#f9fafb",
                          border: `2px solid ${form.tipo === t.key ? t.cor : "#e5e7eb"}`,
                          borderRadius: 12, padding: "14px 16px",
                          cursor: t.disabled ? "not-allowed" : "pointer",
                          textAlign: "left", opacity: t.disabled ? 0.4 : 1,
                          transition: "all 0.15s",
                        }}>
                        <p style={{ fontSize: 20, margin: "0 0 4px" }}>{t.icon}</p>
                        <p style={{ color: form.tipo === t.key ? t.cor : "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>{t.label}</p>
                        <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{t.disabled ? "🔒 Atualização de plano necessária" : t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>{editandoId ? "1" : "2"}. Nome do Canal</p>
                <input placeholder="Ex: WhatsApp Vendas..." value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} style={IS} />
                {/* 📂 Módulos onde este canal aparece. Vazio = não aparece em lugar nenhum. */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    📂 Aparece nos módulos
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {([
                      { id: "chatbot",  label: "🤖 Chatbot / Vendas" },
                      { id: "cobranca", label: "💰 Cobrança" },
                      { id: "rh",       label: "👥 RH" },
                      { id: "suporte",  label: "🛟 Suporte" },
                    ] as { id: string; label: string }[]).map(m => {
                      const marcado = (form.modulos || []).includes(m.id);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setForm(p => {
                            const atual = p.modulos || [];
                            return { ...p, modulos: marcado ? atual.filter(x => x !== m.id) : [...atual, m.id] };
                          })}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 12px", borderRadius: 9,
                            border: `1.5px solid ${marcado ? "#16a34a" : "#e5e7eb"}`,
                            background: marcado ? "#f0fdf4" : "#fff",
                            color: marcado ? "#15803d" : "#6b7280",
                            fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                          }}>
                          <span style={{ fontSize: 13 }}>{marcado ? "☑" : "☐"}</span> {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0 0" }}>
                    Marque onde as conversas deste canal devem aparecer. Sem nenhum marcado, o canal não aparece em lugar nenhum.
                  </p>
                </div>
              </div>
              {editandoId && (form.tipo === "instagram" || form.tipo === "messenger") && (
                <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 14, border: "1px solid #bbf7d0" }}>
                  <p style={{ color: "#15803d", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    {form.tipo === "instagram" ? "📷 Canal Instagram" : "💬 Canal Messenger"} conectado pelo acesso do Facebook.
                  </p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "6px 0 0", lineHeight: 1.4 }}>
                    Para reconectar, renovar o token ou mudar a página, exclua este canal e crie outro por "Facebook / Instagram".
                  </p>
                </div>
              )}
              {!editandoId && form.tipo === "meta_oauth" && (
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>3. Conectar conta Facebook</p>
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14, border: "1px solid #e5e7eb" }}>
                    <p style={{ color: "#374151", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                      Vamos conectar automaticamente suas <b>páginas do Facebook</b> e as respectivas contas comerciais do <b>Instagram</b>.
                    </p>
                    <p style={{ color: "#6b7280", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                      Uma janela oficial do Facebook será aberta para autorizar as permissões; depois disso, o sistema criará os canais automaticamente.
                    </p>
                    <button onClick={conectarMeta} disabled={conectandoMeta}
                      style={{ background: conectandoMeta ? "#1d4ed8" : "#1877f2", color: "white", border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: conectandoMeta ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(24,119,242,0.3)" }}>
                      {conectandoMeta ? "⏳ Conectando..." : "📲 Conectar com Facebook"}
                    </button>
                    {resultadoMeta && (
                      <div style={{ background: resultadoMeta.sucesso ? "#f0fdf4" : "#fef2f2", border: `1px solid ${resultadoMeta.sucesso ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: 14 }}>
                        <p style={{ color: resultadoMeta.sucesso ? "#15803d" : "#dc2626", fontSize: 13, margin: "0 0 6px", fontWeight: 700 }}>
                          {resultadoMeta.sucesso ? "✅ " : "❌ "}{resultadoMeta.mensagem}
                        </p>
                        {resultadoMeta.pages && resultadoMeta.pages.length > 0 && (
                          <ul style={{ margin: "8px 0 0", padding: "0 0 0 18px", color: "#15803d", fontSize: 12 }}>
                            {resultadoMeta.pages.map((p: any, i: number) => (
                              <li key={i}>
                                <b>{p.page_name}</b>
                                {p.instagram_username && ` + Instagram @${p.instagram_username}`}
                                {p.erro && <span style={{ color: "#dc2626" }}> — Erro: {p.erro}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {form.tipo === "waba" && (
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>{editandoId ? "2" : "3"}. Credenciais da API Meta</p>
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e5e7eb" }}>
                    <div><label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>ID do número de telefone *</label><input placeholder="123456789012345" value={form.phoneNumberId} onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))} style={IS} /></div>
                    <div><label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>ID da conta WhatsApp Business</label><input placeholder="123456789012345" value={form.wabaId} onChange={e => setForm(p => ({ ...p, wabaId: e.target.value }))} style={IS} /></div>
                    <div><label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>Token Permanente {editandoId ? "" : "*"}</label><input type="password" placeholder={editandoId ? "Deixe em branco pra manter o token atual" : "EAAxxxxx..."} value={form.token} onChange={e => { setForm(p => ({ ...p, token: e.target.value })); setTokenTocado(true); }} style={IS} /></div>
                    <button onClick={testarWABA} disabled={testandoWABA} style={{ background: testandoWABA ? "#2563eb" : "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f630", borderRadius: 10, padding: 10, fontSize: 13, cursor: testandoWABA ? "wait" : "pointer", fontWeight: 700 }}>{testandoWABA ? "⏳ Verificando..." : "🔍 Verificar conexão e integridade"}</button>
                    {wabaTeste && <PainelIntegridadeWaba dados={normalizarIntegridadeWaba(wabaTeste)} titulo="Resultado da verificação" />}
                    {!wabaTeste && editandoId && integridadesWaba[editandoId] && (
                      <PainelIntegridadeWaba
                        dados={integridadesWaba[editandoId]}
                        titulo="Integridade atual"
                        onAtualizar={() => {
                          const canal = conexoes.find(item => item.id === editandoId);
                          if (canal) carregarIntegridadeWaba(canal);
                        }}
                      />
                    )}
                    <div style={{ background: "#ffffff", borderRadius: 10, padding: 12, border: "1px solid #e5e7eb" }}>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", fontWeight: 600 }}>URL do Webhook</p>
                      <p style={{ color: "#16a34a", fontSize: 12, fontWeight: 700, margin: 0, wordBreak: "break-all" }}>https://api.wolfgyn.com.br/webhook/meta</p>
                    </div>
                    <div><label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>Token de Verificação</label><input placeholder="meu_token_secreto" value={form.webhookToken} onChange={e => setForm(p => ({ ...p, webhookToken: e.target.value }))} style={IS} /></div>
                    {!editandoId && (
                      <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, border: "1px solid #bbf7d0" }}>
                        <p style={{ color: "#15803d", fontSize: 11, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase" }}>💡 Importante</p>
                        <p style={{ color: "#166534", fontSize: 11, margin: 0, lineHeight: 1.5 }}>Depois de criar o canal, clique em <b>🟢 Ativar Número na Meta</b> pra deixar seu número online.</p>
                      </div>
                    )}
                    {editandoId && (
                      <div style={{ background: "#fffbeb", borderRadius: 10, padding: 12, border: "1px solid #fde68a" }}>
                        <p style={{ color: "#92400e", fontSize: 11, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase" }}>⚠️ Não está recebendo mensagens?</p>
                        <p style={{ color: "#78350f", fontSize: 11, margin: "0 0 6px", lineHeight: 1.5 }}>Pode faltar inscrever o aplicativo na conta WhatsApp Business. Execute no terminal e substitua o token:</p>
                        <code style={{ background: "#f3f4f6", padding: "6px 8px", borderRadius: 6, color: "#1f2937", fontSize: 10, display: "block", wordBreak: "break-all", border: "1px solid #e5e7eb" }}>{`curl -X POST "https://graph.facebook.com/v25.0/${form.wabaId || "ID_DA_CONTA"}/subscribed_apps" -H "Authorization: Bearer SEU_TOKEN"`}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>{editandoId ? "2" : form.tipo === "waba" ? "4" : "3"}. Automação</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { key: "nenhum", icon: "🚫", label: "Sem automação", desc: "Só humano", cor: "#6b7280" },
                    { key: "ia", icon: "🤖", label: "Usar IA", desc: "Claude, GPT...", cor: "#10b981" },
                    { key: "fluxo", icon: "🔀", label: "Usar Fluxo", desc: "Chatbot visual", cor: "#8b5cf6" },
                    { key: "typebot", icon: "🎯", label: "Typebot", desc: "URL do Typebot", cor: "#a78bfa" },
                  ].map(m => (
                    <button key={m.key} onClick={() => setForm(p => ({ ...p, modo: m.key }))} style={{
                      background: form.modo === m.key ? `${m.cor}10` : "#f9fafb",
                      border: `2px solid ${form.modo === m.key ? m.cor : "#e5e7eb"}`,
                      borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                    }}>
                      <p style={{ fontSize: 22, margin: "0 0 4px" }}>{m.icon}</p>
                      <p style={{ color: form.modo === m.key ? m.cor : "#1f2937", fontSize: 12, fontWeight: 700, margin: "0 0 2px" }}>{m.label}</p>
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: 0 }}>{m.desc}</p>
                    </button>
                  ))}
                </div>
                {form.modo === "ia" && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e5e7eb" }}>
                    <p style={{ color: "#10b981", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>🤖 Configurar IA</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[{ key: "gpt", label: "💬 ChatGPT", sub: "OpenAI", cor: "#10b981" }, { key: "claude", label: "🧠 Claude AI", sub: "Anthropic", cor: "#8b5cf6" }, { key: "gemini", label: "✨ Gemini", sub: "Google", cor: "#f59e0b" }, { key: "deepseek", label: "🔍 DeepSeek", sub: "DeepSeek AI", cor: "#3b82f6" }].map(ia => (
                        <button key={ia.key} onClick={() => { setForm(p => ({ ...p, ia: ia.key, apiKey: "" })); setApiKeyTocada(true); }} style={{
                          background: form.ia === ia.key ? `${ia.cor}10` : "#ffffff",
                          border: `2px solid ${form.ia === ia.key ? ia.cor : "#e5e7eb"}`,
                          borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                        }}>
                          <p style={{ color: form.ia === ia.key ? ia.cor : "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>{ia.label}</p>
                          <p style={{ color: "#9ca3af", fontSize: 10, margin: 0 }}>{ia.sub}</p>
                        </button>
                      ))}
                    </div>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>
                        Chave da API {editandoId && !apiKeyTocada && <span style={{ color: "#10b981", fontSize: 10 }}>(já salva)</span>}
                      </label>
                      <input type="password" placeholder={editandoId ? "Deixe vazio para manter" : "Cole sua chave da API"} value={form.apiKey} onChange={e => { setForm(p => ({ ...p, apiKey: e.target.value })); setApiKeyTocada(true); }} style={IS} />
                    </div>
                    <div><label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>Instruções do sistema</label><textarea placeholder="Ex.: Você é um atendente virtual..." value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))} style={TA} /></div>
                    <div style={{background:form.iaCrmAtivo?"#ecfdf5":"#fff",border:"1px solid #a7f3d0",borderRadius:10,padding:12}}>
                      <label style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer"}}>
                        <input type="checkbox" checked={form.iaCrmAtivo} onChange={e=>setForm(p=>({...p,iaCrmAtivo:e.target.checked}))} style={{accentColor:"#10b981",marginTop:2}}/>
                        <span>
                          <b style={{display:"block",color:"#047857",fontSize:12}}>Cadastrar vendas da IA no CRM</b>
                          <span style={{color:"#6b7280",fontSize:10,lineHeight:1.4}}>Desativado: a IA somente conversa. Ativado: salva as variáveis abaixo, mostra o resumo e só cadastra após confirmação.</span>
                        </span>
                      </label>
                      {form.iaCrmAtivo && (
                        <div style={{marginTop:12}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
                            <b style={{color:"#374151",fontSize:11}}>Mapeamento variável → CRM</b>
                            <label style={{color:"#6b7280",fontSize:10}}>
                              Juntar mensagens por{" "}
                              <select value={form.iaAgrupamentoMs} onChange={e=>setForm(p=>({...p,iaAgrupamentoMs:Number(e.target.value)}))} style={{...IS,width:"auto",padding:"4px 6px",fontSize:10}}>
                                <option value={2000}>2 segundos</option>
                                <option value={3500}>3,5 segundos</option>
                                <option value={5000}>5 segundos</option>
                                <option value={7000}>7 segundos</option>
                              </select>
                            </label>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto",paddingRight:3}}>
                            {camposCrm.filter(c=>c.visivel!==false && !["vendedor","data_proposta","telefone1"].includes(c.slug)).map(c=>(
                              <div key={c.slug} style={{display:"grid",gridTemplateColumns:"135px 1fr auto",alignItems:"center",gap:6}}>
                                <span style={{color:"#4b5563",fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.label}>{c.label}</span>
                                <input
                                  value={form.iaCrmMapeamento[c.slug] || ""}
                                  placeholder={"ex: " + c.slug}
                                  onChange={e=>setForm(p=>{const mapa={...p.iaCrmMapeamento};const valor=e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_");if(valor)mapa[c.slug]=valor;else delete mapa[c.slug];return {...p,iaCrmMapeamento:mapa};})}
                                  style={{...IS,padding:"6px 8px",fontSize:10}}
                                />
                                <label style={{display:"flex",alignItems:"center",gap:3,color:"#6b7280",fontSize:9}}>
                                  <input
                                    type="checkbox"
                                    disabled={!form.iaCrmMapeamento[c.slug]}
                                    checked={form.iaCrmCamposObrigatorios.includes(c.slug)}
                                    onChange={e=>setForm(p=>({...p,iaCrmCamposObrigatorios:e.target.checked?[...new Set([...p.iaCrmCamposObrigatorios,c.slug])]:p.iaCrmCamposObrigatorios.filter(x=>x!==c.slug)}))}
                                  />
                                  obrigatório
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
                {form.modo === "fluxo" && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e5e7eb" }}>
                    <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>🔀 Selecionar Fluxo</p>
                    {fluxos.length === 0 ? (
                      <div style={{ background: "#ffffff", borderRadius: 10, padding: 16, textAlign: "center", border: "1px solid #e5e7eb" }}>
                        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 10px" }}>Nenhum fluxo criado ainda</p>
                        <button onClick={() => { router.push("/chatbot/fluxos"); setShowModalNovoCanal(false); }} style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>🔀 Criar Fluxo</button>
                      </div>
                    ) : fluxos.map(f => (
                      <button type="button" key={f.id} onClick={() => setForm(p => ({ ...p, fluxoId: f.id.toString() }))} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: form.fluxoId === f.id.toString() ? "#8b5cf610" : "#ffffff",
                        border: `2px solid ${form.fluxoId === f.id.toString() ? "#8b5cf6" : "#e5e7eb"}`,
                        borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>🔀</span>
                          <div>
                            <p style={{ color: form.fluxoId === f.id.toString() ? "#8b5cf6" : "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{f.nome}</p>
                            <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{f.ativo ? "🟢 Ativo" : "⚫ Inativo"}</p>
                          </div>
                        </div>
                        {form.fluxoId === f.id.toString() && <span style={{ color: "#8b5cf6", fontSize: 18, fontWeight: 700 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
                {form.modo === "typebot" && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e5e7eb" }}>
                    <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>🎯 Configurar Typebot</p>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: "-4px 0 0", lineHeight: 1.4 }}>
                      Cole a URL de publicação do seu Typebot. O sistema vai usar a API dele pra processar os atendimentos automaticamente.
                    </p>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>URL do Typebot *</label>
                      <input type="text" placeholder="https://typebot.io/meu-bot ou https://seu-typebot.com.br/atendimento" value={form.typebot_url || ""} onChange={e => setForm(p => ({ ...p, typebot_url: e.target.value }))} style={IS} />
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Cole a URL completa de publicação. Aceita typebot.io e self-hosted.</p>
                    </div>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>Mensagem de boas-vindas (opcional)</label>
                      <input type="text" placeholder="Ex: Olá! Vou te ajudar agora 😊" value={form.typebot_msg_boas_vindas || ""} onChange={e => setForm(p => ({ ...p, typebot_msg_boas_vindas: e.target.value }))} style={IS} />
                    </div>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>Mensagem quando resposta é inválida</label>
                      <input type="text" placeholder="Desculpe, não entendi sua resposta. Pode tentar de novo?" value={form.typebot_msg_invalida || ""} onChange={e => setForm(p => ({ ...p, typebot_msg_invalida: e.target.value }))} style={IS} />
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Mostrada quando o cliente manda algo que o bloco do Typebot não aceita.</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>{editandoId ? "3" : form.tipo === "waba" ? "5" : "4"}. Equipe & Fila / Departamento</p>

                {/* 👥 Seletor de EQUIPE — filtra quais filas aparecem abaixo. Vazio = todas. */}
                {equipes.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>👥 Equipe <span style={{ color: "#9ca3af", fontWeight: 400 }}>(afunila as filas)</span></label>
                    <select
                      value={form.equipeId}
                      onChange={e => {
                        const novaEquipe = e.target.value;
                        setForm(p => {
                          // Se a fila já escolhida não pertence à nova equipe, limpa a seleção de fila
                          const filaAtual = filasBanco.find(f => f.nome === p.fila);
                          const filaContinuaValida = !novaEquipe || (filaAtual && (filaAtual.equipe_id || "") === novaEquipe);
                          return { ...p, equipeId: novaEquipe, fila: filaContinuaValida ? p.fila : "" };
                        });
                      }}
                      style={IS}>
                      <option value="">👥 Todas as equipes</option>
                      {equipes.map(eq => (<option key={eq.id} value={eq.id}>👥 {eq.nome}</option>))}
                    </select>
                    <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Escolha a equipe e selecione abaixo qual fila (segmento) deste canal.</p>
                  </div>
                )}

                <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4, fontWeight: 600 }}>📋 Fila / Segmento</label>
                {filasBanco.length === 0 ? (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#92400e", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>Nenhuma fila cadastrada</p>
                      <p style={{ color: "#78350f", fontSize: 11, margin: 0 }}>Crie filas em <b>Configurações → Filas</b> antes de criar o canal.</p>
                    </div>
                    <button onClick={() => { setShowModalNovoCanal(false); router.push("/crm/configuracoes"); }} style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>Criar fila</button>
                  </div>
                ) : (
                  <>
                    <select value={form.fila} onChange={e => setForm(p => ({ ...p, fila: e.target.value }))} style={IS}>
                      <option value="">Selecione uma fila...</option>
                      {filasFiltradas.map(f => (<option key={f.id} value={f.nome}>📋 {f.nome}{f.conexao ? ` (${f.conexao})` : ""}</option>))}
                    </select>
                    {form.equipeId && filasFiltradas.length === 0 && (
                      <p style={{ color: "#dc2626", fontSize: 11, margin: "6px 0 0", lineHeight: 1.4 }}>⚠️ Essa equipe não tem nenhuma fila cadastrada. Crie uma fila pra ela em <b>Configurações → Filas</b> (ou escolha "Todas as equipes").</p>
                    )}
                  </>
                )}
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0 0" }}>Filas e equipes são gerenciadas em <b>Configurações → Filas</b> do CRM.</p>
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>{editandoId ? "4" : form.tipo === "waba" ? "6" : "5"}. Comportamento</p>
                <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e5e7eb" }}>
                  <div>
                    <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>🛑 Parar automação quando atendente assumir</p>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>A IA e o fluxo param automaticamente</p>
                  </div>
                  <Toggle value={form.pararSeAtendente} onChange={() => setForm(p => ({ ...p, pararSeAtendente: !p.pararSeAtendente }))} />
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 28px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={fecharModalNovoCanal} style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              {!editandoId && form.tipo === "meta_oauth" ? (
                <button onClick={fecharModalNovoCanal} style={{ background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>✅ Concluir</button>
              ) : (
                <button onClick={salvarCanal} disabled={salvandoCanal} style={{ background: salvandoCanal ? "#2563eb" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>{salvandoCanal ? "⏳ Salvando..." : editandoId ? "💾 Salvar" : "✅ Criar Canal"}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 8px 20px rgba(22,163,74,0.25)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>📱</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              Conexões {isSuperAdmin && <span style={{ fontSize: 12, color: "#f59e0b", marginLeft: 8 }}>👑 Administrador geral</span>}
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0" }}>
              {workspace?.nome || "Carregando..."} · {isSuperAdmin ? `${conexoes.length} canais (ilimitado)` : `${conexoes.length} de ${limites.conexoes} canais`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); setApiKeyTocada(false); setTokenTocado(false); fetchFluxos(); fetchFilas(); fetchEquipes(); }}
          disabled={limiteAtingido}
          style={{
            background: limiteAtingido ? "#e5e7eb" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            color: limiteAtingido ? "#9ca3af" : "white",
            border: "none", borderRadius: 12, padding: "12px 22px", fontSize: 13,
            cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: 700,
            boxShadow: limiteAtingido ? "none" : "0 4px 12px rgba(22,163,74,0.3)",
          }}>
          + Novo Canal {limiteAtingido && "(limite)"}
        </button>
      </div>

      {/* ═══ CARDS DE CONEXÕES ═══ */}
      {conexoes.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 16px", boxShadow: "0 12px 24px rgba(22,163,74,0.25)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>📱</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Nenhum canal conectado</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Crie seu primeiro canal pra começar</p>
          <button onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); setApiKeyTocada(false); setTokenTocado(false); fetchFluxos(); fetchFilas(); fetchEquipes(); }} style={{ background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>+ Novo Canal</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {conexoes.map(c => (
            <div key={c.id} style={{
              ...cardStyle,
              padding: 24,
              borderTop: `3px solid ${c.status === "conectado" ? "#16a34a" : "#ef4444"}`,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${c.status === "conectado" ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.08)"}`;  e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: c.tipo === "webjs" ? "#16a34a15" : c.tipo === "meta" ? "#e1306c15" : "#3b82f615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {c.tipo === "webjs" ? "📱" : c.tipo === "meta" ? "📲" : "🔗"}
                  </div>
                  <div>
                    <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>{c.nome}</p>
                    <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>
                      {c.tipo === "webjs" ? "WhatsApp Web" : c.tipo === "waba" ? "API Meta (WABA)" : c.tipo === "meta" ? "Facebook · Instagram" : c.tipo} · ID {c.id}
                    </p>
                  </div>
                </div>
                <span style={{
                  background: c.status === "conectado" ? "#f0fdf4" : "#fef2f2",
                  color: c.status === "conectado" ? "#16a34a" : "#dc2626",
                  border: `1px solid ${c.status === "conectado" ? "#bbf7d0" : "#fecaca"}`,
                  fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: 700
                }}>{c.status === "conectado" ? "🟢 Conectado" : "🔴 Desconectado"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Automação:</span><span style={{ color: modoColor[c.modo] || "#6b7280", fontSize: 12, fontWeight: 700 }}>{c.modo === "ia" ? `🤖 IA (${iaLabel[c.ia] || c.ia})` : c.modo === "fluxo" ? `🔀 ${c.fluxo_nome}` : c.modo === "typebot" ? `🎯 Typebot` : "🚫 Sem automação"}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Fila:</span><span style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600 }}>{c.fila || "—"}</span></div>
                {/* 👥 Equipe — derivada da fila do canal (a fila carrega o equipe_id) */}
                {(() => {
                  const eqId = filasBanco.find(f => f.nome === c.fila)?.equipe_id;
                  const eqNome = eqId ? equipes.find(e => e.id === eqId)?.nome : null;
                  if (!eqNome) return null;
                  return <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Equipe:</span><span style={{ color: "#a855f7", fontSize: 12, fontWeight: 600 }}>👥 {eqNome}</span></div>;
                })()}
                {c.numero && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Número:</span><span style={{ color: "#1f2937", fontSize: 12, fontWeight: 600 }}>{c.numero}</span></div>}
              </div>
              {c.tipo === "waba" && (
                <div style={{ marginBottom: 14 }}>
                  <PainelIntegridadeWaba
                    dados={integridadesWaba[c.id] || { ...normalizarIntegridadeWaba({ status: c.status, success: c.status === "conectado" }), carregando: true }}
                    onAtualizar={() => carregarIntegridadeWaba(c)}
                  />
                </div>
              )}
              {c.tipo === "webjs" && c.status === "conectado" && (
                <button
                  onClick={() => abrirRecuperacao(c)}
                  title="Recuperar somente mensagens ausentes em segundo plano"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 9, padding: "8px 10px", marginBottom: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <span aria-hidden="true">↻</span> Recuperar conversas
                </button>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                {c.tipo === "webjs" && (c.status === "desconectado"
                  ? <>
                      <button onClick={() => reconectarCanal(c)} title="Tenta reconectar SEM apagar o login" style={{ flex: 1, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: 9, fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>🔄 Reconectar</button>
                      <button onClick={() => abrirQR(c.id)} title="Apaga sessão salva e gera QR novo" style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>📷 QR</button>
                    </>
                  : <><button onClick={() => reconectarCanal(c)} title="Reconectar caso esteja com erro" style={{ flex: 1, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ Conectado · 🔄</button><button onClick={() => desconectarCanal(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Desconectar</button></>
                )}
                {c.tipo === "waba" && (c.status === "conectado"
                  ? <button disabled style={{ flex: 1, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 700 }}>🔗 API conectada</button>
                  : <button onClick={() => registrarNumeroWaba(c)} style={{ flex: 1, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: 9, fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>🟢 Ativar Número na Meta</button>
                )}
                {c.tipo === "meta" && (
                  <div style={{ flex: 1, display: "flex", gap: 6 }}>
                    <button onClick={() => toggleMetaFlag(c, "messenger_ativo")} title={c.messenger_ativo ? "Messenger ligado" : "Messenger desligado"}
                      style={{ flex: 1, background: c.messenger_ativo ? "#1877f2" : "#f9fafb", color: c.messenger_ativo ? "white" : "#6b7280", border: `1px solid ${c.messenger_ativo ? "#1877f2" : "#e5e7eb"}`, borderRadius: 10, padding: "9px 4px", fontSize: 13, cursor: "pointer", fontWeight: 700, textAlign: "center", opacity: c.messenger_ativo ? 1 : 0.6, transition: "all 0.15s" }}>
                      💬 Messenger
                    </button>
                    {c.instagram_business_id ? (
                      <button onClick={() => toggleMetaFlag(c, "instagram_ativo")} title={c.instagram_ativo ? "Instagram ligado" : "Instagram desligado"}
                        style={{ flex: 1, background: c.instagram_ativo ? "#e1306c" : "#f9fafb", color: c.instagram_ativo ? "white" : "#6b7280", border: `1px solid ${c.instagram_ativo ? "#e1306c" : "#e5e7eb"}`, borderRadius: 10, padding: "9px 4px", fontSize: 13, cursor: "pointer", fontWeight: 700, textAlign: "center", opacity: c.instagram_ativo ? 1 : 0.6, transition: "all 0.15s" }}>
                        📷 Instagram
                      </button>
                    ) : (
                      <div style={{ flex: 1, background: "#f9fafb", color: "#9ca3af", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 4px", fontSize: 11, fontStyle: "italic", textAlign: "center" }}>📷 sem IG</div>
                    )}
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowMenuEngrenagem(showMenuEngrenagem === c.id ? null : c.id)} disabled={encerrandoMassa || registrandoWaba}
                    style={{ background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 12px", fontSize: 14, cursor: (encerrandoMassa || registrandoWaba) ? "wait" : "pointer", transition: "all 0.15s" }}>
                    {(encerrandoMassa || registrandoWaba) ? "⏳" : "⚙️"}
                  </button>
                  {showMenuEngrenagem === c.id && (
                    <div style={{ position: "absolute", bottom: 44, right: 0, ...cardStyle, overflow: "hidden", zIndex: 100, minWidth: 240, padding: 4 }}>
                      <button onClick={() => abrirEditar(c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#1f2937", fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = "none"}>✏️ Editar Canal</button>
                      {c.tipo === "webjs" && c.status === "conectado" && <button onClick={() => abrirRecuperacao(c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#2563eb", fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 700, borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = "none"}>↻ Recuperar conversas</button>}
                      {c.tipo === "webjs" && <button onClick={() => reconectarCanal(c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#16a34a", fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 700, borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#f0fdf4"} onMouseLeave={e => e.currentTarget.style.background = "none"}>🔄 Reconectar (preserva login)</button>}
                      {c.tipo === "webjs" && <button onClick={() => { setShowMenuEngrenagem(null); abrirQR(c.id); }} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#1f2937", fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = "none"}>📷 Resetar e Escanear QR</button>}
                      {c.tipo === "waba" && <button onClick={() => registrarNumeroWaba(c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#16a34a", fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 700, borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#f0fdf4"} onMouseLeave={e => e.currentTarget.style.background = "none"}>🟢 Ativar Número na Meta</button>}
                      <button onClick={() => encerrarAtendimentosEmMassa("aguardando", c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#f59e0b", fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#fffbeb"} onMouseLeave={e => e.currentTarget.style.background = "none"}>⏳ Encerrar Aguardando</button>
                      <button onClick={() => encerrarAtendimentosEmMassa("abertos", c)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#3b82f6", fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = "none"}>💬 Encerrar Abertos</button>
                      <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />
                      <button onClick={() => excluirCanal(c.id)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#dc2626", fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"} onMouseLeave={e => e.currentTarget.style.background = "none"}>🗑️ Excluir Canal</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL DE RECUPERAÇÃO EM SEGUNDO PLANO ═══ */}
      {canalRecuperacao && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, width: "100%", maxWidth: 610, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 800, flexShrink: 0 }}>↻</div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ color: "#0f172a", fontSize: 17, fontWeight: 800, margin: 0 }}>Recuperar conversas</h2>
                  <p style={{ color: "#64748b", fontSize: 11.5, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{canalRecuperacao.nome} · WhatsApp Web</p>
                </div>
              </div>
              <button onClick={() => setCanalRecuperacao(null)} title="Fechar" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 9 }}>
                <p style={{ color: "#334155", fontSize: 12, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>Período a verificar</p>
                <span style={{ color: "#2563eb", fontSize: 10.5, fontWeight: 700 }}>Padrão: últimas 24 horas</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(68px, 1fr))", gap: 6, padding: 4, background: "#f1f5f9", borderRadius: 10 }}>
                {[
                  { valor: "1", label: "1h" },
                  { valor: "6", label: "6h" },
                  { valor: "12", label: "12h" },
                  { valor: "24", label: "24h" },
                  { valor: "72", label: "3 dias" },
                  { valor: "168", label: "7 dias" },
                  { valor: "personalizado", label: "Escolher" },
                ].map(periodo => {
                  const bloqueado = jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status);
                  return (
                    <button
                      key={periodo.valor}
                      onClick={() => setPeriodoRecuperacao(periodo.valor)}
                      disabled={!!bloqueado}
                      style={{ minWidth: 0, background: periodoRecuperacao === periodo.valor ? "#fff" : "transparent", color: periodoRecuperacao === periodo.valor ? "#1d4ed8" : "#64748b", border: periodoRecuperacao === periodo.valor ? "1px solid #bfdbfe" : "1px solid transparent", borderRadius: 7, padding: "8px 3px", fontSize: 11, fontWeight: 800, cursor: bloqueado ? "not-allowed" : "pointer", boxShadow: periodoRecuperacao === periodo.valor ? "0 1px 2px rgba(15,23,42,0.08)" : "none", opacity: bloqueado ? 0.7 : 1 }}
                    >{periodo.label}</button>
                  );
                })}
              </div>

              {periodoRecuperacao === "personalizado" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 12 }}>
                  <label style={{ color: "#475569", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>
                    Início
                    <input type="datetime-local" value={inicioRecuperacao} max={fimRecuperacao || dataParaInputLocal(new Date())} onChange={e => setInicioRecuperacao(e.target.value)} disabled={!!jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status)} style={{ ...IS, marginTop: 5 }} />
                  </label>
                  <label style={{ color: "#475569", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>
                    Fim
                    <input type="datetime-local" value={fimRecuperacao} min={inicioRecuperacao} max={dataParaInputLocal(new Date())} onChange={e => setFimRecuperacao(e.target.value)} disabled={!!jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status)} style={{ ...IS, marginTop: 5 }} />
                  </label>
                </div>
              )}

              <div style={{ marginTop: 14, padding: "11px 13px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 9, color: "#1e40af", fontSize: 11.5, lineHeight: 1.55 }}>
                O sistema compara o WhatsApp com o chatbot e importa somente o que estiver faltando. O trabalho roda uma conversa por vez, pode continuar com esta janela fechada e pausa quando chegam mensagens ao vivo.
              </div>

              {jobRecuperacao && (
                <div style={{ marginTop: 15, border: `1px solid ${jobRecuperacao.status === "erro" ? "#fecaca" : jobRecuperacao.status === "concluido" ? "#bbf7d0" : "#bfdbfe"}`, borderLeft: `4px solid ${jobRecuperacao.status === "erro" ? "#dc2626" : jobRecuperacao.status === "concluido" ? "#16a34a" : "#2563eb"}`, borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ padding: "11px 13px", background: jobRecuperacao.status === "erro" ? "#fef2f2" : jobRecuperacao.status === "concluido" ? "#f0fdf4" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong style={{ display: "block", color: "#0f172a", fontSize: 12.5 }}>
                        {jobRecuperacao.status === "aguardando" ? "Aguardando na fila" : jobRecuperacao.status === "processando" ? "Atualizando em segundo plano" : jobRecuperacao.status === "concluido" ? "Recuperação concluída" : "Recuperação interrompida"}
                      </strong>
                      <span style={{ color: "#64748b", fontSize: 10.5 }}>{jobRecuperacao.etapa}</span>
                    </div>
                    <strong style={{ color: jobRecuperacao.status === "erro" ? "#dc2626" : jobRecuperacao.status === "concluido" ? "#16a34a" : "#2563eb", fontSize: 14 }}>{jobRecuperacao.percentual}%</strong>
                  </div>
                  <div style={{ height: 5, background: "#e2e8f0" }}>
                    <div style={{ width: `${jobRecuperacao.percentual}%`, height: "100%", background: jobRecuperacao.status === "erro" ? "#dc2626" : jobRecuperacao.status === "concluido" ? "#16a34a" : "#2563eb", transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", padding: "12px 8px", background: "#fff" }}>
                    {[
                      { label: "Recuperadas", valor: jobRecuperacao.importadas, cor: "#16a34a" },
                      { label: "Recebidas", valor: jobRecuperacao.recebidas, cor: "#2563eb" },
                      { label: "Enviadas", valor: jobRecuperacao.enviadas, cor: "#7c3aed" },
                      { label: "Já existentes", valor: jobRecuperacao.duplicadas, cor: "#64748b" },
                      { label: "Falhas", valor: jobRecuperacao.falhas, cor: jobRecuperacao.falhas ? "#dc2626" : "#64748b" },
                    ].map(item => (
                      <div key={item.label} style={{ padding: "3px 7px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                        <strong style={{ display: "block", color: item.cor, fontSize: 17 }}>{item.valor.toLocaleString("pt-BR")}</strong>
                        <span style={{ color: "#64748b", fontSize: 9.5, fontWeight: 700 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  {jobRecuperacao.limitado && <p style={{ color: "#b45309", fontSize: 10.5, fontWeight: 700, margin: "0 13px 10px" }}>Muitas conversas foram encontradas. Use um período menor para verificar o restante com segurança.</p>}
                  {jobRecuperacao.erro && <p style={{ color: "#b91c1c", fontSize: 10.5, fontWeight: 700, margin: "0 13px 10px" }}>{jobRecuperacao.erro}</p>}
                  {!!jobRecuperacao.avisos?.length && !jobRecuperacao.erro && <p style={{ color: "#b45309", fontSize: 10.5, margin: "0 13px 10px" }}>{jobRecuperacao.avisos[0]}</p>}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setCanalRecuperacao(null)} style={{ background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px 15px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Fechar</button>
              <button
                onClick={iniciarRecuperacao}
                disabled={iniciandoRecuperacao || (!!jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status))}
                style={{ background: iniciandoRecuperacao || (!!jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status)) ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12, fontWeight: 800, cursor: iniciandoRecuperacao ? "wait" : "pointer", minWidth: 160 }}
              >
                {iniciandoRecuperacao ? "Iniciando..." : jobRecuperacao && ["aguardando", "processando"].includes(jobRecuperacao.status) ? "Em andamento" : jobRecuperacao ? "Verificar novamente" : "Recuperar agora"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL SELEÇÃO DE PAGES ═══ */}
      {showSelecaoPages && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", maxHeight: "85vh", overflow: "hidden" }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: 0 }}>📲 Escolha as páginas</h2>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>Marque as páginas do Facebook que deseja conectar. Cada página com uma conta comercial do Instagram criará dois canais: Messenger e Instagram.</p>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 28px", flex: 1 }}>
              {pagesDisponiveis.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 20 }}>Nenhuma página encontrada</p>
              ) : pagesDisponiveis.map((p: any) => {
                const selecionada = pagesSelecionadas.has(p.id);
                return (
                  <button key={p.id} onClick={() => togglePage(p.id)}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 12,
                      background: selecionada ? "#f0fdf4" : "#f9fafb",
                      border: `2px solid ${selecionada ? "#16a34a" : "#e5e7eb"}`,
                      borderRadius: 12, padding: "12px 14px", marginBottom: 10,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: selecionada ? "#16a34a" : "transparent", border: `2px solid ${selecionada ? "#16a34a" : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {selecionada && <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>
                        💬 Messenger
                        {p.instagram_username && <span> · 📷 @{p.instagram_username}</span>}
                        {!p.instagram_username && <span style={{ color: "#9ca3af" }}> · sem Instagram</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: "16px 28px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{pagesSelecionadas.size} de {pagesDisponiveis.length} selecionada(s)</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowSelecaoPages(false); setPagesSelecionadas(new Set()); }} disabled={conectandoMeta} style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: conectandoMeta ? "not-allowed" : "pointer", fontWeight: 600 }}>Cancelar</button>
                <button onClick={confirmarSelecaoPages} disabled={conectandoMeta || pagesSelecionadas.size === 0} style={{ background: conectandoMeta ? "#1d4ed8" : "#1877f2", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: (conectandoMeta || pagesSelecionadas.size === 0) ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(24,119,242,0.3)" }}>{conectandoMeta ? "⏳ Conectando..." : `📲 Conectar (${pagesSelecionadas.size})`}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
