"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    apiLoadReportPost,
    apiSearchReportPost,
    apiLoadReportComment,
    apiRemovePostReport,
    apiRemoveCommentReport,
    apiBanUserAndRemoveComment,
    apiLoadUserReport,
    apiBanUserWithReason,
    apiLoadReportMessage,
    apiDeleteReport,
    apoLoadReportedMessage,
    apiBanUserDueToMessage,
    apiRemoveRoomChat,
    apiBanUserDueToProfile
} from "@/api/management.api";
import ShowPostById from "@/components/ui/ShowpostById";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faBan, faTimes, faEye } from "@fortawesome/free-solid-svg-icons";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { getCloudinaryCoverLink } from "@/helper/croppedImageHelper";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";

// Hide native spinner for number inputs for the ban popup
const hideNumberInputSpinnerStyle: React.CSSProperties = {
    MozAppearance: "textfield",
};
const REPORT_TABS = [
    { key: "post", label: "Báo cáo bài viết" },
    { key: "comment", label: "Báo cáo bình luận" },
    { key: "message", label: "Báo cáo tin nhắn" },
    { key: "user", label: "Báo cáo người dùng" },
];

type ReportedPost = {
    _id: string;
    postId: string;
    userId?: string;
    text?: string;
    name?: string;
    username?: string;
    avatar?: string;
    avatarCroppedArea?: any;
    reportCount?: number;
    status?: string;
};

type ReportedComment = {
    _id: string;
    commentId: string;
    userId?: string;
    postId?: string;
    text?: string;
    name?: string;
    username?: string;
    avatar?: string;
    avatarCroppedArea?: any;
    reportCount?: number;
    status?: string;
};

type UserReport = {
    _id: string;
    avatar?: string;
    avatarCroppedArea?: any;
    cover?: string;
    coverCroppedArea?: any;
    createdAt: string;
    name: string;
    reason: string;
    reportedUser: string;
    reporter: string;
    status: string;
    type: string;
    updatedAt: string;
    userId: string;
    username: string;
    coverPhoto?: string; // add for popup
};

type MessageReport = {
    _id: string;
    avatar?: string;
    avatarCroppedArea?: any;
    conversationId?: string;
    createdAt: string;
    name: string | null;
    reportedUser?: string;
    reporter: string;
    status: string;
    type: string;
    updatedAt: string;
    userId: string | null;
    username: string | null;
    groupAvatar?: string;
    groupName?: string;
    [key: string]: any;
};

const CommentContentWithPopup: React.FC<{ text?: string }> = ({ text }) => {
    const [showPopup, setShowPopup] = useState(false);
    if (!text) return null;
    const displayText = text.length > 90 ? text.slice(0, 90) + "..." : text;
    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
        >
            <span style={{ cursor: text.length > 90 ? "pointer" : "default" }}>{displayText}</span>
            {text.length > 90 && showPopup && (
                <div className="absolute z-50 left-0 bottom-full mb-1 px-3 py-2 rounded-lg shadow-lg bg-white text-black text-sm whitespace-pre-line min-w-[220px] max-w-[400px] break-words border border-gray-600"
                    style={{
                        whiteSpace: "pre-line",
                        wordBreak: "break-word",
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
};

const ReasonCellWithPopup: React.FC<{ reason: string }> = ({ reason }) => {
    const [hover, setHover] = useState(false);
    const LIMIT = 30;
    const isLong = reason && reason.length > LIMIT;
    const short = isLong ? reason.slice(0, LIMIT) + "..." : reason;

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ maxWidth: 240, cursor: isLong ? "pointer" : "default" }}
        >
            <span className="break-words">{short}</span>
            {isLong && hover && (
                <div className="absolute left-0 bottom-full mb-1 z-50 px-3 py-2 rounded-lg shadow-lg bg-white text-black text-sm whitespace-pre-line min-w-[220px] max-w-[400px] break-words border border-gray-600"
                    style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}
                >
                    {reason}
                </div>
            )}
        </div>
    );
};

const PopupCloseButton: React.FC<{
    onClick: () => void,
    ariaLabel?: string,
    extraRef?: React.Ref<HTMLButtonElement>
}> = ({ onClick, ariaLabel = "Đóng", extraRef }) => (
    <button
        ref={extraRef}
        className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-white bg-transparent transition-all hover:bg-gray-800 focus:outline-none"
        style={{ fontSize: 24, lineHeight: 1, cursor: "pointer", border: "none" }}
        aria-label={ariaLabel}
        onClick={onClick}
        type="button"
    >
        <FontAwesomeIcon icon={faTimes} />
    </button>
);

const PopupBanButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        className="absolute top-2 right-14 w-10 h-10 flex items-center justify-center rounded-full text-red-500 bg-transparent transition-all hover:bg-gray-800 focus:outline-none"
        style={{ fontSize: 22, lineHeight: 1, cursor: "pointer", border: "none" }}
        aria-label="Ban user"
        onClick={onClick}
        type="button"
    >
        <FontAwesomeIcon icon={faBan} />
    </button>
);

const MessageTabs: React.FC<{
    tabs: { label: string; value: string }[];
    currentTab: string;
    onChange: (tabValue: string) => void;
}> = ({ tabs, currentTab, onChange }) => (
    <div className="flex border-b border-gray-700 mb-2">
        {tabs.map(tab => (
            <button
                key={tab.value}
                className={
                    `font-semibold px-4 py-2 focus:outline-none transition rounded-t-lg ` +
                    (currentTab === tab.value
                        ? "bg-[#242B4B] text-white border border-b-0 border-gray-700"
                        : "bg-transparent text-gray-200 hover:bg-gray-700/40")
                }
                type="button"
                onClick={() => onChange(tab.value)}
            >
                {tab.label}
            </button>
        ))}
    </div>
);

