import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiLoadDashboard, apiRecentDashboard } from "../../../api/management.api";
import ShowPostById from "@/components/ui/ShowpostById";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faFile, faComment, faFlag } from "@fortawesome/free-solid-svg-icons";

// Type definitions for dashboard stats and recent activity
type DashboardStats = {
    userCount: number;
    postCount: number;
    commentCount: number;
    reportedCount: number;
};

type RecentActivity = {
    profileUser?: { name?: string };
    type?: string;
    originalPostProfile?: { name?: string };
    createdAt?: string;
    originalPostId?: string;
    _id?: string; // thêm trường id gốc của bài viết (bài gốc/cả bài chia sẻ)
};

const STAT_ICONS = [
    <FontAwesomeIcon icon={faUser} className="w-10 text-4xl h-10 text-blue-400" />,
    <FontAwesomeIcon icon={faFlag} className="w-10 text-4xl h-10 text-red-400" />,
    <FontAwesomeIcon icon={faFile} className="w-10 text-4xl h-10 text-green-400" />,
    <FontAwesomeIcon icon={faComment} className="w-10 text-4xl h-10 text-orange-400" />,
];

// Đặt màu nền theo yêu cầu:
// 0: user: light blue
// 1: reports: keep existing
// 2,3: post and comment: same as current user bg (#282C34)
const STAT_DEFS = [
    {
        key: "userCount",
        label: "Người dùng mới",
        color: "bg-[#5C748A]", // xanh dương nhạt hơn
        icon: STAT_ICONS[0],
        changeTab: "users", // add for navigation
    },
    {
        key: "reportedCount",
        label: "Báo cáo",
        color: "bg-[#35282D]", // giữ nguyên nền
        icon: STAT_ICONS[1],
        changeTab: "reports", // add for navigation (reports handled by posts tab)
    },
    {
        key: "postCount",
        label: "Bài viết mới",
        color: "bg-[#282C34]", // same as "Người dùng mới" hiện tại
        icon: STAT_ICONS[2]
    },
    {
        key: "commentCount",
        label: "Bình luận mới",
        color: "bg-[#282C34]", // same as "Người dùng mới" hiện tại
        icon: STAT_ICONS[3]
    },
];

// Thêm định nghĩa filter
const DASHBOARD_FILTERS = [
    { value: "day", label: "Trong 1 ngày" },
    { value: "week", label: "Trong 1 tuần" },
    { value: "month", label: "Trong 1 tháng" },
    { value: "year", label: "Trong 1 năm" },
    { value: "all", label: "Tất cả" },
];

type DashboardProps = {
    onChangeTab?: (tabKey: string) => void;
};

// Helper to format relative time in Vietnamese
function formatRelativeTime(dateString?: string): string {
    if (!dateString) return "";
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Vừa xong";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Vừa xong";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} ngày trước`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} tháng trước`;
    const diffYear = Math.floor(diffMonth / 12);
    return `${diffYear} năm trước`;
}

