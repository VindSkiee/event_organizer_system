// Finance report download service
import { api } from "@/shared/lib/axios";

export interface DownloadReportPayload {
  reportType: "summary" | "detail";
  groupId?: number;
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

/**
 * Download laporan keuangan sebagai file PDF.
 * Memanggil backend endpoint dengan responseType 'blob',
 * lalu memicu download otomatis di browser.
 */
export async function downloadFinanceReport(payload: DownloadReportPayload): Promise<void> {
  const response = await api.get("/finance/report/download", {
    params: {
      reportType: payload.reportType,
      groupId: payload.groupId,
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
    responseType: "blob",
  });

  // Ambil filename dari Content-Disposition header jika tersedia
  const contentDisposition = response.headers["content-disposition"];
  let filename = `laporan-keuangan-${payload.reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      filename = match[1].replace(/['"]/g, "");
    }
  }

  // Buat object URL dari blob dan trigger download
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
