'use client';

import { useEffect } from 'react';
import { warmUpServers } from '../services/serverStatus';

/**
 * Renders nothing. On first load it pings the backend health endpoint (which also reaches the
 * ai-service) so sleeping free-tier servers start waking before the user's first real request.
 */
export function ServerWarmup() {
  useEffect(() => {
    warmUpServers();
  }, []);
  return null;
}

export default ServerWarmup;
