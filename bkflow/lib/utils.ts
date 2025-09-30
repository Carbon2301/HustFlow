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