export default {
	providers: [
		{
			domain: process.env.CONVEX_SITE_URL ?? process.env.VITE_CONVEX_SITE_URL,
			applicationID: "convex",
		},
	],
};
