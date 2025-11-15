import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Type definitions
type VersionHistoryEntry = {
  version: number;
  date: string;
  changes: string;
  coverage: {
    gdpr?: number;
    ai_act?: number;
    iso_42001?: number;
  };
  coverageDelta?: {
    gdpr?: number;
    ai_act?: number;
    iso_42001?: number;
  };
};

type MappingEntry = {
  section_id: string;
  framework: string;
  article_ref: string;
  confidence?: number;
};

export async function generatePDF(
  policyContent: string,
  companyName: string,
  mappings: MappingEntry[],
  versionHistory: VersionHistoryEntry[],
  policyType?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize = [595, 842]; // A4 size
  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  let yPosition = height - 50;
  const margin = 50;
  const lineHeight = 14;
  const fontSize = 11;
  const headerFontSize = 16;
  const titleFontSize = 24;

  // Helper function to add new page
  const addNewPage = () => {
    page = pdfDoc.addPage(pageSize);
    yPosition = height - 50;
    return page;
  };

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition < margin + requiredSpace) {
      addNewPage();
    }
  };

  // Title Page
  yPosition = height - 150;
  page.drawText(companyName, {
    x: margin,
    y: yPosition,
    size: titleFontSize,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  const policyTypeText = policyType
    ? policyType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Policy Document";
  page.drawText(policyTypeText, {
    x: margin,
    y: yPosition,
    size: headerFontSize,
    font: timesRomanBoldFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 30;

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  page.drawText(`Generated: ${currentDate}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: timesRomanFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Add page break
  addNewPage();

  // Policy content
  const lines = policyContent.split("\n");
  for (const line of lines) {
    checkPageBreak(50);

    if (line.startsWith("# ")) {
      // H1
      page.drawText(line.replace(/^#\s+/, ""), {
        x: margin,
        y: yPosition,
        size: headerFontSize,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 2;
    } else if (line.startsWith("## ")) {
      // H2
      page.drawText(line.replace(/^##\s+/, ""), {
        x: margin,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 1.5;
    } else if (line.startsWith("### ")) {
      // H3
      page.drawText(line.replace(/^###\s+/, ""), {
        x: margin,
        y: yPosition,
        size: 12,
        font: timesRomanBoldFont,
      });
      yPosition -= lineHeight * 1.3;
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
            checkPageBreak(50);
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
    addNewPage();
    yPosition = height - 50;

    page.drawText("Framework Mappings", {
      x: margin,
      y: yPosition,
      size: headerFontSize,
      font: timesRomanBoldFont,
    });
    yPosition -= 40;

    // Draw mapping table
    const tableTop = yPosition;
    const rowHeight = 20;
    const colWidths = [120, 150, width - margin * 2 - 270]; // Framework, Article Ref, Section ID
    const headerHeight = 25;

    // Draw table header
    const headerBgColor = rgb(0.9, 0.9, 0.9);
    page.drawRectangle({
      x: margin,
      y: yPosition - headerHeight,
      width: width - margin * 2,
      height: headerHeight,
      color: headerBgColor,
    });

    // Header text
    page.drawText("Framework", {
      x: margin + 5,
      y: yPosition - 18,
      size: fontSize - 1,
      font: helveticaBoldFont,
    });
    page.drawText("Article Reference", {
      x: margin + colWidths[0] + 5,
      y: yPosition - 18,
      size: fontSize - 1,
      font: helveticaBoldFont,
    });
    page.drawText("Section ID", {
      x: margin + colWidths[0] + colWidths[1] + 5,
      y: yPosition - 18,
      size: fontSize - 1,
      font: helveticaBoldFont,
    });

    // Draw header border
    page.drawRectangle({
      x: margin,
      y: yPosition - headerHeight,
      width: width - margin * 2,
      height: headerHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    yPosition -= headerHeight;

    // Draw table rows
    for (let i = 0; i < mappings.length; i++) {
      checkPageBreak(rowHeight + 10);

      const mapping = mappings[i];
      const rowY = yPosition - rowHeight;

      // Alternating row colors
      if (i % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: rowY,
          width: width - margin * 2,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      // Draw cell borders
      page.drawRectangle({
        x: margin,
        y: rowY,
        width: width - margin * 2,
        height: rowHeight,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5,
      });

      // Draw cell content
      page.drawText(mapping.framework, {
        x: margin + 5,
        y: rowY + 5,
        size: fontSize - 1,
        font: helveticaFont,
      });
      page.drawText(mapping.article_ref, {
        x: margin + colWidths[0] + 5,
        y: rowY + 5,
        size: fontSize - 1,
        font: helveticaFont,
      });

      // Wrap section_id if needed
      const sectionId = mapping.section_id;
      const sectionIdWidth = helveticaFont.widthOfTextAtSize(sectionId, fontSize - 1);
      if (sectionIdWidth > colWidths[2] - 10) {
        // Truncate with ellipsis
        let truncated = sectionId;
        while (
          helveticaFont.widthOfTextAtSize(truncated + "...", fontSize - 1) >
          colWidths[2] - 10
        ) {
          truncated = truncated.slice(0, -1);
        }
        page.drawText(truncated + "...", {
          x: margin + colWidths[0] + colWidths[1] + 5,
          y: rowY + 5,
          size: fontSize - 1,
          font: helveticaFont,
        });
      } else {
        page.drawText(sectionId, {
          x: margin + colWidths[0] + colWidths[1] + 5,
          y: rowY + 5,
          size: fontSize - 1,
          font: helveticaFont,
        });
      }

      yPosition -= rowHeight;
    }
  }

  // Add version history table
  if (versionHistory.length > 0) {
    addNewPage();
    yPosition = height - 50;

    page.drawText("Version History", {
      x: margin,
      y: yPosition,
      size: headerFontSize,
      font: timesRomanBoldFont,
    });
    yPosition -= 40;

    // Draw version history table
    const rowHeight = 25;
    const headerHeight = 30;
    const colWidths = [
      60, // Version
      80, // Date
      90, // GDPR
      90, // AI Act
      90, // ISO 42001
      70, // GDPR Δ
      70, // AI Act Δ
      70, // ISO 42001 Δ
    ];
    const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableStartX = margin + (width - margin * 2 - totalTableWidth) / 2;

    // Draw table header
    const headerBgColor = rgb(0.9, 0.9, 0.9);
    page.drawRectangle({
      x: tableStartX,
      y: yPosition - headerHeight,
      width: totalTableWidth,
      height: headerHeight,
      color: headerBgColor,
    });

    // Header text
    let currentX = tableStartX;
    const headers = [
      "Version",
      "Date",
      "GDPR %",
      "AI Act %",
      "ISO 42001 %",
      "GDPR Δ",
      "AI Act Δ",
      "ISO Δ",
    ];
    headers.forEach((header, idx) => {
      page.drawText(header, {
        x: currentX + 3,
        y: yPosition - 20,
        size: fontSize - 2,
        font: helveticaBoldFont,
      });
      currentX += colWidths[idx];
    });

    // Draw header border
    page.drawRectangle({
      x: tableStartX,
      y: yPosition - headerHeight,
      width: totalTableWidth,
      height: headerHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    yPosition -= headerHeight;

    // Draw table rows
    for (let i = 0; i < versionHistory.length; i++) {
      checkPageBreak(rowHeight + 10);

      const version = versionHistory[i];
      const rowY = yPosition - rowHeight;

      // Alternating row colors
      if (i % 2 === 0) {
        page.drawRectangle({
          x: tableStartX,
          y: rowY,
          width: totalTableWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      // Draw cell borders
      page.drawRectangle({
        x: tableStartX,
        y: rowY,
        width: totalTableWidth,
        height: rowHeight,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5,
      });

      // Draw cell content
      currentX = tableStartX;
      const formatPercent = (val?: number) =>
        val !== undefined ? `${val.toFixed(1)}%` : "N/A";
      const formatDelta = (val?: number) => {
        if (val === undefined) return "—";
        const sign = val >= 0 ? "+" : "";
        return `${sign}${val.toFixed(1)}%`;
      };

      const rowData = [
        `v${version.version}`,
        version.date,
        formatPercent(version.coverage.gdpr),
        formatPercent(version.coverage.ai_act),
        formatPercent(version.coverage.iso_42001),
        formatDelta(version.coverageDelta?.gdpr),
        formatDelta(version.coverageDelta?.ai_act),
        formatDelta(version.coverageDelta?.iso_42001),
      ];

      rowData.forEach((text, idx) => {
        // Color code deltas
        let textColor = rgb(0, 0, 0);
        if (idx >= 5 && version.coverageDelta) {
          const deltaValue =
            idx === 5
              ? version.coverageDelta.gdpr
              : idx === 6
                ? version.coverageDelta.ai_act
                : version.coverageDelta.iso_42001;
          if (deltaValue !== undefined) {
            textColor =
              deltaValue > 0
                ? rgb(0, 0.6, 0)
                : deltaValue < 0
                  ? rgb(0.8, 0, 0)
                  : rgb(0, 0, 0);
          }
        }

        page.drawText(text, {
          x: currentX + 3,
          y: rowY + 7,
          size: fontSize - 2,
          font: idx === 0 ? helveticaBoldFont : helveticaFont,
          color: textColor,
        });
        currentX += colWidths[idx];
      });

      yPosition -= rowHeight;
    }
  }

  // Add page numbers to all pages
  const pages = pdfDoc.getPages();
  pages.forEach((p, index) => {
    const pageNum = index + 1;
    const pageNumText = `Page ${pageNum}`;
    const textWidth = helveticaFont.widthOfTextAtSize(pageNumText, fontSize - 2);
    p.drawText(pageNumText, {
      x: width - margin - textWidth,
      y: 30,
      size: fontSize - 2,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return await pdfDoc.save();
}

export async function generateDOCX(
  policyContent: string,
  companyName: string,
  mappings: MappingEntry[],
  versionHistory: VersionHistoryEntry[],
  policyType?: string
): Promise<Buffer> {
  const paragraphs: (Paragraph | Table)[] = [];

  // Title Page
  paragraphs.push(
    new Paragraph({
      text: companyName,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  const policyTypeText = policyType
    ? policyType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Policy Document";
  paragraphs.push(
    new Paragraph({
      text: policyTypeText,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 400 },
    })
  );

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${currentDate}`,
          color: "666666",
        }),
      ],
      spacing: { after: 600 },
    })
  );

  // Page break
  paragraphs.push(
    new Paragraph({
      text: "",
      pageBreakBefore: true,
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
          spacing: { after: 240, before: 120 },
        })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^##\s+/, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 180, before: 120 },
        })
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^###\s+/, ""),
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 120, before: 60 },
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
          spacing: { after: 120 },
        })
      );
    } else {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
  }

  // Mapping table
  if (mappings.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "",
        pageBreakBefore: true,
      })
    );

    paragraphs.push(
      new Paragraph({
        text: "Framework Mappings",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 240, before: 120 },
      })
    );

    // Create mapping table
    const mappingTableRows: TableRow[] = [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Framework",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Article Reference",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Section ID",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
        ],
      }),
    ];

    // Data rows
    mappings.forEach((mapping, index) => {
      mappingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: mapping.framework,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: mapping.article_ref,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: mapping.section_id,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
          ],
        })
      );
    });

    paragraphs.push(
      new Table({
        rows: mappingTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100,
        },
      })
    );
  }

  // Version history table
  if (versionHistory.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "",
        pageBreakBefore: true,
      })
    );

    paragraphs.push(
      new Paragraph({
        text: "Version History",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 240, before: 120 },
      })
    );

    // Create version history table
    const versionTableRows: TableRow[] = [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Version",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Date",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 12, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "GDPR %",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "AI Act %",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "ISO 42001 %",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 12, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "GDPR Δ",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "AI Act Δ",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "ISO Δ",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
          }),
        ],
      }),
    ];

    // Data rows
    versionHistory.forEach((version, index) => {
      const formatPercent = (val?: number) =>
        val !== undefined ? `${val.toFixed(1)}%` : "N/A";
      const formatDelta = (val?: number) => {
        if (val === undefined) return "—";
        const sign = val >= 0 ? "+" : "";
        return `${sign}${val.toFixed(1)}%`;
      };

      const gdprDelta = version.coverageDelta?.gdpr;
      const aiActDelta = version.coverageDelta?.ai_act;
      const isoDelta = version.coverageDelta?.iso_42001;

      versionTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `v${version.version}`,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: version.date,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatPercent(version.coverage.gdpr),
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatPercent(version.coverage.ai_act),
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatPercent(version.coverage.iso_42001),
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatDelta(gdprDelta),
                      color:
                        gdprDelta !== undefined
                          ? gdprDelta > 0
                            ? "006600"
                            : gdprDelta < 0
                              ? "CC0000"
                              : "000000"
                          : "000000",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatDelta(aiActDelta),
                      color:
                        aiActDelta !== undefined
                          ? aiActDelta > 0
                            ? "006600"
                            : aiActDelta < 0
                              ? "CC0000"
                              : "000000"
                          : "000000",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatDelta(isoDelta),
                      color:
                        isoDelta !== undefined
                          ? isoDelta > 0
                            ? "006600"
                            : isoDelta < 0
                              ? "CC0000"
                              : "000000"
                          : "000000",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: index % 2 === 0 ? { fill: "F8F8F8" } : undefined,
            }),
          ],
        })
      );
    });

    paragraphs.push(
      new Table({
        rows: versionTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100,
        },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
