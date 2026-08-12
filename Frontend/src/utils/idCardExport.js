import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ID_CARD_MM, ID_CARD_PX } from "../components/id/EmployeeIdCard";

function waitForImages(root) {
  const images = root.querySelectorAll("img");
  return Promise.all(
    Array.from(images).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );
}

/**
 * Capture the on-screen ID card (including field text) at native 1015×665.
 * Clones off-screen without the preview CSS scale so fonts match Print.
 */
export async function renderIdCardToCanvas(element) {
  if (!element) throw new Error("ID card element not found");

  const host = document.createElement("div");
  host.setAttribute("data-id-card-export-host", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${ID_CARD_PX.width}px`,
    `height:${ID_CARD_PX.height}px`,
    "margin:0",
    "padding:0",
    "overflow:hidden",
    "pointer-events:none",
    "opacity:1",
    "z-index:-1",
    "background:#ffffff",
  ].join(";");

  const clone = element.cloneNode(true);
  clone.style.cssText = [
    "transform:none",
    "transform-origin:top left",
    `width:${ID_CARD_PX.width}px`,
    `height:${ID_CARD_PX.height}px`,
    "box-shadow:none",
    "margin:0",
    "position:relative",
    "overflow:hidden",
    "background:#ffffff",
    'font-family:Arial,Helvetica,"Segoe UI",sans-serif',
  ].join(";");

  // Keep field text visible and unclipped for capture
  clone.querySelectorAll(".id-card-field").forEach((node) => {
    node.style.visibility = "visible";
    node.style.opacity = "1";
    node.style.overflow = "visible";
    node.style.color = "#111111";
    node.style.fontFamily = "Arial, Helvetica, sans-serif";
    node.style.fontWeight = "600";
    node.style.lineHeight = "1.15";
    node.style.display = "block";
    node.style.alignItems = "";
    // Drop fixed height that was clipping glyphs in export
    node.style.height = "auto";
    node.style.webkitFontSmoothing = "antialiased";
  });

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );

    return await html2canvas(clone, {
      scale: 3,
      width: ID_CARD_PX.width,
      height: ID_CARD_PX.height,
      windowWidth: ID_CARD_PX.width,
      windowHeight: ID_CARD_PX.height,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (_doc, clonedCard) => {
        clonedCard.style.transform = "none";
        clonedCard.querySelectorAll(".id-card-field").forEach((node) => {
          node.style.visibility = "visible";
          node.style.opacity = "1";
          node.style.overflow = "visible";
          node.style.height = "auto";
          node.style.display = "block";
          node.style.color = "#111111";
          node.style.fontWeight = "600";
          node.style.fontFamily = "Arial, Helvetica, sans-serif";
        });
      },
    });
  } finally {
    host.remove();
  }
}

function sanitizeFileName(name) {
  return (name || "employee")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
}

export async function downloadIdCardPdf({ element, employee, format = "card" }) {
  const canvas = await renderIdCardToCanvas(element);
  const imgData = canvas.toDataURL("image/png");
  const fileName = `GammoDA_ID_${sanitizeFileName(employee?.name || employee?.employeeId)}_${format}.pdf`;

  if (format === "card") {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [ID_CARD_MM.width, ID_CARD_MM.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, ID_CARD_MM.width, ID_CARD_MM.height);
    pdf.save(fileName);
  } else {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const cardWidth = ID_CARD_MM.width;
    const cardHeight = ID_CARD_MM.height;
    const x = (pageWidth - cardWidth) / 2;
    const y = 45;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(20, 83, 45);
    pdf.text("GAMMO DEVELOPMENT ASSOCIATION (GammoDA)", pageWidth / 2, 25, {
      align: "center",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(
      "Official Employee Identification Card (CR80 Standard)",
      pageWidth / 2,
      32,
      { align: "center" }
    );

    pdf.setDrawColor(180, 180, 180);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.rect(x - 1, y - 1, cardWidth + 2, cardHeight + 2);

    pdf.addImage(imgData, "PNG", x, y, cardWidth, cardHeight);

    pdf.setLineDashPattern([], 0);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text("Cutting & Printing Instructions:", x, y + cardHeight + 14);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      "1. Print at 100% scale (Do not choose 'Fit to Page' in printer dialog).",
      x,
      y + cardHeight + 20
    );
    pdf.text(
      "2. Cut along the dashed line for exact CR80 badge wallet / pouch size (85.6mm x 56mm).",
      x,
      y + cardHeight + 25
    );
    pdf.text(
      `3. Employee: ${employee?.name || "—"} | ID: ${employee?.employeeId || "—"} | Position: ${employee?.position || "—"}`,
      x,
      y + cardHeight + 30
    );

    pdf.save(fileName);
  }
}

export async function downloadIdCardPng({ element, employee }) {
  const canvas = await renderIdCardToCanvas(element);
  const dataUrl = canvas.toDataURL("image/png");
  const fileName = `GammoDA_ID_${sanitizeFileName(employee?.name || employee?.employeeId)}.png`;

  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
