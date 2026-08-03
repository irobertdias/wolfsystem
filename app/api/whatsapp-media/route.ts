import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WHATSAPP_URL =
  process.env.WHATSAPP_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "http://localhost:3001";

export async function GET(req: NextRequest) {
  const filename = new URL(req.url).searchParams.get("filename") || "";

  if (!filename || filename !== filename.replace(/\\/g, "/").split("/").pop()) {
    return NextResponse.json({ error: "Nome de mídia inválido" }, { status: 400 });
  }

  try {
    const range = req.headers.get("range");
    const upstream = await fetch(
      `${WHATSAPP_URL}/audios/${encodeURIComponent(filename)}`,
      {
        cache: "no-store",
        headers: {
          "ngrok-skip-browser-warning": "true",
          ...(range ? { Range: range } : {})
        }
      }
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Mídia indisponível (${upstream.status})` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    for (const name of ["content-length", "content-range", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error: any) {
    console.error("[whatsapp-media] Falha ao buscar mídia:", error?.message || error);
    return NextResponse.json({ error: "Servidor de mídia indisponível" }, { status: 502 });
  }
}
