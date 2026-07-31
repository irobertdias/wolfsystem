export function headersProxyAssinatura(request: Request, json = false): Record<string, string> {
  const forwarded = String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "")
    .split(",")[0]
    .trim();
  const ip = /^[0-9a-fA-F:.]{3,80}$/.test(forwarded) ? forwarded : "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Wolf-Signature-Proxy": process.env.WOLF_SIGNATURE_PROXY_SECRET || "",
  };
  if (ip) headers["X-Wolf-Client-IP"] = ip;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}