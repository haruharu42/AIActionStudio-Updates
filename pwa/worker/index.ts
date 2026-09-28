/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleBillingRequest, type BillingEnv } from "./billing";
import { recordSystemEvent, safeOpsHealthResponse } from "./ops";
import {
  handleSalesControlRequest,
  loadEffectiveSalesSettings,
  type EffectiveSalesSettings,
} from "./sales-controls";

interface Env extends BillingEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PWA_NEW_SALE_PLAN_CODES = new Set(["AAS-PWA-7DAY", "AAS-PWA-MONTHLY"]);

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeServerError(): Response {
  return jsonError("internal_server_error", 500);
}

async function rejectLegacyCheckout(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/billing/checkout" || request.method !== "POST") return null;

  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const rawPlanCode = (payload as Record<string, unknown>).planCode;
  const planCode = typeof rawPlanCode === "string" ? rawPlanCode.trim().toUpperCase() : "";
  if (!planCode || PWA_NEW_SALE_PLAN_CODES.has(planCode)) return null;

  return jsonError("このプランは新規受付を終了しました。現在はPWAプランのみ購入できます。", 400);
}

function effectivePlanEnabled(settings: EffectiveSalesSettings | null, planCode: unknown): boolean {
  if (!settings?.stripeCheckoutEnabled || typeof planCode !== "string") return false;
  if (planCode === "AAS-PWA-7DAY") return settings.pwa7DayEnabled;
  if (planCode === "AAS-PWA-MONTHLY") return settings.pwaMonthlyEnabled;
  return false;
}

async function filterPublicBillingConfig(
  request: Request,
  url: URL,
  response: Response,
  env: Env,
): Promise<Response> {
  if (url.pathname !== "/api/billing/config" || request.method !== "GET" || !response.ok) return response;

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response;

  const config = payload as Record<string, unknown>;
  if (!Array.isArray(config.plans)) return response;

  const salesSettings = await loadEffectiveSalesSettings(env);
  const plans = config.plans.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const plan = item as Record<string, unknown>;
    const planCode = plan.planCode;
    if (typeof planCode !== "string" || !PWA_NEW_SALE_PLAN_CODES.has(planCode)) return [];
    return [{
      ...plan,
      available: plan.available === true && effectivePlanEnabled(salesSettings, planCode),
    }];
  });
  const commerceReady = plans.some((item) => item.available === true);
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ ...config, commerceReady, plans }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get("cf-ray") ?? undefined;

    if (url.pathname === "/api/ops/health" && request.method === "GET") {
      return withSecurityHeaders(safeOpsHealthResponse());
    }

    try {
      const salesControlResponse = await handleSalesControlRequest(request, env);
      if (salesControlResponse) return withSecurityHeaders(salesControlResponse);

      const legacyCheckoutResponse = await rejectLegacyCheckout(request, url);
      if (legacyCheckoutResponse) return withSecurityHeaders(legacyCheckoutResponse);

      const billingResponse = await handleBillingRequest(request, env);
      if (billingResponse) {
        if (billingResponse.status >= 500) {
          ctx.waitUntil(recordSystemEvent(env, {
            eventKind: "error",
            severity: "error",
            source: "worker-billing",
            errorCode: "BILLING_REQUEST_FAILED",
            message: `Billing endpoint returned HTTP ${billingResponse.status}.`,
            feature: "billing",
            route: url.pathname,
            requestId,
          }));
        } else if (url.pathname === "/api/billing/stripe-webhook" && billingResponse.status === 400) {
          ctx.waitUntil(recordSystemEvent(env, {
            eventKind: "security",
            severity: "warning",
            source: "worker-billing",
            errorCode: "WEBHOOK_REJECTED",
            message: "Stripe webhook request was rejected before processing.",
            feature: "stripe-webhook",
            route: url.pathname,
            requestId,
          }));
        }
        return withSecurityHeaders(await filterPublicBillingConfig(request, url, billingResponse, env));
      }

      if (url.pathname === "/_vinext/image") {
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        const response = await handleImageOptimization(request, {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          },
        }, allowedWidths);
        return withSecurityHeaders(response);
      }

      return withSecurityHeaders(await handler.fetch(request, env, ctx));
    } catch {
      ctx.waitUntil(recordSystemEvent(env, {
        eventKind: "error",
        severity: "error",
        source: "worker-runtime",
        errorCode: "WORKER_UNHANDLED_EXCEPTION",
        message: "Cloudflare Worker request processing failed unexpectedly.",
        feature: "worker-runtime",
        route: url.pathname,
        requestId,
      }));
      return withSecurityHeaders(safeServerError());
    }
  },
};

export default worker;
