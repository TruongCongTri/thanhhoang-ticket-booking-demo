/** The company this site showcases. */
export const BRAND = {
  name: "Thanh Hoang",
  /** Full-colour logo on a transparent background (mark above the wordmark). */
  logo: { src: "/brand/thanh-hoang-logo.png", width: 2362, height: 991 },
};

/** Who built this demo site (credited in the footer, linked from the disclaimer). */
export const AUTHOR = { name: "Công Tri", url: "https://truong-cong-tri-portfolio.vercel.app" };

/** How to reach the ticket office: shown in the footer and behind the floating call / Zalo buttons. */
export const CONTACT = {
  /** As printed, and as dialled. The first is the hotline the call button rings. */
  phones: [
    { text: "0938 75 4689", tel: "+84938754689" },
    { text: "0979 969 010", tel: "+84979969010" },
  ],
  email: "vemaybay@thanhhoang.vn",
  /** Zalo chat with the hotline number. */
  zalo: "https://zalo.me/0938754689",
};
