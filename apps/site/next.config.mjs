/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "export",
	reactStrictMode: true,
	serverExternalPackages: ["mongodb"],
};

export default nextConfig;
