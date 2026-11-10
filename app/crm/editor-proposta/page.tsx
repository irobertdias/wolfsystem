"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import {
  CAMPOS_FIXOS,
  CAMPOS_FIXOS_MAP,
  SECOES_LABEL,
  agruparCamposPorSecao,
  montarCamposUnificados,
  type CampoUnificado,
  type ConfigCampoPadrao,
  type CampoCustom,
} from "../../lib/campos_proposta_definicao";

import Icone, { IconeEmoji } from "../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🛠️ EDITOR DE CAMPOS DA PROPOSTA — Wolf PREMIUM v2
// ───────────────────────────────────────────────────────────────────────
// Setas ↑▼ movem GLOBALMENTE (sem restrição de seção)
// Campos custom HERDAM a seção do campo fixo anterior mais próximo
// Reflete EXATAMENTE na Nova Proposta (mesma ordem, mesma seção)
// ═══════════════════════════════════════════════════════════════════════

type TipoCustom = "texto" | "textarea" | "numero" | "moeda" | "data" | "dropdown" | "checkbox" | "arquivo";

const TIPOS_CUSTOM: { valor: TipoCustom; label: string; icone: string }[] = [
  { valor: "texto",    label: "Texto curto",  icone: "📝" },
  { valor: "textarea", label: "Texto longo",  icone: "📄" },
  { valor: "numero",   label: "Número",       icone: "🔢" },
  { valor: "moeda",    label: "Valor (R$)",   icone: "💰" },
  { valor: "data",     label: "Data",         icone: "📅" },
  { valor: "dropdown", label: "Seleção",      icone: "📋" },
  { valor: "checkbox", label: "Sim / Não",    icone: "☑️" },
  { valor: "arquivo",  label: "Arquivo privado", icone: "📎" },
];

const labelToSlug = (label: string): string =>
  label.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 50);

const CORES_SECOES_PERSONALIZADAS = ["#0F766E", "#0F766E", "#0891b2", "#059669", "#C2410C", "#dc2626", "#BE185D", "#059669"];

const SECAO_META: Record<string, { icone: string; cor: string; descricao: string; ordem: number }> = {
  pessoal:        { icone: "👤", cor: "#14B8A6", descricao: "Identificação do cliente",        ordem: 1 },
  endereco:       { icone: "📍", cor: "#06b6d4", descricao: "Onde será a instalação",           ordem: 2 },
  contato:        { icone: "📱", cor: "#0F766E", descricao: "Como falar com o cliente",         ordem: 3 },
  plano:          { icone: "📦", cor: "#C2410C", descricao: "Serviço contratado",               ordem: 4 },
  agendamento:    { icone: "📅", cor: "#BE185D", descricao: "Quando instalar",                  ordem: 5 },
  vendedor:       { icone: "👨‍💼", cor: "#059669", descricao: "Atribuição interna",              ordem: 6 },
  status:         { icone: "🎯", cor: "#dc2626", descricao: "Situação atual da proposta",       ordem: 7 },
  personalizado:  { icone: "⚙️", cor: "#a855f7", descricao: "Campos customizados pelo workspace", ordem: 8 },
};

// 🔑 INFERÊNCIA DE SEÇÃO
// Fixos: usam a `secao` definida no lib.
// Customs: herdam do fixo MAIS PRÓXIMO (anterior tem prioridade > próximo).
const getSecaoKey = (campos: CampoUnificado[], idx: number): string => {
  const campo = campos[idx];
  if (!campo) return "personalizado";
  const secaoEscolhida = String((campo as any).secao_customizada || "").trim();
  if (secaoEscolhida.startsWith("@")) return secaoEscolhida.slice(1) || "personalizado";
  if (secaoEscolhida) return `custom:${labelToSlug(secaoEscolhida)}`;
  if (campo.origem === "fixo") {
    return (campo as any).secao || "personalizado";
  }
  for (let i = idx - 1; i >= 0; i--) {
    if (campos[i].origem === "fixo" && (campos[i] as any).secao) {
      return (campos[i] as any).secao;
    }
  }
  for (let i = idx + 1; i < campos.length; i++) {
    if (campos[i].origem === "fixo" && (campos[i] as any).secao) {
      return (campos[i] as any).secao;
    }
  }
  return "personalizado";
};

// Tira emoji do começo de nomes vindos do banco (só na exibição).
const semEmojiTxt = (s: string) => String(s || "").replace(/^(?:[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}])(?:\uFE0F|\u200D(?:[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}])\uFE0F?)*\s*/u, "");

