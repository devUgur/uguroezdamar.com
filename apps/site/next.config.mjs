/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	serverExternalPackages: ["mongodb", "argon2"],
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
