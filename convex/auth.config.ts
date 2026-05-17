export default {
	providers: [
		{
			domain:
				process.env.CONVEX_SITE_URL ??
				process.env.CONVEX_SELF_HOSTED_URL ??
				"https://convex-library.tailf8b14c.ts.net:3210",
			applicationID: "convex",
		},
	],
};
