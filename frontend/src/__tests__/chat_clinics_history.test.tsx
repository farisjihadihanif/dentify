import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from '../app/chat/page';
import ClinicsPage from '../app/clinics/page';
import PanduanPage from '../app/panduan/page';
import ProfilePage from '../app/profile/page';
import { AppFooter } from '../components/AppFooter';
import { ClinicCard } from '../components/ClinicCard';
import { ClinicFinderView, RADIUS_OPTIONS_KM } from '../components/ClinicFinderView';
import { DeniChat } from '../components/DeniChat';
import { DeniMascot } from '../components/DeniMascot';
import {
  DENTIST_WORLD_ARTICLES,
  DentalArticleModal,
} from '../components/DentalArticleModal';
import { DentHubLogo } from '../components/DentHubLogo';
import { DEFAULT_HISTORY_EMPTY_TEXT, EmptyState } from '../components/EmptyState';
import { FloatingNavbar, NAV_DOCK_ITEMS } from '../components/FloatingNavbar';
import { OsmMapView } from '../components/OsmMapView';
import { ProfileEditorView } from '../components/ProfileEditorView';
import apiClient from '../services/apiClient';
import { updateCurrentUserProfile } from '../services/authService';
import {
  INITIAL_SUGGESTED_QUESTIONS,
  deleteChatSessionById,
  fetchChatSessionDetail,
  fetchChatSessions,
  sendDeniMessage,
} from '../services/chatService';
import {
  fetchNearbyClinics,
  requestBrowserGeolocation,
  resolveManualLocationQuery,
  type ClinicItem,
} from '../services/clinicService';
import {
  deleteScanById,
  fetchScanDetailById,
  fetchScanHistory,
  type ScanReportData,
} from '../services/scanService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

const SAMPLE_CLINICS: ClinicItem[] = [
  {
    osm_id: 'node/111',
    name: 'Klinik Gigi Sehat Bersama',
    address: 'Jl. Laksda Adisucipto No. 45, Yogyakarta',
    latitude: -7.78312,
    longitude: 110.39104,
    distance_km: 1.4,
    phone: '+62-274-555123',
    opening_hours: 'Mo-Sa 09:00-21:00',
    osm_url: 'https://www.openstreetmap.org/?mlat=-7.78312&mlon=110.39104#map=17/-7.78312/110.39104',
  },
  {
    osm_id: 'node/222',
    name: 'Praktik Dokter Gigi Senyum Ceria',
    address: 'Jl. Kaliurang KM 6, Sleman',
    latitude: -7.7521,
    longitude: 110.3822,
    distance_km: 2.2,
    phone: '+62-274-555987',
    opening_hours: 'Mo-Fr 10:00-20:00',
    osm_url: 'https://www.openstreetmap.org/?mlat=-7.7521&mlon=110.3822#map=17/-7.7521/110.3822',
  },
  {
    osm_id: 'node/333',
    name: 'RSGM Prof. Soedomo',
    address: 'Jl. Denta No. 1, Sekip Utara, Yogyakarta',
    latitude: -7.7689,
    longitude: 110.3735,
    distance_km: 2.9,
    phone: null,
    opening_hours: null,
    osm_url: 'https://www.openstreetmap.org/?mlat=-7.7689&mlon=110.3735#map=17/-7.7689/110.3735',
  },
];

const SAMPLE_SCAN_REPORT: ScanReportData = {
  id: '673a1f993d4e5f6a7b8c9d11',
  capture_source: 'camera',
  user_symptoms: 'Gigi berdenyut sejak semalam',
  primary_condition: 'caries',
  condition_label: 'Indikasi Karies Gigi (Gigi Berlubang)',
  confidence_score: 0.91,
  detections: [{ label: 'caries', confidence: 0.91, bbox: [120, 145, 84, 76] }],
  urgency_level: 'emergency',
  trigger_clinic_finder: true,
  care_recommendations: {
    summary: 'Terdeteksi indikasi karies dengan tingkat keyakinan tinggi.',
    dos: ['Sikat gigi lembut 2 kali sehari menggunakan pasta gigi berfluoride'],
    donts: ['Jangan mengorek lubang gigi dengan benda tajam'],
  },
  medical_disclaimer:
    'Penting: DentHub adalah alat skrining awal berbasis AI untuk pencegahan dan bukan pengganti diagnosis dokter gigi. Hasil ini bukan diagnosis medis. Segera kunjungi dokter gigi jika Anda merasakan nyeri hebat atau pembengkakan.',
  created_at: '2026-11-18T09:30:00.000Z',
};

