"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authLogout } from "@/services/auth";
import { useDispatch, useSelector } from "react-redux";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { getMessageList, getOneMessageListbyConversationId } from "@/api/conversation.api";
import { useChatDock } from "@/app/providers/ChatDockProvider";
import CreateGroupButton from "../ui/CreateGroupButton";
import { useChatSocket } from "@/socket/useChatSocket";
import { useMessagePriority } from "@/context/messagePriority/useMessagePriority";

// FontAwesome icons for reactions
import {
    faThumbsUp,
    faHeart,
    faFaceLaugh,
    faFaceSadCry,
    faFaceAngry,
    faShare,
    faComment,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Reaction icon map
const reactTypeToFAIcon = {
    like: faThumbsUp,
    love: faHeart,
    fun: faFaceLaugh,
    sad: faFaceSadCry,
    angry: faFaceAngry,
    default: faThumbsUp,
};

// Custom hook to detect screen size
function useScreenBelow900() {
    const [isBelow900, setIsBelow900] = useState(
        typeof window !== "undefined" ? window.innerWidth < 900 : false
    );
    useEffect(() => {
        const handleResize = () => setIsBelow900(window.innerWidth < 900);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isBelow900;
}

// Hàm hiển thị thời gian "xx giờ/ngày/tuần/tháng/năm trước"
function getTimeAgoVN(dateInput: string | Date): string {
    let date: Date;
    if (!dateInput) return "";
    try {
        date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
        if (isNaN(date.getTime())) return "";
    } catch {
        return "";
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) return "Vừa xong"; // Tương lai

    const diffSecond = Math.floor(diffMs / 1000);
    if (diffSecond < 60) return "Vừa xong";
    const diffMinute = Math.floor(diffSecond / 60);
    if (diffMinute < 60) return `${diffMinute} phút trước`;
    const diffHour = Math.floor(diffMinute / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} ngày trước`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 4) return `${diffWeek} tuần trước`;
    const diffMonth = Math.floor(diffDay / 30.4375);
    if (diffMonth < 12) return `${diffMonth} tháng trước`;
    const diffYear = Math.floor(diffDay / 365.25);
    return `${diffYear} năm trước`;
}

// Dropdown component for profile/messages/notifications
function Dropdown({
    open,
    setOpen,
    children,
}: {
    open: boolean;
    setOpen: (v: boolean) => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open, setOpen]);
    if (!open) return null;
    return (
        <div
            ref={ref}
            style={{
                right: 0,
                left: "auto",
                top: "4rem",
                marginTop: 0,
            }}
            className="absolute bg-white dark:bg-zinc-900 shadow-xl rounded-xl z-200 p-2 border border-zinc-100 dark:border-zinc-800"
        >
            {children}
        </div>
    );
}

const menuItems = [
    {
        href: "/home",
        label: "Trang chủ",
    },
    {
        href: "/group",
        label: "Group",
    },
    {
        href: "/friends",
        label: "Bạn bè",
    },
    {
        href: "/profile",
        label: "Cá nhân",
    },
];

export function HEADER_HEIGHT() {
    return "4rem";
}

// Không cần giữ chỗ trống, chỉ render Header!
export default function HeaderWithSpacer() {
    return <Header />;
}

// ---- Ưu tiên: công tắc 3 mức UI component (bổ sung hover hiển thị ưu tiên nhóm, chỉ hiện khi hover) ----
function MessagePrioritySwitch() {
    const {
        priority,
        setNone,
        setLow,
        setHigh,
        groupPriority,
        setGroupNone,
        setGroupLow,
        setGroupHigh,
    } = useMessagePriority();

    const OPTIONS = [
        { value: "none", label: "Tắt", color: "#aaa" },
        { value: "low", label: "Thấp", color: "#facc15" },
        { value: "high", label: "Cao", color: "#2563eb" },
    ];
    const GROUP_OPTIONS = [
        { value: "none", label: "Tắt", color: "#aaa" },
        { value: "low", label: "Thấp", color: "#facc15" },
        { value: "high", label: "Cao", color: "#2563eb" },
    ];

    // Tách riêng hover dấu hỏi và hover group
    const [helpHovered, setHelpHovered] = useState(false);
    const [groupHovered, setGroupHovered] = useState(false);

    return (
        <div
            className={`
                relative flex flex-col gap-1 px-2 py-2 transition-all duration-300
            `}
            style={{
                width: "fit-content",
                minWidth: 0,
            }}
            onMouseEnter={() => setGroupHovered(true)}
            onMouseLeave={() => setGroupHovered(false)}
        >
            <div className="flex flex-row gap-2 items-center">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Ưu tiên thông báo:
                </span>
                {OPTIONS.map(o => (
                    <button
                        key={o.value}
                        onClick={() => {
                            if (o.value === "none") setNone();
                            else if (o.value === "low") setLow();
                            else if (o.value === "high") setHigh();
                        }}
                        className={`
                            flex flex-col items-center px-3 py-1 rounded-lg
                            ${priority === o.value ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-50 dark:bg-zinc-900"}
                            transition
                            text-xs font-semibold cursor-pointer
                            border border-zinc-300 dark:border-zinc-700
                            outline-none ring-0
                        `}
                        style={{
                            color: priority === o.value ? o.color : "#666",
                            minWidth: 48,
                        }}
                        aria-pressed={priority === o.value}
                        type="button"
                    >
                        <span>{o.label}</span>
                    </button>
                ))}
                {/* PHẦN HỎI - tách riêng hover cho dấu hỏi */}
                <div
                    className="relative ml-1 flex items-center"
                    style={{ position: "relative" }}
                    onMouseEnter={() => setHelpHovered(true)}
                    onMouseLeave={() => setHelpHovered(false)}
                >
                    <div
                        className={`
                            flex items-center justify-center
                            w-6 h-6 rounded-full border border-zinc-300 
                            bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800
                            text-zinc-500 
                            font-bold text-xs cursor-pointer
                            transition
                            select-none
                            hover:bg-zinc-200 dark:hover:bg-zinc-700
                        `}
                    >
                        ?
                    </div>
                    {/* Tooltip: chỉ hiện khi hover dấu hỏi, không group-hover */}
                    <div
                        className={`
                            transition duration-150
                            absolute left-1/2 -translate-x-1/2 top-8 z-50 
                            bg-white dark:bg-zinc-900 shadow-lg rounded-lg p-3 min-w-max border border-zinc-200 dark:border-zinc-800
                            text-xs text-zinc-700 dark:text-zinc-200
                        `}
                        style={{
                            opacity: helpHovered ? 1 : 0,
                            pointerEvents: helpHovered ? "auto" : "none",
                        }}
                    >
                        <div><b>Tắt</b>: không thông báo</div>
                        <div><b>Thấp</b>: có thông báo</div>
                        <div><b>Cao</b>: tự mở khi nhận được tin nhắn</div>
                    </div>
                </div>
            </div>
            {/* Group priority row: hidden by default, only slide out (fade+slide) on hover of cả vùng */}
            <div
                className={`
                    flex flex-row gap-2 items-center mt-1
                    transition-all duration-300
                `}
                style={{
                    maxHeight: groupHovered ? "5rem" : "0",
                    overflow: "hidden",
                    opacity: groupHovered ? 1 : 0,
                    transform: groupHovered ? "translateX(0)" : "translateX(2rem)",
                    pointerEvents: groupHovered ? "auto" : "none",
                }}
            >
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                    Ưu tiên thông báo nhóm:
                </span>
                {GROUP_OPTIONS.map(o => (
                    <button
                        key={o.value}
                        onClick={() => {
                            if (o.value === "none" && setGroupNone) setGroupNone();
                            else if (o.value === "low" && setGroupLow) setGroupLow();
                            else if (o.value === "high" && setGroupHigh) setGroupHigh();
                        }}
                        className={`
                            flex flex-col items-center px-2 py-1 rounded-lg
                            ${groupPriority === o.value ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-50 dark:bg-zinc-900"}
                            transition
                            text-xs font-semibold cursor-pointer
                            border border-zinc-300 dark:border-zinc-700
                            outline-none ring-0
                        `}
                        style={{
                            color: groupPriority === o.value ? o.color : "#666",
                            minWidth: 40,
                        }}
                        aria-pressed={groupPriority === o.value}
                        type="button"
                    >
                        <span>{o.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useDispatch();
    const searchParams = useSearchParams();
    const isBelow900 = useScreenBelow900(); // custom hook to check screen width

    // Lấy state user trong redux và log ra
    const user = useSelector((state: any) => state.user);
    const userId = user?.userId;
    useEffect(() => {
        console.log("Redux user state:", user);
    }, [user]);

    const [openNotif, setOpenNotif] = useState(false);
    const [openMsg, setOpenMsg] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);

    // Truy xuất giá trị key từ URL (nếu có), chỉ thiết lập ban đầu
    const initialSearch = React.useMemo(() => {
        if (!searchParams) return "";
        return searchParams.get("key") || "";
    }, [searchParams]);

    // Thêm state lưu id search hiện tại
    const [lastSearchId, setLastSearchId] = useState<number>(() => Math.floor(Math.random() * 1000000));

    // For input animation
    const [searchHasFocus, setSearchHasFocus] = useState(false);
    const [searchValue, setSearchValue] = useState(initialSearch);

    const { openChat } = useChatDock();

    // Notifications (dummy, will be appended when socket event comes)
    const [notifications, setNotifications] = useState([
        { id: 1, content: "Bạn có 1 lời mời kết bạn mới", time: "2 phút trước" },
        { id: 2, content: "Bài viết của bạn vừa được thích!", time: "10 phút trước" },
    ]);

    // --- State for messages fetched from API ---
    const [messages, setMessages] = useState<any[]>([]);

    // ** SOCKET: Listen for notification **
    // useChatSocket and use notification listener
    const chatUserId = user?.userId || "";
    const chatName = user?.profile?.name || user?.username || "Người dùng";
    const { listenNotification } = useChatSocket(chatUserId, chatName);

    // messageListMapRef lưu "raw" info từ API, không bị mất các trường bên dưới kể cả khi cập nhật notification
    const messageListMapRef = useRef<Map<string, any>>(new Map());

    // --- Cache for userId=>profile and userId=>bio for notification rendering ---
    const [userMap, setUserMap] = useState<{ [userId: string]: { name?: string; avatar?: string } }>({});

    // Hàm tiện ích: convert conversation list từ API về dạng messages cho dropdown
    function conversationItemToMsg(item: any, userId: string) {
        const latestMsg = item.latestMessage;
        let displayContent = latestMsg?.message || "";
        if (
            latestMsg &&
            userId &&
            latestMsg.senderId &&
            String(latestMsg.senderId) === String(userId)
        ) {
            displayContent = `Bạn: ${latestMsg.message || ""}`;
        }

        let from = "";
        let username = "";
        let avatar = "";
        let targetUserId = "";
        let groupName = "";
        let conversationType = item.type;

        if (conversationType === "group") {
            from = item.groupName ? `Nhóm: ${item.groupName}` : "Nhóm";
            avatar = getCloudinaryImageLink(item.groupAvatar, null, 56);
            username = ""; // không hiển thị username cho group
            targetUserId = ""; // để trống cho group
            groupName = item.groupName || "";
        } else {
            from = item.receiverName || "Người dùng";
            avatar = getCloudinaryImageLink(item.receiverAvatar, item.receiverAvatarCroppedArea, 56);
            username = item.receiverUsername || "";
            targetUserId = item.receiverId || item.receiver_id || "";
        }

        // Lấy timestamp message cuối cùng (cần cho sort)
        let lastMsgTs = 0;
        if (latestMsg?.createdAt) {
            try {
                lastMsgTs = new Date(latestMsg.createdAt).getTime();
            } catch {
                lastMsgTs = 0;
            }
        } else if (item.createdAt) {
            try {
                lastMsgTs = new Date(item.createdAt).getTime();
            } catch {
                lastMsgTs = 0;
            }
        }

        const msg = {
            id: item.conversationId,
            conversationId: item.conversationId,
            type: conversationType,
            from,
            username,
            userId: targetUserId,
            groupName: groupName,
            content: displayContent,
            time: (() => {
                if (item.latestMessage?.createdAt) {
                    try {
                        return getTimeAgoVN(item.latestMessage.createdAt);
                    } catch {
                        return "";
                    }
                } else if (item.createdAt) {
                    try {
                        return getTimeAgoVN(item.createdAt);
                    } catch {
                        return "";
                    }
                }
                return "";
            })(),
            avatar,
            lastMsgTs,
        };
        return msg;
    }

    // Khi mount, getMessageList và lưu map vào ref, setMessages từ đó
    useEffect(() => {
        (async () => {
            const response = await getMessageList();
            if (Array.isArray(response?.conversationList)) {
                const map = new Map<string, any>();
                const mapped: any[] = [];
                for (const item of response.conversationList) {
                    map.set(String(item.conversationId), item);
                    mapped.push(conversationItemToMsg(item, userId));
                }
                messageListMapRef.current = map;
                mapped.sort((a: { lastMsgTs?: number }, b: { lastMsgTs?: number }) => (b.lastMsgTs || 0) - (a.lastMsgTs || 0));
                setMessages(mapped);
            } else {
                messageListMapRef.current = new Map();
                setMessages([]);
            }
        })();
    }, [userId]);

    // --- Helper for notification: userId to display (fallback to unknown) ---
    const getUserNameForNotify = (uid: string) => {
        if (!uid) return "Ai đó";
        if (userMap[uid]?.name) return userMap[uid].name;
        return "Ai đó";
    };
    const getUserAvatarForNotify = (uid: string) =>
        userMap[uid]?.avatar ||
        "https://ui-avatars.com/api/?name=A&background=random&size=128";

    // Trợ giúp lấy bổ sung user profile cho thông báo
    async function fetchNotiUserInfo(userIds: string[]): Promise<void> {
        if (userIds.length === 0) return;
        // Chỉ fetch những userId chưa cached.
        const needFetch = userIds.filter(
            (id) => !userMap[id]
        );
        if (needFetch.length === 0) return;
        try {
            // Fetch profile và bio cùng lúc... (simple fake for now, normally call API)
            // TODO: Thay bằng gọi profile API hoặc lấy ở redux store nếu có
            // const [{data: bios}, {data: profs}] = await Promise.all([...]);
            // Hiện tại chỉ mock lại trả về tên "User:xxxx" thôi
            const mockData: any = {};
            for (let id of needFetch) {
                mockData[id] = {
                    name: "Người dùng " + id.slice(-4),
                    avatar: "https://ui-avatars.com/api/?name=U&background=random&size=128",
                };
            }
            setUserMap(umap => ({ ...umap, ...mockData }));
        } catch { }
    }

    // XỬ LÝ cập nhật message preview khi có notification + lắng nghe thêm onNotification (thêm notify vào notifications)
    useEffect(() => {
        const off = listenNotification({
            onMessageNotification: async (data: any) => {
                if (!data?.conversationId) return;
                const convId = String(data.conversationId);
                const map = messageListMapRef.current;
                if (!map || !map.has(convId)) {
                    try {
                        const res = await getOneMessageListbyConversationId(data.conversationId);
                        if (Array.isArray(res?.conversationList) && res.conversationList.length > 0) {
                            for (const item of res.conversationList) {
                                map.set(String(item.conversationId), item);
                            }
                            const mappedMessages: any[] = [];
                            for (const [, v] of map) {
                                mappedMessages.push(conversationItemToMsg(v, userId));
                            }
                            mappedMessages.sort((a: { lastMsgTs?: number }, b: { lastMsgTs?: number }) => (b.lastMsgTs || 0) - (a.lastMsgTs || 0));
                            setMessages(mappedMessages);
                        }
                    } catch (e) {
                        console.error("getOneMessageListbyConversationId error:", e);
                    }
                    return;
                }
                const old = map.get(convId);
                const updated = { ...old };
                updated.latestMessage = {
                    senderId: data.senderId,
                    message: data.message,
                    createdAt: data.createdAt,
                };
                map.set(convId, updated);
                const mappedMessages: any[] = [];
                for (const [, v] of map) {
                    mappedMessages.push(conversationItemToMsg(v, userId));
                }
                mappedMessages.sort((a: { lastMsgTs?: number }, b: { lastMsgTs?: number }) => (b.lastMsgTs || 0) - (a.lastMsgTs || 0));
                setMessages(mappedMessages);
            },
            onNotification: async (data: any) => {
                console.log(data)
            }
        });
        return () => { typeof off === "function" && off(); };
        // userMap không cần là deps, fetchNotiUserInfo luôn cập nhật userMap nếu thiếu
        // eslint-disable-next-line
    }, [listenNotification, userId]);

    const searchExpanded = searchHasFocus || !!searchValue;
    const searchButtonFull = searchHasFocus || !!searchValue;
    const profile = user?.profile || {};
    const displayName = profile?.name || "Người dùng";
    const displayUsername = profile?.username || user?.username || "";
    const displayEmail = user.profile?.email || "";
    const avatarUrl = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);

    const handleMessageClick = ({
        type,
        userId,
        conversationId,
        name,
        username,
        avatar,
        groupName,
    }: {
        type: string;
        userId: string;
        conversationId: string;
        name?: string;
        username?: string;
        avatar?: string;
        groupName?: string;
    }) => {
        if (type === "group") {
            openChat({
                id: conversationId,
                conversationId,
                title: groupName || name || "Nhóm",
                avatarUrl: avatar,
                type: "group"
            });
        } else {
            openChat({
                id: userId,
                conversationId: conversationId,
                title: name || username || "Người dùng",
                avatarUrl: avatar,
                type: "private"
            });
        }
        setOpenMsg(false);
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const keyword = searchValue.trim();
        let newId: number;
        do {
            newId = Math.floor(Math.random() * 1000000000);
        } while (newId === lastSearchId);
        setLastSearchId(newId);

        const params = new URLSearchParams();
        if (keyword !== "") {
            params.set("key", keyword);
        }
        params.set("id", String(newId));

        let url = "/search";
        if (params.toString()) {
            url += "?" + params.toString();
        }
        router.push(url);
        setSearchHasFocus(false);
    };

    const { priority, groupPriority } = useMessagePriority();

    // Custom: render menu for placing either in header or in red bar
    function HeaderMenuCenter() {
        return (
            <nav className="flex items-center justify-center h-full flex-[0_0_33.333%] min-w-0 px-6"
                style={{
                    width: "100%",
                    height: "100%"
                }}
            >
                <ul className="flex w-full justify-between items-stretch h-full gap-0">
                    {menuItems.map((item, idx) => {
                        const active = pathname.startsWith(item.href);
                        return (
                            <li
                                key={item.href}
                                className="h-full flex items-stretch"
                                style={{
                                    width: "25%",
                                    minWidth: "90px",
                                }}
                            >
                                <Link
                                    href={item.href}
                                    className={`
                                        flex flex-col items-center justify-center relative w-full h-full text-base font-bold transition
                                        ${active ? "text-blue-700 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-200"}
                                        hover:text-blue-600 dark:hover:text-blue-300
                                    `}
                                    style={{
                                        height: "100%",
                                        textAlign: "center",
                                        width: "100%",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        display: "flex",
                                    }}
                                >
                                    <span className="flex-1 flex items-center justify-center px-2 relative z-200 h-full">
                                        {item.label}
                                    </span>
                                    <span
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-xl transition-all duration-300"
                                        style={{
                                            marginTop: 0,
                                            height: active ? 4 : 0,
                                            background: active
                                                ? "linear-gradient(to right, #2563eb, #60a5fa)"
                                                : undefined,
                                            width: "calc(100% + 20px)",
                                            maxWidth: "140px",
                                            minWidth: "44px",
                                            alignSelf: "center",
                                            opacity: active ? 1 : 0,
                                            transition: "height 0.2s, opacity 0.2s",
                                        }}
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        );
    }

    return (
        <header
            className="fixed flex flex-col top-0 left-0 bg-white dark:bg-zinc-900 shadow-sm z-200 border-b border-zinc-100 dark:border-zinc-800 items-stretch"
            style={{
                width: "100vw",
                right: 0,
            }}
        >
            <div className="w-full h-16 flex px-4">
                <div className="flex flex-row w-full h-full items-stretch justify-between">
                    {/* Left: Logo & Search */}
                    <div className="flex items-center gap-3 min-w-0 h-full flex-1">
                        <button
                            type="button"
                            onClick={() => router.push("/home")}
                            className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-blue-300 dark:from-blue-400 dark:to-blue-600 shadow-md border-[2px] border-white dark:border-zinc-800 shrink-0 cursor-pointer"
                            style={{ marginRight: "0.5rem" }}
                            aria-label="Chuyển về trang chủ"
                        >
                            <span className="select-none text-white text-2xl font-bold">C</span>
                        </button>
                        {/* Search input does NOT push the center menu to the right */}
                        <div
                            style={{
                                width: searchExpanded ? "18rem" : "11rem",
                                transition: "width 0.3s",
                                minWidth: 0,
                            }}
                        >
                            <form
                                className={`
                                  group relative flex items-center transition-all duration-300
                                  h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full border
                                  border-[#3B3D3E] shadow-inner
                              `}
                                style={{ minWidth: 0, width: "100%" }}
                                onSubmit={handleSearchSubmit}
                            >
                                <input
                                    type="text"
                                    value={searchValue}
                                    onFocus={() => setSearchHasFocus(true)}
                                    onBlur={() => setSearchHasFocus(false)}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    placeholder="Tìm kiếm..."
                                    className={`
                                      pl-4 ${searchButtonFull ? "py-0" : "py-1.5"} rounded-full bg-transparent
                                      text-sm focus:outline-none transition-all duration-200 
                                      w-full h-full
                                      text-zinc-900 dark:text-zinc-100
                                      cursor-pointer focus:cursor-text
                                    `}
                                    style={{
                                        background: "none",
                                        paddingRight: 0,
                                        ...(searchButtonFull
                                            ? {
                                                paddingTop: 0,
                                                paddingBottom: 0,
                                                height: "2.5rem",
                                            }
                                            : {}),
                                    }}
                                />
                                <button
                                    type="submit"
                                    className={`
                                      absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center 
                                      text-white rounded-full transition cursor-pointer
                                    `}
                                    tabIndex={-1}
                                    style={{
                                        background: "#18181B",
                                        transition: "background 0.2s",
                                        padding: searchButtonFull ? 0 : undefined,
                                        width: "40px",
                                        height: "40px",
                                        minWidth: "40px",
                                        minHeight: "40px",
                                        border: "1.5px solid #3B3D3E",
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = "#2563eb";
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = "#18181B";
                                    }}
                                >
                                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                                        <circle cx="9.5" cy="9.5" r="7" stroke="currentColor" strokeWidth="2" />
                                        <path d="M16.5 16.5L13.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Center: Menu - Chỉ hiển thị trên header khi >=900px, nếu nhỏ hơn 900px sẽ render ở dòng dưới */}
                    {!isBelow900 && <HeaderMenuCenter />}

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 h-full flex-1 justify-end min-w-0">
                        {/* Notification bell */}
                        <div className="relative flex items-center h-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenNotif((o) => !o);
                                    setOpenMsg(false);
                                    setOpenProfile(false);
                                }}
                                className={`
                                    w-12 h-12 flex items-center justify-center rounded-full border
                                    transition cursor-pointer
                                    ${openNotif ? "bg-blue-600 border-blue-600" : "bg-zinc-900 border-[#3B3D3E] dark:bg-zinc-900"}
                                `}
                                style={{ marginTop: "auto", marginBottom: "auto" }}
                            >
                                <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
                                    <path
                                        d="M11 20a2.25 2.25 0 0 1-2.25-2.25h4.5A2.25 2.25 0 0 1 11 20zM18.5 16v-6a7.5 7.5 0 0 0-15 0v6l-1.5 1.5v.5h18v-.5L18.5 16z"
                                        fill={openNotif ? "#fff" : "#fff"}
                                        stroke={openNotif ? "#fff" : "#fff"}
                                        strokeWidth="1.2"
                                    />
                                </svg>
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
                            </button>
                            <Dropdown open={openNotif} setOpen={setOpenNotif}>
                                <div className="font-semibold mb-2 min-w-[350px] max-w-[350px] text-zinc-900 dark:text-zinc-100">Thông báo</div>
                                <ul>
                                    {notifications.length === 0 && (
                                        <li className="py-3 text-center text-zinc-500">Không có thông báo mới</li>
                                    )}
                                    {notifications.map((n) => (
                                        <li key={n.id} className="py-2 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                                            <div className="text-sm text-zinc-800 dark:text-zinc-200">{n.content}</div>
                                            <div className="text-xs text-zinc-400 mt-0.5">{n.time}</div>
                                        </li>
                                    ))}
                                </ul>
                            </Dropdown>
                        </div>

                        {/* Message */}
                        <div className="relative flex items-center h-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenMsg((o) => !o);
                                    setOpenNotif(false);
                                    setOpenProfile(false);
                                }}
                                className={`
                                    w-12 h-12 flex items-center justify-center rounded-full border
                                    transition cursor-pointer
                                    ${openMsg ? "bg-blue-600 border-blue-600" : "bg-zinc-900 border-[#3B3D3E] dark:bg-zinc-900"}
                                `}
                                style={{ marginTop: "auto", marginBottom: "auto" }}
                            >
                                <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
                                    <path
                                        d="M2 6.857C2 5.832 2.832 5 3.857 5h14.286C19.168 5 20 5.832 20 6.857v8.286C20 16.168 19.168 17 18.143 17H6l-4 4v-4.143C2 16.168 2 15.143 2 15.143V6.857z"
                                        fill={openMsg ? "#fff" : "#fff"}
                                        stroke={openMsg ? "#fff" : "#fff"}
                                        strokeWidth="1.2"
                                    />
                                </svg>
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
                            </button>
                            <Dropdown open={openMsg} setOpen={setOpenMsg}>
                                <div
                                    className="flex items-center justify-between mb-2 z-200 text-zinc-900 dark:text-zinc-100"
                                    style={{
                                        minWidth: "340px",
                                    }}
                                >
                                    <div className="font-semibold flex items-center">
                                        Tin nhắn
                                    </div>
                                    {/* CreateGroupButton đặt ở bên phải của chữ "Tin nhắn" */}
                                    <div className="ml-2">
                                        <CreateGroupButton />
                                    </div>
                                </div>
                                <MessagePrioritySwitch />
                                <ul>
                                    {messages.length === 0 && (
                                        <li
                                            style={{
                                                width: "340px",
                                                height: "75px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                            className="text-center text-zinc-500"
                                        >
                                            Chưa có tin nhắn
                                        </li>
                                    )}
                                    {messages.map((m) => (
                                        <li
                                            key={m.id}
                                            className="flex items-center gap-4 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                            style={{
                                                width: "340px",
                                                height: "75px",
                                                padding: "12px 14px",
                                                boxSizing: "border-box"
                                            }}
                                            onClick={() => {
                                                const msgInfo = {
                                                    type: m.type,
                                                    userId: m.userId,
                                                    conversationId: m.conversationId,
                                                    name: m.from,
                                                    username: m.username,
                                                    avatar: m.avatar,
                                                    groupName: m.groupName,
                                                };
                                                handleMessageClick(msgInfo);
                                            }}
                                        >
                                            <img
                                                src={m.avatar}
                                                alt={m.from}
                                                className="rounded-full object-cover border"
                                                style={{
                                                    width: "56px",
                                                    height: "56px",
                                                    minWidth: "56px",
                                                    minHeight: "56px",
                                                }}
                                            />
                                            <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: "100%" }}>
                                                <div className="font-semibold text-base truncate text-zinc-900 dark:text-zinc-100" style={{ lineHeight: "1.25" }}>
                                                    {m.from}
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-sm truncate text-zinc-500 dark:text-zinc-400" style={{ lineHeight: "1.2" }}>
                                                        {m.content}
                                                    </span>
                                                    <span className="text-xs text-zinc-400 ml-3 whitespace-nowrap">{m.time}</span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </Dropdown>
                        </div>

                        {/* Avatar dropdown */}
                        <div className="relative flex items-center h-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenProfile((o) => !o);
                                    setOpenNotif(false);
                                    setOpenMsg(false);
                                }}
                                className="w-12 h-12 flex items-center justify-center rounded-full hover:ring-2 ring-blue-500 transition relative cursor-pointer"
                                style={{
                                    position: "relative",
                                    marginTop: "auto",
                                    marginBottom: "auto",
                                }}
                            >
                                <span className="relative w-12 h-12 flex items-center justify-center">
                                    <img
                                        src={avatarUrl}
                                        alt={displayName}
                                        className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                    />
                                    <span
                                        className="absolute right-0 bottom-0"
                                        style={{
                                            pointerEvents: "none",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 3,
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 18 18" className="text-zinc-500 dark:text-zinc-300">
                                            <circle cx="9" cy="9" r="8" fill="white" className="dark:fill-zinc-800" />
                                            <path d="M9 12l3-4H6l3 4z" fill="currentColor" />
                                        </svg>
                                    </span>
                                </span>
                            </button>
                            <Dropdown open={openProfile} setOpen={setOpenProfile}>
                                <div className="px-3 py-2 min-w-[200px] border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                                    <img
                                        src={avatarUrl}
                                        alt={displayName}
                                        className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {displayName}
                                        </div>
                                        {displayUsername && (
                                            <div className="text-xs text-zinc-400 break-all">
                                                @{displayUsername}
                                            </div>
                                        )}
                                        {displayEmail && (
                                            <div className="text-xs text-zinc-400 break-all">
                                                {displayEmail}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ul className="py-1">
                                    <li>
                                        <Link
                                            href="/profile"
                                            onClick={() => setOpenProfile(false)}
                                            className="block w-full px-4 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left text-zinc-800 dark:text-zinc-200"
                                        >
                                            Trang cá nhân
                                        </Link>
                                    </li>
                                    <li>
                                        <button
                                            className="block w-full px-4 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left text-red-600"
                                            onClick={() => {
                                                setOpenProfile(false);
                                                authLogout(dispatch, router);
                                            }}
                                        >
                                            Đăng xuất
                                        </button>
                                    </li>
                                </ul>
                            </Dropdown>
                        </div>
                    </div>
                </div>
            </div>
            {/* Only show this bar below 900px and style it same as above (remove red, white bg, light border, shadow) */}
            {isBelow900 && (
                <div
                    className="h-12 w-full flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm border-b border-zinc-100 dark:border-zinc-800"
                    style={{ padding: 0, position: "relative" }}
                >
                    <div style={{ width: "100%", height: "100%" }}>
                        {/* Trượt menu xuống dòng dưới khi nhỏ hơn 900px */}
                        <HeaderMenuCenter />
                    </div>
                </div>
            )}
        </header>
    );
}
