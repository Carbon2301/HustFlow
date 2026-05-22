"use client";

import Link from "next/link";
import { ChartGantt, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BoardExportDialogProps = {
  boardId: string;
  boardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExportFormat = "csv" | "xlsx";

const getFileNameFromDisposition = (
  disposition: string | null,
  fallback: string,
) => {
  if (!disposition) {
    return fallback;
  }

  const match = /filename="([^"]+)"/.exec(disposition);

  return match?.[1] ?? fallback;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const BoardExportDialog = ({
  boardId,
  boardTitle,
  open,
  onOpenChange,
}: BoardExportDialogProps) => {
  const [downloadingFormat, setDownloadingFormat] = useState<ExportFormat | null>(null);

  const handleDownload = async (format: ExportFormat) => {
    setDownloadingFormat(format);

    try {
      const response = await fetch(`/api/boards/${boardId}/export?format=${format}`);

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const fileName = getFileNameFromDisposition(
        response.headers.get("Content-Disposition"),
        `${boardTitle}-board-export.${format}`,
      );

      downloadBlob(blob, fileName);
      toast.success("Đã tải file xuất dữ liệu.");
    } catch (error) {
      console.error("[BOARD_EXPORT_DOWNLOAD_ERROR]", error);
      toast.error("Không thể xuất dữ liệu board. Vui lòng thử lại.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Xuất dữ liệu</DialogTitle>
          <DialogDescription>
            Tải dữ liệu board để báo cáo hoặc lưu trữ ngoại tuyến.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Dữ liệu Board
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-16 justify-start gap-3 px-3"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("csv")}
              >
                <FileText className="h-4 w-4 text-neutral-500" />
                <span className="min-w-0 text-left">
                  <span className="block font-semibold">
                    {downloadingFormat === "csv" ? "Đang tải..." : "Tải CSV"}
                  </span>
                  <span className="block text-xs font-normal text-neutral-500">
                    Dễ mở bằng Sheets
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-16 justify-start gap-3 px-3"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("xlsx")}
              >
                <FileSpreadsheet className="h-4 w-4 text-neutral-500" />
                <span className="min-w-0 text-left">
                  <span className="block font-semibold">
                    {downloadingFormat === "xlsx" ? "Đang tải..." : "Tải Excel"}
                  </span>
                  <span className="block text-xs font-normal text-neutral-500">
                    Nhiều sheet báo cáo
                  </span>
                </span>
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Timeline/Gantt
            </div>
            <Button
              asChild
              variant="outline"
              className="h-16 w-full justify-start gap-3 px-3"
            >
              <Link href={`/board/${boardId}/timeline`}>
                <ChartGantt className="h-4 w-4 text-neutral-500" />
                <span className="min-w-0 text-left">
                  <span className="block font-semibold">Mở view Tiến độ</span>
                  <span className="block text-xs font-normal text-neutral-500">
                    Xuất PNG từ toolbar Timeline
                  </span>
                </span>
              </Link>
            </Button>
          </section>

          <div className="flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              File chỉ bao gồm lists và cards đang hoạt động; mục đã lưu trữ không nằm trong bản xuất.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
