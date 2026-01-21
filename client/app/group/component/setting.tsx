import { apiUpdateSetting, apiGetSetting } from "@/api/group.api";
import React, { useState, useRef, useEffect } from "react";

// Khai báo prop types, có thể mở rộng nếu cần
interface GroupSettingTabProps {
    isOwner?: boolean;
    groupId: string;
    // Nhận thêm onPrivacyChange theo yêu cầu
    onPrivacyChange?: (groupId: string, privacy: string) => void;
}

const PRIVACY_OPTIONS = [
    { value: "public", label: "Công khai" },
    { value: "private", label: "Riêng tư" },
    { value: "secret", label: "Bí mật" }
];

const GroupSettingTab: React.FC<GroupSettingTabProps> = ({
    isOwner = false,
    groupId,
    onPrivacyChange,
}) => {
    const [description, setDescription] = useState("");
    const [privacy, setPrivacy] = useState<"public" | "private" | "secret">("public");
    const [requireApproval, setRequireApproval] = useState(false);

    // State để hiển thị message của response
    const [responseMessage, setResponseMessage] = useState<string | null>(null);

    // Lưu giá trị ban đầu để detect thay đổi
    const initialSettings = useRef({
        description: "",
        privacy: "public" as "public" | "private" | "secret",
        requireApproval: false
    });

    // useEffect: lấy setting theo groupId khi mount
    useEffect(() => {
        let ignore = false;

        const fetchSetting = async () => {
            try {
                const res = await apiGetSetting(groupId);
                if (res && res.success && res.groupSetting) {
                    // cập nhật dữ liệu vào state và initialSettings
                    if (!ignore) {
                        setDescription(res.groupSetting.description ?? "");
                        setPrivacy(res.groupSetting.privacy ?? "public");
                        setRequireApproval(res.groupSetting.requireApproval ?? false);
                        initialSettings.current = {
                            description: res.groupSetting.description ?? "",
                            privacy: res.groupSetting.privacy ?? "public",
                            requireApproval: res.groupSetting.requireApproval ?? false
                        };
                    }
                } else {
                    setResponseMessage(res?.message || "Không lấy được cài đặt nhóm.");
                }
            } catch (e: any) {
                setResponseMessage("Có lỗi xảy ra khi tải cài đặt nhóm.");
                // Optional: console.log(e);
            }
        };

        if (groupId) fetchSetting();

        return () => {
            ignore = true;
        };
    }, [groupId]);

    // Tính xem user đã đổi gì chưa?
    const isChanged =
        description !== initialSettings.current.description ||
        privacy !== initialSettings.current.privacy ||
        requireApproval !== initialSettings.current.requireApproval;

    // Handler khi xác nhận
    const handleConfirm = async () => {
        try {
            const res = await apiUpdateSetting({
                groupId,
                description,
                privacy,
                requireApproval
            });
            console.log(res); // log nguyên object trả về từ API
            if (res && typeof res.message === "string") {
                setResponseMessage(res.message);
            } else {
                setResponseMessage(null);
            }
            if (res && res.success && res.groupSetting) {
                // cập nhật lại giá trị gốc để nút bị disable
                initialSettings.current = {
                    description: res.groupSetting.description,
                    privacy: res.groupSetting.privacy,
                    requireApproval: res.groupSetting.requireApproval
                };
                // cập nhật lại state cho đúng dữ liệu server trả về (case backend có xử lý lại)
                setDescription(res.groupSetting.description);
                setPrivacy(res.groupSetting.privacy);
                setRequireApproval(res.groupSetting.requireApproval);
                // Nếu có callback onPrivacyChange, gọi callback này với groupId và privacy mới nhất
                if (typeof onPrivacyChange === "function") {
                    onPrivacyChange(groupId, res.groupSetting.privacy);
                }
                // (không cần hiển thị message UI ở đây, chỉ xử lý disable)
            }
        } catch (e: any) {
            if (e && typeof e.message === "string") {
                setResponseMessage(e.message);
            } else {
                setResponseMessage("Có lỗi xảy ra. Vui lòng thử lại sau.");
            }
            console.log(e);
        }
    };

    return (
        <div className="w-full flex flex-col items-center" style={{ paddingBottom: 30 }}>
            <div
                className="bg-[#252728] p-9 rounded-lg text-white text-lg flex flex-col gap-7 items-center w-full max-w-xl mx-auto"
            >
                <div className="text-2xl font-bold mb-2">
                    {!!isOwner ? "Cài đặt nhóm" : "Thông tin nhóm"}
                </div>

                {/* Mô tả / Nội quy nhóm */}
                <div className="w-full">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold mb-1">Mô tả nhóm</div>
                    </div>
                    {!!isOwner ? (
                        <textarea
                            className="w-full bg-[#1a1b1e] border border-[#333] rounded p-2 text-base resize-none"
                            rows={4}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Nhập nội quy hoặc mô tả nhóm..."
                        />
                    ) : (
                        <div className={`text-base text-[#b0b3b8] bg-[#232427] rounded min-h-[56px] px-3 py-2 break-words`}>
                            {description.trim()
                                ? description
                                : <span className="italic text-[#666]">Chưa có nội quy hoặc mô tả...</span>
                            }
                        </div>
                    )}
                </div>

                {/* Quyền riêng tư */}
                <div className="w-full">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold mb-1">Quyền riêng tư nhóm</div>
                    </div>
                    {!!isOwner ? (
                        <select
                            className="w-full bg-[#1a1b1e] border border-[#333] rounded py-2 px-3 text-base focus:outline-none"
                            value={privacy}
                            onChange={e => setPrivacy(e.target.value as "public" | "private" | "secret")}
                        >
                            {PRIVACY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-base text-[#b0b3b8] bg-[#232427] rounded min-h-[40px] px-3 py-2">
                            {PRIVACY_OPTIONS.find(opt => opt.value === privacy)?.label}
                        </div>
                    )}
                </div>

                {/* Yêu cầu phê duyệt */}
                <div className="w-full">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold mb-1">Tham gia nhóm cần được phê duyệt?</div>
                    </div>
                    {!!isOwner ? (
                        <label className="flex items-center gap-2 text-base">
                            <input
                                type="checkbox"
                                checked={requireApproval}
                                onChange={e => setRequireApproval(e.target.checked)}
                            />
                            <span>Yêu cầu phê duyệt khi thành viên tham gia nhóm</span>
                        </label>
                    ) : (
                        <div className="text-base text-[#b0b3b8] bg-[#232427] rounded min-h-[40px] px-3 py-2">
                            {requireApproval
                                ? "Có, thành viên phải chờ phê duyệt"
                                : "Không, bất kỳ ai cũng có thể tham gia ngay"}
                        </div>
                    )}
                </div>

                {/* Message line */}
                {!!isOwner && responseMessage && (
                    <div className="w-full">
                        <span
                            className={`block text-base transition-colors duration-200 ${responseMessage.includes("thành công") ? "text-green-500" : "text-red-400"}`}
                        >
                            {responseMessage}
                        </span>
                    </div>
                )}

                {/* Nút xác nhận luôn hiển thị khi là owner; xám/disable nếu chưa thay đổi gì */}
                {!!isOwner && (
                    <button
                        className={` font-semibold px-7 py-3 rounded-lg text-base transition-shadow active:scale-95 ${isChanged
                                ? "bg-[#3479EF] hover:bg-[#225ac7] text-white cursor-pointer"
                                : "bg-[#444b58] text-[#ccc] cursor-not-allowed"
                            }`}
                        onClick={handleConfirm}
                        disabled={!isChanged}
                    >
                        Xác nhận thay đổi
                    </button>
                )}
            </div>
        </div>
    );
};

export default GroupSettingTab;
