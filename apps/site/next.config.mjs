/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Workspace packages ship TypeScript source; the app compiles them (ADR 0017).
	transpilePackages: ["@ugur/core", "@ugur/server", "@ugur/ui"],
	serverExternalPackages: ["argon2"],
	async redirects() {
		return [
			{
				source: "/projects/ViralSync",
				destination: "/projects/viralsync",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
