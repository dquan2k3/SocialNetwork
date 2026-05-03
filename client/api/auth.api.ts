import instance from "@/axiosConfig";

export interface LoginPayload {
  email: string;
  password: string;
  isKeepLogin: string;
}

export interface RegisterPayload{
  email: string;
  password: string;
  rePassword: string;
  name: string;
}

export async function apiLogin(payload: LoginPayload) {
  console.log("payload", payload);
  const response = await instance.post("/auth/login", payload);
  return response.data;
}

export async function apiRegister(payload: RegisterPayload) {
  console.log("payload", payload);
  const response = await instance.post("/auth/register", payload);
  return response.data;
}

export async function apiCheckLogin() {
  const response = await instance.post("/auth/checklogin");
  return response.data;
}


// Thêm hàm logout
export async function apiLogout() {
  const response = await instance.post("/auth/logout");
  return response.data;
}

export interface ChangePasswordPayload {
  email: string;
  oldPassword: string;
  newPassword: string;
  reNewPassword: string;
}

export async function apiChangePassword(payload: ChangePasswordPayload) {
  const response = await instance.post("/auth/changepassword", payload);
  return response.data;
}


