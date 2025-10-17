import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}

export function formatNotificationText(title: string, message: string) {
  let formattedTitle = title;
  let formattedMessage = message;

  if (title === "Co phan hoi moi" || title === "Có phản hồi mới") {
    formattedTitle = "Có phản hồi mới";
  } else if (title === "Ban duoc nhac den" || title === "Bạn được nhắc đến") {
    formattedTitle = "Bạn được nhắc đến";
  } else if (title === "Ban duoc them vao bang" || title === "Bạn được mời vào bảng") {
    formattedTitle = "Bạn được mời vào bảng";
  } else if (title === "Ban duoc giao mot the" || title === "Bạn được giao một thẻ") {
    formattedTitle = "Bạn được giao một thẻ";
  } else if (title === "Sap den han" || title === "Sắp đến hạn") {
    formattedTitle = "Thẻ sắp đến hạn";
  }

  formattedMessage = formattedMessage
    .replace(" da tra loi binh luan cua ban trong the ", " đã trả lời bình luận của bạn trong thẻ ")
    .replace(" da nhac den ban trong the ", " đã nhắc đến bạn trong thẻ ")
    .replace("Ban da duoc them vao bang ", "Bạn đã được thêm vào bảng ")
    .replace("Ban duoc giao the ", "Bạn đã được giao thẻ ")
    .replace("se het han luc ", "sẽ hết hạn lúc ")
    .replace("se het han theo moc nhac nho da thiet lap.", "sẽ hết hạn theo mốc nhắc nhở đã thiết lập.");

  if (formattedMessage.startsWith("Thanh vien da ")) {
    formattedMessage = formattedMessage.replace("Thanh vien da ", "Thành viên đã ");
  }

  return { title: formattedTitle, message: formattedMessage };
}

export function getColorName(colorHex: string): string {
  const colorMap: Record<string, string> = {
    // Row 1
    "#bbf7d0": "Xanh lá nhạt",
    "#fef08a": "Vàng nhạt",
    "#fed7aa": "Cam nhạt",
    "#fecaca": "Đỏ nhạt",
    "#f3e8ff": "Tím nhạt",
    // Row 2
    "#4ade80": "Xanh lá",
    "#facc15": "Vàng",
    "#fb923c": "Cam",
    "#f87171": "Đỏ",
    "#c084fc": "Tím",
    // Row 3
    "#15803d": "Xanh lá đậm",
    "#a16207": "Vàng sẫm",
    "#c2410c": "Cam đậm",
    "#b91c1c": "Đỏ đậm",
    "#7e22ce": "Tím đậm",
    // Row 4
    "#dbeafe": "Xanh dương nhạt",
    "#e0f2fe": "Xanh da trời nhạt",
    "#d9f99d": "Xanh đọt chuối nhạt",
    "#fce7f3": "Hồng nhạt",
    "#e5e7eb": "Xám nhạt",
    // Row 5
    "#3b82f6": "Xanh dương",
    "#0ea5e9": "Xanh da trời",
    "#84cc16": "Xanh lá mạ",
    "#db2777": "Hồng",
    "#9ca3af": "Xám",
    // Row 6
    "#1d4ed8": "Xanh dương đậm",
    "#0369a1": "Xanh da trời đậm",
    "#4d7c0f": "Xanh lá mạ đậm",
    "#9d174d": "Hồng sẫm",
    "#4b5563": "Xám đậm",
    // Seeded default blue
    "#60a5fa": "Xanh dương",
  };

  const lowerHex = colorHex.toLowerCase();
  return colorMap[lowerHex] || "Màu sắc khác";
}