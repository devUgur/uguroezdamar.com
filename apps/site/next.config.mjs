/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	experimental: { globalNotFound: true },
	// Workspace packages ship TypeScript source; the app compiles them (ADR 0017).
	transpilePackages: ["@ugur/core", "@ugur/server", "@ugur/ui"],
	serverExternalPackages: ["argon2"],
	async redirects() {
		return [
			// The former "work" section is the project catalog.
			{ source: "/work", destination: "/projects", permanent: true },
			{ source: "/work/:slug", destination: "/projects/:slug", permanent: true },
		];
	},
};

export default nextConfig;
