/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
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
