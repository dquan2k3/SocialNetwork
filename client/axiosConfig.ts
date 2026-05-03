import axios from "axios";

const API_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
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
