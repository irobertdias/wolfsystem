"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { MolduraAuth, BotaoA2, AvisoA2 } from "../_a2";
import Icone from "../../components/a2/Icone";

// Entrada do "Acessar como cliente": o código de uso único vem no fragmento (#th=...)
// para não ir para logs de servidor. Deve ser aberto numa janela anônima.
export default function AcessoSuporte() {
  const [etapa, setEtapa] = useState<"lendo" | "conflito" | "entrando" | "erro">("lendo");
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<{ th: string; email: string; nome: string }>({ th: "", email: "", nome: "" });
  const [atual, setAtual] = useState("");

  const entrar = async (th: string, email: string) => {
    setEtapa("entrando");
    const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: "magiclink" });
    if (error) {
      setErro(/expired|invalid/i.test(error.message) ? "Esse link já foi usado ou expirou. Gere outro em Clientes." : "Não foi possível entrar: " + error.message);
      setEtapa("erro");
      return;
    }
    try {
      sessionStorage.setItem("wolf_modo_suporte", email);
      sessionStorage.removeItem("wolf_sessao_validada");
    } catch {}
    history.replaceState(null, "", "/login/suporte");
    window.location.href = window.location.host.startsWith("rev.") ? "/" : "/crm";
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const th = p.get("th") || "", email = p.get("e") || "", nome = p.get("n") || "";
    if (!th) { setErro("Link de acesso incompleto. Gere outro em Clientes."); setEtapa("erro"); return; }
    setDados({ th, email, nome });
    supabase.auth.getSession().then(({ data: { session } }) => {
      const logado = session?.user?.email || "";
      if (logado && logado.toLowerCase() !== email.toLowerCase()) { setAtual(logado); setEtapa("conflito"); return; }
      entrar(th, email);
    });
  }, []);

  return (
    <MolduraAuth titulo="Acesso de suporte" sub={dados.nome ? `Entrando no workspace de ${dados.nome}` : "Entrando no workspace do cliente"}
      destaques={[
        { icone: "escudo", texto: "Link de uso único, vale por 1 hora" },
        { icone: "cadeado", texto: "Ninguém precisa saber a senha do cliente" },
        { icone: "documento", texto: "Cada acesso fica registrado" },
      ]}>
      {etapa === "lendo" || etapa === "entrando" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#475569", fontSize: 14.5, fontWeight: 600 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid #A7F3D0", borderTopColor: "#059669", animation: "spin .7s linear infinite" }} />
          Entrando como {dados.email || "cliente"}…
        </div>
      ) : etapa === "conflito" ? (
        <>
          <AvisoA2>Este navegador já está logado como {atual}. Se continuar, essa conta sai daqui.</AvisoA2>
          <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            O melhor é copiar este endereço e abrir numa <b>janela anônima</b> (Ctrl + Shift + N), assim sua conta de admin continua aberta nesta janela.
          </p>
          <BotaoA2 variante="claro" onClick={() => { navigator.clipboard?.writeText(window.location.href); }}>
            <Icone nome="copiar" tamanho={16} /> Copiar endereço
          </BotaoA2>
          <BotaoA2 onClick={async () => { await supabase.auth.signOut(); entrar(dados.th, dados.email); }}>
            Sair de {atual.split("@")[0]} e entrar mesmo assim
          </BotaoA2>
        </>
      ) : (
        <AvisoA2>{erro}</AvisoA2>
      )}
    </MolduraAuth>
  );
}
