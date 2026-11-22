import path from 'node:path';
import type { NextConfig } from 'next';
import { findDeployEnvProblems } from './src/utils/deployEnv';

const deployProblems = findDeployEnvProblems(process.env);
if (deployProblems.length > 0) {
  throw new Error(`Invalid deploy environment: ${deployProblems.join('; ')}`);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
