export interface BillingEnv {
  AAS_SUPABASE_URL?: string;
  AAS_SUPABASE_PUBLISHABLE_KEY?: string;
  AAS_SUPABASE_SERVICE_ROLE_KEY?: string;
  AAS_STRIPE_SECRET_KEY?: string;
  AAS_STRIPE_WEBHOOK_SECRET?: string;
  AAS_STRIPE_PRICE_PWA_7D?: string;
  AAS_STRIPE_PRICE_PWA_MONTHLY?: string;
  AAS_STRIPE_PRICE_WINDOWS_MONTHLY?: string;
  AAS_STRIPE_PRICE_BUNDLE_MONTHLY?: string;
  AAS_COMMERCE_MODE?: string;
  AAS_SELLER_TYPE?: string;
  AAS_SELLER_DISCLOSURE_MODE?: string;
  AAS_SELLER_NAME?: string;
  AAS_SELLER_ADDRESS?: string;
  AAS_SELLER_PHONE?: string;
  AAS_SELLER_EMAIL?: string;
  AAS_SUPPORT_URL?: string;
}

type JsonRecord = Record<string, unknown>;
type CommerceMode = "off" | "test" | "live";
type SellerType = "individual" | "business";
type SellerDisclosureMode = "public" | "on_request";
type SellerConfig = {
  type: SellerType;
  disclosureMode: SellerDisclosureMode;
  name: string;
  address: string;
  phone: string;
  email: string;
  supportUrl: string;
};

type PlanDefinition = {
  planCode: string;
  purchaseType: "one_time" | "subscription";
  platformScope: "pwa" | "windows" | "bundle";
  priceBinding:
    | "AAS_STRIPE_PRICE_PWA_7D"
    | "AAS_STRIPE_PRICE_PWA_MONTHLY"
    | "AAS_STRIPE_PRICE_WINDOWS_MONTHLY"
    | "AAS_STRIPE_PRICE_BUNDLE_MONTHLY";
};

const PLANS: readonly PlanDefinition[] = [
  {
    planCode: "AAS-PWA-7DAY",
    purchaseType: "one_time",
    platformScope: "pwa",
    priceBinding: "AAS_STRIPE_PRICE_PWA_7D",
  },
  {
    planCode: "AAS-PWA-MONTHLY",
    purchaseType: "subscription",
    platformScope: "pwa",
    priceBinding: "AAS_STRIPE_PRICE_PWA_MONTHLY",
  },
  {
    planCode: "AAS-WIN-MONTHLY",
    purchaseType: "subscription",
    platformScope: "windows",
    priceBinding: "AAS_STRIPE_PRICE_WINDOWS_MONTHLY",
  },
  {
    planCode: "AAS-BUNDLE-MONTHLY",
    purchaseType: "subscription",
    platformScope: "bundle",
    priceBinding: "AAS_STRIPE_PRICE_BUNDLE_MONTHLY",
  },
] as const;