export default function EditorProposta() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { isDono, perfil, isSuperAdmin } = usePermissao();
  const podeEditar = isDono || isSuperAdmin || perfil === "Administrador";

  const [campos, setCampos] = useState<CampoUnificado[]>([]);
  const [camposRemovidos, setCamposRemovidos] = useState<CampoUnificado[]>([]);
  const [removidosAbertos, setRemovidosAbertos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busca, setBusca] = useState("");
  const [secaoVisivel, setSecaoVisivel] = useState<string>("");
  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const inputStyle = {
    width: "100%",
    background: "#F7FAF9",
    border: "1px solid #E6ECEA",
    borderRadius: 12,
    padding: "11px 14px",
    color: "#0F172A",
    fontSize: 14, fontWeight: 600,
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

  const fetchCampos = async () => {
    if (!workspace?.username) return;
    setLoading(true);
    try {
      const [respConfig, respCustom] = await Promise.all([
        supabase.from("proposta_campos_padrao_config")
          .select("*")
          .eq("workspace_id", workspace.username),
        supabase.from("proposta_campos_customizados")
          .select("*")
          .eq("workspace_id", workspace.username)
          .order("ordem", { ascending: true }),
      ]);

      const configs: ConfigCampoPadrao[] = (respConfig.data || []).map((c: any) => ({
        id: c.id,
        campo_slug: c.campo_slug,
        label_custom: c.label_custom,
        obrigatorio: c.obrigatorio,
        visivel: c.visivel,
        ordem: c.ordem,
        opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" && c.opcoes ? JSON.parse(c.opcoes) : null),
        placeholder_custom: c.placeholder_custom,
        secao_customizada: c.secao_customizada || null,
      }));

      const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
        id: c.id,
        slug: c.slug,
        label: c.label,
        tipo: c.tipo,
        obrigatorio: c.obrigatorio,
        ordem: c.ordem,
        opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
        placeholder: c.placeholder,
        ativo: c.ativo,
        secao_customizada: c.secao_customizada || null,
        secao_cor: c.secao_cor || null,
      }));

      const lista = montarCamposUnificados(configs, customs);

      const mostrarFixoMap = new Map<string, boolean>();
      for (const c of (respConfig.data || [])) {
        mostrarFixoMap.set(c.campo_slug, !!c.mostrar_na_lista);
      }
      const mostrarCustomMap = new Map<string, boolean>();
      for (const c of (respCustom.data || [])) {
        mostrarCustomMap.set(c.slug, !!c.mostrar_na_lista);
      }
      const enriquecida = lista.map(c => ({
        ...c,
        mostrar_na_lista: c.origem === "fixo"
          ? !!mostrarFixoMap.get(c.slug)
          : !!mostrarCustomMap.get(c.slug),
      }));
      const removidosFixos = enriquecida.filter(c => c.origem === "fixo" && c.visivel === false);
      const ativos = enriquecida.filter(c => c.visivel !== false);
      const removidosCustom: CampoUnificado[] = (respCustom.data || [])
        .filter((c: any) => c.ativo === false)
        .map((c: any) => ({
          origem: "custom" as const,
          slug: c.slug,
          label: c.label,
          tipo: c.tipo,
          obrigatorio: !!c.obrigatorio,
          visivel: false,
          ordem: typeof c.ordem === "number" ? c.ordem : 999,
          opcoes: Array.isArray(c.opcoes) ? c.opcoes : [],
          placeholder: c.placeholder,
          idCustom: c.id,
          mostrar_na_lista: !!c.mostrar_na_lista,
        } as any));
      setCampos(ativos as any);
      setCamposRemovidos([...removidosFixos, ...removidosCustom] as any);
      setDirty(false);
    } catch (e) {
      console.error("[EditorProposta] erro fetch:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampos(); }, [workspace]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; return ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        salvar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campos, dirty, salvando]);

  useEffect(() => {
    if (campos.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visiveis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visiveis.length > 0) {
        const id = visiveis[0].target.getAttribute("data-secao");
        if (id) setSecaoVisivel(id);
      }
    }, { rootMargin: "-20% 0px -60% 0px", threshold: 0 });
    Object.values(sectionsRef.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [campos]);

  const adicionarCustom = (secaoCustomizada?: string, secaoCor?: string) => {
    const novo: CampoUnificado = {
      origem: "custom",
      slug: "",
      label: "",
      tipo: "texto",
      obrigatorio: false,
      visivel: true,
      ordem: campos.length + 1,
      opcoes: [],
      secao_customizada: secaoCustomizada?.trim() || null,
      secao_cor: secaoCor || null,
    };
    const nomeSecao = secaoCustomizada?.trim();
    if (!nomeSecao) {
      setCampos(agruparCamposPorSecao([...campos, { ...novo, mostrar_na_lista: true } as any]));
    } else {
      const chaveSecao = `custom:${labelToSlug(nomeSecao)}`;
      let ultimoIndice = -1;
      campos.forEach((_, indice) => {
        if (getSecaoKey(campos, indice) === chaveSecao) ultimoIndice = indice;
      });
      const novaLista = [...campos];
      novaLista.splice(ultimoIndice >= 0 ? ultimoIndice + 1 : novaLista.length, 0, { ...novo, mostrar_na_lista: true } as any);
      setCampos(novaLista.map((campo, indice) => ({ ...campo, ordem: indice + 1 })));
    }
    setDirty(true);
  };

  const adicionarSecao = () => {
    const nome = window.prompt("Nome da nova se\u00e7\u00e3o:")?.trim();
    if (!nome) return;
    const secoesAtuais = new Set(campos.map(c => String((c as any).secao_customizada || "").trim()).filter(Boolean));
    const corInicial = CORES_SECOES_PERSONALIZADAS[secoesAtuais.size % CORES_SECOES_PERSONALIZADAS.length];
    adicionarCustom(nome, corInicial);
  };

  const renomearSecao = (nomeAtual: string) => {
    const novoNome = window.prompt("Novo nome da se\u00e7\u00e3o:", nomeAtual)?.trim();
    if (!novoNome || novoNome === nomeAtual) return;
    setCampos(atuais => atuais.map(campo =>
      campo.origem === "custom" && String((campo as any).secao_customizada || "").trim() === nomeAtual
        ? { ...campo, secao_customizada: novoNome } as any
        : campo
    ));
    setDirty(true);
  };

  const alterarCorSecao = (nomeSecao: string, novaCor: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(novaCor)) return;
    setCampos(atuais => atuais.map(campo =>
      campo.origem === "custom" && String((campo as any).secao_customizada || "").trim() === nomeSecao
        ? { ...campo, secao_cor: novaCor } as any
        : campo
    ));
    setDirty(true);
  };

  const atualizar = (idx: number, patch: Partial<CampoUnificado>) => {
    setCampos(campos.map((c, i) => i === idx ? { ...c, ...patch } : c));
    setDirty(true);
  };

  // 🆕 Mover GLOBAL (sem restrição de seção)
  const mover = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= campos.length) return;
    const novo = [...campos];
    [novo[idx], novo[target]] = [novo[target], novo[idx]];
    setCampos(novo.map((c, i) => ({ ...c, ordem: i })));
    setDirty(true);
  };

  const remover = async (idx: number) => {
    const c = campos[idx];
    const msg = c.origem === "fixo"
      ? `Excluir o campo padrão "${c.label}" deste workspace?\n\nEle desaparecerá do CRM e dos fluxos somente neste workspace. Os dados antigos serão preservados e o campo poderá ser restaurado.`
      : c.idCustom
        ? `Excluir o campo "${c.label}" deste workspace?\n\nOs valores já preenchidos serão preservados e o campo poderá ser restaurado.`
        : `Remover o campo "${c.label || "novo"}"?`;
    if (!confirm(msg)) return;

    if (workspace?.username && c.origem === "fixo") {
      const resposta = c.idConfig
        ? await supabase.from("proposta_campos_padrao_config").update({ visivel: false })
            .eq("id", c.idConfig).eq("workspace_id", workspace.username)
        : await supabase.from("proposta_campos_padrao_config").insert([{
            workspace_id: workspace.username, campo_slug: c.slug, visivel: false,
          }]);
      if (resposta.error) { alert("Erro ao excluir: " + resposta.error.message); return; }
    } else if (c.idCustom && workspace?.username) {
      const { error } = await supabase.from("proposta_campos_customizados")
        .update({ ativo: false }).eq("id", c.idCustom).eq("workspace_id", workspace.username);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
    }
    if (c.origem === "fixo" || c.idCustom) await fetchCampos();
    else setCampos(campos.filter((_, i) => i !== idx));
  };

  const restaurar = async (campo: CampoUnificado) => {
    if (!workspace?.username) return;
    if (campo.origem === "fixo") {
      const resposta = campo.idConfig
        ? await supabase.from("proposta_campos_padrao_config").update({ visivel: true })
            .eq("id", campo.idConfig).eq("workspace_id", workspace.username)
        : await supabase.from("proposta_campos_padrao_config").insert([{
            workspace_id: workspace.username, campo_slug: campo.slug, visivel: true,
          }]);
      if (resposta.error) { alert("Erro ao restaurar: " + resposta.error.message); return; }
    } else if (campo.idCustom) {
      const { error } = await supabase.from("proposta_campos_customizados")
        .update({ ativo: true }).eq("id", campo.idCustom).eq("workspace_id", workspace.username);
      if (error) { alert("Erro ao restaurar: " + error.message); return; }
    }
    await fetchCampos();
  };
  const adicionarOpcao = (idx: number) => {
    const c = campos[idx];
    atualizar(idx, { opcoes: [...(c.opcoes || []), ""] });
  };
  const atualizarOpcao = (idx: number, opIdx: number, valor: string) => {
    const c = campos[idx];
    const opcoes = [...(c.opcoes || [])];
    opcoes[opIdx] = valor;
    atualizar(idx, { opcoes });
  };
  const removerOpcao = (idx: number, opIdx: number) => {
    const c = campos[idx];
    atualizar(idx, { opcoes: (c.opcoes || []).filter((_, i) => i !== opIdx) });
  };

  const salvar = async () => {
    if (!workspace?.username) return;
    for (let i = 0; i < campos.length; i++) {
      const c = campos[i];
      if (c.origem === "custom") {
        if (!c.label.trim()) {
          alert(`Campo customizado #${i + 1} não tem nome. Preencha ou remova.`);
          return;
        }
        if (c.tipo === "dropdown") {
          const opcoesValidas = (c.opcoes || []).filter(o => o.trim());
          if (opcoesValidas.length === 0) {
            alert(`Campo "${c.label}" é uma Seleção (dropdown) mas não tem opções cadastradas.`);
            return;
          }
        }
      }
    }
    setSalvando(true);
    try {
      const fixosNaLista = campos.filter(c => c.origem === "fixo");
      for (let i = 0; i < fixosNaLista.length; i++) {
        const c = fixosNaLista[i];
        const def = CAMPOS_FIXOS_MAP[c.slug];
        if (!def) continue;

        const labelMudou = c.label.trim() !== def.labelPadrao;
        const obrigMudou = c.obrigatorio !== def.obrigatorioPadrao;
        const ordemMudou = c.ordem !== def.ordemPadrao;
        const secaoMudou = !!String((c as any).secao_customizada || "").trim();

        let opcoesMudou = false;
        let opcoesFinal: string[] | null = null;
        if (def.tipo === "dropdown") {
          const opcoesAtuais = (c.opcoes || []).filter(o => String(o).trim());
          const opcoesPadrao = def.opcoes || [];
          opcoesMudou = JSON.stringify(opcoesAtuais) !== JSON.stringify(opcoesPadrao);
          if (opcoesMudou) opcoesFinal = opcoesAtuais;
        }

        const placeholderMudou = (c.placeholder || "").trim() !== (def.placeholderPadrao || "");
        const placeholderFinal = placeholderMudou ? (c.placeholder || null) : null;
        const mostrarNaListaAtual = !!(c as any).mostrar_na_lista;
        const mostrarMudou = mostrarNaListaAtual !== false;

        const labelCustomFinal = labelMudou ? c.label.trim() : null;
        const obrigatorioFinal = obrigMudou ? c.obrigatorio : null;
        const ordemFinal = ordemMudou ? c.ordem : null;

        if (!labelMudou && !obrigMudou && !ordemMudou && !secaoMudou && !opcoesMudou && !placeholderMudou && !mostrarMudou && c.visivel) {
          if (c.idConfig) {
            await supabase.from("proposta_campos_padrao_config")
              .delete()
              .eq("id", c.idConfig)
              .eq("workspace_id", workspace.username);
          }
          continue;
        }

        const payload: any = {
          workspace_id: workspace.username,
          campo_slug: c.slug,
          label_custom: labelCustomFinal,
          obrigatorio: obrigatorioFinal,
          visivel: c.visivel,
          ordem: ordemFinal,
          opcoes: opcoesFinal,
          placeholder_custom: placeholderFinal,
          secao_customizada: String((c as any).secao_customizada || "").trim() || null,
          mostrar_na_lista: mostrarNaListaAtual,
        };

        if (c.idConfig) {
          await supabase.from("proposta_campos_padrao_config")
            .update(payload)
            .eq("id", c.idConfig)
            .eq("workspace_id", workspace.username);
        } else {
          await supabase.from("proposta_campos_padrao_config")
            .insert([payload]);
        }
      }

      const customsNaLista = campos.filter(c => c.origem === "custom");
      const customsComSlug = customsNaLista.map(c => ({
        ...c,
        slug: (c.slug || labelToSlug(c.label)).slice(0, 50),
      }));

      const slugSet = new Set<string>();
      for (const c of customsComSlug) {
        if (!c.slug) {
          alert(`Campo "${c.label}" não conseguiu gerar slug. Renomeie.`);
          setSalvando(false); return;
        }
        if (slugSet.has(c.slug)) {
          alert(`Campos customizados com nome interno duplicado ("${c.slug}"). Renomeie um.`);
          setSalvando(false); return;
        }
        if (CAMPOS_FIXOS_MAP[c.slug]) {
          alert(`O nome "${c.slug}" conflita com um campo padrão. Escolha outro nome pro campo "${c.label}".`);
          setSalvando(false); return;
        }
        slugSet.add(c.slug);
      }

      const { data: existentes } = await supabase
        .from("proposta_campos_customizados")
        .select("id, slug")
        .eq("workspace_id", workspace.username);
      const slugsExistentes = new Map<string, number>((existentes || []).map(x => [x.slug, x.id]));

      for (const c of customsComSlug) {
        const existeId = slugsExistentes.get(c.slug);
        const mostrarNaLista = !!(c as any).mostrar_na_lista;
        if (existeId) {
          await supabase.from("proposta_campos_customizados").update({
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
            ativo: true,
            placeholder: c.placeholder || null,
            secao_customizada: (c as any).secao_customizada?.trim() || null,
            secao_cor: (c as any).secao_cor || null,
            mostrar_na_lista: mostrarNaLista,
          }).eq("id", existeId).eq("workspace_id", workspace.username);
        } else {
          await supabase.from("proposta_campos_customizados").insert([{
            workspace_id: workspace.username,
            slug: c.slug,
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
            ativo: true,
            placeholder: c.placeholder || null,
            secao_customizada: (c as any).secao_customizada?.trim() || null,
            secao_cor: (c as any).secao_cor || null,
            mostrar_na_lista: mostrarNaLista,
          }]);
        }
      }

      alert("Configurações salvas com sucesso!");
      await fetchCampos();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  // 📊 Agrupa em SEQUÊNCIAS CONSECUTIVAS da mesma seção (permite reflexo fiel da ordem)
  const grupos = useMemo(() => {
    const result: any[] = [];
    let grupoAtual: any = null;
    let secaoAtual: string | null = null;
    for (let i = 0; i < campos.length; i++) {
      const sec = getSecaoKey(campos, i);
      if (sec !== secaoAtual) {
        const nomeSecaoCustomizada = sec.startsWith("custom:")
          ? String((campos[i] as any).secao_customizada || "").trim()
          : "";
        const labelRaw = (SECOES_LABEL as any)?.[sec];
        const label = nomeSecaoCustomizada || (typeof labelRaw === "string"
          ? labelRaw
          : (labelRaw?.titulo || labelRaw?.label || labelRaw?.nome || SECAO_META[sec]?.descricao || sec));
        const campoComCor = sec.startsWith("custom:")
          ? campos.find((item, indice) => getSecaoKey(campos, indice) === sec && /^#[0-9a-fA-F]{6}$/.test(String((item as any).secao_cor || "")))
          : null;
        const corSecaoCustomizada = campoComCor ? String((campoComCor as any).secao_cor) : null;
        const corCustom = corSecaoCustomizada || ((labelRaw && typeof labelRaw === "object" && labelRaw.cor) ? labelRaw.cor : null);
        const metaBase = SECAO_META[sec] || { icone: "📋", cor: "#64748B", descricao: "", ordem: 99 };
        grupoAtual = {
          key: sec,
          keyUnica: `${sec}-${result.length}`,
          label,
          meta: corCustom ? { ...metaBase, cor: corCustom } : metaBase,
          itens: [] as { campo: CampoUnificado; idx: number }[],
        };
        result.push(grupoAtual);
        secaoAtual = sec;
      }
      grupoAtual.itens.push({ campo: campos[i], idx: i });
    }
    return result;
  }, [campos]);

  // Seções únicas pra sidebar (consolidadas)
  const secoesUnicas = useMemo(() => {
    const vistas = new Set<string>();
    const lista: { key: string; meta: any; label: string; total: number; primeiraKeyUnica: string }[] = [];
    for (const g of grupos) {
      if (vistas.has(g.key)) {
        const existente = lista.find(s => s.key === g.key);
        if (existente) existente.total += g.itens.length;
        continue;
      }
      vistas.add(g.key);
      lista.push({ key: g.key, meta: g.meta, label: g.label, total: g.itens.length, primeiraKeyUnica: g.keyUnica });
    }
    // Soma totais de todas as ocorrências
    for (const s of lista) {
      s.total = grupos.filter(g => g.key === s.key).reduce((acc, g) => acc + g.itens.length, 0);
    }
    return lista;
  }, [grupos]);

  const opcoesDestinoSecao = useMemo(() => {
    const padroes = Object.entries(SECOES_LABEL).map(([key, meta]: any) => ({ value: `@${key}`, label: meta?.titulo || meta?.label || key, cor: meta?.cor || "#64748B" }));
    const personalizadas = new Map<string, string>();
    for (const campo of campos) {
      const nome = String((campo as any).secao_customizada || "").trim();
      if (!nome || nome.startsWith("@")) continue;
      const cor = /^#[0-9a-fA-F]{6}$/.test(String((campo as any).secao_cor || "")) ? String((campo as any).secao_cor) : "#0F766E";
      if (!personalizadas.has(nome)) personalizadas.set(nome, cor);
    }
    return [...padroes, ...Array.from(personalizadas, ([label, cor]) => ({ value: label, label, cor }))];
  }, [campos]);

  const stats = useMemo(() => ({
    total: campos.length,
    fixos: campos.filter(c => c.origem === "fixo").length,
    custom: campos.filter(c => c.origem === "custom").length,
    visiveis: campos.filter(c => c.visivel).length,
    obrigatorios: campos.filter(c => c.obrigatorio).length,
    mostrarLista: campos.filter(c => (c as any).mostrar_na_lista).length,
    removidos: camposRemovidos.length,
  }), [campos, camposRemovidos]);

  const buscaLower = busca.trim().toLowerCase();
  const matchaBusca = (c: CampoUnificado) => {
    if (!buscaLower) return true;
    return c.label.toLowerCase().includes(buscaLower) || c.slug.toLowerCase().includes(buscaLower);
  };

  if (!podeEditar) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, background: "#FEF2F2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 auto 16px" }}><IconeEmoji e={"🔒"} tamanho={28} /></div>
          <h1 style={{ color: "#0F172A", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#64748B", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>
            Só o dono ou administrador do workspace pode editar os campos da proposta.
          </p>
          <button onClick={() => router.back()}
            style={{
              background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
              color: "white", border: "none", borderRadius: 12,
              padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
            }}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F3F6F5", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>

      {/* HEADER STICKY */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(243,246,245,0.88)",
        backdropFilter: "blur(12px)",
        padding: isMobile ? "10px 12px" : "12px 28px",
      }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: isMobile ? 40 : 46, height: isMobile ? 40 : 46, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={"🛠️"} tamanho={18} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ color: "#0F172A", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Editor de Proposta</h1>
                <span style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>· {stats.total} campos</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                <p style={{ color: "#64748B", fontSize: 11, margin: 0 }}>
                  Wolf CRM · <b>{workspace?.nome}</b>
                </p>
                <span style={{ color: "#94A3B8", fontSize: 11 }}>
                  {stats.fixos} fixos · {stats.custom} personalizados · {stats.visiveis} visíveis · {stats.obrigatorios} obrigatórios
                </span>
                {dirty && <span style={{ fontSize: 12, color: "#C2410C", fontWeight: 700, fontStyle: "italic" }}>● mudanças não salvas</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => {
              if (dirty && !confirm("Você tem mudanças não salvas. Sair mesmo assim?")) return;
              router.push("/crm/vendas");
            }}
              style={{
                background: "#ffffff", color: "#334155", border: "none", boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 6px 16px -10px rgba(16,24,40,.25)",
                borderRadius: 12, padding: "8px 14px", fontSize: 13.5, cursor: "pointer",
                whiteSpace: "nowrap", fontWeight: 600,
              }}>Voltar</button>
            <button onClick={salvar} disabled={salvando || loading}
              title="Ctrl+S"
              style={{
                background: salvando ? "#047857" : "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
                color: "white", border: "none", borderRadius: 12,
                padding: "10px 20px", fontSize: 13.5, fontWeight: 800,
                cursor: salvando || loading ? "not-allowed" : "pointer",
                boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
                whiteSpace: "nowrap",
              }}>
              {salvando ? "⏳ Salvando..." : "Salvar Tudo"}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
        gap: isMobile ? 14 : 22,
        padding: isMobile ? 12 : 28,
        maxWidth: 1400,
        margin: "0 auto",
      }}>

        {/* SIDEBAR */}
        {!isMobile && (
          <aside style={{ position: "sticky", top: 100, alignSelf: "start", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...cardStyle, padding: 14 }}>
              <p style={{ color: "#94A3B8", fontSize: 12, margin: "0 0 10px", fontWeight: 700 }}>
                Seções
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {secoesUnicas.map(s => {
                  const ativa = secaoVisivel === s.primeiraKeyUnica || grupos.some(g => g.key === s.key && g.keyUnica === secaoVisivel);
                  return (
                    <button key={s.key} onClick={() => {
                      sectionsRef.current[s.primeiraKeyUnica]?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                      style={{
                        background: ativa ? "#ECFDF5" : "transparent",
                        border: "none",
                        borderRadius: 8, padding: "8px 10px",
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.15s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{<IconeEmoji e={s.meta.icone} />}</span>
                        <span style={{ color: ativa ? s.meta.cor : "#334155", fontSize: 12, fontWeight: ativa ? 800 : 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {semEmojiTxt(s.label)}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 800,
                          color: ativa ? s.meta.cor : "#94A3B8",
                          background: ativa ? `${s.meta.cor}15` : "#F1F5F4",
                          padding: "1px 7px", borderRadius: 6,
                        }}>
                          {s.total}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 14, background: "linear-gradient(135deg, #ECFDF5 0%, #fae8ff 100%)", border: "1px solid #A7F3D0" }}>
              <p style={{ color: "#6b21a8", fontSize: 12, margin: "0 0 8px", fontWeight: 800 }}>
                Resumo
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Stat label="Visíveis" valor={`${stats.visiveis}/${stats.total}`} cor="#14B8A6" />
                <Stat label="Obrigatórios" valor={stats.obrigatorios.toString()} cor="#059669" />
                <Stat label="Na tela principal" valor={stats.mostrarLista.toString()} cor="#C2410C" />
                <Stat label="Personalizados" valor={stats.custom.toString()} cor="#a855f7" />
                <Stat label="Removidos" valor={stats.removidos.toString()} cor="#dc2626" />
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 14, background: "#ffffff" }}>
              <p style={{ color: "#94A3B8", fontSize: 12, margin: "0 0 8px", fontWeight: 700 }}>
                Atalho
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                <span style={{ color: "#64748B" }}>Salvar</span>
                <kbd style={{ background: "#ffffff", border: "1px solid #CBD5E1", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", color: "#334155", fontWeight: 700 }}>Ctrl+S</kbd>
              </div>
            </div>
          </aside>
        )}

        {/* CONTEÚDO */}
        <main style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          <div style={{ ...cardStyle, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Buscar campo por nome..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...inputStyle, flex: "1 1 240px", maxWidth: 400, borderRadius: 20 }} />
            <div style={{ flex: 1 }} />
            <button onClick={adicionarSecao}
              style={{
                background: "#ffffff", color: "#047857", border: "1px solid #6EE7B7", borderRadius: 10,
                padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}>{"+ Nova seção"}</button>
            <button onClick={() => adicionarCustom()}
              style={{
                background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
                whiteSpace: "nowrap",
              }}>+ Campo Personalizado</button>
          </div>

          <div style={{ background: "#F7FFFB", border: "none", boxShadow: "inset 0 0 0 1.5px #A7F3D0", borderRadius: 12, padding: "10px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <IconeEmoji e="💡" tamanho={18} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#065F46", fontSize: 12, fontWeight: 700, margin: 0 }}>Setas ↑▼ movem livremente</p>
              <p style={{ color: "#059669", fontSize: 11, margin: "2px 0 0", lineHeight: 1.5 }}>
                Você pode mover qualquer campo pra qualquer posição. Os campos personalizados <b>herdam automaticamente a seção</b> do campo padrão anterior — então onde você colocar aqui, é exatamente onde vai aparecer na <b>Nova Proposta</b>.
              </p>
            </div>
          </div>

          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...cardStyle, padding: 20 }}>
                  <div style={{ height: 16, background: "#F1F5F4", borderRadius: 4, marginBottom: 14, width: "30%" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2, 3].map(j => (
                      <div key={j} style={{ height: 60, background: "#F7FAF9", borderRadius: 8 }} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : campos.length === 0 ? (
            <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="pasta" tamanho={24} /></span>
              <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum campo configurado ainda.</p>
            </div>
          ) : (
            grupos.map(g => {
              const itensFiltrados = g.itens.filter(({ campo }: any) => matchaBusca(campo));
              if (buscaLower && itensFiltrados.length === 0) return null;

              return (
                <div key={g.keyUnica}
                  ref={(el) => { sectionsRef.current[g.keyUnica] = el; }}
                  data-secao={g.keyUnica}
                  style={{ ...cardStyle, overflow: "hidden", scrollMarginTop: 110 }}>

                  <div style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #F1F5F4",
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.meta.cor}14`, color: g.meta.cor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={g.meta.icone} tamanho={16} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ color: "#0F172A", fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-.01em" }}>{semEmojiTxt(g.label)}</h2>
                      {g.meta.descricao && <p style={{ color: "#94A3B8", fontSize: 11, margin: "2px 0 0" }}>{g.meta.descricao}</p>}
                    </div>
                    {g.key.startsWith("custom:") && <>
                      <label title="Escolher cor da se\u00e7\u00e3o" style={{ width: 32, height: 32, borderRadius: 8, background: "#F3F6F5", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
                        <input type="color" value={g.meta.cor} onChange={evento => alterarCorSecao(g.label, evento.target.value)} style={{ width: 42, height: 42, border: 0, padding: 0, background: "transparent", cursor: "pointer" }} />
                      </label>
                      <button type="button" onClick={() => adicionarCustom(g.label, g.meta.cor)} style={{ background: "#fff", color: g.meta.cor, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Campo</button>
                      <button type="button" onClick={() => renomearSecao(g.label)} title="Renomear se\u00e7\u00e3o" style={{ background: "#F3F6F5", color: "#64748B", borderRadius: 8, padding: "6px 9px", fontSize: 12, cursor: "pointer" }}>{"✏️"}</button>
                    </>}
                    <span style={{
                      background: `${g.meta.cor}10`,
                      color: g.meta.cor,
                      border: `1px solid ${g.meta.cor}30`,
                      padding: "4px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}>{g.itens.length} {g.itens.length === 1 ? "campo" : "campos"}</span>
                  </div>

                  <div style={{ padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {itensFiltrados.map(({ campo, idx }: any) => (
                      <CampoCard
                        key={`${campo.origem}-${campo.slug}-${idx}`}
                        campo={campo}
                        idx={idx}
                        totalCampos={campos.length}
                        secaoMeta={g.meta}
                        opcoesSecao={opcoesDestinoSecao}
                        inputStyle={inputStyle}
                        isMobile={isMobile}
                        atualizar={atualizar}
                        mover={mover}
                        remover={remover}
                        adicionarOpcao={adicionarOpcao}
                        atualizarOpcao={atualizarOpcao}
                        removerOpcao={removerOpcao}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {!loading && camposRemovidos.length > 0 && (
            <div style={{ ...cardStyle, overflow: "hidden", border: "1px solid #fecaca" }}>
              <div style={{ padding: "14px 20px", background: "#fef2f2", borderBottom: removidosAbertos ? "1px solid #fecaca" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h2 style={{ color: "#991b1b", fontSize: 14, fontWeight: 800, margin: 0 }}>Campos removidos deste workspace</h2>
                  <p style={{ color: "#b91c1c", fontSize: 11, margin: "3px 0 0" }}>Não aparecem no CRM nem nos fluxos. Os dados históricos continuam preservados.</p>
                </div>
                <button type="button" onClick={() => setRemovidosAbertos(aberto => !aberto)} aria-expanded={removidosAbertos} aria-label={removidosAbertos ? "Recolher campos removidos" : "Mostrar campos removidos"} style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}><span>{camposRemovidos.length}</span><span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{removidosAbertos ? "\u25B2" : "\u25BC"}</span></button>
              </div>
              {removidosAbertos && <div style={{ padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {camposRemovidos.map(campo => (
                  <div key={`removido-${campo.origem}-${campo.slug}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#F7FAF9", borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: "block", color: "#334155", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campo.label}</span>
                      <span style={{ color: "#94A3B8", fontSize: 12 }}>{campo.origem === "fixo" ? "Campo padrão removido neste workspace" : "Campo personalizado removido"}</span>
                    </div>
                    <button type="button" onClick={() => restaurar(campo)} style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Restaurar</button>
                  </div>
                ))}
              </div>}
            </div>
          )}
          {!loading && campos.length > 0 && (
            <div style={{ ...cardStyle, padding: isMobile ? 14 : 18, background: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={dirty ? "📝" : "✅"} tamanho={18} /></div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: "#0F172A", fontSize: 14, fontWeight: 800, margin: 0 }}>
                    {dirty ? "Você tem mudanças não salvas" : "Tudo salvo e sincronizado"}
                  </p>
                  <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
                    {stats.total} campos configurados · {stats.visiveis} visíveis · {stats.obrigatorios} obrigatórios
                  </p>
                </div>
                <button onClick={salvar} disabled={salvando || loading}
                  style={{
                    background: salvando ? "#047857" : "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
                    color: "white", border: "none", borderRadius: 10,
                    padding: "11px 28px", fontSize: 13, fontWeight: 700,
                    cursor: salvando || loading ? "not-allowed" : "pointer",
                    boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
                    whiteSpace: "nowrap",
                  }}>{salvando ? "⏳ Salvando..." : "Salvar Tudo"}</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
      <span style={{ color: "#64748B" }}>{label}</span>
      <span style={{ color: cor, fontWeight: 800 }}>{valor}</span>
    </div>
  );
}

function CampoCard({ campo, idx, totalCampos, secaoMeta, opcoesSecao, inputStyle, isMobile, atualizar, mover, remover, adicionarOpcao, atualizarOpcao, removerOpcao }: any) {
  const ehFixo = campo.origem === "fixo";
  const corBadge = ehFixo ? "#14B8A6" : "#a855f7";
  const bgBadge = ehFixo ? "#F0FDFA" : "#f3e8ff";
  const borderBadge = ehFixo ? "#99F6E4" : "#99F6E4";
  const labelBadge = ehFixo ? "Padrão" : "Personalizado";
  const opacidade = !campo.visivel ? 0.55 : 1;

  // 🆕 Move globalmente: só desabilita nos extremos da lista
  const ehPrimeiroGlobal = idx === 0;
  const ehUltimoGlobal = idx === totalCampos - 1;

  return (
    <div style={{
      background: "#F7FAF9",
      borderRadius: 10,
      padding: 14,
      opacity: opacidade,
      transition: "opacity 0.15s",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "auto 1fr auto" : "auto auto 1fr auto auto", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <button onClick={() => mover(idx, -1)} disabled={ehPrimeiroGlobal} title={ehPrimeiroGlobal ? "Já é o primeiro" : "Mover pra cima"}
            style={{
              background: "#F3F6F5",
              color: ehPrimeiroGlobal ? "#CBD5E1" : "#64748B",
              borderRadius: 6, width: 26, height: 20, fontSize: 11,
              cursor: ehPrimeiroGlobal ? "not-allowed" : "pointer", lineHeight: 1, fontWeight: 700,
            }}>▲</button>
          <button onClick={() => mover(idx, 1)} disabled={ehUltimoGlobal} title={ehUltimoGlobal ? "Já é o último" : "Mover pra baixo"}
            style={{
              background: "#F3F6F5",
              color: ehUltimoGlobal ? "#CBD5E1" : "#64748B",
              borderRadius: 6, width: 26, height: 20, fontSize: 11,
              cursor: ehUltimoGlobal ? "not-allowed" : "pointer", lineHeight: 1, fontWeight: 700,
            }}>▼</button>
        </div>

        {!isMobile && (
          <span style={{
            background: bgBadge, color: corBadge,
            border: `1px solid ${borderBadge}`,
            padding: "4px 10px", borderRadius: 10, fontSize: 12,
            fontWeight: 700, whiteSpace: "nowrap",
          }}>{labelBadge}</span>
        )}

        <div>
          <input
            value={campo.label}
            onChange={(e) => atualizar(idx, { label: e.target.value })}
            placeholder={ehFixo ? campo.labelPadrao : 'Ex: "CEP do Imóvel", "Operadora atual"'}
            style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }}
          />
          {ehFixo && campo.label !== campo.labelPadrao && (
            <p style={{ color: "#94A3B8", fontSize: 12, margin: "4px 0 0", fontStyle: "italic" }}>
              Padrão: {campo.labelPadrao} · slug: <code style={{ color: "#64748B", background: "#F1F5F4", padding: "1px 5px", borderRadius: 4, border: "1px solid #E6ECEA" }}>{campo.slug}</code>
            </p>
          )}
        </div>

        {!isMobile && (ehFixo ? (
          <div style={{ minWidth: 160 }}>
            <span style={{ background: "#F1F5F4", color: "#475569", border: "1px solid #E6ECEA", padding: "9px 14px", borderRadius: 10, fontSize: 12, display: "block", textAlign: "center", fontWeight: 600 }}>
              {campo.tipo === "vendedor" ? "Vendedor" : campo.tipo === "telefone" ? "Telefone" : campo.tipo === "email" ? "E-mail" : campo.tipo === "data" ? "Data" : campo.tipo === "moeda" ? "Valor (R$)" : campo.tipo === "dropdown" ? "Seleção" : "Texto"}
            </span>
          </div>
        ) : (
          <select
            value={campo.tipo}
            onChange={(e) => {
              const novoTipo = e.target.value as TipoCustom;
              atualizar(idx, { tipo: novoTipo, opcoes: novoTipo === "dropdown" ? (campo.opcoes || [""]) : [] });
            }}
            style={{ ...inputStyle, minWidth: 170 }}
          >
            {TIPOS_CUSTOM.map(t => <option key={t.valor} value={t.valor}>{t.icone} {t.label}</option>)}
          </select>
        ))}

        <button onClick={() => remover(idx)}
          title="Excluir campo deste workspace"
          style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            border: "none",
            borderRadius: 10, padding: "9px 12px", fontSize: 14,
            cursor: "pointer", height: 38, whiteSpace: "nowrap", fontWeight: 600,
          }}><Icone nome="lixeira" tamanho={15} /></button>
      </div>

      {isMobile && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            background: bgBadge, color: corBadge,
            border: `1px solid ${borderBadge}`,
            padding: "3px 10px", borderRadius: 10, fontSize: 12,
            fontWeight: 700, whiteSpace: "nowrap",
          }}>{labelBadge}</span>
          {ehFixo ? (
            <span style={{ background: "#F1F5F4", color: "#475569", border: "1px solid #E6ECEA", padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
              {campo.tipo === "vendedor" ? "Vendedor" : campo.tipo === "telefone" ? "Telefone" : campo.tipo === "email" ? "E-mail" : campo.tipo === "data" ? "Data" : campo.tipo === "moeda" ? "Valor" : campo.tipo === "dropdown" ? "Seleção" : "Texto"}
            </span>
          ) : (
            <select value={campo.tipo}
              onChange={(e) => {
                const novoTipo = e.target.value as TipoCustom;
                atualizar(idx, { tipo: novoTipo, opcoes: novoTipo === "dropdown" ? (campo.opcoes || [""]) : [] });
              }}
              style={{ ...inputStyle, flex: 1, padding: "5px 10px", fontSize: 12 }}>
              {TIPOS_CUSTOM.map(t => <option key={t.valor} value={t.valor}>{t.icone} {t.label}</option>)}
            </select>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "5px 9px", borderRadius: 8 }}>
          <span style={{ color: "#065F46", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{"Seção:"}</span>
          <select value={String(campo.secao_customizada || "")} onChange={evento => {
            const valor = evento.target.value;
            const opcao = (opcoesSecao || []).find((item: any) => item.value === valor);
            atualizar(idx, { secao_customizada: valor || null, secao_cor: valor && !valor.startsWith("@") ? (opcao?.cor || campo.secao_cor || "#0F766E") : null });
          }} style={{ background: "#fff", color: "#334155", border: "1px solid #A7F3D0", borderRadius: 6, padding: "4px 7px", fontSize: 11, minWidth: 170 }}>
            <option value="">{ehFixo ? "Se\u00e7\u00e3o original" : "Herdar pela posi\u00e7\u00e3o"}</option>
            {(opcoesSecao || []).map((opcao: any) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
          </select>
        </label>
        <label style={{
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          background: campo.obrigatorio ? "#ECFDF5" : "#ffffff",
          border: `1px solid ${campo.obrigatorio ? "#A7F3D0" : "#E6ECEA"}`,
          padding: "5px 11px", borderRadius: 8,
        }}>
          <input type="checkbox" checked={campo.obrigatorio}
            onChange={(e) => atualizar(idx, { obrigatorio: e.target.checked })}
            style={{ accentColor: "#059669", width: 14, height: 14, cursor: "pointer" }} />
          <span style={{ color: campo.obrigatorio ? "#059669" : "#64748B", fontSize: 11, fontWeight: 600 }}>Obrigatório</span>
        </label>



        <label style={{
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          background: (campo as any).mostrar_na_lista ? "#FFF7ED" : "#ffffff",
          border: `1px solid ${(campo as any).mostrar_na_lista ? "#fde68a" : "#E6ECEA"}`,
          padding: "5px 11px", borderRadius: 8,
        }}>
          <input type="checkbox" checked={!!(campo as any).mostrar_na_lista}
            onChange={(e) => atualizar(idx, { mostrar_na_lista: e.target.checked } as any)}
            style={{ accentColor: "#C2410C", width: 14, height: 14, cursor: "pointer" }} />
          <span style={{ color: (campo as any).mostrar_na_lista ? "#C2410C" : "#64748B", fontSize: 11, fontWeight: 600 }}>
            Tela principal
          </span>
        </label>

        {(campo.tipo === "texto" || campo.tipo === "textarea" || campo.tipo === "numero" || campo.tipo === "moeda" || campo.tipo === "telefone" || campo.tipo === "email") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
            <span style={{ color: "#64748B", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Placeholder:</span>
            <input placeholder="Texto de exemplo (opcional)"
              value={campo.placeholder || ""}
              onChange={(e) => atualizar(idx, { placeholder: e.target.value })}
              style={{ ...inputStyle, padding: "5px 10px", fontSize: 11, flex: 1 }} />
          </div>
        )}
      </div>

      {campo.tipo === "dropdown" && (
        <div style={{ marginTop: 12, padding: 12, background: "#F7FAF9", borderRadius: 10 }}>
          <p style={{ color: "#64748B", fontSize: 11, margin: "0 0 8px", fontWeight: 700 }}>
            Opções do dropdown
            {ehFixo && (
              <span style={{ color: "#94A3B8", fontSize: 12, marginLeft: 8, textTransform: "none", fontWeight: 500, fontStyle: "italic" }}>
                (você pode editar — vai sobrescrever a do sistema)
              </span>
            )}
          </p>
          {(campo.opcoes || []).map((op: string, opIdx: number) => (
            <div key={opIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input placeholder={`Opção ${opIdx + 1}`} value={op}
                onChange={(e) => atualizarOpcao(idx, opIdx, e.target.value)}
                style={{ ...inputStyle, padding: "6px 12px", fontSize: 12 }} />
              <button onClick={() => removerOpcao(idx, opIdx)}
                style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}><Icone nome="x" tamanho={16} /></button>
            </div>
          ))}
          <button onClick={() => adicionarOpcao(idx)}
            style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700, marginTop: 4 }}>
            Adicionar opção
          </button>
          {ehFixo && campo.slug === "status_venda" && (
            <p style={{ color: "#92400e", fontSize: 12, margin: "10px 0 0", fontStyle: "italic", background: "#FFF7ED", padding: "6px 10px", borderRadius: 6, border: "1px solid #fde68a" }}>
              Status novos não terão cor personalizada na lista de vendas — vão aparecer em cinza.
            </p>
          )}
        </div>
      )}
    </div>
  );
}