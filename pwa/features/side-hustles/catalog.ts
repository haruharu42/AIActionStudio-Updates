import { CLIENT_WORK_SIDE_HUSTLES } from "@/features/side-hustles/definitions-client-work";
import { CONTENT_MEDIA_SIDE_HUSTLES } from "@/features/side-hustles/definitions-content-media";
import { PRODUCTIVITY_SIDE_HUSTLES } from "@/features/side-hustles/definitions-productivity";
import { SALES_SIDE_HUSTLES } from "@/features/side-hustles/definitions-sales";
import type { SideHustleDefinition } from "@/features/side-hustles/types";

export const SIDE_HUSTLE_DEFINITIONS: readonly SideHustleDefinition[] = [
  ...CONTENT_MEDIA_SIDE_HUSTLES,
  ...SALES_SIDE_HUSTLES,
  ...CLIENT_WORK_SIDE_HUSTLES,
  ...PRODUCTIVITY_SIDE_HUSTLES,
];

export const SIDE_HUSTLE_SLUGS = SIDE_HUSTLE_DEFINITIONS.map((definition) => definition.slug);

export function getSideHustleDefinition(slug: string): SideHustleDefinition | undefined {
  return SIDE_HUSTLE_DEFINITIONS.find((definition) => definition.slug === slug);
}
