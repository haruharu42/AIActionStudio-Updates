import type { SalesSettings } from "@/lib/sales-settings";

export type SalesPresetKey =
  | "custom"
  | "external"
  | "paused"
  | "stripe-7day"
  | "stripe-monthly"
  | "stripe-both"
  | "hybrid";

export const SALES_PRESETS: readonly { key: SalesPresetKey; label: string; note: string }[] = [
  { key: "custom", label: "現在の設定を個別に調整", note: "各項目を下のプルダウンで変更します。" },
  { key: "external", label: "外部販売中心（推奨）", note: "外部販売と利用コードだけ受付。Stripe新規決済は停止。" },
  { key: "paused", label: "新規販売をすべて停止", note: "既存契約・既存利用権はそのままで、新規受付だけ停止。" },
  { key: "stripe-7day", label: "Stripe 7日券のみ", note: "PWA 7日利用パスだけをStripeで新規受付。" },
  { key: "stripe-monthly", label: "Stripe月額のみ", note: "PWA月額プランだけをStripeで新規受付。" },
  { key: "stripe-both", label: "Stripe 7日券＋月額", note: "PWAの2プランをStripeで受付。" },
  { key: "hybrid", label: "外部販売＋Stripe併用", note: "外部販売・利用コード・PWA Stripe販売を併用。" },
];

export function inferSalesPreset(settings: SalesSettings): SalesPresetKey {
  if (
    settings.externalSalesEnabled &&
    settings.accessCodeEnabled &&
    !settings.stripeCheckoutEnabled &&
    !settings.pwa7DayEnabled &&
    !settings.pwaMonthlyEnabled
  ) return "external";

  if (
    !settings.externalSalesEnabled &&
    !settings.accessCodeEnabled &&
    !settings.stripeCheckoutEnabled &&
    !settings.pwa7DayEnabled &&
    !settings.pwaMonthlyEnabled
  ) return "paused";

  if (
    !settings.externalSalesEnabled &&
    !settings.accessCodeEnabled &&
    settings.stripeCheckoutEnabled &&
    settings.pwa7DayEnabled &&
    !settings.pwaMonthlyEnabled
  ) return "stripe-7day";

  if (
    !settings.externalSalesEnabled &&
    !settings.accessCodeEnabled &&
    settings.stripeCheckoutEnabled &&
    !settings.pwa7DayEnabled &&
    settings.pwaMonthlyEnabled
  ) return "stripe-monthly";

  if (
    !settings.externalSalesEnabled &&
    !settings.accessCodeEnabled &&
    settings.stripeCheckoutEnabled &&
    settings.pwa7DayEnabled &&
    settings.pwaMonthlyEnabled
  ) return "stripe-both";

  if (
    settings.externalSalesEnabled &&
    settings.accessCodeEnabled &&
    settings.stripeCheckoutEnabled &&
    settings.pwa7DayEnabled &&
    settings.pwaMonthlyEnabled
  ) return "hybrid";

  return "custom";
}

export function applySalesPresetToSettings(
  settings: SalesSettings,
  preset: SalesPresetKey,
): SalesSettings {
  if (preset === "custom") return settings;
  return {
    ...settings,
    externalSalesEnabled: preset === "external" || preset === "hybrid",
    accessCodeEnabled: preset === "external" || preset === "hybrid",
    stripeCheckoutEnabled: ["stripe-7day", "stripe-monthly", "stripe-both", "hybrid"].includes(preset),
    pwa7DayEnabled: ["stripe-7day", "stripe-both", "hybrid"].includes(preset),
    pwaMonthlyEnabled: ["stripe-monthly", "stripe-both", "hybrid"].includes(preset),
  };
}
