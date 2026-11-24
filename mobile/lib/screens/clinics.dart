import 'dart:async';

import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Tengah Indonesia, sebelum lokasi dipilih.
const _indonesia = LatLng(-2.5, 118);

class ClinicsScreen extends StatefulWidget {
  const ClinicsScreen({super.key, this.tileProvider, this.autoLocate = true});

  /// Untuk tes.
  final TileProvider? tileProvider;
  final bool autoLocate;

  @override
  State<ClinicsScreen> createState() => _ClinicsScreenState();
}

class _ClinicsScreenState extends State<ClinicsScreen> {
  final _map = MapController();
  final _query = TextEditingController();
  LatLng? _center;
  String _place = '';
  double _radius = 5;
  List<Clinic> _clinics = const [];
  String _source = '';
  Clinic? _selected;
  bool _busy = false, _done = false, _openSettings = false;
  String? _notice;
  ApiException? _error;
  Future<void> Function()? _retry;
  int _run = 0;

  @override
  void initState() {
    super.initState();
    if (widget.autoLocate) WidgetsBinding.instance.addPostFrameCallback((_) => _locate());
  }

  @override
  void dispose() {
    _map.dispose();
    _query.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    final run = _begin();
    String? notice;
    var settings = false;
    Position? pos;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        notice = 'Layanan lokasi mati. Aktifkan GPS, atau cari nama kota di bawah.';
      } else {
        var p = await Geolocator.checkPermission();
        if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
        if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
          settings = p == LocationPermission.deniedForever;
          notice = 'Izin lokasi ditolak. Cari nama kota atau kecamatan Anda di bawah.';
        } else {
          try {
            pos = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(timeLimit: Duration(seconds: 12)),
            );
          } on TimeoutException {
            pos = await Geolocator.getLastKnownPosition();
          }
          if (pos == null) notice = 'Lokasi belum ditemukan. Coba lagi, atau cari nama kota.';
        }
      }
    } catch (_) {
      notice = 'Lokasi tidak dapat dibaca. Cari nama kota atau kecamatan Anda di bawah.';
    }
    if (!mounted || run != _run) return;
    if (pos == null) {
      setState(() {
        _busy = false;
        _notice = notice;
        _openSettings = settings;
      });
      return;
    }
    _center = LatLng(pos.latitude, pos.longitude);
    _place = 'Lokasi Anda saat ini';
    await _fetch();
  }

  Future<void> _search() async {
    final q = _query.text.trim();
    if (q.length < 2) {
      toast(context, 'Masukkan minimal 2 huruf nama lokasi.');
      return;
    }
    FocusScope.of(context).unfocus();
    final run = _begin();
    try {
      final r = await AppScope.read(context).api.get('/clinics/geocode', query: {'q': q});
      if (!mounted || run != _run) return;
      final list = r['data'] as List;
      if (list.isEmpty) {
        setState(() {
          _busy = false;
          _notice = 'Lokasi "$q" tidak ditemukan. Coba nama kota atau kecamatan lain.';
        });
        return;
      }
      final c = list.first as Json;
      _center = LatLng((c['latitude'] as num).toDouble(), (c['longitude'] as num).toDouble());
      _place = '${c['display_name']}';
      await _fetch();
    } on ApiException catch (e) {
      _fail(run, e, _search);
    }
  }

  Future<void> _fetch() async {
    final center = _center;
    if (center == null) return;
    final run = _begin();
    _move(center, _radius <= 5 ? 13.5 : 12);
    try {
      final r = await AppScope.read(context).api.get(
        '/clinics',
        query: {'lat': center.latitude, 'lng': center.longitude, 'radius_km': _radius},
      );
      if (!mounted || run != _run) return;
      setState(() {
        _clinics = [for (final j in r['data'] as List) Clinic(j as Json)];
        _source = '${r['source']}';
        _busy = false;
        _done = true;
      });
    } on ApiException catch (e) {
      _fail(run, e, _fetch);
    }
  }

  int _begin() {
    setState(() {
      _busy = true;
      _done = false;
      _error = null;
      _notice = null;
      _openSettings = false;
      _selected = null;
      _clinics = const [];
    });
    return ++_run;
  }

  void _fail(int run, ApiException e, Future<void> Function() retry) {
    if (!mounted || run != _run) return;
    setState(() {
      _busy = false;
      _error = e;
      _retry = retry;
    });
  }

  void _move(LatLng to, double zoom) {
    try {
      _map.move(to, zoom);
    } catch (_) {
      // Peta belum siap; initialCenter dipakai.
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final center = _center;
    return Scaffold(
      appBar: AppBar(title: const Text('Clinic Finder')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _query,
                    textInputAction: TextInputAction.search,
                    maxLength: 100,
                    onSubmitted: (_) => _search(),
                    decoration: InputDecoration(
                      hintText: 'Kota atau kecamatan',
                      counterText: '',
                      isDense: true,
                      suffixIcon: IconButton(
                        tooltip: 'Cari lokasi',
                        icon: const Icon(Icons.search),
                        onPressed: _search,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Gunakan lokasi saya',
                  icon: const Icon(Icons.my_location),
                  onPressed: _busy ? null : _locate,
                ),
              ],
            ),
          ),
          Expanded(
            flex: 5,
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: center ?? _indonesia,
                initialZoom: center == null ? 4 : 13.5,
                maxZoom: 19,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'id.farisjihadi.dentify',
                  tileProvider: widget.tileProvider,
                  tileBuilder: dark ? darkModeTileBuilder : null,
                ),
                MarkerLayer(
                  markers: [
                    if (center != null)
                      Marker(
                        point: center,
                        width: 26,
                        height: 26,
                        child: Icon(Icons.my_location, color: context.colors.primary),
                      ),
                    for (final c in _clinics)
                      Marker(
                        point: LatLng(c.lat, c.lng),
                        width: 48,
                        height: 48,
                        alignment: Alignment.topCenter,
                        child: Semantics(
                          button: true,
                          label: c.name,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _selected = c),
                            child: Icon(
                              Icons.location_on,
                              size: c.id == _selected?.id ? 46 : 36,
                              color: c.id == _selected?.id
                                  ? context.tokens.red
                                  : context.colors.primary,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const _Attribution(),
              ],
            ),
          ),
          Expanded(
            flex: 6,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    for (final r in const [2.0, 5.0, 10.0, 20.0])
                      ChoiceChip(
                        label: Text('${r.toInt()} km'),
                        selected: _radius == r,
                        onSelected: _busy
                            ? null
                            : (_) {
                                setState(() => _radius = r);
                                _fetch();
                              },
                      ),
                  ],
                ),
                if (_place.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    _place,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
                  ),
                ],
                const SizedBox(height: 10),
                ..._body(context),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _body(BuildContext context) => [
    if (_busy)
      const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: BusyLabel('Mencari klinik…', busy: true)),
      ),
    if (_error != null) ErrorPanel(_error!, onRetry: _retry),
    if (_notice != null)
      Panel(
        color: context.tokens.soft,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_notice!),
            if (_openSettings)
              const TextButton(
                onPressed: Geolocator.openAppSettings,
                child: Text('Buka pengaturan izin'),
              ),
          ],
        ),
      ),
    if (_done && _source == 'directory_fallback' && _clinics.isNotEmpty) ...[
      Panel(
        color: context.tokens.sand,
        padding: 12,
        child: const Text(
          'OpenStreetMap sedang tidak dapat dihubungi. Daftar ini dari direktori Dentify.',
        ),
      ),
      const SizedBox(height: 10),
    ],
    if (_done && _clinics.isEmpty)
      EmptyState(
        icon: Icons.search_off,
        title: 'No Clinics Found',
        body: 'Coba perbesar radius atau cari lokasi lain.',
        action: OutlinedButton(
          onPressed: () => openLink(
            context,
            Uri.https('www.google.com', '/maps/search/', {
              'api': '1',
              'query': 'dokter gigi ${_place == 'Lokasi Anda saat ini' ? 'terdekat' : _place}',
            }),
          ),
          child: const Text('Cari di Google Maps'),
        ),
      ),
    if (!_busy && !_done && _error == null && _notice == null)
      const EmptyState(
        icon: Icons.location_on_outlined,
        title: 'Find a Clinic',
        body: 'Gunakan lokasi Anda atau cari nama kota untuk melihat klinik gigi terdekat.',
      ),
    // Yang dipilih di peta tampil paling atas.
    for (final c in [?_selected, ..._clinics.where((c) => c.id != _selected?.id)]) ...[
      _card(context, c),
      const SizedBox(height: 10),
    ],
  ];

  Widget _card(BuildContext context, Clinic c) => Panel(
    color: c.id == _selected?.id ? context.tokens.soft : null,
    onTap: () {
      setState(() => _selected = c);
      _move(LatLng(c.lat, c.lng), 16);
    },
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(c.name, style: context.text.titleMedium),
        const SizedBox(height: 4),
        Text(
          '${c.distanceKm.toStringAsFixed(1).replaceAll('.', ',')} km${c.address == null ? '' : ' · ${c.address}'}',
          style: TextStyle(color: context.tokens.muted),
        ),
        if (c.hours != null) Text('Jam buka: ${c.hours}', style: context.text.bodySmall),
        const SizedBox(height: 6),
        Wrap(
          spacing: 4,
          children: [
            TextButton.icon(
              onPressed: () => openLink(context, c.directions),
              icon: const Icon(Icons.directions),
              label: const Text('Petunjuk arah'),
            ),
            if (c.phone != null)
              TextButton.icon(
                onPressed: () => openLink(
                  context,
                  // Data OSM bisa berisi beberapa nomor; pakai yang pertama.
                  Uri(
                    scheme: 'tel',
                    path: c.phone!.split(RegExp('[;,/]')).first.replaceAll(RegExp(r'[^0-9+]'), ''),
                  ),
                ),
                icon: const Icon(Icons.call_outlined),
                label: const Text('Telepon'),
              ),
          ],
        ),
      ],
    ),
  );
}

class _Attribution extends StatelessWidget {
  const _Attribution();

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.bottomRight,
    child: GestureDetector(
      onTap: () => openLink(context, Uri.parse('https://www.openstreetmap.org/copyright')),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        color: context.colors.surface.withValues(alpha: 0.9),
        child: const Text('© OpenStreetMap contributors', style: TextStyle(fontSize: 11)),
      ),
    ),
  );
}
