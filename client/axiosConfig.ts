import axios from "axios";

/**
 * Cookie httpOnly do Express set chỉ “đúng domain” khi response là same-origin với trang (qua rewrite `/express-api`).
 * Local: NEXT_PUBLIC_SERVER_URL=http://localhost:5000 → gọi thẳng API.
 * Deploy (Vercel…): luôn gọi `${origin}/express-api` (kể cả env còn trỏ nhầm tới Render).
 */
function resolveBaseURL(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL?.trim();

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalDev =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]";
    if (isLocalDev && fromEnv && /^https?:\/\//i.test(fromEnv)) {
      return fromEnv.replace(/\/$/, "");
    }
    const prefix = (fromEnv?.startsWith("/") ? fromEnv : "/express-api").replace(
      /\/$/,
      ""
    );
    return `${window.location.origin}${prefix}`;
  }

  /* SSR / Node: gọi thẳng backend (cookie không dùng ở đây thường là không có) */
  const internal =
    process.env.BACKEND_URL?.trim() ||
    (fromEnv && /^https?:\/\//i.test(fromEnv) ? fromEnv : "") ||
    "http://localhost:5000";
  return internal.replace(/\/$/, "");
}

const instance = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true,
});

// ✅ Interceptor cho request
instance.interceptors.request.use(
  (config) => config,
  (error) => {
    console.error("🚨 Request Error:", error);
    return Promise.reject(error);
  }
);

// ✅ Interceptor cho response
instance.interceptors.response.use(
  (response) => response, 
  (error) => {
    // Kiểm tra có phản hồi từ server không
    if (error.response) {
      console.error(`❌ Server Error Response: Status ${error.response.status}`, error.response.data);

      // Nếu token invalid thì reload lại trang
      if (
        error.response.data &&
        (error.response.data.code === "TOKEN_INVALID" ||
          error.response.data.code === "TOKEN_INVALIDATED")
      ) {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
    } else if (error.request) {
      console.error("❌ No Response from Server:", error.request);
    } else {
      console.error("❌ Axios Config Error:", error.message);
    }

    return Promise.reject(error.response.data);
  }
);

export default instance;