describe('Global layout, identity, /profile, and /panduan (T-110, T-206)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('FloatingNavbar has clickable DentHubLogo to / plus 4 nav items (Scan, Deni, Klinik, Profil) without Beranda', () => {
    expect(NAV_DOCK_ITEMS.map((item) => item.label)).toEqual([
      'Scan',
      'Deni',
      'Klinik',
      'Profil',
    ]);
    const logoHtml = renderToStaticMarkup(<DentHubLogo />);
    expect(logoHtml).toContain('/images/denthub-logo.png');
    expect(logoHtml).toContain('DentHub');

    const navHtml = renderToStaticMarkup(<FloatingNavbar />);
    expect(navHtml).toContain('data-testid="navbar-logo-home-link"');
    expect(navHtml).toContain('href="/"');
    expect(navHtml).toContain('aria-current="page"');
    expect(navHtml).toContain('data-testid="denthub-logo"');
    expect(navHtml).not.toContain('>Beranda<');
    expect(navHtml).not.toContain('>DH<');
  });

  it('AppFooter renders 3 parts and DeniMascot renders floating widget to /chat', () => {
    const footerHtml = renderToStaticMarkup(<AppFooter />);
    const left = footerHtml.indexOf('created by');
    const center = footerHtml.indexOf('Denthub 2026');
    const right = footerHtml.indexOf('Panduan Aplikasi');
    expect(left).toBeGreaterThan(-1);
    expect(center).toBeGreaterThan(left);
    expect(right).toBeGreaterThan(center);

    const mascotHtml = renderToStaticMarkup(<DeniMascot />);
    expect(mascotHtml).toContain('data-testid="deni-mascot-widget"');
    expect(mascotHtml).toContain('/images/deni-mascot.png');
    expect(mascotHtml).toContain('animate-deni-float');
    expect(mascotHtml).toContain('Tanya Deni');
    expect(mascotHtml).toContain('href="/chat"');
  });

  it('renders /panduan (stacked vertical steps + clickable Dunia Dentist cards + cited article pop-up modal) and /profile', async () => {
    const guideHtml = renderToStaticMarkup(<PanduanPage />);
    expect(guideHtml).toContain('data-testid="panduan-kinetic-ribbon"');
    expect(guideHtml).toContain('data-testid="panduan-section-1-steps"');
    expect(guideHtml).toContain('data-testid="panduan-section-2-dentist-world"');
    expect(guideHtml).toContain('Informasi Seputar Dunia Dentist &amp; Perawatan Gigi');
    expect(guideHtml).toContain('Baca Artikel Lengkap');
    expect(guideHtml).toContain('cursor-pointer');
    expect(guideHtml).not.toContain('Disclaimer Medis');

    // Article reader modal open & closed states + authoritative sources
    const closedModalHtml = renderToStaticMarkup(
      <DentalArticleModal article={null} onClose={vi.fn()} />,
    );
    expect(closedModalHtml).toBe('');

    const openModalHtml = renderToStaticMarkup(
      <DentalArticleModal article={DENTIST_WORLD_ARTICLES[0]} onClose={vi.fn()} />,
    );
    expect(openModalHtml).toContain('role="dialog"');
    expect(openModalHtml).toContain('aria-modal="true"');
    expect(openModalHtml).toContain('Pemeriksaan Rutin &amp; Scaling Karang Gigi (Tiap 6 Bulan)');
    expect(openModalHtml).toContain('Poin Praktis untuk Anda');
    expect(openModalHtml).toContain('data-testid="dental-article-sources"');
    expect(openModalHtml).toContain('WHO');
    expect(openModalHtml).toContain('Kemenkes RI');
    expect(openModalHtml).toContain('Tutup Artikel');

    const profileHtml = renderToStaticMarkup(
      <ProfileEditorView
        initialUser={{
          id: 'u1',
          full_name: 'Faris Jihadi Hanif Lubis',
          username: 'farislubis',
          email: 'faris@denthub.id',
          avatar: '',
          role: 'user',
        }}
      />,
    );
    expect(profileHtml).toContain('data-testid="profile-settings-workspace"');
    expect(profileHtml).toContain('data-testid="profile-settings-sidebar"');
    expect(profileHtml).toContain('data-testid="profile-panel-general"');
    expect(profileHtml).not.toContain('data-testid="profile-session-card"');
    expect(profileHtml).toContain('Profil Umum');
    expect(profileHtml).toContain('Keamanan &amp; Kata Sandi');
    expect(profileHtml).toContain('Sesi &amp; Akun');
    expect(profileHtml).toContain('Edit Profil Pengguna');
    expect(profileHtml).toContain('Faris Jihadi Hanif Lubis');
    expect(profileHtml).toContain('farislubis');

    const sessionTabHtml = renderToStaticMarkup(
      <ProfileEditorView
        initialSection="session"
        initialUser={{
          id: 'u1',
          full_name: 'Faris Jihadi Hanif Lubis',
          username: 'farislubis',
          email: 'faris@denthub.id',
          avatar: '',
          role: 'user',
        }}
      />,
    );
    expect(sessionTabHtml).toContain('data-testid="profile-session-card"');
    expect(sessionTabHtml).toContain('Keluar dari Akun');
    expect(sessionTabHtml).not.toContain('data-testid="profile-panel-general"');

    const pageHtml = renderToStaticMarkup(<ProfilePage />);
    expect(pageHtml).toContain('Edit Profil Pengguna');

    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Profil berhasil diperbarui.',
        data: {
          user: {
            id: 'u1',
            full_name: 'Faris Lubis',
            username: 'faris2026',
            email: 'faris@denthub.id',
            avatar: 'data:image/png;base64,abc',
            role: 'user',
          },
        },
      },
    });

    const updated = await updateCurrentUserProfile({
      full_name: 'Faris Lubis',
      username: 'faris2026',
      avatar: 'data:image/png;base64,abc',
    });
    expect(putSpy).toHaveBeenCalledWith('/auth/me', {
      full_name: 'Faris Lubis',
      username: 'faris2026',
      avatar: 'data:image/png;base64,abc',
    });
    expect(updated.username).toBe('faris2026');
  });
});

