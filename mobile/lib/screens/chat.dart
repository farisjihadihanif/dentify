import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../models.dart';
import '../photo.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'result.dart';

class _Message {
  _Message.user(this.text, {this.photo}) : mine = true, clinic = false, fallback = false;
  _Message.deni(this.text, {this.clinic = false, this.fallback = false})
    : mine = false,
      photo = null;

  final String text;
  final bool mine, clinic, fallback;
  final Uint8List? photo;
}

const _starters = [
  'Bagaimana langkah perawatan harian untuk kondisi gigi saya?',
  'Makanan atau minuman apa yang sebaiknya saya hindari sementara waktu?',
  'Kapan saya perlu segera memeriksakan diri ke dokter gigi?',
];

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <_Message>[];
  List<String> _suggestions = _starters;
  String? _sessionId;
  Scan? _scan;
  Photo? _photo;
  bool _sending = false, _opening = false, _picking = false;
  ApiException? _error;
  int _request = 0;

  /// Berganti saat percakapan diganti, supaya balasan lama tidak masuk ke percakapan baru.
  int _run = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = AppScope.of(context);
    if (state.chatRequest != _request) {
      _request = state.chatRequest;
      _reset();
      _scan = state.chatScan;
    }
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _reset() {
    _run++;
    _messages.clear();
    _suggestions = _starters;
    _sessionId = null;
    _scan = null;
    _photo = null;
    _sending = false;
    _opening = false;
    _error = null;
  }

  void _toEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
    // Daftar dibalik: posisi 0 = pesan terbaru.
    if (_scroll.hasClients) {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    }
  });

  Future<void> _attach() async {
    final camera = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Ambil foto'),
              onTap: () => Navigator.pop(c, true),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Pilih dari galeri'),
              onTap: () => Navigator.pop(c, false),
            ),
          ],
        ),
      ),
    );
    if (camera == null || !mounted) return;
    setState(() => _picking = true);
    try {
      final p = await pickPhoto(camera: camera);
      if (p != null && mounted) setState(() => _photo = p);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _input.text).trim();
    final photo = _photo;
    if (_sending || _opening || _picking || (text.isEmpty && photo == null)) return;
    final run = _run;
    final message = _Message.user(text, photo: photo?.bytes);
    setState(() {
      _messages.add(message);
      _sending = true;
      _error = null;
      _photo = null;
      if (preset == null) _input.clear();
    });
    _toEnd();
    try {
      final r = await AppScope.read(context).api.post('/chat', {
        'message': text,
        'session_id': ?_sessionId,
        'scan_id': ?_scan?.id,
        if (photo != null) ...{
          'image_data_url': 'data:image/jpeg;base64,${base64Encode(photo.bytes)}',
          'image_mime_type': 'image/jpeg',
        },
      }, timeout: ApiClient.aiTimeout);
      if (!mounted || run != _run) return;
      final d = r['data'] as Json;
      setState(() {
        _sessionId = d['session_id'] as String? ?? _sessionId;
        _messages.add(
          _Message.deni(
            '${d['reply']}',
            clinic: d['trigger_clinic_finder'] == true,
            fallback: d['is_fallback'] == true,
          ),
        );
        _suggestions = [for (final q in d['suggested_questions'] as List? ?? const []) '$q'];
      });
      _toEnd();
    } on ApiException catch (e) {
      if (!mounted || run != _run) return;
      setState(() {
        // Kembalikan pesan ke kotak tulis supaya bisa dikirim ulang.
        _messages.remove(message);
        if (_input.text.isEmpty) _input.text = text;
        _photo ??= photo;
        _error = e;
      });
    } finally {
      if (mounted && run == _run) setState(() => _sending = false);
    }
  }

  Future<void> _openSession(ChatSession s) async {
    setState(() {
      _reset();
      _opening = true;
    });
    final run = _run;
    try {
      final r = await AppScope.read(context).api.get('/chat/sessions/${s.id}');
      if (!mounted || run != _run) return;
      setState(() {
        _sessionId = s.id;
        _suggestions = const [];
        for (final m in ((r['data'] as Json)['messages'] as List).cast<Json>()) {
          _messages.add(
            m['role'] == 'user'
                ? _Message.user('${m['content']}')
                : _Message.deni('${m['content']}', clinic: m['trigger_clinic_finder'] == true),
          );
        }
      });
    } on ApiException catch (e) {
      if (mounted && run == _run) toast(context, e.message);
    } finally {
      if (mounted && run == _run) setState(() => _opening = false);
    }
  }

  Future<void> _showSessions() async {
    final picked = await Navigator.of(context).push(
      MaterialPageRoute<ChatSession>(
        builder: (_) => SessionsScreen(
          onDeleted: (id) {
            if (id == _sessionId) setState(_reset);
          },
        ),
      ),
    );
    if (picked != null && mounted) await _openSession(picked);
  }

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[
      if (_messages.isEmpty && !_opening) _intro(context),
      for (final m in _messages) _bubble(context, m),
      if (_sending)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Align(
            alignment: Alignment.centerLeft,
            child: BusyLabel('Deni sedang mengetik…', busy: true),
          ),
        ),
      if (_error != null) ErrorPanel(_error!, onRetry: _send),
      if (!_sending && _error == null)
        for (final q in _suggestions)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Panel(
              color: context.tokens.deniSoft,
              padding: 12,
              onTap: () => _send(q),
              child: Text(q),
            ),
          ),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat with Deni'),
        actions: [
          IconButton(
            tooltip: 'Percakapan baru',
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: () => setState(_reset),
          ),
          IconButton(
            tooltip: 'Daftar percakapan',
            icon: const Icon(Icons.forum_outlined),
            onPressed: _showSessions,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _opening
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scroll,
                    reverse: true,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    itemCount: items.length,
                    itemBuilder: (_, i) => items[items.length - 1 - i],
                  ),
          ),
          _composer(context),
        ],
      ),
    );
  }

  Widget _intro(BuildContext context) => Column(
    children: [
      const SizedBox(height: 16),
      SvgPicture.asset('assets/brand/deni-mascot.svg', height: 130),
      const SizedBox(height: 12),
      Text('Ask Deni', style: context.text.headlineSmall),
      const SizedBox(height: 6),
      Text(
        'Tanyakan apa saja seputar kesehatan gigi. Saran Deni bersifat edukatif dan tidak menggantikan pemeriksaan dokter gigi.',
        textAlign: TextAlign.center,
        style: TextStyle(color: context.tokens.muted),
      ),
      const SizedBox(height: 12),
    ],
  );

  Widget _bubble(BuildContext context, _Message m) {
    final width = MediaQuery.sizeOf(context).width;
    final onMine = context.colors.onPrimary;
    return Align(
      alignment: m.mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: width * (m.mine ? 0.8 : 0.9)),
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: m.mine ? context.colors.primary : context.colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: m.mine ? null : Border.all(color: context.tokens.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (m.photo != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  m.photo!,
                  height: 170,
                  fit: BoxFit.cover,
                  cacheHeight: 600,
                  semanticLabel: 'Foto yang dilampirkan',
                ),
              ),
              if (m.text.isNotEmpty) const SizedBox(height: 8),
            ],
            if (m.mine)
              if (m.text.isNotEmpty)
                SelectableText(m.text, style: TextStyle(color: onMine))
              else
                const SizedBox.shrink()
            else
              SelectionArea(
                child: MarkdownBody(
                  data: m.text,
                  // Jangan memuat gambar dari internet lewat balasan AI.
                  imageBuilder: (_, _, _) => const SizedBox.shrink(),
                  onTapLink: (_, href, _) {
                    final uri = Uri.tryParse(href ?? '');
                    if (uri != null) openLink(context, uri);
                  },
                  styleSheet: _markdownStyle(context),
                ),
              ),
            if (m.fallback) ...[
              const SizedBox(height: 8),
              Text(
                'Deni sedang tidak tersedia, jadi ini panduan umum. Silakan coba lagi nanti.',
                style: context.text.bodySmall?.copyWith(color: context.tokens.yellow),
              ),
            ],
            if (m.clinic) ...[
              const SizedBox(height: 10),
              ClinicCard(onOpen: () => AppScope.read(context).openTab(3)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _composer(BuildContext context) => Material(
    color: context.colors.surface,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_scan != null)
            Padding(
              padding: const EdgeInsets.only(left: 8, bottom: 6),
              child: InputChip(
                avatar: const Icon(Icons.center_focus_strong, size: 18),
                label: Text(_scan!.label, overflow: TextOverflow.ellipsis),
                onDeleted: _sending ? null : () => setState(() => _scan = null),
              ),
            ),
          if (_photo != null)
            Padding(
              padding: const EdgeInsets.only(left: 8, bottom: 8),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.memory(
                      _photo!.bytes,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      cacheWidth: 200,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Hapus foto',
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(() => _photo = null),
                  ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                tooltip: 'Lampirkan foto',
                icon: const Icon(Icons.add_a_photo_outlined),
                onPressed: _sending || _picking ? null : _attach,
              ),
              Expanded(
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 1000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Tulis pesan…',
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton.filled(
                tooltip: 'Kirim',
                icon: const Icon(Icons.send),
                onPressed: _sending || _opening || _picking ? null : _send,
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

/// Lengkap: paket markdown memakai ThemeData bawaan Flutter, bukan tema aplikasi ini.
MarkdownStyleSheet _markdownStyle(BuildContext context) {
  final body = context.text.bodyMedium!;
  final bold = body.copyWith(fontWeight: FontWeight.w700);
  final heading = context.text.titleMedium!;
  return MarkdownStyleSheet(
    p: body,
    a: body.copyWith(color: context.colors.primary, decoration: TextDecoration.underline),
    h1: heading,
    h2: heading,
    h3: heading,
    h4: bold,
    h5: bold,
    h6: bold,
    strong: const TextStyle(fontWeight: FontWeight.w700),
    em: const TextStyle(fontStyle: FontStyle.italic),
    listBullet: body,
    tableHead: bold,
    tableBody: body,
    blockquote: body,
    blockquoteDecoration: BoxDecoration(color: context.tokens.soft),
    code: body.copyWith(backgroundColor: context.tokens.soft),
    codeblockDecoration: BoxDecoration(color: context.tokens.soft),
    horizontalRuleDecoration: BoxDecoration(
      border: Border(top: BorderSide(color: context.tokens.border)),
    ),
  );
}

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key, required this.onDeleted});
  final void Function(String id) onDeleted;
  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  final _items = <ChatSession>[];
  int _page = 0, _totalPages = 1;
  bool _loading = true;
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = AppScope.read(context).api;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await api.get('/chat/sessions', query: {'page': _page + 1, 'limit': 20});
      if (!mounted) return;
      final known = {for (final s in _items) s.id};
      setState(() {
        _items.addAll([
          for (final j in r['data'] as List)
            if (!known.contains((j as Json)['id'])) ChatSession(j),
        ]);
        _page++;
        _totalPages = ((r['meta'] as Map?)?['total_pages'] as num? ?? 1).toInt();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(ChatSession s) async {
    if (!await confirm(
      context,
      title: 'Delete Chat',
      body: 'Hapus percakapan ini? Tindakan ini tidak dapat dibatalkan.',
      action: 'Hapus',
    )) {
      return;
    }
    if (!mounted) return;
    try {
      await AppScope.read(context).api.delete('/chat/sessions/${s.id}');
    } on ApiException catch (e) {
      if (e.status != 404) {
        if (mounted) toast(context, e.message);
        return;
      }
    }
    if (!mounted) return;
    setState(() => _items.remove(s));
    widget.onDeleted(s.id);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Conversations')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (_items.isEmpty && !_loading && _error == null)
          const EmptyState(
            icon: Icons.forum_outlined,
            title: 'No Conversations Yet',
            body: 'Percakapan Anda dengan Deni akan muncul di sini.',
          ),
        for (final s in _items) ...[
          Panel(
            onTap: () => Navigator.pop(context, s),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.title, style: context.text.titleMedium),
                      const SizedBox(height: 4),
                      Text(
                        formatWib(s.updatedAt),
                        style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Hapus percakapan',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => _delete(s),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (_error != null) ErrorPanel(_error!, onRetry: _load),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_error == null && _page < _totalPages)
          OutlinedButton(onPressed: _load, child: const Text('Muat lebih banyak')),
      ],
    ),
  );
}
