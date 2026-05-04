"use client";
import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSocket } from "@/socket/SocketProvider";
import { useChatSocket } from "@/socket/useChatSocket";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

// Kiểu CallStatus tường minh để tránh lỗi so sánh types
type CallStatus = "idle" | "calling" | "accepted" | "declined";

// --- Helper component to wrap useSearchParams in Suspense ---
function SearchParamsWrapper({ children }: { children: (searchParams: URLSearchParams) => React.ReactNode }) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}

export default function CallVideoPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen bg-[#20232a]"><div className="text-white">Đang tải...</div></div>}>
      <CallVideoPageContent />
    </Suspense>
  );
}

function CallVideoPageContent() {
  return (
    <SearchParamsWrapper>
      {(searchParams) => <CallVideoPageInner searchParams={searchParams} />}
    </SearchParamsWrapper>
  );
}

function CallVideoPageInner({ searchParams }: { searchParams: URLSearchParams }) {
  const groupId = searchParams.get("idc") || "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const router = useRouter();

  // --- Socket logic (giả sử userId được lấy từ localStorage) ---
  const userId =
    typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";
  const { callOffer, listenAcceptCall } = useChatSocket(userId);

  // Camera: lấy media
  useEffect(() => {
    let localStream: MediaStream | null = null;

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        localStream = stream;
        setHasMedia(true);
        setMediaError(null);
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        setMediaError(
          "Không truy cập được camera. Vui lòng kiểm tra quyền truy cập."
        );
        setHasMedia(false);
        setLocalStream(null);
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      setLocalStream(null);
    };
    // eslint-disable-next-line
  }, []);

  // --- Đăng ký lắng nghe acceptCall (bên được gọi bấm accept hoặc decline trên client khác) ---
  useEffect(() => {
    // Nếu chưa có groupId thì bỏ qua
    if (!groupId) return;
    // Đăng ký listenAcceptCall
    const unsubscribe = listenAcceptCall((data: any) => {
        console.log(data)
      if (data?.type === "accept") {
        setCallStatus("accepted");
        router.push(`/callroom?idg=${data.fromUserId}`);
      } else if (data?.type === "decline") {
        setCallStatus("declined");
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line
  }, [groupId, listenAcceptCall]);

  // Hàm gọi video (callOffer)
  const handleStartCall = useCallback(() => {
    if (!groupId) {
      setMediaError("Không có ID đối tượng/cuộc gọi.");
      return;
    }
    // Ở đây gọi callUser với groupId (targetUserId)
    // offer: nếu dùng WebRTC thì tạo trước (hiện chỉ test truyền groupId)
    if (callOffer) {
      callOffer(groupId, null);
      setCallStatus("calling");
      //console.log("(CallInitiator) Đã gửi callOffer (callUser) tới:", groupId);
    }
  }, [groupId, callOffer]);

  // Xác định trạng thái nút gọi và disabled đúng kiểu
  const isIdleOrDeclined = callStatus === "idle" || callStatus === "declined";
  const isCalling = callStatus === "calling";
  const isAccepted = callStatus === "accepted";
  const isDisabled =
    !hasMedia || !groupId || isCalling || isAccepted;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#20232a]">
      <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">
          Trang gọi video
        </h1>
        <div className="mb-3 text-lg">
          <b>ID đối tượng/cuộc gọi:</b>{" "}
          <span className="text-blue-700">
            {groupId || <i>Không có/idc</i>}
          </span>
        </div>
        <div className="mb-3 text-lg">
          <b>Trạng thái:</b>{" "}
          <span>
            {callStatus === "idle" && "Chưa gọi"}
            {callStatus === "calling" && "Đang gọi..."}
            {callStatus === "accepted" && (
              <span className="text-green-600">Đã được chấp nhận!</span>
            )}
            {callStatus === "declined" && (
              <span className="text-red-600">Đã bị từ chối!</span>
            )}
          </span>
        </div>
        <div
          className="w-[560px] h-[320px] bg-gray-100 rounded-2xl flex items-center justify-center mb-6 relative overflow-hidden"
          style={{ boxShadow: "0 2px 16px #0002" }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover rounded-2xl ${
              hasMedia ? "" : "hidden"
            }`}
            style={{ background: "#222" }}
          />
          {!hasMedia && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xl bg-gray-200">
              {mediaError ? mediaError : "Đang truy cập camera..."}
            </div>
          )}
        </div>
        {/* Thêm nút bắt đầu gọi video (gửi callOffer/callUser) */}
        {isIdleOrDeclined && (
          <button
            className="bg-blue-600 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-md shadow-sm transition disabled:bg-gray-400"
            style={{ minWidth: 120 }}
            onClick={handleStartCall}
            disabled={isDisabled}
          >
            {callStatus === "idle"
              ? "Gọi video"
              : callStatus === "declined"
              ? "Gọi lại"
              : "Đã kết nối"}
          </button>
        )}
        {isCalling && (
          <button
            className="bg-blue-600 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-md shadow-sm transition disabled:bg-gray-400"
            style={{ minWidth: 120 }}
            disabled
          >
            Đang gọi...
          </button>
        )}
        {isAccepted && (
          <button
            className="bg-green-600 text-white font-semibold px-6 py-2 rounded-md shadow-sm transition cursor-default"
            style={{ minWidth: 120 }}
            disabled
          >
            Đã kết nối
          </button>
        )}
      </div>
    </div>
  );
}