import { AppDispatch } from "@/store";
import { loginSuccess, logout } from "@/store/slices/authSlice";
import {
  addBio,
  removeBio,
  addProfile,
  removeProfile,
  removeUserId, // import removeUserId from userSlice
} from "@/store/slices/userSlice";
import {
  apiLogin,
  apiLogout,
  apiRegister,
  LoginPayload,
  RegisterPayload,
} from "@/api/auth.api";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";

// Đăng xuất xong chuyển hướng đến trang auth

// Login — có Redux, token, toast
export const authLogin = async (dispatch: AppDispatch, payload: LoginPayload) => {
  try {
    const data = await apiLogin(payload);

    dispatch(
      loginSuccess({
        user: data.user,
      })
    );

    toast.success("Đăng nhập thành công!");
    return data;
  } catch (error: any) {
    toast.error(getErrorMessage(error));
    throw error;
  }
};

// Register — không dùng Redux
export const authRegister = async (payload: RegisterPayload) => {
  try {
    const data = await apiRegister(payload);
    toast.success("Đăng ký thành công!");
    return data;
  } catch (error: any) {
    const msg = error.response?.data?.message || "Đăng ký thất bại!";
    toast.error(msg);
    throw error;
  }
};

// Logout: Gọi API logout xong mới clear all store và storage, sau đó chuyển hướng đến /auth
export const authLogout = async (
  dispatch: AppDispatch,
  router: { push: (path: string) => void }
) => {
  try {
    const res = await apiLogout();
    console.log(res);
  } catch (error: any) {
    // thông báo hoặc xử lý lỗi logout
  }

  localStorage.clear();
  sessionStorage.clear?.();
  dispatch(logout());
  dispatch(removeBio());
  dispatch(removeProfile());
  dispatch(removeUserId()); // xóa userId khỏi store khi logout
  toast.info("Đã đăng xuất!");
  router.push("/auth");
};
