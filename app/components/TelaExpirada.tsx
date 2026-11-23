/** Tela cheia mostrada ao cliente quando o link da proposta/orçamento venceu. */
export default function TelaExpirada({ titulo, numero, expiraEm, contato, whatsapp, cor = "#DC2626" }: {
  titulo: string;
  numero?: string;
  expiraEm: string;
  contato: string;
  whatsapp?: string;
  cor?: string;
}) {
  const fone = String(whatsapp || "").replace(/\D/g, "");
  const link = fone ? `https://wa.me/${fone.length <= 11 ? `55${fone}` : fone}?text=${encodeURIComponent(`Olá! Minha proposta${numero ? ` ${numero}` : ""} expirou. Pode renovar para mim?`)}` : "";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full ring-8" style={{ background: cor, boxShadow: `0 0 60px ${cor}66`, ["--tw-ring-color" as any]: `${cor}33` }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </div>
        <h1 className="mt-7 text-[30px] font-black uppercase leading-[1.1] tracking-tight sm:text-[38px]">{titulo}</h1>
        <p className="mt-4 text-[14px] text-slate-300">
          {numero ? <>O link <b className="font-mono text-white">{numero}</b> venceu</> : "Este link venceu"} em {new Date(expiraEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
        </p>
        <p className="mt-1 text-[14px] text-slate-300">Fale com {contato} para receber uma nova condição.</p>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-black/30 transition hover:brightness-105">
            Pedir renovação no WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
