"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiLoadMember, apiAcceptMember, apiRejectMember, apiBanMember } from "@/api/group.api";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { useSelector } from "react-redux";

// Hàm tính số ngày còn lại đến lúc unban
function getDaysLeft(bannedTill?: string) {
    if (!bannedTill) return null;
    const till = new Date(bannedTill).getTime();
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;
    // Làm tròn lên để đếm ngày hiện tại nếu còn vài giờ
    return Math.max(0, Math.ceil((till - now) / msPerDay));
}

function Avatar({
    src,
    size,
    className,
}: {
    src?: string;
    size?: number;
    className?: string;
}) {
    return (
        <img
            src={src || "https://ui-avatars.com/api/?name=User&background=random"}
            alt="avatar"
            width={size || 40}
            height={size || 40}
            className={className || "rounded-full"}
            style={{
                objectFit: "cover",
                width: size || 40,
                height: size || 40,
            }}
        />
    );
}

function BanModal({
    open,
    onClose,
    onBan,
    memberName,
}: {
    open: boolean;
    onClose: () => void;
    onBan: (days: number) => void;
    memberName: string;
}) {
    const [days, setDays] = useState<number>(7);

    // Chỉ đóng modal khi ấn Hủy, không làm gì thêm
    const handleCancel = () => {
        onClose();
    };

    if (!open) return null;
    return (
        <div
            className="fixed z-50 inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={onClose}
        >
            <div
                className="bg-[#232427] p-6 rounded-xl shadow-xl min-w-[320px] w-full max-w-xs"
                onClick={e => e.stopPropagation()}
            >
                <div className="font-bold text-xl text-white mb-3">
                    Cấm thành viên
                </div>
                <div className="text-[#b0b3b8] mb-2">
                    Bạn muốn cấm <span className="text-white font-semibold">{memberName}</span> trong bao nhiêu ngày?
                </div>
                <input
                    className="w-full px-3 py-2 rounded-lg bg-[#252728] border border-[#323334] text-white mb-4 focus:outline-none"
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                />
                <div className="flex gap-3 justify-end mt-2">
                    <button
                        type="button"
                        className="px-4 py-2 bg-[#323334] rounded-lg text-[#b0b3b8] hover:bg-[#252728] transition"
                        onClick={handleCancel}
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        className="px-5 py-2 rounded-lg bg-[#F87171] text-white font-semibold hover:bg-[#e04545] transition"
                        onClick={() => { onBan(days); onClose(); }}
                    >
                        Cấm
                    </button>
                </div>
            </div>
        </div>
    );
}

// Custom hook debounce for search input
function useDebouncedValue<T>(value: T, delay: number) {
    const [debounced, setDebounced] = useState(value);
    const timer = useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
            setDebounced(value);
        }, delay);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [value, delay]);
    return debounced;
}

interface GroupMemberTabProps {
    groupId?: string;
    isOwner?: boolean;
    memberCount: number;
    onChangeMember: (count: number) => void;
}

type MemberApiData = {
    groupId: string;
    joinedAt?: string;
    requestedAt?: string;
    message?: string;
    role: string;
    status: string;
    bannedTill?: string;
    user: {
        avatar?: any;
        avatarCroppedArea?: any;
        name: string;
        userId: string;
    };
    _id: string;
};

