"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { usePermissao } from "../../../hooks/usePermissao";
import styles from "./page.module.css";
import { formatarCnpj, type EmpresaContrato } from "../../../lib/contratos-empresas";

type Empresa = {
  id?: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco_completo: string;
  email: string;
  telefone: string;
  assinatura_automatica?: boolean;   // a empresa assina sozinha com o carimbo
  carimbo_assinatura?: string;       // PNG (data URL) do carimbo/assinatura
};
type Representante = {
  id?: string;
  nome: string;
  cpf: string;
  cargo: string;
  email: string;
  numero: string;
  padrao: boolean;
};

const EMPRESA_INICIAL: Empresa = {
  razao_social: "", nome_fantasia: "", cnpj: "", endereco_completo: "",
  email: "", telefone: "",
};
const NOVO_REPRESENTANTE: Representante = {
  nome: "", cpf: "", cargo: "", email: "", numero: "", padrao: true,
};

export default function ConfiguracoesContratosPage() {
  const router = useRouter();
  const { workspaceId, loading, permissoes, isDono, isSuperAdmin, perfil } = usePermissao();
  const podeConfigurar = isSuperAdmin || isDono || perfil === "Administrador" || permissoes.contratos_configurar;
  const [empresas, setEmpresas] = useState<EmpresaContrato[]>([]);
  const [alterado, setAlterado] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa>(EMPRESA_INICIAL);
  const [representantes, setRepresentantes] = useState<Representante[]>([{ ...NOVO_REPRESENTANTE }]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!loading && !podeConfigurar) router.replace("/crm/contratos");
  }, [loading, podeConfigurar, router]);
  async function requisicao(url: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou");
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na configuração");
    return data;
  }

  function carregarEmpresa(item?: EmpresaContrato) {
    setEmpresa(item ? {
      id: item.id, razao_social: item.razao_social || "", nome_fantasia: item.nome_fantasia || "",
      cnpj: item.cnpj || "", endereco_completo: item.endereco_completo || "", email: item.email || "", telefone: item.telefone || "",
      assinatura_automatica: (item as any).assinatura_automatica === true, carimbo_assinatura: (item as any).carimbo_assinatura || "",
    } : { ...EMPRESA_INICIAL });
    setRepresentantes(item?.representantes?.length ? item.representantes.map(r => ({ ...r, cpf: r.cpf || "" })) : [{ ...NOVO_REPRESENTANTE }]);
    setAlterado(false); setErro(""); setSucesso("");
  }
  function escolherEmpresa(id: string) {
    if (alterado && !window.confirm("Há alterações não salvas. Deseja descartá-las?")) return;
    carregarEmpresa(empresas.find(e => e.id === id));
  }
  function alterarEmpresa(campo: keyof Empresa, valor: string) {
    setEmpresa(atual => ({ ...atual, [campo]: valor })); setAlterado(true);
  }
  useEffect(() => {
    if (loading || !workspaceId || !podeConfigurar) return;
    let cancelado = false;
    void (async () => {
      setCarregando(true);
      try {
        const data = await requisicao(`/api/contratos/empresa?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (cancelado) return;
        setEmpresas(data.empresas || []);
        carregarEmpresa(data.empresas?.[0]);
      } catch (e: any) { if (!cancelado) setErro(e.message); }
      finally { if (!cancelado) setCarregando(false); }
    })();
    return () => { cancelado = true; };
  }, [loading, podeConfigurar, workspaceId]);

  function alterarRepresentante(index: number, campo: keyof Representante, valor: string | boolean) {
    setAlterado(true);
    setRepresentantes(lista => lista.map((item, posicao) => {
      if (posicao !== index) return campo === "padrao" && valor === true ? { ...item, padrao: false } : item;
      return { ...item, [campo]: valor };
    }));
  }

  async function salvar() {
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const data = await requisicao("/api/contratos/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, empresa, representantes }),
      });
      const salva = { ...data.empresa, representantes: data.representantes || [] } as EmpresaContrato;
      setEmpresas(lista => lista.some(e => e.id === salva.id) ? lista.map(e => e.id === salva.id ? salva : e) : [...lista, salva]);
      carregarEmpresa(salva);
      setSucesso("Empresa e representantes salvos. Eles já podem ser escolhidos nos novos contratos.");
    } catch (e: any) { setErro(e.message || "Não foi possível salvar"); }
    finally { setSalvando(false); }
  }

  if (carregando) return <main className={styles.page}><div className={styles.loading}>Carregando cadastro jurídico…</div></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>WOLF SIGN</span><h1>Empresas e representantes</h1><p>Defina os dados jurídicos e quem pode assinar contratos em nome do workspace.</p></div>
      <button onClick={() => router.push("/crm/contratos")}>Voltar aos contratos</button>
    </header>
    {erro && <div className={styles.error}>{erro}</div>}
    {sucesso && <div className={styles.success}>{sucesso}</div>}
    <section className={styles.card}>
      <div className={styles.titleRow}><div><h2>Empresas do workspace</h2><p>Escolha o cadastro que deseja editar ou adicione outra empresa.</p></div><button disabled={salvando} onClick={() => escolherEmpresa("")}>＋ Adicionar empresa</button></div>
      <label className={styles.companySelect}>Empresa<select disabled={salvando} value={empresa.id || ""} onChange={e => escolherEmpresa(e.target.value)}>
        {!empresa.id && <option value="">Nova empresa</option>}
        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social} · CNPJ {formatarCnpj(e.cnpj)}</option>)}
      </select></label>
      <h2>Dados da empresa</h2>
      <div className={styles.grid}>
        <label>Razão social<input value={empresa.razao_social} onChange={e => alterarEmpresa("razao_social", e.target.value)}/></label>
        <label>Nome fantasia<input value={empresa.nome_fantasia} onChange={e => alterarEmpresa("nome_fantasia", e.target.value)}/></label>
        <label>CNPJ<input value={empresa.cnpj} onChange={e => alterarEmpresa("cnpj", e.target.value)}/></label>
        <label>Telefone<input value={empresa.telefone} onChange={e => alterarEmpresa("telefone", e.target.value)}/></label>
        <label>E-mail<input type="email" value={empresa.email} onChange={e => alterarEmpresa("email", e.target.value)}/></label>
        <label className={styles.full}>Endereço completo<input value={empresa.endereco_completo} onChange={e => alterarEmpresa("endereco_completo", e.target.value)}/></label>
      </div>
      <h2 style={{ marginTop: 18 }}>Assinatura da empresa</h2>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontWeight: 600 }}>
        <input type="checkbox" checked={!!empresa.assinatura_automatica} onChange={e => { setEmpresa(a => ({ ...a, assinatura_automatica: e.target.checked })); setAlterado(true); }} style={{ width: 18, height: 18, marginTop: 2 }} />
        <span>A empresa assina automaticamente com o carimbo abaixo<small style={{ display: "block", fontWeight: 400, color: "#64748b", marginTop: 3 }}>Ao criar o contrato, a etapa da empresa já sai assinada com o carimbo e o link vai direto para o cliente. Ninguém da empresa precisa assinar.</small></span>
      </label>
      {empresa.assinatura_automatica && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ width: 220, height: 110, borderRadius: 12, border: "1px dashed #cbd5e1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {empresa.carimbo_assinatura ? <img src={empresa.carimbo_assinatura} alt="Carimbo" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <small style={{ color: "#94a3b8" }}>Sem carimbo</small>}
          </div>
          <label style={{ cursor: "pointer", fontWeight: 700, color: "#047857" }}>
            {empresa.carimbo_assinatura ? "Trocar carimbo" : "Enviar carimbo / assinatura (imagem)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={async e => {
              const arq = e.target.files?.[0]; if (!arq) return;
              const url = await new Promise<string>((ok, er) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = er; r.readAsDataURL(arq); });
              const img = await new Promise<HTMLImageElement>((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = url; });
              const k = Math.min(1, 600 / Math.max(img.width, img.height));
              const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
              cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
              setEmpresa(a => ({ ...a, carimbo_assinatura: cv.toDataURL("image/png") })); setAlterado(true);
            }} />
          </label>
        </div>
      )}
    </section>
    <section className={styles.card}>
      <div className={styles.titleRow}><div><h2>Representantes</h2><p>O representante selecionado assina primeiro. Só depois o cliente recebe o contrato.</p></div><button onClick={() => { setAlterado(true); setRepresentantes([...representantes, { ...NOVO_REPRESENTANTE, padrao: false }]); }}>＋ Adicionar</button></div>
      {representantes.map((representante, index) => <div className={styles.representante} key={representante.id || index}>
        <div className={styles.repHeader}><strong>Representante {index + 1}</strong><label><input type="radio" name="padrao" checked={representante.padrao || (!representantes.some(r => r.padrao) && index === 0)} onChange={() => alterarRepresentante(index, "padrao", true)}/> Padrão</label>{representantes.length > 1 && <button onClick={() => { setAlterado(true); setRepresentantes(representantes.filter((_, posicao) => posicao !== index)); }}>Remover</button>}</div>
        <div className={styles.grid}>
          <label>Nome completo<input value={representante.nome} onChange={e => alterarRepresentante(index, "nome", e.target.value)}/></label>
          <label>CPF<input value={representante.cpf} onChange={e => alterarRepresentante(index, "cpf", e.target.value)}/></label>
          <label>Cargo<input value={representante.cargo} onChange={e => alterarRepresentante(index, "cargo", e.target.value)}/></label>
          <label>WhatsApp<input value={representante.numero} onChange={e => alterarRepresentante(index, "numero", e.target.value)}/></label>
          <label className={styles.full}>E-mail<input type="email" value={representante.email} onChange={e => alterarRepresentante(index, "email", e.target.value)}/></label>
        </div>
      </div>)}
    </section>
    <footer className={styles.footer}><button onClick={() => router.push("/crm/contratos")}>Cancelar</button><button className={styles.primary} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar empresa"}</button></footer>
  </main>;
}
