import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function generatePDF(
  policyContent: string,
  companyName: string,
  mappings: Array<{
    section_id: string;
    framework: string;
    article_ref: string;
  }>,
  versionHistory: Array<{ version: number; date: string; changes: string }>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  let yPosition = height - 50;
  const margin = 50;
  const lineHeight = 14;
  const fontSize = 11;

  // Header
  page.drawText(companyName, {
    x: margin,
    y: yPosition,
    size: 18,
    font: timesRomanBoldFont,
  });
  yPosition -= 30;

  // Policy content
  const lines = policyContent.split("\n");
  for (const line of lines) {
    if (yPosition < margin + 50) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    if (line.startsWith("# ")) {
      // H1
      page.drawText(line.replace(/^#\s+/, ""), {
        x: margin,
        y: yPosition,
        size: 16,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 1.5;
    } else if (line.startsWith("## ")) {
      // H2
      page.drawText(line.replace(/^##\s+/, ""), {
        x: margin,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 1.3;
    } else if (line.startsWith("### ")) {
      // H3
      page.drawText(line.replace(/^###\s+/, ""), {
        x: margin,
        y: yPosition,
        size: 12,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 1.2;
    } else if (line.trim()) {
      // Regular text
      const text = line.trim();
      if (text.length > 0) {
        // Wrap text if needed
        const words = text.split(" ");
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine + (currentLine ? " " : "") + word;
          const textWidth = timesRomanFont.widthOfTextAtSize(testLine, fontSize);
          if (textWidth > width - margin * 2 && currentLine) {
            page.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: timesRomanFont,
            });
            yPosition -= lineHeight;
            currentLine = word;
            if (yPosition < margin + 50) {
              page = pdfDoc.addPage([595, 842]);
              yPosition = height - 50;
            }
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          page.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: timesRomanFont,
          });
          yPosition -= lineHeight;
        }
      }
    } else {
      yPosition -= lineHeight * 0.5; // Empty line
    }
  }

  // Add mapping table
  if (mappings.length > 0) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = height - 50;

    page.drawText("Framework Mappings", {
      x: margin,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
    });
    yPosition -= 30;

    for (const mapping of mappings.slice(0, 20)) {
      if (yPosition < margin + 50) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
      }
      const mappingText = `${mapping.framework} ${mapping.article_ref} - ${mapping.section_id}`;
      page.drawText(mappingText, {
        x: margin,
        y: yPosition,
        size: fontSize - 1,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }
  }

  // Add version history
  if (versionHistory.length > 0) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = height - 50;

    page.drawText("Version History", {
      x: margin,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
    });
    yPosition -= 30;

    for (const version of versionHistory) {
      if (yPosition < margin + 50) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
      }
      const versionText = `Version ${version.version} - ${version.date}: ${version.changes}`;
      page.drawText(versionText, {
        x: margin,
        y: yPosition,
        size: fontSize - 1,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }
  }

  return await pdfDoc.save();
}

export async function generateDOCX(
  policyContent: string,
  companyName: string,
  mappings: Array<{
    section_id: string;
    framework: string;
    article_ref: string;
  }>,
  versionHistory: Array<{ version: number; date: string; changes: string }>
): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      text: companyName,
      heading: HeadingLevel.HEADING_1,
    })
  );

  // Policy content
  const lines = policyContent.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^#\s+/, ""),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^##\s+/, ""),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^###\s+/, ""),
          heading: HeadingLevel.HEADING_3,
        })
      );
    } else if (line.trim()) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.trim(),
            }),
          ],
        })
      );
    } else {
      paragraphs.push(new Paragraph({ text: "" }));
    }
  }

  // Mapping table
  if (mappings.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "Framework Mappings",
        heading: HeadingLevel.HEADING_1,
      })
    );

    for (const mapping of mappings) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${mapping.framework} ${mapping.article_ref} - ${mapping.section_id}`,
            }),
          ],
        })
      );
    }
  }

  // Version history
  if (versionHistory.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "Version History",
        heading: HeadingLevel.HEADING_1,
      })
    );

    for (const version of versionHistory) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Version ${version.version} - ${version.date}: ${version.changes}`,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

