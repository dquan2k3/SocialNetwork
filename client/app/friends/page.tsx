"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiGetFriend } from "@/api/relationship.api";
import RelationshipButton from "@/components/ui/RelationshipButton";
import { useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";

const menuTabs = [
    { key: "friends", label: "Bạn bè" },
    { key: "received", label: "Lời mời kết bạn" },
    { key: "sent", label: "Lời mời đã gửi" },
    { key: "birthdays", label: "Sinh nhật" },
];

type TabKey = "friends" | "received" | "sent" | "birthdays";
type User = {
    id: string;
    name: string;
    username: string;
    avatar: string;
    birthday?: string;
    birthdayIn?: number;
    relationship?: any;
    avatarCroppedArea?: any;
    message?: string;
    lastSeen?: string;
};

type FriendType = "friend" | "requester" | "recipient" | "birthday";

const tabToType: Record<TabKey, FriendType> = {
    friends: "friend",
    sent: "requester",
    received: "recipient",
    birthdays: "birthday",
};

function getAvatarFromBio(bio: any): string | undefined {
    // Sẽ trả undefined nếu không có avatar để kiểm soát fallback ở dưới
    if (bio && typeof bio.avatar === "string" && bio.avatar.length > 0) {
        return bio.avatar;
    }
    return undefined;
}

// Chỉ sử dụng avatarCroppedArea, không dùng avatarCroppedStat
function getAvatarCroppedAreaFromBio(bio: any): any {
    return bio && bio.avatarCroppedArea ? bio.avatarCroppedArea : undefined;
}

function getBirthdayFromField(f: any, tab: TabKey): string | undefined {
    if (tab === "birthdays" && typeof f.birthday === "string" && f.birthday.length > 0) {
        return f.birthday;
    }
    if (f.bio && typeof f.bio.birthday === "string" && f.bio.birthday.length > 0) {
        return f.bio.birthday;
    }
    return undefined;
}

// Helper to format last seen time
function getLastSeenStatus(lastSeen?: string): { status: string, color: string } {
    if (!lastSeen) return { status: "Không rõ trạng thái", color: "text-gray-400" };

    const now = new Date();
    const last = new Date(lastSeen);

    if (isNaN(last.getTime())) {
        return { status: "Không rõ trạng thái", color: "text-gray-400" };
    }

    // If lastSeen nằm ở tương lai
    if (last.getTime() > now.getTime()) {
        return { status: "Đang trực tuyến", color: "text-emerald-400" };
    }

    // Tính khoảng cách ms
    const diffMs = now.getTime() - last.getTime();
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    if (diffMs < min) return { status: "Vừa mới trực tuyến", color: "text-emerald-400"};
    if (diffMs < hour) {
        const m = Math.floor(diffMs / min);
        return { status: `Hoạt động ${m} phút trước`, color: "text-gray-300" };
    }
    if (diffMs < day) {
        const h = Math.floor(diffMs / hour);
        return { status: `Hoạt động ${h} giờ trước`, color: "text-gray-300" };
    }
    if (diffMs < month) {
        const d = Math.floor(diffMs / day);
        return { status: `Hoạt động ${d} ngày trước`, color: "text-gray-300" };
    }
    if (diffMs < year) {
        const mo = Math.floor(diffMs / month);
        return { status: `Hoạt động ${mo} tháng trước`, color: "text-gray-300" };
    }
    const y = Math.floor(diffMs / year);
    return { status: `Hoạt động ${y} năm trước`, color: "text-gray-300" };
}

// Only use .avatarCroppedArea (not avatarCroppedStat)
function mapServerFriendsToUserObjs(friends: any[], tab: TabKey): User[] {
    return friends.map((f) => {
        const avatarUrl = getAvatarFromBio(f.bio);
        const avatarCropped = getAvatarCroppedAreaFromBio(f.bio);
        // Nếu avatarUrl undefined (rỗng), thì dùng default luôn ở đây
        const fallbackDefaultAvatar = "/default-avatar.png";
        
        let resolvedAvatar = getCloudinaryImageLink(avatarUrl ?? "", avatarCropped, 56);
        if (!resolvedAvatar || resolvedAvatar === "" || resolvedAvatar === "undefined" || resolvedAvatar === "null") {
            // Trường hợp getCloudinaryImageLink trả về sai, dùng ảnh mặc định
            resolvedAvatar = fallbackDefaultAvatar;
        }
        return {
            id: String(f.id),
            name: f.name,
            username: f.username,
            avatar: resolvedAvatar,
            avatarCroppedArea: avatarCropped,
            relationship: f.relationship,
            birthday: getBirthdayFromField(f, tab),
            birthdayIn: tab === "birthdays" && typeof f.birthdayIn === "number" ? f.birthdayIn : undefined,
            lastSeen: tab === "friends" && f.lastSeen ? f.lastSeen : undefined,
            message: (tab === "received" || tab === "sent")
                ? (
                    f.relationship && typeof f.relationship === "object" && typeof f.relationship.message === "string"
                        ? f.relationship.message
                        : (typeof f.message === "string" ? f.message : undefined)
                )
                : undefined,
        };
    });
}

function FriendsPage() {
    const searchParams = useSearchParams();
    const keyParamRaw = searchParams?.get("key");

    // Accept both "sent" and "requester" for "sent" tab to match query ?key=requester
    const keyToTab = (key: string | null): TabKey => {
        if (key === "received") return "received";
        if (key === "birthdays") return "birthdays";
        if (key === "sent" || key === "requester") return "sent";
        return "friends";
    };

    const [tab, setTab] = useState<TabKey>(() => keyToTab(keyParamRaw));
    useEffect(() => {
        setTab(keyToTab(keyParamRaw));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyParamRaw]);

    const [usersByTab, setUsersByTab] = useState<Record<TabKey, User[]>>({
        friends: [],
        received: [],
        sent: [],
        birthdays: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const user = useSelector((state: any) => state.user);
    const myId = user.userId;

    const router = useRouter();

    // Responsive: thẻ nhỏ hơn 440px thì 1 dòng
    const [isSingleColumn, setIsSingleColumn] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const minCardWidth = 440;
    const maxCardWidth = 620;

    useEffect(() => {
        function handleResize() {
            if (!containerRef.current) return;
            const width = containerRef.current.offsetWidth;
            if (width < minCardWidth * 2 + 24) {
                setIsSingleColumn(true);
            } else {
                setIsSingleColumn(false);
            }
        }
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        setTimeout(() => {
            if (!containerRef.current) return;
            const width = containerRef.current.offsetWidth;
            if (width < minCardWidth * 2 + 24) {
                setIsSingleColumn(true);
            } else {
                setIsSingleColumn(false);
            }
        }, 120);
    }, [tab]);

    useEffect(() => {
        let cancelled = false;

        if (usersByTab[tab] && usersByTab[tab].length > 0) {
            setLoading(false);
            setError(null);
            return;
        }

        async function fetchUsers() {
            setLoading(true);
            setError(null);
            try {
                const type = tabToType[tab];
                const res = await apiGetFriend(type);
                console.log(res)
                if (!cancelled) {
                    const friendsArr = Array.isArray(res?.friends) ? res.friends : [];
                    setUsersByTab((prev) => ({
                        ...prev,
                        [tab]: mapServerFriendsToUserObjs(friendsArr, tab),
                    }));
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError("Đã xảy ra lỗi khi lấy dữ liệu.");
                    setUsersByTab((prev) => ({ ...prev, [tab]: [] }));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchUsers();
        return () => {
            cancelled = true;
        };
    }, [tab]);

    const users = usersByTab[tab] ?? [];

    const handleRelationshipChange = (userId: string, newRelationship: any) => {
        setUsersByTab((prev) => {
            const next = { ...prev };
            (Object.keys(next) as TabKey[]).forEach(tabKey => {
                next[tabKey] = next[tabKey].map(user =>
                    user.id === userId
                        ? { ...user, relationship: newRelationship }
                        : user
                );
            });
            return next;
        });
    };

    function renderMessage(usr: User) {
        if ((tab === "received" || tab === "sent")) {
            if (!usr.relationship) {
                return null;
            }
            const relMsg = usr.relationship?.message;
            const fallbackMsg = usr.message;
            if (typeof relMsg === "string" && relMsg.length > 0) {
                return relMsg;
            }
            if (typeof fallbackMsg === "string" && fallbackMsg.length > 0) {
                return fallbackMsg;
            }
        }
        return null;
    }

    function renderLastSeenStatus(usr: User) {
        if (tab === "friends") {
            const { status, color } = getLastSeenStatus(usr.lastSeen);
            return (
                <div className={`mt-[2px] text-xs font-medium ${color}`}>
                    {status}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="flex flex-1 flex-col bg-[#202124] min-h-full py-6 px-0 items-center">
            <div
                className="w-full"
                style={{
                    width: "clamp(480px, 60vw, 100%)",
                    maxWidth: "1280px",
                }}
            >
                <div className="flex flex-row gap-2 mb-8 justify-center">
                    {menuTabs.map((m) => (
                        <button
                            key={m.key}
                            onClick={() => {
                                setTab(m.key as TabKey);
                                // Không cập nhật url khi chuyển tab nữa
                            }}
                            className={`px-6 py-2 rounded-lg font-semibold text-base transition-colors
                ${tab === m.key
                                    ? "bg-[#3B3D3E] text-[#5CB5FA]"
                                    : "bg-[#242426] text-gray-300"}
                hover:bg-[#31373E]
              `}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                <div
                    className="bg-[#23272F] rounded-2xl shadow p-6 min-h-[360px]"
                    ref={containerRef}
                >
                    {loading ? (
                        <p className="text-center text-gray-400">Đang tải...</p>
                    ) : error ? (
                        <p className="text-center text-red-400">{error}</p>
                    ) : users.length === 0 ? (
                        <p className="text-center text-gray-400">Không có dữ liệu.</p>
                    ) : (
                        <div
                            className={
                                `grid gap-6` +
                                (isSingleColumn
                                    ? " grid-cols-1"
                                    : " grid-cols-1 sm:grid-cols-2 ")
                            }
                        >
                            {users.map((usr) => (
                                <div
                                    key={usr.id}
                                    className="flex flex-col sm:flex-col items-start bg-[#292B2F] rounded-xl px-4 py-3 shadow group transition-colors hover:bg-[#32353b] relative mx-auto"
                                    style={{
                                        minHeight: 72,
                                        width: "100%",
                                        minWidth: isSingleColumn ? undefined : minCardWidth,
                                        maxWidth: maxCardWidth,
                                    }}
                                >
                                    <div
                                        className="flex flex-row items-center w-full cursor-pointer select-none"
                                        onClick={() => router.push(`/profile/${usr.id}`)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                router.push(`/profile/${usr.id}`);
                                            }
                                        }}
                                    >
                                        <img
                                            src={usr.avatar && usr.avatar !== "undefined" && usr.avatar !== "null" && usr.avatar.trim() !== "" ? usr.avatar : "/default-avatar.png"}
                                            alt={usr.name}
                                            className="w-14 h-14 rounded-full object-cover border-2 border-[#3A3A3A] shadow-sm flex-shrink-0"
                                            onError={(e) => {
                                                const target = e.currentTarget as HTMLImageElement;
                                                if (target.src !== window.location.origin + "/default-avatar.png") {
                                                    target.src = "/default-avatar.png";
                                                }
                                            }}
                                        />
                                        <div className="ml-4 flex-1">
                                            <div className="font-semibold text-[1.1rem] text-white truncate">
                                                {usr.name}
                                            </div>
                                            <div className="text-sm text-gray-400 truncate">
                                                @{usr.username}
                                            </div>
                                            {tab === "friends" && renderLastSeenStatus(usr)}
                                            {tab === "birthdays" && usr.birthday && (
                                                <div className="mt-1 text-sm text-[#5CB5FA] font-semibold">
                                                    🎂 {usr.birthdayIn} ngày nữa là đến sinh nhật
                                                    {typeof usr.birthdayIn === "number" && (
                                                        <span className="ml-2 text-xs text-[#8ee4ff] font-normal">
                                                            ({new Date(usr.birthday).toLocaleDateString("vi-VN")})
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                    {(tab === "received" || tab === "sent") && renderMessage(usr) && (
                                        <div className="mt-2 mb-1 text-sm text-[#C7E5FF] px-3 py-2 rounded whitespace-pre-line max-w-full break-words font-normal">
                                            {renderMessage(usr)}
                                        </div>
                                    )}
                                    {tab !== "birthdays" && (
                                        <div className="mt-4 w-full flex justify-end">
                                            <RelationshipButton
                                                relationship={usr.relationship}
                                                myId={myId}
                                                userId={usr.id}
                                                name={usr.name}
                                                avatar={usr.avatar}
                                                avatarCroppedArea={usr.avatarCroppedArea}
                                                username={usr.username}
                                                onRelationshipChange={handleRelationshipChange}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FriendsPage;

