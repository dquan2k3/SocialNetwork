"use client";
import React, { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authLogout } from "@/services/auth";
import { useDispatch, useSelector } from "react-redux";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { getMessageList, getOneMessageListbyConversationId } from "@/api/conversation.api";
import { apiGetNotifyList } from "@/api/notification.api";
import { useChatDock } from "@/app/providers/ChatDockProvider";
import CreateGroupButton from "../ui/CreateGroupButton";
import { useChatSocket } from "@/socket/useChatSocket";
import { useMessagePriority } from "@/context/messagePriority/useMessagePriority";
import ShowPostById from "../ui/ShowpostById";
import {
    faUserCheck,
    faUserPlus,
    faThumbsUp,
    faHeart,
    faFaceLaugh,
    faFaceSadCry,
    faFaceAngry,
    faShare,
    faComment,
    faUsers
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Thêm biểu tượng kiểu acceptFriend vào đây luôn nếu cần mở rộng sau này
const reactTypeToFAIcon = {
    like: faThumbsUp,
    love: faHeart,
    fun: faFaceLaugh,
    sad: faFaceSadCry,
    angry: faFaceAngry,
    default: faThumbsUp,
};
const acceptFriendIcon = faUserCheck;

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

function Dropdown({
    open,
    setOpen,
    children,
}: {
    open: boolean;
    setOpen: (v: boolean) => void;
    children: ReactNode;
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

type NotificationBase = {
    id: number | string;
    content: string | ReactNode;
    time: string;
    avatar?: string;
    name?: string;
    // New: notificationTypeIcon? and notificationTypeIconColor?
    notificationTypeIcon?: any;
    notificationTypeIconColor?: string;
    notificationTypeIconTitle?: string;
};
type ExtendedReactNotification = NotificationBase & {
    reactId?: any;
    type?: string;
    post?: any;
    from?: any;
    reactType?: any;
    commentId?: any;
    // friend request
    friendRequestId?: string;
    friendRequestFrom?: string;
};

function isSameReactNotification(a: ExtendedReactNotification, {
    reactId,
    post,
    from,
}: Partial<ExtendedReactNotification>) {
    if (a.reactId && reactId && String(a.reactId) === String(reactId)) return true;
    if (a.type === "react"
        && a.post && post && String(a.post) === String(post)
        && a.from && from && String(a.from) === String(from)
    ) return true;
    return false;
}

function isSameCommentNotification(a: ExtendedReactNotification, {
    commentId,
    post,
    from,
}: Partial<ExtendedReactNotification>) {
    if (a.commentId && commentId && String(a.commentId) === String(commentId)) return true;
    if (a.type === "comment"
        && a.post && post && String(a.post) === String(post)
        && a.from && from && String(a.from) === String(from)
    ) return true;
    return false;
}

function isSameFriendRequestNotification(a: ExtendedReactNotification, { friendRequestId, from }: Partial<ExtendedReactNotification> & { from?: any }) {
    if (a.type === "friendRequest") {
        if (a.friendRequestId && friendRequestId && String(a.friendRequestId) === String(friendRequestId)) return true;
        if (a.from && from && String(a.from) === String(from)) return true;
    }
    return false;
}

// acceptFriend notifications are unique by id
function isSameAcceptFriendNotification(a: ExtendedReactNotification, { acceptFriendId }: { acceptFriendId?: string }) {
    return a.type === "acceptFriend" && !!acceptFriendId && String(a.id) === "acceptFriend__" + String(acceptFriendId);
}

function truncateName(name: string | undefined): string {
    if (!name) return "Ai đó";
    return name.length > 15 ? name.slice(0, 15) + "..." : name;
}

// Convert an API notification object to an ExtendedReactNotification (matches WebSocket style)
function convertApiNotification(n: any): ExtendedReactNotification {
    const notiType = n.type;
    const id = n._id || n.id || "";
    const reactType = n.reactType || "like";
    const postId = n.post || "";
    const fromUserId = n.from || n.user || "";
    const createdAt = n.createdAt;
    const avatar = n.avatar || "";
    const name = n.name || "";

    // ===== FRIEND REQUEST notification handling =====
    if (notiType === "friendRequest") {
        const friendReqContent = (
            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                <span>
                    <span className="font-bold">{truncateName(name) || "Ai đó"}</span>
                    &nbsp;đã gửi cho bạn lời mời kết bạn
                </span>
            </span>
        );
        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
        return {
            id: "friendRequest__" + (id || fromUserId),
            friendRequestId: id,
            from: fromUserId,
            content: friendReqContent,
            time: displayTime,
            type: "friendRequest",
            avatar: avatar,
            name: name,
            notificationTypeIcon: faUserPlus,
            notificationTypeIconColor: "#2563eb",
            notificationTypeIconTitle: "Lời mời kết bạn"
        };
    }

    // ===== ACCEPT FRIEND notification handling =====
    if (notiType === "acceptFriend") {
        const acceptFriendContent = (
            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                <span>
                    <span className="font-bold">{truncateName(name) || "Ai đó"}</span>
                    &nbsp;đã đồng ý lời mời kết bạn của bạn
                </span>
            </span>
        );
        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
        return {
            id: "acceptFriend__" + id,
            content: acceptFriendContent,
            time: displayTime,
            type: "acceptFriend",
            avatar: avatar,
            name: name,
            notificationTypeIcon: faUserCheck,
            notificationTypeIconColor: "#22c55e",
            notificationTypeIconTitle: "Đã chấp nhận kết bạn"
        };
    }

    // ===== REACTION notification handling =====
    if (notiType === "react") {
        let actionText = "đã thả cảm xúc";
        const notiContent =
            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                <span>
                    <span className="font-bold">{truncateName(name) || "Ai đó"}</span>
                    &nbsp;{actionText}
                    {["like", "love", "fun", "sad", "angry"].includes(reactType)
                        ? <span style={{ marginLeft: 4, opacity: 0.7, color: "#999" }}>{(() => {
                            switch (reactType) {
                                case "like": return "Thích";
                                case "love": return "Yêu thích";
                                case "fun": return "Haha";
                                case "sad": return "Buồn";
                                case "angry": return "Phẫn nộ";
                                default: return "Cảm xúc";
                            }
                        })()}</span>
                        : null
                    }
                </span>
            </span>
        ;
        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
        return {
            id: "react__" + id,
            reactId: id,
            content: notiContent,
            time: displayTime,
            type: "react",
            post: postId,
            from: fromUserId,
            reactType: reactType,
            avatar,
            name,
            notificationTypeIcon: reactTypeToFAIcon[reactType as keyof typeof reactTypeToFAIcon] || faThumbsUp,
            notificationTypeIconColor: "#2563eb",
            notificationTypeIconTitle: reactType
        };
    }

    // ===== COMMENT notification handling =====
    if (notiType === "comment") {
        let commentId = id;
        const notiContent =
            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                <span>
                    <span className="font-bold">{truncateName(name) || "Ai đó"}</span>
                    &nbsp;đã bình luận bài viết của bạn
                </span>
            </span>
        ;
        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
        return {
            id: "comment__" + commentId,
            commentId,
            content: notiContent,
            time: displayTime,
            type: "comment",
            post: postId,
            from: fromUserId,
            avatar,
            name,
            notificationTypeIcon: faComment,
            notificationTypeIconColor: "#2563eb",
            notificationTypeIconTitle: "Bình luận",
        };
    }

    // ===== SHARE notification handling =====
    if (notiType === "share") {
        let shareId = id;
        const notiContent =
            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                <span>
                    <span className="font-bold">{truncateName(name) || "Ai đó"}</span>
                    &nbsp;đã chia sẻ bài viết của bạn
                </span>
            </span>
        ;
        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
        return {
            id: "share__" + shareId,
            content: notiContent,
            time: displayTime,
            type: "share",
            post: postId,
            from: fromUserId,
            avatar,
            name,
            notificationTypeIcon: faShare,
            notificationTypeIconColor: "#2563eb",
            notificationTypeIconTitle: "Chia sẻ",
        };
    }

    // fallback (should not happen for known types)
    return {
        id: id,
        content: notiType || "Thông báo",
        time: createdAt ? getTimeAgoVN(createdAt) : "vừa xong",
        avatar,
        name,
    };
}

// Helper component for group avatar: shows avatar if exists, else a blue background with white "N"
function GroupAvatar({ avatar, groupName, size = 56 }: { avatar?: string, groupName?: string, size?: number }) {
    if (avatar) {
        return (
            <img
                src={avatar}
                alt={groupName || "Nhóm"}
                className="rounded-full object-cover border"
                style={{
                    width: size,
                    height: size,
                    minWidth: size,
                    minHeight: size,
                }}
            />
        );
    }
    return (
        <div
            className="rounded-full flex items-center justify-center border"
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                fontSize: size / 2,
                border: "2px solid #2563eb",
                userSelect: "none",
            }}
        >
            N
        </div>
    );
}

function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useDispatch();
    const searchParams = useSearchParams();
    const isBelow900 = useScreenBelow900();

    const user = useSelector((state: any) => state.user);
    const userId = user?.userId;
    const myName = user.profile?.name;
    const myUsername = user.profile?.username;
    const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);
    const myAvatarCroppedArea = user.bio?.avatarCroppedArea;
    useEffect(() => {
        console.log("Redux user state:", user);
    }, [user]);

    const [notifications, setNotifications] = useState<ExtendedReactNotification[]>([]);
    // Fetch notification list from API on mount, and add them to notifications (prepend to array)
    useEffect(() => {
        (async () => {
            try {
                const res = await apiGetNotifyList();
                // Show on console as before
                console.log("apiGetNotifyList result:", res);

                // Convert result (assume res.notification is an array as in prompt)
                if (res && Array.isArray(res.notification)) {
                    // Map api notifications into ExtendedReactNotification type and merge with any current notifications (prevent duplicate IDs per style below)
                    setNotifications(prev => {
                        // Convert and merge (don't re-add if in prev, based on .id and type)
                        const mapped: ExtendedReactNotification[] = [];
                        for (const apiN of res.notification) {
                            const one: ExtendedReactNotification = convertApiNotification(apiN);
                            // Only add if not present in prev (by id), same as the websocket logic
                            if (!prev.some(p => String(p.id) === String(one.id))) {
                                mapped.push(one);
                            }
                        }
                        // Show newest from server on top
                        return [...mapped, ...prev];
                    });
                }
            } catch (e) {
                console.log("apiGetNotifyList error:", e);
            }
        })();
    }, []);

    const [openNotif, setOpenNotif] = useState(false);
    const [openMsg, setOpenMsg] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);

    const initialSearch = React.useMemo(() => {
        if (!searchParams) return "";
        return searchParams.get("key") || "";
    }, [searchParams]);
    const [lastSearchId, setLastSearchId] = useState<number>(() => Math.floor(Math.random() * 1000000));

    const [searchHasFocus, setSearchHasFocus] = useState(false);
    const [searchValue, setSearchValue] = useState(initialSearch);

    const { openChat } = useChatDock();

    const [messages, setMessages] = useState<any[]>([]);

    // For showing post by notification click
    const [showPost, setShowPost] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const handleClosePost = () => {
        setShowPost(false);
        setSelectedPostId(null);
    };

    // SOCKET logic
    const chatUserId = user?.userId || "";
    const chatName = user?.profile?.name || user?.username || "Người dùng";

    const { listenNotification, listenCreateGroup, listenDisbandGroup, joinRoom, leaveRoom } = useChatSocket(chatUserId, chatName);

    const messageListMapRef = useRef<Map<string, any>>(new Map());
    const [userMap, setUserMap] = useState<{ [userId: string]: { name?: string; avatar?: string } }>({});

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
        // Add groupOwner field (if group)
        let groupOwner = "";
        if (conversationType === "group") {
            from = item.groupName ? `Nhóm: ${item.groupName}` : "Nhóm";
            avatar = item.groupAvatar;
            username = "";
            targetUserId = "";
            groupName = item.groupName || "";
            groupOwner = item.owner || "";
        } else {
            from = item.receiverName || "Người dùng";
            avatar = getCloudinaryImageLink(item.receiverAvatar, item.receiverAvatarCroppedArea, 56);
            username = item.receiverUsername || "";
            targetUserId = item.receiverId || item.receiver_id || "";
        }
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
            ...(conversationType === "group" ? { owner: groupOwner } : {}),
        };
        return msg;
    }

    useEffect(() => {
        (async () => {
            const response = await getMessageList();
            console.warn(response)
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

    const getUserAvatarForNotification = (avatarUrl?: string, nameForAvatar?: string) =>
        avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar || "A")}&background=random&size=128`;

    async function fetchNotiUserInfo(userIds: string[]): Promise<void> {
        if (userIds.length === 0) return;
        const needFetch = userIds.filter(
            (id) => !userMap[id]
        );
        if (needFetch.length === 0) return;
        try {
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

    useEffect(() => {
        const off = listenCreateGroup((data: any) => {
            // When a new group is created and pushed via socket, add to message list if not present
            console.log(data)
            if (!data?.conversationId) return;

            // Join the conversation room for real-time updates
            if (typeof joinRoom === "function") {
                joinRoom(data.conversationId);
            }

            const groupItem = {
                ...data,
                type: "group",
                conversationId: data.conversationId,
                groupName: data.groupName,
                groupAvatar: data.groupAvatar,
                createdAt: data.createdAt || new Date().toISOString(),
                owner: data.owner,
                latestMessage: null // new group, no latest message
            };

            // Prevent duplication if this group already in list
            setMessages(prev => {
                if (prev.some(msg => msg.conversationId === data.conversationId)) return prev;
                const groupMsg = conversationItemToMsg(groupItem, userId);
                // Put new group at top under self chat
                return [groupMsg, ...prev];
            });

            // Also update messageListMapRef to keep in sync for sockets
            messageListMapRef.current.set(
                String(data.conversationId),
                groupItem
            );
        });

        return () => {
            if (off) off();
        };
    }, [listenCreateGroup, joinRoom, userId]);

    // --------- Listen Leave Group event and remove group in message list and leaveRoom ---------
    useEffect(() => {
        if (typeof listenDisbandGroup !== "function") return;
        const off = listenDisbandGroup((data: any) => {
            // Assumes data contains the groupId or conversationId to leave
            // Remove the group from messageList (and ref)
            const leaveGroupId = String(data?.conversationId || data?.groupId || "");
            if (!leaveGroupId) return;

            // Remove from messages state
            setMessages(prev => prev.filter(msg => String(msg.conversationId) !== leaveGroupId));

            // Remove from ref map
            if (messageListMapRef.current && messageListMapRef.current.has(leaveGroupId)) {
                messageListMapRef.current.delete(leaveGroupId);
            }

            if (typeof leaveRoom === "function") {
                leaveRoom(leaveGroupId);
            }
        });
        return () => {
            if (typeof off === "function") off();
        };
    }, [listenDisbandGroup, leaveRoom]);

    // Sửa lỗi thông báo friendRequest không hiển thị khi action: "new" và chưa từng nhận trước đó
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
                // Keep all notification socket logic unchanged
                // ... (keep old code, do not touch for onNotification)
                // ----v-----
                console.log(data)
                let notification = data?.notification || data || {};
                let notiType = notification.type || data.type;
                let id = notification._id || data._id || ""; // always must have an id
                if (!id) id = Math.random().toString(36);
                let action = data.action || notification.action || "new";
                let reactType = notification.reactType || data.reactType || "like";
                let postId = notification.post || data.post || "";
                let fromUserId = notification.from || notification.user || data.user || "";
                let createdAt = notification.createdAt || data.createdAt || undefined;
                let avatarFromNoti = notification.avatar || data.avatar || "";
                let nameFromNoti = notification.name || data.name || "";

                // ===== FRIEND REQUEST notification handling =====
                if (notiType === "friendRequest") {
                    const friendRequestId = notification._id || data._id || "";
                    if (action === "delete") {
                        setNotifications((prev) =>
                            prev.filter(
                                (n) =>
                                    !isSameFriendRequestNotification(n, { friendRequestId, from: fromUserId })
                            )
                        );
                        return;
                    }
                    setNotifications((prev) => {
                        // Patch: fix trường hợp "new" chưa có trên prev thì vẫn thêm vào
                        const already = prev.some(n =>
                            isSameFriendRequestNotification(n, { friendRequestId, from: fromUserId })
                        );
                        if (!already) {
                            const friendReqContent = (
                                <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                                    <span>
                                        <span className="font-bold">{truncateName(nameFromNoti) || "Ai đó"}</span>
                                        &nbsp;đã gửi cho bạn lời mời kết bạn
                                    </span>
                                </span>
                            );
                            const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
                            const newNotif: ExtendedReactNotification = {
                                id: "friendRequest__" + (friendRequestId || fromUserId),
                                friendRequestId: friendRequestId,
                                from: fromUserId,
                                content: friendReqContent,
                                time: displayTime,
                                type: "friendRequest",
                                avatar: avatarFromNoti,
                                name: nameFromNoti,
                                notificationTypeIcon: faUserPlus,
                                notificationTypeIconColor: "#2563eb",
                                notificationTypeIconTitle: "Lời mời kết bạn"
                            };
                            return [newNotif, ...prev];
                        } else {
                            // Nếu đã có thì không thêm lại nữa.
                            return prev;
                        }
                    });
                    return;
                }

                // ===== ACCEPT FRIEND notification handling =====
                if (notiType === "acceptFriend") {
                    const acceptFriendId = notification._id || data._id || "";
                    if (action === "delete") {
                        setNotifications(prev =>
                            prev.filter(
                                n => !isSameAcceptFriendNotification(n, { acceptFriendId })
                            )
                        );
                        return;
                    }
                    setNotifications(prev => {
                        const already = prev.some(n =>
                            isSameAcceptFriendNotification(n, { acceptFriendId })
                        );
                        if (!already) {
                            const acceptFriendContent = (
                                <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                                    <span>
                                        <span className="font-bold">{truncateName(nameFromNoti) || "Ai đó"}</span>
                                        &nbsp;đã đồng ý lời mời kết bạn của bạn
                                    </span>
                                </span>
                            );
                            const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
                            const newNotif: ExtendedReactNotification = {
                                id: "acceptFriend__" + acceptFriendId,
                                content: acceptFriendContent,
                                time: displayTime,
                                type: "acceptFriend",
                                avatar: avatarFromNoti,
                                name: nameFromNoti,
                                notificationTypeIcon: faUserCheck,
                                notificationTypeIconColor: "#22c55e",
                                notificationTypeIconTitle: "Đã chấp nhận kết bạn"
                            };
                            return [newNotif, ...prev];
                        } else {
                            return prev;
                        }
                    });
                    return;
                }

                // ===== REACTION notification handling =====
                if (notiType === "react") {
                    if (action === "delete") {
                        setNotifications(prev => prev.filter(n =>
                            !isSameReactNotification(n, {
                                reactId: id,
                                post: postId,
                                from: fromUserId
                            })
                        ));
                        return;
                    }

                    setNotifications(prev => {
                        const filtered = prev.filter(n =>
                            !isSameReactNotification(n, {
                                reactId: id,
                                post: postId,
                                from: fromUserId
                            })
                        );

                        let actionText = "đã thả cảm xúc";
                        const notiContent =
                            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                                <span>
                                    <span className="font-bold">{truncateName(nameFromNoti) || "Ai đó"}</span>
                                    &nbsp;{actionText}
                                    {["like", "love", "fun", "sad", "angry"].includes(reactType)
                                        ? <span style={{ marginLeft: 4, opacity: 0.7, color: "#999" }}>{(() => {
                                            switch (reactType) {
                                                case "like": return "Thích";
                                                case "love": return "Yêu thích";
                                                case "fun": return "Haha";
                                                case "sad": return "Buồn";
                                                case "angry": return "Phẫn nộ";
                                                default: return "Cảm xúc";
                                            }
                                        })()}</span>
                                        : null
                                    }
                                </span>
                            </span>
                        ;
                        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
                        const newNotif: ExtendedReactNotification = {
                            id: "react__" + id,
                            reactId: id,
                            content: notiContent,
                            time: displayTime,
                            type: "react",
                            post: postId,
                            from: fromUserId,
                            reactType: reactType,
                            avatar: avatarFromNoti,
                            name: nameFromNoti,
                            notificationTypeIcon: reactTypeToFAIcon[reactType as keyof typeof reactTypeToFAIcon] || faThumbsUp,
                            notificationTypeIconColor: "#2563eb",
                            notificationTypeIconTitle: reactType
                        };

                        return [newNotif, ...filtered];
                    });
                    return;
                }

                // ===== COMMENT notification handling =====
                if (notiType === "comment") {
                    let commentId = notification._id || data._id || "";
                    if (!commentId) commentId = Math.random().toString(36);
                    if (action === "delete") {
                        setNotifications(prev =>
                            prev.filter(n =>
                                !isSameCommentNotification(n, {
                                    commentId,
                                    post: postId,
                                    from: fromUserId,
                                })
                            )
                        );
                        return;
                    }
                    setNotifications(prev => {
                        const filtered = prev.filter(n =>
                            !isSameCommentNotification(n, {
                                commentId,
                                post: postId,
                                from: fromUserId,
                            })
                        );

                        const notiContent =
                            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                                <span>
                                    <span className="font-bold">{truncateName(nameFromNoti) || "Ai đó"}</span>
                                    &nbsp;đã bình luận bài viết của bạn
                                </span>
                            </span>
                        ;
                        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
                        const newNotif: ExtendedReactNotification = {
                            id: "comment__" + commentId,
                            commentId,
                            content: notiContent,
                            time: displayTime,
                            type: "comment",
                            post: postId,
                            from: fromUserId,
                            avatar: avatarFromNoti,
                            name: nameFromNoti,
                            notificationTypeIcon: faComment,
                            notificationTypeIconColor: "#2563eb",
                            notificationTypeIconTitle: "Bình luận",
                        };
                        return [newNotif, ...filtered];
                    });
                    return;
                }

                // ===== SHARE notification handling =====
                if (notiType === "share") {
                    let shareId = notification._id || data._id || "";
                    if (!shareId) shareId = Math.random().toString(36);
                    if (action === "delete") {
                        setNotifications(prev =>
                            prev.filter(n => n.type !== "share" || String(n.id) !== "share__" + shareId)
                        );
                        return;
                    }
                    setNotifications(prev => {
                        const filtered = prev.filter(n =>
                            !(n.type === "share" && String(n.id) === "share__" + shareId)
                        );

                        const notiContent =
                            <span className="flex-1 min-w-0 block truncate flex items-center gap-2">
                                <span>
                                    <span className="font-bold">{truncateName(nameFromNoti) || "Ai đó"}</span>
                                    &nbsp;đã chia sẻ bài viết của bạn
                                </span>
                            </span>
                        ;
                        const displayTime = createdAt ? getTimeAgoVN(createdAt) : "vừa xong";
                        const newNotif: ExtendedReactNotification = {
                            id: "share__" + shareId,
                            content: notiContent,
                            time: displayTime,
                            type: "share",
                            post: postId,
                            from: fromUserId,
                            avatar: avatarFromNoti,
                            name: nameFromNoti,
                            notificationTypeIcon: faShare,
                            notificationTypeIconColor: "#2563eb",
                            notificationTypeIconTitle: "Chia sẻ",
                        };
                        return [newNotif, ...filtered];
                    });
                    return;
                }
            }
        });
        return () => { typeof off === "function" && off(); };
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
        owner,
    }: {
        type: string;
        userId: string;
        conversationId: string;
        name?: string;
        username?: string;
        avatar?: string;
        groupName?: string;
        owner?: string;
    }) => {
        if (type === "group") {
            openChat({
                id: conversationId,
                conversationId,
                title: groupName || name || "Nhóm",
                avatarUrl: avatar,
                type: "group",
                owner: owner,
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


    const handleGroupCreated = useCallback((group: any) => {
        if (!group?.conversationId) return;

        if (typeof joinRoom === "function") {
            joinRoom(group.conversationId);
        }

        // Compose group-like object for conversationItemToMsg
        const groupItem = {
            ...group,
            type: "group",
            conversationId: group.conversationId,
            groupName: group.groupName,
            groupAvatar: group.groupAvatar,
            createdAt: group.createdAt || new Date().toISOString(),
            owner: group.owner,
            latestMessage: null // new group, no latest message
        };

        // Prevent duplication if this group already in list
        setMessages(prev => {
            if (prev.some(msg => msg.conversationId === group.conversationId)) return prev;
            const groupMsg = conversationItemToMsg(groupItem, userId);
            // Put new group at top under self chat
            return [groupMsg, ...prev];
        });
        // Also update messageListMapRef to keep in sync for sockets
        messageListMapRef.current.set(
            String(group.conversationId),
            groupItem
        );
    }, [userId, joinRoom]);

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

    // --- Modified: show my/self chat always at top of list ---
    // Helper: SelfChatRow
    const SelfChatRow = () => (
        <li
            key="self-chat-row"
            className="flex items-center gap-4 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            style={{
                width: "340px",
                height: "75px",
                padding: "12px 14px",
                boxSizing: "border-box",
                borderBottom: "1px solid #e5e7eb",
                marginBottom: 2,
            }}
            onClick={() => {
                openChat &&
                    openChat({
                        id: "self",
                        conversationId: undefined,
                        title: myName || "Tôi",
                        avatarUrl: myAvatar,
                        type: "self"
                    });
                setOpenMsg(false);
            }}
        >
            <img
                src={myAvatar}
                alt={myName || "Tôi"}
                className="rounded-full object-cover border"
                style={{
                    width: "56px",
                    height: "56px",
                    minWidth: "56px",
                    minHeight: "56px",
                    border: "2px solid #2563eb",
                    background: "#e0e7ff",
                }}
            />
            <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: "100%" }}>
                <div className="font-semibold text-base truncate text-zinc-900 dark:text-zinc-100" style={{ lineHeight: "1.25" }}>
                    {myName || "Tôi"}
                    <span className="ml-2 px-2 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-100 border border-blue-300 dark:border-blue-800 font-normal">Bạn</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-sm truncate text-zinc-400 dark:text-zinc-500" style={{ lineHeight: "1.2" }}>
                        Ghi chú cá nhân
                    </span>
                    {/* Optionally, own chat does not show time field */}
                </div>
            </div>
        </li>
    );

    return (
        <>
            {/* ShowPostById when showPost=true and selectedPostId */}
            <ShowPostById
                postId={selectedPostId}
                isShow={showPost}
                onClose={handleClosePost}
            />
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
                                <span className="select-none text-white text-2xl font-bold">L</span>
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
                                    <div className="font-semibold mb-2 min-w-[350px] max-w-[400px] text-zinc-900 dark:text-zinc-100">Thông báo</div>
                                    <ul>
                                        {notifications.length === 0 && (
                                            <li className="py-3 text-center text-zinc-500">Không có thông báo mới</li>
                                        )}
                                        {notifications.map((n) => (
                                            <li
                                                key={n.id}
                                                className="py-2 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex gap-2 items-center"
                                                onClick={() => {
                                                    // Xử lý click vào thông báo lời mời kết bạn
                                                    if (n.type === "friendRequest" && n.from) {
                                                        router.push("/friends?key=received");
                                                        setOpenNotif(false);
                                                        return;
                                                    } else if (n.type === "acceptFriend") {
                                                        router.push("/friends");
                                                        setOpenNotif(false);
                                                        return;
                                                    }
                                                    if (n.post) {
                                                        setSelectedPostId(n.post);
                                                        setShowPost(true);
                                                        setOpenNotif(false);
                                                    }
                                                }}
                                            >
                                                {/* Avatar luôn nằm bên trái, name từ res */}
                                                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                                    {n.avatar && (
                                                        <img
                                                            src={n.avatar}
                                                            alt={n.name || "Avatar"}
                                                            className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 flex-shrink-0 mr-3"
                                                            style={{ minWidth: 36, minHeight: 36 }}
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-zinc-800 dark:text-zinc-200">{n.content}</div>
                                                        <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                                                            {
                                                                n.notificationTypeIcon &&
                                                                <FontAwesomeIcon
                                                                    icon={n.notificationTypeIcon}
                                                                    style={{ color: n.notificationTypeIconColor || "#2563eb" }}
                                                                    title={n.notificationTypeIconTitle || ""}
                                                                    className="mr-1 min-w-[15px]"
                                                                />
                                                            }
                                                            <span>{n.time}</span>
                                                        </div>
                                                    </div>
                                                </div>
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
                                        <div className="ml-2">
                                            <CreateGroupButton onGroupCreated={handleGroupCreated} />
                                        </div>
                                    </div>
                                    <MessagePrioritySwitch />
                                    <ul>
                                        {/* Always show self chat row at the top */}
                                        <SelfChatRow />
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
                                                        owner: m.owner, // pass owner if present (group)
                                                    };
                                                    handleMessageClick(msgInfo);
                                                }}
                                            >
                                                {m.type === "group" ? (
                                                    <GroupAvatar avatar={m.avatar} groupName={m.groupName} size={56} />
                                                ) : (
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
                                                )}
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
                {isBelow900 && (
                    <div
                        className="h-12 w-full flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm border-b border-zinc-100 dark:border-zinc-800"
                        style={{ padding: 0, position: "relative" }}
                    >
                        <div style={{ width: "100%", height: "100%" }}>
                            <HeaderMenuCenter />
                        </div>
                    </div>
                )}
            </header>
        </>
    );
}