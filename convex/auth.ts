import { betterAuth } from "better-auth/minimal";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL ?? "";
const baseOrigin = siteUrl ? new URL(siteUrl).origin : "";
console.log("[auth] SITE_URL:", siteUrl);
console.log("[auth] baseOrigin:", baseOrigin);

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: baseOrigin,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],

    trustedOrigins: async (request) => {
      const origin = request?.headers.get("origin");
      const referer = request?.headers.get("referer");
      const host = request?.headers.get("host");
      const xfHost = request?.headers.get("x-forwarded-host");
      const xfProto = request?.headers.get("x-forwarded-proto");

      console.log("[auth] incoming:", {
        origin,
        referer,
        host,
        xfHost,
        xfProto,
        baseOrigin,
      });

      const list = [
        baseOrigin,
        "https://vr-homelab.tailf8b14c.ts.net",
        "https://*.tailf8b14c.ts.net",
        "http://localhost:3010",
        "http://127.0.0.1:3010",
      ].filter(Boolean);

      console.log("[auth] trustedOrigins list:", list);
      return list;
    },
  });
};