const SIGNATURE_TOLERANCE_SECONDS = 300;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const object = asRecord(value);
  return object && typeof object.id === "string" && object.id.trim()
    ? object.id.trim()
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function commerceMode(env: BillingEnv): CommerceMode {
  const value = clean(env.AAS_COMMERCE_MODE).toLowerCase();
  return value === "test" || value === "live" ? value : "off";
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

function configured(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sellerConfigFromEnv(env: BillingEnv): SellerConfig {
  return {
    type: clean(env.AAS_SELLER_TYPE).toLowerCase() === "business" ? "business" : "individual",
    disclosureMode: clean(env.AAS_SELLER_DISCLOSURE_MODE).toLowerCase() === "public" ? "public" : "on_request",
    name: clean(env.AAS_SELLER_NAME),
    address: clean(env.AAS_SELLER_ADDRESS),
    phone: clean(env.AAS_SELLER_PHONE),
    email: clean(env.AAS_SELLER_EMAIL),
    supportUrl: clean(env.AAS_SUPPORT_URL),
  };
}

function safeHttpsUrl(value: unknown): string {
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

function publicSellerConfig(seller: SellerConfig) {
  const discloseDirectly = seller.disclosureMode === "public";
  return {
    type: seller.type,
    disclosureMode: seller.disclosureMode,
    name: discloseDirectly ? seller.name : "",
    address: discloseDirectly ? seller.address : "",
    phone: discloseDirectly ? seller.phone : "",
    email: discloseDirectly ? seller.email : "",
    supportUrl: safeHttpsUrl(seller.supportUrl),
  };
}

function sellerReady(seller: SellerConfig): boolean {
  return Boolean(
    seller.name &&
    seller.address &&
    seller.phone &&
    seller.email &&
    safeHttpsUrl(seller.supportUrl)
  );
}

function backendReady(env: BillingEnv): boolean {
  return Boolean(
    configured(env.AAS_SUPABASE_URL) &&
      configured(env.AAS_SUPABASE_SERVICE_ROLE_KEY) &&
      configured(env.AAS_STRIPE_SECRET_KEY) &&
      configured(env.AAS_STRIPE_WEBHOOK_SECRET),
  );
}

function authApiKey(env: BillingEnv): string {
  return clean(env.AAS_SUPABASE_PUBLISHABLE_KEY) || clean(env.AAS_SUPABASE_SERVICE_ROLE_KEY);
}

function authDiagnostic(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return [
    "authorization_missing",
    "billing_not_configured",
    "auth_user_rejected",
    "profile_lookup_failed",
    "profile_not_found",
  ].includes(code)
    ? code
    : "auth_unknown";
}

function planForCode(planCode: string): PlanDefinition | null {
  return PLANS.find((plan) => plan.planCode === planCode) ?? null;
}

function planForPrice(env: BillingEnv, priceId: string): PlanDefinition | null {
  return PLANS.find((plan) => clean(env[plan.priceBinding]) === priceId) ?? null;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function stripeRequest(
  env: BillingEnv,
  path: string,
  init: { method?: "GET" | "POST"; params?: URLSearchParams } = {},
): Promise<JsonRecord> {
  const secret = clean(env.AAS_STRIPE_SECRET_KEY);
  if (!secret) throw new Error("stripe_not_configured");

  const method = init.method ?? "POST";
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Basic ${btoa(`${secret}:`)}`,
      ...(method === "POST"
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" ? init.params?.toString() ?? "" : undefined,
  });
  const payload = asRecord(await safeJson(response));
  if (!response.ok || !payload) throw new Error("stripe_request_failed");
  return payload;
}

async function supabaseServiceRequest(
  env: BillingEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = clean(env.AAS_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = clean(env.AAS_SUPABASE_SERVICE_ROLE_KEY);
  if (!baseUrl || !serviceKey) throw new Error("supabase_service_not_configured");

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      ...(!serviceKey.startsWith("sb_secret_")
        ? { authorization: `Bearer ${serviceKey}` }
        : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function supabaseRpc(
  env: BillingEnv,
  functionName: string,
  body: JsonRecord,
): Promise<unknown> {
  const response = await supabaseServiceRequest(env, `/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`supabase_rpc_failed:${functionName}`);
  return safeJson(response);
}

async function supabaseRows(
  env: BillingEnv,
  path: string,
): Promise<JsonRecord[]> {
  const response = await supabaseServiceRequest(env, path, { method: "GET" });
  if (!response.ok) throw new Error("supabase_query_failed");
  const payload = await safeJson(response);
  return Array.isArray(payload) ? payload.filter((item): item is JsonRecord => asRecord(item) !== null) : [];
}

async function loadSellerConfig(env: BillingEnv): Promise<SellerConfig> {
  const fallback = sellerConfigFromEnv(env);
  try {
    const rows = await supabaseRows(
      env,
      "/rest/v1/commerce_sales_settings?id=eq.1&select=seller_type,seller_disclosure_mode,seller_name,seller_address,seller_phone,seller_email,seller_support_url&limit=1",
    );
    const row = rows[0];
    if (!row) return fallback;

    const databaseConfig: SellerConfig = {
      type: row.seller_type === "business" ? "business" : "individual",
      disclosureMode: row.seller_disclosure_mode === "public" ? "public" : "on_request",
      name: clean(row.seller_name),
      address: clean(row.seller_address),
      phone: clean(row.seller_phone),
      email: clean(row.seller_email),
      supportUrl: safeHttpsUrl(row.seller_support_url),
    };

    const hasDatabaseSellerData = Boolean(
      databaseConfig.name ||
      databaseConfig.address ||
      databaseConfig.phone ||
      databaseConfig.email ||
      databaseConfig.supportUrl
    );
    return hasDatabaseSellerData ? databaseConfig : fallback;
  } catch {
    return fallback;
  }
}

async function authenticate(request: Request, env: BillingEnv): Promise<{
  id: string;
  email: string;
  profile: { role: string; status: string };
}> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) throw new Error("authorization_missing");

  const baseUrl = clean(env.AAS_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = clean(env.AAS_SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = authApiKey(env);
  if (!baseUrl || !serviceKey || !apiKey) throw new Error("billing_not_configured");

  const authResponse = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${match[1]}`,
    },
  });
  const authPayload = asRecord(await safeJson(authResponse));
  const userId = authPayload && typeof authPayload.id === "string" ? authPayload.id : "";
  if (!authResponse.ok || !userId) throw new Error("auth_user_rejected");

  let profileRows: JsonRecord[];
  try {
    profileRows = await supabaseRows(
      env,
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,status&limit=1`,
    );
  } catch {
    throw new Error("profile_lookup_failed");
  }
  const profile = profileRows[0];
  if (!profile) throw new Error("profile_not_found");

  return {
    id: userId,
    email: authPayload && typeof authPayload.email === "string" ? authPayload.email : "",
    profile: {
      role: typeof profile.role === "string" ? profile.role : "",
      status: typeof profile.status === "string" ? profile.status : "",
    },
  };
}

async function loadPrice(env: BillingEnv, plan: PlanDefinition): Promise<{
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unitAmount: number;
  interval: string | null;
  intervalCount: number | null;
} | null> {
  const priceId = clean(env[plan.priceBinding]);
  if (!priceId || !configured(env.AAS_STRIPE_SECRET_KEY)) return null;

  try {
    const price = await stripeRequest(env, `/v1/prices/${encodeURIComponent(priceId)}`, {
      method: "GET",
    });
    const recurring = asRecord(price.recurring);
    const unitAmount = numberValue(price.unit_amount);
    const currency = clean(price.currency).toLowerCase();
    if (unitAmount === null || !currency) return null;
    return {
      id: clean(price.id),
      active: price.active === true,
      livemode: price.livemode === true,
      currency,
      unitAmount,
      interval: recurring ? clean(recurring.interval) || null : null,
      intervalCount: recurring ? numberValue(recurring.interval_count) : null,
    };
  } catch {
    return null;
  }
}

async function publicConfig(env: BillingEnv): Promise<Response> {
  const mode = commerceMode(env);
  const baseReady = backendReady(env);
  const seller = await loadSellerConfig(env);
  const legalReady = sellerReady(seller);
  const prices = await Promise.all(PLANS.map((plan) => loadPrice(env, plan)));

  const plans = PLANS.map((plan, index) => {
    const price = prices[index];
    const modeMatches = price
      ? mode === "live"
        ? price.livemode
        : mode === "test"
          ? !price.livemode
          : false
      : false;
    const available = Boolean(
      mode !== "off" && baseReady && modeMatches && price?.active && (mode !== "live" || legalReady),
    );
    return {
      planCode: plan.planCode,
      purchaseType: plan.purchaseType,
      platformScope: plan.platformScope,
      available,
      price: price
        ? {
            currency: price.currency,
            unitAmount: price.unitAmount,
            interval: price.interval,
            intervalCount: price.intervalCount,
          }
        : null,
    };
  });

  return jsonResponse({
    mode,
    commerceReady: plans.some((plan) => plan.available),
    legalReady,
    seller: publicSellerConfig(seller),
    plans,
  });
}

async function existingCustomerId(env: BillingEnv, userId: string): Promise<string | null> {
  const rows = await supabaseRows(
    env,
    `/rest/v1/billing_customers?user_id=eq.${encodeURIComponent(userId)}&select=provider_customer_id&limit=1`,
  );
  return rows[0] && typeof rows[0].provider_customer_id === "string"
    ? rows[0].provider_customer_id
    : null;
}

async function ensureStripeCustomer(
  env: BillingEnv,
  identity: { id: string; email: string },
): Promise<string> {
  const existing = await existingCustomerId(env, identity.id);
  if (existing) return existing;

  const params = new URLSearchParams();
  if (identity.email) params.set("email", identity.email);
  params.set("metadata[aas_user_id]", identity.id);
  const customer = await stripeRequest(env, "/v1/customers", { params });
  const customerId = clean(customer.id);
  if (!customerId) throw new Error("stripe_customer_missing");
  return customerId;
}

async function hasOverlappingSubscription(
  env: BillingEnv,
  userId: string,
  requestedPlan: PlanDefinition,
): Promise<boolean> {
  const rows = await supabaseRows(
    env,
    `/rest/v1/billing_subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=in.(trialing,active,past_due,incomplete)&select=plan_code,status`,
  );

  return rows.some((row) => {
    const current = planForCode(typeof row.plan_code === "string" ? row.plan_code : "");
    if (!current) return false;
    if (requestedPlan.platformScope === "bundle" || current.platformScope === "bundle") return true;
    return current.platformScope === requestedPlan.platformScope;
  });
}

async function createCheckout(request: Request, env: BillingEnv): Promise<Response> {
  const mode = commerceMode(env);
  const seller = mode === "live" ? await loadSellerConfig(env) : null;
  if (mode === "off" || !backendReady(env) || (mode === "live" && (!seller || !sellerReady(seller)))) {
    return jsonResponse({ error: "販売準備中です。" }, 503);
  }

  let identity: Awaited<ReturnType<typeof authenticate>>;
  try {
    identity = await authenticate(request, env);
  } catch (error) {
    const diagnostic = mode === "test" ? ` [TEST:${authDiagnostic(error)}]` : "";
    return jsonResponse({ error: `ログイン状態を確認できませんでした。${diagnostic}` }, 401);
  }
  if (identity.profile.role !== "user" || identity.profile.status !== "active") {
    return jsonResponse({ error: "購入には有効な一般ユーザーアカウントが必要です。" }, 403);
  }

  let input: JsonRecord | null = null;
  try {
    input = asRecord(await request.json());
  } catch {
    input = null;
  }
  const planCode = input ? clean(input.planCode).toUpperCase() : "";
  const plan = planForCode(planCode);
  if (!plan) return jsonResponse({ error: "プランを確認できませんでした。" }, 400);

  const price = await loadPrice(env, plan);
  const expectedLiveMode = mode === "live";
  if (!price || !price.active || price.livemode !== expectedLiveMode) {
    return jsonResponse({ error: "このプランは現在購入できません。" }, 503);
  }

  try {
    if (await hasOverlappingSubscription(env, identity.id, plan)) {
      return jsonResponse({ error: "同じ対象の継続プランがすでにあります。契約管理から確認してください。" }, 409);
    }

    const customerId = await ensureStripeCustomer(env, identity);
    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set("mode", plan.purchaseType === "subscription" ? "subscription" : "payment");
    params.set("customer", customerId);
    params.set("client_reference_id", identity.id);
    params.set("line_items[0][price]", price.id);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/plans?checkout=cancelled`);
    params.set("locale", "ja");
    params.set("metadata[aas_user_id]", identity.id);
    params.set("metadata[plan_code]", plan.planCode);
    params.set(
      "custom_text[submit][message]",
      plan.purchaseType === "subscription"
        ? "1か月ごとの自動更新契約です。解約は契約管理画面から行え、解約後も現在の請求期間終了までは利用できます。購入前に料金・更新条件・解約条件をご確認ください。"
        : "7日間の期間利用パスです。自動更新はありません。購入前に料金・提供期間・返金条件をご確認ください。",
    );
    if (plan.purchaseType === "subscription") {
      params.set("subscription_data[metadata][aas_user_id]", identity.id);
      params.set("subscription_data[metadata][plan_code]", plan.planCode);
    }

    const session = await stripeRequest(env, "/v1/checkout/sessions", { params });
    const sessionId = clean(session.id);
    const checkoutUrl = clean(session.url);
    if (!sessionId || !checkoutUrl) throw new Error("checkout_session_missing");

    try {
      await supabaseRpc(env, "billing_register_checkout", {
        p_user_id: identity.id,
        p_plan_code: plan.planCode,
        p_provider_session_id: sessionId,
        p_provider_customer_id: customerId,
      });
    } catch (error) {
      try {
        await stripeRequest(env, `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
          params: new URLSearchParams(),
        });
      } catch {
        // Stripe will also expire an unused Checkout Session automatically.
      }
      throw error;
    }

    return jsonResponse({ url: checkoutUrl });
  } catch {
    return jsonResponse({ error: "決済画面を開始できませんでした。時間をおいて再度お試しください。" }, 502);
  }
}

