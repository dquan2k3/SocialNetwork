"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#1C1C1D] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-[#252728] border border-gray-800 rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl bg-[#1C1C1D] border border-gray-800 p-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex-1">
            <div className="text-sm text-gray-300">Lỗi 404</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold">
              Không tìm thấy trang
            </h1>
            <p className="mt-2 text-gray-300 leading-relaxed">
              Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi. Bạn có
              thể quay lại trang trước hoặc về trang chủ để tiếp tục.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-white text-black font-semibold px-4 py-2.5 hover:bg-gray-200 transition"
              >
                Về trang chủ
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center rounded-xl bg-[#1C1C1D] border border-gray-700 text-white font-semibold px-4 py-2.5 hover:bg-[#232324] transition"
              >
                Quay lại
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

