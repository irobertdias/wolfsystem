"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";

export default function NovaProposta() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dataProposta: "",
    nome: searchParams.get("nome") || "",
    cpf: "",
    dataNascimento: "",
    nomeMae: "",
    rg: "",
    email: "",
    endereco: "",
    cep: "",
    cidade: "",
    estado: "",
    telefone1: searchParams.get("numero") || "",
    telefone2: "",
    telefone3: "",
    vencimento: "",
    formaPagamento: "",
    plano: "",
    valorPlano: "",
    dataAgendamento: "",
    periodoInstalacao: "",
    vendedor: "",
    statusVenda: "PENDENTE",
    dataInstalacao: "",
    dataCancelamento: "",
    operadora: "",
  });

  const handleSubmit = async () => {
    if (!form.nome || !form.cpf || !form.telefone1) {
      alert("Preencha pelo menos Nome, CPF e Telefone 1!");
      return;
    }
    if (!workspace) {
      alert("Workspace não encontrado!");
      return;
    }
    setLoading(true);

    const { error } = await supabase.from("proposta").insert([{
      data_proposta: form.dataProposta,
      nome: form.nome,
      cpf: form.cpf,
      data_nascimento: form.dataNascimento,
      nome_mae: form.nomeMae,
      rg: form.rg,
      email: form.email,
      endereco: form.endereco,
      cep: form.cep,
      cidade: form.cidade,
      estado: form.estado,
      telefone1: form.telefone1,
      telefone2: form.telefone2,
      telefone3: form.telefone3,
      vencimento: form.vencimento,
      forma_pagamento: form.formaPagamento,
      plano: form.plano,
      valor_plano: form.valorPlano ? Number(form.valorPlano) : null,
      data_agendamento: form.dataAgendamento,
      periodo_instalacao: form.periodoInstalacao,
      vendedor: form.vendedor,
      status_venda: form.statusVenda,
      data_instalacao: form.dataInstalacao,
      data_cancelamento: form.dataCancelamento,
      operadora: form.operadora,
      workspace_id: workspace.id.toString(),
    }]);

    setLoading(false);

    if (error) {
      alert("Erro ao salvar proposta: " + error.message);
      return;
    }

    alert("Proposta cadastrada com sucesso!");
    router.push("/crm");
  };

  const inputStyle = {
    width: "100%",
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "10px 14px",
    color: "white",
    fontSize: 14,
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    color: "#9ca3af",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 4,
    display: "block" as const,
  };

  const fieldBox = (label: string, children: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "Arial, sans-serif", padding: 32 }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 48, filter: "brightness(0) invert(1)" }} />
          <div>
            <h1 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>Nova Proposta</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Wolf CRM — {workspace?.nome}</p>
          </div>
        </div>
        <button onClick={() => router.push("/crm")} style={{
          background: "#1f2937", color: "#9ca3af", border: "1px solid #374151",
          borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer"
        }}>
          ← Voltar ao CRM
        </button>
      </div>

      <div style={{ background: "#111", borderRadius: 16, padding: 32, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Dados da Proposta */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>📋 Dados da Proposta</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("Data da Proposta", <input type="date" value={form.dataProposta} onChange={(e) => setForm({ ...form, dataProposta: e.target.value })} style={inputStyle} />)}
            {fieldBox("Operadora", <input placeholder="Ex: Claro, Vivo, Tim..." value={form.operadora} onChange={(e) => setForm({ ...form, operadora: e.target.value })} style={inputStyle} />)}
            {fieldBox("Vendedor", <input placeholder="Nome do vendedor" value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} style={inputStyle} />)}
          </div>
        </div>

        {/* Dados Pessoais */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>👤 Dados Pessoais</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("Nome Completo *", <input placeholder="Nome completo do cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />)}
            {fieldBox("CPF *", <input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} style={inputStyle} />)}
            {fieldBox("RG", <input placeholder="00.000.000-0" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} style={inputStyle} />)}
            {fieldBox("Data de Nascimento", <input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} style={inputStyle} />)}
            {fieldBox("Nome da Mãe", <input placeholder="Nome completo da mãe" value={form.nomeMae} onChange={(e) => setForm({ ...form, nomeMae: e.target.value })} style={inputStyle} />)}
            {fieldBox("E-mail", <input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />)}
          </div>
        </div>

        {/* Endereço */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>📍 Endereço</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("CEP", <input placeholder="00000-000" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} style={inputStyle} />)}
            {fieldBox("Cidade", <input placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} style={inputStyle} />)}
            {fieldBox("Estado", <input placeholder="UF" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} style={inputStyle} />)}
            <div style={{ gridColumn: "1 / -1" }}>
              {fieldBox("Endereço Completo", <input placeholder="Rua, número, bairro, complemento" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} style={inputStyle} />)}
            </div>
          </div>
        </div>

        {/* Contato */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>📱 Contato</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("Telefone 1 *", <input placeholder="(62) 99999-9999" value={form.telefone1} onChange={(e) => setForm({ ...form, telefone1: e.target.value })} style={inputStyle} />)}
            {fieldBox("Telefone 2", <input placeholder="(62) 99999-9999" value={form.telefone2} onChange={(e) => setForm({ ...form, telefone2: e.target.value })} style={inputStyle} />)}
            {fieldBox("Telefone 3", <input placeholder="(62) 99999-9999" value={form.telefone3} onChange={(e) => setForm({ ...form, telefone3: e.target.value })} style={inputStyle} />)}
          </div>
        </div>

        {/* Plano e Pagamento */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>💳 Plano e Pagamento</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("Plano Escolhido", <input placeholder="Ex: Plano 300MB, Plano 1GB..." value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })} style={inputStyle} />)}
            {fieldBox("Valor do Plano (R$)", <input type="number" placeholder="Ex: 99.90" value={form.valorPlano} onChange={(e) => setForm({ ...form, valorPlano: e.target.value })} style={inputStyle} />)}
            {fieldBox("Vencimento da Fatura", (
              <select value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                {["1", "5", "7", "10", "15"].map(d => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            ))}
            {fieldBox("Forma de Pagamento", (
              <select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                <option value="Boleto Bancário">Boleto Bancário</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
              </select>
            ))}
          </div>
        </div>

        {/* Agendamento e Status */}
        <div>
          <h3 style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>📅 Agendamento e Status</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {fieldBox("Data de Agendamento", <input type="date" value={form.dataAgendamento} onChange={(e) => setForm({ ...form, dataAgendamento: e.target.value })} style={inputStyle} />)}
            {fieldBox("Período da Instalação", (
              <select value={form.periodoInstalacao} onChange={(e) => setForm({ ...form, periodoInstalacao: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
              </select>
            ))}
            {fieldBox("Status da Venda", (
              <select value={form.statusVenda} onChange={(e) => setForm({ ...form, statusVenda: e.target.value })} style={inputStyle}>
                <option value="PENDENTE">PENDENTE</option>
                <option value="AGUARDANDO AUDITORIA">AGUARDANDO AUDITORIA</option>
                <option value="CANCELADA">CANCELADA</option>
                <option value="INSTALADA">INSTALADA</option>
                <option value="GERADA">GERADA</option>
                <option value="REPROVADA">REPROVADA</option>
              </select>
            ))}
            {fieldBox("Data de Instalação", <input type="date" value={form.dataInstalacao} onChange={(e) => setForm({ ...form, dataInstalacao: e.target.value })} style={inputStyle} />)}
            {fieldBox("Data de Cancelamento", <input type="date" value={form.dataCancelamento} onChange={(e) => setForm({ ...form, dataCancelamento: e.target.value })} style={inputStyle} />)}
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={() => router.push("/crm")} style={{
            background: "none", color: "#9ca3af", border: "1px solid #374151",
            borderRadius: 8, padding: "12px 24px", fontSize: 14, cursor: "pointer"
          }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            background: loading ? "#15803d" : "#16a34a", color: "white", border: "none",
            borderRadius: 8, padding: "12px 32px", fontSize: 14, fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer"
          }}>
            {loading ? "Salvando..." : "💾 Salvar Proposta"}
          </button>
        </div>

      </div>
    </div>
  );
}