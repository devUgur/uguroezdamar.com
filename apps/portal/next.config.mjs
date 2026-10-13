/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Workspace packages ship TypeScript source; the app compiles them (ADR 0017).
	transpilePackages: ["@ugur/core", "@ugur/server", "@ugur/ui"],
	serverExternalPackages: ["argon2"],
};

export default nextConfig;
