"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faQuestionCircle, faCrown } from "@fortawesome/free-solid-svg-icons";
import {
    apiLoadGroupManager,
    apiChangeNeedApproval,
    apiDeclineUser,
    apiKickUser,
    apiApproveUser,
    apiTransferOwner,
} from "@/api/conversation.api";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";

// Basic Avatar component - dùng luôn getCloudinaryImageLink với avatarCroppedArea nếu có
function SimpleAvatar({
    src,
    size = 40,
    icon,
    alt = "",
    className = "",
    croppedArea,
}: {
    src?: string;
    size?: number;
    icon?: React.ReactNode;
    alt?: string;
    className?: string;
    croppedArea?: any;
}) {
    // Dùng cloudinary crop nếu có croppedArea & src
    let avatarSrc = src;

    avatarSrc = getCloudinaryImageLink(src, croppedArea, size ? size * 2 : undefined);

    return (
        <span
            className={`inline-block bg-gray-600 rounded-full overflow-hidden ${className}`}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {avatarSrc ? (
                <img src={avatarSrc} alt={alt} style={{ width: size, height: size, objectFit: "cover" }} />
            ) : icon ? (
                icon
            ) : (
                <FontAwesomeIcon icon={faUser} color="#E5E7EB" /* tailwind gray-200 */ />
            )}
        </span>
    );
}

// Simple Switch component
function SimpleSwitch({
    checked,
    onChange,
    checkedChildren = "On",
    unCheckedChildren = "Off",
}: {
    checked: boolean;
    onChange: (c: boolean) => any;
    checkedChildren?: React.ReactNode;
    unCheckedChildren?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={checked}
            className={`relative inline-flex items-center h-7 rounded-full w-14 transition-colors outline-none focus:ring-2 ${checked ? "bg-blue-500" : "bg-gray-700"
                }`}
            style={{ minWidth: 52, border: "none", cursor: "pointer" }}
            onClick={() => onChange(!checked)}
        >
            <span
                className={`inline-block h-6 w-6 transform rounded-full ${checked ? "bg-white" : "bg-gray-200"
                    } shadow transition-transform duration-200`}
                style={{ transform: checked ? "translateX(28px)" : "translateX(2px)" }}
            />
            <span
                className={`absolute text-xs font-bold`}
                style={{
                    left: checked ? 8 : 30,
                    color: checked ? "#fff" : "#d1d5db",
                    transition: "left 0.18s, color 0.18s",
                    fontWeight: 700,
                    minWidth: 17,
                }}
            >
                {checked ? checkedChildren : unCheckedChildren}
            </span>
        </button>
    );
}

