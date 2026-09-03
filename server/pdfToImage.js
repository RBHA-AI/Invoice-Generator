const fs = require('fs');

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function renderPdfFirstPage(filePath) {
  const { pdf } = await import('pdf-to-img');
  const scale = Math.min(3, Math.max(1.5, Number(process.env.IMPORTED_PDF_RENDER_SCALE || 2)));
  const document = await pdf(filePath, { scale });

  for await (const pageBuffer of document) {
    return pageBuffer;
  }

  throw new Error('PDF has no pages');
}

/**
 * Prepare base64 image input for OpenAI vision (images only — not PDF).
 */
async function prepareVisionInput(filePath, mimeType) {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    const buffer = fs.readFileSync(filePath);
    return {
      imageBase64: buffer.toString('base64'),
      mimeType
    };
  }

  if (mimeType === 'application/pdf') {
    const pageBuffer = await renderPdfFirstPage(filePath);
    return {
      imageBase64: pageBuffer.toString('base64'),
      mimeType: 'image/png'
    };
  }

  throw new Error(`Unsupported file type for extraction: ${mimeType}`);
}

module.exports = {
  prepareVisionInput,
  renderPdfFirstPage
};
