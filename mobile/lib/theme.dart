import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

import 'models.dart';

/// Token warna dari web (frontend/src/app/globals.css) + versi gelap.
class Tokens extends ThemeExtension<Tokens> {
  const Tokens({
    required this.muted,
    required this.border,
    required this.soft,
    required this.deniSoft,
    required this.green,
    required this.yellow,
    required this.red,
    required this.sand,
  });

  final Color muted, border, soft, deniSoft, green, yellow, red, sand;

  static const light = Tokens(
    muted: Color(0xFF475569),
    border: Color(0xFFE2E8F0),
    soft: Color(0xFFF0F9FF),
    deniSoft: Color(0xFFE6F7F7),
    green: Color(0xFF15803D),
    yellow: Color(0xFFB45309),
    red: Color(0xFFB91C1C),
    sand: Color(0xFFFEF3C7),
  );
  static const dark = Tokens(
    muted: Color(0xFFA9B8CB),
    border: Color(0xFF263A55),
    soft: Color(0xFF122C45),
    deniSoft: Color(0xFF10312F),
    green: Color(0xFF6CD391),
    yellow: Color(0xFFF2B35E),
    red: Color(0xFFF58A8A),
    sand: Color(0xFF3A2D12),
  );

  Color urgency(Urgency u) => switch (u) {
    Urgency.low => green,
    Urgency.medium => yellow,
    Urgency.emergency => red,
  };

  @override
  Tokens copyWith() => this;
  @override
  Tokens lerp(Tokens? other, double t) => t < 0.5 ? this : other ?? this;
}

extension ThemeX on BuildContext {
  Tokens get tokens => Theme.of(this).extension<Tokens>()!;
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get text => Theme.of(this).textTheme;
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final t = dark ? Tokens.dark : Tokens.light;
  final brand = dark ? const Color(0xFF4FB9D3) : const Color(0xFF0E7490);
  final onBrand = dark ? const Color(0xFF04212B) : Colors.white;
  final ink = dark ? const Color(0xFFEAF1F8) : const Color(0xFF0B192C);
  final surface = dark ? const Color(0xFF13243B) : Colors.white;
  final bg = dark ? const Color(0xFF0B192C) : const Color(0xFFF8FAFC);

  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF0E7490), brightness: b).copyWith(
    primary: brand,
    onPrimary: onBrand,
    surface: surface,
    onSurface: ink,
    onSurfaceVariant: t.muted,
    error: t.red,
    onError: dark ? const Color(0xFF3B0A0A) : Colors.white,
    outline: t.muted,
    outlineVariant: t.border,
    surfaceTint: Colors.transparent,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final body = GoogleFonts.plusJakartaSansTextTheme(
    base.typography.englishLike.merge(base.textTheme),
  ).apply(bodyColor: ink, displayColor: ink);
  TextStyle display(double size, FontWeight w) =>
      GoogleFonts.bricolageGrotesque(fontSize: size, fontWeight: w, height: 1.25, color: ink);
  final text = body.copyWith(
    headlineMedium: display(28, FontWeight.w700),
    headlineSmall: display(24, FontWeight.w700),
    titleLarge: display(20, FontWeight.w700),
    titleMedium: display(17, FontWeight.w600),
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  OutlineInputBorder line(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: c, width: w),
  );
  final label = GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600);

  return base.copyWith(
    textTheme: text,
    extensions: [t],
    scaffoldBackgroundColor: bg,
    dividerColor: t.border,
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: text.titleLarge,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: t.soft,
      height: 68,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 50),
        shape: shape,
        textStyle: label,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 50),
        shape: shape,
        textStyle: label,
        side: BorderSide(color: t.border),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(textStyle: label)),
    inputDecorationTheme: InputDecorationThemeData(
      filled: true,
      fillColor: surface,
      border: line(t.border),
      enabledBorder: line(t.border),
      focusedBorder: line(brand, 2),
      errorMaxLines: 3,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
