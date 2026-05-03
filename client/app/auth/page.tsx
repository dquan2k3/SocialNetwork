"use client";

import React, { useState, useRef, useEffect } from "react";
import { apiRegister as authRegister, apiChangePassword } from "@/api/auth.api";
import { authLogin } from '@/services/auth'
import { toast } from "react-toastify";
import { AppDispatch } from "@/store";
import { loginSuccess, logout } from "@/store/slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "changePassword">("login");
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState<{ left: string; width?: string; transition?: string }>({ left: "0%" });
  const [isKeepLogin, setIsKeepLogin] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  function handleSwitchMode(newMode: "login" | "register" | "changePassword") {
    setMode(newMode);
    if (tabsRef.current) {
      const children = tabsRef.current.children;
      let tabIdx = 0;
      if (newMode === "login") tabIdx = 0;
      else if (newMode === "register") tabIdx = 1;
      else if (newMode === "changePassword") tabIdx = 2;
      const tab = children[tabIdx] as HTMLElement;
      if (tab) {
        setTabIndicatorStyle({
          left: `${tab.offsetLeft}px`,
          width: `${tab.offsetWidth}px`,
          transition: "left 0.35s cubic-bezier(.5,1.6,.35,.95),width 0.3s"
        });
      }
    }
    setIsAgreed(false);
  }

  useEffect(() => {
    if (tabsRef.current) {
      const children = tabsRef.current.children;
      let tabIdx = 0;
      if (mode === "login") tabIdx = 0;
      else if (mode === "register") tabIdx = 1;
      else if (mode === "changePassword") tabIdx = 2;
      const tab = children[tabIdx] as HTMLElement;
      if (tab) {
        setTabIndicatorStyle({
          left: `${tab.offsetLeft}px`,
          width: `${tab.offsetWidth}px`,
          transition:
            mode === "login" || mode === "register" || mode === "changePassword"
              ? "left 0.35s cubic-bezier(.5,1.6,.35,.95),width 0.3s"
              : undefined
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tabsRef.current]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittingLogin = mode === "login";
    const submittingRegister = mode === "register";
    const submittingChangePassword = mode === "changePassword";
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (submittingLogin) {
      const email = String(formData.get("email") || "");
      const password = String(formData.get("password") || "");

      if (!email || !password) {
        toast.warn("Vui lòng nhập email và mật khẩu");
        return;
      }

      authLogin(dispatch, { email, password, isKeepLogin: String(isKeepLogin) })
        .then((data) => {
          router.replace("/home")
          console.log("Login response:", data);
        })
        .catch((error) => {
          const serverError = (error && error.response && error.response.data) || error;
          console.error("Login error:", serverError);
        });
    } else if (submittingRegister) {

      if (!isAgreed) {
        toast.warn("Bạn phải đồng ý với Điều khoản & Chính sách bảo mật để tiếp tục");
        return;
      }

      const email = String(formData.get("email") || "");
      const password = String(formData.get("password") || "");
      const rePassword = String(formData.get("confirmPassword") || "");
      const name = String(formData.get("fullName") || "");

      if (!email || !password || !rePassword || !name) {
        toast.warn("Vui lòng nhập đầy đủ thông tin");
        return;
      }
      if (password !== rePassword) {
        toast.warn("Mật khẩu xác nhận không khớp");
        return;
      }

      authRegister({ email, password, rePassword, name })
        .then((data) => {
          toast.success("Đăng ký thành công!");
          handleSwitchMode("login");
        })
        .catch((error) => {
          const serverError = (error && error.response && error.response.data) || error;
          toast.error(`Có lỗi xảy ra: ${serverError.message}`);
        });
    } else if (submittingChangePassword) {
      const email = String(formData.get("email") || "");
      const oldPassword = String(formData.get("oldPassword") || "");
      const newPassword = String(formData.get("newPassword") || "");
      const reNewPassword = String(formData.get("reNewPassword") || "");

      if (!email || !oldPassword || !newPassword || !reNewPassword) {
        toast.warn("Vui lòng nhập đầy đủ thông tin");
        return;
      }
      if (newPassword !== reNewPassword) {
        toast.warn("Mật khẩu mới xác nhận không khớp");
        return;
      }
      if (oldPassword === newPassword) {
        toast.warn("Mật khẩu mới không được trùng mật khẩu cũ");
        return;
      }

      apiChangePassword({
        email,
        oldPassword,
        newPassword,
        reNewPassword,
      })
        .then(() => {
          toast.success("Đổi mật khẩu thành công. Vui lòng đăng nhập lại!");
          handleSwitchMode("login");
        })
        .catch((error) => {
          const serverError = (error && error.response && error.response.data) || error;
          toast.error(
            serverError && serverError.message
              ? serverError.message
              : "Đổi mật khẩu thất bại"
          );
        });
    }
  }

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isChangePassword = mode === "changePassword";
  const FORM_ANIMATION = "transition-all duration-500 ease-in-out will-change-transform";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <style>
        {`
        .tab-indicator {
          position: absolute;
          top: 0.25rem; bottom: 0.25rem;
          background: #fff;
          border-radius: 9999px;
          z-index: 0;
          box-shadow: 0 1.5px 8px rgba(0,0,0,0.05);
          pointer-events: none;
          transition: left 0.35s cubic-bezier(.5,1.6,.35,.95),width 0.3s;
        }
        .tab-btn { z-index: 10; position: relative; cursor: pointer; }
        .switch-link { cursor: pointer; }
        `}
      </style>
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900">
        <div
          ref={tabsRef}
          className="mb-6 relative grid grid-cols-3 rounded-full bg-zinc-100 p-1 text-sm dark:bg-zinc-800"
          style={{ position: "relative", userSelect: "none" }}
        >
          <div
            className="tab-indicator"
            style={{
              ...tabIndicatorStyle,
              height: "calc(100% - 0.5rem)",
              minWidth: 56,
              background: "var(--tw-bg-opacity,1) #fff",
            }}
          ></div>
          <button
            type="button"
            tabIndex={0}
            onClick={() => handleSwitchMode("login")}
            className={`tab-btn rounded-full px-4 py-2 font-medium transition-colors focus:outline-none ${isLogin
              ? "bg-white text-black shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            style={{ cursor: "pointer" }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            tabIndex={0}
            onClick={() => handleSwitchMode("register")}
            className={`tab-btn rounded-full px-4 py-2 font-medium transition-colors focus:outline-none ${isRegister
              ? "bg-white text-black shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            style={{ cursor: "pointer" }}
          >
            Đăng ký
          </button>
          <button
            type="button"
            tabIndex={0}
            onClick={() => handleSwitchMode("changePassword")}
            className={`tab-btn rounded-full px-4 py-2 font-medium transition-colors focus:outline-none ${isChangePassword
              ? "bg-white text-black shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            style={{ cursor: "pointer" }}
          >
            Đổi mật khẩu
          </button>
        </div>

        {/* Animated swap for form content */}
        <div
          className={`relative overflow-x-hidden h-[90px]`}
        >
          <div
            className={`absolute top-0 left-0 w-full transition-opacity duration-400 ${FORM_ANIMATION} ${isLogin ? "opacity-100 translate-x-0 z-10" : "opacity-0 -translate-x-16 pointer-events-none z-0"
              }`}
          >
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Chào mừng trở lại
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Đăng nhập để tiếp tục.
            </p>
          </div>
          <div
            className={`absolute top-0 left-0 w-full transition-opacity duration-400 ${FORM_ANIMATION} ${isRegister ? "opacity-100 translate-x-0 z-10" : "opacity-0 translate-x-16 pointer-events-none z-0"
              }`}
          >
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Tạo tài khoản mới
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Điền thông tin bên dưới để bắt đầu.
            </p>
          </div>
          <div
            className={`absolute top-0 left-0 w-full transition-opacity duration-400 ${FORM_ANIMATION} ${isChangePassword ? "opacity-100 translate-x-0 z-10" : "opacity-0 translate-x-16 pointer-events-none z-0"
              }`}
          >
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Đổi mật khẩu
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Hãy nhập thông tin bên dưới để thay đổi mật khẩu.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`space-y-4 relative w-full ${FORM_ANIMATION}`}
        >
          {/* Đăng ký: Họ và tên */}
          <div className={`transition-all duration-500 ${isRegister ? "opacity-100 translate-x-0 relative" : "opacity-0 -translate-x-8 absolute pointer-events-none"}`}>
            {isRegister && (
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Họ và tên
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}
          </div>

          {/* Đăng nhập/Đăng ký/Đổi mật khẩu: Email */}
          <div className={`transition-all duration-400`}>
            {(isLogin || isRegister || isChangePassword) && (
              <>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </>
            )}
          </div>

          {/* Password cho login / đăng ký */}
          <div className={`transition-all duration-400 ${isChangePassword ? "opacity-0 -translate-x-8 absolute pointer-events-none" : "opacity-100 translate-x-0 relative"}`}>
            {(isLogin || isRegister) && (
              <>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Mật khẩu
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={isLogin ? "Nhập mật khẩu" : "Tạo mật khẩu"}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </>
            )}
          </div>

          {/* Đăng ký: Xác nhận mật khẩu */}
          <div className={`transition-all duration-500 ${isRegister ? "opacity-100 translate-x-0 relative" : "opacity-0 -translate-x-8 absolute pointer-events-none"}`}>
            {isRegister && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Xác nhận mật khẩu
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}
          </div>

          {/* Đổi mật khẩu form */}
          <div className={`transition-all duration-500 ${isChangePassword ? "opacity-100 translate-x-0 relative" : "opacity-0 -translate-x-8 absolute pointer-events-none"}`}>
            {isChangePassword && (
              <>
                <div>
                  <label
                    htmlFor="oldPassword"
                    className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Mật khẩu cũ
                  </label>
                  <input
                    id="oldPassword"
                    name="oldPassword"
                    type="password"
                    placeholder="Nhập mật khẩu cũ"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Mật khẩu mới
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reNewPassword"
                    className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="reNewPassword"
                    name="reNewPassword"
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </>
            )}
          </div>

          {/* Checkboxes and link */}
          <div className={`transition-all duration-500`}>
            {isLogin ? (
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="size-4 rounded border-zinc-300 text-black dark:border-zinc-700"
                    checked={isKeepLogin}
                    onChange={e => setIsKeepLogin(e.target.checked)}
                    name="keepLogin"
                  />
                  Ghi nhớ đăng nhập
                </label>
                <button
                  type="button"
                  className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSwitchMode("changePassword")}
                >
                  Quên mật khẩu?
                </button>
              </div>
            ) : isRegister ? (
              <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-zinc-300 text-black dark:border-zinc-700"
                  checked={isAgreed}
                  onChange={e => setIsAgreed(e.target.checked)}
                  name="agreeTerms"
                />
                Tôi đồng ý với Điều khoản & Chính sách bảo mật
              </label>
            ) : (
              <div className="text-sm text-zinc-600 dark:text-zinc-400 min-h-5">&nbsp;</div>
            )}
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#383838] dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
            style={{ cursor: "pointer" }}
          >
            {isLogin ? "Đăng nhập" : isRegister ? "Đăng ký" : "Lưu mật khẩu mới"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-700 dark:text-zinc-300">
          {isLogin ? (
            <span>
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("register")}
                className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50 switch-link"
                style={{ cursor: "pointer" }}
              >
                Đăng ký ngay
              </button>
            </span>
          ) : isRegister ? (
            <span>
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("login")}
                className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50 switch-link"
                style={{ cursor: "pointer" }}
              >
                Đăng nhập
              </button>
            </span>
          ) : (
            <span>
              Bạn đã nhớ mật khẩu?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("login")}
                className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50 switch-link"
                style={{ cursor: "pointer" }}
              >
                Quay lại đăng nhập
              </button>
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
