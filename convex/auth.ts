import { betterAuth } from "better-auth/minimal";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL!;
const baseOrigin = new URL(siteUrl).origin;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: baseOrigin,
    database: authComponent.adapter(ctx),
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
    trustedOrigins: [
      "http://localhost",
      "http://localhost:*",
      "http://127.0.0.1",
      "http://127.0.0.1:*",
      "https://localhost",
      "https://localhost:*",
      "https://127.0.0.1",
      "https://127.0.0.1:*",
      "http://192.168.1.8",
      "http://192.168.1.8:*",
      "http://192.168.1.8:3010",
      "http://library.home",
      "http://library.home:3010",
      "https://vr-homelab.tailf8b14c.ts.net",
      baseOrigin,
    ],
    advanced: {
      disableCSRFCheck: true,
    },
  });
};
