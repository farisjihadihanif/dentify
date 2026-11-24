import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../models.dart';
import '../photo.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'result.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _symptoms = TextEditingController();
  Photo? _photo;
  bool _picking = false, _sending = false;
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    AppScope.read(context).warmUp();
    recoverLostPhoto().then((p) {
      if (p != null && mounted && _photo == null) setState(() => _photo = p);
    });
  }

  @override
  void dispose() {
    _symptoms.dispose();
    super.dispose();
  }

  Future<void> _pick(bool camera) async {
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final p = await pickPhoto(camera: camera);
      if (p != null && mounted) setState(() => _photo = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _analyze() async {
    final photo = _photo;
    if (photo == null || _sending) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      final r = await state.api.upload(
        '/scans',
        field: 'image',
        bytes: photo.bytes,
        filename: 'foto-gigi.jpg',
        fields: {
          'capture_source': photo.fromCamera ? 'camera' : 'upload',
          if (_symptoms.text.trim().isNotEmpty) 'user_symptoms': _symptoms.text.trim(),
        },
      );
      if (!mounted) return;
      final scan = Scan(r['data'] as Json);
      state.scansChanged();
      setState(() {
        _photo = null;
        _symptoms.clear();
      });
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ResultScreen(scan: scan, photo: photo.bytes),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final photo = _photo;
    final busy = _picking || _sending;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/brand/dentify-logo.png', height: 34),
            const SizedBox(width: 8),
            const Text('Dentify'),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text('Dental Scan', style: context.text.headlineSmall),
          const SizedBox(height: 4),
          Text(
            'Ambil foto gigi untuk skrining awal. Hasilnya bukan diagnosis dokter.',
            style: TextStyle(color: context.tokens.muted),
          ),
          const SizedBox(height: 16),
          if (photo == null) ..._guide(context) else ..._preview(context, photo, busy),
          if (_error != null) ...[
            const SizedBox(height: 14),
            ErrorPanel(
              _error!,
              onRetry: photo != null && !busy && _error!.code != 'NOT_DENTAL_IMAGE'
                  ? _analyze
                  : null,
            ),
          ],
          const SizedBox(height: 16),
          if (photo != null) ...[
            FilledButton(
              onPressed: busy ? null : _analyze,
              child: BusyLabel(_sending ? 'Menganalisis…' : 'Analisis Foto', busy: _sending),
            ),
            if (_sending) ...[
              const SizedBox(height: 8),
              Text(
                'Bila server baru dinyalakan, proses ini bisa memakan waktu sekitar 1 menit.',
                textAlign: TextAlign.center,
                style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
              ),
            ],
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Expanded(
                child: photo == null
                    ? FilledButton.icon(
                        onPressed: busy ? null : () => _pick(true),
                        icon: const Icon(Icons.photo_camera),
                        label: const Text('Kamera'),
                      )
                    : OutlinedButton.icon(
                        onPressed: busy ? null : () => _pick(true),
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text('Ambil Ulang'),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => _pick(false),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Galeri'),
                ),
              ),
            ],
          ),
          if (_picking) ...[
            const SizedBox(height: 14),
            const Center(child: BusyLabel('Menyiapkan foto…', busy: true)),
          ],
        ],
      ),
    );
  }

  List<Widget> _guide(BuildContext context) => [
    Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Photo Guide', style: context.text.titleMedium),
          const SizedBox(height: 10),
          for (final (icon, text) in const [
            (Icons.wb_sunny_outlined, 'Gunakan tempat terang, sebaiknya cahaya dari depan.'),
            (Icons.clean_hands_outlined, 'Sikat gigi dahulu dan buka mulut lebar.'),
            (Icons.center_focus_strong, 'Dekatkan kamera dan fokuskan pada area keluhan.'),
            (Icons.back_hand_outlined, 'Pegang ponsel dengan stabil agar foto tidak buram.'),
          ])
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(icon, color: context.colors.primary),
                  const SizedBox(width: 12),
                  Expanded(child: Text(text)),
                ],
              ),
            ),
          const SizedBox(height: 6),
          Text(
            'Foto hanya dipakai untuk analisis dan tidak disimpan di server.',
            style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
          ),
        ],
      ),
    ),
  ];

  List<Widget> _preview(BuildContext context, Photo photo, bool busy) => [
    ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        color: context.tokens.border,
        constraints: const BoxConstraints(maxHeight: 340),
        width: double.infinity,
        child: Image.memory(photo.bytes, fit: BoxFit.contain, semanticLabel: 'Foto gigi Anda'),
      ),
    ),
    const SizedBox(height: 14),
    TextField(
      controller: _symptoms,
      enabled: !busy,
      maxLength: 500,
      minLines: 2,
      maxLines: 4,
      textCapitalization: TextCapitalization.sentences,
      decoration: const InputDecoration(
        labelText: 'Keluhan (opsional)',
        hintText: 'Misalnya: ngilu saat minum dingin sejak 3 hari lalu',
        alignLabelWithHint: true,
      ),
    ),
  ];
}
