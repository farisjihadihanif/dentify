import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false, _busy = false, _hide = true;
  ApiException? _error;
  Map<String, String> _fields = const {};

  @override
  void initState() {
    super.initState();
    AppScope.read(context).warmUp();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Map<String, String> _validate() => {
    if (_register && _name.text.trim().length < 2) 'full_name': 'Nama lengkap minimal 2 karakter.',
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(_email.text.trim()))
      'email': 'Format email tidak valid.',
    if (_register && _password.text.length < 8) 'password': 'Password minimal 8 karakter.',
    if (!_register && _password.text.isEmpty) 'password': 'Password wajib diisi.',
  };

  Future<void> _submit() async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    final problems = _validate();
    setState(() {
      _error = null;
      _fields = problems;
    });
    if (problems.isNotEmpty) return;
    setState(() => _busy = true);
    final state = AppScope.read(context);
    try {
      if (_register) {
        await state.register(_name.text.trim(), _email.text.trim(), _password.text);
      } else {
        await state.login(_email.text.trim(), _password.text);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _fields = e.fields;
          _error = e.fields.isEmpty ? e : null;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notice = AppScope.of(context).notice;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset(
                      'assets/brand/dentify-logo.png',
                      height: 88,
                      semanticLabel: 'Logo Dentify',
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _register ? 'Create Account' : 'Welcome Back',
                      style: context.text.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _register
                          ? 'Daftar untuk memindai gigi dan menyimpan riwayat Anda.'
                          : 'Masuk untuk memindai gigi dan melihat riwayat Anda.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: context.tokens.muted),
                    ),
                    const SizedBox(height: 24),
                    if (notice != null && _error == null) ...[
                      Panel(color: context.tokens.soft, child: Text(notice)),
                      const SizedBox(height: 14),
                    ],
                    if (_error != null) ...[ErrorPanel(_error!), const SizedBox(height: 14)],
                    if (_register) ...[
                      TextField(
                        controller: _name,
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        autofillHints: const [AutofillHints.name],
                        decoration: InputDecoration(
                          labelText: 'Nama lengkap',
                          errorText: _fields['full_name'],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      autofillHints: const [AutofillHints.email],
                      decoration: InputDecoration(labelText: 'Email', errorText: _fields['email']),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _password,
                      obscureText: _hide,
                      autofillHints: [
                        _register ? AutofillHints.newPassword : AutofillHints.password,
                      ],
                      onSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        errorText: _fields['password'],
                        suffixIcon: IconButton(
                          tooltip: _hide ? 'Tampilkan password' : 'Sembunyikan password',
                          icon: Icon(_hide ? Icons.visibility : Icons.visibility_off),
                          onPressed: () => setState(() => _hide = !_hide),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: BusyLabel(_register ? 'Daftar' : 'Masuk', busy: _busy),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                              _register = !_register;
                              _error = null;
                              _fields = const {};
                            }),
                      child: Text(
                        _register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
