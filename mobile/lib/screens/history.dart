import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'result.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _items = <Scan>[];
  int _page = 0, _totalPages = 1, _version = -1, _run = 0;
  bool _loading = false;
  ApiException? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final v = AppScope.of(context).scansVersion;
    if (v != _version) {
      _version = v;
      _load(reset: true);
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    final run = ++_run;
    final page = reset ? 1 : _page + 1;
    final api = AppScope.read(context).api;
    // Dipanggil juga dari didChangeDependencies: nilai langsung diisi, build menyusul.
    _loading = true;
    _error = null;
    if (!reset) setState(() {});
    try {
      final r = await api.get('/scans', query: {'page': page, 'limit': 10});
      if (!mounted || run != _run) return;
      final list = [for (final j in r['data'] as List) Scan(j as Json)];
      setState(() {
        if (reset) _items.clear();
        // Scan baru menggeser halaman: buang yang sudah ada.
        final known = {for (final s in _items) s.id};
        _items.addAll(list.where((s) => !known.contains(s.id)));
        _page = page;
        _totalPages = ((r['meta'] as Map?)?['total_pages'] as num? ?? 1).toInt();
      });
    } on ApiException catch (e) {
      if (mounted && run == _run) setState(() => _error = e);
    } finally {
      if (mounted && run == _run) setState(() => _loading = false);
    }
  }

  Future<void> _delete(Scan s) async {
    if (!await confirm(
      context,
      title: 'Delete Scan',
      body: 'Hapus hasil scan ini dari riwayat? Tindakan ini tidak dapat dibatalkan.',
      action: 'Hapus',
    )) {
      return;
    }
    if (!mounted) return;
    final state = AppScope.read(context);
    try {
      await state.api.delete('/scans/${s.id}');
    } on ApiException catch (e) {
      if (e.status != 404) {
        if (mounted) toast(context, e.message);
        return;
      }
    }
    if (!mounted) return;
    setState(() => _items.removeWhere((x) => x.id == s.id));
    state.scansChanged();
    toast(context, 'Riwayat scan dihapus.');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan History')),
    body: RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (_items.isEmpty && !_loading && _error == null)
            EmptyState(
              icon: Icons.history,
              title: 'No Scans Yet',
              body: 'Hasil scan Anda akan muncul di sini.',
              action: FilledButton(
                onPressed: () => AppScope.read(context).openTab(0),
                child: const Text('Mulai Scan'),
              ),
            ),
          for (final s in _items) ...[_tile(s), const SizedBox(height: 10)],
          if (_error != null) ErrorPanel(_error!, onRetry: () => _load(reset: _page == 0)),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error == null && _page < _totalPages && _items.isNotEmpty)
            OutlinedButton(onPressed: _load, child: const Text('Muat lebih banyak')),
        ],
      ),
    ),
  );

  Widget _tile(Scan s) => Panel(
    onTap: () =>
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ResultScreen(scan: s))),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(s.label, style: context.text.titleMedium),
              const SizedBox(height: 4),
              Text(
                s.unsure ? formatWib(s.createdAt) : '${formatWib(s.createdAt)} · ${s.percent}%',
                style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
              ),
              const SizedBox(height: 10),
              UrgencyBadge(s, short: true),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Hapus scan',
          icon: const Icon(Icons.delete_outline),
          onPressed: () => _delete(s),
        ),
      ],
    ),
  );
}
