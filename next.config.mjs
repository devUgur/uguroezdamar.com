/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongodb"],
  experimental: {
    useDeploymentId: true,
    useDeploymentIdServerActions: true,
  },
};

export default nextConfig;
