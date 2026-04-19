"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Register() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [form, setForm] = useState({
    nome: "", empresa: "", cnpj: "", cpf: "",
    email: "", whatsapp: "", senha: "", confirmarSenha: "",
    username: "", plano: "",
  });

  const validarUsername = (value: string) => {
    const limpo = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setForm(prev => ({ ...prev, username: limpo }));
    if (limpo.length < 3) setUsernameError("Mínimo 3 caracteres");
    else if (limpo.length > 30) setUsernameError("Máximo 30 caracteres");
    else setUsernameError("");
  };

  const handleSubmit = async () => {
    if (form.senha !== form.confirmarSenha) { alert("As senhas não coincidem!"); return; }
    if (!form.nome || !form.email || !form.whatsapp || !form.senha || !form.username || !form.plano) {
      alert("Preencha todos os campos obrigatórios!"); return;
    }
    if (usernameError) { alert("Corrija o nome de usuário!"); return; }
    if (form.senha.length < 6) { alert("A senha deve ter pelo menos 6 caracteres!"); return; }

    setLoading(true);

    // Verifica se username já existe
    const { data: existente } = await supabase.from("cadastros").select("id").eq("username", form.username).single();
    if (existente) {
      alert("Este nome de usuário já está em uso. Escolha outro!");
      setLoading(false);
      return;
    }

    // 1. Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: { nome: form.nome, username: form.username },
        emailRedirectTo: undefined,
      }
    });

    if (authError) {
      setLoading(false);
      if (authError.message.includes("already registered")) {
        alert("Este e-mail já está cadastrado!");
      } else {
        alert("Erro ao criar conta: " + authError.message);
      }
      return;
    }

    // 2. Salva na tabela cadastros
    const { error } = await supabase.from("cadastros").insert([{
      nome: form.nome, empresa: form.empresa, cnpj: form.cnpj, cpf: form.cpf,
      email: form.email, whatsapp: form.whatsapp, senha: form.senha,
      username: form.username, plano: form.plano, autorizado: false,
      user_id: authData.user?.id,
    }]);

    if (error) {
      setLoading(false);
      alert("Erro ao salvar cadastro: " + error.message);
      return;
    }

    // 3. Notifica o admin
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: form.nome, empresa: form.empresa, whatsapp: form.whatsapp, email: form.email, plano: form.plano, username: form.username }),
    }).catch(() => {});

    setLoading(false);
    alert("✅ Cadastro enviado! Aguarde a autorização do administrador. Você receberá um e-mail quando seu acesso for liberado.");
    router.push("/");
  };

  const inputStyle = {
    width: "100%", border: "1px solid #d1d5db", borderRadius: 10,
    padding: "12px 16px", fontSize: 14, background: "white",
    boxSizing: "border-box" as const, color: "#111",
  };

  const planos = [
    { value: "", label: "Selecione um plano *" },
    { value: "Básico - R$ 544,34/mês", label: "🐺 Plano Básico — R$ 544,34/mês (até 7 usuários)" },
    { value: "Intermediário - R$ 844,34/mês", label: "⭐ Plano Intermediário — R$ 844,34/mês (até 15 usuários)" },
    { value: "Ultra - R$ 1.099,99/mês", label: "🚀 Plano Ultra — R$ 1.099,99/mês (até 50 usuários)" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>

      {/* ESQUERDA */}
      <div style={{ width: "40%", background: "linear-gradient(160deg, #064e3b, #000)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", gap: "32px" }}>
        <img src="/logo1.png" alt="Wolf System" style={{ width: 300, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {["Integração com Claude, ChatGPT e Typebot", "CRM completo para sua equipe", "Conexão com WhatsApp e API Meta", "Teste grátis sem cartão de crédito"].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ background: "#16a34a", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
              <p style={{ color: "#d1fae5", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DIREITA */}
      <div style={{ width: "60%", background: "white", overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 60px" }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <h2 style={{ fontSize: 26, fontWeight: "bold", color: "#111", margin: 0 }}>Crie sua conta grátis</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>Preencha os dados abaixo para começar</p>
          </div>

          <input placeholder="Nome completo *" value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />

          <input placeholder="Nome da empresa" value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })} style={inputStyle} />

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="CNPJ" value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="CPF" value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="E-mail *" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="WhatsApp *" value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input placeholder="Senha *" type={showPassword ? "text" : "password"} value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <input placeholder="Confirmar senha *" type={showConfirm ? "text" : "password"} value={form.confirmarSenha}
                onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* USERNAME */}
          <div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: 13, color: "#9ca3af", fontSize: 14, pointerEvents: "none" }}>@</span>
              <input
                placeholder="Nome de usuário * (ex: minha_empresa)"
                value={form.username}
                onChange={(e) => validarUsername(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 28, borderColor: usernameError ? "#dc2626" : "#d1d5db" }}
              />
            </div>
            {usernameError && <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0 4px" }}>{usernameError}</p>}
            {!usernameError && form.username && <p style={{ color: "#16a34a", fontSize: 11, margin: "4px 0 0 4px" }}>✓ Disponível para verificação</p>}
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0 4px" }}>Apenas letras minúsculas, números e _ (underline)</p>
          </div>

          {/* PLANO */}
          <select
            value={form.plano}
            onChange={(e) => setForm({ ...form, plano: e.target.value })}
            style={{ ...inputStyle, cursor: "pointer", color: form.plano ? "#111" : "#9ca3af" }}
          >
            {planos.map((p) => (
              <option key={p.value} value={p.value} disabled={p.value === ""}>{p.label}</option>
            ))}
          </select>

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", background: loading ? "#86efac" : "#16a34a", color: "white", border: "none",
            borderRadius: 10, padding: 14, fontSize: 14, fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer", letterSpacing: 1, textTransform: "uppercase"
          }}>
            {loading ? "Enviando..." : "Enviar cadastro"}
          </button>

          <button onClick={() => router.push("/")} style={{
            width: "100%", background: "white", color: "#9ca3af",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, fontSize: 14, cursor: "pointer"
          }}>
            Já tenho conta? Fazer login
          </button>

        </div>
      </div>
    </div>
  );
}