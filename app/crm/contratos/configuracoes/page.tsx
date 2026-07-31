"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { usePermissao } from "../../../hooks/usePermissao";
import styles from "./page.module.css";

type Empresa = {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco_completo: string;
  email: string;
  telefone: string;
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

  useEffect(() => {
    if (loading || !workspaceId || !podeConfigurar) return;
    void (async () => {
      setCarregando(true);
      try {
        const data = await requisicao(`/api/contratos/empresa?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (data.empresa) {
          setEmpresa({
            razao_social: data.empresa.razao_social || "",
            nome_fantasia: data.empresa.nome_fantasia || "",
            cnpj: data.empresa.cnpj || "",
            endereco_completo: data.empresa.endereco_completo || "",
            email: data.empresa.email || "",
            telefone: data.empresa.telefone || "",
          });
        }
        if (data.representantes?.length) setRepresentantes(data.representantes);
      } catch (e: any) { setErro(e.message); }
      finally { setCarregando(false); }
    })();
  }, [loading, podeConfigurar, workspaceId]);

  function alterarRepresentante(index: number, campo: keyof Representante, valor: string | boolean) {
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
      setRepresentantes(data.representantes || representantes);
      setSucesso("Empresa e representantes salvos. Eles já podem ser escolhidos nos novos contratos.");
    } catch (e: any) { setErro(e.message || "Não foi possível salvar"); }
    finally { setSalvando(false); }
  }

  if (carregando) return <main className={styles.page}><div className={styles.loading}>Carregando cadastro jurídico…</div></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>WOLF SIGN</span><h1>Empresa e representantes</h1><p>Defina os dados jurídicos e quem pode assinar contratos em nome do workspace.</p></div>
      <button onClick={() => router.push("/crm/contratos")}>← Voltar aos contratos</button>
    </header>
    {erro && <div className={styles.error}>{erro}</div>}
    {sucesso && <div className={styles.success}>{sucesso}</div>}
    <section className={styles.card}>
      <h2>Dados da empresa</h2>
      <div className={styles.grid}>
        <label>Razão social<input value={empresa.razao_social} onChange={e => setEmpresa({ ...empresa, razao_social: e.target.value })}/></label>
        <label>Nome fantasia<input value={empresa.nome_fantasia} onChange={e => setEmpresa({ ...empresa, nome_fantasia: e.target.value })}/></label>
        <label>CNPJ<input value={empresa.cnpj} onChange={e => setEmpresa({ ...empresa, cnpj: e.target.value })}/></label>
        <label>Telefone<input value={empresa.telefone} onChange={e => setEmpresa({ ...empresa, telefone: e.target.value })}/></label>
        <label>E-mail<input type="email" value={empresa.email} onChange={e => setEmpresa({ ...empresa, email: e.target.value })}/></label>
        <label className={styles.full}>Endereço completo<input value={empresa.endereco_completo} onChange={e => setEmpresa({ ...empresa, endereco_completo: e.target.value })}/></label>
      </div>
    </section>
    <section className={styles.card}>
      <div className={styles.titleRow}><div><h2>Representantes</h2><p>O representante selecionado assina primeiro. Só depois o cliente recebe o contrato.</p></div><button onClick={() => setRepresentantes([...representantes, { ...NOVO_REPRESENTANTE, padrao: false }])}>＋ Adicionar</button></div>
      {representantes.map((representante, index) => <div className={styles.representante} key={representante.id || index}>
        <div className={styles.repHeader}><strong>Representante {index + 1}</strong><label><input type="radio" name="padrao" checked={representante.padrao || (!representantes.some(r => r.padrao) && index === 0)} onChange={() => alterarRepresentante(index, "padrao", true)}/> Padrão</label>{representantes.length > 1 && <button onClick={() => setRepresentantes(representantes.filter((_, posicao) => posicao !== index))}>Remover</button>}</div>
        <div className={styles.grid}>
          <label>Nome completo<input value={representante.nome} onChange={e => alterarRepresentante(index, "nome", e.target.value)}/></label>
          <label>CPF<input value={representante.cpf} onChange={e => alterarRepresentante(index, "cpf", e.target.value)}/></label>
          <label>Cargo<input value={representante.cargo} onChange={e => alterarRepresentante(index, "cargo", e.target.value)}/></label>
          <label>WhatsApp<input value={representante.numero} onChange={e => alterarRepresentante(index, "numero", e.target.value)}/></label>
          <label className={styles.full}>E-mail<input type="email" value={representante.email} onChange={e => alterarRepresentante(index, "email", e.target.value)}/></label>
        </div>
      </div>)}
    </section>
    <footer className={styles.footer}><button onClick={() => router.push("/crm/contratos")}>Cancelar</button><button className={styles.primary} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar cadastro"}</button></footer>
  </main>;
}
