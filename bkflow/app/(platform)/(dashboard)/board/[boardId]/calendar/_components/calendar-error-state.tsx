"use client";

import { AlertCircle } from "lucide-react";

export const CalendarErrorState = () => (
  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-lg border border-red-100 bg-red-50 px-4 text-center text-red-700">
    <AlertCircle className="mb-2 h-6 w-6" />
    <p className="text-sm font-semibold">Không tải được dữ liệu lịch.</p>
    <p className="mt-1 max-w-md text-xs text-red-600">
      Vui lòng thử tải lại trang hoặc kiểm tra quyền truy cập bảng.
    </p>
  </div>
);
