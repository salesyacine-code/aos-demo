import QRCode from 'qrcode';

/**
 * Generate QR code as PNG Buffer for PDF embedding
 */
export async function generateQrCodeBuffer(data) {
  try {
    // Generate QR code data buffer
    const payloadString = typeof data === 'string' ? data : JSON.stringify(data);
    const buffer = await QRCode.toBuffer(payloadString, {
      type: 'png',
      width: 250,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });
    return buffer;
  } catch (err) {
    console.error('[QRGenerator] Error generating QR code buffer:', err.message);
    throw err;
  }
}

/**
 * Generate QR code as DataURL (base64) for HTML web view
 */
export async function generateQrCodeDataUrl(data) {
  try {
    const payloadString = typeof data === 'string' ? data : JSON.stringify(data);
    return await QRCode.toDataURL(payloadString, {
      margin: 1,
      width: 250
    });
  } catch (err) {
    console.error('[QRGenerator] Error generating DataURL:', err.message);
    throw err;
  }
}

