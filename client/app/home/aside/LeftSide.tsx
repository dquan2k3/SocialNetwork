"use client";
import React, { useState, useEffect } from "react";
import { apiGetOnlineUser } from "@/api/conversation.api";
import { useChatSocket } from "@/socket/useChatSocket";
import { useSelector } from "react-redux";
import { useChatDock } from "@/app/providers/ChatDockProvider";

type OnlineFriend = { 
  id: string;
  name: string;
  avatar: string;
};

export default function LeftSide() {
  const [friends, setFriends] = useState<OnlineFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Lấy thông tin user từ redux store
  const user = useSelector((state: any) => state.user);
  const myName = user.profile?.name;
  const myId = user?.userId;

  // Hook lấy hàm openChat để mở cửa sổ chat
  const { openChat } = useChatDock();

  // Lắng nghe sự kiện onlineUser, cập nhật danh sách
  const { listenNotification } = useChatSocket(myId, myName);
  useEffect(() => {
    const off = listenNotification?.({
      onOnlineUser: (data: any) => {
        // data: { avatar, name, type: "online" | "offline", userId }
        if (!data || !data.userId) return;
        setFriends(prev => {
          const existedIdx = prev.findIndex(f => f.id === data.userId);
          if (data.type === "online") {
            if (existedIdx !== -1) {
              // Nếu user đã có và online thì giữ nguyên
              return prev;
            } else {
              // Nếu user chưa có và online thì thêm vào đầu danh sách
              return [
                {
                  id: data.userId,
                  name: data.name,
                  avatar: data.avatar,
                },
                ...prev,
              ];
            }
          } else if (data.type === "offline") {
            // Nếu user có mà offline thì xóa khỏi danh sách
            if (existedIdx !== -1) {
              const newArr = [...prev];
              newArr.splice(existedIdx, 1);
              return newArr;
            }
            // Nếu không có thì giữ nguyên
            return prev;
          } else {
            // type không hợp lệ
            return prev;
          }
        });
      },
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, [myId, myName]);

  useEffect(() => {
    setLoading(true);
    apiGetOnlineUser()
      .then(res => {
        // res.friends: [{id, name, avatar}]
        if (res?.success && Array.isArray(res.friends)) {
          setFriends(res.friends);
        } else {
          setFriends([]);
        }
      })
      .catch(err => {
        setFriends([]);
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Có thể thực hiện filter danh sách nếu muốn (ở đây là alert theo như original)
    alert("Tìm kiếm: " + search);
  };

  // Lọc theo search nếu muốn realtime thêm
  const filteredFriends =
    search.trim().length === 0
      ? friends
      : friends.filter(friend =>
          friend.name.toLowerCase().includes(search.trim().toLowerCase())
        );

  // Khi click vào bạn bè thì mở chat
  const handleFriendClick = (user: OnlineFriend) => {
    openChat({
      id: user.id,
      title: user.name || "Người dùng",
      avatarUrl: user.avatar,
    });
  };

  return (
    <div className="w-[260px] max-w-full p-4 rounded-xl bg-[#222328] text-white shadow-md select-none">
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Bạn bè đang trực tuyến</h2>
        <form onSubmit={handleSearch}>
          <div className="flex items-center">
            <input
              className="w-full px-3 py-2 rounded-md bg-[#18181b] text-white border border-blue-400 focus:outline-none"
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 40 }}
            />
            <button
              type="submit"
              className="ml-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Tìm kiếm"
              style={{ height: 40, width: 40, minWidth: 40, minHeight: 40, padding: 0 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="currentColor" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" />
              </svg>
            </button>
          </div>
        </form>
      </div>
      <div>
        {loading ? (
          <div className="text-sm text-gray-400 px-2 py-3">Đang tải...</div>
        ) : filteredFriends.length === 0 ? (
          <div className="text-sm text-gray-400 px-2 py-3">Không có bạn bè đang online</div>
        ) : (
          filteredFriends.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-[#29292f] transition mb-1 cursor-pointer"
              onClick={() => handleFriendClick(user)}
            >
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#333]"
                />
                <span
                  className="absolute bottom-0 right-0 block w-3 h-3 rounded-full border-2 bg-green-400 border-[#222328]"
                  title="Đang trực tuyến"
                ></span>
              </div>
              <span className="text-sm font-medium truncate">{user.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
