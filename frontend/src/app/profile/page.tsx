import React from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import { ProfileEditorView } from '../../components/ProfileEditorView';

export default function ProfilePage() {
  return (
    <AuthGuard featureName="Halaman Edit Profil" redirectPath="/profile">
      <ProfileEditorView />
    </AuthGuard>
  );
}
