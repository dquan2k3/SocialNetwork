"use client";
import React, { useState, useEffect } from "react";
import { apiCreateGroup } from "@/api/group.api";

interface CreateGroupModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: (res?: any) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
    open,
    onClose,
    onSuccess,
}) => {
    const [groupName, setGroupName] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when open/close
    useEffect(() => {
        if (open) {
            setGroupName("");
            setError(null);
            setLoading(false);
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!groupName.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiCreateGroup({ name: groupName.trim() });
            if (onSuccess) onSuccess(res);
            onClose();
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    "Có lỗi xảy ra, vui lòng thử lại."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed z-50 inset-0 flex justify-center items-center"
            style={{ backgroundColor: "rgba(0,0,0,0.8)" }} // 20% opacity
        >
            <div
                className="bg-[#232427] rounded-xl shadow-lg w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="font-bold text-2xl text-center text-white mb-4">
                    Tạo nhóm mới
                </div>
                <label
                    className="text-[#b0b3b8] mb-2 block"
                    htmlFor="group-name-input"
                >
                    Tên nhóm
                </label>
                <input
                    id="group-name-input"
                    type="text"
                    className="w-full py-2 px-3 rounded-lg bg-[#252728] border border-[#323334] text-white placeholder-[#888] mb-4 focus:outline-none focus:ring-2 focus:ring-[#3479EF]"
                    placeholder="Nhập tên nhóm..."
                    value={groupName}
                    autoFocus
                    onChange={e => setGroupName(e.target.value)}
                    disabled={loading}
                />
                {error && (
                    <div className="text-red-400 text-sm mt-[-6px] mb-3">{error}</div>
                )}
                <div className="flex justify-end gap-3">
                    <button
                        className="px-4 py-2 rounded-lg bg-[#323334] text-[#b0b3b8] hover:bg-[#252728] transition"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        className={`px-5 py-2 rounded-lg bg-[#3479EF] text-white font-semibold hover:bg-[#225ac7] transition ${
                            loading ? "opacity-70 cursor-wait" : ""
                        }`}
                        disabled={!groupName.trim() || loading}
                        onClick={handleSubmit}
                    >
                        {loading ? "Đang tạo..." : "Xác nhận"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
