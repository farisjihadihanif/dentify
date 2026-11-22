/**
 * Build-time check for hosted builds (Vercel). NEXT_PUBLIC_* values are inlined into the bundle
 * at build time, so a missing API URL would silently ship a site that calls localhost.
 */
export function findDeployEnvProblems(env: Record<string, string | undefined>): string[] {
  const isHostedBuild = env.VERCEL === '1' || env.CI === 'true';
  if (!isHostedBuild) return [];

  const apiUrl = (env.NEXT_PUBLIC_API_URL ?? '').trim();
  if (!apiUrl) return ['NEXT_PUBLIC_API_URL is not set'];
  if (/localhost|127\.0\.0\.1/.test(apiUrl)) return ['NEXT_PUBLIC_API_URL points to localhost'];
  if (!/^https:\/\//.test(apiUrl)) return ['NEXT_PUBLIC_API_URL must use https://'];
  if (!/\/api\/v1\/?$/.test(apiUrl)) return ['NEXT_PUBLIC_API_URL must end with /api/v1'];
  return [];
}
