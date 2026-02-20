import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  // Add a class for print-optimized styling
  element.classList.add("pdf-export-mode");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#0f1117",
    windowWidth: 800, // Fixed width for consistent output
  });

  element.classList.remove("pdf-export-mode");

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Professional header
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const headerHeight = 18;

  // Title bar on first page
  pdf.setFillColor(15, 17, 23); // dark bg
  pdf.rect(0, 0, pageWidth, headerHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  
  const title = filename.includes("monthly")
    ? "Monthly Intelligence Summary"
    : "Weekly Intelligence Report";
  pdf.text(title, margin, 11);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(160, 160, 170);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(`Generated: ${dateStr}`, pageWidth - margin - 50, 11);

  // Content
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;
  const contentStart = headerHeight + 4;
  const usableHeight = pageHeight - margin - contentStart;

  let yOffset = 0;
  let remainingHeight = imgHeight;
  let pageNum = 1;

  while (remainingHeight > 0) {
    if (yOffset > 0) {
      pdf.addPage();
      pageNum++;
    }

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      contentStart - yOffset,
      contentWidth,
      imgHeight
    );

    // Footer on every page
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 130);
    pdf.text(
      `FreightPulse Intelligence — Page ${pageNum}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );

    yOffset += usableHeight;
    remainingHeight -= usableHeight;
  }

  pdf.save(`${filename}.pdf`);
}