const GroupMemberTab: React.FC<GroupMemberTabProps> = ({ groupId, isOwner, memberCount, onChangeMember }) => {
    const router = useRouter();

    const [banModalOpen, setBanModalOpen] = useState(false);
    const [selectedBanMember, setSelectedBanMember] = useState<{id:string, name:string}|null>(null);

    // API state
    const [members, setMembers] = useState<MemberApiData[]>([]);
    const [pending, setPending] = useState<MemberApiData[]>([]);

    // Loading state for apiLoadMember
    const [loading, setLoading] = useState<boolean>(true);

    // SEARCH ==========
    const [searchMembers, setSearchMembers] = useState("");
    const [searchPending, setSearchPending] = useState("");
    const debouncedMemberSearch = useDebouncedValue(searchMembers, 500);
    const debouncedPendingSearch = useDebouncedValue(searchPending, 500);

    // FILTEREDs
    const filteredMembers = React.useMemo(() =>
        members.filter(m =>
            m.user.name.toLowerCase().includes(debouncedMemberSearch.trim().toLowerCase())
        ), [members, debouncedMemberSearch]
    );

    const filteredPending = React.useMemo(() =>
        pending.filter(m =>
            m.user.name.toLowerCase().includes(debouncedPendingSearch.trim().toLowerCase())
        ), [pending, debouncedPendingSearch]
    );

    const user = useSelector((state: any) => state.user);
    const userId = user?.userId;

    // ==========

    // Khi cấm thành viên, chuyển họ sang pending với status = "banned"
    // Nếu thành công, memberCount--
    const handleBan = async (userIdToBan: string, days: number) => {
        if (!groupId) return;
        try {
            // Xác định memberToBan ở ngoài setMembers để log đúng giá trị
            const memberToBan = members.find(m => m.user.userId === userIdToBan);
            if (!memberToBan) {
                alert("Không tìm thấy thành viên để cấm.");
                return;
            }
            const res = await apiBanMember({ groupId, userId: userIdToBan, days });
            if (res && res.success) {
                // Xóa khỏi members, thêm bản banned vào pending
                setMembers((prevMembers) =>
                    prevMembers.filter(m => m.user.userId !== userIdToBan)
                );

                // Tạo bản bannedMember
                const now = new Date();
                let bannedTill: string | undefined;
                if (res.bannedTill) {
                    bannedTill = res.bannedTill;
                } else {
                    now.setDate(now.getDate() + days);
                    bannedTill = now.toISOString();
                }
                const bannedMember: MemberApiData = {
                    ...memberToBan,
                    status: "banned",
                    bannedTill,
                    joinedAt: undefined, // xóa joinedAt vì về pending
                    requestedAt: new Date().toISOString()
                };

                setPending(prevPending => [...prevPending, bannedMember]);

                // Log đúng giá trị của memberToBan
                console.log(memberToBan);

                // Nếu memberToBan đã tồn tại và được xử lý, giảm memberCount
                onChangeMember(memberCount - 1);
            } else {
                alert(res?.message || "Có lỗi xảy ra khi cấm thành viên.");
            }
        } catch (err) {
            alert("Có lỗi xảy ra khi cấm thành viên.");
            console.error(err);
        }
    };

    // Unban logic: chuyển từ pending sang members (memberCount++)
    const handleUnbanRequest = async (pendingUserId: string) => {
        if (!groupId) return;
        try {
            const res = await apiAcceptMember({ groupId, userId: pendingUserId });
            if (res && res.success) {
                const userToUnban = pending.find(u => u.user.userId === pendingUserId);
                if (!userToUnban) return;
                setPending(prev => prev.filter(u => u.user.userId !== pendingUserId));
                setMembers(prev => [...prev, userToUnban]);
                // Nếu userToUnban tồn tại, tăng memberCount
                onChangeMember(memberCount + 1);
            } else {
                alert(res?.message || "Có lỗi xảy ra khi hủy cấm.");
            }
        } catch (err) {
            alert("Có lỗi xảy ra khi hủy cấm.");
            console.error(err);
        }
    };

    // Xử lý khi mở modal cấm
    const openBanModal = (member: {id:string, name:string}) => {
        setSelectedBanMember(member);
        setBanModalOpen(true);
    };

    // Đóng modal cấm
    const closeBanModal = () => {
        setSelectedBanMember(null);
        setBanModalOpen(false);
        if ((window as any).handleBanModalCancelUnban) {
            delete (window as any).handleBanModalCancelUnban;
        }
    };

    // Chấp nhận yêu cầu: chuyển từ pending sang members (memberCount++)
    const handleAcceptRequest = async (pendingUserId: string) => {
        if (!groupId) return;
        try {
            const res = await apiAcceptMember({ groupId, userId: pendingUserId });
            if (res && res.success) {
                const userItem = pending.find(u => u.user.userId === pendingUserId);
                if (!userItem) return;
                setPending(prev => prev.filter(u => u.user.userId !== pendingUserId));
                setMembers(prev => [...prev, userItem]);
                // Nếu userItem tồn tại, tăng memberCount
                onChangeMember(memberCount + 1);
            } else {
                alert(res?.message || "Có lỗi xảy ra khi chấp nhận yêu cầu.");
            }
        } catch (err) {
            alert("Có lỗi xảy ra khi chấp nhận yêu cầu.");
            console.error(err);
        }
    };

    // Từ chối yêu cầu: chỉ xóa khỏi pending, memberCount không đổi
    const handleRejectRequest = async (pendingUserId: string) => {
        if (!groupId) return;
        try {
            const res = await apiRejectMember({ groupId, userId: pendingUserId });
            if (res && res.success) {
                setPending(prev => prev.filter(u => u.user.userId !== pendingUserId));
            } else {
                alert(res?.message || "Có lỗi xảy ra khi từ chối yêu cầu.");
            }
        } catch (err) {
            alert("Có lỗi xảy ra khi từ chối yêu cầu.");
            console.error(err);
        }
    };

    // ========== NEW EFFECT CALL API ==========
    useEffect(() => {
        if (!groupId) return;
        setLoading(true); // Set loading to true before call
        apiLoadMember({ groupId }).then(res => {
            if (res && res.success) {
                setMembers(Array.isArray(res.members) ? res.members : []);
                setPending(Array.isArray(res.pending) ? res.pending : []);
            }
        }).catch(err => {
            console.error("apiLoadMember error:", err);
        }).finally(() => {
            setLoading(false);
        });
    }, [groupId]);
    // =========================================

    // Helper for avatar
    function get56Avatar(user: MemberApiData["user"]) {
        return getCloudinaryImageLink(user.avatar, user.avatarCroppedArea, 56) || undefined;
    }

    // Helper for clicking on user (avatar, name)
    function gotoProfile(userId: string) {
        router.push(`/profile/${userId}`);
    }

    return (
        <div className="w-full h-full flex items-center justify-center item">
            <div
                className="bg-[#252728]  p-8 rounded-lg text-white min-h-[300px] min-w-[645px] flex flex-col items-stretch"
            >
                <div className="text-2xl font-bold mb-6">Thành viên nhóm</div>
                <div
                    className="flex flex-row gap-8 justify-center items-start"
                    style={{
                        minHeight: 450,
                        height: 500,
                        maxHeight: 540,
                        width: 830,
                        maxWidth: "100%",
                    }}
                >
                    {/* Members List */}
                    <div
                        className="flex flex-col flex-1 max-w-[390px] min-w-[270px] h-full"
                    >
                        <div className="font-bold text-lg mb-3">Thành viên</div>
                        <div className="mb-3">
                            <input
                                className="w-full px-3 py-2 rounded-lg bg-[#252728] border border-[#323334] text-white mb-2 focus:outline-none"
                                type="text"
                                placeholder="Tìm thành viên..."
                                value={searchMembers}
                                onChange={e => setSearchMembers(e.target.value)}
                            />
                        </div>
                        <div className="overflow-auto border border-[#323334] rounded-md flex-1 min-h-[0] custom-scroll">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-[#232427] text-[#b0b3b8] sticky top-0 z-10">
                                        <th className="py-3 px-4 font-semibold w-full" colSpan={2}>Thành viên</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td className="py-4 px-4 text-[#b0b3b8] w-full" colSpan={2}>
                                                Đang load...
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMembers.length === 0 && (
                                            <tr>
                                                <td className="py-4 px-4 text-[#b0b3b8] w-full" colSpan={2}>Không có thành viên nào.</td>
                                            </tr>
                                        )
                                    )}
                                    {filteredMembers.map((member) => (
                                        <tr
                                            key={member._id}
                                            className="border-t border-[#323334] hover:bg-[#2f3133] transition w-full"
                                            style={{ width: "100%" }}
                                        >
                                            <td
                                                className="px-4 w-full"
                                                colSpan={2}
                                                style={{
                                                    paddingTop: "0.75rem",
                                                    paddingBottom: "0.75rem",
                                                }}
                                            >
                                                {/* User row: info left, actions right on the next line */}
                                                <div className="flex flex-col w-full">
                                                    <div className="flex items-center w-full mb-1">
                                                        <div
                                                            className="flex items-center gap-3 cursor-pointer"
                                                            onClick={() => gotoProfile(member.user.userId)}
                                                        >
                                                            <Avatar size={56} src={get56Avatar(member.user)} />
                                                            <span className="text-white">{member.user.name}</span>
                                                        </div>
                                                    </div>
                                                    {!!isOwner && member.user.userId !== userId && (
                                                        <div className="flex justify-end w-full">
                                                            <button
                                                                className="px-4 py-2 bg-[#F87171] text-white rounded-lg hover:bg-[#e04545] transition"
                                                                onClick={() => openBanModal({id: member.user.userId, name: member.user.name})}
                                                                title="Cấm"
                                                                type="button"
                                                            >
                                                                Cấm
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Pending Requests List */}
                    <div
                        className="flex flex-col flex-1 max-w-[390px] min-w-[270px] h-full"
                    >
                        <div className="font-bold text-lg mb-3">Đang chờ ({pending.length})</div>
                        <div className="mb-3">
                            <input
                                className="w-full px-3 py-2 rounded-lg bg-[#252728] border border-[#323334] text-white mb-2 focus:outline-none"
                                type="text"
                                placeholder="Tìm người yêu cầu..."
                                value={searchPending}
                                onChange={e => setSearchPending(e.target.value)}
                            />
                        </div>
                        <div className="overflow-auto border border-[#323334] rounded-md flex-1 min-h-[0] custom-scroll">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-[#232427] text-[#b0b3b8] sticky top-0 z-10">
                                        <th className="py-3 px-4 font-semibold w-full" colSpan={2}>Người dùng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td className="py-4 px-4 text-[#b0b3b8] w-full" colSpan={2}>
                                                Đang load...
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPending.length === 0 && (
                                            <tr>
                                                <td className="py-4 px-4 text-[#b0b3b8] w-full" colSpan={2}>Không có yêu cầu nào.</td>
                                            </tr>
                                        )
                                    )}
                                    {filteredPending.map((user) => {
                                        // Check if user in pending is banned
                                        const isBannedPending =
                                            user.status === "banned" &&
                                            !!user.bannedTill;
                                        let daysLeft = isBannedPending
                                            ? getDaysLeft(user.bannedTill)
                                            : null;

                                        return (
                                            <tr
                                                key={user._id}
                                                className="border-t border-[#323334] hover:bg-[#2f3133] transition w-full"
                                                style={{ width: "100%" }}
                                            >
                                                <td
                                                    className="px-4 w-full"
                                                    colSpan={2}
                                                    style={{
                                                        paddingTop: "0.75rem",
                                                        paddingBottom: "0.75rem",
                                                    }}
                                                >
                                                    {/* User row: info left, message in center, action buttons right */}
                                                    <div className="flex flex-col w-full">
                                                        <div className="flex items-center w-full mb-1">
                                                            <div
                                                                className="flex items-center gap-3 cursor-pointer"
                                                                onClick={() => gotoProfile(user.user.userId)}
                                                            >
                                                                <Avatar size={56} src={get56Avatar(user.user)} />
                                                                <span className="text-white">{user.user.name}</span>
                                                            </div>
                                                        </div>
                                                        {/* Message Section */}
                                                        {!isBannedPending && user.message && user.message.trim() !== "" && (
                                                            <div className="flex justify-center mb-2">
                                                                <span className="bg-[#323334] px-3 py-1 rounded text-[#b0b3b8] text-sm text-center">
                                                                    Lời nhắn: {user.message}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Hiển thị số ngày còn lại sẽ hủy cấm nếu user bị ban */}
                                                        {isBannedPending && daysLeft !== null && (
                                                            <div className="flex justify-center mb-2">
                                                                <span className="bg-[#323334] px-3 py-1 rounded text-[#fbbf24] text-sm text-center">
                                                                    Còn {daysLeft} ngày sẽ hủy cấm
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Buttons */}
                                                        {!!isOwner && user.user.userId !== userId && (
                                                            <div className="flex justify-end w-full gap-2">
                                                                {/* Nếu là banned thì chỉ hiển thị button "Hủy cấm" */}
                                                                {isBannedPending ? (
                                                                    <button
                                                                        className="px-4 py-2 bg-[#40c057] text-white rounded-lg hover:bg-[#37b24d] transition"
                                                                        onClick={() => handleUnbanRequest(user.user.userId)}
                                                                        type="button"
                                                                    >
                                                                        Hủy cấm
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            className="px-4 py-2 bg-[#40c057] text-white rounded-lg hover:bg-[#37b24d] transition"
                                                                            onClick={() => handleAcceptRequest(user.user.userId)}
                                                                            type="button"
                                                                        >
                                                                            Chấp nhận
                                                                        </button>
                                                                        <button
                                                                            className="px-4 py-2 bg-[#F87171] text-white rounded-lg hover:bg-[#e04545] transition"
                                                                            onClick={() => handleRejectRequest(user.user.userId)}
                                                                            type="button"
                                                                        >
                                                                            Từ chối
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <BanModal
                    open={banModalOpen}
                    onClose={closeBanModal}
                    memberName={selectedBanMember?.name || ""}
                    onBan={(days) => {
                        if (selectedBanMember) handleBan(selectedBanMember.id, days);
                    }}
                />
            </div>
        <div style={{ height: 30 }} />
        </div>
    );
};

export default GroupMemberTab;
