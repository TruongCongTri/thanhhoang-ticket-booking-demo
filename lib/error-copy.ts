import { hasLocale, type Locale } from "@/lib/i18n";

/**
 * The error and loading screens' copy. Kept apart from the dictionaries:
 * these screens are client-side (error boundaries must be) and may render
 * without the page's layout, so they carry just these few strings.
 */
export const ERROR_COPY = {
  vi: {
    notFound: {
      code: "404",
      label: "Không tìm thấy trang",
      title: "Chuyến bay này không có trong lịch trình.",
      body: "Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Hãy quay về trang chủ để tìm chuyến bay của bạn.",
    },
    error: {
      code: "500",
      label: "Đã có lỗi xảy ra",
      title: "Chuyến bay tạm hoãn.",
      body: "Một sự cố ngoài ý muốn vừa xảy ra. Bạn có thể thử lại, hoặc quay về trang chủ — chúng tôi vẫn sẵn sàng hỗ trợ qua hotline.",
    },
    retry: "Thử lại",
    home: "Về trang chủ",
    back: "Quay lại",
    call: "Gọi {phone}",
    ref: "Mã lỗi",
    loading: "Đang tải…",
  },
  en: {
    notFound: {
      code: "404",
      label: "Page not found",
      title: "This flight isn't on the schedule.",
      body: "The link may have changed or no longer exists. Head back to the home page to find your flight.",
    },
    error: {
      code: "500",
      label: "Something went wrong",
      title: "This flight is delayed.",
      body: "Something unexpected happened. You can try again, or go back to the home page — our hotline is always here to help.",
    },
    retry: "Try again",
    home: "Home page",
    back: "Go back",
    call: "Call {phone}",
    ref: "Error code",
    loading: "Loading…",
  },
} as const satisfies Record<Locale, unknown>;

/** The language of a path (/vi/…, /en/…), else Vietnamese. */
export function localeOfPath(pathname: string): Locale {
  const first = pathname.split("/")[1] ?? "";
  return hasLocale(first) ? first : "vi";
}
