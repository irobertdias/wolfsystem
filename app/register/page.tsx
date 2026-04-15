"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Register() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "", empresa: "", cnpj: "", cpf: "",
    email: "", whatsapp: "", senha: "", confirmarSenha: "",
    usuarios: "", conexoes: "", ia: [] as string[], plano: "",
  });

  const handleIA = (value: string) => {
    setForm((prev) => ({
      ...prev,
      ia: prev.ia.includes(value) ? prev.ia.filter((i) => i !== value) : [...prev.ia, value],
    }));
  };

  const handleSubmit = async () => {
    if (form.senha !== form.confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }
    if (!form.nome || !form.email || !form.whatsapp || !form.senha) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("cadastros").insert([{
      nome: form.nome,
      empresa: form.empresa,
      cnpj: form.cnpj,
      cpf: form.cpf,
      email: form.email,
      whatsapp: form.whatsapp,
      senha: form.senha,
      usuarios: form.usuarios,
      conexoes: form.conexoes,
      ia: form.ia.join(", "),
      plano: form.plano,
      autorizado: false,
    }]);

    if (error) {
      setLoading(false);
      alert("Erro ao cadastrar: " + error.message);
      return;
    }

    // Envia notificação no WhatsApp
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        empresa: form.empresa,
        whatsapp: form.whatsapp,
        email: form.email,
        plano: form.plano,
        ia: form.ia.join(", "),
      }),
    });

    setLoading(false);
    alert("Cadastro enviado com sucesso! Aguarde a autorização do administrador.");
    router.push("/");
  };

  const inputStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    background: "white",
    boxSizing: "border-box" as const,
    color: "#111",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>

      {/* ESQUERDA */}
      <div style={{
        width: "40%", background: "linear-gradient(160deg, #064e3b, #000)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "40px", gap: "32px"
      }}>
        <img src="/logo1.png" alt="Wolf System" style={{ width: 300, objectFit: "contain", filter: "brightness(0) invert(1)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {[
            "Integração com Claude, ChatGPT e Typebot",
            "CRM completo para sua equipe",
            "Conexão com WhatsApp e API Meta",
            "Teste grátis sem cartão de crédito",
          ].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{
                background: "#16a34a", borderRadius: "50%", width: 22, height: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 12, flexShrink: 0, marginTop: 1
              }}>✓</span>
              <p style={{ color: "#d1fae5", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DIREITA */}
      <div style={{
        width: "60%", background: "white", overflowY: "auto",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 60px"
      }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <h2 style={{ fontSize: 26, fontWeight: "bold", color: "#111", margin: 0 }}>Crie sua conta grátis</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>Preencha os dados abaixo para começar</p>
          </div>

          <input placeholder="Nome completo *" value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            style={inputStyle} />

          <input placeholder="Nome da empresa" value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            style={inputStyle} />

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="CNPJ" value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="CPF" value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="E-mail *" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="WhatsApp *" value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
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

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="Nº de usuários" type="number" value={form.usuarios}
              onChange={(e) => setForm({ ...form, usuarios: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="Nº de conexões WhatsApp" type="number" value={form.conexoes}
              onChange={(e) => setForm({ ...form, conexoes: e.target.value })}
              style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, background: "#f9fafb" }}>
            <p style={{ fontSize: 11, fontWeight: "bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px 0" }}>
              Integração de IA
            </p>
            <div style={{ display: "flex", gap: 24 }}>
              {["Claude", "ChatGPT", "Typebot"].map((ia) => (
                <label key={ia} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.ia.includes(ia)} onChange={() => handleIA(ia)}
                    style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
                  {ia}
                </label>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, background: "#f9fafb" }}>
            <p style={{ fontSize: 11, fontWeight: "bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px 0" }}>
              O que você vai usar?
            </p>
            <div style={{ display: "flex", gap: 24 }}>
              {["Só CRM", "Só Chatbot", "CRM + Chatbot"].map((plano) => (
                <label key={plano} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer" }}>
                  <input type="radio" name="plano" value={plano} checked={form.plano === plano}
                    onChange={() => setForm({ ...form, plano })}
                    style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
                  {plano}
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", background: loading ? "#86efac" : "#16a34a", color: "white", border: "none",
            borderRadius: 10, padding: 14, fontSize: 14, fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer", letterSpacing: 1, textTransform: "uppercase"
          }}>
            {loading ? "Enviando..." : "Enviar cadastro"}
          </button>

          <button onClick={() => router.push("/")} style={{
            width: "100%", background: "white", color: "#9ca3af",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 14,
            fontSize: 14, cursor: "pointer"
          }}>
            Já tenho conta? Fazer login
          </button>

        </div>
      </div>
    </div>
  );
}