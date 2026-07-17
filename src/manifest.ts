import { defineManifest } from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";

export const manifest = defineManifest<Record<string, never>>()({
  contract: 2,
  identity: {
    accent: "#ef4444",
    category: "operations",
    description:
      "Durable incident delivery workers with pluggable stores, multi-replica leases, bounded retries, escalation preparation, crash recovery, and operator metrics.",
    docsUrl: "https://github.com/absolutejs/incidents",
    name: "@absolutejs/incidents",
    tagline: "Make operational incidents durable, recoverable, and visible.",
  },
  settings: Type.Object({}),
  wiring: [],
});
