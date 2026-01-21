import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faThumbsUp,
    faHeart,
    faFaceLaugh,
    faFaceSadCry,
    faFaceAngry,
    faShare,
    faComment,
    faUserPlus,
    faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGetMyAction } from "@/api/notification.api";
import ShowPostById from "@/components/ui/ShowpostById";
import { useSelector } from "react-redux";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { getCloudinaryCoverLink } from "@/helper/croppedImageHelper";
import { apiGetCoverHome } from "@/api/bio.api";

const REACT_ICON_MAP: Record<string, any> = {
    like: faThumbsUp,
    love: faHeart,
    fun: faFaceLaugh,
    sad: faFaceSadCry,
    angry: faFaceAngry,
};
const TYPE_ICON_MAP: Record<string, any> = {
    react: null,
    comment: faComment,
    share: faShare,
    friendRequest: faUserPlus,
    acceptFriend: faUserCheck,
};

function renderDescription(activity: any) {
    switch (activity.type) {
        case "react":
            switch (activity.reactType) {
                case "like":
                    return `Bạn đã thích bài viết của ${activity.name}`;
                case "love":
                    return `Bạn đã thả tim bài viết của ${activity.name}`;
                case "fun":
                    return `Bạn đã bày tỏ cảm xúc vui với bài viết của ${activity.name}`;
                case "sad":
                    return `Bạn đã bày tỏ cảm xúc buồn với bài viết của ${activity.name}`;
                case "angry":
                    return `Bạn đã bày tỏ cảm xúc tức giận với bài viết của ${activity.name}`;
                default:
                    return `Bạn đã tương tác với bài viết của ${activity.name}`;
            }
        case "comment":
            return `Bạn đã bình luận vào bài viết của ${activity.name}`;
        case "share":
            return `Bạn đã chia sẻ bài viết của ${activity.name}`;
        case "friendRequest":
            return `Bạn đã gửi lời mời kết bạn tới ${activity.name}`;
        case "acceptFriend":
            return `Bạn đã chấp nhận kết bạn với ${activity.name}`;
        default:
            return `Bạn đã thực hiện một hoạt động`;
    }
}

function timeAgoString(dateStr: string) {
    if (!dateStr) return "";
    const now = new Date();
    const time = new Date(dateStr);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
}

const PAGE_SIZE = 5;

const COVER_HEIGHT = 82;
const COVER_WIDTH = 330;

