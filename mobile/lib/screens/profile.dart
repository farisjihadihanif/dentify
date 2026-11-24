import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show PlatformException;
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import '../photo.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _savingPhoto = false;

  Future<void> _changePhoto() async {
    final state = AppScope.read(context);
    setState(() => _savingPhoto = true);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (file == null) return;
      final Uint8List bytes;
      try {
        bytes = await compressJpeg(file.path, maxBytes: 300 * 1024, longSides: const [512, 320]);
      } finally {
        try {
          await File(file.path).delete();
        } catch (_) {}
      }
      await state.updateProfile({'avatar': 'data:image/jpeg;base64,${base64Encode(bytes)}'});
      if (mounted) toast(context, 'Foto profil diperbarui.');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } on PlatformException {
      if (mounted) toast(context, 'Galeri tidak dapat dibuka. Silakan coba lagi.');
    } finally {
      if (mounted) setState(() => _savingPhoto = false);
    }
  }

  Future<void> _removePhoto() async {
    setState(() => _savingPhoto = true);
    try {
      await AppScope.read(context).updateProfile({'avatar': ''});
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _savingPhoto = false);
    }
  }

  Future<void> _logout() async {
    final ok = await confirm(
      context,
      title: 'Log Out',
      body: 'Keluar dari akun Dentify di perangkat ini?',
      action: 'Keluar',
    );
    if (ok && mounted) await AppScope.read(context).logout();
  }

  void _edit(Widget form) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => form,
  );

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final user = state.user;
    if (user == null) return const SizedBox.shrink();
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Panel(
            child: Row(
              children: [
                UserAvatar(user, busy: _savingPhoto),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.fullName, style: context.text.titleLarge),
                      if (user.username != null) Text('@${user.username}'),
                      Text(user.email, style: TextStyle(color: context.tokens.muted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _section('Account'),
          _group([
            _row(Icons.edit_outlined, 'Ubah nama dan username', () => _edit(_ProfileForm(user))),
            _row(
              Icons.photo_camera_outlined,
              'Ganti foto profil',
              _savingPhoto ? null : _changePhoto,
            ),
            if (user.avatar.isNotEmpty)
              _row(
                Icons.no_photography_outlined,
                'Hapus foto profil',
                _savingPhoto ? null : _removePhoto,
              ),
            _row(Icons.lock_outline, 'Ganti password', () => _edit(const _PasswordForm())),
          ]),
          _section('Appearance'),
          SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(value: ThemeMode.system, label: Text('Sistem')),
              ButtonSegment(value: ThemeMode.light, label: Text('Terang')),
              ButtonSegment(value: ThemeMode.dark, label: Text('Gelap')),
            ],
            selected: {state.themeMode},
            onSelectionChanged: (s) => state.setTheme(s.first),
          ),
          _section('About'),
          _group([
            _row(
              Icons.language,
              'Situs web Dentify',
              () => openLink(context, Uri.parse(websiteUrl)),
            ),
            _row(
              Icons.info_outline,
              'Tentang dan lisensi',
              () => showAboutDialog(
                context: context,
                applicationName: 'Dentify',
                applicationVersion: appVersion,
                applicationIcon: Image.asset('assets/brand/dentify-logo.png', height: 48),
                children: const [
                  Text(
                    'Dentify adalah alat skrining awal berbasis AI dan bukan pengganti diagnosis dokter gigi.',
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: _logout,
            style: OutlinedButton.styleFrom(foregroundColor: context.tokens.red),
            icon: const Icon(Icons.logout),
            label: const Text('Keluar'),
          ),
          const SizedBox(height: 12),
          Text(
            'Versi $appVersion',
            textAlign: TextAlign.center,
            style: context.text.bodySmall?.copyWith(color: context.tokens.muted),
          ),
        ],
      ),
    );
  }

  Widget _section(String t) => Padding(
    padding: const EdgeInsets.only(top: 22, bottom: 8),
    child: Text(t, style: context.text.titleMedium),
  );

  Widget _group(List<Widget> rows) => Panel(padding: 0, child: Column(children: rows));

  Widget _row(IconData icon, String label, VoidCallback? onTap) => ListTile(
    leading: Icon(icon, color: context.colors.primary),
    title: Text(label),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );
}

class UserAvatar extends StatelessWidget {
  const UserAvatar(this.user, {super.key, this.busy = false});
  final User user;
  final bool busy;

  ImageProvider? _image() {
    final a = user.avatar;
    if (a.startsWith('https://')) return NetworkImage(a);
    if (a.startsWith('data:image/')) {
      try {
        return MemoryImage(base64Decode(a.substring(a.indexOf(',') + 1)));
      } on FormatException {
        return null;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final image = busy ? null : _image();
    final name = user.fullName.trim();
    return CircleAvatar(
      radius: 34,
      backgroundColor: context.tokens.soft,
      foregroundImage: image,
      onForegroundImageError: image == null ? null : (_, _) {},
      child: busy
          ? const CircularProgressIndicator()
          : Text(
              name.isEmpty ? '?' : name.characters.first.toUpperCase(),
              style: context.text.headlineSmall,
            ),
    );
  }
}

/// Lembar formulir bersama: judul, isian, galat, tombol simpan.
class _Sheet extends StatelessWidget {
  const _Sheet({
    required this.title,
    required this.children,
    required this.busy,
    required this.onSave,
    this.error,
  });
  final String title;
  final List<Widget> children;
  final bool busy;
  final VoidCallback onSave;
  final ApiException? error;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: context.text.titleLarge),
        const SizedBox(height: 16),
        for (final c in children) ...[c, const SizedBox(height: 14)],
        if (error != null) ...[ErrorPanel(error!), const SizedBox(height: 14)],
        FilledButton(
          onPressed: busy ? null : onSave,
          child: BusyLabel('Simpan', busy: busy),
        ),
      ],
    ),
  );
}

