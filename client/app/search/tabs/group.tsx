"use client";
import React, { useState, useEffect } from "react";
import { apiSearchGroup } from "@/api/group.api";
import { useRouter } from "next/navigation";

const groupTypeOptions = [
    { label: "Tất cả", value: "" },
    { label: "Nhóm công khai", value: "public" },
    { label: "Nhóm riêng tư", value: "private" },
];
const groupSortOptions = [
    { label: "Thành viên nhiều nhất", value: "most_members" },
    { label: "Mới nhất", value: "recent" },
    { label: "Cũ nhất", value: "oldest" },
];

type GroupType = "" | "public" | "private";
type GroupSort = "most_members" | "recent" | "oldest";

function formatDate(d?: string) {
    if (!d) return "?";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "?";
    return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

function GroupCard({ group, onClick }: { group: any, onClick: (group: any) => void }) {
    const privacyDisplay =
        group.privacy === "public" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-700/30 text-blue-400 font-medium">Công khai</span>
        ) : group.privacy === "private" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-700/30 text-teal-400 font-medium">Riêng tư</span>
        ) : group.privacy === "secret" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300 font-medium">Bí mật</span>
        ) : null;

    let groupCoverUrl =
        group.cover && typeof group.cover === "string" && group.cover.trim()
            ? group.cover
            : "https://ui-avatars.com/api/?name=" + encodeURIComponent(group.name || "G");

    return (
        <div
            className="rounded-xl border border-[#333334] bg-[#252728] w-full flex shadow-lg hover:bg-[#323335] transition-colors duration-150 p-4 gap-4 items-center cursor-pointer"
            onClick={() => onClick(group)}
        >
            <img
                src={groupCoverUrl}
                alt={group.name}
                className="w-20 h-20 rounded-xl object-cover border-2 border-[#333334] shadow-sm bg-[#232324]"
                style={{ background: "#232324", objectFit: "cover" }}
            />
            <div className="flex flex-col flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg truncate text-white">{group.name}</h3>
                    {privacyDisplay}
                </div>
                <div className="text-gray-300 text-sm truncate mb-1">{group.description || "Chưa có mô tả"}</div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>👥 {typeof group.membersCount === "number" ? group.membersCount : 0} thành viên</span>
                    <span>📅 Thành lập: {formatDate(group.createdDate)}</span>
                </div>
            </div>
        </div>
    );
}

interface GroupTabProps {
    keyParam: string;
    idtab: string;
    onSearchChange: (newKey: string) => void;
}