async function createPortal(request: Request, env: BillingEnv): Promise<Response> {
  const mode = commerceMode(env);
  if (mode === "off" || !backendReady(env)) {
    return jsonResponse({ error: "契約管理は現在準備中です。" }, 503);
  }

  let identity: Awaited<ReturnType<typeof authenticate>>;
  try {
    identity = await authenticate(request, env);
  } catch (error) {
    const diagnostic = mode === "test" ? ` [TEST:${authDiagnostic(error)}]` : "";
    return jsonResponse({ error: `ログイン状態を確認できませんでした。${diagnostic}` }, 401);
  }
  if (identity.profile.role !== "user") {
    return jsonResponse({ error: "一般ユーザーの契約のみ管理できます。" }, 403);
  }

  try {
    const customerId = await existingCustomerId(env, identity.id);
    if (!customerId) return jsonResponse({ error: "Stripe契約情報はまだありません。" }, 404);
    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", `${origin}/billing`);
    params.set("locale", "ja");
    const portal = await stripeRequest(env, "/v1/billing_portal/sessions", { params });
    const url = clean(portal.url);
    if (!url) throw new Error("portal_url_missing");
    return jsonResponse({ url });
  } catch {
    return jsonResponse({ error: "契約管理画面を開始できませんでした。" }, 502);
  }
}

function hexBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function verifyStripeSignature(
  rawBody: Uint8Array,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const fields = signatureHeader.split(",").map((part) => part.trim());
  const timestampText = fields.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const timestamp = Number.parseInt(timestampText, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const supplied = fields
    .filter((part) => part.startsWith("v1="))
    .map((part) => hexBytes(part.slice(3)))
    .filter((value): value is Uint8Array => value !== null);
  if (!supplied.length) return false;

  const prefix = new TextEncoder().encode(`${timestampText}.`);
  const signedPayload = new Uint8Array(prefix.length + rawBody.length);
  signedPayload.set(prefix, 0);
  signedPayload.set(rawBody, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedPayload));
  return supplied.some((candidate) => timingSafeEqual(candidate, digest));
}

function metadataOf(object: JsonRecord): JsonRecord {
  return asRecord(object.metadata) ?? {};
}

function firstSubscriptionItem(object: JsonRecord): JsonRecord | null {
  const items = asRecord(object.items);
  const data = items && Array.isArray(items.data) ? items.data : [];
  return data.length ? asRecord(data[0]) : null;
}

function periodSeconds(object: JsonRecord): { start: number | null; end: number | null } {
  const item = firstSubscriptionItem(object);
  return {
    start: numberValue(object.current_period_start) ?? (item ? numberValue(item.current_period_start) : null),
    end: numberValue(object.current_period_end) ?? (item ? numberValue(item.current_period_end) : null),
  };
}

