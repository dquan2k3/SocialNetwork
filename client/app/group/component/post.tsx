"use client";
import React, { useState } from "react";

// Dữ liệu mẫu bài viết trong nhóm (giả lập)
const samplePosts = [
  {
    id: 1,
    author: {
      name: "Nguyễn Văn A",
      avatar:
        "https://i.pravatar.cc/100?img=1",
    },
    createdAt: "2024-06-01T10:12:00Z",
    content: "Chào mừng mọi người đến với nhóm. Đây là bài đăng đầu tiên!",
    images: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80"
    ],
    liked: false,
    likeCount: 5,
    commentCount: 2,
  },
  {
    id: 2,
    author: {
      name: "Trần Thị B",
      avatar:
        "https://i.pravatar.cc/100?img=2",
    },
    createdAt: "2024-06-02T14:05:00Z",
    content: "Có ai đi dã ngoại cuối tuần này không ạ?",
    images: [],
    liked: true,
    likeCount: 8,
    commentCount: 4,
  }
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

const GroupPostTab: React.FC = () => {
  // State cho danh sách bài viết (ở đây dùng samplePosts tĩnh)
  const [posts, setPosts] = useState(samplePosts);

  // Đăng bài mới (dạng đơn giản, chỉ nội dung text)
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    setSubmitting(true);

    // Thêm bài mới vào đầu danh sách (data fake, giả sử user là "Bạn")
    const newPost = {
      id: Date.now(),
      author: {
        name: "Bạn",
        avatar: "https://i.pravatar.cc/100?img=3"
      },
      createdAt: new Date().toISOString(),
      content: newPostContent.trim(),
      images: [],
      liked: false,
      likeCount: 0,
      commentCount: 0
    };

    setPosts([newPost, ...posts]);
    setNewPostContent("");
    setSubmitting(false);
  };

  const toggleLike = (id: number) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === id
          ? {
              ...post,
              liked: !post.liked,
              likeCount: post.liked
                ? post.likeCount - 1
                : post.likeCount + 1
            }
          : post
      )
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-xl mx-auto">
        {/* Box đăng bài mới */}
        <div className="bg-[#232427] p-4 rounded-2xl mb-6 shadow">
          <div className="flex gap-3 items-start mb-2">
            <img
              src="https://i.pravatar.cc/100?img=3"
              alt="avatar"
              className="rounded-full w-10 h-10 object-cover"
            />
            <textarea
              className="w-full bg-[#252728] text-white rounded-lg px-1 py-2 focus:outline-none resize-none"
              rows={2}
              placeholder="Chia sẻ điều gì đó với nhóm..."
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex justify-end">
            <button
              className={`font-semibold px-1 py-2 rounded-lg bg-[#3479EF] text-white hover:bg-[#225ac7] transition ${
                submitting ? "opacity-60 pointer-events-none" : ""
              }`}
              disabled={!newPostContent.trim() || submitting}
              onClick={handleCreatePost}
            >
              Đăng bài
            </button>
          </div>
        </div>

        {/* Danh sách bài viết */}
        <div className="flex flex-col gap-6">
          {posts.length === 0 && (
            <div className="text-center text-[#b0b3b8]">
              Chưa có bài viết nào trong nhóm.
            </div>
          )}
          {posts.map(post => (
            <div
              key={post.id}
              className="bg-[#232427] p-5 rounded-2xl shadow flex flex-col gap-3"
            >
              <div className="flex gap-3 items-center">
                <img
                  src={post.author.avatar}
                  alt="avt"
                  className="rounded-full w-10 h-10 object-cover"
                />
                <div>
                  <div className="font-semibold text-white">
                    {post.author.name}
                  </div>
                  <div className="text-xs text-[#b0b3b8]">
                    {formatDate(post.createdAt)}
                  </div>
                </div>
              </div>
              <div className="text-white whitespace-pre-line">{post.content}</div>
              {post.images && post.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {post.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt=""
                      className="rounded-md max-h-64 object-cover w-full"
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-6 mt-2">
                <button
                  className={`flex items-center gap-1 text-sm font-medium ${
                    post.liked
                      ? "text-[#3479EF]"
                      : "text-[#b0b3b8] hover:text-[#3479EF]"
                  } transition`}
                  onClick={() => toggleLike(post.id)}
                >
                  <svg
                    className="w-5 h-5 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  {post.likeCount > 0 ? post.likeCount : "Thích"}
                </button>
                <button className="flex items-center gap-1 text-sm text-[#b0b3b8] hover:text-[#3479EF] font-medium transition">
                  <svg
                    className="w-5 h-5 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 6.5a2.5 2.5 0 0 0-2.5-2.5h-13A2.5 2.5 0 0 0 3 6.5v11a2.5 2.5 0 0 0 2.5 2.5h2.17a1 1 0 0 1 .71.29l2.82 2.83c.39.39 1.03.39 1.42 0l2.83-2.83a1 1 0 0 1 .7-.29h2.17A2.5 2.5 0 0 0 21 17.5v-11zm-2.5.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-2.17c-.8 0-1.56.32-2.12.88l-2.21 2.21V19A2.5 2.5 0 0 0 7.5 16.5h-2A.5.5 0 0 1 5 16v-11a.5.5 0 0 1 .5-.5h13z"/>
                  </svg>
                  {post.commentCount > 0 ? post.commentCount : "Bình luận"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
};

export default GroupPostTab;
