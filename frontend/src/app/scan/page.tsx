import React from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import { ScanWorkspace } from '../../components/ScanWorkspace';

export default function ScanPage() {
  return (
    <AuthGuard featureName="Fitur AI Dental Scan" redirectPath="/scan">
      <ScanWorkspace />
    </AuthGuard>
  );
}
