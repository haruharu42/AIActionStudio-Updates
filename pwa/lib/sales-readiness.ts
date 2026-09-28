import type { SalesSettings } from "@/lib/sales-settings";

export type SalesReadinessStatus = "ready" | "action";

export type SalesReadinessItem = {
  key: "external-switch" | "access-code" | "purchase-url";
  label: string;
  status: SalesReadinessStatus;
  detail: string;
};

export type ExternalSalesReadiness = {
  ready: boolean;
  completed: number;
  total: number;
  items: SalesReadinessItem[];
};

function hasHttpsPurchaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function getExternalSalesReadiness(settings: SalesSettings): ExternalSalesReadiness {
  const items: SalesReadinessItem[] = [
    {
      key: "external-switch",
      label: "外部販売受付",
      status: settings.externalSalesEnabled ? "ready" : "action",
      detail: settings.externalSalesEnabled
        ? "外部販売を受付中として案内できます。"
        : "販売センターで外部販売をONにしてください。",
    },
    {
      key: "access-code",
      label: "購入者の利用コード登録",
      status: settings.accessCodeEnabled ? "ready" : "action",
      detail: settings.accessCodeEnabled
        ? "購入後の利用コード登録を受け付けられます。"
        : "販売後に利用権を渡すため、利用コード受付をONにしてください。",
    },
    {
      key: "purchase-url",
      label: "購入ページURL",
      status: hasHttpsPurchaseUrl(settings.externalSalesUrl) ? "ready" : "action",
      detail: hasHttpsPurchaseUrl(settings.externalSalesUrl)
        ? "HTTPSの購入ページURLが設定されています。"
        : "note / Brain / Tips等の実際の購入ページURLを設定してください。",
    },
  ];

  const completed = items.filter((item) => item.status === "ready").length;
  return {
    ready: completed === items.length,
    completed,
    total: items.length,
    items,
  };
}
