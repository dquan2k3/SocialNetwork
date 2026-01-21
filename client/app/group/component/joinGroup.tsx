"use client";
import React, { useState, useEffect } from "react";
import { apiJoinGroup, apiCancelJoinGroup, apiLeaveGroup } from "@/api/group.api";

interface JoinGroupButtonProps {
    groupId: string;
    name: string;
    // status bây giờ: undefined | "pending" | "active" | "banned"
    status?: "pending" | "active" | "banned";
    onStatusChange?: (groupId: string, status: "pending" | "active" | "banned" | undefined) => void;
}

const MAX_MSG_LEN = 500;

const JoinGroupButton: React.FC<JoinGroupButtonProps> = ({ groupId, name, status, onStatusChange }) => {
    // Force sync with parent status if it changes
    const [internalStatus, setInternalStatus] = useState<"pending" | "active" | "banned" | undefined>(status);
    useEffect(() => {
        setInternalStatus(status);
    }, [status]);

    const [open, setOpen] = useState(false);
    const [openLeaveConfirm, setOpenLeaveConfirm] = useState(false);
    const [message, setMessage] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const handleOpen = () => {
        setMessage("");
        setOpen(true);
        setLoading(false);
    };

    const handleClose = () => {
        setOpen(false);
        setLoading(false);
    };

    const handleOpenLeaveConfirm = () => {
        setOpenLeaveConfirm(true);
        setLoading(false);
    };

    const handleCloseLeaveConfirm = () => {
        setOpenLeaveConfirm(false);
        setLoading(false);
    };

    const setStatusAndNotify = (newStatus: "pending" | "active" | "banned" | undefined) => {
        setInternalStatus(newStatus);
        if (typeof onStatusChange === "function") {
            onStatusChange(groupId, newStatus);
        }
    };

    const handleSendJoin = async () => {
        setLoading(true);
        try {
            const res = await apiJoinGroup({ groupId, message });
            if (res && res.type) {
                if (res.type === "pending" || res.type === "active" || res.type === "banned") {
                    setStatusAndNotify(res.type);
                } else {
                    setStatusAndNotify(undefined);
                }
            } else {
                setStatusAndNotify(undefined);
            }
            setLoading(false);
            handleClose();
        } catch (error: any) {
            let type: string | undefined = undefined;
            if (error?.response?.data?.type) {
                type = error.response.data.type;
            }
            if (type === "pending" || type === "active" || type === "banned") {
                setStatusAndNotify(type as "pending" | "active" | "banned");
            } else {
                setStatusAndNotify(undefined);
            }
            setLoading(false);
            handleClose();
        }
    };

    const handleCancelRequest = async () => {
        setLoading(true);
        try {
            await apiCancelJoinGroup({ groupId });
            setStatusAndNotify(undefined);
        } catch (error) {
            // Log error but do nothing else
        }
        setLoading(false);
    };

    const handleLeaveGroup = async () => {
        setLoading(true);
        try {
            await apiLeaveGroup({ groupId });
            setStatusAndNotify(undefined);
        } catch (error) {
            // Log error but do nothing else
        }
        setLoading(false);
        setOpenLeaveConfirm(false);
    };

    // Hiển thị button tùy theo trạng thái: "pending" = Hủy yêu cầu; "active" = Rời nhóm; "banned" = Bị cấm; undefined = Tham gia nhóm
    return (
        <>
            {internalStatus === "pending" && (
                <button
                    className="px-5 py-2 rounded-lg bg-[#CCCC66] text-black font-semibold hover:bg-[#bcb45f] transition disabled:opacity-60"
                    onClick={handleCancelRequest}
                    disabled={loading}
                    type="button"
                >
                    {loading ? "Đang hủy..." : "Hủy yêu cầu"}
                </button>
            )}

            {internalStatus === "active" && (
                <>
                    <button
                        className="px-5 py-2 rounded-lg bg-[#dc2626] text-white font-semibold hover:bg-[#b91c1c] transition disabled:opacity-60"
                        onClick={handleOpenLeaveConfirm}
                        disabled={loading}
                        type="button"
                    >
                        {loading ? "Đang rời..." : "Rời khỏi nhóm"}
                    </button>
                    {openLeaveConfirm && (
                        <div
                            className="fixed z-50 inset-0 flex justify-center items-center"
                            style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
                            onClick={handleCloseLeaveConfirm}
                        >
                            <div
                                className="bg-[#232427] rounded-xl shadow-lg w-full max-w-sm p-6"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="font-bold text-xl text-center text-white mb-6">
                                    Bạn có chắc muốn rời khỏi nhóm <span className="text-[#3479EF]">{name}</span>?
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button
                                        className="px-4 py-2 rounded-lg bg-[#323334] text-[#b0b3b8] hover:bg-[#252728] transition"
                                        onClick={handleCloseLeaveConfirm}
                                        disabled={loading}
                                        type="button"
                                    >
                                        Không
                                    </button>
                                    <button
                                        className={`px-5 py-2 rounded-lg bg-[#dc2626] text-white font-semibold hover:bg-[#b91c1c] transition ${
                                            loading ? "opacity-70 cursor-wait" : ""
                                        }`}
                                        disabled={loading}
                                        onClick={handleLeaveGroup}
                                        type="button"
                                    >
                                        {loading ? "Đang rời..." : "Có, rời nhóm"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {internalStatus === "banned" && (
                <button
                    className="px-5 py-2 rounded-lg bg-[#888] text-white font-semibold opacity-60 cursor-not-allowed"
                    disabled
                    type="button"
                >
                    Bị cấm
                </button>
            )}

            {(internalStatus === undefined || internalStatus === null) && (
                <button
                    className="px-5 py-2 rounded-lg bg-[#3479EF] text-white font-semibold hover:bg-[#225ac7] transition disabled:opacity-60"
                    onClick={handleOpen}
                    disabled={loading}
                    type="button"
                >
                    Tham gia nhóm
                </button>
            )}

            {open && (
                <div
                    className="fixed z-50 inset-0 flex justify-center items-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
                    onClick={handleClose}
                >
                    <div
                        className="bg-[#232427] rounded-xl shadow-lg w-full max-w-md p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="font-bold text-2xl text-center text-white mb-4">
                            Xin vào nhóm {name}
                        </div>
                        <label
                            className="text-[#b0b3b8] mb-2 block"
                            htmlFor="join-group-message"
                        >
                            Lời nhắn
                        </label>
                        <textarea
                            id="join-group-message"
                            className="w-full py-2 px-3 rounded-lg bg-[#252728] border border-[#323334] text-white placeholder-[#888] mb-2 focus:outline-none focus:ring-2 focus:ring-[#3479EF] resize-none"
                            placeholder="Viết lời nhắn đến quản trị viên nhóm (tối đa 500 ký tự)..."
                            value={message}
                            maxLength={MAX_MSG_LEN}
                            rows={4}
                            onChange={e => setMessage(e.target.value)}
                            disabled={loading}
                        />
                        <div className="text-right text-xs text-[#888] mb-3">
                            {message.length}/{MAX_MSG_LEN} ký tự
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 rounded-lg bg-[#323334] text-[#b0b3b8] hover:bg-[#252728] transition"
                                onClick={handleClose}
                                disabled={loading}
                                type="button"
                            >
                                Hủy
                            </button>
                            <button
                                className={`px-5 py-2 rounded-lg bg-[#3479EF] text-white font-semibold hover:bg-[#225ac7] transition ${
                                    loading ? "opacity-70 cursor-wait" : ""
                                }`}
                                disabled={loading || message.length > MAX_MSG_LEN}
                                onClick={handleSendJoin}
                                type="button"
                            >
                                {loading ? "Đang gửi..." : "Gửi yêu cầu"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default JoinGroupButton;
