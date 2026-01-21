"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiBanUser, apiLoadUser } from "@/api/management.api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faBan, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";

function formatFullDatetime(dateStr: string) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())} giờ ${pad(date.getMinutes())}p ngày ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatShortDate(dateStr?: string) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

const UserManagement = () => {
  const [search, setSearch] = useState("");
  const [searchConfirmed, setSearchConfirmed] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hoverUserCell, setHoverUserCell] = useState<string | null>(null);
  const [banCellHover, setBanCellHover] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [popupState, setPopupState] = useState<{
    open: boolean;
    userId: string | null;
    type: "ban" | "unban" | null;
    defaultDays: number;
  }>({
    open: false,
    userId: null,
    type: null,
    defaultDays: 7,
  });
  const [banDays, setBanDays] = useState<number>(7);
  // ---- Bắt đầu sửa lỗi priority ----
  // Lưu res.priority sau lần fetch đầu để dùng lại khi scroll, khi nào setup đầu thì mới nhận giá trị từ server
  const [priority, setPriority] = useState<any>(undefined);
  const priorityRef = useRef<any>(undefined);
  // ---- Kết thúc sửa lỗi priority ----
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const didFetchFirst = useRef(false);

  const isLoadingApi = useRef(false);

  const fetchUsers = useCallback(
    async (cursor?: string, keyword?: string) => {
      if (isLoadingApi.current) return;
      isLoadingApi.current = true;
      setLoading(true);
      try {
        const params: any = {};
        if (cursor) params.cursor = cursor;
        if (keyword && keyword.trim() !== "") params.keyword = keyword.trim();
        // ==== Sửa lỗi priority ==== //
        // Nếu priority đã được lấy thì truyền priority (không dùng state trực tiếp vì closure, dùng priorityRef)
        if (priorityRef.current !== undefined) params.priority = priorityRef.current;
        const res = await apiLoadUser(Object.keys(params).length > 0 ? params : undefined);
        // Nhận giá trị priority ở lần đầu fetch để lưu lại cho các lần sau (kể cả khi scroll)
        if (res && typeof res.priority !== "undefined" && priorityRef.current === undefined) {
          setPriority(res.priority);
          priorityRef.current = res.priority;
        }
        // ==== Hết sửa lỗi priority ==== //

        if (res && res.success && Array.isArray(res.users)) {
          let newUsers = res.users.sort((a: any, b: any) => {
            const getPriority = (user: any) =>
              (user?.Role?.toLowerCase() === "admin" ? 0 : 1);
            return getPriority(a) - getPriority(b);
          });

          setUsers(prev => (cursor ? [...prev, ...newUsers] : newUsers));
          setHasMore(!!res.nextCursor);
          setNextCursor(res.nextCursor || null);
        } else {
          if (!cursor) setUsers([]);
          setHasMore(false);
          setNextCursor(null);
        }
      } catch (error) {
        if (!cursor) setUsers([]);
        setHasMore(false);
        setNextCursor(null);
      } finally {
        setLoading(false);
        isLoadingApi.current = false;
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!didFetchFirst.current) {
      didFetchFirst.current = true;
      setNextCursor(null);
      fetchUsers(undefined, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (didFetchFirst.current) {
      setNextCursor(null);
      fetchUsers(undefined, searchConfirmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchConfirmed]);

  const onTableScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const el = e.currentTarget;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - 5 &&
      !loading &&
      hasMore &&
      nextCursor
    ) {
      fetchUsers(nextCursor, searchConfirmed);
    }
  };

  // Đảm bảo priority reset về undefined khi tìm kiếm mới
  const handleSearchClick = () => {
    const trimmed = search.trim();
    setSearchConfirmed(trimmed);
    setNextCursor(null);
    setPriority(undefined);
    priorityRef.current = undefined;
    fetchUsers(undefined, trimmed);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchClick();
    }
  };

  const openBanUnbanPopup = (
    userId: string,
    type: "ban" | "unban"
  ) => {
    setPopupState({
      open: true,
      userId,
      type,
      defaultDays: type === "ban" ? 7 : 0,
    });
    setBanDays(type === "ban" ? 7 : 0);
  };

  const closePopup = () => {
    setPopupState({
      open: false,
      userId: null,
      type: null,
      defaultDays: 7,
    });
  };

  // ==== Sửa hàm handleConfirmBanUnban: chờ apiBanUser có res.success thì mới update users ==== //
  const handleConfirmBanUnban = async () => {
    if (!popupState.userId || !popupState.type) return;
    setActionLoading(popupState.userId);
    try {
      const res = await apiBanUser(popupState.userId, banDays);
      if (res && res.success) {
        closePopup();
        setUsers((users) =>
          users.map((u) => {
            if (u.userId === popupState.userId) {
              if (popupState.type === "ban") {
                const untilDate =
                  banDays && banDays > 0
                    ? new Date(Date.now() + banDays * 86400000).toISOString()
                    : null;
                return {
                  ...u,
                  status: "banned",
                  banUntil: untilDate,
                };
              } else {
                const untilDate =
                  banDays && banDays > 0
                    ? new Date(Date.now() + banDays * 86400000).toISOString()
                    : null;
                if (!untilDate) {
                  return {
                    ...u,
                    status: "",
                    banUntil: null,
                  };
                } else {
                  return {
                    ...u,
                    status: "banned",
                    banUntil: untilDate,
                  };
                }
              }
            }
            return u;
          })
        );
      }
    } catch (e) {
      // Bạn có thể hiển thị thông báo lỗi ở đây nếu muốn
    } finally {
      setActionLoading(null);
    }
  };
  // ==== Kết thúc sửa handleConfirmBanUnban ==== //

  const handleUserCellClick = (userId: string) => {
    if (userId) {
      router.push(`/profile/${userId}`);
    }
  };

  const handleDaysInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmBanUnban();
    }
  };

  const hideNumberInputSpinnerStyle: React.CSSProperties = {
    MozAppearance: "textfield",
    appearance: "textfield",
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center w-full md:w-1/2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-[#353535] bg-[#232324] text-white focus:outline-none"
            placeholder="Tìm kiếm theo Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchInputKeyDown}
           
          />
          <button
            className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 focus:outline-none"
            style={{
              marginLeft: "17px",
              cursor: "pointer",
              border: "1px solid #353535",
              borderLeft: "none",
            }}
            onClick={handleSearchClick}
            title="Tìm kiếm"
            tabIndex={0}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </button>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-lg shadow max-h-[65vh] overflow-y-auto custom-scroll"
        ref={tableContainerRef}
        onScroll={onTableScroll}
      >
        <table className="min-w-full bg-[#232324] text-white">
          <thead>
            <tr className="text-left border-b border-[#353535]">
              <th className="py-3 px-3">Người dùng</th>
              <th className="py-3 px-3 text-center">Username</th>
              <th className="py-3 px-3 text-center">Role</th>
              <th className="py-3 px-3 text-center">Ngày tạo</th>
              <th className="py-3 px-3 text-center">Cấm đến</th>
              <th className="py-3 px-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            ) : (
              users.map((user: any) => (
                <tr
                  key={user.userId || user._id}
                  className={`border-b border-[#353535] hover:bg-[#282829] transition relative`}
                  style={{ cursor: "pointer" }}
                >
                  <td
                    className="py-3 px-3 font-semibold flex items-center gap-3 relative"
                    onMouseEnter={() => setHoverUserCell(user.userId || user._id)}
                    onMouseLeave={() => setHoverUserCell(null)}
                    onClick={() => handleUserCellClick(user.userId || user._id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="relative flex items-center">
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          overflow: "hidden",
                          border: "1px solid #353535",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#232324",
                        }}
                      >
                        <img
                          src={getCloudinaryImageLink(user.avatar, user.avatarCroppedArea, 40) || "/images/avatar-placeholder.png"}
                          alt="avatar"
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>                    
                    </div>
                    <div>
                      <div className="text-white font-semibold">
                        {user.name || "Không rõ tên"}
                      </div>
                    </div>
                    {hoverUserCell === (user.userId || user._id) && (
                      <div
                        className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full z-50 bg-white border border-gray-300 text-gray-900 px-3 py-1 rounded shadow-lg text-sm min-w-[220px] whitespace-nowrap"
                        style={{ marginBottom: "4px", left: "calc(50% + 30px)" }}
                      >
                        <div className="font-bold mb-1 text-blue-700">Email:</div>
                        <div>{user.Email || user.email || "Không có email"}</div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">{user.username || <span className="text-gray-400 text-sm">—</span>}</td>
                  <td className="py-3 px-3 text-center">
                    {user.Role?.toLowerCase() === "admin" ? (
                      <span className="rounded px-2 py-1 text-xs bg-purple-800 text-purple-200 font-semibold">Admin</span>
                    ) : (
                      <span className="rounded px-2 py-1 text-xs bg-sky-900 text-sky-200">{user.Role || "User"}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {user.createdAt ? (
                      <span className="text-white text-xs">{formatShortDate(user.createdAt)}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td
                    className="py-3 px-3 text-center relative"
                    onMouseEnter={() => setBanCellHover(user.userId || user._id)}
                    onMouseLeave={() => setBanCellHover(null)}
                  >
                    {user.status === "banned" && user.banUntil ? (
                      <>
                        <span
                          className="text-red-400 text-xs"
                          style={{ position: "relative", zIndex: 1 }}
                        >
                          {formatShortDate(user.banUntil)}
                        </span>
                        {banCellHover === (user.userId || user._id) && (
                          <div
                            className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full z-50 bg-[#151518] border border-[#353535] text-white px-3 py-1 rounded shadow-lg text-sm min-w-[200px] whitespace-nowrap"
                            style={{
                              marginBottom: "4px"
                            }}
                          >
                            {formatFullDatetime(user.banUntil)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {user.Role?.toLowerCase() === "admin" ? (
                      <span className="text-gray-400 text-xs italic">Không thể cấm</span>
                    ) : (
                      <>
                        {user.status === "banned" ? (
                          <button
                            disabled={actionLoading === user.userId}
                            className={`px-3 py-2 text-xs rounded bg-green-800 text-green-200 hover:bg-green-700 flex items-center gap-1 mx-auto ${actionLoading === user.userId ? "opacity-60 cursor-not-allowed" : ""}`}
                            title="Hủy cấm/Thay đổi người dùng"
                            onClick={() => openBanUnbanPopup(user.userId, "unban")}
                            style={{
                              cursor: actionLoading === user.userId ? "not-allowed" : "pointer",
                            }}
                          >
                            {actionLoading === user.userId ? (
                              <span className="animate-spin w-4 h-4 inline-block border-b-2 border-white rounded-full"></span>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faCheckCircle} />
                                Hủy cấm/Thay đổi
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            disabled={actionLoading === user.userId}
                            className={`px-3 py-2 text-xs rounded bg-red-800 text-red-200 hover:bg-red-700 flex items-center gap-1 mx-auto ${actionLoading === user.userId ? "opacity-60 cursor-not-allowed" : ""}`}
                            title="Cấm người dùng"
                            onClick={() => openBanUnbanPopup(user.userId, "ban")}
                            style={{
                              cursor: actionLoading === user.userId ? "not-allowed" : "pointer",
                            }}
                          >
                            {actionLoading === user.userId ? (
                              <span className="animate-spin w-4 h-4 inline-block border-b-2 border-white rounded-full"></span>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faBan} />
                                Cấm
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
            {loading && users.length > 0 && (
              <tr>
                <td colSpan={6} className="text-center py-3 text-gray-400">Đang tải thêm...</td>
              </tr>
            )}
            {!hasMore && users.length > 0 && (
              <tr>
                <td colSpan={6} className="text-center py-2 text-gray-400 text-xs">Đã hiển thị tất cả người dùng.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {popupState.open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-300"
          style={{
            background: "rgba(0,0,0,0.65)",
          }}
          onClick={closePopup}
        >
          <div
            className="bg-[#18181b] border border-[#353535] rounded-xl shadow-xl p-6 w-full max-w-xs relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-white text-center">
              {popupState.type === "ban" ? "Cấm người dùng" : "Hủy cấm / Thay đổi"}
            </div>
            <div className="mb-2 text-white text-sm">
              Số ngày{popupState.type === "ban" ? " cấm" : " (0 = hủy cấm)"}:
            </div>
            <input
              type="number"
              min={0}
              className="w-full px-3 py-2 rounded-lg border border-[#353535] bg-[#232324] text-white focus:outline-none mb-2"
              value={banDays}
              onChange={e => {
                const v = parseInt(e.target.value, 10) || 0;
                setBanDays(v >= 0 ? v : 0);
              }}
              onKeyDown={handleDaysInputKeyDown}
              autoFocus
              style={{
                ...hideNumberInputSpinnerStyle,
                WebkitAppearance: "none",
                MozAppearance: "textfield",
              } as React.CSSProperties}
            />
            <style jsx global>{`
              input[type="number"]::-webkit-inner-spin-button,
              input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none !important;
                margin: 0 !important;
              }
              input[type="number"] {
                -moz-appearance: textfield !important;
              }
            `}</style>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 cursor-pointer py-1 rounded bg-[#39393e] text-white font-semibold hover:bg-[#22222c]"
                onClick={closePopup}
              >
                Hủy
              </button>
              <button
                className={`px-4 py-1 rounded ${
                  popupState.type === "ban"
                    ? "bg-red-700 text-red-200 hover:bg-red-800"
                    : "bg-green-700 text-green-200 hover:bg-green-800"
                } font-semibold`}
                onClick={handleConfirmBanUnban}
                style={{ cursor: "pointer" }}
              >
                {popupState.type === "ban" ? "Cấm" : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
