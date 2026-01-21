"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiSearchPost } from "@/api/search.api";
import Showpost from "@/components/ui/Showpost";
import PostReactButton from "@/components/ui/PostReactButton";
import { apiReactPost, apiSharePost } from "@/api/post.api";
import { getCloudinaryCoverLink, getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { useSelector } from "react-redux";
import RelationshipButton from "@/components/ui/RelationshipButton";
import ShowImage from "@/components/ui/ShowImage";

// ---------- Kiểu dữ liệu ----------

type PostType = {
    _id: string;
    text: string;
    files?: any[];
    liked?: boolean;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    avatar?: string;
    name?: string;
    username?: string;
    avatarCroppedArea?: any;
    createdAt?: string;
    bioUser?: {
        avatar?: string;
        avatarCroppedArea?: any;
        cover?: string;
        coverCroppedArea?: any;
    };
    profileUser?: {
        name?: string;
        username?: string;
    };
    user: string;
    relationship?: any;
    privacy?: string;
    hasShared?: boolean;
    myReact?: "like" | "love" | "fun" | "sad" | "angry" | null;
    reactCounts?: { [key in "like" | "love" | "fun" | "sad" | "angry"]?: number };
    updatedAt?: string;
    _showTempName?: string;
    _showTempAvatar?: string;
    _showTempUsername?: string;
};

type PostSearchTabProps = {
    keyParam: string;
    idtab: string;
    onSearchChange: (key: string) => void;
};

// Avatar component
function Avatar({
    src,
    size,
    className,
    croppedArea,
}: {
    src?: string;
    size?: number;
    className?: string;
    croppedArea?: any;
}) {
    return (
        <img
            src={src || "https://ui-avatars.com/api/?name=Demo&background=random"}
            alt="avatar"
            width={size || 40}
            height={size || 40}
            className={className || "rounded-full"}
            style={{ objectFit: "cover", width: size || 40, height: size || 40 }}
        />
    );
}

// State for ShowImage popup
function useShowImageState() {
    const [showImage, setShowImage] = useState(false);
    const [showImageFiles, setShowImageFiles] = useState<any[]>([]);
    const [showImageIdx, setShowImageIdx] = useState<number>(0);
    const [showImageCreatedAt, setShowImageCreatedAt] = useState<string | number | Date | undefined>("");
    const [showImagePosterAvatar, setShowImagePosterAvatar] = useState<string | undefined>(undefined);
    const [showImageAvatarCroppedArea, setShowImageAvatarCroppedArea] = useState<any | undefined>(undefined);
    const [showImagePosterName, setShowImagePosterName] = useState<string | undefined>(undefined);
    const [showImagePosterUsername, setShowImagePosterUsername] = useState<string | undefined>(undefined);

    function handleOpenShowImage({
        files,
        fileIdx,
        createdAt,
        avatar,
        avatarCroppedArea,
        name,
        username
    }: {
        files: any[]
        fileIdx: number
        createdAt?: string
        avatar?: string
        avatarCroppedArea?: any
        name?: string
        username?: string
    }) {
        setShowImageFiles(files);
        setShowImageIdx(fileIdx);
        setShowImageCreatedAt(createdAt);
        setShowImagePosterAvatar(avatar);
        setShowImageAvatarCroppedArea(avatarCroppedArea);
        setShowImagePosterName(name);
        setShowImagePosterUsername(username);
        setShowImage(true);
    }

    function handleCloseShowImage() {
        setShowImage(false);
        setShowImageFiles([]);
        setShowImageIdx(0);
        setShowImageCreatedAt("");
        setShowImagePosterAvatar(undefined);
        setShowImageAvatarCroppedArea(undefined);
        setShowImagePosterName(undefined);
        setShowImagePosterUsername(undefined);
    }

    return {
        showImage,
        showImageFiles,
        showImageIdx,
        showImageCreatedAt,
        showImagePosterAvatar,
        showImageAvatarCroppedArea,
        showImagePosterName,
        showImagePosterUsername,
        handleOpenShowImage,
        handleCloseShowImage
    };
}

function renderMedia(
    files: any[],
    openShowImage: (idx: number) => void = () => {},
    parentFiles: any[] = [],
    createdAt?: string,
    avatar?: string,
    avatarCroppedArea?: any,
    name?: string,
    username?: string
) {
    if (!Array.isArray(files) || files.length === 0) return null;
    const sortedFiles = [...files].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    if (sortedFiles.length === 1) {
        const m = sortedFiles[0];
        if (m.file_type === "video") {
            return (
                <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden bg-black">
                    <video
                        src={m.file_url}
                        controls
                        className="object-contain max-h-full max-w-full rounded-xl"
                        style={{ aspectRatio: "16/9", width: "100%" }}
                    />
                </div>
            );
        }
        if (m.file_type === "image") {
            // Khi ấn vào ảnh: truyền vào tất cả file, và index tùy vào ảnh click, avatar là avatar url chưa qua crop
            return (
                <img
                    src={m.file_url}
                    alt=""
                    className="object-contain max-h-full max-w-full rounded-xl cursor-pointer"
                    style={{ width: "100%", height: "100%" }}
                    onClick={() => openShowImage(0)}
                />
            );
        }
        return null;
    }
    const maxShow = 4;
    const overs = sortedFiles.length > maxShow ? sortedFiles.length - maxShow + 1 : 0;
    return (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full">
            {sortedFiles.slice(0, maxShow).map((m, idx) => {
                const isLast = idx === maxShow - 1 && overs > 0;
                return (
                    <div key={idx} className="relative w-full h-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                        {m.file_type === "image" ? (
                            <img
                                src={m.file_url}
                                alt=""
                                className="object-cover w-full h-full rounded-xl cursor-pointer"
                                style={{ maxHeight: 190, maxWidth: 380 }}
                                onClick={() => openShowImage(idx)}
                            />
                        ) : m.file_type === "video" ? (
                            <video
                                src={m.file_url}
                                controls
                                className="object-cover w-full h-full rounded-xl bg-black"
                                style={{ maxHeight: 190, maxWidth: 380 }}
                            />
                        ) : null}
                        {isLast && (
                            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-3xl font-bold text-white">
                                +{sortedFiles.length - maxShow + 1}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function isWithinTimeRange(postDate: string, filterValue: string) {
    if (!filterValue) return true;
    const now = new Date();
    const post = new Date(postDate);
    switch (filterValue) {
        case "1h":
            return now.getTime() - post.getTime() <= 60 * 60 * 1000;
        case "1d":
            return now.getTime() - post.getTime() <= 24 * 60 * 60 * 1000;
        case "1w":
            return now.getTime() - post.getTime() <= 7 * 24 * 60 * 60 * 1000;
        case "1m":
            return now.getTime() - post.getTime() <= 30 * 24 * 60 * 60 * 1000;
        case "1y":
            return now.getTime() - post.getTime() <= 365 * 24 * 60 * 60 * 1000;
        case "3y":
            return now.getTime() - post.getTime() <= 3 * 365 * 24 * 60 * 60 * 1000;
        default:
            return true;
    }
}

export default function PostSearchTab({ keyParam, idtab, onSearchChange }: PostSearchTabProps) {
    const [search, setSearch] = useState<string>(keyParam || "");
    const [postTimeFilter, setPostTimeFilter] = useState<string>("");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [postResults, setPostResults] = useState<PostType[]>([]);
    const [sortedPostResults, setSortedPostResults] = useState<PostType[]>([]);
    const [isPostSearched, setIsPostSearched] = useState(false);
    const [showEmptyKeyError, setShowEmptyKeyError] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [showPostPopup, setShowPostPopup] = useState(false);

    const [pendingReactPostId, setPendingReactPostId] = useState<string | null>(null);
    const [pendingSharePostId, setPendingSharePostId] = useState<string | null>(null);

    // Get router from next/navigation
    const router = useRouter();

    // ShowImage popup state management
    const {
        showImage,
        showImageFiles,
        showImageIdx,
        showImageCreatedAt,
        showImagePosterAvatar,
        showImageAvatarCroppedArea,
        showImagePosterName,
        showImagePosterUsername,
        handleOpenShowImage,
        handleCloseShowImage
    } = useShowImageState();

    // Hover state & tracking
    const [hoveredInfoId, setHoveredInfoId] = useState<string | null>(null);
    const isInsideHover = useRef<Record<string, boolean>>({});
    const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // For mount/unmount escape
    const mousemoveListenerRef = useRef<any>(null);

    const user = useSelector((state: any) => state.user);
    const myName = user.profile?.name;
    const myUsername = user.profile?.username;
    const myId = user?.userId;
    const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);

    // Memo for selected post
    const selectedPost = useMemo(() => {
        if (!selectedPostId) return null;
        return postResults.find(p => p._id === selectedPostId) || null;
    }, [selectedPostId, postResults]);

    // --- 8️⃣ Global mousemove: Escape hatch for hover card ---
    useEffect(() => {
        // Only set mousemove while popup NOT open
        function onGlobalMouseMove(e: MouseEvent) {
            let el = e.target as HTMLElement | null;
            // Check if the mouse is on any element with our data-row-hover or data-float-hover matching hover postId
            let found = false;
            const curId = hoveredInfoId;
            while (el && el !== window.document.body) {
                if (el.getAttribute && typeof curId === "string") {
                    if (
                        el.getAttribute("data-row-hover") === curId ||
                        el.getAttribute("data-float-hover") === curId
                    ) {
                        found = true;
                        break;
                    }
                }
                el = el.parentElement;
            }
            if (!found && hoveredInfoId) {
                // Mouse is not over row/floating, clear hover
                setHoveredInfoId(null);
                isInsideHover.current = {};
                if (hoverTimeout.current) {
                    clearTimeout(hoverTimeout.current);
                    hoverTimeout.current = null;
                }
            }
        }

        if (!showPostPopup) {
            window.addEventListener("mousemove", onGlobalMouseMove, true);
            mousemoveListenerRef.current = onGlobalMouseMove;
        } else {
            if (mousemoveListenerRef.current) {
                window.removeEventListener("mousemove", mousemoveListenerRef.current!, true);
                mousemoveListenerRef.current = null;
            }
        }
        return () => {
            if (mousemoveListenerRef.current) {
                window.removeEventListener("mousemove", mousemoveListenerRef.current!, true);
                mousemoveListenerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredInfoId, showPostPopup]);

    // --- 9️⃣ Khi mở popup (ShowPost): Hard reset hover immediately ---
    useEffect(() => {
        if (showPostPopup) {
            setHoveredInfoId(null);
            isInsideHover.current = {};
            if (hoverTimeout.current) {
                clearTimeout(hoverTimeout.current);
                hoverTimeout.current = null;
            }
        }
        // No restore old hover when popup closes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPostPopup]);

    // --- 1️⃣1️⃣ Khi component unmount: Reset everything ---
    useEffect(() => {
        return () => {
            if (hoverTimeout.current) {
                clearTimeout(hoverTimeout.current);
                hoverTimeout.current = null;
            }
            if (mousemoveListenerRef.current) {
                window.removeEventListener("mousemove", mousemoveListenerRef.current!, true);
                mousemoveListenerRef.current = null;
            }
            setHoveredInfoId(null);
            isInsideHover.current = {};
        };
    }, []);

    // Hàm onChange relationship cập nhật relationship của user ở mọi post nếu trùng userId
    const handleRelationshipChange = (userId: string, relationship: any) => {
        setPostResults(prevPosts =>
            prevPosts.map(post => {
                if (post.user === userId) {
                    return { ...post, relationship: relationship };
                }
                return post;
            })
        );
    };

    // Handle comment count delta (+1 or -1) for a given post
    const handlePostComment = useCallback(
        (postId: string, delta: number) => {
            setPostResults(prevPosts =>
                prevPosts.map(post =>
                    post._id === postId
                        ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) + delta) }
                        : post
                )
            );
        },
        []
    );

    // Xử lý xóa post khỏi UI (theo yêu cầu)
    const handleDeletePost = (postId: string) => {
        setPostResults((prevPosts) => prevPosts.filter((post) => post._id !== postId));
        setShowPostPopup(false);
        setSelectedPostId((currentId) => (currentId === postId ? null : currentId));
    };

    const sortOptions = [
        { label: "Mới nhất", value: "desc" },
        { label: "Cũ nhất", value: "asc" },
    ];

    const postTimeOptions = [
        { label: "Tất cả", value: "" },
        { label: "1 giờ qua", value: "1h" },
        { label: "1 ngày qua", value: "1d" },
        { label: "1 tuần qua", value: "1w" },
        { label: "1 tháng qua", value: "1m" },
        { label: "1 năm qua", value: "1y" },
        { label: "3 năm qua", value: "3y" },
    ];

    const searchPosts = async (
        searchKey: string,
        timeFilter: string = postTimeFilter,
        order: "desc" | "asc" = sortOrder
    ) => {
        if (!searchKey.trim()) {
            setShowEmptyKeyError(true);
            setPostResults([]);
            setSortedPostResults([]);
            setIsPostSearched(false);
            return;
        }
        setLoading(true);
        setError(null);
        setIsPostSearched(false);
        setPostResults([]);
        setSortedPostResults([]);
        try {
            const filter = timeFilter ? { postTime: timeFilter } : {};
            const sort = order ? { createdAt: order } : {};
            const res = await apiSearchPost({ key: searchKey, filter, sort });
            if (res && typeof res === "object" && Array.isArray(res.posts)) {
                setPostResults(res.posts);
                setIsPostSearched(true);
            } else {
                setPostResults([]);
                setIsPostSearched(true);
            }
        } catch (e: any) {
            setError("Lỗi tìm kiếm bài viết, thử lại sau!");
            setPostResults([]);
            setIsPostSearched(true);
        }
        setLoading(false);
    };

    useEffect(() => {
        let posts = [...postResults];
        if (postTimeFilter) {
            posts = posts.filter(post =>
                post.createdAt && isWithinTimeRange(post.createdAt, postTimeFilter)
            );
        }
        posts.sort((a, b) => {
            const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return sortOrder === "desc" ? bd - ad : ad - bd;
        });
        setSortedPostResults(posts);
    }, [postResults, postTimeFilter, sortOrder]);

    useEffect(() => {
        setSearch(keyParam ?? "");
        setPostTimeFilter("");
        setSortOrder("desc");
        setPostResults([]);
        setSortedPostResults([]);
        setIsPostSearched(false);
        setError(null);
        setShowEmptyKeyError(false);
        if (keyParam && keyParam.trim()) {
            searchPosts(keyParam, "", "desc");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idtab]);

    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);
        if (showEmptyKeyError && value.trim()) setShowEmptyKeyError(false);
        onSearchChange(value);
    };

    const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setShowEmptyKeyError(false);
            if (search.trim() === "") {
                setShowEmptyKeyError(true);
                return;
            }
            setIsPostSearched(true);
            searchPosts(search, postTimeFilter, sortOrder);
        }
    };
    const handleManualSearch = () => {
        if (!search.trim()) {
            setShowEmptyKeyError(true);
            return;
        }
        searchPosts(search, postTimeFilter, sortOrder);
    };
    const handleResetFilters = () => {
        setSearch("");
        setPostTimeFilter("");
        setSortOrder("desc");
        setPostResults([]);
        setSortedPostResults([]);
        setIsPostSearched(false);
        setError(null);
        setShowEmptyKeyError(false);
        onSearchChange("");
    };

    const handleOpenShowPost = (post: PostType) => {
        setSelectedPostId(post._id);
        setShowPostPopup(true);
        // 9️⃣: Hard reset hover state RIGHT at popup open
        setHoveredInfoId(null);
        isInsideHover.current = {};
        if (hoverTimeout.current) {
            clearTimeout(hoverTimeout.current);
            hoverTimeout.current = null;
        }
    };
    const handleCloseShowPost = () => {
        setShowPostPopup(false);
        setSelectedPostId(null);
        // Hard reset hover state when popup closes (disable hover until next enter)
        setHoveredInfoId(null);
        isInsideHover.current = {};
        if (hoverTimeout.current) {
            clearTimeout(hoverTimeout.current);
            hoverTimeout.current = null;
        }
    };

    const handleComment = (post?: PostType) => {
        if (post) handleOpenShowPost(post);
    };

    const handleReact = async (
        reactionName: "like" | "love" | "fun" | "sad" | "angry" | null,
        prevReaction: "like" | "love" | "fun" | "sad" | "angry" | null,
        postId?: string
    ) => {
        if (!postId) return;
        if (pendingReactPostId === postId) return;
        setPendingReactPostId(postId);

        setPostResults((prev) =>
            prev.map((item) => {
                if (item._id === postId) {
                    let newReactCounts = {
                        like: item.reactCounts?.like ?? 0,
                        love: item.reactCounts?.love ?? 0,
                        fun: item.reactCounts?.fun ?? 0,
                        sad: item.reactCounts?.sad ?? 0,
                        angry: item.reactCounts?.angry ?? 0,
                    };
                    if (prevReaction && prevReaction !== reactionName && newReactCounts[prevReaction] > 0) {
                        newReactCounts[prevReaction] -= 1;
                    }
                    if (reactionName && reactionName !== prevReaction) {
                        newReactCounts[reactionName] = (newReactCounts[reactionName] ?? 0) + 1;
                    }
                    if (reactionName === null && prevReaction && newReactCounts[prevReaction] > 0) {
                        newReactCounts[prevReaction] -= 1;
                    }
                    let likeCount =
                        typeof item.likeCount === "number"
                            ? newReactCounts.like
                            : item.likeCount;

                    return {
                        ...item,
                        myReact: reactionName,
                        reactCounts: newReactCounts,
                        likeCount,
                    };
                } else {
                    return item;
                }
            })
        );
        try {
            await apiReactPost({ postId, react: reactionName || "" });
        } catch (err) { }
        setPendingReactPostId(null);
    };

    // Đã sửa: Giờ luôn luôn có myId != undefined => API share sẽ chạy
    const handleShare = async (post?: PostType) => {
        if (!post) return;
        if (pendingSharePostId === post._id) return;
        setPendingSharePostId(post._id);

        try {
            const res = await apiSharePost({ postId: post._id });
            if (res) {
                const { share } = res;
                setPostResults((prevPosts) => {
                    const updatedPosts = prevPosts.map((p) =>
                        p._id === post._id
                            ? {
                                ...p,
                                shareCount: (() => {
                                    let base = typeof p.shareCount === "number" ? p.shareCount : 0;
                                    if (typeof p.hasShared === "boolean") {
                                        if (share === null && p.hasShared) return base > 0 ? base - 1 : 0;
                                        if (share && !p.hasShared) return base + 1;
                                        return base;
                                    }
                                    if (share) return base + 1;
                                    return base > 0 ? base - 1 : 0;
                                })(),
                                hasShared: !!share
                            }
                            : p
                    );
                    return updatedPosts;
                });
            }
        } catch (err) {
            console.error("Share post failed:", err);
        } finally {
            setPendingSharePostId(null);
        }
    };

    // --- 3️⃣ Điều kiện cho phép hover ---
    // User LOGGED IN, không hover chính mình, không có popup full screen
    const canHover = (targetUserId: string) => {
        return user && user.userId && targetUserId !== user.userId && !showPostPopup;
    };

    // Handler to route to profile
    const handleGoToProfile = (userId: string | undefined) => {
        if (!userId) return;
        router.push(`/profile/${userId}`);
    };

    return (
        <div className="w-full max-w-[800px] flex flex-col grow items-center z-5" style={{ position: "relative", zIndex: 30 }}>
            <div
                className="flex flex-wrap items-center justify-between mb-6 gap-4 w-full z-40"
                style={{
                    position: "sticky",
                    top: 0,
                    background: "#1C1C1D",
                    paddingTop: "24px",
                    paddingBottom: "12px"
                }}
            >
                <div
                    className="flex items-center w-full max-w-md rounded-lg shadow-sm px-3 py-2"
                    style={{ background: "#333334" }}
                >
                    <input
                        type="text"
                        placeholder="Tìm kiếm tiêu đề bài viết..."
                        value={search}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchInputKeyDown}
                        className="flex-1 outline-none ml-2 text-sm bg-transparent text-white placeholder:text-gray-400"
                        style={{ color: "#fff" }}
                    />
                    <button
                        onClick={handleManualSearch}
                        className="ml-2 px-3 py-1 rounded-lg bg-[#2563eb] text-white text-sm border border-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
                        style={{ minWidth: 80 }}
                        disabled={loading}
                        type="button"
                    >
                        {loading ? "Đang tìm..." : "Tìm kiếm"}
                    </button>
                </div>
                {showEmptyKeyError && (
                    <div className="text-red-500 font-semibold text-sm px-2 py-1">
                        Hãy nhập từ khóa!
                    </div>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={postTimeFilter}
                        onChange={(e) => setPostTimeFilter(e.target.value)}
                    >
                        {postTimeOptions.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                style={{ background: "#252728", color: "#fff" }}
                            >
                                Thời gian: {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                    >
                        {sortOptions.map((opt) => (
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
                        onClick={handleResetFilters}
                        className="px-3 py-1 rounded-lg bg-[#3B3D3E] text-white text-sm border border-[#333334] hover:bg-[#525355] transition-colors"
                        style={{ minWidth: 80 }}
                        type="button"
                        disabled={loading}
                    >
                        Đặt lại
                    </button>
                </div>
            </div>
            <div className="w-full pb-[50px] flex-grow">
                {/* Hiển thị "Hãy nhập từ khóa để tìm kiếm" nếu chưa load/search gì */}
                {!loading && !error && !isPostSearched && (
                    <div className="text-gray-400 text-center py-8">
                        Hãy nhập từ khóa để tìm kiếm.
                    </div>
                )}
                {loading && (
                    <div className="text-gray-400 text-center py-8 w-full">
                        Đang tìm kiếm bài viết...
                    </div>
                )}
                {!loading && error && (
                    <div className="text-red-400 text-center py-8">{error}</div>
                )}
                {!loading && !error && isPostSearched && sortedPostResults.length === 0 && (
                    <div className="text-gray-400 text-center py-8">
                        Không tìm thấy bài viết phù hợp.
                    </div>
                )}
                {!loading && !error && isPostSearched && sortedPostResults.length > 0 &&
                    sortedPostResults.map((p) => {
                        const files = Array.isArray(p.files) ? p.files : [];
                        const fileCount = files.length;
                        let mediaBlock = null;
                        // Helper to open ShowImage popup
                        const openShowImage = (fileIdx: number) => {
                            // avatar là avatar url chưa qua crop
                            handleOpenShowImage({
                                files: files,
                                fileIdx,
                                createdAt: p.createdAt,
                                avatar: p.bioUser?.avatar,
                                avatarCroppedArea: p.bioUser?.avatarCroppedArea,
                                name: p.profileUser?.name,
                                username: p.profileUser?.username
                            });
                        };

                        if (fileCount === 1) {
                            mediaBlock = (
                                <div className="mt-3 w-full">
                                    {renderMedia(files, openShowImage, files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                </div>
                            );
                        } else if (fileCount === 2) {
                            mediaBlock = (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    {files.map((f, idx2) =>
                                        <div key={idx2}>
                                            {renderMedia([f], () => openShowImage(idx2), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                        </div>
                                    )}
                                </div>
                            );
                        } else if (fileCount === 3) {
                            mediaBlock = (
                                <div className="mt-3 grid grid-rows-2 gap-2" style={{ height: "400px" }}>
                                    <div className="row-span-1">
                                        {renderMedia([files[0]], () => openShowImage(0), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 row-span-1">
                                        {files.slice(1, 3).map((f, idx2) =>
                                            <div key={idx2}>
                                                {renderMedia([f], () => openShowImage(idx2 + 1), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        } else if (fileCount === 4) {
                            mediaBlock = (
                                <div
                                    className="mt-3 grid grid-cols-2 grid-rows-2 gap-2"
                                    style={{ height: "400px" }}
                                >
                                    {files.slice(0, 4).map((f, idx2) =>
                                        <div key={idx2}>
                                            {renderMedia([f], () => openShowImage(idx2), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                        </div>
                                    )}
                                </div>
                            );
                        } else if (fileCount >= 5) {
                            const moreCount = fileCount - 5;
                            mediaBlock = (
                                <div className="mt-3 flex flex-col gap-2" style={{ height: "400px" }}>
                                    <div className="flex gap-2" style={{ height: "196px" }}>
                                        {files.slice(0, 2).map((f, idx2) => (
                                            <div key={idx2} className="w-1/2 h-full">
                                                {renderMedia([f], () => openShowImage(idx2), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2" style={{ height: "196px" }}>
                                        {files.slice(2, 5).map((f, idx2) => {
                                            if (idx2 === 2 && moreCount > 0) {
                                                return (
                                                    <div key={idx2} className="relative w-1/3 h-full">
                                                        {renderMedia([f], () => openShowImage(idx2 + 2), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                                        <div
                                                            className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-lg cursor-pointer"
                                                            // When clicking the "+N" overlay, show the last file in the files array
                                                            onClick={() => openShowImage(idx2 + 2)}
                                                        >
                                                            <span className="text-white text-2xl font-bold">
                                                                +{moreCount}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={idx2} className="w-1/3 h-full">
                                                    {renderMedia([f], () => openShowImage(idx2 + 2), files, p.createdAt, p.bioUser?.avatar, p.bioUser?.avatarCroppedArea, p.profileUser?.name, p.profileUser?.username)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }
                        // 3️⃣: Điều kiện hover mới, không khi showPostPopup
                        const shouldUseHover = canHover(p.user);
                        const showFloating = shouldUseHover && hoveredInfoId === p._id;
                        // 2️⃣: Gắn data-row-hover / data-float-hover vào đúng element (info row/floating)

                        // 4️⃣: Chuột ENTER info row
                        const handleMouseEnter = () => {
                            if (!shouldUseHover) return;
                            // 4️⃣ clear timeout, mark isInsideHover[postId]=true, set hoveredInfoId, render floating hover
                            if (hoverTimeout.current) {
                                clearTimeout(hoverTimeout.current);
                                hoverTimeout.current = null;
                            }
                            isInsideHover.current[p._id] = true;
                            setHoveredInfoId(p._id);
                        };
                        // 5️⃣: Chuột LEAVE info row
                        const handleMouseLeave = () => {
                            if (!shouldUseHover) return;
                            isInsideHover.current[p._id] = false;
                            // 5️⃣: Start delay, only clear hoveredInfoId if not inside floating
                            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                            hoverTimeout.current = setTimeout(() => {
                                if (!isInsideHover.current[p._id]) {
                                    setHoveredInfoId(cur => (cur === p._id ? null : cur));
                                }
                                hoverTimeout.current = null;
                            }, 50);
                        };
                        // 6️⃣: Chuột ENTER floating hover card
                        const handleFloatingMouseEnter = () => {
                            if (!shouldUseHover) return;
                            if (hoverTimeout.current) {
                                clearTimeout(hoverTimeout.current);
                                hoverTimeout.current = null;
                            }
                            isInsideHover.current[p._id] = true;
                        };
                        // 7️⃣: Chuột LEAVE floating hover card
                        const handleFloatingMouseLeave = () => {
                            if (!shouldUseHover) return;
                            isInsideHover.current[p._id] = false;
                            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                            hoverTimeout.current = setTimeout(() => {
                                if (!isInsideHover.current[p._id]) {
                                    setHoveredInfoId(cur => (cur === p._id ? null : cur));
                                }
                                hoverTimeout.current = null;
                            }, 50);
                        };

                        // Handler for click to go to profile
                        const handleUserClick = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleGoToProfile(p.user);
                        };

                        return (
                            <div
                                key={p._id}
                                className="bg-[#252728] rounded-lg p-4 text-white group relative mb-8"
                            >
                                {/* WRAPPER cho info-row + info-hover-block */}
                                <div style={{ position: "relative" }}>
                                    {showFloating && (
                                        <div
                                            data-float-hover={p._id}
                                            className={
                                                // Changed z-50 to z-30 so it is lower than the search tab z-40
                                                `absolute top-10 z-30 w-[420px] bg-[#252728] border border-gray-600 rounded-xl flex-col transition-opacity duration-200 flex pointer-events-auto opacity-100`
                                            }
                                            style={{ left: 0 }}
                                            onMouseEnter={handleFloatingMouseEnter}
                                            onMouseLeave={handleFloatingMouseLeave}
                                        >
                                            <div
                                                className="w-full h-[144px] bg-black rounded-t-xl"
                                                style={{
                                                    backgroundImage: `url(${p.bioUser?.cover
                                                        ? getCloudinaryCoverLink(
                                                            p.bioUser.cover,
                                                            p.bioUser.coverCroppedArea,
                                                            420,
                                                            144
                                                        )
                                                        : "https://res.cloudinary.com/dpztbd1zk/image/upload/v1758185478/noneCover_m2j00b.png"
                                                        })`,
                                                    backgroundSize: "cover",
                                                    backgroundPosition: "center",
                                                    backgroundRepeat: "no-repeat",
                                                }}
                                            ></div>
                                            <>
                                                <div className="relative flex px-4 -mt-14">
                                                    <Avatar
                                                        src={
                                                            p.bioUser?.avatar
                                                                ? getCloudinaryImageLink(
                                                                    p.bioUser.avatar,
                                                                    p.bioUser.avatarCroppedArea,
                                                                    120
                                                                )
                                                                : undefined
                                                        }
                                                        croppedArea={p.bioUser?.avatarCroppedArea}
                                                        size={120}
                                                        className="rounded-full border-2 border-[#252728]"
                                                    />

                                                    <div className="ml-4 mt-16 flex flex-col leading-none">
                                                        <span className="text-white text-lg font-semibold">
                                                            {p.profileUser?.name || "Chưa đặt tên"}
                                                        </span>
                                                        <span className="text-gray-300 text-sm">
                                                            User: {p.profileUser?.username}
                                                        </span>
                                                        <span className="mt-1 text-gray-400 text-sm">
                                                            Tuổi: 21
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-center items-end gap-3 mt-6 mb-3">
                                                    <RelationshipButton
                                                        relationship={p.relationship}
                                                        myId={myId}
                                                        userId={p.user}
                                                        name={p.profileUser?.name}
                                                        avatar={
                                                            p.bioUser?.avatar
                                                                ? getCloudinaryImageLink(
                                                                    p.bioUser.avatar,
                                                                    p.bioUser.avatarCroppedArea,
                                                                    120
                                                                )
                                                                : undefined
                                                        }
                                                        username={p.profileUser?.username}
                                                        onRelationshipChange={handleRelationshipChange}
                                                    />
                                                </div>
                                            </>
                                        </div>
                                    )}

                                    {/* Info Row (avatar, name, time) triggers floating block on mouseEnter/Leave */}
                                    <div className="flex w-full">
                                        <div
                                            data-row-hover={p._id}
                                            className={`flex items-center relative pr-2 z-20 max-w-full ${shouldUseHover ? "cursor-pointer" : ""}`}
                                            onMouseEnter={handleMouseEnter}
                                            onMouseLeave={handleMouseLeave}
                                            onClick={handleUserClick}
                                            title="Đến trang cá nhân"
                                            style={{ cursor: "pointer" }}
                                        >
                                            <div className="flex items-center">
                                                <Avatar
                                                    src={
                                                        p.bioUser?.avatar
                                                            ? getCloudinaryImageLink(
                                                                p.bioUser.avatar,
                                                                p.bioUser.avatarCroppedArea,
                                                                40
                                                            )
                                                            : undefined
                                                    }
                                                    size={40}
                                                    className="rounded-full flex-shrink-0 mr-3"
                                                />
                                            </div>
                                            <div className="flex flex-col justify-center leading-none">
                                                <span className="font-semibold mb-1">{p.profileUser?.name || p.profileUser?.username || "Ai đó"}</span>
                                                <span className="text-sm text-[#b0b3b8]">
                                                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* END WRAPPER hover row + floating-block */}

                                {p.text && (
                                    <div className="whitespace-pre-wrap break-words mt-2">
                                        {p.text}
                                    </div>
                                )}
                                {fileCount > 0 && mediaBlock}

                                <PostReactButton
                                    post={p}
                                    onReact={(
                                        reactionName,
                                        prevReaction,
                                        postId
                                    ) => handleReact(reactionName, prevReaction, postId)}
                                    onComment={() => handleComment(p)}
                                    onShare={() => handleShare(p)}
                                    isOnPost={false}
                                    pendingReactPostId={pendingReactPostId}
                                    pendingSharePostId={pendingSharePostId}
                                />
                            </div>
                        );
                    })
                }
            </div>
            {/* ShowImage popup */}
            {showImage && (
                <ShowImage
                    images={showImageFiles}
                    initialIndex={showImageIdx}
                    onClose={handleCloseShowImage}
                    avatar={showImagePosterAvatar}
                    avatarCroppedArea={showImageAvatarCroppedArea}
                    name={showImagePosterName}
                    username={showImagePosterUsername}
                    createdAt={showImageCreatedAt}
                />
            )}
            {/* Modified Showpost popup rendering according to specification */}
            {showPostPopup && selectedPost && (
                <Showpost
                    isShow={showPostPopup}
                    post={selectedPost}
                    onClose={handleCloseShowPost}
                    onReact={(
                        reactionName,
                        prevReaction,
                        postId
                    ) => handleReact(reactionName, prevReaction, postId)}
                    onShare={() => handleShare(selectedPost)}
                    myAvatar={myAvatar}
                    myName={myName}
                    myUsername={myUsername}
                    onPostComment={handlePostComment}
                    onDelete={handleDeletePost}
                />
            )}
        </div>
    );
}
