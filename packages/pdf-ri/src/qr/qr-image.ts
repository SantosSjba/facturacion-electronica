import QRCode from "qrcode";

/** SEE del contribuyente, Anexo 6 §6.4: Q, UTF-8, module >= .190mm,
 * quiet zone >= 1mm, black on white and total size <= 60mm. */
export async function buildQrImage(payload: string) {
  const symbol = QRCode.create(payload, { errorCorrectionLevel: "Q" });
  const modules = symbol.modules.size;
  const sizeMm = Math.max(35, (modules + 8) * 0.25);
  if (sizeMm > 60) throw new Error("QR exceeds printable SUNAT dimensions");
  const margin = Math.max(4, Math.ceil((modules + 8) / (sizeMm - 2)));
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "Q",
    margin,
    scale: 8,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  return {
    payload,
    data_url: dataUrl,
    size_mm: sizeMm,
    modules,
    module_mm: sizeMm / (modules + margin * 2),
    quiet_zone_mm: (sizeMm * margin) / (modules + margin * 2),
    error_correction: "Q" as const,
  };
}
