import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Kotak bersudut bulat berbingkai, dasar semua kartu.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.color, this.padding = 16, this.onTap});
  final Widget child;
  final Color? color;
  final double padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: color ?? context.colors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: context.tokens.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: EdgeInsets.all(padding), child: child),
    ),
  );
}

class UrgencyBadge extends StatelessWidget {
  const UrgencyBadge(this.scan, {super.key, this.short = false});
  final Scan scan;
  final bool short;

  @override
  Widget build(BuildContext context) {
    final c = scan.unsure ? context.tokens.muted : context.tokens.urgency(scan.urgency);
    final icon = scan.unsure
        ? Icons.help_outline
        : switch (scan.urgency) {
            Urgency.low => Icons.check_circle_outline,
            Urgency.medium => Icons.error_outline,
            Urgency.emergency => Icons.warning_amber_rounded,
          };
    final label = scan.unsure
        ? 'Belum meyakinkan'
        : (short ? scan.urgency.shortLabel : scan.urgency.label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: c),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: context.text.labelMedium?.copyWith(color: c, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Galat dengan tombol coba lagi. Server yang sedang bangun tampil tenang, bukan merah.
class ErrorPanel extends StatelessWidget {
  const ErrorPanel(this.error, {super.key, this.onRetry});
  final ApiException error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = error.isWaking ? context.colors.primary : context.tokens.red;
    return Semantics(
      liveRegion: true,
      child: Panel(
        color: error.isWaking ? context.tokens.soft : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(error.isWaking ? Icons.hourglass_top : Icons.error_outline, color: c),
                const SizedBox(width: 10),
                Expanded(child: Text(error.message)),
              ],
            ),
            if (onRetry != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: onRetry, child: const Text('Coba lagi')),
              ),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });
  final IconData icon;
  final String title, body;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: context.colors.primary),
        const SizedBox(height: 14),
        Text(title, style: context.text.titleMedium, textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(
          body,
          textAlign: TextAlign.center,
          style: TextStyle(color: context.tokens.muted),
        ),
        if (action != null) ...[const SizedBox(height: 18), action!],
      ],
    ),
  );
}

class BusyLabel extends StatelessWidget {
  const BusyLabel(this.text, {super.key, required this.busy});
  final String text;
  final bool busy;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (busy) ...[
        const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
        const SizedBox(width: 10),
      ],
      Flexible(child: Text(text)),
    ],
  );
}

void toast(BuildContext context, String message) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(message)));

Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String body,
  required String action,
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text(action)),
        ],
      ),
    ) ??
    false;

/// Buka tautan di luar aplikasi. Hanya https dan tel.
Future<void> openLink(BuildContext context, Uri uri) async {
  var ok = false;
  if (uri.scheme == 'https' || uri.scheme == 'tel') {
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
  }
  if (!ok && context.mounted) toast(context, 'Tautan tidak dapat dibuka di perangkat ini.');
}
