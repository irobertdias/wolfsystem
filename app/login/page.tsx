"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setErro("Preencha e-mail e senha!"); return; }
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErro("E-mail ou senha incorretos!"); return; }
    if (data.user) {
      const { data: workspace } = await supabase.from("workspaces").select("id, ativo").eq("owner_id", data.user.id).single();
      if (workspace && workspace.ativo) { router.push("/crm"); return; }
      const { data: cadastro } = await supabase.from("cadastros").select("autorizado").eq("email", email).single();
      if (cadastro && !cadastro.autorizado) { setErro("Seu acesso ainda não foi autorizado pelo administrador!"); await supabase.auth.signOut(); return; }
      router.push("/crm");
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) { setErro("Digite seu e-mail primeiro!"); return; }
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app.wolfgyn.com.br/login/nova-senha",
    });
    if (error) { setErro("Erro ao enviar e-mail!"); }
    else { alert("✅ E-mail de redefinição enviado! Verifique sua caixa de entrada."); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <img src="/logo.png" alt="Wolf System Logo" style={{ width: 300, objectFit: "contain" }} />
        </div>
        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Faça login na sua conta</p>
        {erro && (
          <div style={{ background: "#dc262622", border: "1px solid #dc262633", borderRadius: 8, padding: "10px 16px", width: "100%" }}>
            <p style={{ color: "#dc2626", fontSize: 13, margin: 0, textAlign: "center" }}>⚠️ {erro}</p>
          </div>
        )}
        <div className="w-full flex flex-col gap-4">
          <div className="relative">
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <span className="absolute right-3 top-3.5 text-gray-400">✉️</span>
          </div>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400">{showPassword ? "🙈" : "👁️"}</button>
          </div>
          <p onClick={handleEsqueciSenha} className="text-xs text-center text-gray-500 cursor-pointer hover:text-green-600">Esqueceu a senha?</p>
          <button onClick={handleLogin} disabled={loading} style={{ background: loading ? "#86efac" : "black" }} className="w-full text-white rounded-lg py-3 text-sm font-semibold transition-colors">
            {loading ? "Entrando..." : "ACESSAR"}
          </button>
        </div>
        <p className="text-xs text-gray-500">Não tem uma conta?</p>
        <button onClick={() => router.push("/login/register")} className="w-full border-2 border-green-500 text-green-600 rounded-lg py-3 text-sm font-semibold hover:bg-green-50 transition-colors uppercase tracking-wide">
          Crie seu teste grátis
        </button>
      </div>
    </div>
  );
}