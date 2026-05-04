export const CHECKLIST_MESSAGES = {
  unauthorized: "Không có quyền truy cập.",
  checklistNotFound: "Không tìm thấy danh sách công việc.",
  checklistItemNotFound: "Không tìm thấy mục công việc.",
  checklistReorderForeignItem:
    "Không thể sắp xếp mục công việc không thuộc danh sách này.",
  useSameChecklistReorder:
    "Hãy sử dụng sắp xếp trong cùng danh sách cho thao tác này.",
  invalidOrderList: "Danh sách sắp xếp không hợp lệ.",
  itemNoLongerInSource: "Mục công việc không còn thuộc danh sách nguồn.",
  movedItemNotInDestination:
    "Mục công việc di chuyển không nằm đúng danh sách đích.",
  staleMoveOrder: "Không thể di chuyển với dữ liệu sắp xếp đã cũ.",
  invalidItemOrder: "Thứ tự mục công việc không hợp lệ.",
  moveItemFailed: "Di chuyển mục công việc thất bại.",
  reorderItemFailed: "Sắp xếp mục công việc thất bại.",
  moveItemGeneric: "Không thể di chuyển mục công việc.",
  validChecklistsNotFound: "Không tìm thấy danh sách công việc hợp lệ.",
} as const;