// Confirm dialog overlay, translucent (dark mode)
function ConfirmDialog({
    open,
    title,
    icon,
    onOk,
    onCancel,
    okText = "OK",
    cancelText = "Hủy",
    children,
    translucent = true,
}: {
    open: boolean;
    title: string;
    icon?: React.ReactNode;
    onOk: () => void;
    onCancel: () => void;
    okText?: string;
    cancelText?: string;
    children?: React.ReactNode;
    translucent?: boolean;
}) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{
                background: translucent
                    ? "rgba(23,24,37, 0.36)"
                    : "rgba(0,0,0,0.68)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                zIndex: 59,
            }}
            tabIndex={-1}
        >
            <div className="bg-gray-800 bg-opacity-95 p-6 rounded-xl shadow-md min-w-[280px] max-w-xs relative border border-gray-700">
                <div className="flex items-center mb-3 gap-2">
                    {icon && <span className="text-xl">{icon}</span>}
                    <span className="font-bold text-lg text-gray-100">{title}</span>
                </div>
                <div className="mb-3 text-gray-200">{children}</div>
                <div className="flex gap-3 justify-end">
                    <button
                        className="px-4 rounded py-1 font-bold border border-gray-500 hover:bg-gray-700 transition text-gray-200"
                        onClick={onCancel}
                        type="button"
                    >
                        {cancelText}
                    </button>
                    <button
                        className="px-4 py-1 rounded font-bold bg-blue-600 text-white hover:bg-blue-800 transition"
                        onClick={onOk}
                        type="button"
                    >
                        {okText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GroupChatManagerPage() {
    const searchParams = useSearchParams();
    const groupId = searchParams.get("idg") || "";

    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [approval, setApproval] = useState(true);

    const [confirmState, setConfirmState] = useState<{
        type: "removeMember" | "rejectWait" | "transferOwner" | null;
        id: string | null;
    }>({ type: null, id: null });

    const [busy, setBusy] = useState(false);

    // Ô tìm kiếm cho mỗi danh sách
    const [searchMember, setSearchMember] = useState("");
    const [searchWaiting, setSearchWaiting] = useState("");

    // Kiểm tra quyền owner
    const [isOwner, setIsOwner] = useState(false);
    const [apiError, setApiError] = useState(false);

    // Gọi API để lấy thông tin group thực tế
    const fetchGroupApi = async () => {
        if (!groupId) return;
        setLoading(true);
        setApiError(false);
        try {
            const res = await apiLoadGroupManager(groupId);
            console.log(res)
            setGroup(res);
            setApproval(res.requireApproval ?? res.needApproval ?? false);
            setIsOwner(true);
        } catch (e) {
            setGroup(null);
            setIsOwner(false);
            setApiError(true);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (groupId) {
            fetchGroupApi();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    // Remove member
    const handleRemoveMember = async (userId: string) => {
        if (!group) return;
        setBusy(true);
        try {
            await apiKickUser(groupId, userId);
        } catch (e) {
            console.error("Failed to kick user:", e);
        }
        setBusy(false);
        await fetchGroupApi();
    };

    // Chuyển quyền sở hữu nhóm
    const handleTransferOwner = async (userId: string) => {
        setBusy(true);
        try {
            await apiTransferOwner(groupId, userId);
        } catch (e) {
            console.error("Failed to transfer owner:", e);
        }
        setBusy(false);
        await fetchGroupApi();
    };

    // Change approval require setting
    const handleApprovalChange = async (checked: boolean) => {
        const res = await apiChangeNeedApproval(groupId);
        console.log(res)
        setApproval(checked);
        setGroup((g: any) => g && { ...g, requireApproval: checked });
    };

    // Approve/reject waiting
    const handleApproveUser = async (userId: string) => {
        setBusy(true);
        try {
            await apiApproveUser(groupId, userId);
        } catch (e) {
            console.error("Failed to approve user:", e);
        }
        setBusy(false);
        await fetchGroupApi();
    };
    const handleRejectUser = async (userId: string) => {
        const res = await apiDeclineUser(groupId, userId)
        console.warn(res)
        setBusy(true);
        setBusy(false);
        await fetchGroupApi();
    };

    if (!groupId) {
        return (
            <div
                style={{
                    minHeight: 300,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#23272e",
                    color: "#fff",
                }}
            >
                Không tìm thấy nhóm (idg)!
            </div>
        );
    }

    if (loading) {
        return (
            <div
                style={{
                    minHeight: 300,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#23272e",
                }}
            >
                <svg
                    className="animate-spin mr-2 h-9 w-9 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx={12}
                        cy={12}
                        r={10}
                        stroke="currentColor"
                        strokeWidth={4}
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                </svg>
            </div>
        );
    }

    if (apiError || !isOwner) {
        return (
            <div
                style={{
                    minHeight: 300,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#23272e",
                    color: "#fff",
                }}
            >
                Bạn không có quyền quản lý nhóm này.
            </div>
        );
    }

    // force fallback for safety
    const members = Array.isArray(group.members) ? group.members : [];
    const waiting = Array.isArray(group.waiting) ? group.waiting : [];
    const ownerId = group.ownerId;

    // Lọc danh sách thành viên theo ô tìm kiếm
    const filteredMembers = searchMember.trim()
        ? members.filter(
            (m: any) =>
                m.name &&
                m.name.toLowerCase().includes(searchMember.trim().toLowerCase())
        )
        : members;

    // Lọc danh sách chờ duyệt theo ô tìm kiếm
    const filteredWaiting = searchWaiting.trim()
        ? waiting.filter(
            (w: any) =>
                w.name &&
                w.name.toLowerCase().includes(searchWaiting.trim().toLowerCase())
        )
        : waiting;

    return (
        <div
            className="max-w-4xl mx-auto mt-10 p-8 rounded shadow border"
            style={{
                minHeight: 470,
                background: "#23272e",
                borderColor: "#393944",
            }}
        >
            {/* Confirm Popover for Remove Member/Reject/Transfer */}
            <ConfirmDialog
                open={!!confirmState.type}
                title={
                    confirmState.type === "removeMember"
                        ? "Bạn có chắc muốn đuổi thành viên này?"
                        : confirmState.type === "rejectWait"
                            ? "Từ chối người này khỏi nhóm?"
                            : confirmState.type === "transferOwner"
                                ? "Chuyển quyền trưởng nhóm cho thành viên này?"
                                : ""
                }
                icon={
                    <FontAwesomeIcon
                        icon={faQuestionCircle}
                        style={{ color: "#60a5fa", fontSize: 18 }}
                    />
                }
                okText={
                    confirmState.type === "removeMember"
                        ? "Đuổi"
                        : confirmState.type === "rejectWait"
                            ? "Từ chối"
                            : confirmState.type === "transferOwner"
                                ? "Chuyển"
                                : "OK"
                }
                cancelText="Huỷ"
                onOk={async () => {
                    const { type, id } = confirmState;
                    if (type === "removeMember" && id) {
                        setConfirmState({ type: null, id: null });
                        await handleRemoveMember(id);
                    } else if (type === "rejectWait" && id) {
                        setConfirmState({ type: null, id: null });
                        await handleRejectUser(id);
                    } else if (type === "transferOwner" && id) {
                        setConfirmState({ type: null, id: null });
                        await handleTransferOwner(id);
                    } else {
                        setConfirmState({ type: null, id: null });
                    }
                }}
                onCancel={() => setConfirmState({ type: null, id: null })}
                translucent
            >
                {null}
            </ConfirmDialog>

            <div className="flex items-center gap-4 mb-8">
                <SimpleAvatar
                    size={64}
                    src={group.avatar}
                    croppedArea={group.avatarCroppedArea}
                    icon={<FontAwesomeIcon icon={faUser} style={{ fontSize: 32, color: "#bbb" }} />}
                />
                <div>
                    <div className="text-2xl font-bold text-gray-100">{group.name}</div>
                    <div className="text-gray-500 text-sm">ID: {groupId}</div>
                    {typeof group.memberCount === "number" && (
                        <div className="text-gray-400 text-xs mt-1">Số thành viên: {group.memberCount}</div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between mb-7">
                <div className="font-semibold text-gray-200">
                    Yêu cầu phê duyệt khi thành viên gia nhập
                </div>
                <SimpleSwitch
                    checked={approval}
                    onChange={handleApprovalChange}
                    checkedChildren="Bật"
                    unCheckedChildren="Tắt"
                />
            </div>

            <div className="flex flex-col md:flex-row gap-7">
                {/* Member list on left */}
                <div
                    className="flex-1 rounded-xl shadow border mb-6 md:mb-0 flex flex-col"
                    style={{ background: "#181a20", borderColor: "#2d313a" }}
                >
                    <div className="font-semibold mb-2 mt-4 px-4 text-gray-200">
                        Danh sách thành viên
                    </div>
                    <div className="px-4 mb-2">
                        <input
                            type="text"
                            className="w-full rounded px-2 py-1 bg-gray-800 text-gray-100 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                            placeholder="Tìm kiếm thành viên..."
                            value={searchMember}
                            onChange={(e) => setSearchMember(e.target.value)}
                        />
                    </div>
                    <ul
                        className="custom-scroll"
                        style={{ maxHeight: 330, overflowY: "auto", marginBottom: 8 }}
                    >
                        {filteredMembers.length === 0 ? (
                            <li className="text-gray-500 text-sm italic px-4 py-2">
                                Không tìm thấy thành viên nào
                            </li>
                        ) : (
                            filteredMembers.map((member: any) => (
                                <li
                                    key={member.id}
                                    className="flex items-center justify-between px-4 py-2 border-b last:border-b-0"
                                    style={{ borderColor: "#282c34" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <SimpleAvatar
                                            src={member.avatar}
                                            croppedArea={member.avatarCroppedArea}
                                            size={40}
                                            icon={<FontAwesomeIcon icon={faUser} style={{ color: "#bbb" }} />}
                                        />
                                        <span className="font-semibold text-gray-100 flex items-center gap-2">
                                            {member.name}
                                            {member.id === ownerId && (
                                                <span className="ml-2 px-2 py-1 text-xs bg-yellow-700/30 rounded text-yellow-100 font-semibold inline-flex items-center gap-1">
                                                    <FontAwesomeIcon
                                                        icon={faCrown}
                                                        style={{ color: "#ffe066", fontSize: 13 }}
                                                    />
                                                    Trưởng nhóm
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                        <button
                                            type="button"
                                            className="flex items-center px-4 py-1 rounded font-bold text-white border border-green-700 bg-green-600 hover:bg-green-800 hover:text-white transition text-sm shadow-sm"
                                            title="Chuyển trưởng nhóm"
                                            disabled={busy || member.id === ownerId}
                                            onClick={() =>
                                                setConfirmState({
                                                    type: "transferOwner",
                                                    id: member.id,
                                                })
                                            }
                                            style={{ display: member.id === ownerId ? 'none' : undefined }}
                                        >
                                            Chuyển
                                        </button>
                                        <button
                                            type="button"
                                            className="flex items-center px-4 py-1 rounded font-bold text-white border border-blue-700 bg-blue-600 hover:bg-blue-800 hover:text-white transition text-sm shadow-sm"
                                            title="Đuổi"
                                            disabled={busy || member.id === ownerId}
                                            onClick={() =>
                                                setConfirmState({
                                                    type: "removeMember",
                                                    id: member.id,
                                                })
                                            }
                                            style={{ display: member.id === ownerId ? 'none' : undefined }}
                                        >
                                            Đuổi
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Waiting list on right */}
                <div
                    className="flex-1 rounded-xl shadow border flex flex-col"
                    style={{ background: "#181a20", borderColor: "#2d313a" }}
                >
                    <div className="font-semibold mb-2 mt-4 px-4 text-gray-200">
                        Đang chờ phê duyệt ({waiting.length})
                    </div>
                    <div className="px-4 mb-2">
                        <input
                            type="text"
                            className="w-full rounded px-2 py-1 bg-gray-800 text-gray-100 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                            placeholder="Tìm kiếm người chờ duyệt..."
                            value={searchWaiting}
                            onChange={(e) => setSearchWaiting(e.target.value)}
                        />
                    </div>
                    <ul
                        className="custom-scroll"
                        style={{ maxHeight: 330, overflowY: "auto", marginBottom: 8 }}
                    >
                        {filteredWaiting.length === 0 ? (
                            <li className="text-gray-500 text-sm italic px-4 py-2">
                                Không có ai đang chờ phê duyệt
                            </li>
                        ) : (
                            filteredWaiting.map((wait: any) => (
                                <li
                                    key={wait.id}
                                    className="flex items-center justify-between px-4 py-2 border-b last:border-b-0"
                                    style={{ borderColor: "#282c34" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <SimpleAvatar
                                            src={wait.avatar}
                                            croppedArea={wait.avatarCroppedArea}
                                            size={38}
                                            icon={<FontAwesomeIcon icon={faUser} style={{ color: "#bbb" }} />}
                                        />
                                        <span className="font-semibold text-gray-100">
                                            {wait.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="px-4 py-1 rounded font-bold bg-blue-600 text-white hover:bg-blue-800 transition text-sm mr-1 shadow-sm"
                                            disabled={busy}
                                            onClick={() => handleApproveUser(wait.id)}
                                        >
                                            Duyệt
                                        </button>
                                        <button
                                            type="button"
                                            className="flex items-center px-3 py-1 rounded font-bold text-white border border-red-700 bg-red-600 hover:bg-red-800 transition text-sm shadow-sm"
                                            disabled={busy}
                                            onClick={() =>
                                                setConfirmState({
                                                    type: "rejectWait",
                                                    id: wait.id,
                                                })
                                            }
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}