const RightSide: React.FC = () => {
    // Lấy thông tin user từ redux
    const user = useSelector((state: any) => state.user);

    const myName = user.profile?.name;
    const myUsername = user.profile?.username;
    const myAvatar = getCloudinaryImageLink(
        user.bio?.avatar,
        user.bio?.avatarCroppedArea,
        100
    );

    // State cho dữ liệu cover và vùng crop
    const [coverObj, setCoverObj] = useState<{ cover: string | null, coverCroppedArea: any | null }>({
        cover: null,
        coverCroppedArea: null,
    });

    // Lấy cover từ api khi user đã đăng nhập
    useEffect(() => {
        const fetchCover = async () => {
            try {
                const data = await apiGetCoverHome();
                console.log(data)
                setCoverObj({
                    cover: data?.cover?.cover,
                    coverCroppedArea: data?.cover?.coverCroppedArea ?? null,
                });
            } catch (e) {
                setCoverObj({
                    cover: null,
                    coverCroppedArea: null,
                });
            }
        };
        fetchCover();
    }, []);

    const cloudinaryCover = getCloudinaryCoverLink(
        coverObj.cover ?? "",
        coverObj.coverCroppedArea,
        COVER_WIDTH,
        COVER_HEIGHT
    );

    const [activities, setActivities] = useState<any[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const loaderRef = useRef<HTMLLIElement | null>(null);
    const [loading, setLoading] = useState(false);
    const nextCursor = useRef<string | null>(null);

    // For ShowPostById
    const [showPost, setShowPost] = useState<boolean>(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const router = useRouter();

    // Xử lý mở popup post
    const handleShowPost = (postId: string) => {
        setSelectedPostId(postId);
        setShowPost(true);
    };

    // Đóng popup post
    const handleClosePost = () => {
        setShowPost(false);
        setSelectedPostId(null);
    };

    // Xóa post từ popup (nếu cần)
    const handleDeletePost = (postId: string) => {
        setShowPost(false);
        setSelectedPostId(null);
        setActivities((prev) => prev.filter((a) => a.post !== postId));
    };

    // Fetch first page on mount
    useEffect(() => {
        setLoading(true);
        apiGetMyAction()
            .then((res) => {
                setActivities(res?.actions || []);
                nextCursor.current = res?.nextCursor ?? null;
                setHasMore(res?.nextCursor !== null);
            })
            .catch((err) => {
                setHasMore(false);
                setActivities([]);
            })
            .finally(() => setLoading(false));
    }, []);

    // Infinite scroll handler
    const handleLoadMore = useCallback(() => {
        if (loading || !hasMore || !nextCursor.current) return;
        setLoading(true);
        apiGetMyAction(nextCursor.current)
            .then((res) => {
                setActivities((prev) => [...prev, ...(res?.actions || [])]);
                nextCursor.current = res?.nextCursor ?? null;
                setHasMore(res?.nextCursor !== null);
            })
            .catch(() => setHasMore(false))
            .finally(() => setLoading(false));
    }, [loading, hasMore]);

    // Intersection observer for infinite scroll
    useEffect(() => {
        if (!hasMore || loading) return;
        const observer = new window.IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    handleLoadMore();
                }
            },
            { root: null, rootMargin: "0px", threshold: 0.2 }
        );
        const loader = loaderRef.current;
        if (loader) observer.observe(loader);
        return () => {
            if (loader) observer.unobserve(loader);
        };
    }, [handleLoadMore, hasMore, loading]);

    // Handler for activity click
    const handleActivityClick = (activity: any) => {
        if (
            activity.type === "react" ||
            activity.type === "comment" ||
            activity.type === "share"
        ) {
            if (activity.post) {
                handleShowPost(activity.post);
            }
        } else if (activity.type === "friendRequest") {
            router.push("/friends?key=requester");
        } else if (activity.type === "acceptFriend") {
            router.push("/friends");
        }
        // else do nothing or future cases
    };

    return (
        <>
            <div
                className="w-[330px] max-w-full h-[80vh] pt-6 pb-2 rounded-xl bg-[#222328] px-2 text-white shadow-md select-none"
                style={{
                    minWidth: "200px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* User Card */}
                <div
                    className="mb-5 cursor-pointer transition duration-150 hover:bg-[#32323a] hover:shadow-lg hover:brightness-110 rounded-lg"
                    onClick={() => router.push("/profile")}
                    style={{
                        // Slight brightness so images/children also are affected by hover
                        transition: "background 0.2s, box-shadow 0.2s, filter 0.2s",
                    }}
                >
                    {/* Cover */}
                    <div
                        className="rounded-t-lg w-full relative"
                        style={{
                            height: COVER_HEIGHT,
                            background: cloudinaryCover
                                ? `url('${cloudinaryCover}') center / cover no-repeat`
                                : "#35353b",
                        }}
                    />

                    {/* Row avatar + text */}
                    <div className="flex flex-row items-end px-6 relative">
                        {/* Avatar – chìm đúng 1/2 */}
                        <div
                            style={{
                                marginTop: -32, // CHỈ avatar bị kéo lên
                                zIndex: 2,
                                border: "4px solid #222328",
                                background: "#29313f",
                                borderRadius: "9999px",
                                boxShadow: "0 0 4px #0006",
                                width: 64,
                                height: 64,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden", // Thêm overflow ẩn để tránh ảnh bị méo
                            }}
                        >
                            <img
                                src={myAvatar}
                                alt={myName}
                                className="w-full h-full rounded-full object-cover"
                                style={{
                                    aspectRatio: "1 / 1",
                                    display: "block"
                                }}
                            />
                        </div>

                        {/* Name + username – dưới cover, không chìm */}
                        <div className="ml-4 pb-2">
                            <div className="font-bold text-base leading-5">
                                {myName}
                            </div>
                            <div className="text-xs opacity-80">
                                @{myUsername}
                            </div>
                        </div>
                    </div>
                </div>

                {/* END USER CARD */}

                <h2 className="text-lg font-bold mb-4 px-4 text-left">
                    Hoạt động gần đây của bạn
                </h2>
                <ul
                    className="space-y-3 pr-1 custom-scroll"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        maxHeight: "100%",
                        overflow: "auto",
                    }}
                >
                    {activities.map((activity) => {
                        let iconView = null;
                        if (
                            activity.type === "react" &&
                            activity.reactType &&
                            REACT_ICON_MAP[activity.reactType]
                        ) {
                            iconView = (
                                <FontAwesomeIcon
                                    icon={REACT_ICON_MAP[activity.reactType]}
                                    className="text-blue-400 w-5 h-5"
                                />
                            );
                        } else if (TYPE_ICON_MAP[activity.type]) {
                            iconView = (
                                <FontAwesomeIcon
                                    icon={TYPE_ICON_MAP[activity.type]}
                                    className="text-blue-400 w-5 h-5"
                                />
                            );
                        }

                        return (
                            <li
                                key={activity._id || activity.id}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-[#29292f] transition cursor-pointer"
                                onClick={() => handleActivityClick(activity)}
                            >
                                {/* Icon */}
                                <span>{iconView}</span>
                                {/* Detail */}
                                <div className="flex flex-col flex-1 items-start">
                                    <span
                                        className="text-sm text-left break-words overflow-hidden"
                                        style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {renderDescription(activity)}
                                    </span>
                                    <span className="text-xs text-gray-400 text-left">
                                        {timeAgoString(activity.createdAt)}
                                    </span>
                                </div>
                                <img
                                    src={activity.avatar}
                                    alt={activity.name}
                                    className="rounded-full object-cover w-9 h-9 border border-gray-700"
                                    style={{
                                        minWidth: 36,
                                        minHeight: 36,
                                        maxWidth: 36,
                                        maxHeight: 36,
                                    }}
                                />
                            </li>
                        );
                    })}
                    <li
                        ref={loaderRef}
                        className="flex items-center justify-center min-h-6 text-gray-400 text-xs font-medium py-2"
                    >
                        {loading && hasMore && <span>Đang tải thêm...</span>}
                        {!hasMore && <span>Không còn hoạt động nào khác</span>}
                    </li>
                </ul>
            </div>
            <ShowPostById
                postId={selectedPostId}
                isShow={showPost}
                onClose={handleClosePost}
                onDelete={handleDeletePost}
            />
        </>
    );
};

export default RightSide;
