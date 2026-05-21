import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { unwrapFunctionResponse } from "@/lib/base44Response";

/**
 * PDF出力の共通hook
 * @param {string} eventId
 * @param {'staff'|'timeline'} type
 * @param {string} filename - 保存ファイル名のプレフィックス
 */
export function usePDFExport(eventId, type, filename) {
  const [exporting, setExporting] = useState(false);

  const exportPDF = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke("exportPositionPDF", { eventId, type });
      const payload = unwrapFunctionResponse(response);
      if (payload.error) {
        alert("エラー: " + payload.error);
        return;
      }
      if (!payload.html) {
        throw new Error("PDF HTML payload is empty");
      }

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "-9999px";
      container.style.width = "297mm";
      container.style.backgroundColor = "white";
      container.innerHTML = payload.html;
      document.body.appendChild(container);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        allowTaint: true,
      });

      document.body.removeChild(container);

      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        throw new Error("Canvas render failed");
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      // A4横向き: 297mm x 210mm
      const pageW = 297;
      const pageH = 210;

      const doc = new jsPDF("l", "mm", "a4");
      doc.addImage(imgData, "JPEG", 0, 0, pageW, pageH);

      doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("PDF作成に失敗しました: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportPDF };
}