const GroupTab: React.FC<GroupTabProps> = ({
    keyParam,
    idtab,
    onSearchChange
}) => {
    const [search, setSearch] = useState<string>(keyParam || "");
    const [groupType, setGroupType] = useState<GroupType>("");
    const [groupSort, setGroupSort] = useState<GroupSort>("most_members");
    const [loading, setLoading] = useState<boolean>(false);
    const [groups, setGroups] = useState<any[]>([]);
    const [searched, setSearched] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    // Only search when mounting or idtab changes (not on filter/sort change)
    useEffect(() => {
        setSearch(keyParam || "");
        // Only search if keyParam is non-empty
        if ((keyParam || "").trim() !== "") {
            (async () => {
                setLoading(true);
                setError(null);
                try {
                    const params: any = { key: keyParam, sort: groupSort };
                    if (groupType !== "") {
                        params.filter = { type: groupType };
                    }
                    const res = await apiSearchGroup(params);
                    setGroups(res?.groups || []);
                    setSearched(true);
                } catch (err: any) {
                    setError("Có lỗi xảy ra khi tìm nhóm!");
                    setGroups([]);
                    setSearched(false);
                } finally {
                    setLoading(false);
                }
            })();
        } else {
            setGroups([]);
            setSearched(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idtab]); // reload list when tab id changes

    // Loại bỏ tự động search khi thay đổi filter/sort

    const handleSearch = async () => {
        const keyword = (search || "").trim();
        if (!keyword) {
            setError("Hãy nhập từ khóa!");
            setGroups([]);
            setSearched(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const params: any = { key: keyword, sort: groupSort };
            if (groupType !== "") {
                params.filter = { type: groupType };
            }
            const res = await apiSearchGroup(params);
            setGroups(res?.groups || []);
            setSearched(true);
        } catch (err: any) {
            setError("Có lỗi xảy ra khi tìm nhóm!");
            setGroups([]);
            setSearched(false);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSearch("");
        setGroupType("");
        setGroupSort("most_members");
        setGroups([]);
        setSearched(false);
        setError(null);
        onSearchChange(""); // also reset parent state
    };

    // Enter key triggers search
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const handleGroupClick = (group: any) => {
        if (group && group.Id) {
            router.push(`/group?groupId=${group.Id}`);
        }
    };

    return (
        <div className="w-full flex flex-col items-center min-h-[400px]">
            {/* Search + Filters */}
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4 w-full z-40 sticky top-0 bg-[#1C1C1D] pt-6 pb-3">
                <div
                    className="flex items-center w-full max-w-md rounded-lg shadow-sm px-3 py-2"
                    style={{ background: "#333334" }}
                >
                    <input
                        type="text"
                        placeholder="Tìm kiếm tên nhóm..."
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            if (error) setError(null);
                            onSearchChange(e.target.value);
                        }}
                        onKeyDown={handleInputKeyDown}
                        className="flex-1 outline-none ml-2 text-sm bg-transparent text-white placeholder:text-gray-400"
                        style={{ color: "#fff" }}
                    />
                    <button
                        onClick={handleSearch}
                        className="ml-2 px-3 py-1 rounded-lg bg-[#2563eb] text-white text-sm border border-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
                        style={{ minWidth: 80 }}
                        disabled={loading}
                        type="button"
                    >
                        {loading ? "Đang tìm..." : "Tìm kiếm"}
                    </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Group Type Filter */}
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={groupType}
                        onChange={e => setGroupType(e.target.value as GroupType)}
                    >
                        {groupTypeOptions.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                style={{ background: "#252728", color: "#fff" }}
                            >
                                Loại nhóm: {opt.label}
                            </option>
                        ))}
                    </select>
                    {/* Group Sort Filter */}
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={groupSort}
                        onChange={e => setGroupSort(e.target.value as GroupSort)}
                    >
                        {groupSortOptions.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                style={{ background: "#252728", color: "#fff" }}
                            >
                                Sắp xếp: {opt.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleReset}
                        className="px-3 py-1 rounded-lg bg-[#3B3D3E] text-white text-sm border border-[#333334] hover:bg-[#525355] transition-colors"
                        style={{ minWidth: 80 }}
                        type="button"
                        disabled={loading}
                    >
                        Đặt lại
                    </button>
                </div>
            </div>
            {/* List Results */}
            <div className="w-full flex-1 flex flex-col gap-7 items-center pb-8 min-h-[250px]">
                {error && (
                    <div className="text-red-500 font-semibold text-sm px-2 py-1">
                        {error}
                    </div>
                )}
                {loading && (
                    <div className="text-gray-400 text-center py-8 w-full">
                        Đang tìm kiếm nhóm...
                    </div>
                )}
                {!loading && searched && groups.length === 0 && (
                    <div className="text-gray-400 text-center py-8 w-full">
                        Không tìm thấy nhóm phù hợp.
                    </div>
                )}
                {!loading && groups.length > 0 && (
                    <div className="space-y-4 w-full">
                        {groups.map((group) => (
                            <GroupCard group={group} key={group.Id} onClick={handleGroupClick} />
                        ))}
                    </div>
                )}
                {!loading && !searched && groups.length === 0 && (
                    <div className="text-gray-400 text-center py-8 w-full">
                        Hãy nhập từ khóa tên nhóm để tìm kiếm.
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupTab;