function isoFromSeconds(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

function subscriptionPriceId(object: JsonRecord): string {
  const item = firstSubscriptionItem(object);
  const price = item ? asRecord(item.price) : null;
  return price ? clean(price.id) : "";
}

async function recordIgnoredEvent(env: BillingEnv, event: JsonRecord, object: JsonRecord): Promise<void> {
  await supabaseRpc(env, "billing_record_ignored_event", {
    p_event_id: clean(event.id),
    p_event_type: clean(event.type),
    p_object_id: clean(object.id) || null,
    p_livemode: boolValue(event.livemode),
  });
}

async function syncSubscriptionObject(
  env: BillingEnv,
  event: JsonRecord,
  object: JsonRecord,
): Promise<void> {
  const metadata = metadataOf(object);
  const priceId = subscriptionPriceId(object);
  const configuredPlan = priceId ? planForPrice(env, priceId) : null;
  const planCode = configuredPlan?.planCode ?? clean(metadata.plan_code).toUpperCase();
  const userId = clean(metadata.aas_user_id);
  const subscriptionId = clean(object.id);
  const customerId = stringValue(object.customer) ?? "";
  const status = clean(object.status).toLowerCase();
  const period = periodSeconds(object);

  if (!planForCode(planCode) || !userId || !subscriptionId || !customerId || !status) {
    await recordIgnoredEvent(env, event, object);
    return;
  }

  await supabaseRpc(env, "billing_sync_subscription_event", {
    p_event_id: clean(event.id),
    p_event_type: clean(event.type),
    p_object_id: subscriptionId,
    p_livemode: boolValue(event.livemode),
    p_user_id: userId,
    p_plan_code: planCode,
    p_provider_customer_id: customerId,
    p_provider_subscription_id: subscriptionId,
    p_status: status,
    p_cancel_at_period_end: boolValue(object.cancel_at_period_end),
    p_current_period_start: isoFromSeconds(period.start),
    p_current_period_end: isoFromSeconds(period.end),
    p_ended_at: isoFromSeconds(numberValue(object.ended_at)),
  });
}

function invoiceSubscriptionId(object: JsonRecord): string | null {
  const direct = stringValue(object.subscription);
  if (direct) return direct;
  const parent = asRecord(object.parent);
  const details = parent ? asRecord(parent.subscription_details) : null;
  return details ? stringValue(details.subscription) : null;
}

async function webhook(request: Request, env: BillingEnv): Promise<Response> {
  const mode = commerceMode(env);
  const secret = clean(env.AAS_STRIPE_WEBHOOK_SECRET);
  if (mode === "off" || !backendReady(env) || !secret) {
    return jsonResponse({ error: "billing_webhook_not_configured" }, 503);
  }

  const signature = request.headers.get("stripe-signature") ?? "";
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (!signature || !(await verifyStripeSignature(rawBody, signature, secret))) {
    return jsonResponse({ error: "invalid_signature" }, 400);
  }

  let event: JsonRecord | null = null;
  try {
    event = asRecord(JSON.parse(new TextDecoder().decode(rawBody)));
  } catch {
    event = null;
  }
  const data = event ? asRecord(event.data) : null;
  const object = data ? asRecord(data.object) : null;
  if (!event || !object || !clean(event.id) || !clean(event.type)) {
    return jsonResponse({ error: "invalid_event" }, 400);
  }

  const eventLive = boolValue(event.livemode);
  if ((mode === "live" && !eventLive) || (mode === "test" && eventLive)) {
    return jsonResponse({ error: "billing_mode_mismatch" }, 400);
  }

  const type = clean(event.type);
  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const metadata = metadataOf(object);
      const planCode = clean(metadata.plan_code).toUpperCase();
      const userId = clean(metadata.aas_user_id) || clean(object.client_reference_id);
      const checkoutMode = clean(object.mode);
      const paymentStatus = clean(object.payment_status);
      const sessionId = clean(object.id);
      const customerId = stringValue(object.customer) ?? "";
      const plan = planForCode(planCode);

      if (
        plan?.purchaseType === "one_time" &&
        checkoutMode === "payment" &&
        paymentStatus === "paid" &&
        userId &&
        sessionId &&
        customerId
      ) {
        await supabaseRpc(env, "billing_apply_pass_event", {
          p_event_id: clean(event.id),
          p_event_type: type,
          p_object_id: sessionId,
          p_livemode: eventLive,
          p_user_id: userId,
          p_plan_code: plan.planCode,
          p_provider_session_id: sessionId,
          p_provider_customer_id: customerId,
        });
      } else if (plan?.purchaseType === "subscription" && sessionId) {
        await supabaseRpc(env, "billing_record_checkout_event", {
          p_event_id: clean(event.id),
          p_event_type: type,
          p_object_id: sessionId,
          p_livemode: eventLive,
          p_provider_session_id: sessionId,
          p_status: "complete",
        });
      } else {
        await recordIgnoredEvent(env, event, object);
      }
    } else if (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed") {
      await supabaseRpc(env, "billing_record_checkout_event", {
        p_event_id: clean(event.id),
        p_event_type: type,
        p_object_id: clean(object.id) || null,
        p_livemode: eventLive,
        p_provider_session_id: clean(object.id),
        p_status: "expired",
      });
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      await syncSubscriptionObject(env, event, object);
    } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
      const subscriptionId = invoiceSubscriptionId(object);
      if (!subscriptionId) {
        await recordIgnoredEvent(env, event, object);
      } else {
        const subscription = await stripeRequest(
          env,
          `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
          { method: "GET" },
        );
        await syncSubscriptionObject(env, event, subscription);
      }
    } else {
      await recordIgnoredEvent(env, event, object);
    }
  } catch {
    return jsonResponse({ error: "event_processing_failed" }, 500);
  }

  return jsonResponse({ received: true });
}

export async function handleBillingRequest(
  request: Request,
  env: BillingEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/billing/")) return null;

  if (url.pathname === "/api/billing/config" && request.method === "GET") {
    return publicConfig(env);
  }
  if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
    return createCheckout(request, env);
  }
  if (url.pathname === "/api/billing/portal" && request.method === "POST") {
    return createPortal(request, env);
  }
  if (url.pathname === "/api/billing/stripe-webhook" && request.method === "POST") {
    return webhook(request, env);
  }

  return jsonResponse({ error: "not_found" }, 404);
}
