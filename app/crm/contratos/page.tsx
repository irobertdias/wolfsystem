"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import styles from "./page.module.css";

type StatusFiltro = "todos" | "assinados" | "pendentes" | "expirados" | "problemas";
type PapelSignatario = "empresa" | "cliente" | "testemunha" | "interveniente" | "outro";
type MeioOtp = "whatsapp" | "email";
type SignatarioContrato = {
  id?: string; papel: PapelSignatario; papel_label?: string; ordem: number; nome: string;
  email?: string; numero?: string; otp_meio?: MeioOtp; status: string; assinatura_em?: string | null;
};
type ParticipanteAdicional = {
  id_local: string; papel: PapelSignatario; papel_label: string;
  nome: string; cpf: string; email: string; numero: string; otp_meio: MeioOtp;
};
type Contrato = {
  id: string;
  canal_id?: number | null;
  numero?: string | null;
  fluxo_id?: number | null;
  origem?: "fluxo" | "crm" | "avulso";
  proposta_id?: number | null;
  criado_por?: string | null;
  modo_assinatura?: string;
  signatarios?: SignatarioContrato[];
  status: string;
  nome_signatario: string;
  cpf_ultimos4?: string | null;
  email_signatario?: string | null;
  contrato_nome: string;
  contrato_hash_original: string;
  contrato_hash_assinado?: string | null;
  biometria_status: string;
  otp_confirmado_em?: string | null;
  consentimento_versao?: string | null;
  assinatura_em?: string | null;
  ip_assinatura?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  auditoria_hmac?: string | null;
  expira_em: string;
  concluida_em?: string | null;
  created_at: string;
  exigir_documento_identidade?: boolean;
};
type ClienteCRM = { id: number; nome: string; cpf?: string; email?: string; telefone1?: string; telefone2?: string; endereco?: string; cep?: string; cidade?: string; estado?: string };
type Conexao = { id: number; nome: string; tipo: string; status: string; numero?: string };
type Representante = { id: string; nome: string; cargo: string; email: string; numero: string; padrao: boolean };
type FormContrato = {
  representante_id: string; origem: "crm" | "avulso"; proposta_id: string; nome: string; cpf: string;
  email: string; telefone: string; canal_id: string; otp_meio_representante: MeioOtp; otp_meio_cliente: MeioOtp;
  participantes_adicionais: ParticipanteAdicional[]; titulo: string; conteudo: string; pdf_base64: string;
  pdf_nome: string; mensagem: string; expira_horas: number; exigir_localizacao: boolean; exigir_documento_identidade: boolean;
};
const FORM_INICIAL: FormContrato = {
  representante_id: "", origem: "crm", proposta_id: "", nome: "", cpf: "", email: "", telefone: "",
  canal_id: "", otp_meio_representante: "email", otp_meio_cliente: "email", participantes_adicionais: [],
  titulo: "Contrato de prestação de serviços", conteudo: "", pdf_base64: "", pdf_nome: "",
  mensagem: "Olá, {{nome}}. Seu contrato está pronto para revisão e assinatura: {{link}}",
  expira_horas: 48, exigir_localizacao: false, exigir_documento_identidade: false,
};
type Resumo = { total: number; assinados: number; pendentes: number; expirados: number; problemas: number };
type Paginacao = { pagina: number; limite: number; total: number; paginas: number };
type PlanoUso = { nome: "essencial" | "profissional" | "empresarial"; limite_mensal: number | null; usados_mes: number };

const STATUS: Record<string, { label: string; className: string }> = {
  concluida: { label: "Assinado", className: styles.statusSigned },
  pendente: { label: "Pendente", className: styles.statusPending },
  expirada: { label: "Expirado", className: styles.statusExpired },
  recusada: { label: "Recusado", className: styles.statusProblem },
  revogada: { label: "Revogado", className: styles.statusProblem },
  erro: { label: "Erro", className: styles.statusProblem },
};

function dataHora(valor?: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}
function curto(valor?: string | null, tamanho = 18) {
  if (!valor) return "—";
  return valor.length <= tamanho ? valor : `${valor.slice(0, tamanho)}…`;
}

