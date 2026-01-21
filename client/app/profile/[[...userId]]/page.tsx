"use client";
import React, { useState, useRef, useEffect } from "react";
import Post from "@/components/ui/Post";
import AlterProfilePopup from "../menu/alterProfilePopup";
import { useSelector, useDispatch } from "react-redux";
import { getCloudinaryImageLink, getCloudinaryCoverLink } from "@/helper/croppedImageHelper";
import { apiBanUserDueToProfile } from "@/api/management.api";
import ShowImage from "@/components/ui/ShowImage";
import { apiChangeUsername, apiGetUserProfile } from "@/api/profile.api";
import Information from "../menu/Information";
import { useParams, useRouter } from "next/navigation";
import RelationshipButton from "@/components/ui/RelationshipButton";
import ImageProfileTab from "../menu/Images";
import FriendsProfilePage from "../menu/FriendsProfilePage";
import FriendsPage from "@/app/friends/page";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";

// For report popup: FontAwesome (just for example icon, remove if not needed)
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFlag } from "@fortawesome/free-solid-svg-icons";
import { apiReportUser } from "@/api/report.api";

// Popup close button for ban popup
function PopupCloseButton({ onClick, ariaLabel }: { onClick: () => void, ariaLabel?: string }) {
  return (
    <button
      className="absolute top-2 right-2 text-gray-400 hover:bg-gray-700 text-2xl cursor-pointer rounded-full w-10 h-10 flex items-center justify-center transition"
      onClick={onClick}
      aria-label={ariaLabel || "Đóng"}
      type="button"
    >&times;</button>
  );
}

type ImageObj = {
  file_type?: string;
  file_url?: string;
  order_index?: number;
};

// Helper to get remaining username lock days
function getRemainingDays(usernameChangedDateRaw?: string | number | Date): number {
  if (!usernameChangedDateRaw) return 0;
  const lastChanged = new Date(usernameChangedDateRaw).getTime();
  if (isNaN(lastChanged)) return 0;
  const now = Date.now();
  const millisInDay = 24 * 60 * 60 * 1000;
  const diff = now - lastChanged;
  const daysSinceChange = Math.floor(diff / millisInDay);
  const remaining = 30 - daysSinceChange;
  return remaining > 0 ? remaining : 0;
}

