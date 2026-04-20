"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../admin/lib/supabase";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleSalvar = async () => {
    if (!senha || !confirmar) { setErro("Preencha os dois campos!"); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem!"); return; }
    if (senha.length < 6) { setErro("Senha deve ter pelo menos 6 caracteres!"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) { setErro("Erro ao atualizar senha!"); return; }
    alert("✅ Senha atualizada com sucesso!");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5">
        <img src="/logo.png" alt="Wolf System" style={{ width: 200, objectFit: "contain" }} />
        <h2 style={{ color: "#111", fontSize: 18, fontWeight: "bold", margin: 0 }}>Redefinir Senha</h2>
        {erro && (
          <div style={{ background: "#dc262622", border: "1px solid #dc262633", borderRadius: 8, padding: "10px 16px", width: "100%" }}>
            <p style={{ color: "#dc2626", fontSize: 13, margin: 0, textAlign: "center" }}>⚠️ {erro}</p>
          </div>
        )}
        <div className="w-full flex flex-col gap-4">
          <input type="password" placeholder="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="password" placeholder="Confirmar nova senha" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={handleSalvar} disabled={loading} style={{ background: loading ? "#86efac" : "black" }} className="w-full text-white rounded-lg py-3 text-sm font-semibold">
            {loading ? "Salvando..." : "SALVAR NOVA SENHA"}
          </button>
        </div>
      </div>
    </div>
  );
}