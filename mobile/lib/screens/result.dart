import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../models.dart';
import '../report_pdf.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key, required this.scan, this.photo});
  final Scan scan;

  /// Hanya ada tepat setelah pemindaian; server tidak menyimpan foto.
  final Uint8List? photo;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  bool _exporting = false;

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      await shareScanReport(widget.scan, photo: widget.photo);
    } catch (_) {
      if (mounted) toast(context, 'Laporan PDF gagal dibuat. Silakan coba lagi.');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _leaveTo(void Function(AppState) open) {
    final state = AppScope.read(context);
    Navigator.of(context).popUntil((r) => r.isFirst);
    open(state);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.scan;
    final t = context.tokens;
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Result')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          if (widget.photo != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Container(
                color: t.border,
                constraints: const BoxConstraints(maxHeight: 280),
                child: Image.memory(
                  widget.photo!,
                  fit: BoxFit.contain,
                  semanticLabel: 'Foto gigi yang dianalisis',
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                UrgencyBadge(s),
                const SizedBox(height: 10),
                Text(s.label, style: context.text.headlineSmall),
                const SizedBox(height: 6),
                Text(
                  s.unsure
                      ? 'Keyakinan model AI terlalu rendah untuk menunjukkan indikasi tertentu, jadi Dentify tidak menampilkan tebakan. Ambil ulang foto di tempat yang lebih terang.'
                      : 'Keyakinan model AI ${s.percent}%. ${s.confidenceMeaning}',
                  style: TextStyle(color: t.muted),
                ),
                const SizedBox(height: 8),
                Text(
                  '${formatWib(s.createdAt)} · ${s.sourceLabel}',
                  style: context.text.bodySmall?.copyWith(color: t.muted),
                ),
                if (s.symptoms.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Keluhan: ${s.symptoms}'),
                ],
              ],
            ),
          ),
          if (s.needsClinic) ...[
            const SizedBox(height: 12),
            ClinicCard(onOpen: () => _leaveTo((st) => st.openTab(3))),
          ],
          const SizedBox(height: 12),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Care Advice', style: context.text.titleMedium),
                const SizedBox(height: 6),
                Text(s.summary),
                _list("Do's", s.dos, Icons.check_circle, t.green),
                _list("Don'ts", s.donts, Icons.cancel, t.red),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Panel(color: t.sand, child: Text(s.disclaimer)),
          const SizedBox(height: 16),
          if (s.unsure) ...[
            FilledButton.icon(
              onPressed: () => _leaveTo((st) => st.openTab(0)),
              icon: const Icon(Icons.refresh),
              label: const Text('Ambil Ulang Foto'),
            ),
            const SizedBox(height: 10),
          ],
          if (s.id != null) ...[
            FilledButton.icon(
              onPressed: () => _leaveTo((st) => st.askDeni(s)),
              icon: const Icon(Icons.chat_bubble_outline),
              label: const Text('Tanya Deni'),
            ),
            const SizedBox(height: 10),
          ],
          OutlinedButton.icon(
            onPressed: _exporting ? null : _export,
            icon: const Icon(Icons.picture_as_pdf_outlined),
            label: BusyLabel('Unduh Laporan PDF', busy: _exporting),
          ),
          if (!s.needsClinic) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _leaveTo((st) => st.openTab(3)),
              icon: const Icon(Icons.location_on_outlined),
              label: const Text('Cari Klinik Gigi'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _list(String title, List<String> items, IconData icon, Color color) => items.isEmpty
      ? const SizedBox.shrink()
      : Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            Text(title, style: context.text.titleMedium?.copyWith(color: color)),
            for (final i in items)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 18, color: color),
                    const SizedBox(width: 10),
                    Expanded(child: Text(i)),
                  ],
                ),
              ),
          ],
        );
}

/// Ajakan ke klinik saat urgensi darurat.
class ClinicCard extends StatelessWidget {
  const ClinicCard({super.key, required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final red = context.tokens.red;
    return Panel(
      color: Color.alphaBlend(red.withValues(alpha: 0.1), context.colors.surface),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: red),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Ada tanda yang memerlukan penanganan segera. Kunjungi dokter gigi terdekat.',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: onOpen,
            style: FilledButton.styleFrom(
              backgroundColor: red,
              foregroundColor: context.colors.onError,
            ),
            icon: const Icon(Icons.location_on),
            label: const Text('Cari Klinik Terdekat'),
          ),
        ],
      ),
    );
  }
}
