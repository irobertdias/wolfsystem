"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos, ModuloBloqueado } from "../../hooks/useModulos";
import { traduzirErro } from "../../lib/traduzir_erro";

type Canal = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  waba_id?: string;
  phone_number_id?: string | null;
  numero?: string | null;
  workspace_id?: string | null;
  limite24h?: string | number | null;
  limite_24h?: string | number | null;
  limite_meta?: string | number | null;
  limite_mensagens?: string | number | null;
  messaging_limit?: string | number | null;
  messaging_limit_tier?: string | null;
  limite_tier?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};
type Template = {
  id: number; canal_id: number; meta_template_name: string; nome_amigavel: string;
  categoria: string; idioma: string; status: string; componentes: any[];
  meta_template_id?: string | null;
  motivo_rejeicao?: string | null;
  rejected_reason?: string | null;
  ultima_sincronizacao?: string | null;
  aprovado_em?: string | null;
  enviado_meta_em?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  correct_category?: string | null;
  categoria_meta?: string | null;
};
type Disparo = {
  id: number; workspace_id: string; canal_id: number; criado_por: string; nome: string;
  mensagem: string; delay_min_seg: number; delay_max_seg: number; status: string;
  total_contatos: number; total_enviados: number; total_falhas: number;
  pausado_motivo?: string; erro_msg?: string;
  tipo?: string; template_name?: string;
  iniciado_em?: string; finalizado_em?: string; created_at: string;
  // 🗓️ Agendamento (timestamp em UTC). Se preenchido e no futuro, o worker
  // ignora o disparo até a hora marcada. Ver migration-disparos-agendamento.sql.
  agendado_para?: string;
};
type ContatoWaba = { numero: string; vars: Record<string, string>; };
type QualidadeApi = "Alta" | "Média" | "Baixa" | "Desconhecida";
type IntegridadeApi = {
  loading: boolean;
  atualizadoEm: string | null;
  erro: string | null;
  score: number;
  saudeInterna: number;
  statusMeta: string;
  nomeMeta: string;
  numero: string;
  qualidade: QualidadeApi;
  limite24h: number;
  limite1h: number;
  limiteTier: string;
  limiteFonte: string;
  metricasFonte: string;
  metricasDescricao: string;
  enviados24h: number;
  enviados1h: number;
  falhas24h: number;
  templatesAprovados: number;
  templatesPendentes: number;
  templatesRejeitados: number;
  alertas: string[];
  recomendacao: string;
};

const integridadeInicial: IntegridadeApi = {
  loading: false,
  atualizadoEm: null,
  erro: null,
  score: 0,
  saudeInterna: 0,
  statusMeta: "nao_verificado",
  nomeMeta: "",
  numero: "",
  qualidade: "Desconhecida",
  limite24h: 0,
  limite1h: 0,
  limiteTier: "",
  limiteFonte: "",
  metricasFonte: "",
  metricasDescricao: "",
  enviados24h: 0,
  enviados1h: 0,
  falhas24h: 0,
  templatesAprovados: 0,
  templatesPendentes: 0,
  templatesRejeitados: 0,
  alertas: [],
  recomendacao: "Selecione um canal da API oficial para medir a integridade.",
};

// 🗓️ Helpers de agendamento
// Retorna "YYYY-MM-DDTHH:MM" pra <input type="datetime-local"> em hora LOCAL.
const formatarDatetimeLocal = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
// Default sugerido quando ligam o agendamento: amanhã 00:00 (era o exemplo do user).
const proxAmanhaMidnight = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return formatarDatetimeLocal(d);
};
// "agora" formatado pra o atributo `min` do input (não deixa escolher passado).
const agoraDatetimeLocal = (): string => formatarDatetimeLocal(new Date());

