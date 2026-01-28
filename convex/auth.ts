import { betterAuth } from "better-auth/minimal";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
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
      siteUrl,
      "https://*.tailf8b14c.ts.net",
			"https://*.convex.site",
			"https://*.convex.cloud",
			"https://localhost:*",
			"http://192.168.1.8:*",
      "http://127.0.0.1:3010",
      "http://localhost:3010",
    ],
    advanced: {
			disableOriginCheck: true,
    },
  });
};
