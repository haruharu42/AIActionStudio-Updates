import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!url || !serviceKey) throw new Error("Supabase runtime credentials unavailable.");

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const suppliedToken = request.headers.get("x-aas-worker-token") ?? "";
  if (!suppliedToken) return json({ error: "unauthorized" }, 401);

  const { data: config, error: configError } = await db.rpc("get_notification_push_worker_config");
  if (configError || !config || typeof config !== "object") {
    return json({ error: "push_config_unavailable" }, 503);
  }

  const workerTokenHash = String((config as Record<string, unknown>).worker_token_hash ?? "");
  const suppliedHash = await sha256(suppliedToken);
  if (!workerTokenHash || suppliedHash !== workerTokenHash) return json({ error: "unauthorized" }, 401);

  if ((config as Record<string, unknown>).enabled !== true) {
    return json({ enabled: false, claimed: 0, sent: 0, failed: 0 });
  }

  const publicKey = String((config as Record<string, unknown>).vapid_public_key ?? "");
  const privateKey = String((config as Record<string, unknown>).vapid_private_key ?? "");
  const subject = String((config as Record<string, unknown>).vapid_subject ?? "");
  if (!publicKey || !privateKey || !subject) return json({ error: "vapid_not_configured" }, 503);

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: deliveries, error: claimError } = await db.rpc("claim_notification_push_deliveries", { p_limit: 100 });
  if (claimError) return json({ error: "claim_failed" }, 500);

  let sent = 0;
  let failed = 0;
  for (const delivery of Array.isArray(deliveries) ? deliveries : []) {
    const row = delivery as Record<string, unknown>;
    const deliveryId = Number(row.delivery_id);
    const subscription = {
      endpoint: String(row.endpoint ?? ""),
      keys: {
        p256dh: String(row.p256dh ?? ""),
        auth: String(row.auth_key ?? ""),
      },
    };
    const payload = JSON.stringify({
      title: String(row.title ?? "AI Action Studio"),
      body: String(row.body ?? ""),
      href: String(row.href ?? "/"),
      notificationId: Number(row.notification_id),
    });

    try {
      await webpush.sendNotification(subscription, payload, { TTL: 86400, urgency: "normal" });
      sent += 1;
      await db.rpc("complete_notification_push_delivery", {
        p_delivery_id: deliveryId,
        p_success: true,
        p_error: "",
        p_disable_subscription: false,
      });
    } catch (error) {
      failed += 1;
      const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
      const statusCode = Number(record.statusCode ?? 0);
      const message = error instanceof Error ? error.message : String(error);
      await db.rpc("complete_notification_push_delivery", {
        p_delivery_id: deliveryId,
        p_success: false,
        p_error: message.slice(0, 1000),
        p_disable_subscription: statusCode === 404 || statusCode === 410,
      });
    }
  }

  return json({
    enabled: true,
    claimed: Array.isArray(deliveries) ? deliveries.length : 0,
    sent,
    failed,
  });
});
