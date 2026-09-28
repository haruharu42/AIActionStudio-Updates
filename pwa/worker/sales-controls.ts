export interface SalesControlEnv {
  AAS_SUPABASE_URL?: string;
  AAS_SUPABASE_SERVICE_ROLE_KEY?: string;
}

type SalesSettings = {
  externalSalesEnabled: boolean;
  accessCodeEnabled: boolean;
  externalSalesUrl: string;
  stripeCheckoutEnabled: boolean;
  pwa7DayEnabled: boolean;
  pwaMonthlyEnabled: boolean;
  publicSalesApproved: boolean;
};

type SalesLaunchRuntime = {
  approved: boolean;
  externalRouteReady: boolean;
  stripeRouteReady: boolean;
};

const PLAN_FLAGS: Record<string, keyof Pick<SalesSettings, "pwa7DayEnabled" | "pwaMonthlyEnabled">> = {
  "AAS-PWA-7DAY": "pwa7DayEnabled",
  "AAS-PWA-MONTHLY": "pwaMonthlyEnabled",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeExternalSalesUrl(value: unknown): string {
  const cleaned = clean(value);
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}


function serviceHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    ...(!serviceKey.startsWith("sb_secret_") ? { authorization: `Bearer ${serviceKey}` } : {}),
    accept: "application/json",
  };
}

async function loadSalesLaunchRuntime(
  baseUrl: string,
  serviceKey: string,
): Promise<SalesLaunchRuntime | null> {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/service_get_sales_launch_runtime`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceKey),
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const value = row as Record<string, unknown>;
  return {
    approved: value.public_sales_approved === true,
    externalRouteReady: value.external_route_ready === true,
    stripeRouteReady: value.stripe_route_ready === true,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function loadSalesSettings(env: SalesControlEnv): Promise<SalesSettings | null> {
  const baseUrl = clean(env.AAS_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = clean(env.AAS_SUPABASE_SERVICE_ROLE_KEY);
  if (!baseUrl || !serviceKey) return null;

  const response = await fetch(
    `${baseUrl}/rest/v1/commerce_sales_settings?id=eq.1&select=external_sales_enabled,access_code_enabled,external_sales_url,stripe_checkout_enabled,pwa_7day_enabled,pwa_monthly_enabled&limit=1`,
    {
      method: "GET",
      headers: serviceHeaders(serviceKey),
    },
  );
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload) || !payload[0] || typeof payload[0] !== "object") return null;
  const row = payload[0] as Record<string, unknown>;
  const runtime = await loadSalesLaunchRuntime(baseUrl, serviceKey);
  if (!runtime) return null;

  const externalSalesUrl = safeExternalSalesUrl(row.external_sales_url);
  const externalSalesEnabled =
    runtime.approved &&
    runtime.externalRouteReady &&
    row.external_sales_enabled === true &&
    row.access_code_enabled === true &&
    Boolean(externalSalesUrl);
  const stripeCheckoutEnabled =
    runtime.approved &&
    runtime.stripeRouteReady &&
    row.stripe_checkout_enabled === true;

  return {
    externalSalesEnabled,
    accessCodeEnabled: row.access_code_enabled === true,
    externalSalesUrl: externalSalesEnabled ? externalSalesUrl : "",
    stripeCheckoutEnabled,
    pwa7DayEnabled: stripeCheckoutEnabled && row.pwa_7day_enabled === true,
    pwaMonthlyEnabled: stripeCheckoutEnabled && row.pwa_monthly_enabled === true,
    publicSalesApproved: runtime.approved,
  };
}

export async function handleSalesControlRequest(
  request: Request,
  env: SalesControlEnv,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/api/sales/settings" && request.method === "GET") {
    const settings = await loadSalesSettings(env);
    if (!settings) return jsonResponse({ error: "販売受付設定を確認できませんでした。" }, 503);
    return jsonResponse(settings);
  }

  if (url.pathname !== "/api/billing/checkout" || request.method !== "POST") return null;

  const settings = await loadSalesSettings(env);
  if (!settings) return jsonResponse({ error: "販売受付設定を確認できないため、新規決済を停止しています。" }, 503);
  if (!settings.stripeCheckoutEnabled) {
    return jsonResponse({ error: "現在、Stripeでの新規購入受付は停止しています。" }, 503);
  }

  let planCode = "";
  try {
    const payload = await request.clone().json() as Record<string, unknown>;
    planCode = clean(payload.planCode).toUpperCase();
  } catch {
    return null;
  }

  const flag = PLAN_FLAGS[planCode];
  if (flag && !settings[flag]) {
    return jsonResponse({ error: "このプランは現在、新規受付を停止しています。" }, 503);
  }

  return null;
}
