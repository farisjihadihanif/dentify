import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Font dibundel di `assets/google_fonts/`; unduhan runtime dimatikan.
void setupFonts() {
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    for (final (family, file) in const [
      ('Plus Jakarta Sans', 'OFL-PlusJakartaSans.txt'),
      ('Bricolage Grotesque', 'OFL-BricolageGrotesque.txt'),
    ]) {
      final text = await rootBundle.loadString('assets/google_fonts/$file');
      yield LicenseEntryWithLineBreaks([family], text);
    }
  });
}
