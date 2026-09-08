/**
 * Client-side document parser for PDF, DOCX, and TXT files.
 * Uses window.pdfjsLib (PDF.js) and window.mammoth (Mammoth.js) loaded via CDN.
 */

export async function parseDocument(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  switch (extension) {
    case "pdf":
      return await parsePdf(file);
    case "docx":
      return await parseDocx(file);
    case "txt":
    case "md":
      return await parsePlainText(file);
    default:
      throw new Error(
        `Unsupported file type .${extension}. Please upload a PDF (.pdf), Word (.docx), or Text (.txt) file.`
      );
  }
}

async function parsePlainText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.trim());
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function parseDocx(file) {
  if (!window.mammoth) {
    throw new Error(
      "Mammoth.js library is not loaded. Please ensure you have internet access."
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        const cleanText = result.value
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        resolve(cleanText);
      } catch (err) {
        reject(new Error(`DOCX parsing failed: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read DOCX file buffer."));
    reader.readAsArrayBuffer(file);
  });
}

async function parsePdf(file) {
  if (!window.pdfjsLib) {
    throw new Error(
      "PDF.js library is not loaded. Please ensure you have internet access."
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const typedArray = new Uint8Array(event.target.result);
        const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageItems = textContent.items.map((item) => item.str);
          fullText += pageItems.join(" ") + "\n\n";
        }

        const cleanText = fullText
          .replace(/\s{2,}/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        if (!cleanText || cleanText.length < 20) {
          throw new Error(
            "Extracted text appears empty or image-only. If this PDF is scanned, please copy/paste text directly."
          );
        }

        resolve(cleanText);
      } catch (err) {
        reject(new Error(`PDF parsing failed: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read PDF file."));
    reader.readAsArrayBuffer(file);
  });
}