// === Ban Message Popup === (unchanged)
const MessageBanPopup: React.FC<{
    open: boolean,
    onClose: () => void,
    onConfirm: (banDays: number) => void,
    defaultBanDays?: number,
}> = ({
    open,
    onClose,
    onConfirm,
    defaultBanDays = 0,
}) => {
    const [banDays, setBanDays] = useState<number>(defaultBanDays);
    const [error, setError] = useState<string>("");

    React.useEffect(() => {
        if (open) {
            setBanDays(defaultBanDays);
            setError("");
        }
    }, [open, defaultBanDays]);

    return open ? (
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
                <PopupCloseButton onClick={onClose} ariaLabel="Đóng xác nhận ban" />
                <div className="mb-4 w-full flex items-center justify-between">
                    <div className="font-semibold text-lg text-white">
                        Cấm người dùng (tin nhắn)
                    </div>
                </div>
                <div className="text-[#ddd] text-center mb-4">
                    Nhập số ngày muốn cấm người dùng này <br />
                </div>
                <div className="w-full flex flex-col gap-3 mb-6">
                    <label htmlFor="ban-days-msg-popup" className="text-sm text-white font-semibold mb-1 text-left">
                        Số ngày cấm (0 = không đổi):
                    </label>
                    <input
                        id="ban-days-msg-popup"
                        type="number"
                        min={0}
                        autoFocus
                        className="w-full px-3 py-2 rounded border border-gray-600 bg-[#212124] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={banDays}
                        onChange={e => {
                            let v = parseInt(e.target.value, 10);
                            if (isNaN(v) || v < 0) v = 0;
                            setBanDays(v);
                            setError("");
                        }}
                        placeholder="Số ngày cấm (0 = không đổi)"
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                if (!/^\d+$/.test(String(banDays))) {
                                    setError("Vui lòng nhập số ngày hợp lệ");
                                    return;
                                }
                                onConfirm(banDays);
                            }
                        }}
                    />
                    {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
                </div>
                <div className="flex justify-end items-center w-full gap-3">
                    <button
                        className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                        style={{ minWidth: 80 }}
                        onClick={onClose}
                        type="button"
                    >Hủy</button>
                    <button
                        className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                        style={{ minWidth: 120 }}
                        onClick={() => {
                            if (!/^\d+$/.test(String(banDays))) {
                                setError("Vui lòng nhập số ngày hợp lệ");
                                return;
                            }
                            onConfirm(banDays);
                        }}
                        type="button"
                    >
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    ) : null;
};

// === User Report Detail Popup: extended with ban days input/alert ===
// Đã chỉnh sửa ảnh cover hiển thị là 448x168 px theo yêu cầu
const UserReportDetailPopup: React.FC<{
    open: boolean;
    onClose: () => void;
    userData: {
        userId: string;
        avatar?: string;
        avatarCroppedArea?: any;
        name: string;
        username?: string;
        coverPhoto?: string;
    };
    onBanSuccess?: (userId: string) => void;
}> = ({ open, onClose, userData, onBanSuccess }) => {
    const [check, setCheck] = useState<{ name: boolean; avatar: boolean; cover: boolean; username: boolean }>({ name: false, avatar: false, cover: false, username: false });
    const [banDays, setBanDays] = useState<string>("0");
    const [banError, setBanError] = useState<string>("");
    const [loading, setLoading] = useState(false);
    // NOTE: set coverImg to exactly 448x168px when displaying
    const coverImg = userData.coverPhoto || "/cover_demo_default.jpg";
    React.useEffect(() => {
        if (open) {
            setCheck({ name: false, avatar: false, cover: false, username: false });
            setBanDays("0");
            setBanError("");
        }
    }, [open]);
    // For accessibility: handle keyboard/label for checkbox
    return open ? (
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
                                checked={check.cover}
                                onChange={e => setCheck((c) => ({ ...c, cover: e.target.checked }))}
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
                                checked={check.avatar}
                                onChange={e => setCheck((c) => ({ ...c, avatar: e.target.checked }))}
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
                                checked={check.name}
                                onChange={e => setCheck((c) => ({ ...c, name: e.target.checked }))}
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
                                checked={!!check.username}
                                onChange={e => setCheck((c) => ({ ...c, username: e.target.checked }))}
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
                        className={`px-6 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer ${loading ? "opacity-60 pointer-events-none" : ""}`}
                        onClick={async () => {
                            if (!/^\d+$/.test(banDays)) {
                                setBanError("Vui lòng nhập số ngày hợp lệ");
                                return;
                            }
                            setBanError("");
                            setLoading(true);
                            try {
                                await apiBanUserDueToProfile(
                                    userData.userId,
                                    parseInt(banDays, 10),
                                    !!check.avatar,
                                    !!check.cover,
                                    !!check.name,
                                    !!check.username
                                );
                                if (onBanSuccess) onBanSuccess(userData.userId);
                                onClose();
                            } catch (err) {
                                setBanError(getErrorMessage(err));
                            } finally {
                                setLoading(false);
                            }
                        }}
                        type="button"
                        disabled={loading}
                    >
                        {loading ? "Đang xử lý..." : "Xóa và cấm"}
                    </button>
                </div>
            </div>
        </div>
    ) : null;
};

