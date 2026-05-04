"use client";
import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CallRoomContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get("idc") || ""; 

  // refs cho video local
  const myVideoRef = useRef<HTMLVideoElement>(null);

  const [hasMedia, setHasMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Lấy camera/mic của bản thân
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        setHasMedia(true);
        setLocalStream(stream);
        setMediaError(null);
        activeStream = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        setMediaError(
          "Không truy cập được camera/mic. Vui lòng kiểm tra quyền truy cập."
        );
        setHasMedia(false);
        setLocalStream(null);
      }
    };
    getUserMedia();

    return () => {
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    };
  }, []);

  useEffect(() => {
    if (myVideoRef.current && localStream) {
      myVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#20232a]">
      <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center relative min-w-[400px] min-h-[300px]">
        <h1 className="text-xl font-bold mb-3 text-blue-600">
          Phòng gọi video
        </h1>
        <div className="mb-2">
          <b>Đối tượng:</b>{" "}
          <span className="text-blue-700">{targetId || <i>Chưa có idc</i>}</span>
        </div>
        <div className="relative w-[630px] h-[370px] flex items-center justify-center bg-zinc-100 rounded-2xl overflow-hidden border" style={{boxShadow: "0 2px 16px #0002"}}>
          {/* Video đối tượng (peer large) - tạm thời chưa hiển thị */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-zinc-300"
            style={{ borderRadius: "16px" }}
          >
            <span className="text-gray-500 text-xl">
              Đang chờ đối tượng hiện video...
            </span>
          </div>
          {/* Video bản thân (nhỏ ở góc) */}
          <div className="absolute bottom-4 right-4 bg-black/60 rounded-lg p-1 shadow-xl z-20 border border-white" style={{width: "130px", height: "84px"}}>
            <video
              ref={myVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-lg border"
              style={{background: "#444"}}
            />
            {!hasMedia && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-gray-200">
                {mediaError ? mediaError : "Đang truy cập camera..."}
              </div>
            )}
          </div>
        </div>
        {!!mediaError && (
          <div className="text-red-500 mt-3 text-sm">{mediaError}</div>
        )}
      </div>
    </div>
  );
}

export default function CallRoomPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-600 mt-10">Đang tải...</div>}>
      <CallRoomContent />
    </Suspense>
  );
}