"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    apiLoadInfoGroupConversation,
    apiApplyJoinGroupConversation,
    apiCancelJoinGroupConversation,
} from "@/api/conversation.api";

// Wrapper để suspend khi dùng useSearchParams
function SuspendedSearchParamsWrapper({ children }: { children: (searchParams: ReturnType<typeof useSearchParams>) => React.ReactNode }) {
    const searchParams = useSearchParams();
    return <>{children(searchParams)}</>;
}

function JoinChatPageInner({ searchParams }: { searchParams: ReturnType<typeof useSearchParams> }) {
    const groupId = searchParams.get("idg") || "";

    const [groupInfo, setGroupInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joinLoading, setJoinLoading] = useState<boolean>(false);

    useEffect(() => {
        setGroupInfo(null);
        setError(null);
        if (groupId) {
            setLoading(true);
            apiLoadInfoGroupConversation(groupId)
                .then((data) => {
                    console.warn("apiLoadInfoGroupConversation response:", data);
                    setGroupInfo(data);
                    setLoading(false);
                })
                .catch((err) => {
                    setError("Không thể tải thông tin nhóm.");
                    setLoading(false);
                });
        }
    }, [groupId]);

    const handleJoin = async () => {
        if (!groupId) return;
        setJoinLoading(true);
        setError(null);
        try {
            const resp = await apiApplyJoinGroupConversation(groupId);
            console.log("apiApplyJoinGroupConversation response:", resp);
            // reload info after apply
            apiLoadInfoGroupConversation(groupId).then((data) => {
                setGroupInfo(data);
            });
        } catch (e) {
            setError("Không thể gửi yêu cầu/tham gia nhóm.");
        } finally {
            setJoinLoading(false);
        }
    };

    const handleCancelRequest = async () => {
        setJoinLoading(true);
        setError(null);
        try {
            if (!groupId) return;
            if (typeof apiCancelJoinGroupConversation === "function") {
                const res = await apiCancelJoinGroupConversation(groupId);
                console.log("apiCancelJoinGroupConversation response:", res);
            }
            // reload info after cancel
            apiLoadInfoGroupConversation(groupId).then((data) => {
                setGroupInfo(data);
            });
        } catch (e) {
            setError("Không thể hủy yêu cầu tham gia nhóm.");
        } finally {
            setJoinLoading(false);
        }
    };

    // status: undefined | null => chưa join
    // status: "pending" => đã gửi yêu cầu, chờ phê duyệt
    // status: "active" => đã là thành viên
    const status = groupInfo?.status;

    let mainContent = null;
    if (loading) {
        mainContent = (
            <div className="text-2xl font-bold text-white mb-6">
                Đang tải thông tin nhóm...
            </div>
        );
    } else if (error) {
        mainContent = (
            <div className="text-2xl font-bold text-white mb-6">
                <span className="text-red-400">{error}</span>
            </div>
        );
    } else if (groupInfo) {
        mainContent = (
            <>
                <div className="text-2xl font-bold text-white mb-6">
                    {groupInfo.requireApproval &&
                    status !== "active" &&
                    status !== "joined"
                        ? "Bạn muốn gửi yêu cầu vào nhóm chat "
                        : "Bạn muốn tham gia nhóm chat "}
                    <span className="text-blue-400">
                        {groupInfo.name ? groupInfo.name : groupId}
                    </span>
                    ?
                </div>
                <div className="mb-4 text-gray-300 flex flex-col items-center">
                    {groupInfo.avatar && (
                        <img
                            src={groupInfo.avatar}
                            alt={groupInfo.name}
                            className="w-24 h-24 rounded-full mb-3 object-cover border-2 border-blue-400"
                        />
                    )}
                    <div className="mb-1">
                        <b>Tên nhóm:</b> {groupInfo.name}
                    </div>
                    <div className="mb-1">
                        <b>Thành viên:</b> {groupInfo.memberCount ?? "?"}
                    </div>
                    <div>
                        <b>Phê duyệt tham gia:</b>{" "}
                        {groupInfo.requireApproval ? (
                            <span className="text-yellow-300">Cần phê duyệt</span>
                        ) : (
                            <span className="text-green-300">Không cần phê duyệt</span>
                        )}
                    </div>
                </div>

                {/* Status actions */}
                {status === "active" ? (
                    <div className="mt-4 px-8 py-3 rounded-lg bg-green-600 text-white font-semibold text-lg shadow transition select-none">
                        Bạn đã là thành viên nhóm này rồi
                    </div>
                ) : status === "pending" ? (
                    <div className="flex flex-col items-center">
                        <button
                            className="mt-4 px-8 py-3 cursor-pointer rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-lg shadow transition"
                            onClick={handleCancelRequest}
                            disabled={loading || !!error || joinLoading}
                        >
                            {joinLoading ? "Đang xử lý..." : "Hủy yêu cầu"}
                        </button>
                        <div className="mt-2 text-yellow-300 text-base font-medium">
                            Đã gửi yêu cầu tham gia nhóm, chờ phê duyệt.
                        </div>
                    </div>
                ) : (
                    <button
                        className="mt-4 px-8 py-3 cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow transition"
                        onClick={handleJoin}
                        disabled={loading || !!error || joinLoading}
                    >
                        {joinLoading
                            ? "Đang xử lý..."
                            : groupInfo.requireApproval
                            ? "Gửi yêu cầu"
                            : "Tham gia"}
                    </button>
                )}
            </>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-full bg-[#18191A]">
            {mainContent}
        </div>
    );
}

export default function JoinChatPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <SuspendedSearchParamsWrapper>
                {(searchParams) => <JoinChatPageInner searchParams={searchParams} />}
            </SuspendedSearchParamsWrapper>
        </Suspense>
    );
}