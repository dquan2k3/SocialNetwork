"use client";

import React, { useState, useEffect } from "react";
import {
    apiSendFriendRequest,
    apiCancelRelationship,
    apiAcceptFriendRequest,
    apiRejectFriendRequest,
    apiBlockUser,
} from "@/api/relationship.api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUserCheck,
    faUserPlus,
    faUserXmark,
    faMessage,
    faAngleDown,
    faExclamationTriangle,
    faBan,
    faUnlockAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useChatDock } from "@/app/providers/ChatDockProvider";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";

type Relationship = {
    requester: string;
    recipient: string;
    status: "pending" | "accepted" | "rejected" | "blocked";
    message?: string;
    acceptedAt?: string;
    wasRejected?: boolean;
    // blockedBy?: string; // remove usage as noted
    isFollow?: boolean;
    interactionCount?: number;
    lastInteractionAt?: string;
    _id: string;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
};

interface RelationshipButtonProps {
    relationship?: Relationship | null;
    myId: string;
    userId: string;
    name?: string;
    username?: string;
    avatar?: any;
    avatarCroppedArea?: any;
    onRelationshipChange?: (userId: string, relationship: Relationship | null) => void;
}

// Thiết kế popup gửi yêu cầu kết bạn hiện đại hơn
const RequestFriendModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
    loading: boolean;
    name?: string;
    avatar?: string;
    username?: string;
    defaultMessage?: string;
}> = ({
    open,
    onClose,
    onSend,
    loading,
    name,
    avatar,
    username,
    defaultMessage = "Kết bạn với mình nhé!",
}) => {
    const [message, setMessage] = useState(defaultMessage);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    useEffect(() => {
        setMessage(defaultMessage);
    }, [open, defaultMessage]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center transition"
            style={{
                background: "rgba(30,30,40,0.92)",
                animation: "fadeIn 0.18s",
            }}
        >
            <div className="text-white rounded-2xl shadow-xl p-0 min-w-[390px] relative max-w-full w-full mx-3"
                style={{
                    background: "#252728",
                    boxShadow: "0 6px 32px 0 rgba(32,38,54,0.65)",
                    maxWidth: 400,
                    border: '1px solid #30315b'
                }}
            >
                {/* Header */}
                <div className="flex flex-col items-center justify-center pt-7 pb-3 px-8 relative">
                    <button
                        type="button"
                        className="absolute right-4 top-4 w-[36px] h-[36px] flex items-center justify-center rounded-full bg-[#3B3D3E] hover:bg-[#4F5152] text-[#b0b3b8] cursor-pointer"
                        title="Hủy"
                        style={{ fontSize: 20 }}
                        aria-label="Đóng"
                        disabled={loading}
                        onClick={onClose}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path
                                d="M14.53 5.47a.75.75 0 0 0-1.06 0L10 8.94 6.53 5.47A.75.75 0 1 0 5.47 6.53L8.94 10l-3.47 3.47a.75.75 0 1 0 1.06 1.06L10 11.06l3.47 3.47a.75.75 0 0 0 1.06-1.06L11.06 10l3.47-3.47a.75.75 0 0 0 0-1.06z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                    <div className="mb-3">
                        {avatar ? (
                            <img
                                src={avatar}
                                alt="Avatar"
                                className="w-20 h-20 rounded-full object-cover border-4 border-blue-400 shadow-lg"
                                style={{
                                    background:
                                        "linear-gradient(120deg, #36d1dc 0%, #5b86e5 100%)",
                                }}
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-blue-900 flex items-center justify-center text-3xl font-bold text-blue-300 border-4 border-blue-400 shadow-lg">
                                {name ? (name[0] || "").toUpperCase() : <FontAwesomeIcon icon={faUserPlus} />}
                            </div>
                        )}
                    </div>
                    <div className="font-bold text-xl pb-1 text-white">
                        Kết bạn với {name || username || "người dùng"}
                    </div>
                    {username && (
                        <div className="text-blue-300 text-base font-medium mb-1">
                            @{username}
                        </div>
                    )}
                    <div className="text-gray-300 text-base font-normal mb-2">
                        Hãy gửi lời nhắn đến {name || "người này"} nhé!
                    </div>
                </div>
                {/* Content */}
                <div className="px-8 pb-0 pt-1">
                    <textarea
                        className="w-full border-none"
                        style={{
                            background: "#17181a", // Màu đen đậm hơn
                            color: "#fff",
                            borderRadius: "0.75rem",
                            padding: "1rem",
                            fontSize: "1rem",
                            minHeight: 64,
                            boxSizing: "border-box",
                            resize: "none", // Ẩn nút mở rộng của textarea
                        }}
                        rows={4}
                        placeholder="Bạn muốn gửi lời nhắn nào cho lời mời kết bạn?"
                        value={message}
                        maxLength={100}
                        onChange={e => setMessage(e.target.value)}
                        disabled={loading}
                    />
                    <div className="text-gray-400 text-xs text-right mt-2">{message.length}/100</div>
                </div>
                {/* Footer actions */}
                <div
                    className="flex justify-end gap-3 px-8 py-5 border-t mt-5 rounded-b-2xl"
                    style={{
                        borderTop: "1px solid #313233",
                        background: "#232425"
                    }}
                >
                    <button
                        className="px-4 py-2 rounded-lg font-semibold border border-gray-500 transition-colors duration-200 hover:bg-[#26282c] hover:border-gray-400 whitespace-nowrap"
                        style={{
                            background: "#161718",
                            color: "#c6c8c9",
                            cursor: "pointer"
                        }}
                        onClick={onClose}
                        disabled={loading}
                        type="button"
                    >
                        Hủy
                    </button>
                    <button
                        className="px-4 py-2 rounded-lg font-semibold text-white transition shadow-lg disabled:opacity-60 hover:brightness-110 hover:shadow-xl whitespace-nowrap"
                        style={{
                            background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
                            cursor: "pointer"
                        }}
                        onClick={() => onSend(message)}
                        disabled={loading || !message.trim()}
                        type="button"
                    >
                        {loading ? (
                            <span>
                                <svg className="animate-spin inline-block mr-1" width="18" height="18" viewBox="0 0 50 50"><circle className="opacity-30" cx="25" cy="25" r="20" stroke="#E0E7EF" strokeWidth="5" fill="none" /><circle className="opacity-80" cx="25" cy="25" r="20" stroke="#3B82F6" strokeWidth="5" strokeDasharray="31.4 188.4" fill="none" /></svg>
                                Đang gửi...
                            </span>
                        ) : (
                            <>Gửi</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Confirm modal: nút xóa/bỏ kết bạn sẽ là màu đỏ, nút còn lại là màu xám
const ConfirmModal: React.FC<{
    visible: boolean;
    onHide: () => void;
    message: string;
    header?: string;
    icon?: React.ReactNode;
    acceptLabel?: string;
    rejectLabel?: string;
    onAccept: () => void;
    onReject: () => void;
    className?: string;
}> = ({
    visible,
    onHide,
    message,
    header,
    icon,
    acceptLabel = "Đồng ý",
    rejectLabel = "Không",
    onAccept,
    onReject,
    className,
}) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div
                className={`rounded-lg shadow-lg p-6 min-w-[300px] text-white ${className || ""}`}
                style={{
                    background: "#252728",
                    boxShadow: "0 6px 32px 0 rgba(30, 30, 40, .72)",
                    maxWidth: 350,
                    border: "1px solid #30315b"
                }}
            >
                <div className="flex items-center mb-3">
                    {icon && <span className="text-yellow-500 mr-3">{icon}</span>}
                    <span className="font-bold text-lg">{header}</span>
                </div>
                <div className="mb-5">{message}</div>
                <div className="flex justify-end gap-3">
                    <button
                        className="px-4 py-2 rounded font-semibold transition-colors duration-200 whitespace-nowrap"
                        style={{
                            background: "#444",
                            color: "#fff",
                            border: "1px solid #666",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                            onReject();
                            onHide();
                        }}
                        type="button"
                    >
                        {rejectLabel}
                    </button>
                    <button
                        className="px-4 py-2 rounded font-semibold transition-colors duration-200 hover:bg-[#ff5471] whitespace-nowrap"
                        style={{
                            background: "#ff3b53",
                            color: "#fff",
                            border: "1px solid #ff3b53",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                            onAccept();
                            onHide();
                        }}
                        type="button"
                    >
                        {acceptLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RelationshipButton: React.FC<RelationshipButtonProps> = ({
    relationship,
    myId,
    userId,
    name,
    username,
    avatar,
    onRelationshipChange,
}) => {

    const { openChat } = useChatDock();
    const [friendLoading, setFriendLoading] = useState<Record<string, boolean>>({});
    const [friendDropdownOpen, setFriendDropdownOpen] = useState<string | null>(null);

    const [localRelationship, setLocalRelationship] = useState<Relationship | null | undefined>(relationship);
    const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
    const [pendingUnfriend, setPendingUnfriend] = useState<{ id: string; userId: string } | null>(null);

    const [showRequestFriendModal, setShowRequestFriendModal] = useState(false); // Show modal gửi lời mời
    const [requesting, setRequesting] = useState(false); // Loading state for request friend

    // STATE for showing block button "dropdown" next to "Kết bạn"
    const [addFriendDropdownOpen, setAddFriendDropdownOpen] = useState(false);

    useEffect(() => {
        setLocalRelationship(relationship);
    }, [relationship]);

    const updateRelationship = (userId: string, newRelationship: Relationship | null) => {
        setLocalRelationship(newRelationship);
        if (typeof onRelationshipChange === "function") {
            onRelationshipChange(userId, newRelationship);
        }
    };

    const [simpleMessage, setSimpleMessage] = useState<string | null>(null);

    function isApiResponse(obj: any): obj is { success: boolean; message?: string; relationship?: Relationship } {
        return typeof obj === "object" && obj !== null && "success" in obj;
    }

    const cancelFriendRequest = async (
        relationshipId: string,
        userId: string,
        isFriend: boolean = false
    ) => {
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: true }));
        setSimpleMessage(null);
        try {
            const data = await apiCancelRelationship(relationshipId);
            if (isApiResponse(data) && data.success === false) {
                setSimpleMessage(data.message || "Có lỗi xảy ra");
            } else {
                updateRelationship(
                    userId,
                    data && typeof data === "object" && "relationship" in data
                        ? (data as any).relationship || null
                        : null
                );
                if (data && typeof data === "object" && "message" in data) {
                    setSimpleMessage((data as any).message);
                }
            }
        } catch (e: any) {
            setSimpleMessage(e?.response?.data?.message || e?.message || "Có lỗi xảy ra");
        }
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: false }));
    };

    const acceptFriendRequest = async (relationshipId: string, userId: string) => {
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: true }));
        setSimpleMessage(null);
        try {
            const data = await apiAcceptFriendRequest(relationshipId);
            if (isApiResponse(data) && data.success === false) {
                setSimpleMessage(data.message || "Có lỗi xảy ra");
            } else {
                updateRelationship(
                    userId,
                    data && typeof data === "object" && "relationship" in data
                        ? (data as any).relationship || null
                        : null
                );
                if (data && typeof data === "object" && "message" in data) {
                    setSimpleMessage((data as any).message);
                }
            }
        } catch (e: any) {
            setSimpleMessage(e?.response?.data?.message || e?.message || "Có lỗi xảy ra");
        }
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: false }));
    };

    const rejectFriendRequest = async (relationshipId: string, userId: string) => {
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: true }));
        setSimpleMessage(null);
        try {
            const data = await apiRejectFriendRequest(relationshipId);
            if (isApiResponse(data) && data.success === false) {
                setSimpleMessage(data.message || "Có lỗi xảy ra");
            } else {
                updateRelationship(
                    userId,
                    data && typeof data === "object" && "relationship" in data
                        ? (data as any).relationship || null
                        : null
                );
                if (data && typeof data === "object" && "message" in data) {
                    setSimpleMessage((data as any).message);
                }
            }
        } catch (e: any) {
            setSimpleMessage(e?.response?.data?.message || e?.message || "Có lỗi xảy ra");
        }
        setFriendLoading((fl) => ({ ...fl, [relationshipId]: false }));
    };

    // All friend buttons and message button must be cursor-pointer
    // REWRITE: Nút Nhắn tin phải luôn mở tab chat khi click, kể cả đã từng mở (đưa lên bên phải nhất), không tạo trùng.
    const handleMessageClick = () => {
        openChat({
            id: userId,
            title: name || username || "Người dùng",
            avatarUrl: avatar,
        });
    };

    const MessageButton = (
        <button
            type="button"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
            style={{
                minWidth: 112,
                cursor: "pointer",
                filter: "brightness(1.075)",
                transition: "filter 0.15s, background 0.15s"
            }}
            onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.filter = "brightness(0.94)";
            }}
            onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.filter = "brightness(1.075)";
            }}
            onClick={handleMessageClick}
            disabled={false}
        >
            <FontAwesomeIcon icon={faMessage} />
            <span className="whitespace-nowrap">Nhắn tin</span>
        </button>
    );

    const handleSendFriendRequest = async (message: string) => {
        setRequesting(true);
        setSimpleMessage(null);
        try {
            const data = await apiSendFriendRequest({ recipient: userId, message });
            if (isApiResponse(data) && data.success === false) {
                setSimpleMessage(data.message || "Có lỗi xảy ra khi gửi lời mời kết bạn.");
            } else {
                updateRelationship(
                    userId,
                    data && typeof data === "object" && "relationship" in data
                        ? (data as any).relationship || null
                        : null
                );
                setShowRequestFriendModal(false);
                if (data && typeof data === "object" && "message" in data) {
                    setSimpleMessage((data as any).message);
                } else {
                    setSimpleMessage("Đã gửi lời mời kết bạn thành công!");
                }
            }
        } catch (e: any) {
            setSimpleMessage(e?.response?.data?.message || e?.message || "Có lỗi xảy ra khi gửi lời mời kết bạn.");
        }
        setRequesting(false);
    };

    // --- Block/Unblock logic handling ---
    // Khi bị chặn, gửi request blockUser và dùng response relationship để setLocalRelationship, không dùng fake id.
    const handleBlock = async (userId: string) => {
        try {
            const res = await apiBlockUser(userId);
            // res sẽ như: {success: true, message: "...", relationship: {...}}
            if (isApiResponse(res) && res.success) {
                if (res.relationship) {
                    setLocalRelationship(res.relationship);
                }
                setSimpleMessage(null);
            } else {
                setSimpleMessage(res?.message || "Không thể chặn người dùng.");
            }
        } catch (e: any) {
            setSimpleMessage("Không thể chặn người dùng.");
            console.error("Error blocking user:", e);
        }
    };

    const handleUnblock = async (userId: string) => {
        // Không fake relationship id, chỉ unblock nếu có thật
        const relationshipId = localRelationship?._id;
        if (!relationshipId) {
            setSimpleMessage("Không tìm thấy quan hệ chặn để hủy.");
            return;
        }
        setFriendLoading((fl) => ({ ...fl, unblock: true }));
        setSimpleMessage(null);
        try {
            await apiCancelRelationship(relationshipId);
            setLocalRelationship(null);
            setSimpleMessage(null);
        } catch (e) {
            setSimpleMessage("Không thể hủy chặn người dùng.");
            console.error("Error unblocking user:", e);
        }
        setFriendLoading((fl) => ({ ...fl, unblock: false }));
    };

    const friendButtonBaseStyle = {
        minWidth: 112,
        cursor: "pointer",
        background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
        filter: "brightness(1.075)",
        transition: "filter 0.15s, background 0.15s"
    };

    const friendButtonHoverHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
        (e.currentTarget as HTMLElement).style.filter = "brightness(0.94)";
    };
    const friendButtonOutHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
        (e.currentTarget as HTMLElement).style.filter = "brightness(1.075)";
    };

    // Helper for message above button(s)
    const ErrorMessageAboveButtons = ({ children }: { children: React.ReactNode }) =>
        <div className="w-full flex flex-col items-start">
            <div className="text-red-500 pb-2 w-full">{children}</div>
        </div>;

    // Thêm nút "Chặn" khi hover vào nút kết bạn, hiện ra dưới dạng một dropdown giống nút "Hủy kết bạn"
    // Ấn chặn sẽ set state localRelationship sang blocked (requester: myId)
    if (!localRelationship) {
        return (
            <div className="flex flex-col">
                {simpleMessage && (
                    <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                )}
                <div
                    className="flex gap-2 items-center"
                >
                    <div className="relative inline-block"
                        onMouseEnter={() => setAddFriendDropdownOpen(true)}
                        onMouseLeave={() => setAddFriendDropdownOpen(false)}
                        tabIndex={-1}
                    >
                        <button
                            type="button"
                            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
                            style={friendButtonBaseStyle}
                            disabled={!!friendLoading[userId]}
                            onClick={() => setShowRequestFriendModal(true)}
                            onMouseOver={friendButtonHoverHandler}
                            onMouseOut={friendButtonOutHandler}
                        >
                            <FontAwesomeIcon icon={faUserPlus} />
                            <span className="whitespace-nowrap">Kết bạn</span>
                            {/* No faAngleDown icon here */}
                        </button>
                        {/* Block option dropdown, chỉ hiện khi hover */}
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 mt-1 min-w-[110px] border rounded-lg shadow-md z-10 transition-all duration-200 ${addFriendDropdownOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
                                }`}
                            style={{
                                top: "100%",
                                background: "#252728",
                                border: "1px solid #393b3b",
                                color: "#fff"
                            }}
                        >
                            <button
                                type="button"
                                className="relationship-block-btn w-full px-4 py-2 text-left whitespace-nowrap transition duration-200 rounded-lg group"
                                onClick={() => {
                                    setAddFriendDropdownOpen(false);
                                    handleBlock(userId);
                                }}
                                style={{
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    color: "#fff",
                                    border: "1.5px solid #ba3f54",
                                    background: "transparent"
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={faBan}
                                    className="mr-2"
                                    style={{ color: "#e63a44" }}
                                />
                                <span className="whitespace-nowrap">Chặn</span>
                            </button>
                        </div>
                    </div>
                    {MessageButton}
                </div>
                <RequestFriendModal
                    open={showRequestFriendModal}
                    onClose={() => setShowRequestFriendModal(false)}
                    onSend={handleSendFriendRequest}
                    loading={requesting}
                    name={name}
                    avatar={avatar}
                    username={username}
                />
                {/* CSS cho hiệu ứng hover của nút chặn */}
                <style jsx global>{`
                  .relationship-block-btn:hover,
                  .relationship-block-btn:focus {
                    background: #fff !important;
                    color: #e63a44 !important;
                  }
                  .relationship-block-btn:hover .fa-ban,
                  .relationship-block-btn:focus .fa-ban {
                    color: #e63a44 !important;
                  }
                  .relationship-block-btn:active {
                    background: #fee3e6 !important;
                  }
                `}</style>
            </div>
        );
    }

    const { status, requester, recipient, _id } = localRelationship;

    if (status === "pending") {
        if (myId === requester) {
            return (
                <div className="flex flex-col">
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
                            style={{
                                ...friendButtonBaseStyle,
                                background: "#ef4444",
                            }}
                            disabled={!!friendLoading[_id]}
                            onClick={() => cancelFriendRequest(_id, userId, false)}
                            onMouseOver={e => {
                                (e.currentTarget as HTMLElement).style.filter = "brightness(0.94)";
                            }}
                            onMouseOut={e => {
                                (e.currentTarget as HTMLElement).style.filter = "brightness(1.075)";
                            }}
                        >
                            <FontAwesomeIcon icon={faUserXmark} />
                            <span className="whitespace-nowrap">Hủy lời mời</span>
                        </button>
                        {MessageButton}
                    </div>
                </div>
            );
        }
        if (myId === recipient) {
            return (
                <div className="flex flex-col">
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
                            style={friendButtonBaseStyle}
                            disabled={!!friendLoading[_id]}
                            onClick={() => acceptFriendRequest(_id, userId)}
                            onMouseOver={friendButtonHoverHandler}
                            onMouseOut={friendButtonOutHandler}
                        >
                            <FontAwesomeIcon icon={faUserPlus} />
                            <span className="whitespace-nowrap">Chấp nhận</span>
                        </button>
                        <button
                            type="button"
                            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
                            style={{
                                ...friendButtonBaseStyle,
                                background: "#ff3b53", // Đỏ cho nút từ chối
                                color: "#fff",
                            }}
                            disabled={!!friendLoading[_id]}
                            onClick={() => rejectFriendRequest(_id, userId)}
                            onMouseOver={e => {
                                (e.currentTarget as HTMLElement).style.filter = "brightness(0.94)";
                            }}
                            onMouseOut={e => {
                                (e.currentTarget as HTMLElement).style.filter = "brightness(1.075)";
                            }}
                        >
                            <FontAwesomeIcon icon={faUserXmark} />
                            <span className="whitespace-nowrap">Từ chối</span>
                        </button>
                        {MessageButton}
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col">
                {simpleMessage && (
                    <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                )}
                <div className="flex gap-2 items-center">{MessageButton}</div>
            </div>
        );
    }

    if (status === "accepted") {
        return (
            <div className="flex flex-col">
                {simpleMessage && (
                    <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                )}
                <div className="flex gap-2 items-center">
                    <div className="relative inline-block friend-dropdown-group">
                        <button
                            type="button"
                            className="text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 focus:outline-none transition whitespace-nowrap"
                            style={friendButtonBaseStyle}
                            onClick={e => {
                                e.stopPropagation();
                                setFriendDropdownOpen(friendDropdownOpen === _id ? null : _id);
                            }}
                            onMouseEnter={() => setFriendDropdownOpen(_id)}
                            onMouseLeave={() => setFriendDropdownOpen(null)}
                            onMouseOver={friendButtonHoverHandler}
                            onMouseOut={friendButtonOutHandler}
                        >
                            <FontAwesomeIcon icon={faUserCheck} />
                            <span className="whitespace-nowrap">Bạn bè</span>
                            <FontAwesomeIcon
                                icon={faAngleDown}
                                className={`transition-transform duration-200 ${friendDropdownOpen === _id ? "rotate-180" : ""}`}
                            />
                        </button>
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 mt-1 min-w-[160px] border rounded-lg shadow-md z-10 transition-all duration-200 ${friendDropdownOpen === _id ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
                                }`}
                            style={{
                                top: "100%",
                                background: "#252728",
                                border: "1px solid #393b3b",
                                color: "#fff"
                            }}
                            onMouseEnter={() => setFriendDropdownOpen(_id)}
                            onMouseLeave={() => setFriendDropdownOpen(null)}
                        >
                            <button
                                type="button"
                                className="custom-unfriend-btn w-full px-4 py-2 text-left whitespace-nowrap transition duration-200 disabled:opacity-60 rounded-lg group hover:bg-white! hover:text-red-600!"
                                onClick={() => {
                                    setFriendDropdownOpen(null);
                                    setPendingUnfriend({ id: _id, userId });
                                    setShowUnfriendConfirm(true);
                                }}
                                disabled={!!friendLoading[_id]}
                                style={{
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    color: "#fff", // Chữ trắng
                                    border: "1.5px solid #ef4444", // Viền đỏ
                                    background: "transparent"
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={faUserXmark}
                                    className="mr-2 transition-colors duration-200 group-hover:text-red-600!"
                                    style={{ color: "#fff" }}
                                />
                                <span className="whitespace-nowrap">{friendLoading[_id] ? "Đang xử lý..." : "Hủy kết bạn"}</span>
                            </button>
                        </div>
                    </div>
                    {MessageButton}
                </div>
                <ConfirmModal
                    visible={showUnfriendConfirm}
                    onHide={() => setShowUnfriendConfirm(false)}
                    message="Bạn có chắc chắn muốn hủy kết bạn?"
                    header="Xác nhận"
                    icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
                    acceptLabel="Đồng ý"
                    rejectLabel="Không"
                    onAccept={async () => {
                        if (pendingUnfriend) {
                            await cancelFriendRequest(
                                pendingUnfriend.id,
                                pendingUnfriend.userId,
                                true
                            );
                            setShowUnfriendConfirm(false);
                            setPendingUnfriend(null);
                        }
                    }}
                    onReject={() => {
                        setShowUnfriendConfirm(false);
                        setPendingUnfriend(null);
                    }}
                    className="custom-confirm"
                />
                {/* Nút "Đồng ý" màu đỏ, nút "Không" màu xám (override!) */}
                <style jsx global>{`
                  .custom-confirm button {
                    background: #444 !important;
                    border: 1px solid #666 !important;
                    color: #fff !important;
                  }
                  .custom-confirm button:last-child {
                    background: #ff3b53 !important;
                    border: 1px solid #ff3b53 !important;
                  }
                  .custom-confirm button:hover {
                    background: #555 !important;
                  }
                  .custom-confirm button:last-child:hover {
                    background: #ff5471 !important;
                  }
                `}</style>
            </div>
        );
    }

    if (status === "rejected") {
        if (myId === requester || myId === recipient) {
            return (
                <div className="flex flex-col">
                    <span className="text-red-500 pb-2">
                        {myId === requester ? "Đã bị từ chối" : "Đã từ chối"}
                    </span>
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <div className="relative inline-block"
                            onMouseEnter={() => setAddFriendDropdownOpen(true)}
                            onMouseLeave={() => setAddFriendDropdownOpen(false)}
                            tabIndex={-1}
                        >
                            <button
                                type="button"
                                className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
                                style={friendButtonBaseStyle}
                                disabled={!!friendLoading[userId]}
                                onClick={() => setShowRequestFriendModal(true)}
                                onMouseOver={friendButtonHoverHandler}
                                onMouseOut={friendButtonOutHandler}
                            >
                                <FontAwesomeIcon icon={faUserPlus} />
                                <span className="whitespace-nowrap">Kết bạn</span>
                                {/* No faAngleDown icon here */}
                            </button>
                            {/* Block option dropdown, chỉ hiện khi hover */}
                            <div
                                className={`absolute left-1/2 -translate-x-1/2 mt-1 min-w-[110px] border rounded-lg shadow-md z-10 transition-all duration-200 ${addFriendDropdownOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
                                    }`}
                                style={{
                                    top: "100%",
                                    background: "#252728",
                                    border: "1px solid #393b3b",
                                    color: "#fff"
                                }}
                            >
                                <button
                                    type="button"
                                    className="relationship-block-btn w-full px-4 py-2 text-left whitespace-nowrap transition duration-200 rounded-lg group"
                                    onClick={() => {
                                        setAddFriendDropdownOpen(false);
                                        handleBlock(userId);
                                    }}
                                    style={{
                                        whiteSpace: "nowrap",
                                        cursor: "pointer",
                                        color: "#fff",
                                        border: "1.5px solid #ba3f54",
                                        background: "transparent"
                                    }}
                                >
                                    <FontAwesomeIcon
                                        icon={faBan}
                                        className="mr-2"
                                        style={{ color: "#e63a44" }}
                                    />
                                    <span className="whitespace-nowrap">Chặn</span>
                                </button>
                            </div>
                        </div>
                        {MessageButton}
                    </div>
                    <RequestFriendModal
                        open={showRequestFriendModal}
                        onClose={() => setShowRequestFriendModal(false)}
                        onSend={handleSendFriendRequest}
                        loading={requesting}
                        name={name}
                        avatar={avatar}
                        username={username}
                    />
                    {/* CSS cho hiệu ứng hover của nút chặn */}
                    <style jsx global>{`
                      .relationship-block-btn:hover,
                      .relationship-block-btn:focus {
                        background: #fff !important;
                        color: #e63a44 !important;
                      }
                      .relationship-block-btn:hover .fa-ban,
                      .relationship-block-btn:focus .fa-ban {
                        color: #e63a44 !important;
                      }
                      .relationship-block-btn:active {
                        background: #fee3e6 !important;
                      }
                    `}</style>
                </div>
            );
        }
        return (
            <div className="flex flex-col">
                {simpleMessage && (
                    <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                )}
                <div className="flex gap-2 items-center">{MessageButton}</div>
            </div>
        );
    }

    // BLOCKED: XỬ LÝ HAI TRẠNG THÁI -- requester là mình (self-block) hay không
    if (status === "blocked") {
        // Nếu requester là myId => mình đã chặn người khác, có thể hủy chặn.
        if (requester === myId) {
            return (
                <div className="flex flex-col">
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            className="bg-[#ff3b53] text-white font-semibold py-2 px-4 rounded-lg whitespace-nowrap transition"
                            style={{ minWidth: 112, cursor: friendLoading.unblock ? "not-allowed" : "pointer" }}
                            onClick={() => handleUnblock(userId)}
                            disabled={!!friendLoading.unblock}
                        >
                            <FontAwesomeIcon icon={faUnlockAlt} className="mr-2" />
                            {friendLoading.unblock ? "Đang mở chặn..." : "Hủy chặn"}
                        </button>
                        {MessageButton}
                    </div>
                </div>
            );
        } else if (recipient === myId) {
            // Nếu recipient là mình => mình bị người khác chặn (không cần dùng blockedBy)
            return (
                <div className="flex flex-col">
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg cursor-not-allowed whitespace-nowrap"
                            style={{ minWidth: 112 }}
                            disabled
                        >
                            Đã bị chặn
                        </button>
                        {MessageButton}
                    </div>
                </div>
            );
        } else {
            // Fallback nếu neither => old rendering
            return (
                <div className="flex flex-col">
                    {simpleMessage && (
                        <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
                    )}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg cursor-not-allowed whitespace-nowrap"
                            style={{ minWidth: 112 }}
                            disabled
                        >
                            Đã chặn
                        </button>
                        {MessageButton}
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="flex flex-col">
            {simpleMessage && (
                <ErrorMessageAboveButtons>{simpleMessage}</ErrorMessageAboveButtons>
            )}
            <div className="flex gap-2 items-center">{MessageButton}</div>
        </div>
    );
};

export default RelationshipButton;