mixin _SaveMixin<T extends StatefulWidget> on State<T> {
  bool busy = false;
  ApiException? error;
  Map<String, String> fields = const {};

  Future<void> save(Json changes, String done) async {
    final state = AppScope.read(context);
    setState(() {
      busy = true;
      error = null;
      fields = const {};
    });
    try {
      await state.updateProfile(changes);
      if (!mounted) return;
      toast(context, done);
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          fields = e.fields;
          error = e.fields.isEmpty ? e : null;
        });
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

class _ProfileForm extends StatefulWidget {
  const _ProfileForm(this.user);
  final User user;
  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> with _SaveMixin {
  late final _name = TextEditingController(text: widget.user.fullName);
  late final _username = TextEditingController(text: widget.user.username ?? '');

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    super.dispose();
  }

  void _submit() {
    final username = _username.text.trim().toLowerCase();
    save({
      'full_name': _name.text.trim(),
      if (username.isNotEmpty) 'username': username,
    }, 'Profil berhasil diperbarui.');
  }

  @override
  Widget build(BuildContext context) => _Sheet(
    title: 'Edit Profile',
    busy: busy,
    error: error,
    onSave: _submit,
    children: [
      TextField(
        controller: _name,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(labelText: 'Nama lengkap', errorText: fields['full_name']),
      ),
      TextField(
        controller: _username,
        autocorrect: false,
        decoration: InputDecoration(
          labelText: 'Username',
          helperText: 'Huruf kecil, angka, titik, garis bawah, atau tanda hubung.',
          helperMaxLines: 2,
          errorText: fields['username'],
        ),
      ),
    ],
  );
}

class _PasswordForm extends StatefulWidget {
  const _PasswordForm();
  @override
  State<_PasswordForm> createState() => _PasswordFormState();
}

class _PasswordFormState extends State<_PasswordForm> with _SaveMixin {
  final _current = TextEditingController();
  final _next = TextEditingController();

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  void _submit() {
    final problems = {
      if (_current.text.isEmpty) 'current_password': 'Password saat ini wajib diisi.',
      if (_next.text.length < 8) 'new_password': 'Password baru minimal 8 karakter.',
    };
    if (problems.isNotEmpty) {
      setState(() => fields = problems);
      return;
    }
    save({
      'current_password': _current.text,
      'new_password': _next.text,
    }, 'Password berhasil diganti.');
  }

  @override
  Widget build(BuildContext context) => _Sheet(
    title: 'Change Password',
    busy: busy,
    error: error,
    onSave: _submit,
    children: [
      TextField(
        controller: _current,
        obscureText: true,
        autofillHints: const [AutofillHints.password],
        decoration: InputDecoration(
          labelText: 'Password saat ini',
          errorText: fields['current_password'],
        ),
      ),
      TextField(
        controller: _next,
        obscureText: true,
        autofillHints: const [AutofillHints.newPassword],
        decoration: InputDecoration(labelText: 'Password baru', errorText: fields['new_password']),
      ),
    ],
  );
}