export default function ProfilePage() {
  // Lấy userId từ param
  const params = useParams();
  const router = useRouter();
  let userId: string | undefined = undefined;
  if (params && (params as any).userId) {
    if (Array.isArray((params as any).userId) && (params as any).userId.length > 0) {
      userId = (params as any).userId[0];
    } else if (typeof (params as any).userId === "string") {
      userId = (params as any).userId;
    }
  }

  const dispatch = useDispatch();
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showStickyProfile, setShowStickyProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [isFlashing, setIsFlashing] = useState("");

  // Báo cáo popup
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [pendingReport, setPendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Ban popup
  const [showBanPopup, setShowBanPopup] = useState(false);
  const [banDays, setBanDays] = useState("0");
  const [banError, setBanError] = useState("");
  const [loadingBan, setLoadingBan] = useState(false);
  const [banCheck, setBanCheck] = useState({
    avatar: false,
    cover: false,
    name: false,
    username: false,
  });

  // Modal for ShowImage
  const [modalData, setModalData] = useState<{
    images?: ImageObj[];
    initialIndex?: number;
    avatar?: string;
    avatarCroppedArea?: any;
    name?: string;
    username?: string;
    createdAt?: string | number | Date;
    type?: "avatar" | "cover";
  } | null>(null);

  // ===================
  // PROFILE STATE HANDLING
  // ===================

  // Nếu userId: dùng apiGetUserProfile. Ngược lại: dùng redux.
  const reduxUser = useSelector((state: any) => state.user);
  const auth = useSelector((state: any) => state.auth); // <-- for admin role
  const role = auth?.user?.role;
  const myId = reduxUser.userId;
  const user = useSelector((state: any) => state.user);
  const myName = user.profile?.name;
  const myUsername = user.profile?.username;
  const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);
  const [userProfile, setUserProfile] = useState<any>(userId ? null : reduxUser);

  // Nếu myId === userId param thì chuyển về trang /profile
  useEffect(() => {
    if (userId && myId && userId === myId) {
      router.replace("/profile");
    }
  }, [userId, myId, router]);

  // Loading + error cho mode khac user (userId)
  const [loadingProfile, setLoadingProfile] = useState(!!userId);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      setLoadingProfile(true);
      apiGetUserProfile(userId)
        .then((data) => {
          setUserProfile(data);
          setLoadingProfile(false);
          setProfileError(null);
        })
        .catch((err) => {
          setProfileError(
            err?.response?.data?.message ||
            err?.message ||
            "Không thể lấy thông tin user"
          );
          setLoadingProfile(false);
        });
    } else {
      setUserProfile(reduxUser);
    }
  }, [userId, reduxUser]);


  // Xử lý sync/logic cho chỉnh sửa username. Chỉ dùng khi không có userId.
  // Khi đang xem profile của chính mình, cho phép sửa username.
  const [localUsername, setLocalUsername] = useState(
    userId ? "" : reduxUser.profile?.username || ""
  );
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(
    userId ? "" : reduxUser.profile?.username || ""
  );
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      const newUsername = reduxUser.profile?.username || "";
      setLocalUsername(newUsername);
      setUsernameInput(newUsername);
    }
  }, [reduxUser.profile?.username, userId]);

  const handleSaveUsername = async () => {
    setUsernameError(null);
    if (!usernameInput || usernameInput === localUsername) {
      setEditingUsername(false);
      return;
    }
    setUsernameSaving(true);
    try {
      await apiChangeUsername({ username: usernameInput });
      setLocalUsername(usernameInput);
      setEditingUsername(false);
    } catch (err: any) {
      setUsernameError(
        err?.response?.data?.message ||
        err?.message ||
        "Đã xảy ra lỗi khi cập nhật username"
      );
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleCancelUsername = () => {
    setUsernameInput(localUsername);
    setEditingUsername(false);
    setUsernameError(null);
  };

  const handleClick = (id: string) => {
    setIsFlashing(id);
    setTimeout(() => setIsFlashing(""), 100);
  };

  // Report popup handlers
  const handleReport = async () => {
    setReportError(null);
    if (!reportReason.trim()) {
      setReportError("Vui lòng nhập lý do.");
      return;
    }
    try {
      const res = await apiReportUser({
        userId: userId || "",
        reason: reportReason,
        type: "user"
      });
      // Similar to Showpost.tsx, use toast.success on success
      toast.success(res.message || "Đã gửi báo cáo thành công");
      setReportSuccess(true);
    } catch (err: any) {
      // Similar to Showpost.tsx, use toast.warn with error message
      toast.warn(getErrorMessage(err));
      setReportError(
        err?.response?.data?.message ||
        err?.message ||
        "Gửi báo cáo thất bại, vui lòng thử lại."
      );
    }
    setShowReportPopup(false);
    setReportReason("");
    setReportSuccess(false);
    setReportError(null);
  };

  // ===================
  // EXTRACTED DATA
  // ===================
  // Luôn lấy dữ liệu từ userProfile (dù là redux hay API)
  const bio = userProfile?.bio || {};
  const profile = userProfile?.profile || {};

  const displayName = profile.name || "";
  const displayAvatar = bio.avatar || "";
  const displayAvatarCroppedArea = bio.avatarCroppedArea || null;
  const avatar40x40 = getCloudinaryImageLink(
    displayAvatar,
    displayAvatarCroppedArea,
    40,
    { rounded: true }
  );
  const avatar190x190 = getCloudinaryImageLink(
    displayAvatar,
    displayAvatarCroppedArea,
    190,
    { rounded: true }
  );

  const displayCover = bio.cover || "";
  const displayCoverCroppedArea = bio.coverCroppedArea || null;
  const cover1233x460 = getCloudinaryCoverLink(
    displayCover,
    displayCoverCroppedArea,
    1233,
    460
  );
  const coverBgColor = [36, 37, 40];
  const coverBgGradient = `radial-gradient(circle at center, rgb(${coverBgColor[0]},${coverBgColor[1]},${coverBgColor[2]}), #232425 70%)`;

  const displayCreatedAt = userProfile?.createdAt || userProfile?.created_at || "";
  const displayDescription = bio.description || "";

  // Username Lock
  const usernameChangedDate = profile.usernameChangedDate;
  const usernameDaysRemaining = getRemainingDays(usernameChangedDate);
  const canChangeUsername = usernameDaysRemaining <= 0;
  const displayUsername =
    profile.username ||
    (!userId ? localUsername : "") ||
    "";

  // Modal for ShowImage: Lấy từ dữ liệu phối hợp API/redux tuỳ context
  const handleShowImageModal = (type: "avatar" | "cover") => {
    if (type === "avatar") {
      setModalData({
        images: [
          {
            file_type: "image",
            file_url: displayAvatar,
            order_index: 0,
          },
        ],
        initialIndex: 0,
        avatar: displayAvatar,
        avatarCroppedArea: displayAvatarCroppedArea,
        name: displayName,
        username: displayUsername,
        createdAt: displayCreatedAt,
        type: "avatar",
      });
    } else {
      setModalData({
        images: [
          {
            file_type: "image",
            file_url: displayCover,
            order_index: 0,
          },
        ],
        initialIndex: 0,
        avatar: displayAvatar,
        avatarCroppedArea: displayAvatarCroppedArea,
        name: displayName,
        username: displayUsername,
        createdAt: displayCreatedAt,
        type: "cover",
      });
    }
  };
  const handleCloseModal = () => setModalData(null);

  // Sticky tab bar
  useEffect(() => {
    const handleScroll = () => {
      if (!tabMenuRef.current) return;
      const tabMenuRect = tabMenuRef.current.getBoundingClientRect();
      if (tabMenuRect.top <= 0) {
        setShowStickyProfile(true);
      } else {
        setShowStickyProfile(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Helper: Ban popup images
  const coverImg = getCloudinaryCoverLink(displayCover, displayCoverCroppedArea, 448, 168);

  // ===================
  // RENDER LOGIC
  // ===================

  if (loadingProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-[#252728] items-center justify-center">
        <div className="text-white text-xl">Đang tải thông tin tài khoản...</div>
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="flex flex-col min-h-screen bg-[#252728] items-center justify-center">
        <div className="text-red-400 text-xl">{profileError}</div>
      </div>
    );
  }

  // Các props lấy từ dòng 71-73:
  // const myId = reduxUser.userId;
  // const myName = user.profile?.name;
  // const myUsername = user.profile?.username;

  // ------------ BAN USER POPUP JSX -----------
  const BanUserPopup = ({
    open,
    userData,
    onClose
  }: {
    open: boolean;
    userData: {
      userId: string;
      avatar?: string;
      avatarCroppedArea?: any;
      name?: string;
      username?: string;
      cover?: string;
      coverCroppedArea?: any;
    };
    onClose: () => void;
  }) => {
    if (!open) return null;

    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-500"
        style={{
          background: "rgba(40,40,40,0.82)",
          backdropFilter: "blur(1.5px)"
        }}
        onClick={onClose}
      >
        <div
          className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative"
          onClick={e => e.stopPropagation()}
        >
          <PopupCloseButton onClick={onClose} ariaLabel="Đóng popup người dùng bị báo cáo" />
          <div className="mb-6 w-full flex flex-col gap-4">

            {/* Cover */}
            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="cover-checkbox" className="flex flex-row items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="cover-checkbox"
                  checked={banCheck.cover}
                  onChange={e => setBanCheck((c) => ({ ...c, cover: e.target.checked }))}
                  className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
                />
                <span className="font-semibold text-white text-base">Ảnh bìa:</span>
              </label>
              <div className="relative w-full flex items-center justify-center">
                <img
                  src={coverImg}
                  alt="Ảnh bìa"
                  style={{
                    width: "448px",
                    height: "168px",
                    objectFit: "cover",
                    borderRadius: "0.5rem",
                    filter: "brightness(0.9)"
                  }}
                  className="border border-gray-700"
                />
              </div>
            </div>

            {/* Avatar */}
            <div className="flex flex-col gap-2 items-start w-full">
              <label htmlFor="avatar-checkbox" className="flex flex-row items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="avatar-checkbox"
                  checked={banCheck.avatar}
                  onChange={e => setBanCheck((c) => ({ ...c, avatar: e.target.checked }))}
                  className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
                />
                <span className="font-semibold text-white text-base">Avatar:</span>
              </label>
              <div className="flex items-center gap-2">
                <img
                  src={
                    userData.avatar
                      ? getCloudinaryImageLink(userData.avatar, userData.avatarCroppedArea, 80)
                      : "/user_default.png"
                  }
                  alt={userData.name}
                  className="rounded-full w-20 h-20 object-cover border border-gray-700"
                />
              </div>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-2 items-start w-full">
              <label htmlFor="name-checkbox" className="flex flex-row items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="name-checkbox"
                  checked={banCheck.name}
                  onChange={e => setBanCheck((c) => ({ ...c, name: e.target.checked }))}
                  className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
                />
                <span className="font-semibold text-white text-base">
                  Tên người dùng: {userData.name}
                </span>
              </label>
              {/* Username with checkbox, white text */}
              <label htmlFor="username-checkbox" className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="username-checkbox"
                  checked={!!banCheck.username}
                  onChange={e => setBanCheck((c) => ({ ...c, username: e.target.checked }))}
                  className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                  style={{ marginRight: "0.5rem" }}
                />
                <span className="text-white text-base font-semibold">
                  Username: {userData.username}
                </span>
              </label>
            </div>

            {/* Ban days input */}
            <div className="flex flex-col gap-2 w-full mt-2">
              <label htmlFor="ban-days-userpopup" className="text-sm text-white font-semibold">
                Nhập số ngày cấm (0 là không đổi):
              </label>
              <input
                id="ban-days-userpopup"
                type="number"
                value={banDays}
                min={0}
                step={1}
                onChange={e => {
                  let v = e.target.value.replace(/[^0-9]/g, "");
                  if (v === "") v = "0";
                  setBanDays(v);
                  setBanError("");
                }}
                className="px-3 py-2 rounded border border-gray-600 bg-[#212124] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 (không đổi)"
              />
              {banError && (
                <div className="text-red-400 text-xs mt-1">{banError}</div>
              )}
            </div>
          </div>

          <div className="flex justify-end items-center w-full gap-3 mt-4">
            <button
              className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
              style={{ minWidth: 80 }}
              onClick={onClose}
              type="button"
            >Đóng</button>
            <button
              className={`px-6 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer ${loadingBan ? "opacity-60 pointer-events-none" : ""}`}
              onClick={async () => {
                if (!/^\d+$/.test(banDays)) {
                  setBanError("Vui lòng nhập số ngày hợp lệ");
                  return;
                }
                setBanError("");
                setLoadingBan(true);
                try {
                  const res = await apiBanUserDueToProfile(
                    userData.userId,
                    parseInt(banDays, 10),
                    !!banCheck.avatar,
                    !!banCheck.cover,
                    !!banCheck.name,
                    !!banCheck.username
                  );
                  if (res && res.success) {
                    // Gọi lại API lấy profile user mới nhất (name, username, cover, avatar, ...)
                    if (userData.userId) {
                      try {
                        const refreshed = await apiGetUserProfile(userData.userId);
                        setUserProfile(refreshed); // cập nhật state
                      } catch (e) {
                        // ignore, chỉ báo lỗi toast nếu cần
                        toast.warn("Làm mới hồ sơ thất bại.");
                      }
                    }
                    toast.success("Đã cấm/xóa thành công.");
                  } else {
                    // res không có success là true
                    toast.warn(res && res.message ? res.message : "Cấm/xóa thất bại!");
                  }
                  onClose();
                } catch (err) {
                  setBanError(getErrorMessage(err));
                } finally {
                  setLoadingBan(false);
                }
              }}
              type="button"
              disabled={loadingBan}
            >
              {loadingBan ? "Đang xử lý..." : "Xóa và cấm"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------- END BAN USER POPUP ----------

  // Data for ban popup
  const banUserData = {
    userId: userId || "",
    avatar: bio.avatar,
    avatarCroppedArea: bio.avatarCroppedArea,
    name: profile.name,
    username: profile.username,
    cover: bio.cover,
    coverCroppedArea: bio.coverCroppedArea,
  };

  // Determine admin is viewing others' profile (not self)
  const isViewingOther = !!userId && (!!role && role === "Admin");

  return (
    <div className="flex flex-col min-h-screen bg-[#252728]">
      {/* Popup chỉnh sửa hồ sơ - Ẩn khi có userId, chỉ render khi showPopup */}
      {!userId && showPopup && (
        <AlterProfilePopup
          showPopup={showPopup}
          setShowPopup={setShowPopup}
          avatar={displayAvatar}
          avatarCroppedStat={bio.avatarCroppedStat || null}
          avatarCroppedArea={displayAvatarCroppedArea}
          cover={displayCover}
          coverCroppedStat={bio.coverCroppedStat || null}
          coverCroppedArea={displayCoverCroppedArea}
          description={displayDescription}
          dispatch={dispatch}
          getCloudinaryCoverLink={getCloudinaryCoverLink}
          getCloudinaryImageLink={getCloudinaryImageLink}
        />
      )}

      {/* ShowImage Modal */}
      {modalData && (
        <ShowImage
          images={modalData.images}
          initialIndex={modalData.initialIndex}
          onClose={handleCloseModal}
          avatar={modalData.avatar}
          avatarCroppedArea={modalData.avatarCroppedArea}
          name={modalData.name}
          username={modalData.username}
          createdAt={modalData.createdAt}
        />
      )}

      {/* Ban User Popup (admin - chỉ khi xem người khác) */}
      {showBanPopup && (
        <BanUserPopup
          open={showBanPopup}
          userData={banUserData}
          onClose={() => setShowBanPopup(false)}
        />
      )}

      {/* Report User Popup (ẩn nếu là admin xem người khác) */}
      {showReportPopup && !isViewingOther && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[300]"
          style={{
            background: "rgba(0,0,0,0.65)"
            // backdropFilter: "blur(2px)"
          }}
        >
          <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96">
            <div className="mb-4 w-full flex items-center justify-between">
              <div className="font-semibold text-lg text-white">Báo cáo người dùng</div>
              <button
                className="text-gray-400 hover:bg-gray-700 text-2xl cursor-pointer rounded-full w-10 h-10 flex items-center justify-center transition"
                onClick={() => {
                  setShowReportPopup(false);
                  setTimeout(() => {
                    setReportReason("");
                    setReportSuccess(false);
                    setReportError(null);
                  }, 300);
                }}
                aria-label="Đóng báo cáo"
                type="button"
              >&times;</button>
            </div>
            <div className="text-[#ddd] text-center mb-6">
              Vui lòng nhập lý do bạn muốn báo cáo người dùng này.
            </div>
            <textarea
              className="bg-[#232425] text-white border border-[#525356] px-3 py-2 rounded w-full min-h-[80px] mb-2 resize-none outline-none"
              placeholder="Nhập lý do báo cáo..."
              maxLength={300}
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              disabled={pendingReport || reportSuccess}
            />
            {reportError && (
              <div className="text-red-400 mb-2 w-full text-sm">{reportError}</div>
            )}
            {reportSuccess && (
              <div className="text-green-400 mb-2 w-full text-sm text-center">Báo cáo thành công. Cảm ơn bạn!</div>
            )}
            <div className="flex justify-end items-center w-full gap-3 mt-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                style={{ minWidth: 80 }}
                disabled={pendingReport || reportSuccess}
                onClick={() => {
                  setShowReportPopup(false);
                  setTimeout(() => {
                    setReportReason("");
                    setReportSuccess(false);
                    setReportError(null);
                  }, 300);
                }}
                type="button"
              >Hủy</button>
              <button
                className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                style={{ minWidth: 110 }}
                disabled={pendingReport || reportSuccess}
                onClick={handleReport}
                type="button"
              >
                <FontAwesomeIcon icon={faFlag} className="mr-2" />
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky avatar + name */}
      {showStickyProfile && (
        <div
          className="z-50 sticky top-[55px] left-0 w-full flex justify-center bg-[#232425] border-b border-[#333] shadow"
          style={{ minHeight: 60, cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 w-[60%] py-2">
            <div
              className="w-10 h-10 rounded-full bg-gray-600"
              style={{
                backgroundImage: `url(${avatar40x40})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            ></div>
            <div className="text-lg text-white font-semibold truncate">
              {displayName || displayUsername || "user"}
            </div>
          </div>
        </div>
      )}

      {/* Body Block */}
      <div className="Body-block flex-1 flex flex-col items-center bg-[#252728]">
        {/* Cover image */}
        <div
          className="w-full flex items-center justify-center"
          style={{
            background: coverBgGradient,
            transition: "background 0.3s",
          }}
        >
          <div
            className={`${isFlashing === "cover" ? "flash" : ""} w-[65%] rounded-b-[10px] cursor-pointer transition duration-200 hover:brightness-110`}
            style={{
              aspectRatio: "2.7/1",
              height: "auto",
              backgroundImage: `url(${cover1233x460})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onClick={() => {
              handleClick("cover");
              handleShowImageModal("cover");
            }}
            title="Xem ảnh bìa"
          ></div>
        </div>

        {/* Profile block */}
        <div className="relative w-full flex flex-col items-center">
          <div className="w-[60%] flex flex-row justify-between">
            {/* Avatar and name */}
            <div className="flex gap-4">
              <div className="w-[200px] h-[200px]">
                <div className="absolute -top-[40px] flex items-center justify-center w-[200px] h-[200px] rounded-full bg-[#252728]">
                  <div
                    className={`${isFlashing === "avatar" ? "flash" : ""} w-[190px] h-[190px] rounded-full bg-gray-600 cursor-pointer transition duration-200 hover:brightness-125`}
                    style={{
                      backgroundImage: `url(${avatar190x190})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }}
                    onClick={() => {
                      handleClick("avatar");
                      handleShowImageModal("avatar");
                    }}
                    title="Xem ảnh đại diện"
                  ></div>
                </div>
              </div>
              <div className="pt-12 flex flex-col gap-2">
                <div className="text-4xl text-white font-semibold cursor-pointer whitespace-nowrap pr-2">
                  {displayName || "user"}
                </div>
                {/* Username row: Ẩn hết các nút chỉnh sửa nếu đang xem profile người khác */}
                <div className="flex items-center text-xl text-white gap-2">
                  {!userId ? (
                    !editingUsername ? (
                      <>
                        <span>
                          @{displayUsername}
                        </span>
                        <button
                          className="ml-2 px-2 py-1 rounded bg-[#0866FF] text-white hover:bg-[#298EFF] text-base transition disabled:opacity-60 disabled:bg-[#555]"
                          onClick={() => setEditingUsername(true)}
                          aria-label="Sửa username"
                          title={
                            canChangeUsername
                              ? "Sửa username"
                              : `Chờ ${usernameDaysRemaining} ngày nữa để thay đổi`
                          }
                          disabled={!canChangeUsername}
                        >
                          Sửa
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          className="bg-[#232425] text-white border border-[#525356] px-2 py-1 rounded outline-none w-[170px]"
                          value={usernameInput}
                          maxLength={30}
                          onChange={e => setUsernameInput(e.target.value.replace(/\s/g, ""))}
                          autoFocus
                          disabled={usernameSaving}
                        />
                        <button
                          className="ml-2 px-2 py-1 rounded bg-[#0866FF] text-white hover:bg-[#298EFF] transition"
                          onClick={handleSaveUsername}
                          disabled={usernameSaving}
                        >
                          {usernameSaving ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button
                          className="ml-1 px-2 py-1 rounded bg-[#323334] text-white hover:bg-[#444] transition"
                          onClick={handleCancelUsername}
                          disabled={usernameSaving}
                        >
                          Huỷ
                        </button>
                        {usernameError && (
                          <span className="ml-2 text-red-400 text-base">{usernameError}</span>
                        )}
                      </>
                    )
                  ) : (
                    // Hiển thị chỉ username, không nút chỉnh sửa
                    <span>@{displayUsername}</span>
                  )}
                  {/* Ban/Cấm or Báo cáo người dùng button */}
                  {userId && (
                    isViewingOther ? (
                      <button
                        className="ml-2 px-2 py-1 rounded bg-red-700/80 hover:bg-red-600 text-white text-base transition flex items-center cursor-pointer"
                        title="Cấm người dùng này"
                        onClick={() => setShowBanPopup(true)}
                      >
                        {/* Ban icon (fa-ban) could be added here */}
                        Cấm
                      </button>
                    ) : (
                      <button
                        className="ml-2 px-2 py-1 rounded bg-red-700/80 hover:bg-red-600 text-white text-base transition flex items-center cursor-pointer"
                        title="Báo cáo người dùng này"
                        onClick={() => setShowReportPopup(true)}
                      >
                        <FontAwesomeIcon icon={faFlag} className="mr-1" />
                        Báo cáo
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
            {/* Right side: Profile action button */}
            {!userId ? (
              <div className="pt-16">
                <button
                  className="h-[40px] w-[115px] bg-[#3B3D3E] hover:bg-[#4F5152] text-[white] rounded-[8px]"
                  onClick={() => setShowPopup(true)}
                >
                  <span className="mr-2">✏️</span> Chỉnh sửa
                </button>
              </div>
            ) : (
              <div className="pt-16">
                {/* Sử dụng RelationshipButton thay vì nút kết bạn thủ công */}
                <RelationshipButton
                  relationship={userProfile?.relationship}
                  myId={myId}
                  userId={userId}
                  name={displayName}
                  avatar={displayAvatar}
                  avatarCroppedArea={displayAvatarCroppedArea}
                  username={displayUsername}
                />
              </div>
            )}
          </div>

          {/* Decorate line */}
          <div className="relative w-[60%] h-px bg-[#64676B] -mt-[20px]"></div>

          {/* Tab Menu */}
          <div
            className="w-full mt-3 flex flex-col items-center"
            ref={tabMenuRef}
          >
            {/* Tab bar giữ nguyên độ rộng 60% */}
            <div className="w-[60%]">
              <div className="flex gap-2">
                {[
                  { label: "Bài viết", key: "posts" },
                  { label: "Giới thiệu", key: "about" },
                  { label: "Bạn bè", key: "friends" },
                  { label: "Ảnh", key: "photos" },
                ].map((tab, idx) => (
                  <button
                    key={tab.key}
                    className={`py-3 px-6 text-lg font-semibold focus:outline-none rounded-[8px] hover:bg-[#3B3D3E] transition cursor-pointer
                      ${activeTab === tab.key
                        ? "border-b-4 border-[#0866FF] text-[#58A2F7]"
                        : "text-[#b0b3b8] hover:text-white"
                      }
                    `}
                    onClick={() => {
                      setActiveTab(tab.key);
                    }}
                    style={activeTab === tab.key ? {
                      boxShadow: "0 2px 16px 0 #0866ff44",
                      transition: "box-shadow 0.3s cubic-bezier(0.4,0,0.2,1)"
                    } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Nội dung của Tab hiển thị full width, không giới hạn 60% */}
            <div className="mt-0 w-full bg-[#1C1C1D] rounded-lg min-h-[400px] p-6 flex justify-center">
              <div className="w-full max-w-5xl">
                {activeTab === "posts" && (
                  <Post
                    name={displayName}
                    username={displayUsername}
                    avatar={displayAvatar}
                    avatarCroppedArea={displayAvatarCroppedArea}
                    userId={userId ? userId : undefined}
                    pageType="Profile"
                    myId={myId}
                    myName={myName}
                    myUsername={myUsername}
                    myAvatar={myAvatar}
                  />
                )}
                {activeTab === "about" && (
                  <Information userId={userId ? userId : undefined} />
                )}
                {activeTab === "friends" && (
                  userId ? (
                    <FriendsProfilePage userId={userId} />
                  ) : (
                    <FriendsPage />
                  )
                )}
                {activeTab === "photos" && (
                  <ImageProfileTab userId={userId ? userId : ""} />
                )}
                {activeTab === "groups" && (
                  <div className="text-white">Nội dung Nhóm</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Đã loại bỏ hiệu ứng cho tab hoạt động gần đây */}
    </div>
  );
}