describe('Deni Chat (/chat – T-204)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders /chat as a full-viewport workspace with sidebar, Deni mascot, and bottom quick-question chips', () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toContain('data-testid="deni-fullscreen-workspace"');
    expect(html).toContain('data-testid="deni-sessions-sidebar"');
    expect(html).toContain('data-testid="deni-bottom-composer"');
    expect(html).toContain('Chat Baru');
    for (const q of INITIAL_SUGGESTED_QUESTIONS) {
      expect(html).toContain(q);
    }
    expect(html).not.toContain('Konsultasi Kesehatan Gigi Bersama Deni');
    expect(html).not.toContain('Disclaimer Medis');
  });

  it('renders scan context card and ClinicEscalationCard when trigger_clinic_finder is true', () => {
    const html = renderToStaticMarkup(
      <DeniChat
        initialScanId={SAMPLE_SCAN_REPORT.id}
        initialScanReport={SAMPLE_SCAN_REPORT}
        initialTriggeredClinics={SAMPLE_CLINICS}
      />,
    );

    expect(html).toContain('data-testid="chat-scan-context-card"');
    expect(html).toContain('Indikasi Karies Gigi (Gigi Berlubang) (91%)');
    expect(html).toContain('data-testid="deni-clinic-escalation"');
    expect(html).toContain('3 Klinik Gigi Terdekat untuk Penanganan Segera');
    expect(html).toContain('Lihat Semua di Peta');
    expect(html).toContain('Klinik Gigi Sehat Bersama');
  });

  it('sendDeniMessage, fetchChatSessions, fetchChatSessionDetail, and deleteChatSessionById hit /chat endpoints', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          session_id: '673a20113d4e5f6a7b8c9d22',
          reply: 'Segera periksakan ke dokter gigi.',
          urgency_level: 'emergency',
          trigger_clinic_finder: true,
          suggested_questions: ['Pertolongan pertama apa yang aman?'],
          medical_disclaimer: 'Saran Deni bersifat edukatif.',
        },
      },
    });

    const turn = await sendDeniMessage({
      message: 'Gigi saya nyut-nyutan',
      scanId: SAMPLE_SCAN_REPORT.id,
    });
    expect(postSpy).toHaveBeenCalledWith('/chat', {
      message: 'Gigi saya nyut-nyutan',
      scan_id: SAMPLE_SCAN_REPORT.id,
    });
    expect(turn.trigger_clinic_finder).toBe(true);

    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [],
          meta: { page: 1, limit: 10, total: 0, total_pages: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: '673a20113d4e5f6a7b8c9d22',
            scan_id: SAMPLE_SCAN_REPORT.id,
            title: 'Konsultasi Hasil Scan',
            has_triggered_clinic: true,
            messages: [],
            updated_at: '2026-11-18T09:31:00.000Z',
          },
        },
      });
    const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      data: { success: true, message: 'Sesi chat dihapus.' },
    });

    await fetchChatSessions(1, 10);
    const detail = await fetchChatSessionDetail('673a20113d4e5f6a7b8c9d22');
    await deleteChatSessionById('673a20113d4e5f6a7b8c9d22');
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(delSpy).toHaveBeenCalledTimes(1);
    expect(detail.has_triggered_clinic).toBe(true);
  });
});

