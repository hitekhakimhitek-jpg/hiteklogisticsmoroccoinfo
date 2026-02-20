import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#0f1117",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let yOffset = 0;
  let remainingHeight = imgHeight;

  while (remainingHeight > 0) {
    if (yOffset > 0) pdf.addPage();

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin - yOffset,
      contentWidth,
      imgHeight
    );

    yOffset += pageHeight - margin * 2;
    remainingHeight -= pageHeight - margin * 2;
  }

  pdf.save(`${filename}.pdf`);
}
