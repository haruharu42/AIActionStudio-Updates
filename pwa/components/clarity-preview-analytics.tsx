"use client";

import { useEffect } from "react";

const CLARITY_SCRIPT_ID = "aas-clarity-preview";

function isNonProductionAudience() {
  const audience = (process.env.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE ?? "development").toLowerCase();
  return audience !== "production" && audience !== "public";
}

export function ClarityPreviewAnalytics() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_AAS_CLARITY_PROJECT_ID?.trim();
    const enabled = process.env.NEXT_PUBLIC_AAS_CLARITY_ENABLED === "true";

    if (!enabled || !projectId || !isNonProductionAudience()) return;
    // Clarity project IDs are alphanumeric. Reject unexpected characters before
    // interpolating the public ID into an inline bootstrap script.
    if (!/^[a-zA-Z0-9]+$/.test(projectId)) return;
    if (document.getElementById(CLARITY_SCRIPT_ID)) return;

    // Privacy-first default: Clarity is only loaded on non-production builds.
    // Sensitive AAS content should additionally use data-clarity-mask on its container.
    const script = document.createElement("script");
    script.id = CLARITY_SCRIPT_ID;
    script.async = true;
    script.text = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${projectId}");
      window.clarity("consentv2", {
        analytics_Storage: "denied",
        ad_Storage: "denied"
      });
    `;
    document.head.appendChild(script);

    return () => {
      document.getElementById(CLARITY_SCRIPT_ID)?.remove();
    };
  }, []);

  return null;
}
