"use client";
import React, { useEffect, useState } from "react";
import { apiGetMedia } from "@/api/profile.api";
import ShowPostById from "@/components/ui/ShowpostById";

type TabMenu = "images" | "videos";

interface ImageProfileTabProps {
  userId: string;
}

export default function ImageProfileTab({ userId }: ImageProfileTabProps) {
  const [tab, setTab] = useState<TabMenu>("images");

  const [images, setImages] = useState<{ url: string; post_id: string }[]>([]);
  const [videos, setVideos] = useState<{ url: string; post_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPost, setShowPost] = useState<boolean>(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGetMedia(userId)
      .then(res => {
        if (cancelled) return;
        setImages(Array.isArray(res?.images) ? res.images : []);
        setVideos(Array.isArray(res?.videos) ? res.videos : []);
        setError("");
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError("Không lấy được media từ server");
        setImages([]);
        setVideos([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const handleShowPost = (postId: string) => {
    setSelectedPostId(postId);
    setShowPost(true);
  };

  const handleClosePost = () => {
    setShowPost(false);
    setSelectedPostId(null);
  };

  // Hàm xử lý xóa post, sẽ truyền vào onDelete cho ShowPostById
  const handleDeletePost = (postId: string) => {
    // Xóa tất cả ảnh có post_id === postId khỏi UI
    setImages(prevImages => prevImages.filter(img => img.post_id !== postId));
    setVideos(prevVideos => prevVideos.filter(vid => vid.post_id !== postId));
    // Nếu đang xem post bị xóa thì đóng popup
    if (selectedPostId === postId) {
      setShowPost(false);
      setSelectedPostId(null);
    }
  };

  return (
    <div className="">
      {/* Tabs redesigned */}
      <div className="flex items-center justify-center mb-6">
        <div className="bg-[#18191a] rounded-full shadow-lg flex px-2 py-2 gap-2 border border-[#292a2f]">
          <button
            className={`flex items-center gap-2 rounded-full px-6 py-2 font-semibold text-lg transition min-w-[120px] cursor-pointer
              ${tab === "images"
                ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-md scale-105"
                : "bg-transparent text-[#aeb3be] hover:bg-[#23242b] hover:text-white"
              }`}
            style={{ cursor: "pointer" }}
            onClick={() => setTab("images")}
          >
            <span>
              {/* Camera icon */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={tab === "images" ? "#fff" : "#aeb3be"}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 7V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V7C20 5.9 19.1 5 18 5H16.83L16.41 4.41C16.21 4.15 15.88 4 15.53 4H8.47C8.12 4 7.79 4.15 7.59 4.41L7.17 5H6C4.9 5 4 5.9 4 7ZM12 17C10.07 17 8.5 15.43 8.5 13.5C8.5 11.57 10.07 10 12 10C13.93 10 15.5 11.57 15.5 13.5C15.5 15.43 13.93 17 12 17Z" />
              </svg>
            </span>
            Ảnh
          </button>
          <button
            className={`flex items-center gap-2 rounded-full px-6 py-2 font-semibold text-lg transition min-w-[120px] cursor-pointer
              ${tab === "videos"
                ? "bg-gradient-to-r from-purple-700 to-pink-400 text-white shadow-md scale-105"
                : "bg-transparent text-[#aeb3be] hover:bg-[#23242b] hover:text-white"
              }`}
            style={{ cursor: "pointer" }}
            onClick={() => setTab("videos")}
          >
            <span>
              {/* Video icon */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={tab === "videos" ? "#fff" : "#aeb3be"}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 10.5V7C17 5.9 16.1 5 15 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19H15C16.1 19 17 18.1 17 17V13.5L21 17V7L17 10.5Z" />
              </svg>
            </span>
            Video
          </button>
        </div>
      </div>

      {/* Nội dung từng tab */}
      {tab === "images" && (
        <div className="flex flex-wrap gap-4">
          <h3 className="w-full text-white text-3xl font-semibold mb-2 drop-shadow-lg tracking-wide">Ảnh</h3>
          {loading && <div className="text-white text-lg font-medium animate-pulse">Đang tải ảnh...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && images.length === 0 && (
            <div className="text-[#b0b3b8] italic">Chưa có ảnh nào.</div>
          )}
          {images.map((img, idx) => (
            <div
              key={img.post_id ? `${img.post_id}_${idx}` : idx}
              className="rounded-xl overflow-hidden bg-[#23242b] flex items-center justify-center cursor-pointer hover:scale-105 hover:ring-2 hover:ring-blue-500 transition-all shadow-md group"
              style={{
                width: 185,
                height: 185,
                border: "1.5px solid #26272b",
              }}
              onClick={() => handleShowPost(img.post_id)}
              title="Xem bài viết chứa ảnh"
            >
              <img
                src={img.url}
                alt={`Ảnh ${idx + 1}`}
                className="object-cover w-full h-full group-hover:brightness-110 transition duration-200"
                style={{ width: 185, height: 185 }}
              />
            </div>
          ))}
        </div>
      )}
      {tab === "videos" && (
        <div className="flex flex-wrap gap-4">
          <h3 className="w-full text-white text-3xl font-semibold mb-2 drop-shadow-lg tracking-wide">Video</h3>
          {loading && <div className="text-white text-lg font-medium animate-pulse">Đang tải video...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && videos.length === 0 && (
            <div className="text-[#b0b3b8] italic">Chưa có video nào.</div>
          )}
          {videos.map((vid, idx) => (
            <div
              key={vid.post_id ? `${vid.post_id}_${idx}` : idx}
              className="rounded-xl overflow-hidden bg-[#23242b] flex items-center justify-center cursor-pointer hover:scale-105 hover:ring-2 hover:ring-pink-400 transition-all shadow-md group"
              style={{
                width: 185,
                height: 185,
                border: "1.5px solid #26272b",
              }}
              onClick={() => handleShowPost(vid.post_id)}
              title="Xem bài viết chứa video"
            >
              <video
                src={vid.url}
                controls
                className="object-cover w-full h-full group-hover:brightness-110 transition duration-200"
                style={{ width: 185, height: 185 }}
              ></video>
            </div>
          ))}
        </div>
      )}

      {selectedPostId && (
        <ShowPostById
          postId={selectedPostId}
          isShow={showPost}
          onClose={handleClosePost}
          onDelete={handleDeletePost}
        />
      )}
    </div>
  );
}