export default function ContratosPage() {
  const router = useRouter();
  const { permissoes, isDono, isSuperAdmin, perfil, workspaceId, loading: permissaoCarregando } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();
  const permitidoPorPerfil = isDono || perfil === "Administrador" || permissoes.contratos_acessar;
  const permitido = isSuperAdmin || (modulosCarregados && modulos.contratos_assinaturas && permitidoPorPerfil);
  const acessoTotalContratos = isSuperAdmin || isDono || perfil === "Administrador";
  const podeCriar = acessoTotalContratos || permissoes.contratos_criar;
  const podeEditar = acessoTotalContratos || permissoes.contratos_editar;
  const podeReenviar = acessoTotalContratos || permissoes.contratos_reenviar;
  const podeExcluir = acessoTotalContratos || permissoes.contratos_excluir;
  const podeBaixar = acessoTotalContratos || permissoes.contratos_baixar;
  const podeConfigurar = acessoTotalContratos || permissoes.contratos_configurar;
  const [resumo, setResumo] = useState<Resumo>({ total: 0, assinados: 0, pendentes: 0, expirados: 0, problemas: 0 });
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [paginacao, setPaginacao] = useState<Paginacao>({ pagina: 1, limite: 25, total: 0, paginas: 1 });
  const [planoUso, setPlanoUso] = useState<PlanoUso>({ nome: "essencial", limite_mensal: 20, usados_mes: 0 });
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<Contrato | null>(null);
  const [baixando, setBaixando] = useState("");
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [reenviando, setReenviando] = useState("");
  const [excluindo, setExcluindo] = useState("");
  const [copiandoLink, setCopiandoLink] = useState("");
  const [clientes, setClientes] = useState<ClienteCRM[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [formContrato, setFormContrato] = useState<FormContrato>({ ...FORM_INICIAL });

  useEffect(() => {
    if (!permissaoCarregando && modulosCarregados && !permitido) router.replace("/crm/visao");
  }, [permissaoCarregando, modulosCarregados, permitido, router]);

  const requisicao = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Falha ao consultar contratos" }));
      throw new Error(data.error || "Falha ao consultar contratos");
    }
    return response;
  }, []);

  const carregar = useCallback(async (pagina = 1, silencioso = false) => {
    if (!workspaceId || !permitido) return;
    silencioso ? setAtualizando(true) : setCarregando(true);
    setErro("");
    try {
      const query = new URLSearchParams({
        workspaceId,
        pagina: String(pagina),
        limite: "25",
        status: filtro,
      });
      if (buscaAplicada) query.set("busca", buscaAplicada);
      const response = await requisicao(`/api/contratos?${query.toString()}`);
      const data = await response.json();
      setResumo(data.resumo || { total: 0, assinados: 0, pendentes: 0, expirados: 0, problemas: 0 });
      setPlanoUso(data.plano || { nome: "essencial", limite_mensal: 20, usados_mes: 0 });
      setContratos(data.contratos || []);
      setPaginacao(data.paginacao || { pagina: 1, limite: 25, total: 0, paginas: 1 });
    } catch (e: any) {
      setErro(e.message || "Não foi possível carregar os contratos");
      setContratos([]);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [buscaAplicada, filtro, permitido, requisicao, workspaceId]);

  useEffect(() => { void carregar(1); }, [carregar]);

  const cards = useMemo(() => [
    { key: "todos" as const, icon: "📄", label: "Contratos gerados", value: resumo.total, note: "Todos os documentos", color: "blue" },
    { key: "assinados" as const, icon: "✅", label: "Assinados", value: resumo.assinados, note: "Concluídos com auditoria", color: "green" },
    { key: "pendentes" as const, icon: "🕒", label: "Pendentes", value: resumo.pendentes, note: "Aguardando o cliente", color: "amber" },
    { key: "expirados" as const, icon: "⌛", label: "Expirados", value: resumo.expirados, note: "Link fora da validade", color: "slate" },
    { key: "problemas" as const, icon: "⚠️", label: "Recusados / erros", value: resumo.problemas, note: "Precisam de atenção", color: "red" },
  ], [resumo]);

  async function abrirNovoContrato() {
    setErro("");
    try {
      const response = await requisicao(`/api/contratos/clientes?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = await response.json();
      setClientes(data.clientes || []);
      setConexoes(data.conexoes || []);
      const empresaResponse = await requisicao(`/api/contratos/empresa?workspaceId=${encodeURIComponent(workspaceId)}`);
      const empresaData = await empresaResponse.json();
      const reps: Representante[] = empresaData.representantes || [];
      if (!reps.length) throw new Error("Cadastre a empresa e ao menos um representante antes de criar contratos");
      setRepresentantes(reps);
      setFormContrato({ ...FORM_INICIAL, representante_id: String(reps.find(r => r.padrao)?.id || reps[0]?.id || ""), canal_id: String(data.conexoes?.find((c: Conexao) => c.status === "conectado")?.id || data.conexoes?.[0]?.id || "") });
      setCriando(true);
    } catch (e: any) { setErro(e.message || "Não foi possível preparar o novo contrato"); }
  }

  async function abrirEditarContrato(contrato: Contrato) {
    setErro("");
    try {
      const response = await requisicao(`/api/contratos/clientes?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = await response.json();
      setClientes(data.clientes || []);
      setConexoes(data.conexoes || []);
      const empresaResponse = await requisicao(`/api/contratos/empresa?workspaceId=${encodeURIComponent(workspaceId)}`);
      const empresaData = await empresaResponse.json();
      const reps: Representante[] = empresaData.representantes || [];
      if (!reps.length) throw new Error("Cadastre a empresa e ao menos um representante antes de criar contratos");
      setRepresentantes(reps);
      setEditando(contrato);
      const signatarios = contrato.signatarios || [];
      const representanteAtual = signatarios.find(item => item.ordem === 1);
      const clienteAtual = signatarios.find(item => item.papel === "cliente") || signatarios.find(item => item.ordem === 2);
      const representanteSelecionado = reps.find(item =>
        (representanteAtual?.email && item.email === representanteAtual.email) || item.nome === representanteAtual?.nome
      );
      const adicionais: ParticipanteAdicional[] = signatarios.filter(item => item.ordem > 2).map(item => ({
        id_local: item.id || "participante-" + item.ordem,
        papel: item.papel,
        papel_label: item.papel_label || (item.papel === "testemunha" ? "Testemunha" : "Signat\u00e1rio"),
        nome: item.nome || "", cpf: "", email: item.email || "", numero: item.numero || "", otp_meio: item.otp_meio || "email",
      }));
      setFormContrato({
        ...FORM_INICIAL,
        representante_id: String(representanteSelecionado?.id || reps.find(r => r.padrao)?.id || reps[0]?.id || ""),
        otp_meio_representante: representanteAtual?.otp_meio || "email",
        otp_meio_cliente: clienteAtual?.otp_meio || "email",
        participantes_adicionais: adicionais,
        origem: contrato.origem === "crm" ? "crm" : "avulso",
        proposta_id: contrato.proposta_id ? String(contrato.proposta_id) : "",
        nome: contrato.nome_signatario || "", cpf: "", email: contrato.email_signatario || "",
        telefone: contrato.numero || "", canal_id: String(contrato.canal_id || ""),
        titulo: String(contrato.contrato_nome || "Contrato").replace(/\.pdf$/i, ""),
        conteudo: "", pdf_base64: "", pdf_nome: "",
        exigir_documento_identidade: contrato.exigir_documento_identidade === true,
      });
      setCriando(true);
    } catch (e: any) { setErro(e.message || "Não foi possível preparar a edição"); }
  }

  async function reenviarContrato(contrato: Contrato) {
    setReenviando(contrato.id); setErro("");
    try {
      const response = await requisicao(`/api/contratos/${contrato.id}/reenviar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, expira_horas: 48, modo_assinatura: contrato.modo_assinatura }),
      });
      const data = await response.json();
      await carregar(paginacao.pagina, true);
      const avisos: string[] = [];
      const entregaAtual = data.entrega || data.entregas?.[0];
      if (entregaAtual) {
        if (entregaAtual.whatsapp_enviado === false) avisos.push(`WhatsApp: ${entregaAtual.erro_whatsapp || "não enviado"}`);
        if (!entregaAtual.email_enviado) avisos.push(`E-mail: ${entregaAtual.erro_email || "não enviado"}`);
      } else {
        if (!data.enviado) avisos.push(`WhatsApp: ${data.erro_envio || "não enviado"}`);
        if (!data.email_enviado) avisos.push(`E-mail: ${data.erro_email || "não enviado"}`);
      }
      if (avisos.length) alert(`Reenvio processado, mas houve falha em um canal:\n\n${avisos.join("\n")}`);
      else alert(contrato.status === "concluida" ? "Contrato assinado reenviado aos participantes!" : "Contrato e novo link reenviados ao participante atual!");
    } catch (e: any) { setErro(e.message || "Não foi possível reenviar o contrato"); }
    finally { setReenviando(""); }
  }
  async function copiarLinkAssinatura(contrato: Contrato, signatario: SignatarioContrato) {
    if (!signatario.id) return setErro("Signat\u00e1rio sem identificador v\u00e1lido");
    setCopiandoLink(signatario.id); setErro("");
    try {
      const response = await requisicao(
        `/api/contratos/${contrato.id}/signatarios/${signatario.id}/link`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, expira_horas: 48 }),
        }
      );
      const data = await response.json();
      const link = String(data.link || "");
      if (!link) throw new Error("O backend n\u00e3o retornou o link de assinatura");
      try {
        await navigator.clipboard.writeText(link);
        alert(`Link de ${signatario.nome} copiado para a \u00e1rea de transfer\u00eancia.`);
      } catch {
        window.prompt("Copie o link de assinatura:", link);
      }
    } catch (e: any) { setErro(e.message || "N\u00e3o foi poss\u00edvel obter o link de assinatura"); }
    finally { setCopiandoLink(""); }
  }
  async function excluirContrato(contrato: Contrato) {
    const aviso = contrato.status === "concluida"
      ? "Este contrato assinado sairá do painel. A evidência será preservada internamente para segurança jurídica. Deseja excluir?"
      : "Este contrato sairá do painel e o link de assinatura será invalidado. Deseja excluir?";
    if (!window.confirm(aviso)) return;
    setExcluindo(contrato.id); setErro("");
    try {
      await requisicao(`/api/contratos/${contrato.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      setSelecionado(null);
      await carregar(1, true);
    } catch (e: any) { setErro(e.message || "Não foi possível excluir o contrato"); }
    finally { setExcluindo(""); }
  }
  function escolherCliente(propostaId: string) {
    const cliente = clientes.find(item => String(item.id) === propostaId);
    setFormContrato(atual => ({
      ...atual, proposta_id: propostaId, nome: cliente?.nome || "", cpf: cliente?.cpf || "",
      email: cliente?.email || "", telefone: cliente?.telefone1 || cliente?.telefone2 || "",
    }));
  }

  function carregarPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") { setErro("Envie somente arquivo PDF"); return; }
    if (file.size > 3 * 1024 * 1024) { setErro("O PDF deve ter no máximo 3 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setFormContrato(atual => ({ ...atual, pdf_base64: String(reader.result || ""), pdf_nome: file.name }));
    reader.onerror = () => setErro("Não foi possível ler o PDF");
    reader.readAsDataURL(file);
  }

  function adicionarParticipante() {
    setFormContrato(atual => ({
      ...atual,
      participantes_adicionais: [...atual.participantes_adicionais, {
        id_local: "participante-" + Date.now() + "-" + Math.random().toString(16).slice(2),
        papel: "testemunha", papel_label: "Testemunha", nome: "", cpf: "", email: "", numero: "", otp_meio: "email",
      }],
    }));
  }

  function atualizarParticipante(id: string, patch: Partial<ParticipanteAdicional>) {
    setFormContrato(atual => ({
      ...atual,
      participantes_adicionais: atual.participantes_adicionais.map(item => item.id_local === id ? { ...item, ...patch } : item),
    }));
  }

  function removerParticipante(id: string) {
    setFormContrato(atual => ({
      ...atual,
      participantes_adicionais: atual.participantes_adicionais.filter(item => item.id_local !== id),
    }));
  }

  function alterarCanal(canal_id: string) {
    setFormContrato(atual => ({
      ...atual,
      canal_id,
      otp_meio_representante: canal_id ? atual.otp_meio_representante : "email",
      otp_meio_cliente: canal_id ? atual.otp_meio_cliente : "email",
      participantes_adicionais: atual.participantes_adicionais.map(item => canal_id ? item : { ...item, otp_meio: "email" }),
    }));
  }

  async function criarContrato() {
    if (!formContrato.nome.trim() || !formContrato.representante_id) {
      setErro("Informe o nome do cliente e o representante da empresa"); return;
    }
    if (formContrato.otp_meio_representante === "whatsapp" && !formContrato.canal_id) {
      setErro("Selecione um canal para o representante receber o OTP pelo WhatsApp"); return;
    }
    if (formContrato.otp_meio_cliente === "whatsapp" && (!formContrato.canal_id || formContrato.telefone.replace(/\D/g, "").length < 10)) {
      setErro("Para OTP por WhatsApp, selecione o canal e informe o telefone do cliente"); return;
    }
    const participanteInvalido = formContrato.participantes_adicionais.find(item =>
      item.nome.trim().length < 3 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim()) ||
      (item.otp_meio === "whatsapp" && (!formContrato.canal_id || item.numero.replace(/\D/g, "").length < 10))
    );
    if (participanteInvalido) {
      setErro("Revise nome, e-mail e meio de OTP dos participantes adicionais"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formContrato.email.trim())) {
      setErro("Informe um e-mail válido para o envio do contrato"); return;
    }
    if (formContrato.origem === "crm" && !formContrato.proposta_id) { setErro("Escolha um cliente do CRM"); return; }
    if (!editando && !formContrato.pdf_base64 && formContrato.conteudo.trim().length < 30) { setErro("Escreva o contrato ou anexe um PDF pronto"); return; }
    setSalvando(true); setErro("");
    try {
      const endpoint = editando ? `/api/contratos/${editando.id}/editar` : "/api/contratos/criar";
      const response = await requisicao(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, proposta_id: formContrato.origem === "crm" ? Number(formContrato.proposta_id) : null,
          canal_id: formContrato.canal_id ? Number(formContrato.canal_id) : null, numero: formContrato.telefone, nome_signatario: formContrato.nome,
          cpf: formContrato.cpf, email_signatario: formContrato.email, titulo: formContrato.titulo,
          conteudo: formContrato.conteudo, pdf_base64: formContrato.pdf_base64, mensagem: formContrato.mensagem,
          expira_horas: formContrato.expira_horas, exigir_localizacao: formContrato.exigir_localizacao, exigir_documento_identidade: formContrato.exigir_documento_identidade,
          representante_id: formContrato.representante_id, otp_meio_representante: formContrato.otp_meio_representante,
          otp_meio_cliente: formContrato.otp_meio_cliente, participantes_adicionais: formContrato.participantes_adicionais,
          modo_assinatura: editando?.modo_assinatura || "envelope_v1" }),
      });
      const data = await response.json();
      const eraEdicao = Boolean(editando);
      setCriando(false); setEditando(null); await carregar(1, true);
      const avisos: string[] = [];
      const entregaAtual = data.entrega || data.entregas?.[0];
      if (entregaAtual) {
        if (entregaAtual.whatsapp_enviado === false) avisos.push(`WhatsApp: ${entregaAtual.erro_whatsapp || "não enviado"}`);
        if (!entregaAtual.email_enviado) avisos.push(`E-mail: ${entregaAtual.erro_email || "não enviado"}`);
      } else {
        if (!data.enviado) avisos.push(`WhatsApp: ${data.erro_envio || "não enviado"}`);
        if (!data.email_enviado) avisos.push(`E-mail: ${data.erro_email || "não enviado"}`);
      }
      if (avisos.length) {
        if (data.link) await navigator.clipboard?.writeText(data.link).catch(() => {});
        alert(`Contrato criado, mas houve falha em um canal:\n\n${avisos.join("\n")}${data.link ? `\n\nO link foi copiado:\n${data.link}` : ""}`);
      } else alert(eraEdicao ? "Nova versão criada e enviada; o link anterior foi revogado!" : "Contrato criado. Cada participante receberá o convite automaticamente na sua vez!");
    } catch (e: any) { setErro(e.message || "Não foi possível criar o contrato"); }
    finally { setSalvando(false); }
  }
  async function baixar(contrato: Contrato) {
    setBaixando(contrato.id);
    setErro("");
    try {
      const response = await requisicao(`/api/contratos/${contrato.id}/arquivo?workspaceId=${encodeURIComponent(workspaceId)}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `assinado_${contrato.contrato_nome || contrato.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      setErro(e.message || "Não foi possível baixar o PDF");
    } finally {
      setBaixando("");
    }
  }

  if (permissaoCarregando || !modulosCarregados || (carregando && !workspaceId)) {
    return <div className={styles.loadingPage}><div className={styles.spinner}/><span>Carregando módulo Contratos…</span></div>;
  }
  if (!permitido) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>WOLF CONTRATOS</span>
          <h1>Contratos e assinaturas</h1>
          <p>Acompanhe cada documento, assinatura eletrônica e evidência do seu workspace.</p>
          <div style={{ marginTop: 9, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 850, textTransform: "capitalize" }}>Plano {planoUso.nome}</span><span style={{ color: "#64748b", fontSize: 11 }}>{planoUso.limite_mensal === null ? `${planoUso.usados_mes} contratos usados neste mês · ilimitado` : `${planoUso.usados_mes} de ${planoUso.limite_mensal} contratos usados neste mês`}</span></div>
        </div>
        <div className={styles.headerActions}>
          {podeConfigurar && <button className={styles.refreshButton} onClick={() => router.push("/crm/contratos/configuracoes")}>⚙ Empresa e representantes</button>}
          {podeCriar && <button className={styles.newButton} onClick={abrirNovoContrato}>＋ Novo contrato</button>}
          <button className={styles.refreshButton} onClick={() => carregar(paginacao.pagina, true)} disabled={atualizando}>
            <span className={atualizando ? styles.spin : ""}>↻</span> {atualizando ? "Atualizando" : "Atualizar"}
          </button>
        </div>
      </header>

      <section className={styles.cards} aria-label="Resumo dos contratos">
        {cards.map(card => (
          <button key={card.key} className={`${styles.kpi} ${styles[`kpi_${card.color}`]} ${filtro === card.key ? styles.kpiActive : ""}`} onClick={() => { setFiltro(card.key); setSelecionado(null); }}>
            <span className={styles.kpiIcon}>{card.icon}</span>
            <span><small>{card.label}</small><strong>{card.value.toLocaleString("pt-BR")}</strong><em>{card.note}</em></span>
          </button>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <span>⌕</span>
            <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setBuscaAplicada(busca.trim()); }} placeholder="Buscar por cliente, telefone ou documento" />
            {(busca || buscaAplicada) && <button onClick={() => { setBusca(""); setBuscaAplicada(""); }}>×</button>}
          </div>
          <button className={styles.searchButton} onClick={() => setBuscaAplicada(busca.trim())}>Buscar</button>
          <span className={styles.resultCount}>{paginacao.total.toLocaleString("pt-BR")} resultado(s)</span>
        </div>

        {erro && <div className={styles.alert}><span>!</span>{erro}<button onClick={() => setErro("")}>×</button></div>}

        {carregando ? (
          <div className={styles.loadingTable}><div className={styles.spinner}/><span>Consultando contratos…</span></div>
        ) : contratos.length === 0 ? (
          <div className={styles.empty}><div>📄</div><h2>Nenhum contrato encontrado</h2><p>Os contratos criados pelo bloco Assinatura Wolf aparecerão aqui automaticamente.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Cliente / documento</th><th>Status</th><th>Criado</th><th>Assinatura</th><th>Validação</th><th></th></tr></thead>
              <tbody>{contratos.map(contrato => {
                const estado = STATUS[contrato.status] || { label: contrato.status, className: styles.statusExpired };
                return <tr key={contrato.id}>
                  <td><div className={styles.person}><span>{contrato.nome_signatario?.slice(0,1).toUpperCase() || "?"}</span><div><b>{contrato.nome_signatario}</b><small>{contrato.contrato_nome} · {contrato.origem === "crm" ? `CRM #${contrato.proposta_id}` : contrato.origem === "avulso" ? "Avulso" : "Fluxo da IA"}</small><em>{contrato.numero}{contrato.cpf_ultimos4 ? ` · CPF final ${contrato.cpf_ultimos4}` : ""}</em></div></div></td>
                  <td><span className={`${styles.status} ${estado.className}`}>{estado.label}</span>{contrato.signatarios?.length ? <div className={styles.signerFlow}>{contrato.signatarios.map(s => <small key={s.id || s.ordem} className={s.status === "concluida" ? styles.signerDone : styles.signerWaiting}>{s.papel_label || (s.papel === "empresa" ? "Empresa" : s.papel === "cliente" ? "Cliente" : "Signat\u00e1rio")}: {s.status === "concluida" ? "assinado" : s.status === "pendente" ? "pendente" : "aguardando"}</small>)}</div> : null}</td>
                  <td><b className={styles.date}>{dataHora(contrato.created_at)}</b><small className={styles.subdate}>{contrato.canal_id ? `Canal ${contrato.canal_id}` : "Envio por e-mail"}</small></td>
                  <td><b className={styles.date}>{dataHora(contrato.assinatura_em)}</b><small className={styles.subdate}>{contrato.status === "concluida" ? "OTP confirmado" : `Expira ${dataHora(contrato.expira_em)}`}</small></td>
                  <td><span className={styles.evidence}>{contrato.biometria_status === "selfie_evidencia" ? "Selfie evidência" : "Aguardando"}</span></td>
                  <td><div className={styles.actions}><button onClick={() => setSelecionado(contrato)}>Detalhes</button>{podeEditar && <button onClick={() => abrirEditarContrato(contrato)}>Editar</button>}{podeReenviar && <button onClick={() => reenviarContrato(contrato)} disabled={reenviando === contrato.id}>{reenviando === contrato.id ? "Reenviando…" : "Reenviar"}</button>}{podeExcluir && <button className={styles.deleteButton} onClick={() => excluirContrato(contrato)} disabled={excluindo === contrato.id}>{excluindo === contrato.id ? "Excluindo…" : "Excluir"}</button>}{podeBaixar && contrato.status === "concluida" && <button className={styles.download} onClick={() => baixar(contrato)} disabled={baixando === contrato.id}>{baixando === contrato.id ? "Baixando…" : "Baixar PDF"}</button>}</div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}

        {paginacao.paginas > 1 && <div className={styles.pagination}><button disabled={paginacao.pagina <= 1} onClick={() => carregar(paginacao.pagina - 1)}>← Anterior</button><span>Página <b>{paginacao.pagina}</b> de {paginacao.paginas}</span><button disabled={paginacao.pagina >= paginacao.paginas} onClick={() => carregar(paginacao.pagina + 1)}>Próxima →</button></div>}
      </section>

      <footer className={styles.footer}>Documentos privados · acesso por workspace e permissão · hashes SHA-256 e auditoria Wolf</footer>

      {criando && <div className={styles.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget && !salvando) { setCriando(false); setEditando(null); } }}>
        <section className={`${styles.modal} ${styles.createModal}`} role="dialog" aria-modal="true">
          <header><div><span>{editando ? "NOVA VERSÃO" : "NOVO DOCUMENTO"}</span><h2>{editando ? "Editar contrato" : "Criar contrato"}</h2><p>{editando ? "A nova versão revoga o link anterior e é reenviada ao cliente." : "Use um cliente do CRM ou crie um contrato avulso."}</p></div><button disabled={salvando} onClick={() => { setCriando(false); setEditando(null); }}>×</button></header>
          <div className={styles.sourceTabs}>
            <button className={formContrato.origem === "crm" ? styles.sourceActive : ""} onClick={() => setFormContrato({ ...FORM_INICIAL, origem: "crm", representante_id: formContrato.representante_id, canal_id: formContrato.canal_id, otp_meio_representante: formContrato.otp_meio_representante, otp_meio_cliente: formContrato.otp_meio_cliente, participantes_adicionais: formContrato.participantes_adicionais })}>Cliente do CRM</button>
            <button className={formContrato.origem === "avulso" ? styles.sourceActive : ""} onClick={() => setFormContrato({ ...FORM_INICIAL, origem: "avulso", representante_id: formContrato.representante_id, canal_id: formContrato.canal_id, otp_meio_representante: formContrato.otp_meio_representante, otp_meio_cliente: formContrato.otp_meio_cliente, participantes_adicionais: formContrato.participantes_adicionais })}>Contrato avulso</button>
          </div>
          {erro && <div className={styles.alert}><span>!</span>{erro}<button onClick={() => setErro("")}>×</button></div>}<div className={styles.formGrid}>
            <label className={styles.full}>Quem assina pela empresa
              <select value={formContrato.representante_id} onChange={e => setFormContrato({ ...formContrato, representante_id: e.target.value })}>
                <option value="">Selecione o representante…</option>
                {representantes.map(r => <option key={r.id} value={r.id}>{r.nome} · {r.cargo}{r.padrao ? " · padrão" : ""}</option>)}
              </select>
              <small>Este representante assina primeiro. Os demais recebem o convite automaticamente, na ordem.</small>
            </label>
            <label>OTP do representante
              <select value={formContrato.otp_meio_representante} onChange={e => setFormContrato({ ...formContrato, otp_meio_representante: e.target.value as MeioOtp })}>
                <option value="email">Receber por e-mail</option>
                <option value="whatsapp" disabled={!formContrato.canal_id}>Receber por WhatsApp</option>
              </select>
            </label>
            {formContrato.origem === "crm" && <label className={styles.full}>Cliente do CRM<select value={formContrato.proposta_id} onChange={e => escolherCliente(e.target.value)}><option value="">Selecione uma venda/cliente…</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.cpf || c.telefone1 || c.email || ("#" + c.id)}</option>)}</select></label>}
            <label>Nome completo<input value={formContrato.nome} onChange={e => setFormContrato({ ...formContrato, nome: e.target.value })}/></label>
            <label>CPF<input value={formContrato.cpf} onChange={e => setFormContrato({ ...formContrato, cpf: e.target.value })}/></label>
            <label>Telefone WhatsApp<input value={formContrato.telefone} onChange={e => setFormContrato({ ...formContrato, telefone: e.target.value })} placeholder="Opcional quando o OTP for por e-mail"/></label>
            <label>E-mail<input type="email" value={formContrato.email} onChange={e => setFormContrato({ ...formContrato, email: e.target.value })}/></label>
            <label>OTP do cliente
              <select value={formContrato.otp_meio_cliente} onChange={e => setFormContrato({ ...formContrato, otp_meio_cliente: e.target.value as MeioOtp })}>
                <option value="email">Receber por e-mail</option>
                <option value="whatsapp" disabled={!formContrato.canal_id}>Receber por WhatsApp</option>
              </select>
            </label>
            <label className={styles.full}>Canal WhatsApp (opcional)
              <select value={formContrato.canal_id} onChange={e => alterarCanal(e.target.value)}>
                <option value="">Sem canal — convites e OTP por e-mail</option>
                {conexoes.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.tipo} · {c.status}</option>)}
              </select>
              <small>Sem canal configurado, o link e o código de confirmação são enviados exclusivamente por e-mail.</small>
            </label>
            <section className={styles.full + " " + styles.participantsBox}>
              <div className={styles.participantsHeader}>
                <div><b>Outros signatários</b><small>Adicione representantes, testemunhas ou intervenientes. Limite total: 20 pessoas.</small></div>
                <button type="button" onClick={adicionarParticipante}>+ Adicionar pessoa</button>
              </div>
              {formContrato.participantes_adicionais.length === 0
                ? <p className={styles.emptyParticipants}>Nenhuma pessoa adicional. O contrato terá o representante e o cliente.</p>
                : formContrato.participantes_adicionais.map((participante, indice) => <div className={styles.participantCard} key={participante.id_local}>
                    <div className={styles.participantTitle}><b>{indice + 3}º signatário</b><button type="button" onClick={() => removerParticipante(participante.id_local)}>Remover</button></div>
                    <div className={styles.participantGrid}>
                      <label>Função
                        <select value={participante.papel} onChange={e => {
                          const papel = e.target.value as ParticipanteAdicional["papel"];
                          const label = papel === "empresa" ? "Representante da empresa" : papel === "cliente" ? "Outro contratante" : papel === "testemunha" ? "Testemunha" : papel === "interveniente" ? "Interveniente" : "Outro signatário";
                          atualizarParticipante(participante.id_local, { papel, papel_label: label });
                        }}>
                          <option value="testemunha">Testemunha</option><option value="empresa">Representante da empresa</option><option value="cliente">Outro contratante</option>
                          <option value="interveniente">Interveniente</option><option value="outro">Outro</option>
                        </select>
                      </label>
                      <label>Descrição da função<input value={participante.papel_label} onChange={e => atualizarParticipante(participante.id_local, { papel_label: e.target.value })}/></label>
                      <label>Nome completo<input value={participante.nome} onChange={e => atualizarParticipante(participante.id_local, { nome: e.target.value })}/></label>
                      <label>CPF<input value={participante.cpf} onChange={e => atualizarParticipante(participante.id_local, { cpf: e.target.value })}/></label>
                      <label>E-mail<input type="email" value={participante.email} onChange={e => atualizarParticipante(participante.id_local, { email: e.target.value })}/></label>
                      <label>Telefone WhatsApp<input value={participante.numero} onChange={e => atualizarParticipante(participante.id_local, { numero: e.target.value })} placeholder="Opcional para OTP por e-mail"/></label>
                      <label>Receber OTP
                        <select value={participante.otp_meio} onChange={e => atualizarParticipante(participante.id_local, { otp_meio: e.target.value as MeioOtp })}>
                          <option value="email">Por e-mail</option><option value="whatsapp" disabled={!formContrato.canal_id}>Por WhatsApp</option>
                        </select>
                      </label>
                    </div>
                  </div>)}
            </section>
            <label className={styles.full}>Título do contrato<input value={formContrato.titulo} onChange={e => setFormContrato({ ...formContrato, titulo: e.target.value })}/></label>
            <label className={styles.full}>Texto do contrato<textarea rows={10} disabled={!!formContrato.pdf_base64} value={formContrato.conteudo} onChange={e => setFormContrato({ ...formContrato, conteudo: e.target.value })} placeholder="Digite as cláusulas do contrato. O sistema gerará o PDF automaticamente."/></label>
            <label className={`${styles.full} ${styles.fileLabel}`}>Ou utilize um PDF pronto<input type="file" accept="application/pdf" onChange={e => carregarPdf(e.target.files?.[0])}/><span>{formContrato.pdf_nome || "Nenhum PDF selecionado"}</span>{formContrato.pdf_base64 && <button type="button" onClick={() => setFormContrato({ ...formContrato, pdf_base64: "", pdf_nome: "" })}>Remover PDF</button>}</label>
            <label className={styles.full}>Mensagem de envio<textarea rows={3} value={formContrato.mensagem} onChange={e => setFormContrato({ ...formContrato, mensagem: e.target.value })}/><small>Use {"{{nome}}"} e {"{{link}}"}.</small></label>
            <label>Validade<select value={formContrato.expira_horas} onChange={e => setFormContrato({ ...formContrato, expira_horas: Number(e.target.value) })}><option value={24}>24 horas</option><option value={48}>48 horas</option><option value={72}>3 dias</option><option value={168}>7 dias</option></select></label>
            <label className={styles.checkLabel}><input type="checkbox" checked={formContrato.exigir_localizacao} onChange={e => setFormContrato({ ...formContrato, exigir_localizacao: e.target.checked })}/> Solicitar localização</label>
            <label className={styles.checkLabel}><input type="checkbox" checked={formContrato.exigir_documento_identidade} onChange={e => setFormContrato({ ...formContrato, exigir_documento_identidade: e.target.checked })}/> Exigir documento de identidade (frente e verso)</label>
          </div>
          <footer><button disabled={salvando} onClick={() => { setCriando(false); setEditando(null); }}>Cancelar</button><button className={styles.newButton} disabled={salvando} onClick={criarContrato}>{salvando ? (editando ? "Criando versão…" : "Criando…") : (editando ? "Salvar nova versão e reenviar" : "Criar e enviar para assinatura")}</button></footer>
        </section>
      </div>}
      {selecionado && <div className={styles.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget) setSelecionado(null); }}><section className={styles.modal} role="dialog" aria-modal="true"><header><div><span>TRILHA DE AUDITORIA</span><h2>{selecionado.nome_signatario}</h2><p>{selecionado.contrato_nome}</p></div><button onClick={() => setSelecionado(null)}>×</button></header>{selecionado.signatarios?.length ? <div className={styles.modalSigners}>{selecionado.signatarios.map(s => <div key={s.id || s.ordem}><span>{s.ordem}</span><b>{s.papel_label || (s.papel === "empresa" ? "Representante da empresa" : s.papel === "cliente" ? "Cliente" : "Signat\u00e1rio")}<small>{s.nome}</small></b><em className={s.status === "concluida" ? styles.signerDone : styles.signerWaiting}>{s.status === "concluida" ? `Assinado em ${dataHora(s.assinatura_em)}` : s.status === "pendente" ? "Aguardando assinatura" : "Aguardando participante anterior"}</em>{podeReenviar && s.status === "pendente" && <button className={styles.copyLinkButton} onClick={() => copiarLinkAssinatura(selecionado, s)} disabled={!s.id || copiandoLink === s.id}>{copiandoLink === s.id ? "Copiando..." : "Copiar link"}</button>}</div>)}</div> : null}<div className={styles.auditGrid}><Audit label="Situação" value={(STATUS[selecionado.status] || { label: selecionado.status }).label}/><Audit label="Identificador" value={selecionado.id}/><Audit label="Origem" value={selecionado.origem === "crm" ? `Cliente do CRM #${selecionado.proposta_id}` : selecionado.origem === "avulso" ? "Contrato avulso" : "Fluxo da IA"}/><Audit label="Telefone" value={selecionado.numero || "N\u00e3o informado"}/><Audit label="CPF" value={selecionado.cpf_ultimos4 ? `Final ${selecionado.cpf_ultimos4}` : "Não informado"}/><Audit label="Criado em" value={dataHora(selecionado.created_at)}/><Audit label="Assinado em" value={dataHora(selecionado.assinatura_em)}/><Audit label="OTP" value={selecionado.otp_confirmado_em ? `Confirmado em ${dataHora(selecionado.otp_confirmado_em)}` : "Ainda não confirmado"}/><Audit label="Identidade" value={selecionado.biometria_status === "selfie_evidencia" ? "Selfie preservada como evidência" : "Não verificada"}/><Audit label="IP da assinatura" value={selecionado.ip_assinatura || "Não disponível"}/><Audit label="Consentimento" value={selecionado.consentimento_versao || "—"}/><Audit label="Hash do original" value={curto(selecionado.contrato_hash_original, 28)} mono/><Audit label="Hash do assinado" value={curto(selecionado.contrato_hash_assinado, 28)} mono/><Audit label="HMAC da auditoria" value={curto(selecionado.auditoria_hmac, 28)} mono/></div><div className={styles.modalNote}>A selfie é evidência de identidade e não é apresentada como biometria facial verificada. O PDF assinado contém a assinatura legível e o certificado completo.</div><footer><button onClick={() => setSelecionado(null)}>Fechar</button>{podeBaixar && selecionado.status === "concluida" && <button className={styles.download} onClick={() => baixar(selecionado)} disabled={baixando === selecionado.id}>{baixando === selecionado.id ? "Baixando…" : "Baixar contrato assinado"}</button>}</footer></section></div>}
    </main>
  );
}

function Audit({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className={styles.auditItem}><small>{label}</small><b className={mono ? styles.mono : ""} title={value}>{value}</b></div>;
}