import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Limites = {
  usuarios_liberados: number;
  conexoes_liberadas: number;
  permite_webjs: boolean;
  permite_waba: boolean;
  permite_instagram: boolean;
  plano: string;
};

const LIMITES_ADMIN = {
  usuarios_liberados: 9999,
  conexoes_liberadas: 9999,
  permite_webjs: true,
  permite_waba: true,
  permite_instagram: true,
  plano: "ultra",
};

export function useLimites(email: string, isAdmin: boolean) {
  const [limites, setLimites] = useState<Limites>(LIMITES_ADMIN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    if (isAdmin) { setLimites(LIMITES_ADMIN); setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("cadastros")
        .select("usuarios_liberados, conexoes_liberadas, permite_webjs, permite_waba, permite_instagram, plano")
        .eq("email", email)
        .single();
      if (data) setLimites({
        usuarios_liberados: data.usuarios_liberados || 1,
        conexoes_liberadas: data.conexoes_liberadas || 1,
        permite_webjs: data.permite_webjs ?? true,
        permite_waba: data.permite_waba ?? false,
        permite_instagram: data.permite_instagram ?? false,
        plano: data.plano || "basico",
      });
      setLoading(false);
    };
    fetch();
  }, [email, isAdmin]);

  return { limites, loading };
}