describe('Clinics (/clinics – T-205) and Scan History service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders /clinics focused only on nearest clinic search and Leaflet OSM map (without Dunia Dentist education)', () => {
    const pageHtml = renderToStaticMarkup(<ClinicsPage />);
    expect(pageHtml).toContain('data-testid="clinics-section-locations"');
    expect(pageHtml).not.toContain('data-testid="clinics-section-1-dentist-world"');
    expect(pageHtml).not.toContain('Informasi Seputar Dunia Dentist');
    expect(pageHtml).not.toContain('Disclaimer Medis');

    for (const km of RADIUS_OPTIONS_KM) {
      expect(pageHtml).toContain(`${km} km`);
    }

    const viewHtml = renderToStaticMarkup(
      <ClinicFinderView initialClinics={SAMPLE_CLINICS} initialManualMode />,
    );
    expect(viewHtml).toContain('data-testid="osm-map-view"');
    expect(viewHtml).toContain('data-testid="manual-location-form"');
    expect(viewHtml).toContain('Klinik Gigi Sehat Bersama');

    const cardHtml = renderToStaticMarkup(<ClinicCard clinic={SAMPLE_CLINICS[0]} />);
    expect(cardHtml).toContain('Mo-Sa 09:00-21:00');
    expect(cardHtml).toContain('+62-274-555123');

    const mapHtml = renderToStaticMarkup(
      <OsmMapView
        centerLat={-7.79558}
        centerLng={110.36949}
        clinics={SAMPLE_CLINICS}
        radiusKm={5}
        locationLabel="Yogyakarta"
      />,
    );
    expect(mapHtml).toContain('OpenStreetMap');
    expect(mapHtml).toContain('3 klinik');
  });

  it('supports geolocation, manual city geocode fallback, and fetchNearbyClinics with radius_km', async () => {
    const originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
            error({ code: 1 });
          },
        },
      },
    });
    await expect(requestBrowserGeolocation()).rejects.toEqual({ code: 'GEOLOCATION_DENIED' });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });

    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [{ display_name: 'Bandung, Jawa Barat', latitude: -6.9175, longitude: 107.6191 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          source: 'openstreetmap',
          data: SAMPLE_CLINICS,
        },
      });

    const bandung = await resolveManualLocationQuery('Bandung');
    expect(bandung.lat).toBeCloseTo(-6.9175, 3);

    const clinicsRes = await fetchNearbyClinics(bandung.lat, bandung.lng, 5);
    expect(getSpy).toHaveBeenLastCalledWith('/clinics', {
      params: { lat: bandung.lat, lng: bandung.lng, radius_km: 5 },
    });
    expect(clinicsRes.data).toHaveLength(3);
  });

  it('supports EmptyState and scan history list/detail/delete endpoints', async () => {
    const standaloneEmpty = renderToStaticMarkup(<EmptyState />);
    expect(standaloneEmpty).toContain(DEFAULT_HISTORY_EMPTY_TEXT);

    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [SAMPLE_SCAN_REPORT],
          meta: { page: 1, limit: 10, total: 1, total_pages: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: SAMPLE_SCAN_REPORT },
      });
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      data: { success: true, message: 'Riwayat scan dihapus.' },
    });

    const list = await fetchScanHistory(1, 10);
    expect(list.data).toHaveLength(1);
    const detail = await fetchScanDetailById(SAMPLE_SCAN_REPORT.id as string);
    expect(detail.primary_condition).toBe('caries');
    const del = await deleteScanById(SAMPLE_SCAN_REPORT.id as string);
    expect(del.success).toBe(true);
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