// ===== PATCHED: Room Delete Popup for group message reports =====
const GroupRoomRemovePopup: React.FC<{
    open: boolean;
    groupId?: string;
    onClose: () => void;
    onRemoved: (success: boolean) => void;
}> = ({ open, groupId, onClose, onRemoved }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const popupRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => { setError(""); }, [open]);
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-501"
            style={{ background: "rgba(40,40,40,0.82)", backdropFilter: "blur(1.5px)" }}
            onClick={onClose}
        >
            <div
                className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative"
                onClick={e => { e.stopPropagation(); }}
                ref={popupRef}
            >
                <PopupCloseButton onClick={onClose} ariaLabel="Đóng xác nhận hủy nhóm" />
                <div className="mb-4 w-full flex items-center justify-between">
                    <div className="font-semibold text-lg text-white">
                        Hủy nhóm chat này?
                    </div>
                </div>
                <div className="text-[#ddd] text-center mb-5">
                    Bạn có chắc chắn muốn hủy nhóm chat này không?<br />
                    <span className="text-orange-300 font-semibold break-words">{groupId}</span>
                </div>
                {error && (
                    <div className="text-red-400 text-xs mt-1 mb-2">{error}</div>
                )}
                <div className="flex justify-end items-center w-full gap-3">
                    <button
                        className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                        style={{ minWidth: 80 }}
                        onClick={onClose}
                        type="button"
                        disabled={loading}
                    >Hủy</button>
                    <button
                        className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                        style={{ minWidth: 120 }}
                        disabled={loading}
                        onClick={async () => {
                            if (!groupId) return;
                            setError(""); setLoading(true);
                            try {
                                const res = await apiRemoveRoomChat(groupId);
                                // Always log res
                                console.log("apiRemoveRoomChat result:", res);
                                if (res && res.success) {
                                    onRemoved(true);
                                } else {
                                    setError("Không thể hủy nhóm này.");
                                    onRemoved(false);
                                }
                            } catch (err) {
                                setError("Có lỗi khi kết nối máy chủ.");
                                onRemoved(false);
                                toast.warn(getErrorMessage(err));
                            } finally { setLoading(false); }
                        }}
                        type="button"
                    >
                        {loading ? "Đang hủy..." : "Xác nhận hủy nhóm"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Improved PopupMessages component (inject ban handler param)
const PopupMessages: React.FC<{
    info: {
        groupName?: string;
        groupAvatar?: string;
        groupId?: string;
        avatar?: string;
        name?: string;
        username?: string;
        userId?: string;
        conversationId?: string;
        type?: "user" | "group";
        allConvs?: { [convId: string]: string };
    } | null;
    messagePanels?: {
        [tabValue: string]: { label: string; messages: any[]; convId: string };
    };
    currentTabValue?: string;
    onTabChange?: (tabValue: string) => void;
    onClose: () => void;
    onBanClick?: () => void;
}> = ({
    info,
    messagePanels,
    currentTabValue,
    onTabChange,
    onClose,
    onBanClick,
}) => {
    const messageTabs = messagePanels
        ? Object.entries(messagePanels).map(([value, panel]) => ({
            label: panel.label,
            value,
        }))
        : [];
    const messages =
        messagePanels && currentTabValue && messagePanels[currentTabValue]
            ? messagePanels[currentTabValue].messages
            : [];
    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-500"
            style={{ background: "rgba(30,30,30,0.85)" }}
            onClick={onClose}
        >
            <div
                className="
                    bg-[#232325] 
                    rounded-2xl 
                    shadow-2xl 
                    border border-[#444]
                    flex flex-col 
                    max-w-full
                    relative
                "
                style={{
                    minWidth: 400,
                    width: "min(90vw, 500px)",
                    height: "min(92vh, 700px)",
                    minHeight: 700,
                    boxSizing: "border-box",
                }}
                onClick={e => e.stopPropagation()}
            >
                <PopupCloseButton onClick={onClose} />
                <PopupBanButton onClick={onBanClick || (() => { })} />
                <div className="flex flex-col items-center pt-8 pb-1 px-4 border-b border-gray-700">
                    {info?.type === "group" ? (
                        <>
                            <img
                                src={info?.groupAvatar || "/group_default.png"}
                                alt={info?.groupName}
                                className="rounded-full w-20 h-20 object-cover border border-gray-700 mb-3"
                            />
                            <div className="text-xl font-bold text-white mb-1">
                                {info?.groupName || "Nhóm Chat"}
                            </div>
                            {info?.groupId && (
                                <div className="text-gray-300 mb-2">
                                    ID nhóm: <span className="font-mono">{info.groupId}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <img
                                src={info?.avatar || "/user_default.png"}
                                alt={info?.name}
                                className="rounded-full w-20 h-20 object-cover border border-gray-700 mb-3"
                            />
                            <div className="text-xl font-bold text-white mb-1">
                                {info?.name || "Người dùng"}
                            </div>
                            {info?.username && (
                                <div className="text-gray-400 mb-2">
                                    @{info?.username}
                                </div>
                            )}
                        </>
                    )}
                </div>
                {messageTabs.length > 1 && (
                    <div className="pt-2 px-6">
                        <MessageTabs
                            tabs={messageTabs}
                            currentTab={currentTabValue || messageTabs[0].value}
                            onChange={onTabChange!}
                        />
                    </div>
                )}
                <div className="flex-1 w-full px-6 py-4 overflow-y-auto custom-scroll" style={{}}>
                    {messages && messages.length > 0 ? (
                        messages.map((msg, idx) => (
                            <div
                                key={msg.id || idx}
                                className="mb-4 p-3 rounded-lg"
                                style={{
                                    background: "#303034"
                                }}
                            >
                                <div className="text-xs text-gray-300 mb-1">
                                    {msg.createdAt
                                        ? new Date(msg.createdAt).toLocaleString("vi-VN", { hour12: false })
                                        : (msg.time || "")}
                                </div>
                                <div className="text-white">{msg.text || msg.message || msg.content || ""}</div>
                            </div>
                        ))
                    ) : (
                        <div className="text-gray-400 text-center mt-6">
                            Không có tin nhắn để hiển thị.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReportManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>("post");
    const [searchInput, setSearchInput] = useState<string>("");
    const [posts, setPosts] = useState<ReportedPost[]>([]);
    const [comments, setComments] = useState<ReportedComment[]>([]);
    const [userReports, setUserReports] = useState<UserReport[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showPostId, setShowPostId] = useState<string | null>(null);
    const [searchMessage, setSearchMessage] = useState<string>("");

    const [showBanPopup, setShowBanPopup] = useState<boolean>(false);
    const [banTarget, setBanTarget] = useState<ReportedComment | null>(null);
    const [banDays, setBanDays] = useState<string>("0");
    const [banError, setBanError] = useState<string>("");

    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{
        type: "post" | "comment" | "user" | "message";
        targetId: string;
        secondId?: string;
    } | null>(null);

    const [showUserReportPopup, setShowUserReportPopup] = useState(false);
    const [currentUserReport, setCurrentUserReport] = useState<UserReport | null>(null);

    const [banMsgPopupOpen, setBanMsgPopupOpen] = useState(false);
    const [banMsgTarget, setBanMsgTarget] = useState<{
        userId?: string;
        conversationId?: string; // ADD conversationId for group ban handling
        type?: "user" | "group";
    } | null>(null);

    const [messageReports, setMessageReports] = useState<MessageReport[]>([]);
    const [messageApiCalled, setMessageApiCalled] = useState(false);

    const [messageViewPopup, setMessageViewPopup] = useState<{
        info: any,
        messagePanels: {
            [tabValue: string]: {
                label: string;
                messages: any[];
                convId: string;
            };
        },
        currentTabValue: string;
    } | null>(null);

    // Patch: state for popup delete group room (for group chat "ban")
    const [showRemoveGroupPopup, setShowRemoveGroupPopup] = useState<{
        open: boolean;
        groupId?: string;
        reportId?: string;
    }>({ open: false, groupId: undefined, reportId: undefined });

    const router = useRouter();
    const deleteCloseBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setPosts([]);
        setComments([]);
        setUserReports([]);
        setSearchInput("");
        setSearchMessage("");
        setShowPostId(null);
        setShowBanPopup(false);
        setBanTarget(null);
        setBanDays("0");
        setBanError("");
        setShowDeletePopup(false);
        setDeleteTarget(null);
        setShowUserReportPopup(false);
        setCurrentUserReport(null);
        setBanMsgPopupOpen(false);
        setBanMsgTarget(null);
        setShowRemoveGroupPopup({ open: false, groupId: undefined, reportId: undefined });

        setMessageReports([]);
        setMessageApiCalled(false);
        setMessageViewPopup(null);

        if (activeTab === "post") {
            setLoading(true);
            apiLoadReportPost()
                .then((res: any) => {
                    setPosts(res?.reportedPosts || []);
                })
                .catch((err) => {
                    setPosts([]);
                    setSearchMessage("");
                    toast.warn(getErrorMessage(err));
                })
                .finally(() => setLoading(false));
        } else if (activeTab === "comment") {
            setLoading(true);
            apiLoadReportComment()
                .then((res: any) => {
                    setComments(res?.reportedComments || []);
                })
                .catch((err) => {
                    setComments([]);
                    setSearchMessage("");
                    toast.warn(getErrorMessage(err));
                })
                .finally(() => setLoading(false));
        } else if (activeTab === "user") {
            setLoading(true);
            apiLoadUserReport()
                .then((res: any) => {
                    // console.log(res)
                    setUserReports(res?.reports || []);
                })
                .catch((err) => {
                    setUserReports([]);
                    toast.warn(getErrorMessage(err));
                })
                .finally(() => setLoading(false));
        } else if (activeTab === "message") {
            setLoading(true);
            apiLoadReportMessage()
                .then((res: any) => {
                    setMessageApiCalled(true);
                    setMessageReports(res?.reports || []);
                })
                .catch((err) => {
                    setMessageApiCalled(true);
                    setMessageReports([]);
                    toast.warn(getErrorMessage(err));
                })
                .finally(() => setLoading(false));
        } else {
            setPosts([]);
            setComments([]);
            setUserReports([]);
            setLoading(false);
            setMessageReports([]);
            setMessageApiCalled(false);
        }
    }, [activeTab]);

    // Helper functions for delete popup logic
    const openDeletePopup = (params: { type: "post" | "comment" | "user" | "message", targetId: string, secondId?: string }) => {
        setDeleteTarget(params);
        setShowDeletePopup(true);
        setTimeout(() => deleteCloseBtnRef.current?.focus(), 100);
    };
    const closeDeletePopup = () => {
        setShowDeletePopup(false);
        setTimeout(() => setDeleteTarget(null), 200);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === "post") {
                await handleRemovePost(deleteTarget.targetId);
            } else if (deleteTarget.type === "comment") {
                await handleDeleteCommentReport(deleteTarget.targetId);
            } else if (deleteTarget.type === "user" && deleteTarget.secondId) {
                await handleDeleteUserReport(deleteTarget.targetId, deleteTarget.secondId);
            } else if (deleteTarget.type === "message") {
                const res = await apiDeleteReport(deleteTarget.targetId);
                if (res && res.success) {
                    setMessageReports((prev) => prev.filter((r) => r._id !== deleteTarget.targetId));
                }
            }
        } catch (err) {
            toast.warn(getErrorMessage(err));
        }
        closeDeletePopup();
    };

    const handleDeleteMessageReport = async (reportId: string) => {
        setMessageReports((prev) => prev.filter((r) => r._id !== reportId));
    };

    const handleSearchClick = async () => {
        setLoading(true);
        if (activeTab === "post") {
            try {
                const res = await apiSearchReportPost(searchInput);
                setPosts(res?.reportedPosts || []);
            } catch (err) {
                setPosts([]);
                setSearchMessage("");
                toast.warn(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        } else {
            setPosts([]);
            setComments([]);
            setLoading(false);
        }
    };

    const sortedPosts = posts
        .slice()
        .sort((a, b) => (b.reportCount ?? 1) - (a.reportCount ?? 1));

    const sortedComments = comments
        .slice()
        .sort((a, b) => (b.reportCount ?? 1) - (a.reportCount ?? 1));

    const sortedUserReports = userReports
        .slice()
        .sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    const sortedMessageReports = messageReports
        .slice()
        .sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    const handleRemovePost = async (reportId: string) => {
        const target = posts.find(r => r._id === reportId);
        if (!target) return;
        setLoading(true);
        try {
            const res = await apiRemovePostReport(target.postId);
            if (res && res.success) {
                setPosts((prev) => prev.filter((r) => r._id !== reportId));
            }
        } catch (error) {
            toast.warn(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCommentReport = async (commentId: string) => {
        const target = comments.find(c => c._id === commentId);
        if (!target) return;
        setLoading(true);
        try {
            const res = await apiRemoveCommentReport(target.commentId);
            if (res && res.success) {
                setComments((prev) => prev.filter((c) => c._id !== commentId));
            }
        } catch (error) {
            toast.warn(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const handleShowBanPopup = (comment: ReportedComment) => {
        setBanTarget(comment);
        setBanDays("0");
        setBanError("");
        setShowBanPopup(true);
    };

    const handleConfirmBan = async () => {
        if (!/^\d+$/.test(banDays)) {
            setBanError("Vui lòng nhập số ngày hợp lệ (0 hoặc lớn hơn).");
            return;
        }
        if (!banTarget) return;
        setShowBanPopup(false);
        try {
            const res = await apiBanUserAndRemoveComment(
                banTarget.commentId,
                Number(banDays),
                banTarget.userId || ""
            );
            if (res && res.success) {
                setComments((prev) => prev.filter((c) => c.userId !== banTarget.userId));
                setBanTarget(null);
                setBanDays("0");
                setBanError("");
            }
        } catch (error) {
            setBanError("Có lỗi xảy ra khi thực hiện hành động.");
            toast.warn(getErrorMessage(error));
        }
    };

    const handleViewPost = (postId: string) => {
        setShowPostId(postId);
    };
    const handleCloseShowPost = () => {
        setShowPostId(null);
    };

    // --- PATCHED handlePosterClick: truyền cover với getCloudinaryCoverLink khi xem user tab
    const handlePosterClick = async (
        userId: string | undefined | null,
        info?: any,
        report?: MessageReport
    ) => {
        if (!userId) return;

        // Tab "user" (báo cáo người dùng): show user popup, truyền cover xử lý theo yêu cầu
        if (activeTab === "user") {
            // Determine cover URL (use getCloudinaryCoverLink if cover present)
            let coverPhoto: string | undefined;
            if (info?.cover) {
                coverPhoto = getCloudinaryCoverLink(info.cover, info.coverCroppedArea, 448, 168);
            } else {
                coverPhoto = "/cover_demo_default.jpg";
            }

            setCurrentUserReport({
                ...info,
                userId: userId,
                avatar: info?.avatar,
                avatarCroppedArea: info?.avatarCroppedArea,
                name: info?.name,
                username: info?.username,
                cover: info?.cover,
                coverCroppedArea: info?.coverCroppedArea,
                coverPhoto: coverPhoto
            });
            setShowUserReportPopup(true);
            return;
        }

        // Message tab handler, unchanged
        let panels: {
            [tabValue: string]: {
                label: string;
                messages: any[];
                convId: string;
            };
        } = {};
        let defaultTabValue = "";

        try {
            const conversationId = report?.conversationId || info?.conversationId || info?.groupId || info?.userId || userId;
            const reportTime = report?.createdAt || info?.createdAt;
            let res = await apoLoadReportedMessage(conversationId, reportTime, userId);

            if (res && Array.isArray(res.messages)) {
                const noMessages =
                    !res.messages || !Array.isArray(res.messages) || res.messages.length === 0;

                if (noMessages) {
                    panels = {
                        main: {
                            label: "Với người báo cáo",
                            messages: [],
                            convId: conversationId,
                        }
                    };
                    defaultTabValue = "main";
                } else {
                    const byConv: { [convId: string]: any[] } = {};
                    let currentConvId: string = conversationId;
                    res.messages.forEach((msg: any) => {
                        const cid = msg.conversationId || currentConvId || "default";
                        if (!byConv[cid]) byConv[cid] = [];
                        byConv[cid].push(msg);
                    });

                    let mainConvId = conversationId;
                    let reportedMsgs: any[] = [];
                    let otherMsgs: any[] = [];
                    const reporterId =
                        typeof report?.reporter === "string"
                            ? report?.reporter
                            : (info?.reporter ? info.reporter : null);

                    Object.entries(byConv).forEach(([convId, msgs]) => {
                        const mainMsgs: any[] = [];
                        const others: any[] = [];
                        if (convId === mainConvId) {
                            if (reporterId) {
                                msgs.forEach(msg => {
                                    if (
                                        (msg.from === userId && msg.to === reporterId) ||
                                        (msg.from === reporterId && msg.to === userId)
                                    ) {
                                        mainMsgs.push(msg);
                                    } else {
                                        if (msg.from !== reporterId && msg.to !== reporterId) {
                                            others.push(msg);
                                        }
                                    }
                                });
                            } else {
                                mainMsgs.push(...msgs);
                            }
                        } else {
                            if (reporterId) {
                                msgs.forEach(msg => {
                                    if (msg.from !== reporterId && msg.to !== reporterId) {
                                        others.push(msg);
                                    }
                                });
                            } else {
                                others.push(...msgs);
                            }
                        }

                        reportedMsgs.push(...mainMsgs);

                        if (convId !== mainConvId) {
                            otherMsgs.push(...others);
                        }
                    });

                    if (reportedMsgs.length === 0 && byConv[mainConvId]) {
                        reportedMsgs.push(...byConv[mainConvId]);
                    }

                    panels = {};
                    if (reportedMsgs.length > 0) {
                        panels["main"] = {
                            label: "Với người báo cáo",
                            messages: reportedMsgs,
                            convId: mainConvId,
                        };
                        defaultTabValue = "main";
                    }
                    if (otherMsgs.length > 0) {
                        panels["others"] = {
                            label: "Những tin nhắn khác",
                            messages: otherMsgs,
                            convId: "others",
                        };
                        if (!defaultTabValue) defaultTabValue = "others";
                    }
                    if (Object.keys(panels).length === 1) {
                        defaultTabValue = Object.keys(panels)[0];
                    }
                }
            } else {
                panels = {
                    main: {
                        label: "Với người báo cáo",
                        messages: [],
                        convId: conversationId,
                    }
                };
                defaultTabValue = "main";
            }
        } catch (e) {
            panels = {
                main: {
                    label: "Với người báo cáo",
                    messages: [],
                    convId: (report?.conversationId || info?.conversationId || info?.userId || userId)
                }
            };
            defaultTabValue = "main";
            toast.warn(getErrorMessage(e));
        }

        setMessageViewPopup({
            info: info || {
                avatar: info?.avatar,
                name: info?.name,
                username: info?.username,
                userId: userId,
                type: "user",
            },
            messagePanels: panels,
            currentTabValue: defaultTabValue
        });
    };

    const handleViewGroup = async (
        groupName?: string,
        groupAvatar?: string,
        groupId?: string,
        conversationId?: string,
        report?: MessageReport
    ) => {
        let panel: any = {};
        let defaultTabValue: string = "main";
        try {
            const convId = conversationId || groupId;
            const reportTime = report?.createdAt;
            let res;
            let msgs: any[] = [];
            if (typeof convId === "string" && reportTime !== undefined) {
                res = await apoLoadReportedMessage(convId, reportTime);
                if (res && Array.isArray(res.messages) && res.messages.length > 0) {
                    msgs = res.messages;
                } else {
                    msgs = [];
                }
            } else {
                msgs = [];
            }
            panel = {
                main: {
                    label: "Chi tiết tin nhắn",
                    messages: msgs,
                    convId: convId
                }
            };
            defaultTabValue = "main";
        } catch (e) {
            panel = {
                main: {
                    label: "Chi tiết tin nhắn",
                    messages: [],
                    convId: groupId || conversationId
                }
            };
            defaultTabValue = "main";
            toast.warn(getErrorMessage(e));
        }
        setMessageViewPopup({
            info: {
                groupName,
                groupAvatar,
                groupId: conversationId || groupId,
                type: "group",
                conversationId: conversationId || groupId,
                _reportId: report?._id
            },
            messagePanels: panel,
            currentTabValue: defaultTabValue
        });
    };

    // Update: remove all user reports with this userId after banning
    const handleUserReportBanSuccess = (userId: string) => {
        setUserReports((prev) => prev.filter((u) => u.userId !== userId));
    };

    const handleDeleteUserReport = async (userReportId: string, userId?: string) => {
        if (activeTab === "user") {
            try {
                await apiDeleteReport(userReportId);
            } catch (err) {
                toast.warn(getErrorMessage(err));
            }
        }
        setUserReports((prev) => prev.filter((u) => u._id !== userReportId));
    };

    const closeMessageViewPopup = () => setMessageViewPopup(null);

    const handlePopupTabChange = (tabValue: string) => {
        setMessageViewPopup((prev) =>
            prev
                ? {
                    ...prev,
                    currentTabValue: tabValue,
                }
                : prev
        );
    };

    // PATCHED ban handler for popup: handle ban user OR group
    // Now: group => show group remove popup
    const handlePopupBan = () => {
        if (!messageViewPopup) return;
        if (messageViewPopup.info?.type === "user") {
            setBanMsgTarget({
                userId: messageViewPopup.info.userId,
                conversationId: undefined,
                type: "user",
            });
            setBanMsgPopupOpen(true);
        } else if (
            messageViewPopup.info?.type === "group" &&
            messageViewPopup.info?.groupId
        ) {
            let reportId: string | undefined = messageViewPopup.info._reportId;
            if (!reportId && typeof messageViewPopup.info.groupId === "string") {
                const found = messageReports.find(r =>
                    r.conversationId === messageViewPopup.info.groupId
                );
                reportId = found?._id;
            }
            // Cập nhật banMsgTarget luôn conversationId và type, đồng thời showRemoveGroupPopup như cũ
            setBanMsgTarget({
                userId: undefined,
                conversationId: messageViewPopup.info.groupId,
                type: "group"
            });
            setShowRemoveGroupPopup({
                open: true,
                groupId: messageViewPopup.info.groupId,
                reportId
            });
        }
    };

    // PATCHED: Ban user due to message: after res.success, close popup & remove all reports for userId OR, if group, all for conversationId
    const onConfirmBanMsgPopup = async (banDays: number) => {
        setBanMsgPopupOpen(false);

        // Save current popup info to help determine context
        const { userId, conversationId, type } = banMsgTarget || {};
        if (!userId && !conversationId) return;

        try {
            // Call API always with userId (ban user for message), not for group
            if (userId) {
                const res = await apiBanUserDueToMessage(userId, banDays);
                if (res && res.success) {
                    // Remove ALL MESSAGE REPORTS with this user id
                    setMessageReports(prev =>
                        prev.filter(r =>
                            // xóa báo cáo về userId này (các báo cáo của user)
                            r.userId !== userId
                        )
                    );
                    setMessageViewPopup(null);
                }
            }
            // Nếu đang ban một "group" thì remove theo conversationId (thường sẽ ban group qua popup xóa group, không ở đây)
            else if (type === "group" && conversationId) {
                // Remove ALL MESSAGE REPORTS with this conversation id (group)
                setMessageReports(prev =>
                    prev.filter(r =>
                        r.conversationId !== conversationId
                    )
                );
                setMessageViewPopup(null);
            }
        } catch (error) {
            console.error("Error banning user due to message:", error);
            toast.warn(getErrorMessage(error));
        }
    };

    // PATCHED: Callback for confirm remove group chat
    const handleConfirmRemoveGroupChat = async (success: boolean) => {
        if (
            success &&
            showRemoveGroupPopup.open &&
            showRemoveGroupPopup.reportId
        ) {
            // Remove all reports for this groupId (all message reports linked by conversationId)
            if (showRemoveGroupPopup.groupId) {
                setMessageReports(prev =>
                    prev.filter(r => r.conversationId !== showRemoveGroupPopup.groupId)
                );
            } else {
                setMessageReports(prev =>
                    prev.filter(r => r._id !== showRemoveGroupPopup.reportId)
                );
            }
            setMessageViewPopup(null);
        }
        setShowRemoveGroupPopup({ open: false, groupId: undefined, reportId: undefined });
    };

    const handleUserReportPopupClose = () => {
        setShowUserReportPopup(false);
        setCurrentUserReport(null);
    };

    function formatISODateTime(dt: string) {
        if (!dt) return "";
        const d = new Date(dt);
        return d.toLocaleString("vi-VN", { hour12: false });
    }

    // --------- PATCHED: User avatar/name route-to-profile --------
    // Hiển thị avatar, tên cho đối tượng tin nhắn: user hoặc nhóm
    const MessageReportedUserCell: React.FC<{ report: MessageReport, onViewGroup?: (groupName?: string, groupAvatar?: string, groupId?: string, conversationId?: string, report?: MessageReport) => void }> = ({ report, onViewGroup }) => {
        const router = useRouter();
        if (report.reportedUser) {
            return (
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        title="Đi tới trang cá nhân người dùng"
                        onClick={() => {
                            if (report.userId) router.push(`/profile/${report.userId}`);
                        }}
                    >
                        <img
                            src={
                                report.avatar
                                    ? getCloudinaryImageLink(
                                        report.avatar,
                                        report.avatarCroppedArea,
                                        36
                                    )
                                    : "/user_default.png"
                            }
                            alt={report.name || ""}
                            className="rounded-full w-9 h-9 object-cover border border-gray-700"
                        />
                        <div>
                            <div className="text-white font-semibold">{report.name}</div>
                            <div className="text-gray-400 text-xs">
                                @{report.username}
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex items-center gap-3 cursor-pointer"
                    onClick={() => onViewGroup?.(
                        report.groupName,
                        report.groupAvatar,
                        report.conversationId,
                        report.conversationId,
                        report
                    )}
                >
                    <img
                        src={report.groupAvatar || report.avatar || "/group_default.png"}
                        alt={report.groupName || "Nhóm"}
                        className="rounded-full w-9 h-9 object-cover border border-gray-700"
                    />
                    <div>
                        <div className="text-white font-semibold">
                            {report.groupName || "Tin nhắn nhóm"}
                        </div>
                        <div className="text-gray-400 text-xs">
                            {report.conversationId && (
                                <span>#{report.conversationId}</span>
                            )}
                        </div>

                    </div>
                </div>
            );
        }
    };

    return (
        <div className="w-full">
            {showRemoveGroupPopup.open && (
                <GroupRoomRemovePopup
                    open={showRemoveGroupPopup.open}
                    groupId={showRemoveGroupPopup.groupId}
                    onClose={() => setShowRemoveGroupPopup({ open: false, groupId: undefined, reportId: undefined })}
                    onRemoved={handleConfirmRemoveGroupChat}
                />
            )}
            {showDeletePopup && deleteTarget && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-300"
                    style={{
                        background: "rgba(0,0,0,0.65)"
                    }}
                    onClick={closeDeletePopup}
                >
                    <div
                        className="bg-[#18181b] border border-[#353535] rounded-xl shadow-xl p-6 w-full max-w-xs relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PopupCloseButton
                            extraRef={deleteCloseBtnRef}
                            onClick={closeDeletePopup}
                            ariaLabel="Đóng xác nhận xóa"
                        />
                        <div className="mb-4 text-lg font-bold text-white text-center">
                            Xác nhận xóa báo cáo
                        </div>
                        <div className="mb-2 text-white text-sm text-center">
                            Bạn có chắc chắn muốn xóa báo cáo này không?
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="px-3 cursor-pointer py-1 rounded bg-[#39393e] text-white font-semibold hover:bg-[#22222c]"
                                onClick={closeDeletePopup}
                            >
                                Hủy
                            </button>
                            <button
                                className="px-4 py-1 rounded bg-red-700 text-red-200 hover:bg-red-800 font-semibold"
                                onClick={handleDeleteConfirm}
                                style={{ cursor: "pointer" }}
                            >
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {messageViewPopup && (
                <PopupMessages
                    info={messageViewPopup.info}
                    messagePanels={messageViewPopup.messagePanels}
                    currentTabValue={messageViewPopup.currentTabValue}
                    onTabChange={handlePopupTabChange}
                    onClose={closeMessageViewPopup}
                    onBanClick={handlePopupBan}
                />
            )}
            <MessageBanPopup
                open={banMsgPopupOpen}
                onClose={() => setBanMsgPopupOpen(false)}
                onConfirm={onConfirmBanMsgPopup}
            />
            <UserReportDetailPopup
                open={showUserReportPopup && !!currentUserReport}
                onClose={handleUserReportPopupClose}
                userData={{
                    userId: currentUserReport?.userId ?? "",
                    avatar: currentUserReport?.avatar,
                    avatarCroppedArea: currentUserReport?.avatarCroppedArea,
                    name: currentUserReport?.name ?? "",
                    username: currentUserReport?.username ?? "",
                    coverPhoto: currentUserReport?.coverPhoto
                }}
                onBanSuccess={handleUserReportBanSuccess}
            />
            <div className="mb-4 flex gap-2 flex-wrap">
                {REPORT_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        className={`
                            px-4 py-2 rounded font-bold transition cursor-pointer
                            ${activeTab === tab.key
                                ? "bg-blue-700 text-white shadow"
                                : "bg-[#232324] text-gray-200 hover:bg-blue-900"}
                        `}
                        onClick={() => setActiveTab(tab.key)}
                        type="button"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-white">
                    {REPORT_TABS.find((tab) => tab.key === activeTab)?.label ?? ""}
                </h2>
                {activeTab === "post" && (
                    <div className="flex w-full md:w-auto gap-2">
                        <input
                            type="text"
                            className="flex-1 px-4 py-2 rounded-lg border border-[#353535] bg-[#232324] text-white focus:outline-none md:w-80"
                            placeholder="Tìm kiếm theo bài viết hoặc người dùng"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearchClick();
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleSearchClick}
                            className="w-10 h-10 bg-blue-700 hover:bg-blue-800 rounded-full text-white font-semibold transition flex items-center justify-center cursor-pointer"
                            title="Tìm kiếm"
                        >
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </button>
                    </div>
                )}
            </div>
            {searchMessage && (
                <div className="mb-4 px-2 py-2 rounded bg-gray-700 text-white text-sm">
                    {searchMessage}
                </div>
            )}
            {showPostId && (
                <ShowPostById
                    postId={showPostId}
                    isShow={!!showPostId}
                    onClose={handleCloseShowPost}
                />
            )}
            {showBanPopup && banTarget && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-300"
                    style={{
                        background: "rgba(30,30,30,0.82)",
                        backdropFilter: "blur(1.5px)"
                    }}
                >
                    <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative">
                        <PopupCloseButton onClick={() => setShowBanPopup(false)} ariaLabel="Đóng xác nhận ban" />
                        <div className="mb-4 w-full flex items-center justify-between">
                            <div className="font-semibold text-lg text-white">
                                Xóa bình luận &amp; cấm người dùng
                            </div>
                        </div>
                        <div className="text-[#ddd] text-center mb-4">
                            Bạn có chắc chắn muốn xóa bình luận này và cấm người dùng? <br />
                        </div>
                        <div className="w-full flex flex-col gap-3 mb-6">
                            <label htmlFor="ban-days" className="text-sm text-white font-semibold mb-1 text-left">Nhập số ngày cấm(0 là không đổi):</label>
                            <input
                                id="ban-days"
                                type="text"
                                pattern="[0-9]*"
                                inputMode="numeric"
                                autoFocus
                                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#212124] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={banDays}
                                onChange={e => {
                                    const v = e.target.value.replace(/[^0-9]/g, "");
                                    setBanDays(v);
                                    setBanError("");
                                }}
                                placeholder="Số ngày cấm (0 = không đổi)"
                            />
                            {banError && (
                                <div className="text-red-400 text-xs mt-1">{banError}</div>
                            )}
                        </div>
                        <div className="flex justify-end items-center w-full gap-3">
                            <button
                                className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                style={{ minWidth: 80 }}
                                onClick={() => setShowBanPopup(false)}
                                type="button"
                            >Hủy</button>
                            <button
                                className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                                style={{ minWidth: 120 }}
                                onClick={handleConfirmBan}
                                type="button"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === "post" ? (
                <div className="overflow-x-auto rounded-lg shadow">
                    <div className="max-h-[51vh] min-h-[51vh] overflow-y-auto custom-scroll">
                        <table className="min-w-full bg-[#232324] text-white border-separate" style={{ borderSpacing: 0 }}>
                            <thead>
                                <tr className="border-b border-[#353535] text-left">
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Bài viết</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Người đăng</th>
                                    <th className="py-3 px-3 text-center sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Report count</th>
                                    <th className="py-3 px-3 text-center sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : sortedPosts.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Không có báo cáo nào.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedPosts.map((report) => (
                                        <tr key={report._id} className="border-b border-[#353535] hover:bg-[#282829] transition">
                                            <td className="py-3 px-3">
                                                <div className="">
                                                    {report.text && report.text.length > 20
                                                        ? report.text.slice(0, 20) + "..."
                                                        : report.text}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 flex items-center gap-3">
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer"
                                                    onClick={() => {
                                                        if (report.userId) router.push(`/profile/${report.userId}`);
                                                    }}
                                                    title="Đi tới trang cá nhân người đăng"
                                                >
                                                    <img
                                                        src={
                                                            report.avatar
                                                                ? getCloudinaryImageLink(
                                                                    report.avatar,
                                                                    report.avatarCroppedArea,
                                                                    36
                                                                )
                                                                : "/user_default.png"
                                                        }
                                                        alt={report.name}
                                                        className="rounded-full w-9 h-9 object-cover border border-gray-700"
                                                    />
                                                    <div>
                                                        <div className="text-white">
                                                            {report.name}
                                                        </div>
                                                        <div className="text-gray-400 text-xs">
                                                            @{report.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-orange-300">
                                                {report.reportCount || 1}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="px-2 py-1 bg-blue-800 hover:bg-blue-700 rounded text-md font-bold text-blue-200 cursor-pointer"
                                                        onClick={() => handleViewPost(report.postId)}
                                                    >
                                                        Xem bài viết
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-md font-bold text-red-200 cursor-pointer"
                                                        onClick={() =>
                                                            openDeletePopup({ type: "post", targetId: report._id })
                                                        }
                                                    >
                                                        Xoá báo cáo
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === "comment" ? (
                <div className="overflow-x-auto rounded-lg shadow">
                    <div className="max-h-[51vh] min-h-[51vh] overflow-y-auto custom-scroll">
                        <table className="min-w-full bg-[#232324] text-white border-separate" style={{ borderSpacing: 0 }}>
                            <thead>
                                <tr className="border-b border-[#353535] text-left">
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Người dùng</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Nội dung</th>
                                    <th className="py-3 px-3 text-center sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Report count</th>
                                    <th className="py-3 px-3 text-center sticky top-0 z-10 bg-[#232324] border-b border-[#353535] min-w-[200px]">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : sortedComments.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Không có báo cáo nào.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedComments.map((comment) => (
                                        <tr key={comment._id} className="border-b border-[#353535] hover:bg-[#282829] transition">
                                            <td className="py-3 px-3 flex items-center gap-3">
                                                <div
                                                    className="cursor-pointer flex items-center gap-3"
                                                    onClick={() => {
                                                        if (comment.userId) router.push(`/profile/${comment.userId}`);
                                                    }}
                                                    title="Đi tới trang cá nhân người dùng"
                                                >
                                                    <img
                                                        src={
                                                            comment.avatar
                                                                ? getCloudinaryImageLink(
                                                                    comment.avatar,
                                                                    comment.avatarCroppedArea,
                                                                    36
                                                                )
                                                                : "/user_default.png"
                                                        }
                                                        alt={comment.name}
                                                        className="rounded-full w-9 h-9 object-cover border border-gray-700"
                                                    />
                                                    <div>
                                                        <div className="text-white">
                                                            {comment.name}
                                                        </div>
                                                        <div className="text-gray-400 text-xs">
                                                            @{comment.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="font-semibold">
                                                    <CommentContentWithPopup text={comment.text} />
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-orange-300">
                                                {comment.reportCount || 1}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="px-2 py-1 bg-blue-800 hover:bg-blue-700 rounded text-md font-bold text-blue-200 cursor-pointer"
                                                        onClick={() => handleViewPost(comment.postId || "")}
                                                        disabled={!comment.postId}
                                                    >
                                                        Xem bài viết
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 bg-yellow-700 hover:bg-yellow-800 rounded text-md font-bold text-yellow-100 cursor-pointer"
                                                        onClick={() => handleShowBanPopup(comment)}
                                                        disabled={comment.status === "removed"}
                                                    >
                                                        Xử lý
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-md font-bold text-red-200 cursor-pointer"
                                                        onClick={() =>
                                                            openDeletePopup({ type: "comment", targetId: comment._id })
                                                        }
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === "user" ? (
                <div className="overflow-x-auto rounded-lg shadow">
                    <div className="max-h-[51vh] min-h-[51vh] overflow-y-auto custom-scroll">
                        <table className="min-w-full bg-[#232324] text-white border-separate" style={{ borderSpacing: 0 }}>
                            <thead>
                                <tr className="border-b border-[#353535] text-left">
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Người bị báo cáo</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Lý do</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Thời gian</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535] min-w-[200px]">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : sortedUserReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Không có báo cáo nào.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedUserReports.map((user) => (
                                        <tr key={user._id} className="border-b border-[#353535] hover:bg-[#282829] transition">
                                            <td className="py-3 px-3 flex items-center gap-3">
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer"
                                                    onClick={() => {
                                                        if (user.userId) router.push(`/profile/${user.userId}`);
                                                    }}
                                                    title="Đi tới trang cá nhân người dùng"
                                                >
                                                    <img
                                                        src={
                                                            user.avatar
                                                                ? getCloudinaryImageLink(
                                                                    user.avatar,
                                                                    user.avatarCroppedArea,
                                                                    36
                                                                )
                                                                : "/user_default.png"
                                                        }
                                                        alt={user.name}
                                                        className="rounded-full w-9 h-9 object-cover border border-gray-700"
                                                    />
                                                    <div>
                                                        <div className="text-white font-semibold">{user.name}</div>
                                                        <div className="text-gray-400 text-xs">
                                                            @{user.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 whitespace-pre-line">
                                                <ReasonCellWithPopup reason={user.reason || ""} />
                                            </td>
                                            <td className="py-3 px-3 text-sm text-gray-300">{formatISODateTime(user.createdAt)}</td>
                                            <td className="py-3 px-3">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-md font-bold text-blue-100 cursor-pointer"
                                                        onClick={() =>
                                                            handlePosterClick(user.userId, {
                                                                avatar: user.avatar,
                                                                avatarCroppedArea: user.avatarCroppedArea,
                                                                name: user.name,
                                                                username: user.username,
                                                                userId: user.userId,
                                                                type: "user",
                                                                cover: user.cover,
                                                                coverCroppedArea: user.coverCroppedArea
                                                            })
                                                        }
                                                    >
                                                        Xem
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-md font-bold text-red-200 cursor-pointer"
                                                        onClick={() =>
                                                            openDeletePopup({
                                                                type: "user",
                                                                targetId: user._id,
                                                                secondId: user.userId
                                                            })
                                                        }
                                                    >
                                                        Xóa báo cáo
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === "message" ? (
                <div className="overflow-x-auto rounded-lg shadow">
                    <div className="max-h-[51vh] min-h-[51vh] overflow-y-auto custom-scroll">
                        <table className="min-w-full bg-[#232324] text-white border-separate" style={{ borderSpacing: 0 }}>
                            <thead>
                                <tr className="border-b border-[#353535] text-left">
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Đối tượng</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Loại</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535]">Thời gian</th>
                                    <th className="py-3 px-3 sticky top-0 z-10 bg-[#232324] border-b border-[#353535] min-w-[160px] text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : sortedMessageReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            Không có báo cáo nào.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedMessageReports.map((report) => (
                                        <tr key={report._id} className="border-b border-[#353535] hover:bg-[#282829] transition">
                                            <td className="py-3 px-3">
                                                <MessageReportedUserCell
                                                    report={report}
                                                    onViewGroup={handleViewGroup}
                                                />
                                            </td>
                                            <td className="py-3 px-3">
                                                {report.type === "message"
                                                    ? (report.reportedUser ? "Người dùng" : "Tin nhắn nhóm")
                                                    : (report.type || "Không xác định")}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-gray-300">
                                                {formatISODateTime(report.createdAt)}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    {report.reportedUser ? (
                                                        <button
                                                            className="px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-md font-bold text-white cursor-pointer flex items-center"
                                                            onClick={() =>
                                                                handlePosterClick(report.userId, {
                                                                    avatar: report.avatar,
                                                                    avatarCroppedArea: report.avatarCroppedArea,
                                                                    name: report.name,
                                                                    username: report.username,
                                                                    userId: report.userId,
                                                                    conversationId: report.conversationId,
                                                                    createdAt: report.createdAt,
                                                                    reporter: report.reporter,
                                                                    type: "user",
                                                                    cover: report.cover,
                                                                    coverCroppedArea: report.coverCroppedArea
                                                                }, report)
                                                            }
                                                        >
                                                            Xem
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-md font-bold text-white cursor-pointer flex items-center"
                                                            onClick={() =>
                                                                handleViewGroup(report.groupName, report.groupAvatar, report.conversationId, report.conversationId, report)
                                                            }
                                                        >
                                                            Xem
                                                        </button>
                                                    )}
                                                    <button
                                                        className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-md font-bold text-white cursor-pointer flex items-center"
                                                        onClick={() => openDeletePopup({ type: "message", targetId: report._id })}
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="w-full min-h-[200px] flex items-center justify-center text-gray-400 bg-[#232324] rounded-lg shadow py-10">
                    <span>
                        {(() => {
                            switch (activeTab) {
                                case "message":
                                    return "Chức năng quản lý báo cáo tin nhắn sẽ sớm khả dụng.";
                                case "user":
                                    return "Chức năng quản lý báo cáo người dùng sẽ sớm khả dụng.";
                                default:
                                    return "Chức năng này sẽ sớm khả dụng.";
                            }
                        })()}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ReportManagement;