const Dashboard: React.FC<DashboardProps> = ({ onChangeTab }) => {
    const [records, setRecords] = useState<DashboardStats | undefined>(undefined);
    const [recent, setRecent] = useState<RecentActivity[]>([]);
    const [filter, setFilter] = useState<string>("week");
    const [showPostId, setShowPostId] = useState<string | null>(null);
    const [recentHasMore, setRecentHasMore] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const activityListRef = useRef<HTMLUListElement>(null);

    // For preventing multiple fetches at once
    const loadingMoreRef = useRef(false);

    useEffect(() => {
        apiLoadDashboard(filter).then(res => {
            setRecords(res);
        });
    }, [filter]);

    // Load the initial "recent" activity feed (no cursor, first page)
    useEffect(() => {
        setRecent([]);
        setRecentHasMore(true);
        setLoadingMore(true);
        loadingMoreRef.current = true;
        apiRecentDashboard().then(res => {
            setRecent(Array.isArray(res.posts) ? res.posts : []);
            setRecentHasMore(Array.isArray(res.posts) && res.posts.length > 0);
            setLoadingMore(false);
            loadingMoreRef.current = false;
        }).catch(() => {
            setLoadingMore(false);
            loadingMoreRef.current = false;
        });
    }, []);

    // Fetch more recent activity when needed
    const loadMoreRecent = useCallback(async () => {
        if (loadingMoreRef.current || !recentHasMore) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        // Get the createdAt of the last item as the cursor
        const last = recent[recent.length - 1];
        const cursor = last?.createdAt;
        try {
            const res = await apiRecentDashboard(cursor);
            const posts: RecentActivity[] = Array.isArray(res?.posts) ? res.posts : [];
            setRecent(prev => [...prev, ...posts]);
            setRecentHasMore(posts.length > 0);
        } finally {
            setLoadingMore(false);
            loadingMoreRef.current = false;
        }
    }, [recent, recentHasMore]);

    // Scroll handler for "Hoạt động gần đây" (activity feed)
    const handleActivityScroll: React.UIEventHandler<HTMLUListElement> = (e) => {
        const el = e.currentTarget;
        // Near end threshold
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            // Only load more if not already loading and have more data
            if (!loadingMoreRef.current && recentHasMore) {
                loadMoreRecent();
            }
        }
    };

    // Cập nhật: hoạt động nào cũng click được - lấy _id với bài đăng gốc, originalPostId với bài chia sẻ
    const handleActivityClick = (act: RecentActivity) => {
        // Nếu là chia sẻ thì có originalPostId, còn lại là post gốc
        if (act.type === "shared" && act.originalPostId) {
            setShowPostId(act.originalPostId);
        } else if (act._id) {
            setShowPostId(act._id);
        }
    };

    const handleCloseShowPost = () => {
        setShowPostId(null);
    };

    // Handler for clicking stats with navigation
    const handleStatClick = (changeTab?: string) => {
        if (changeTab && onChangeTab) {
            onChangeTab(changeTab);
        }
    };

    // Chuyển đổi key mapping cho dữ liệu khi truy xuất records
    // Đảm bảo đúng thuộc tính cho mỗi thẻ thống kê dù đã đảo vị trí STAT_DEFS
    const getStatValue = (def: typeof STAT_DEFS[number], records: DashboardStats | undefined) => {
        if (!records) return undefined;
        switch (def.key) {
            case "userCount":
                return records.userCount;
            case "reportedCount":
                return records.reportedCount;
            case "postCount":
                return records.postCount;
            case "commentCount":
                return records.commentCount;
            default:
                return undefined;
        }
    };

    return (
        <div className="flex w-full flex-col gap-8">
            <div className="mb-0 flex flex-col md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Dashboard</h1>
                    <div className="flex items-center gap-2">
                        <label htmlFor="dashboard-filter" className="text-white font-medium">Bộ lọc:</label>
                        <select
                            id="dashboard-filter"
                            className="rounded bg-[#232324] text-white px-3 py-2 border border-[#353535] focus:outline-none"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        >
                            {DASHBOARD_FILTERS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {STAT_DEFS.map((def, idx) => {
                    const isClickable = Boolean(def.changeTab && onChangeTab);
                    return (
                        <div
                            key={def.key}
                            className={`rounded-xl p-6 flex flex-col items-center shadow transition hover:scale-105 ${def.color} ${isClickable ? 'cursor-pointer' : ''}`}
                            onClick={isClickable ? () => handleStatClick(def.changeTab) : undefined}
                        >
                            <div className="mb-3">{def.icon}</div>
                            <div className="text-2xl font-extrabold text-white mb-1">
                                {typeof records === "object" && records && typeof getStatValue(def, records) !== "undefined"
                                    ? Number(getStatValue(def, records)).toLocaleString("vi-VN")
                                    : <span className="text-gray-500 animate-pulse">...</span>
                                }
                            </div>
                            <div className="text-gray-200 whitespace-nowrap font-semibold">{def.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Activity Feed */}
            <div className="bg-[#232324] rounded-xl p-6 shadow">
                <h2 className="text-xl font-semibold text-white mb-4">Hoạt động gần đây</h2>
                <ul
                    ref={activityListRef}
                    onScroll={handleActivityScroll}
                    className="divide-y divide-[#34343A] overflow-y-auto max-h-[30vh] pr-2 custom-scroll"
                >
                    {recent.map((act, idx) => {
                        // Cho phép click cả với bài đăng gốc hoặc chia sẻ
                        const clickable = !!(act.type === "shared" ? act.originalPostId : act._id);
                        return (
                            <li
                                key={idx}
                                className={`flex justify-between items-center py-2 ${clickable ? "cursor-pointer hover:bg-[#282828]" : ""}`}
                                onClick={clickable ? () => handleActivityClick(act) : undefined}
                            >
                                <span className="text-white">
                                    <span className="font-bold text-blue-300">{act.profileUser?.name ?? "Ẩn danh"} </span>
                                    <span className="text-gray-300">
                                        {act.type === "shared"
                                            ? (
                                                <>
                                                    đã chia sẻ bài viết của <span className="font-bold text-blue-300">{act.originalPostProfile?.name || "người dùng"}</span>
                                                </>
                                            )
                                            : "đã đăng bài viết mới"}
                                    </span>
                                </span>
                                <span className="text-xs text-gray-500">{formatRelativeTime(act.createdAt)}</span>
                            </li>
                        );
                    })}
                    {loadingMore && (
                        <li className="text-center py-2 text-gray-400">Đang tải thêm...</li>
                    )}
                    {!recentHasMore && recent.length > 0 && (
                        <li className="text-center py-2 text-gray-500 text-xs">Đã hết hoạt động</li>
                    )}
                </ul>
            </div>
            {/* ShowPostById Modal/Drawer/Inline */}
            {showPostId && (
                <ShowPostById
                    postId={showPostId}
                    isShow={!!showPostId}
                    onClose={handleCloseShowPost}
                />
            )}
        </div>
    );
};

export default Dashboard;
