import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generateInvoicePdf(element, invoiceNumber) {
  if (!element) {
    throw new Error('Invoice preview element is not available');
  }

  const fullWidth = element.scrollWidth || element.offsetWidth;
  const fullHeight = element.scrollHeight || element.offsetHeight;

  const captureScale = Math.min(
    2.25,
    Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2)
  );

  const canvas = await html2canvas(element, {
    scale: captureScale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: fullWidth,
    height: fullHeight,
    allowTaint: true
  });

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usablePageHeight = pdfHeight - margin * 2;
  const imgWidth = pdfWidth - margin * 2;
  const mmPerPx = imgWidth / canvas.width;
  const pageSlicePx = Math.floor(usablePageHeight / mmPerPx);
  let yOffsetPx = 0;
  let pageIndex = 0;

  while (yOffsetPx < canvas.height) {
    const sliceHeightPx = Math.min(pageSlicePx, canvas.height - yOffsetPx);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const pageCtx = pageCanvas.getContext('2d');
    pageCtx.imageSmoothingEnabled = false;
    pageCtx.drawImage(
      canvas,
      0,
      yOffsetPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    const sliceHeightMm = sliceHeightPx * mmPerPx;
    const pageImg = pageCanvas.toDataURL('image/jpeg', 0.88);

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(pageImg, 'JPEG', margin, margin, imgWidth, sliceHeightMm, undefined, 'MEDIUM');
    pdf.setLineWidth(0.4);
    pdf.rect(margin, margin, imgWidth, sliceHeightMm);

    yOffsetPx += sliceHeightPx;
    pageIndex += 1;
  }

  const safeInvoiceNumber = String(invoiceNumber).replace(/[^\w-]+/g, '-');
  const filename = `invoice-${safeInvoiceNumber}.pdf`;

  return { pdf, filename };
}

export async function generateInvoicePdfBlob(element, invoiceNumber) {
  const { pdf, filename } = await generateInvoicePdf(element, invoiceNumber);
  const blob = pdf.output('blob');
  return { blob, filename };
}

export async function downloadInvoicePdf(element, invoiceNumber) {
  const { pdf, filename } = await generateInvoicePdf(element, invoiceNumber);
  pdf.save(filename);
}
