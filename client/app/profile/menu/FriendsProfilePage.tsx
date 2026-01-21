
"use client";

import React, { useState, useEffect, useRef } from "react";
import RelationshipButton from "@/components/ui/RelationshipButton";
import { apiGetUserFriend } from "@/api/relationship.api";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";

// Chỉ còn 2 tab: "Bạn bè" và "Bạn chung"
const menuTabs = [
    { key: "friends", label: "Bạn bè" },
    { key: "mutual", label: "Bạn chung" },
];

type TabKey = "friends" | "mutual";
type User = {
    id: string;
    name: string;
    username: string;
    avatar: string;
    relationship?: any;
    avatarCroppedArea?: any;
};

const DUMMY_AVATAR = "/default-avatar.png";

function FriendsProfilePage({ userId }: { userId: string }) {
    const [tab, setTab] = useState<TabKey>("friends");

    const user = useSelector((state: any) => state.user);
    const myId = user.userId;

    const router = useRouter();

    // Responsive: thẻ nhỏ hơn 440px thì 1 dòng
    const [isSingleColumn, setIsSingleColumn] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const minCardWidth = 440;
    const maxCardWidth = 620;

    const [users, setUsers] = useState<User[]>([]);
    const [relationshipState, setRelationshipState] = useState<Record<string, any>>({});

    // Gọi apiGetUserFriend khi tab hoặc userId đổi và log kết quả
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const type = tab === "friends" ? "friend" : "mutual";
                const res = await apiGetUserFriend(userId, type as "friend" | "mutual");
                console.log("apiGetUserFriend response:", res);
                if (Array.isArray(res.friends)) {
                    // Convert result, add default avatar
                    const mapped: User[] = res.friends.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        username: f.username,
                        avatar: (f.bio && f.bio.avatar) ? f.bio.avatar : DUMMY_AVATAR,
                        avatarCroppedArea: (f.bio && f.bio.avatarCroppedStat) ? f.bio.avatarCroppedStat : undefined,
                        relationship: f.relationship,
                    }));
                    setUsers(mapped);
                } else {
                    setUsers([]);
                }
            } catch (error) {
                console.error("apiGetUserFriend error:", error);
                setUsers([]);
            }
        };
        if (userId) fetchFriends();
    }, [tab, userId]);

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

    // handleRelationshipChange cập nhật state cho từng user id
    const handleRelationshipChange = (userId: string, newRelationship: any, logId?: string) => {
        if (logId !== undefined) {
            console.log("handleRelationshipChange userId:", logId);
        } else {
            console.log("handleRelationshipChange userId:", userId);
        }
        setRelationshipState(prev => ({
            ...prev,
            [userId]: newRelationship
        }));
    };

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
                            onClick={() => setTab(m.key as TabKey)}
                            className={`px-6 py-2 rounded-lg font-semibold cursor-pointer text-base transition-colors
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
                    {users.length === 0 ? (
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
                                            src={usr.avatar}
                                            alt={usr.name}
                                            className="w-14 h-14 rounded-full object-cover border-2 border-[#3A3A3A] shadow-sm flex-shrink-0"
                                        />
                                        <div className="ml-4 flex-1">
                                            <div className="font-semibold text-[1.1rem] text-white truncate">
                                                {usr.name}
                                            </div>
                                            <div className="text-sm text-gray-400 truncate">
                                                @{usr.username}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Ẩn RelationshipButton nếu là chính mình */}
                                    {usr.id !== myId && (
                                        <div className="mt-4 w-full flex justify-end">
                                            <RelationshipButton
                                                relationship={
                                                    relationshipState[usr.id] !== undefined
                                                        ? relationshipState[usr.id]
                                                        : usr.relationship
                                                }
                                                myId={myId}
                                                userId={usr.id}
                                                name={usr.name}
                                                avatar={usr.avatar}
                                                avatarCroppedArea={usr.avatarCroppedArea}
                                                username={usr.username}
                                                onRelationshipChange={(id, rel) => handleRelationshipChange(id, rel, usr.id)}
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

export default FriendsProfilePage;

