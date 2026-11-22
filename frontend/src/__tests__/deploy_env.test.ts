import { describe, expect, it } from 'vitest';
import { findDeployEnvProblems } from '../utils/deployEnv';

describe('findDeployEnvProblems', () => {
  it('ignores local builds', () => {
    expect(findDeployEnvProblems({})).toEqual([]);
  });

  it('requires an https API URL ending in /api/v1 on Vercel', () => {
    expect(findDeployEnvProblems({ VERCEL: '1' })).toEqual(['NEXT_PUBLIC_API_URL is not set']);
    expect(
      findDeployEnvProblems({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'http://localhost:5000/api/v1' }),
    ).toEqual(['NEXT_PUBLIC_API_URL points to localhost']);
    expect(
      findDeployEnvProblems({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'http://api.example.com/api/v1' }),
    ).toEqual(['NEXT_PUBLIC_API_URL must use https://']);
    expect(
      findDeployEnvProblems({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'https://api.example.com' }),
    ).toEqual(['NEXT_PUBLIC_API_URL must end with /api/v1']);
    expect(
      findDeployEnvProblems({
        VERCEL: '1',
        NEXT_PUBLIC_API_URL: 'https://dentify-backend.onrender.com/api/v1',
      }),
    ).toEqual([]);
  });
});