export default function DisparosPage() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, perfil, permissoes } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const [tipoDisparo, setTipoDisparo] = useState<"webjs" | "waba">("webjs");
  const [canais, setCanais] = useState<Canal[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [disparos, setDisparos] = useState<Disparo[]>([]);

  const [canalSelecionado, setCanalSelecionado] = useState<number | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [numerosTexto, setNumerosTexto] = useState("");

  const [varsFixas, setVarsFixas] = useState<Record<string, string>>({});
  const [contatosWaba, setContatosWaba] = useState<ContatoWaba[]>([]);

  const [delayMin, setDelayMin] = useState(60);
  const [delayMax, setDelayMax] = useState(120);
  const [enviando, setEnviando] = useState(false);
  const [disparoDetalhe, setDisparoDetalhe] = useState<Disparo | null>(null);
  const [contatosDetalhe, setContatosDetalhe] = useState<any[]>([]);
  const [integridadeApi, setIntegridadeApi] = useState<IntegridadeApi>(integridadeInicial);
  const [atualizandoIntegridade, setAtualizandoIntegridade] = useState(false);
  const [atualizandoTemplateMeta, setAtualizandoTemplateMeta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🗓️ Estado do agendamento
  // agendarAtivo = checkbox "agendar pra mais tarde". agendarPara = string datetime-local.
  const [agendarAtivo, setAgendarAtivo] = useState(false);
  const [agendarPara, setAgendarPara] = useState("");

  // 🆕 FIX PERMISSÃO:
  // Antes: `isDono || permissoes.supervisor` → "supervisor" não existe no tipo Permissoes, SEMPRE bloqueava.
  // Agora: respeita a permissão granular `disparo_enviar` OU perfil Administrador OU dono do workspace.
  //        Também aceita `templates_waba` como sinal indireto (quem gerencia templates geralmente dispara).
  const podeDisparar =
    isDono
    || perfil === "Administrador"
    || !!(permissoes && (permissoes as any).disparo_enviar)
    || !!(permissoes && (permissoes as any).templates_waba);
  const workspaceIds = Array.from(new Set(
    [wsId, workspace?.username, workspace?.id ? String(workspace.id) : null]
      .filter(Boolean)
      .map(String)
  ));
  const workspaceKey = workspaceIds.join("|");

  useEffect(() => {
    if (tipoDisparo === "waba") {
      setDelayMin(1); setDelayMax(3);
    } else {
      setDelayMin(60); setDelayMax(120);
    }
    setCanalSelecionado(null);
    setTemplateSelecionado(null);
    setVarsFixas({});
    setContatosWaba([]);
    setNumerosTexto("");
    setIntegridadeApi(integridadeInicial);
  }, [tipoDisparo]);

  // 🗓️ Quando liga o agendamento e ainda não definiu horário, preenche "amanhã 00:00"
  useEffect(() => {
    if (agendarAtivo && !agendarPara) setAgendarPara(proxAmanhaMidnight());
  }, [agendarAtivo, agendarPara]);

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const fetchCanais = async () => {
    if (workspaceIds.length === 0) return;
    const { data } = await supabase.from("conexoes")
      .select("*")
      .in("workspace_id", workspaceIds)
      .order("created_at", { ascending: false });

    const lista = data || [];
    const filtrados = lista.filter((c: Canal) => {
      const tipo = String(c.tipo || "").toLowerCase();
      if (tipoDisparo === "webjs") return tipo === "webjs";
      return tipo === "waba";
    });

    setCanais(filtrados);
  };

  const sincronizarTemplatesMeta = async (canalId: number, workspaceIdDoCanal: string) => {
    const body = { canalId, workspaceId: workspaceIdDoCanal };
    try {
      const resp = await fetch("https://api.wolfgyn.com.br/templates/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = await resp.json();
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Falha ao sincronizar templates");
      return json;
    } catch (_erroDireto) {
      return wa("templates/sincronizar", body);
    }
  };

  const verificarTemplateMeta = async (templateId: number, workspaceIdDoCanal: string) => {
    const qs = `templateId=${templateId}&workspaceId=${encodeURIComponent(workspaceIdDoCanal)}`;
    try {
      const resp = await fetch(`https://api.wolfgyn.com.br/templates/verificar-status?${qs}`, { cache: "no-store" });
      const json = await resp.json();
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Falha ao consultar template na Meta");
      return json;
    } catch (_erroDireto) {
      const resp = await fetch(`/api/whatsapp?rota=templates/verificar-status&${qs}`, { cache: "no-store" });
      const json = await resp.json();
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Falha ao consultar template na Meta");
      return json;
    }
  };

  const fetchTemplatesAprovados = async () => {
    if (workspaceIds.length === 0 || !canalSelecionado) { setTemplates([]); return; }
    const canalIdConsultado = canalSelecionado;
    const canalAtual = canais.find(c => c.id === canalIdConsultado);
    const workspaceDoCanal = canalAtual?.workspace_id || wsId || workspaceIds[0];
    try {
      await sincronizarTemplatesMeta(canalIdConsultado, workspaceDoCanal);
    } catch (e) {
      console.warn("Nao foi possivel sincronizar templates na Meta:", e);
    }
    const { data } = await supabase.from("templates_waba")
      .select("*").in("workspace_id", workspaceIds).eq("canal_id", canalIdConsultado).eq("status", "aprovado")
      .order("created_at", { ascending: false });
    if (canalSelecionado === canalIdConsultado) setTemplates(data || []);
  };

  const fetchDisparos = async () => {
    if (workspaceIds.length === 0) return;
    const { data } = await supabase.from("disparos").select("*").in("workspace_id", workspaceIds).order("created_at", { ascending: false }).limit(50);
    setDisparos(data || []);
  };

  useEffect(() => {
    if (workspaceIds.length === 0) return;
    fetchCanais();
    fetchDisparos();
    const ch = supabase.channel("disparos_rt_" + workspaceKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "disparos" }, () => fetchDisparos())
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes" }, () => fetchCanais())
      .subscribe();
    const interval = setInterval(() => { fetchDisparos(); fetchCanais(); }, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [workspaceKey, tipoDisparo]);

  useEffect(() => { fetchTemplatesAprovados(); }, [canalSelecionado, workspaceKey]);

  useEffect(() => {
    if (!templateSelecionado || !canalSelecionado) return;
    const templateIdConsultado = templateSelecionado;
    const canalAtual = canais.find(c => c.id === canalSelecionado);
    const workspaceDoCanal = canalAtual?.workspace_id || wsId || workspaceIds[0];
    let ativo = true;

    setAtualizandoTemplateMeta(true);
    verificarTemplateMeta(templateIdConsultado, workspaceDoCanal)
      .then(resp => {
        if (!ativo || !resp?.template) return;
        const statusAtual = String(resp.template.status || "").toLowerCase();
        setTemplates(atuais => statusAtual === "aprovado"
          ? atuais.map(t => t.id === templateIdConsultado ? { ...t, ...resp.template } : t)
          : atuais.filter(t => t.id !== templateIdConsultado));
        if (statusAtual !== "aprovado") setTemplateSelecionado(null);
      })
      .catch(e => console.warn("Falha ao atualizar template selecionado na Meta:", e))
      .finally(() => { if (ativo) setAtualizandoTemplateMeta(false); });

    return () => { ativo = false; };
  }, [templateSelecionado, canalSelecionado, workspaceKey]);

  useEffect(() => {
    if (tipoDisparo !== "waba" || workspaceIds.length === 0 || !canalSelecionado) {
      setIntegridadeApi(integridadeInicial);
      return;
    }

    fetchIntegridadeApi();
    const interval = setInterval(() => fetchIntegridadeApi(), 10000);
    return () => clearInterval(interval);
  }, [tipoDisparo, workspaceKey, canalSelecionado, canais.length, disparos.length]);

  useEffect(() => {
    if (!disparoDetalhe) return;
    const fetchContatos = async () => {
      const { data } = await supabase.from("disparo_contatos").select("*").eq("disparo_id", disparoDetalhe.id).order("id");
      setContatosDetalhe(data || []);
    };
    fetchContatos();
    const i = setInterval(fetchContatos, 3000);
    return () => clearInterval(i);
  }, [disparoDetalhe?.id]);

  const processarNumeros = (texto: string): string[] => {
    return texto
      .split(/[\n,;]+/)
      .map(n => n.replace(/\D/g, ""))
      .filter(n => n.length >= 10 && n.length <= 15);
  };

  const extrairVariaveisTemplate = (): string[] => {
    const tpl = templates.find(t => t.id === templateSelecionado);
    if (!tpl) return [];
    const vars = new Set<string>();
    for (const comp of tpl.componentes || []) {
      if ((comp.type === "BODY" && comp.text) || (comp.type === "HEADER" && comp.format === "TEXT" && comp.text)) {
        const matches = comp.text.matchAll(/\{\{(\d+)\}\}/g);
        for (const m of matches) vars.add(m[1]);
      }
    }
    return Array.from(vars).sort((a, b) => parseInt(a) - parseInt(b));
  };

  // 🗓️ Valida e converte agendarPara pra ISO (UTC) — ou null se desligado.
  // Retorna { ok, iso, erro } pra os handlers tratarem antes do confirm.
  const resolverAgendamento = (): { ok: boolean; iso: string | null; erro?: string } => {
    if (!agendarAtivo) return { ok: true, iso: null };
    if (!agendarPara) return { ok: false, iso: null, erro: "Defina a data e hora do agendamento." };
    const dt = new Date(agendarPara); // datetime-local é interpretado em hora LOCAL
    if (isNaN(dt.getTime())) return { ok: false, iso: null, erro: "Data/hora inválida." };
    if (dt.getTime() <= Date.now() + 30_000) return { ok: false, iso: null, erro: "O agendamento precisa ser pelo menos 30s no futuro." };
    return { ok: true, iso: dt.toISOString() };
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      const linhas = txt.split(/[\r\n]+/).filter(l => l.trim());

      if (tipoDisparo === "webjs") {
        const numeros = linhas
          .map(l => l.split(/[,;]/)[0])
          .map(n => n.replace(/\D/g, ""))
          .filter(n => n.length >= 10 && n.length <= 15);
        setNumerosTexto(numeros.join("\n"));
        alert(`✅ ${numeros.length} número(s) importado(s)`);
      } else {
        const varsTemplate = extrairVariaveisTemplate();
        const contatos: ContatoWaba[] = [];
        for (const linha of linhas) {
          const cols = linha.split(/[,;]/).map(c => c.trim());
          const numero = cols[0]?.replace(/\D/g, "") || "";
          if (numero.length < 10 || numero.length > 15) continue;
          const vars: Record<string, string> = {};
          varsTemplate.forEach((varNum, idx) => {
            if (cols[idx + 1] !== undefined) vars[varNum] = cols[idx + 1];
          });
          contatos.push({ numero, vars });
        }
        setContatosWaba(contatos);
        alert(`✅ ${contatos.length} contato(s) importado(s) com ${varsTemplate.length} variável(is) por linha`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const montarContatosWabaDoTexto = (): ContatoWaba[] => {
    const numeros = processarNumeros(numerosTexto);
    return numeros.map(n => ({ numero: n, vars: {} }));
  };

  const iniciarDisparoWebjs = async () => {
    const numeros = processarNumeros(numerosTexto);
    if (!canalSelecionado) return alert("Selecione um canal!");
    if (!mensagem.trim()) return alert("Digite a mensagem!");
    if (numeros.length === 0) return alert("Nenhum número válido!");
    if (numeros.length > 1000) return alert("Máximo 1000 números por disparo!");
    if (delayMin < 30) return alert("O intervalo mínimo deve ser de pelo menos 30 segundos");
    if (delayMin > delayMax) return alert("O intervalo mínimo não pode ser maior que o máximo");

    // 🗓️ valida agendamento (se ativo)
    const ag = resolverAgendamento();
    if (!ag.ok) return alert("⚠️ " + ag.erro);

    const avisoDelay = delayMin < 60 ? `\n\n⚠️ ATENÇÃO: intervalo abaixo de 60 segundos aumenta MUITO o risco de banimento!` : "";
    const tempoEstimadoMin = Math.ceil((numeros.length * (delayMin + delayMax) / 2) / 60);
    const linhaAgenda = ag.iso ? `\n🗓️ Agendado pra: ${new Date(ag.iso).toLocaleString("pt-BR")}` : "";
    if (!confirm(`Iniciar disparo pelo WhatsApp Web?\n\n📱 Números: ${numeros.length}\n⏱️ Intervalo: ${delayMin}-${delayMax}s\n⏳ Estimado: ~${tempoEstimadoMin}min${linhaAgenda}${avisoDelay}`)) return;

    setEnviando(true);
    try {
      const resp = await wa("disparos/criar", {
        workspaceId: wsId, canalId: canalSelecionado, criadoPor: user?.email,
        nome: nome || null, mensagem, numeros,
        delayMinSeg: delayMin, delayMaxSeg: delayMax,
        // 🗓️ Backend deve salvar em disparos.agendado_para. Se preenchido e
        // no futuro, o worker NÃO inicia até o horário chegar.
        agendarPara: ag.iso,
      });
      if (resp.success) {
        const msgOk = ag.iso
          ? `✅ Disparo agendado!\n\n${resp.totalContatos} números na fila.\n🗓️ Vai começar em: ${new Date(ag.iso).toLocaleString("pt-BR")}`
          : `✅ Disparo iniciado!\n\n${resp.totalContatos} números na fila.`;
        alert(msgOk);
        setMensagem(""); setNumerosTexto(""); setNome("");
        setAgendarAtivo(false); setAgendarPara("");
        fetchDisparos();
      } else alert("❌ Erro: " + (resp.error || "desconhecido"));
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEnviando(false);
  };

  const iniciarDisparoWaba = async () => {
    if (!canalSelecionado) return alert("Selecione um canal da API oficial!");
    if (!templateSelecionado) return alert("Selecione um modelo aprovado!");

    const contatosFinal = contatosWaba.length > 0 ? contatosWaba : montarContatosWabaDoTexto();
    if (contatosFinal.length === 0) return alert("Adicione pelo menos 1 contato!");
    if (contatosFinal.length > 5000) return alert("O máximo é de 5.000 contatos por disparo pela API oficial");

    const varsTemplate = extrairVariaveisTemplate();
    const varsSemValor: string[] = [];
    for (const v of varsTemplate) {
      const temValorFixo = varsFixas[v] && varsFixas[v].trim();
      const algumContatoSemValor = contatosFinal.some(c => !c.vars[v] && !temValorFixo);
      if (algumContatoSemValor && !temValorFixo) varsSemValor.push(v);
    }
    if (varsSemValor.length > 0) {
      if (!confirm(`⚠️ As variáveis {{${varsSemValor.join("}}, {{")}}} não têm valor definido.\n\nElas serão enviadas LITERALMENTE ({{1}}, etc) se não tiverem valor. Continuar mesmo assim?`)) return;
    }

    // 🗓️ valida agendamento (se ativo)
    const ag = resolverAgendamento();
    if (!ag.ok) return alert("⚠️ " + ag.erro);

    const linhaAgenda = ag.iso ? `\n🗓️ Agendado pra: ${new Date(ag.iso).toLocaleString("pt-BR")}` : "";
    if (!confirm(`Iniciar disparo pela API oficial?\n\n📱 Contatos: ${contatosFinal.length}\n📋 Modelo: ${templates.find(t => t.id === templateSelecionado)?.nome_amigavel}\n⏱️ Intervalo: ${delayMin}-${delayMax}s${linhaAgenda}`)) return;

    setEnviando(true);
    try {
      const resp = await wa("disparos/criar-waba", {
        workspaceId: wsId, canalId: canalSelecionado, criadoPor: user?.email,
        nome: nome || null,
        templateId: templateSelecionado,
        varsFixas,
        contatos: contatosFinal,
        delayMinSeg: delayMin, delayMaxSeg: delayMax,
        // 🗓️ Mesmo padrão: backend salva em disparos.agendado_para e adia o worker.
        agendarPara: ag.iso,
      });
      if (resp.success) {
        const msgOk = ag.iso
          ? `✅ Disparo pela API oficial agendado!\n\n${resp.totalContatos} contatos na fila.\n🗓️ Vai começar em: ${new Date(ag.iso).toLocaleString("pt-BR")}`
          : `✅ Disparo pela API oficial iniciado!\n\n${resp.totalContatos} contatos na fila.`;
        alert(msgOk);
        setNome(""); setVarsFixas({}); setContatosWaba([]); setNumerosTexto("");
        setAgendarAtivo(false); setAgendarPara("");
        fetchDisparos();
      } else alert("❌ Erro: " + (resp.error || "desconhecido"));
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEnviando(false);
  };

  const iniciarDisparo = () => {
    if (tipoDisparo === "webjs") iniciarDisparoWebjs();
    else iniciarDisparoWaba();
  };

  const pausarDisparo = async (id: number) => { await wa("disparos/pausar", { disparoId: id, workspaceId: wsId }); fetchDisparos(); };
  const retomarDisparo = async (id: number) => { await wa("disparos/retomar", { disparoId: id, workspaceId: wsId }); fetchDisparos(); };
  const cancelarDisparo = async (id: number) => {
    if (!confirm("Cancelar esse disparo?")) return;
    await wa("disparos/cancelar", { disparoId: id, workspaceId: wsId });
    fetchDisparos();
  };

  const numerosValidos = tipoDisparo === "webjs"
    ? processarNumeros(numerosTexto)
    : (contatosWaba.length > 0 ? contatosWaba.map(c => c.numero) : processarNumeros(numerosTexto));
  const canalEscolhido = canais.find(c => c.id === canalSelecionado);
  const canalConectado = ["conectado", "connected", "registered", "ativo", "online", "ready"].some(v => String(canalEscolhido?.status || "").toLowerCase().includes(v));
  const templateEscolhido = templates.find(t => t.id === templateSelecionado);
  const varsTemplate = extrairVariaveisTemplate();

  const statusColor: Record<string, string> = {
    pendente: "#f59e0b", rodando: "#3b82f6", pausado: "#f59e0b",
    concluido: "#16a34a", cancelado: "#6b7280", erro: "#dc2626",
    // 🗓️ Novo status visual pra disparo aguardando o horário marcado
    agendado: "#8b5cf6"
  };
  const statusLabel: Record<string, string> = {
    pendente: "⏳ Pendente", rodando: "🚀 Enviando", pausado: "⏸️ Pausado",
    concluido: "✅ Concluído", cancelado: "🛑 Cancelado", erro: "❌ Erro",
    agendado: "🗓️ Agendado"
  };

  // 🗓️ Status "efetivo" pra exibição: se a linha tá pendente E tem agendado_para
  // no futuro, mostramos como "agendado" (mesmo que o backend ainda use "pendente").
  // Assim o user vê "🗓️ Agendado" no histórico mesmo com backend antigo.
  const statusEfetivo = (d: Disparo): string => {
    if (d.agendado_para && d.status === "pendente" && new Date(d.agendado_para).getTime() > Date.now()) return "agendado";
    return d.status;
  };

  const normalizarStatusCanal = (status?: string | null) => {
    const s = String(status || "").toLowerCase();
    return ["conectado", "connected", "registered", "ativo", "online", "ready"].some(v => s.includes(v));
  };

  const normalizarQualidade = (valor: any, falhas24h = 0, enviados24h = 0): QualidadeApi => {
    const q = String(valor || "").toLowerCase();
    if (["green", "alta", "high"].some(v => q.includes(v))) return "Alta";
    if (["yellow", "media", "média", "medium"].some(v => q.includes(v))) return "Média";
    if (["red", "baixa", "low"].some(v => q.includes(v))) return "Baixa";
    return "Desconhecida";
  };

  const resolverLimiteMeta = (...valores: any[]) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined || valor === "") continue;
      const n = Number(valor);
      if (Number.isFinite(n) && n > 0) return n;
      const texto = String(valor).toUpperCase();
      if (texto.includes("UNLIMITED")) return 0;
      const mil = texto.match(/(\d+(?:[.,]\d+)?)\s*K/);
      if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000);
      const numero = texto.match(/(\d+)/);
      if (numero) return Number(numero[1]);
    }
    return 0;
  };

  const traduzirCategoriaTemplate = (categoria?: string | null) => {
    const chave = String(categoria || "").toUpperCase();
    const nomes: Record<string, string> = {
      MARKETING: "Marketing",
      UTILITY: "Utilidade",
      AUTHENTICATION: "Autenticação",
    };
    return nomes[chave] || categoria || "Sem categoria";
  };

  const formatarTierMeta = (tier?: string | null) => {
    const limite = resolverLimiteMeta(tier);
    if (!tier) return "";
    if (String(tier).toUpperCase().includes("UNLIMITED")) return "sem limite definido";
    return limite ? `${limite.toLocaleString("pt-BR")} contatos em 24h` : "limite informado pela Meta";
  };

  const traduzirFonteLimite = (fonte?: string | null) => {
    if (!fonte) return "Meta não retornou";
    if (fonte.startsWith("meta.")) return "Meta, em tempo real";
    if (fonte.startsWith("banco.")) return "última leitura salva";
    return "Meta";
  };

  const traduzirFonteMetricas = (fonte?: string | null) => {
    if (fonte === "supabase.mensagens") return "registros reais do canal";
    if (fonte === "indisponivel") return "temporariamente indisponíveis";
    return fonte ? "registros do sistema" : "indisponíveis";
  };

  const pct = (valor: number, total: number) => total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;

  const montarRecomendacao = (alertas: string[], podeDispararAgora: boolean) => {
    if (!podeDispararAgora) return "Recomendacao: bloqueie novos disparos ate reconectar o canal e corrigir os erros acima.";
    if (alertas.length === 0) return "Recomendacao: canal saudavel. Pode disparar mantendo o ritmo normal.";
    return "Recomendacao: disparos permitidos, mas mantenha ritmo conservador e corrija os alertas antes de escalar volume.";
  };

  const consultarStatusWabaReal = async (canalId: number, workspaceIdDoCanal: string) => {
    const qs = `canalId=${canalId}&workspaceId=${encodeURIComponent(workspaceIdDoCanal)}`;
    try {
      const resp = await fetch(`https://api.wolfgyn.com.br/waba/verificar-status?${qs}`, { cache: "no-store" });
      return await resp.json();
    } catch (e) {
      const resp = await fetch(`/api/whatsapp?rota=waba/verificar-status&${qs}`, { cache: "no-store" });
      return await resp.json();
    }
  };

  const fetchIntegridadeApi = async (_manual = false) => {
    if (tipoDisparo !== "waba" || workspaceIds.length === 0 || !canalSelecionado) {
      setIntegridadeApi(integridadeInicial);
      return;
    }

    const canalAtual = canais.find(c => c.id === canalSelecionado);
    const workspaceDoCanal = canalAtual?.workspace_id || wsId || workspaceIds[0];
    setAtualizandoIntegridade(true);
    setIntegridadeApi(prev => ({ ...prev, loading: true }));

    try {
      if (_manual) {
        await fetchTemplatesAprovados();
      }

      const [statusResp, templatesResp] = await Promise.all([
        consultarStatusWabaReal(canalSelecionado, workspaceDoCanal),
        supabase.from("templates_waba")
          .select("status")
          .eq("workspace_id", workspaceDoCanal)
          .eq("canal_id", canalSelecionado)
      ]);

      const enviados24h = Math.max(0, Number(statusResp?.enviados24h || 0));
      const enviados1h = Math.max(0, Number(statusResp?.enviados1h || 0));
      const falhas24h = Math.max(0, Number(statusResp?.falhas24h || 0));
      const templatesTodos = templatesResp.data || [];
      const templatesAprovados = templatesTodos.filter((t: any) => ["aprovado", "approved"].includes(String(t.status || "").toLowerCase())).length;
      const templatesPendentes = templatesTodos.filter((t: any) => ["pendente", "pending", "em_analise", "in_review"].includes(String(t.status || "").toLowerCase())).length;
      const templatesRejeitados = templatesTodos.filter((t: any) => ["rejeitado", "rejected", "recusado"].includes(String(t.status || "").toLowerCase())).length;

      const statusConectadoApi = normalizarStatusCanal(statusResp?.status || statusResp?.meta_status);
      const statusConectadoBanco = normalizarStatusCanal(canalAtual?.status);
      const conectado = statusResp?.success ? statusConectadoApi : statusConectadoBanco;
      const qualidade = normalizarQualidade(statusResp?.quality_rating || statusResp?.qualidade || statusResp?.quality, falhas24h, enviados24h);
      const limiteTier = statusResp?.whatsapp_business_manager_messaging_limit || statusResp?.messaging_limit_tier || statusResp?.tier || statusResp?.limite_tier || "";
      const limite24h = resolverLimiteMeta(
        statusResp?.limite24h,
        statusResp?.whatsapp_business_manager_messaging_limit,
        limiteTier
      );
      const limite1h = Math.max(0, Number(statusResp?.limite1h || statusResp?.hourly_limit || 0));
      const uso24h = pct(enviados24h, limite24h);
      const uso1h = pct(enviados1h, limite1h);
      const totalTentativas = enviados24h + falhas24h;
      const taxaFalha = totalTentativas > 0 ? falhas24h / totalTentativas : 0;

      const alertas: string[] = [];
      if (!conectado) alertas.push("O canal da API oficial não está conectado ou a Meta não confirmou a conexão.");
      if (statusResp?.error) alertas.push(`A Meta retornou um erro: ${traduzirErro({ ...statusResp, code: statusResp?.error_code })}`);
      if (!limite24h) alertas.push("A Meta nao devolveu o limite do portfolio para este token/canal.");
      else if (uso24h >= 90) alertas.push(`Uso das ultimas 24h elevado (${uso24h}% do limite Meta).`);
      else if (uso24h >= 75) alertas.push(`Uso das ultimas 24h em atencao (${uso24h}% do limite Meta).`);
      if (limite1h > 0 && uso1h >= 80) alertas.push(`Muitos envios na ultima hora (${enviados1h}/${limite1h}).`);
      if (falhas24h > 0) alertas.push(`${falhas24h} falha(s) de envio nas ultimas 24h.`);
      if (templatesAprovados === 0) alertas.push("Nenhum modelo aprovado para este canal.");
      if (templatesRejeitados > 0) alertas.push(`${templatesRejeitados} modelo(s) rejeitado(s) precisam de ajuste.`);

      let score = conectado ? 100 : 0;
      if (qualidade === "Média") score -= 15;
      if (qualidade === "Baixa") score -= 35;
      if (qualidade === "Desconhecida") score -= 5;
      score -= Math.min(40, Math.round(taxaFalha * 100));
      if (statusResp?.error || statusResp?.metricas_fonte === "indisponivel") score = Math.min(score, 40);
      score = Math.max(0, Math.min(100, Math.round(score)));
      const saudeInterna = score;

      const podeDispararAgora = conectado && templatesAprovados > 0;

      setIntegridadeApi({
        loading: false,
        atualizadoEm: new Date().toISOString(),
        erro: null,
        score,
        saudeInterna,
        statusMeta: statusResp?.meta_status || statusResp?.status || canalAtual?.status || "desconhecido",
        nomeMeta: statusResp?.nome || statusResp?.verified_name || canalAtual?.nome || "",
        numero: statusResp?.numero || canalAtual?.numero || canalAtual?.phone_number_id || "",
        qualidade,
        limite24h,
        limite1h,
        limiteTier,
        limiteFonte: statusResp?.limite_fonte || "",
        metricasFonte: statusResp?.metricas_fonte || "",
        metricasDescricao: statusResp?.metricas_descricao || "",
        enviados24h,
        enviados1h,
        falhas24h,
        templatesAprovados,
        templatesPendentes,
        templatesRejeitados,
        alertas,
        recomendacao: montarRecomendacao(alertas, podeDispararAgora),
      });
    } catch (e: any) {
      setIntegridadeApi(prev => ({
        ...prev,
        loading: false,
        erro: e?.message || "Erro ao calcular integridade da API.",
        atualizadoEm: new Date().toISOString(),
        alertas: [`Falha ao atualizar integridade: ${e?.message || "erro desconhecido"}`],
        recomendacao: "Recomendação: confira o banco de dados, o serviço da API oficial e as credenciais do canal antes de disparar.",
      }));
    } finally {
      setAtualizandoIntegridade(false);
    }
  };

  // 🎨 ESTILOS LIGHT TECH
  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const corScore = integridadeApi.score >= 85 ? "#059669" : integridadeApi.score >= 60 ? "#f59e0b" : "#dc2626";
  const corQualidade = integridadeApi.qualidade === "Alta" ? "#059669" : integridadeApi.qualidade === "Média" ? "#f59e0b" : integridadeApi.qualidade === "Baixa" ? "#dc2626" : "#64748b";
  const podeDispararApi = tipoDisparo !== "waba" || (canalConectado && integridadeApi.score >= 50 && integridadeApi.templatesAprovados > 0);
  const barraIntegridade = (label: string, valor: number, total: number, cor: string, detalhe: string) => {
    const largura = pct(valor, total);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>{label}</span>
          <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 800 }}>{detalhe}</span>
        </div>
        <div style={{ height: 10, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${largura}%`, height: "100%", background: cor, borderRadius: 999, transition: "width 0.25s ease" }} />
        </div>
      </div>
    );
  };

  // 🔒 Bloqueio de módulo (plano) — tem prioridade sobre permissão de usuário
  if (modulosCarregados && !modulos.disparos_web && !modulos.disparos_api) {
    return <ModuloBloqueado modulo="disparos_web" />;
  }

  // Acesso restrito por permissão de usuário (dentro do workspace)
  if (!podeDisparar) {
    return (
      <div style={{ padding: 32, minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Acesso Restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 8px" }}>Seu usuário não tem permissão para disparos em massa.</p>
          <p style={{ color: "#9ca3af", fontSize: 12, margin: 0, lineHeight: 1.5 }}>Peça ao administrador do workspace pra marcar "Enviar disparos em massa" no seu grupo de permissão.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#f8fafc", minHeight: "100vh" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/chatbot")}
          style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 14px", color: "#4b5563", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          ← Voltar ao Chatbot
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(245,158,11,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>📢</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Disparos em Massa</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0", maxWidth: 720, lineHeight: 1.5 }}>
              Envie mensagens em lote pelo WhatsApp Web ou pela API oficial da Meta com um modelo aprovado.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ TOGGLE TIPO ═══ */}
      <div style={{ ...cardStyle, padding: 18 }}>
        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Tipo de disparo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={() => setTipoDisparo("webjs")}
            disabled={!modulos.disparos_web}
            title={!modulos.disparos_web ? "Disparos pelo WhatsApp Web não estão no seu plano" : ""}
            style={{
              background: tipoDisparo === "webjs" ? "#eff6ff" : "#f9fafb",
              border: `2px solid ${tipoDisparo === "webjs" ? "#3b82f6" : "#e5e7eb"}`,
              borderRadius: 12, padding: "16px 18px",
              cursor: modulos.disparos_web ? "pointer" : "not-allowed",
              textAlign: "left", opacity: modulos.disparos_web ? 1 : 0.5,
              transition: "all 0.15s",
              boxShadow: tipoDisparo === "webjs" ? "0 4px 12px rgba(59,130,246,0.15)" : "none",
            }}>
            <p style={{ fontSize: 24, margin: "0 0 6px" }}>📱 {!modulos.disparos_web && "🔒"}</p>
            <p style={{ color: tipoDisparo === "webjs" ? "#3b82f6" : "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>WhatsApp Web</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: 0, lineHeight: 1.4 }}>Texto livre. Intervalos longos obrigatórios. Alto risco de banimento.</p>
          </button>
          <button onClick={() => setTipoDisparo("waba")}
            disabled={!modulos.disparos_api}
            title={!modulos.disparos_api ? "Disparos pela API oficial estão disponíveis somente no plano Ultra" : ""}
            style={{
              background: tipoDisparo === "waba" ? "#f0fdf4" : "#f9fafb",
              border: `2px solid ${tipoDisparo === "waba" ? "#16a34a" : "#e5e7eb"}`,
              borderRadius: 12, padding: "16px 18px",
              cursor: modulos.disparos_api ? "pointer" : "not-allowed",
              textAlign: "left", opacity: modulos.disparos_api ? 1 : 0.5,
              transition: "all 0.15s",
              boxShadow: tipoDisparo === "waba" ? "0 4px 12px rgba(22,163,74,0.15)" : "none",
            }}>
            <p style={{ fontSize: 24, margin: "0 0 6px" }}>🔗 {!modulos.disparos_api && "🔒"}</p>
            <p style={{ color: tipoDisparo === "waba" ? "#16a34a" : "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>API oficial da Meta</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: 0, lineHeight: 1.4 }}>Usa modelo aprovado pela Meta. Até 5.000 contatos por disparo.</p>
          </button>
        </div>
      </div>

      {/* ═══ AVISO ═══ */}
      {tipoDisparo === "webjs" ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 12, padding: "14px 18px" }}>
          <p style={{ color: "#991b1b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            <b>⚠️ Aviso:</b> Disparo por WhatsApp Web é a principal causa de banimento. Use intervalos de pelo menos 60 segundos, não dispare para quem nunca enviou mensagem e limite a 100 ou 200 contatos por dia em números novos.
          </p>
        </div>
      ) : (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderLeft: "4px solid #16a34a", borderRadius: 12, padding: "14px 18px" }}>
          <p style={{ color: "#166534", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            <b>✅ Pela API oficial:</b> Modelos aprovados pela Meta seguem as regras da plataforma. O preço por mensagem varia por categoria (Marketing/Utilidade/Autenticação). Um intervalo de 1 a 3 segundos é suficiente.
          </p>
        </div>
      )}

      {false && tipoDisparo === "waba" && (
        <div style={{
          ...cardStyle,
          border: `1px solid ${corScore}55`,
          borderLeft: `4px solid ${corScore}`,
          padding: 0,
          overflow: "hidden",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #ecfeff 100%)",
        }}>
          <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ minWidth: 260, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <h2 style={{ color: "#0f172a", fontSize: 18, margin: 0, fontWeight: 800 }}>{canalEscolhido?.nome || "Canal WABA"}</h2>
                <span style={{ background: canalConectado ? "#dcfce7" : "#fee2e2", color: canalConectado ? "#15803d" : "#b91c1c", border: `1px solid ${canalConectado ? "#86efac" : "#fecaca"}`, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
                  {canalConectado ? "Ativo" : "Desconectado"}
                </span>
                <span style={{ background: `${corQualidade}18`, color: corQualidade, border: `1px solid ${corQualidade}55`, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
                  Qualidade {integridadeApi.qualidade}
                </span>
                <span style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #c4b5fd", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
                  Ate {integridadeApi.limite24h} msgs/24h
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                {integridadeApi.numero || canalEscolhido?.phone_number_id || "Numero nao informado"} · {canalEscolhido?.waba_id || "WABA sem ID visivel"}
              </p>
              <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0", lineHeight: 1.6 }}>
                Sincronizado: {integridadeApi.atualizadoEm ? new Date(integridadeApi.atualizadoEm || 0).toLocaleString("pt-BR") : "aguardando leitura"} · Nome: {integridadeApi.nomeMeta || "nao retornado"} · Meta: {integridadeApi.statusMeta}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ background: podeDispararApi ? "#059669" : "#f59e0b", color: "white", borderRadius: 999, padding: "7px 13px", fontSize: 12, fontWeight: 900, boxShadow: `0 8px 20px ${podeDispararApi ? "rgba(5,150,105,0.25)" : "rgba(245,158,11,0.25)"}` }}>
                {podeDispararApi ? "Pode disparar" : "Requer atencao"}
              </span>
              <button
                onClick={() => fetchIntegridadeApi(true)}
                disabled={atualizandoIntegridade || !canalSelecionado}
                style={{ background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: atualizandoIntegridade ? "wait" : !canalSelecionado ? "not-allowed" : "pointer", opacity: !canalSelecionado ? 0.6 : 1, boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}
              >
                {atualizandoIntegridade ? "Atualizando..." : "Atualizar agora"}
              </button>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {canais.length === 0 && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderLeft: "4px solid #f97316", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <p style={{ color: "#9a3412", fontSize: 13, fontWeight: 900, margin: "0 0 5px" }}>Nenhum canal WABA encontrado neste workspace.</p>
                <p style={{ color: "#9a3412", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  A tela agora busca por username e ID do tenant. Se ainda aparecer vazio, o canal foi salvo em outro workspace_id ou sem phone_number_id/waba_id.
                </p>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <h3 style={{ color: "#0f172a", fontSize: 16, margin: 0, fontWeight: 900 }}>Integridade da API</h3>
              <span style={{ background: `${corScore}18`, color: corScore, border: `1px solid ${corScore}55`, borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 900 }}>
                {integridadeApi.score >= 85 ? "Saudavel" : integridadeApi.score >= 60 ? "Atencao" : "Critico"} - {integridadeApi.score}/100
              </span>
              {integridadeApi.loading && <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>lendo em tempo real...</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
              {barraIntegridade("Saude interna", integridadeApi.saudeInterna, 100, integridadeApi.saudeInterna >= 80 ? "#10b981" : "#f59e0b", `${integridadeApi.saudeInterna}/100`)}
              {barraIntegridade("Enviados (24h rolling)", integridadeApi.enviados24h, integridadeApi.limite24h, pct(integridadeApi.enviados24h, integridadeApi.limite24h) >= 90 ? "#f59e0b" : "#10b981", `${integridadeApi.enviados24h} / ${integridadeApi.limite24h} (${pct(integridadeApi.enviados24h, integridadeApi.limite24h)}%)`)}
              {barraIntegridade("Enviados (1h rolling)", integridadeApi.enviados1h, integridadeApi.limite1h, pct(integridadeApi.enviados1h, integridadeApi.limite1h) >= 80 ? "#f59e0b" : "#38bdf8", `${integridadeApi.enviados1h} / ${integridadeApi.limite1h}`)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
                <p style={{ color: "#166534", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>Templates aprovados</p>
                <p style={{ color: "#16a34a", fontSize: 22, fontWeight: 900, margin: 0 }}>{integridadeApi.templatesAprovados}</p>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12 }}>
                <p style={{ color: "#92400e", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>Em analise</p>
                <p style={{ color: "#f59e0b", fontSize: 22, fontWeight: 900, margin: 0 }}>{integridadeApi.templatesPendentes}</p>
              </div>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>
                <p style={{ color: "#991b1b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>Falhas 24h</p>
                <p style={{ color: "#dc2626", fontSize: 22, fontWeight: 900, margin: 0 }}>{integridadeApi.falhas24h}</p>
              </div>
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12 }}>
                <p style={{ color: "#9a3412", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>Rejeitados</p>
                <p style={{ color: "#ea580c", fontSize: 22, fontWeight: 900, margin: 0 }}>{integridadeApi.templatesRejeitados}</p>
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              {integridadeApi.erro ? (
                <p style={{ color: "#dc2626", fontSize: 12, margin: 0, fontWeight: 700 }}>Erro ao atualizar: {integridadeApi.erro}</p>
              ) : integridadeApi.alertas.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {integridadeApi.alertas.map((alerta, idx) => (
                    <p key={idx} style={{ color: "#92400e", fontSize: 12, margin: 0, fontWeight: 700 }}>• {alerta}</p>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#166534", fontSize: 12, margin: 0, fontWeight: 800 }}>Nenhum erro operacional encontrado neste canal agora.</p>
              )}
              <p style={{ color: "#475569", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                {integridadeApi.recomendacao}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FORMULÁRIO ═══ */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>🚀 Novo disparo {tipoDisparo === "webjs" ? "pelo WhatsApp Web" : "pela API oficial"}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Canal {tipoDisparo === "webjs" ? "WhatsApp Web" : "WABA"}</label>
            <select value={canalSelecionado || ""} onChange={e => setCanalSelecionado(parseInt(e.target.value) || null)} style={IS}>
              <option value="">Selecione um canal</option>
              {canais.map(c => (
                <option key={c.id} value={c.id} disabled={!normalizarStatusCanal(c.status)}>
                  {normalizarStatusCanal(c.status) ? "🟢" : "🔴"} {c.nome}
                </option>
              ))}
            </select>
            {canalSelecionado && !canalConectado && (
              <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>⚠️ Canal desconectado.</p>
            )}
          </div>
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Nome da Campanha (opcional)</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Campanha de julho" style={IS} />
          </div>
        </div>

        {tipoDisparo === "waba" && canalSelecionado && (
          <div style={{
            background: "#f8fafc",
            border: `1px solid ${corScore}55`,
            borderLeft: `4px solid ${corScore}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <b style={{ color: "#0f172a", fontSize: 13 }}>Integridade da API</b>
                <span style={{ background: `${corScore}18`, color: corScore, border: `1px solid ${corScore}55`, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                  {integridadeApi.score}/100
                </span>
                <span style={{ background: `${corQualidade}18`, color: corQualidade, border: `1px solid ${corQualidade}55`, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                  {integridadeApi.qualidade}
                </span>
                <span style={{ background: canalConectado ? "#dcfce7" : "#fee2e2", color: canalConectado ? "#15803d" : "#b91c1c", border: `1px solid ${canalConectado ? "#86efac" : "#fecaca"}`, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                  {canalConectado ? "Conectado" : "Desconectado"}
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: 11, margin: 0, lineHeight: 1.7 }}>
                Limite Meta do portfolio: <b>{integridadeApi.limite24h ? integridadeApi.limite24h.toLocaleString("pt-BR") : "nao retornado"}</b>
                {integridadeApi.limiteTier ? <> ({formatarTierMeta(integridadeApi.limiteTier)})</> : null}
                {" "}· Enviadas 24h: <b>{integridadeApi.enviados24h.toLocaleString("pt-BR")}</b>
                {" "}· Enviadas 1h: <b>{integridadeApi.enviados1h.toLocaleString("pt-BR")}{integridadeApi.limite1h > 0 ? `/${integridadeApi.limite1h}` : ""}</b>
                {" "}· Falhas 24h: <b style={{ color: integridadeApi.falhas24h ? "#dc2626" : "#16a34a" }}>{integridadeApi.falhas24h}</b>
                {" "}· Modelos aprovados: <b>{integridadeApi.templatesAprovados}</b>
              </p>
              {(integridadeApi.limiteFonte || integridadeApi.metricasFonte) && (
                <p style={{ color: "#94a3b8", fontSize: 10, margin: "3px 0 0", lineHeight: 1.5 }}>
                  Limite: {traduzirFonteLimite(integridadeApi.limiteFonte)} · Métricas: {traduzirFonteMetricas(integridadeApi.metricasFonte)}
                </p>
              )}
              {(integridadeApi.alertas[0] || integridadeApi.erro) && (
                <p style={{ color: "#92400e", fontSize: 11, margin: "6px 0 0", fontWeight: 700 }}>
                  {integridadeApi.erro || integridadeApi.alertas[0]}
                </p>
              )}
            </div>
            <button
              onClick={() => fetchIntegridadeApi(true)}
              disabled={atualizandoIntegridade}
              style={{ background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 800, cursor: atualizandoIntegridade ? "wait" : "pointer" }}
            >
              {atualizandoIntegridade ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        )}

        {tipoDisparo === "waba" && canalSelecionado && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>📋 Modelo aprovado</label>
            {templates.length === 0 ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <p style={{ color: "#991b1b", fontSize: 13, margin: "0 0 10px", fontWeight: 600 }}>⚠️ Nenhum modelo aprovado para esse canal.</p>
                <button onClick={() => router.push("/chatbot/templates")}
                  style={{ background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)", color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(220,38,38,0.25)" }}>
                  📨 Criar modelo agora
                </button>
              </div>
            ) : (
              <select value={templateSelecionado || ""} onChange={e => setTemplateSelecionado(parseInt(e.target.value) || null)} style={IS}>
                <option value="">Selecione um modelo</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    ✅ {t.nome_amigavel || t.meta_template_name} ({traduzirCategoriaTemplate(t.categoria)}, {t.idioma})
                  </option>
                ))}
              </select>
            )}
            {atualizandoTemplateMeta && <p style={{ color: "#2563eb", fontSize: 11, fontWeight: 700, margin: "6px 0 0" }}>Consultando categoria e status atuais na Meta...</p>}
          </div>
        )}

        {tipoDisparo === "waba" && templateEscolhido && (
          <div style={{
            background: "#f8fafc",
            border: `1px solid ${String(templateEscolhido.status || "").toLowerCase() === "aprovado" ? "#86efac" : "#fde68a"}`,
            borderLeft: `4px solid ${String(templateEscolhido.status || "").toLowerCase() === "aprovado" ? "#16a34a" : "#f59e0b"}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
              <b style={{ color: "#0f172a", fontSize: 13 }}>Integridade do modelo</b>
              <span style={{ background: String(templateEscolhido.status || "").toLowerCase() === "aprovado" ? "#dcfce7" : "#fffbeb", color: String(templateEscolhido.status || "").toLowerCase() === "aprovado" ? "#15803d" : "#92400e", border: `1px solid ${String(templateEscolhido.status || "").toLowerCase() === "aprovado" ? "#86efac" : "#fde68a"}`, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                {templateEscolhido.status || "sem status"}
              </span>
              <span style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                Categoria na Meta: {traduzirCategoriaTemplate(templateEscolhido.categoria_meta || templateEscolhido.categoria)}
              </span>
              <span style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                {templateEscolhido.idioma || "sem idioma"}
              </span>
            </div>
            <p style={{ color: "#64748b", fontSize: 11, margin: 0, lineHeight: 1.7 }}>
              Nome Meta: <b>{templateEscolhido.meta_template_name}</b>
              {templateEscolhido.meta_template_id ? <> · ID Meta: <b>{templateEscolhido.meta_template_id}</b></> : null}
              {" "}· Componentes: <b>{(templateEscolhido.componentes || []).length}</b>
              {" "}· Variaveis: <b>{varsTemplate.length}</b>
              {" "}· Sincronizado: <b>{templateEscolhido.ultima_sincronizacao ? new Date(templateEscolhido.ultima_sincronizacao).toLocaleString("pt-BR") : "nao informado"}</b>
            </p>
            {templateEscolhido.correct_category && templateEscolhido.correct_category !== (templateEscolhido.categoria_meta || templateEscolhido.categoria) && (
              <p style={{ color: "#92400e", fontSize: 11, margin: "6px 0 0", fontWeight: 800 }}>
                Próxima categoria indicada pela Meta: {traduzirCategoriaTemplate(templateEscolhido.correct_category)}
              </p>
            )}
            {(templateEscolhido.motivo_rejeicao || templateEscolhido.rejected_reason) && !["NONE", "NULL", "N/A"].includes(String(templateEscolhido.motivo_rejeicao || templateEscolhido.rejected_reason).toUpperCase()) && (
              <p style={{ color: "#b91c1c", fontSize: 11, margin: "6px 0 0", fontWeight: 800 }}>
                Motivo Meta: {templateEscolhido.motivo_rejeicao || templateEscolhido.rejected_reason}
              </p>
            )}
          </div>
        )}

        {tipoDisparo === "waba" && templateEscolhido && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>📋 Prévia do modelo</p>
            {(templateEscolhido.componentes || []).map((c: any, i: number) => {
              if (c.type === "HEADER" && c.format === "TEXT") return <p key={i} style={{ color: "#16a34a", fontSize: 12, margin: "0 0 6px", fontWeight: 700 }}>📌 {c.text}</p>;
              if (c.type === "HEADER") return <p key={i} style={{ color: "#6b7280", fontSize: 11, margin: "0 0 6px" }}>📎 {c.format} (mídia anexada)</p>;
              if (c.type === "BODY") return <p key={i} style={{ color: "#1f2937", fontSize: 13, margin: "0 0 6px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.text}</p>;
              if (c.type === "FOOTER") return <p key={i} style={{ color: "#6b7280", fontSize: 11, margin: "0 0 6px", fontStyle: "italic" }}>{c.text}</p>;
              if (c.type === "BUTTONS") return <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {(c.buttons || []).map((b: any, j: number) => (
                  <span key={j} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>{b.text}</span>
                ))}
              </div>;
              return null;
            })}
          </div>
        )}

        {tipoDisparo === "waba" && templateEscolhido && varsTemplate.length > 0 && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>🔧 Variáveis Fixas (valor pra TODOS)</p>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 12px" }}>Deixe vazio se quer definir por contato no CSV (última coluna por variável).</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {varsTemplate.map(v => (
                <div key={v}>
                  <label style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, display: "block", marginBottom: 4 }}>{"{{"}{v}{"}}"}</label>
                  <input
                    value={varsFixas[v] || ""}
                    onChange={e => setVarsFixas(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={`Valor pra {{${v}}}`}
                    style={{ ...IS, padding: "8px 12px", fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tipoDisparo === "webjs" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>💬 Mensagem</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Digite a mensagem..." rows={5} style={{ ...IS, resize: "vertical", minHeight: 100, fontFamily: "inherit" }} />
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>{mensagem.length} caracteres</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>⏱️ Intervalo mínimo (seg)</label>
            <input type="number" min={tipoDisparo === "webjs" ? 30 : 0} max={300} value={delayMin} onChange={e => setDelayMin(parseInt(e.target.value) || 0)} style={IS} />
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>
              {tipoDisparo === "webjs" ? "Mínimo de 30s; recomendado: 60s ou mais" : "API oficial: pode ser de 0 a 5s"}
            </p>
          </div>
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>⏱️ Intervalo máximo (seg)</label>
            <input type="number" min={tipoDisparo === "webjs" ? 30 : 0} max={300} value={delayMax} onChange={e => setDelayMax(parseInt(e.target.value) || 0)} style={IS} />
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>Máx: 300s</p>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            📱 {tipoDisparo === "webjs" ? "Números (um por linha)" : "Contatos"}
            {tipoDisparo === "waba" && varsTemplate.length > 0 && <span style={{ color: "#f59e0b", marginLeft: 8 }}>• CSV: numero,var1,var2...</span>}
          </label>

          {tipoDisparo === "waba" && contatosWaba.length > 0 ? (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, maxHeight: 240, overflowY: "auto" }}>
              <p style={{ color: "#16a34a", fontSize: 12, margin: "0 0 8px", fontWeight: 700 }}>✅ {contatosWaba.length} contato(s) importado(s) via CSV</p>
              <div style={{ fontSize: 11, color: "#1f2937", fontFamily: "monospace" }}>
                {contatosWaba.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
                    {c.numero} {Object.entries(c.vars).map(([k, v]) => <span key={k} style={{ color: "#8b5cf6" }}>| {"{{"}{k}{"}}"}: {v}</span>)}
                  </div>
                ))}
                {contatosWaba.length > 5 && <div style={{ color: "#9ca3af", padding: "6px 0" }}>... e +{contatosWaba.length - 5} contato(s)</div>}
              </div>
              <button onClick={() => setContatosWaba([])}
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 14px", fontSize: 11, cursor: "pointer", marginTop: 12, fontWeight: 600 }}>
                🗑️ Limpar e usar campo de texto
              </button>
            </div>
          ) : (
            <textarea value={numerosTexto} onChange={e => { setNumerosTexto(e.target.value); if (tipoDisparo === "waba") setContatosWaba([]); }}
              placeholder={tipoDisparo === "webjs" ? "5562981519991\n5562987654321" : "5562981519991\n5562987654321\n\nOu importe CSV com colunas pra preencher variáveis por contato."}
              rows={8} style={{ ...IS, fontFamily: "monospace", resize: "vertical", minHeight: 160 }} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <p style={{ color: numerosValidos.length > (tipoDisparo === "webjs" ? 1000 : 5000) ? "#dc2626" : "#16a34a", fontSize: 12, margin: 0, fontWeight: 700 }}>
              {numerosValidos.length} número(s) válido(s)
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 10, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                📂 Importar CSV {tipoDisparo === "waba" && varsTemplate.length > 0 && "(com variáveis)"}
              </button>
            </div>
          </div>
          {tipoDisparo === "waba" && varsTemplate.length > 0 && (
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "8px 0 0" }}>
              💡 <b>Formato CSV:</b> <code style={{ background: "#f3f4f6", color: "#1f2937", padding: "1px 5px", borderRadius: 4 }}>numero,valor_var1,valor_var2,...</code> — ex: <code style={{ background: "#f3f4f6", color: "#1f2937", padding: "1px 5px", borderRadius: 4 }}>5562981519991,João,Pedido#1234</code>
            </p>
          )}
        </div>

        {/* ═══ 🗓️ AGENDAMENTO ═══ */}
        <div style={{
          background: agendarAtivo ? "#faf5ff" : "#f9fafb",
          border: `1px solid ${agendarAtivo ? "#a855f750" : "#e5e7eb"}`,
          borderLeft: `4px solid ${agendarAtivo ? "#a855f7" : "#d1d5db"}`,
          borderRadius: 12, padding: 16, marginBottom: 16,
          transition: "all 0.15s",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={agendarAtivo} onChange={e => setAgendarAtivo(e.target.checked)}
              style={{ accentColor: "#a855f7", width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>🗓️ Agendar pra mais tarde</p>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0", lineHeight: 1.4 }}>
                Ex.: subir a lista agora e disparar à 00h de amanhã. Sem isso marcado, o disparo começa na hora.
              </p>
            </div>
          </label>

          {agendarAtivo && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                <label style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>Data e hora de início</label>
                <input type="datetime-local"
                  value={agendarPara}
                  min={agoraDatetimeLocal()}
                  onChange={e => setAgendarPara(e.target.value)}
                  style={{ ...IS, colorScheme: "light" }} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setAgendarPara(proxAmanhaMidnight())}
                  style={{ background: "#faf5ff", color: "#a855f7", border: "1px solid #a855f730", borderRadius: 8, padding: "8px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Amanhã 00:00
                </button>
                <button onClick={() => { const d = new Date(); d.setHours(d.getHours()+1, 0, 0, 0); setAgendarPara(formatarDatetimeLocal(d)); }}
                  style={{ background: "#faf5ff", color: "#a855f7", border: "1px solid #a855f730", borderRadius: 8, padding: "8px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Próxima hora cheia
                </button>
                <button onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9, 0, 0, 0); setAgendarPara(formatarDatetimeLocal(d)); }}
                  style={{ background: "#faf5ff", color: "#a855f7", border: "1px solid #a855f730", borderRadius: 8, padding: "8px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Amanhã 09:00
                </button>
              </div>
            </div>
          )}

          {agendarAtivo && agendarPara && (() => {
            const dt = new Date(agendarPara);
            if (isNaN(dt.getTime())) return null;
            const diffMs = dt.getTime() - Date.now();
            if (diffMs <= 0) {
              return <p style={{ color: "#dc2626", fontSize: 11, margin: "10px 0 0", fontWeight: 600 }}>⚠️ Horário no passado — escolha um momento no futuro.</p>;
            }
            const horas = Math.floor(diffMs / 3_600_000);
            const minutos = Math.floor((diffMs % 3_600_000) / 60_000);
            const quando = horas >= 1 ? `daqui a ${horas}h ${minutos}min` : `daqui a ${minutos}min`;
            return <p style={{ color: "#7e22ce", fontSize: 12, margin: "10px 0 0", fontWeight: 600 }}>
              ⏰ Vai começar {quando} ({dt.toLocaleString("pt-BR")}).
            </p>;
          })()}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <button onClick={() => { setMensagem(""); setNumerosTexto(""); setNome(""); setVarsFixas({}); setContatosWaba([]); setAgendarAtivo(false); setAgendarPara(""); }}
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
            🗑️ Limpar
          </button>
          <button onClick={iniciarDisparo} disabled={enviando || !canalConectado || (tipoDisparo === "waba" && !podeDispararApi)}
            style={{
              background: enviando || !canalConectado || (tipoDisparo === "waba" && !podeDispararApi)
                ? "#9ca3af"
                : (agendarAtivo
                  ? "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)"
                  : (tipoDisparo === "waba"
                    ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
                    : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)")),
              color: "white", border: "none", borderRadius: 10,
              padding: "10px 28px", fontSize: 13,
              cursor: (enviando || !canalConectado || (tipoDisparo === "waba" && !podeDispararApi)) ? "not-allowed" : "pointer", fontWeight: 700,
              boxShadow: (enviando || !canalConectado || (tipoDisparo === "waba" && !podeDispararApi)) ? "none" : (agendarAtivo ? "0 4px 12px rgba(168,85,247,0.3)" : (tipoDisparo === "waba" ? "0 4px 12px rgba(22,163,74,0.3)" : "0 4px 12px rgba(59,130,246,0.3)")),
            }}>
            {enviando
              ? "⏳ Criando..."
              : agendarAtivo
                ? `🗓️ AGENDAR ${tipoDisparo === "waba" ? "PELA API OFICIAL" : "PELO WHATSAPP WEB"}`
                : `🚀 ENVIAR ${tipoDisparo === "waba" ? "PELA API OFICIAL" : "PELO WHATSAPP WEB"}`}
          </button>
        </div>
      </div>

      {/* ═══ HISTÓRICO ═══ */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>📊 Histórico de Disparos</h2>

        {disparos.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>📭</p>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhum disparo criado ainda.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {disparos.map(d => {
              const progresso = d.total_contatos ? Math.round(((d.total_enviados + d.total_falhas) / d.total_contatos) * 100) : 0;
              const ehWaba = d.tipo === "waba";
              // 🗓️ Usa status "efetivo" — se pendente + agendado_para no futuro, vira "agendado"
              const stat = statusEfetivo(d);
              const cor = statusColor[stat] || "#6b7280";
              const estaAgendado = stat === "agendado" && d.agendado_para;
              return (
                <div key={d.id}
                  style={{
                    background: "#ffffff", borderRadius: 12, padding: 18,
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${cor}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${cor}15`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>
                        {ehWaba ? "🔗" : "📱"} {d.nome || `Disparo #${d.id}`}
                      </p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>
                        {ehWaba ? `Modelo: ${d.template_name}` : "Texto livre"} · 👤 {d.criado_por} · 🕐 {new Date(d.created_at).toLocaleString("pt-BR")}
                      </p>
                      {/* 🗓️ Linha de "agendado pra" quando aplicável */}
                      {estaAgendado && (
                        <p style={{ color: "#7e22ce", fontSize: 12, margin: "6px 0 0", fontWeight: 700, background: "#faf5ff", border: "1px solid #a855f730", padding: "4px 10px", borderRadius: 8, display: "inline-block" }}>
                          🗓️ Vai começar em {new Date(d.agendado_para!).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <span style={{
                      background: `${cor}15`, color: cor,
                      border: `1px solid ${cor}40`,
                      fontSize: 11, padding: "5px 12px", borderRadius: 12, fontWeight: 700, whiteSpace: "nowrap",
                    }}>
                      {statusLabel[stat] || stat}
                    </span>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: 20, height: 8, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ background: `linear-gradient(90deg, ${cor}, ${cor}cc)`, height: "100%", width: `${progresso}%`, transition: "width 0.3s", borderRadius: 20 }} />
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 12px" }}>
                    <b style={{ color: "#1f2937" }}>{d.total_enviados + d.total_falhas}</b> / {d.total_contatos} processados ({progresso}%) · <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ {d.total_enviados}</span> · <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ {d.total_falhas}</span>
                  </p>
                  {d.pausado_motivo && <p style={{ color: "#92400e", fontSize: 11, margin: "0 0 8px", background: "#fffbeb", padding: "6px 10px", borderRadius: 6, border: "1px solid #fde68a" }}>⚠️ {d.pausado_motivo}</p>}
                  {d.erro_msg && <p style={{ color: "#991b1b", fontSize: 11, margin: "0 0 8px", background: "#fef2f2", padding: "6px 10px", borderRadius: 6, border: "1px solid #fecaca" }}>❌ {d.erro_msg}</p>}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setDisparoDetalhe(d)}
                      style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>👁️ Detalhes</button>
                    {d.status === "rodando" && <button onClick={() => pausarDisparo(d.id)}
                      style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>⏸️ Pausar</button>}
                    {d.status === "pausado" && <button onClick={() => retomarDisparo(d.id)}
                      style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>▶️ Retomar</button>}
                    {["rodando", "pausado", "pendente"].includes(d.status) && <button onClick={() => cancelarDisparo(d.id)}
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🛑 {estaAgendado ? "Cancelar agendamento" : "Cancelar"}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MODAL DETALHES ═══ */}
      {disparoDetalhe && (
        <div onClick={() => setDisparoDetalhe(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...cardStyle, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: 0 }}>
                {disparoDetalhe.tipo === "waba" ? "🔗" : "📱"} {disparoDetalhe.nome || `Disparo #${disparoDetalhe.id}`}
              </h3>
              <button onClick={() => setDisparoDetalhe(null)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              {/* 🗓️ Se agendado, destaque no topo do modal */}
              {disparoDetalhe.agendado_para && new Date(disparoDetalhe.agendado_para).getTime() > Date.now() && disparoDetalhe.status === "pendente" && (
                <p style={{ color: "#7e22ce", fontSize: 12, margin: "0 0 10px", fontWeight: 700, background: "#faf5ff", border: "1px solid #a855f730", padding: "6px 12px", borderRadius: 8, display: "inline-block" }}>
                  🗓️ Agendado pra começar em {new Date(disparoDetalhe.agendado_para).toLocaleString("pt-BR")}
                </p>
              )}
              <p style={{ color: "#1f2937", fontSize: 13, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {disparoDetalhe.tipo === "waba" ? `📋 Modelo: ${disparoDetalhe.template_name}\n\n` : ""}
                {disparoDetalhe.mensagem}
              </p>
            </div>

            <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>
              <h4 style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>📋 Contatos ({contatosDetalhe.length})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {contatosDetalhe.map(c => {
                  const statusIcon = c.status === "enviado" ? "✅" : c.status === "falha" ? "❌" : "⏳";
                  const statusCor = c.status === "enviado" ? "#16a34a" : c.status === "falha" ? "#dc2626" : "#f59e0b";
                  const statusBg = c.status === "enviado" ? "#f0fdf4" : c.status === "falha" ? "#fef2f2" : "#fffbeb";
                  return (
                    <div key={c.id}
                      style={{
                        background: statusBg,
                        border: `1px solid ${statusCor}30`,
                        padding: "9px 14px", borderRadius: 10,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontSize: 12,
                      }}>
                      <span style={{ color: "#1f2937", fontFamily: "monospace", fontWeight: 500 }}>
                        {statusIcon} {c.numero}
                        {c.variaveis && Object.keys(c.variaveis).length > 0 && <span style={{ color: "#8b5cf6", marginLeft: 6, fontSize: 11 }}>({Object.entries(c.variaveis).map(([k,v]) => `{{${k}}}: ${v}`).join(", ")})</span>}
                      </span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {c.enviado_em && <span style={{ color: "#9ca3af", fontSize: 10 }}>{new Date(c.enviado_em).toLocaleTimeString("pt-BR")}</span>}
                        {c.erro && <span style={{ color: "#dc2626", fontSize: 10, fontWeight: 600 }} title={c.erro}>erro</span>}
                        <span style={{ color: statusCor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
