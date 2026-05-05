import axios from "axios";

/**
 * - Local: NEXT_PUBLIC_SERVER_URL=http://localhost:5000 (direct to Express)
 * - Vercel: omit NEXT_PUBLIC_SERVER_URL or set NEXT_PUBLIC_SERVER_URL=/express-api,
 *   and set BACKEND_URL on Vercel + in next.config (rewrite target) so cookies stay on the frontend domain.
 */
function resolveBaseURL(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }
  const prefix = (fromEnv?.startsWith("/") ? fromEnv : "/express-api").replace(
    /\/$/,
    ""
  );
  if (typeof window !== "undefined") {
    return `${window.location.origin}${prefix}`;
  }
  const internal = process.env.BACKEND_URL?.trim() || "http://localhost:5000";
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
