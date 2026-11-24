import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import 'models.dart';

/// Buang karakter yang tidak ada di font laporan (mis. emoji pada keluhan).
String _plain(String s) =>
    String.fromCharCodes(s.runes.where((r) => r < 0x250 || (r >= 0x2010 && r <= 0x2026)));

/// Laporan hasil skrining dalam PDF (A4). [photo] hanya ada untuk scan yang baru dilakukan.
Future<Uint8List> buildScanReport(Scan scan, {Uint8List? photo}) async {
  Future<pw.Font> font(String n) async =>
      pw.Font.ttf(await rootBundle.load('assets/google_fonts/$n.ttf'));
  final logo = pw.MemoryImage(
    (await rootBundle.load('assets/brand/dentify-logo.png')).buffer.asUint8List(),
  );
  final brand = PdfColor.fromHex('#0E7490');
  final muted = PdfColor.fromHex('#475569');
  final border = PdfColor.fromHex('#E2E8F0');
  final green = PdfColor.fromHex('#15803D');
  final red = PdfColor.fromHex('#B91C1C');
  final urgencyColor = scan.unsure
      ? muted
      : switch (scan.urgency) {
          Urgency.low => green,
          Urgency.medium => PdfColor.fromHex('#B45309'),
          Urgency.emergency => red,
        };

  final doc = pw.Document(
    title: 'Dentify Screening Report',
    theme: pw.ThemeData.withFont(
      base: await font('PlusJakartaSans-Regular'),
      bold: await font('PlusJakartaSans-Bold'),
    ),
  );

  pw.Widget heading(String t, [PdfColor? c]) => pw.Padding(
    padding: const pw.EdgeInsets.only(top: 16, bottom: 6),
    child: pw.Text(
      t,
      style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: c ?? brand),
    ),
  );
  pw.Widget row(String k, String v) => pw.Padding(
    padding: const pw.EdgeInsets.only(bottom: 4),
    child: pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.SizedBox(
          width: 120,
          child: pw.Text(k, style: pw.TextStyle(color: muted)),
        ),
        pw.Expanded(child: pw.Text(_plain(v))),
      ],
    ),
  );
  pw.Widget bullet(String t, PdfColor c) => pw.Padding(
    padding: const pw.EdgeInsets.only(bottom: 4),
    child: pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          width: 5,
          height: 5,
          margin: const pw.EdgeInsets.only(top: 4, right: 8),
          decoration: pw.BoxDecoration(color: c, shape: pw.BoxShape.circle),
        ),
        pw.Expanded(child: pw.Text(_plain(t))),
      ],
    ),
  );

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      footer: (c) => pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.Text(
          'Halaman ${c.pageNumber} dari ${c.pagesCount}',
          style: pw.TextStyle(fontSize: 9, color: muted),
        ),
      ),
      build: (_) => [
        pw.Row(
          children: [
            pw.Image(logo, width: 40, height: 40),
            pw.SizedBox(width: 10),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'Dentify Screening Report',
                  style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: brand),
                ),
                pw.Text(
                  'Skrining awal berbasis AI, bukan diagnosis medis',
                  style: pw.TextStyle(color: muted, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
        pw.Divider(color: border, height: 24),
        pw.Text(
          _plain(scan.label),
          style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold),
        ),
        pw.SizedBox(height: 10),
        row('Waktu', formatWib(scan.createdAt)),
        if (scan.id != null) row('ID pemindaian', scan.id!),
        row('Sumber foto', scan.sourceLabel),
        if (!scan.unsure) row('Keyakinan AI', '${scan.percent}%'),
        pw.Row(
          children: [
            pw.SizedBox(
              width: 120,
              child: pw.Text('Tingkat urgensi', style: pw.TextStyle(color: muted)),
            ),
            pw.Expanded(
              child: pw.Text(
                scan.unsure ? 'Belum meyakinkan' : scan.urgency.label,
                style: pw.TextStyle(color: urgencyColor, fontWeight: pw.FontWeight.bold),
              ),
            ),
          ],
        ),
        if (scan.symptoms.isNotEmpty) ...[pw.SizedBox(height: 4), row('Keluhan', scan.symptoms)],
        if (photo != null) ...[
          pw.SizedBox(height: 12),
          pw.Center(child: pw.Image(pw.MemoryImage(photo), height: 190, fit: pw.BoxFit.contain)),
        ],
        heading('Summary'),
        pw.Text(_plain(scan.summary)),
        heading("Do's: Yang Dianjurkan", green),
        for (final d in scan.dos) bullet(d, green),
        heading("Don'ts: Yang Harus Dihindari", red),
        for (final d in scan.donts) bullet(d, red),
        pw.SizedBox(height: 16),
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(
            color: PdfColor.fromHex('#FEF3C7'),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Text(_plain(scan.disclaimer), style: const pw.TextStyle(fontSize: 10)),
        ),
      ],
    ),
  );
  return doc.save();
}

/// Buat PDF lalu buka lembar bagikan (simpan ke Drive/berkas, WhatsApp, dst).
Future<void> shareScanReport(Scan scan, {Uint8List? photo}) async {
  final bytes = await buildScanReport(scan, photo: photo);
  final id = scan.id ?? 'scan';
  final short = id.length > 6 ? id.substring(id.length - 6) : id;
  final dir = Directory('${(await getTemporaryDirectory()).path}/reports');
  // Hanya laporan terakhir yang disimpan sementara.
  if (await dir.exists()) await dir.delete(recursive: true);
  await dir.create(recursive: true);
  final file = File('${dir.path}/Dentify-Laporan-$short.pdf');
  await file.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path, mimeType: 'application/pdf')],
      subject: 'Laporan Skrining Dentify',
    ),
  );
}
