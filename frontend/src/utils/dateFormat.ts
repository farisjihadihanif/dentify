/**
 * Helper pemformatan tanggal UTC ISO 8601 ke zona waktu lokal `Asia/Jakarta` (WIB)
 * sesuai `AGENTS.md › Database & Waktu` dan `DATABASE.md §1`.
 */

export function formatJakartaDateTime(isoString: string | Date | undefined | null): string {
  if (!isoString) return '-';
  const date = isoString instanceof Date ? isoString : new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);

  try {
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    return `${formatted} WIB`;
  } catch {
    return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
}
