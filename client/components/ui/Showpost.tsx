"use client";
import React, { useCallback } from "react";
import PostReactButton from "./PostReactButton";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { apiCommentPost, apiDeletePost, apiLoadComment, apiReport, apiReportComment, apiDeleteComment } from "@/api/post.api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faFlag, faBan, faEllipsis } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";
import { useSelector } from "react-redux";
import { apiBanUserAndRemovePost, apiBanUserAndRemoveComment } from "@/api/management.api";
import ShowImage from "./ShowImage";

// PopupCloseButton Component for ban popup (hover nền xám full tròn)
const PopupCloseButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel?: string }) => (
    <button
        className="absolute right-4 top-4 text-gray-400 hover:bg-gray-700 hover:text-white text-2xl cursor-pointer rounded-full w-10 h-10 flex items-center justify-center transition z-20 bg-transparent hover:bg-gray-700"
        onClick={onClick}
        aria-label={ariaLabel}
        type="button"
        style={{ padding: 0, margin: 0, background: "transparent", border: "none" }}
    >&times;</button>
);

function getTimeAgo(date: string | number | Date): string {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
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

function getCloudinaryCoverLink(
    url?: string,
    croppedArea?: any,
    width: number = 390,
    height: number = 144
) {
    return url || "https://res.cloudinary.com/dpztbd1zk/image/upload/v1758185478/noneCover_m2j00b.png";
}

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
};

type PendingComment = {
    id: string;
    user: { avatar?: string; name: string; username: string };
    content: string;
    createdAt: string;
    pending: true;
};

// Real comment from BE structure with *username* (đã lấy thêm) + avatar, name, etc.
type RealComment = {
    _id: string; // comment id
    post: string;
    user: {
        _id: string;
        name: string;
        username?: string; // <-- thêm username từ BE
        avatar?: string;
        avatarCroppedArea?: any;
        // ...other user fields if needed
    };
    text: string;
    createdAt: string;
    updatedAt: string;
    __v?: number;
};

type AnyComment = PendingComment | RealComment;

interface ShowpostProps {
    isShow: boolean;
    post: PostType;
    onClose: () => void;
    onReact: (
        reactionName: "like" | "love" | "fun" | "sad" | "angry" | null,
        prevReaction: "like" | "love" | "fun" | "sad" | "angry" | null,
        postId: string
    ) => void;
    myAvatar?: string;
    myName?: string;
    myUsername?: string;
    onSendComment?: (text: string) => void;
    onShare?: (postId: string) => void;
    onDelete?: (postId: string) => void;
    onPostComment?: (postId: string, delta: number) => void; // New: callback when comment adds/removes
    onLoadComment?: (postId: string, commentCount: number) => void; // NEW: callback when load comment (set tổng số theo id)
}

// --- NEW: onLoadComment handler: đặt (set) số lượng commentCount của post chỉ định bằng một giá trị mới ---
const Showpost: React.FC<ShowpostProps> = ({
    isShow,
    post,
    onClose,
    onReact,
    onShare,
    myAvatar,
    myName,
    myUsername,
    onSendComment,
    onDelete,
    onPostComment, // NEW: callback when comment adds/removes
    onLoadComment    // <--- add mới
}) => {
    if (!isShow || !post) return null;

    // Redux auth
    const auth = useSelector((state: any) => state.auth)
    const role = auth?.user?.role

    function getPostAvatar(post: PostType, size: number = 40): string {
        if (post.bioUser && post.bioUser.avatar) {
            return getCloudinaryImageLink(post.bioUser.avatar, post.bioUser.avatarCroppedArea, size);
        }
        return "https://ui-avatars.com/api/?name=Demo&background=random";
    }
    function getPostName(post: PostType): string {
        if (post.profileUser && post.profileUser.name) {
            return post.profileUser.name;
        }
        return "Bạn";
    }

    // --- State & handler for show image modal ---
    const [showImageState, setShowImageState] = React.useState<{ open: boolean, index: number }>({ open: false, index: 0 });
    const openShowImage = (index: number) => setShowImageState({ open: true, index });
    const closeShowImage = () => setShowImageState({ open: false, index: 0 });

    // Check if the current user is post owner (so they can delete)
    const isOwner = React.useMemo(() => {
        if (typeof myUsername !== "string" || !myUsername.length) return false;
        if (post.profileUser && post.profileUser.username) {
            return post.profileUser.username === myUsername;
        }
        return false;
    }, [myUsername, post]);

    // Determine ban button logic: if admin and not owner, show Ban instead of Report/Xóa
    const showBanButton = React.useMemo(() => {
        return role === "Admin" && !isOwner;
    }, [role, isOwner]);

    // Xác nhận xóa post của bản thân
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Ban popup control and number-of-days state (for post)
    const [showBanPopup, setShowBanPopup] = React.useState(false);
    const [banDays, setBanDays] = React.useState<string>("0");
    const [banError, setBanError] = React.useState<string>("");

    // --------- Bình luận: popup báo cáo comment -------------
    // State for showing report comment popup
    const [openReportCommentId, setOpenReportCommentId] = React.useState<string | null>(null);
    const [commentMenuOpenId, setCommentMenuOpenId] = React.useState<string | null>(null);
    const [isReportingComment, setIsReportingComment] = React.useState(false);

    // --------- Popups & state for comment ban/delete ---------
    const [openBanCommentId, setOpenBanCommentId] = React.useState<string | null>(null);
    const [banCommentDays, setBanCommentDays] = React.useState<string>("0");
    const [banCommentError, setBanCommentError] = React.useState<string>("");

    // --------- Popup xác nhận xoá comment tự viết
    const [showDeleteCommentId, setShowDeleteCommentId] = React.useState<string | null>(null);
    const [isDeletingComment, setIsDeletingComment] = React.useState(false);

    // Số lượng comment, update bằng res.total từ apiLoadComment
    const [commentCount, setCommentCount] = React.useState<number>(
        typeof post.commentCount === "number" ? post.commentCount : 0
    );

    // Nếu parent update prop post (ví dụ về lại modal), đồng bộ lại commentCount theo post mới
    React.useEffect(() => {
        setCommentCount(typeof post.commentCount === "number" ? post.commentCount : 0);
    }, [post.commentCount, post._id]);

    // Truyền vào PostReactButton để đảm bảo đồng bộ giao diện
    const [commentCountDelta, setCommentCountDelta] = React.useState(0);

    // ------ REWORK: Only allow outside button to trigger commentCountDelta
    const handleExternalCommentDelta = React.useCallback((delta?: number) => {
        if (typeof delta === "number") {
            setCommentCountDelta((prev) => prev + delta);
        }
    }, []);

    // --- NEW: onLoadComment handler: đặt (set) số lượng commentCount của post chỉ định bằng một giá trị mới ---
    // (Not used directly in Showpost, but description's context provided for consistency)
    // Example implement (for context, usually in Parent):
    // const handleLoadComment = useCallback(
    //   (postId: string, commentCount: number) => {
    //     setPosts(prevPosts =>
    //       prevPosts.map(post =>
    //         post._id === postId
    //           ? { ...post, commentCount: Math.max(0, commentCount) }
    //           : post
    //       )
    //     );
    //   },
    //   []
    // );

    // This helper will find the comment by ID and return its name (with fallback)
    const getCommentUserNameById = (commentId: string | null): string => {
        if (!commentId) return "";
        // Find in loaded comments
        const comment = [...pendingComments, ...comments].find((c: AnyComment) =>
            ("pending" in c && c.pending ? c.id === commentId : (c as RealComment)._id === commentId)
        );
        if (!comment) return "";
        if ("pending" in comment && comment.pending) {
            // For pending, only lấy name, nếu không có thì lấy username
            return comment.user.name || comment.user.username || "";
        } else {
            // For real, chỉ lấy name thôi, nếu không có name mới lấy username
            const user = (comment as RealComment).user;
            if (user.name) return user.name;
            if (user.username) return user.username;
            return "";
        }
    };

    // Thêm helper để lấy user id của comment theo comment id (dành cảnh báo)
    const getCommentUserIdById = (commentId: string | null): string | undefined => {
        if (!commentId) return undefined;
        // tìm trong pendingComments
        const pending = pendingComments.find(c => c.id === commentId);
        if (pending) return pending.user.username;
        // tìm trong real comments
        const real = comments.find((c: RealComment) => c._id === commentId);
        if (real) return (real.user && real.user._id) ? real.user._id : undefined;
        return undefined;
    };

    const getCommentUsernameByIdForCheck = (commentId: string | null): string | undefined => {
        if (!commentId) return undefined;
        // Cho pending
        const pending = pendingComments.find(c => c.id === commentId);
        if (pending) return pending.user.username;
        // Cho real
        const real = comments.find((c: RealComment) => c._id === commentId);
        if (real) return real.user && real.user.username;
        return undefined;
    };

    // Callback to open the report popup for a comment
    const handleOpenReportComment = (commentId: string) => {
        setCommentMenuOpenId(null);
        setOpenReportCommentId(commentId);
    };

    // Show popup ban comment
    const handleOpenBanComment = (commentId: string) => {
        setCommentMenuOpenId(null);
        setBanCommentDays("0");
        setBanCommentError("");
        setOpenBanCommentId(commentId);
    };

    // Xóa/cấm bình luận xác nhận (admin)
    const handleConfirmBanComment = async () => {
        if (!openBanCommentId) return;
        // Validate input for number >= 0
        const days = parseInt(banCommentDays);
        if (isNaN(days) || days < 0) {
            setBanCommentError("Vui lòng nhập số ngày lớn hơn hoặc bằng 0.");
            return;
        }
        setBanCommentError("");

        // Get userId for this comment
        const userId = getCommentUserIdById(openBanCommentId);
        if (!userId) {
            toast.warn("Không lấy được userId của bình luận để cấm/xóa.");
            setOpenBanCommentId(null);
            return;
        }

        // Gọi API ban user & xóa comment
        apiBanUserAndRemoveComment(openBanCommentId, days, userId)
            .then(res => {
                toast.success("Xong");
                // Xóa khỏi list
                setComments(prev => prev.filter((c) => (c as RealComment)._id !== openBanCommentId));
                // Giảm commentCount nếu thực sự xóa khỏi UI
                setCommentCount((prev) => Math.max(prev - 1, 0));
                if (onPostComment) {
                    onPostComment(post._id, -1);
                }
                // NEW: Báo về parent luôn nếu có onLoadComment (vì n có thể xóa/bắn lại số từ BE)
                if (typeof onLoadComment === "function") {
                    onLoadComment(post._id, Math.max(0, commentCount - 1));
                }
            })
            .catch(err => {
                toast.warn(getErrorMessage(err));
            });
        setOpenBanCommentId(null);
    };

    // Xoá bình luận (comment owner) xác nhận
    const handleDeleteOwnCommentConfirmed = async (commentId: string) => {
        setIsDeletingComment(true);
        try {
            const res = await apiDeleteComment({ commentId });
            if (res.success) {
                setComments(prev => prev.filter((c: RealComment) => c._id !== commentId));
                setShowDeleteCommentId(null);
                toast.success("Đã xoá bình luận.");
                // Giảm commentCount nếu thực sự xóa khỏi UI
                setCommentCount((prev) => Math.max(prev - 1, 0));
                if (onPostComment) {
                    onPostComment(post._id, -1);
                }
                // NEW: Báo về parent luôn nếu có onLoadComment
                if (typeof onLoadComment === "function") {
                    onLoadComment(post._id, Math.max(0, commentCount - 1));
                }
            } else {
                toast.warn(res.message || "Xóa bình luận thất bại.");
            }
        } catch (err) {
            toast.warn(getErrorMessage(err));
        } finally {
            setIsDeletingComment(false);
        }
    };

    // Report a comment
    const handleReportComment = async (commentId: string) => {
        let userId = getCommentUserIdById(commentId);
        if (!post || !post._id || !commentId || !userId) {
            alert("Thiếu thông tin để báo cáo bình luận.");
            return;
        }
        try {
            const res = await apiReportComment({
                commentId: commentId,
                postId: post._id,
                userId: userId,
            });
            toast.success(res.message);
        } catch (err) {
            toast.warn(getErrorMessage(err));
        } finally {
            setOpenReportCommentId(null);
        }
    };

    const handleDeleteOrReport = async () => {
        if (isOwner) {
            setShowDeleteConfirm(true);
        } else {
            try {
                const res = await apiReport({ postId: post._id });
                toast.success(res.message);
            } catch (err) {
                toast.warn(getErrorMessage(err));
            }
        }
    };

    // Handler called when user confirms delete
    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await apiDeletePost({ postId: post._id });
            toast.success(res.message);
            setShowDeleteConfirm(false);
            if (onDelete) {
                onDelete(post._id);
            }
            onClose?.();
        } catch (err) {
            toast.warn(getErrorMessage(err));
        } finally {
            setIsDeleting(false);
        }
    };

    // Ban handler logic (for admin ban action) -- open popup
    const handleBan = () => {
        setShowBanPopup(true);
        setBanDays("0");
        setBanError("");
    };

    // Actual ban (with days)
    const handleConfirmBan = () => {
        // Validate input for number >= 0
        const days = parseInt(banDays);
        if (isNaN(days) || days < 0) {
            setBanError("Vui lòng nhập số ngày lớn hơn hoặc bằng 0.");
            return;
        }
        setBanError("");
        apiBanUserAndRemovePost(post._id, days).then(res => {
            toast.success(res.message || "Đã cấm người dùng và xóa bài viết thành công.");
            if (onDelete) {
                onDelete(post._id);
            }
            onClose?.();
        }).catch(err => {
            toast.warn(getErrorMessage(err));
        });
        setShowBanPopup(false);
    };

    // Bổ sung: Click vào ảnh => mở ShowImage popup, truyền files và index ảnh, avatar là avatar url chưa crop
    const files = Array.isArray(post.files) ? post.files : [];
    const fileCount = files.length;
    let mediaBlock = null;
    // avatar url not cropped
    const rawAvatar = post.bioUser?.avatar || post.avatar || "";

    // wrap media renders with onClick only for images, not videos
    const renderMedia = (
        file: any,
        idx: number,
        extra: { className?: string; style?: React.CSSProperties } = {}
    ) => {
        if (file.file_type === "video") {
            return (
                <video
                    key={idx}
                    controls
                    className={`w-full h-full object-cover ${extra.className || ""}`.replace(/rounded-2xl/g, "")}
                    style={extra.style && 'borderRadius' in extra.style ? { ...extra.style, borderRadius: undefined } : extra.style}
                >
                    <source src={file.file_url} />
                </video>
            );
        }
        // Nếu là ảnh thì handle click
        return (
            <img
                key={idx}
                src={file.file_url}
                alt="post_file"
                className={`w-full h-full object-cover cursor-pointer ${extra.className || ""}`.replace(/rounded-2xl/g, "")}
                style={extra.style && 'borderRadius' in extra.style ? { ...extra.style, borderRadius: undefined } : extra.style}
                onClick={() => openShowImage(idx)}
            />
        );
    };

    if (fileCount === 1) {
        mediaBlock = (
            <div className="w-full" style={{ marginTop: 8 }}>
                {renderMedia(files[0], 0, {
                    className: "",
                    style: {
                        height: "auto",
                        maxHeight: "800px",
                        minHeight: "200px",
                        objectFit: "contain",
                        width: "100%",
                        padding: 0,
                        margin: 0,
                        display: "block",
                    },
                })}
            </div>
        );
    } else if (fileCount === 2) {
        mediaBlock = (
            <div className="w-full flex" style={{ marginTop: 8, gap: 8 }}>
                {files.map((f, idx2) =>
                    <div key={idx2} className="flex-1" style={{
                        padding: 0,
                        margin: 0,
                        ...(idx2 === 0 ? { marginRight: 4 } : { marginLeft: 4 }),
                    }}>
                        {renderMedia(f, idx2, {
                            className: "",
                            style: {
                                height: "256px",
                                width: "100%",
                                padding: 0,
                                margin: 0,
                                display: "block",
                            },
                        })}
                    </div>
                )}
            </div>
        );
    } else if (fileCount === 3) {
        mediaBlock = (
            <div
                className="w-full flex flex-col"
                style={{ marginTop: 8, height: "400px", gap: 8 }}
            >
                <div className="flex-1 flex" style={{ gap: 8 }}>
                    {renderMedia(files[0], 0, {
                        className: "",
                        style: {
                            height: "196px",
                            width: "100%",
                            padding: 0,
                            margin: 0,
                            objectFit: "cover",
                            display: "block"
                        },
                    })}
                </div>
                <div className="flex flex-row flex-1" style={{ gap: 8 }}>
                    {files.slice(1, 3).map((f, idx2) =>
                        <div key={idx2} className="flex-1" style={{
                            padding: 0,
                            margin: 0,
                            ...(idx2 === 0 ? { marginRight: 4 } : { marginLeft: 4 }),
                        }}>
                            {renderMedia(f, idx2 + 1, {
                                className: "",
                                style: {
                                    height: "196px",
                                    width: "100%",
                                    padding: 0,
                                    margin: 0,
                                    objectFit: "cover",
                                    display: "block"
                                },
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    } else if (fileCount === 4) {
        mediaBlock = (
            <div
                className="w-full flex flex-col"
                style={{ marginTop: 8, height: "400px", gap: 8 }}
            >
                <div className="flex-1 flex" style={{ gap: 8 }}>
                    {[0, 1].map((i) => (
                        <div key={i} className="flex-1" style={{
                            padding: 0,
                            margin: 0,
                            ...(i === 0 ? { marginRight: 4 } : { marginLeft: 4 }),
                        }}>
                            {renderMedia(files[i], i, {
                                className: "",
                                style: {
                                    height: "196px",
                                    width: "100%",
                                    padding: 0,
                                    margin: 0,
                                    objectFit: "cover",
                                    display: "block"
                                },
                            })}
                        </div>
                    ))}
                </div>
                <div className="flex-1 flex" style={{ gap: 8 }}>
                    {[2, 3].map((i) => (
                        <div key={i} className="flex-1" style={{
                            padding: 0,
                            margin: 0,
                            ...(i === 2 ? { marginRight: 4 } : { marginLeft: 4 }),
                        }}>
                            {renderMedia(files[i], i, {
                                className: "",
                                style: {
                                    height: "196px",
                                    width: "100%",
                                    padding: 0,
                                    margin: 0,
                                    objectFit: "cover",
                                    display: "block"
                                },
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    } else if (fileCount >= 5) {
        const moreCount = fileCount - 5;
        mediaBlock = (
            <div className="w-full flex flex-col" style={{ marginTop: 8, height: "400px", gap: 8 }}>
                <div className="flex w-full" style={{ height: "196px", gap: 8 }}>
                    {files.slice(0, 2).map((f, idx2) => (
                        <div key={idx2} className="flex-1" style={{
                            padding: 0,
                            margin: 0,
                            ...(idx2 === 0 ? { marginRight: 4 } : { marginLeft: 4 }),
                        }}>
                            {renderMedia(f, idx2, {
                                className: "",
                                style: {
                                    height: "100%",
                                    width: "100%",
                                    padding: 0,
                                    margin: 0,
                                    display: "block"
                                },
                            })}
                        </div>
                    ))}
                </div>
                <div className="flex w-full" style={{ height: "196px", gap: 8 }}>
                    {files.slice(2, 5).map((f, idx2) => {
                        if (idx2 === 2 && moreCount > 0) {
                            return (
                                <div key={idx2} className="relative flex-1 h-full" style={{
                                    padding: 0,
                                    margin: 0,
                                    marginLeft: 4,
                                }}>
                                    {renderMedia(f, idx2 + 2, {
                                        className: "",
                                        style: {
                                            height: "100%",
                                            width: "100%",
                                            padding: 0,
                                            margin: 0,
                                            display: "block"
                                        },
                                    })}
                                    <div
                                        className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center cursor-pointer"
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
                            <div key={idx2} className="flex-1 h-full" style={{
                                padding: 0,
                                margin: 0,
                                ...(idx2 === 0 ? { marginRight: 4 } : { marginLeft: 4 }),
                            }}>
                                {renderMedia(f, idx2 + 2, {
                                    className: "",
                                    style: {
                                        height: "100%",
                                        width: "100%",
                                        padding: 0,
                                        margin: 0,
                                        display: "block"
                                    },
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const postName = getPostName(post);
    const postAvatar = getPostAvatar(post, 40);

    // State for comments from API (RealComment[])
    const [comments, setComments] = React.useState<RealComment[]>([]);
    const [isCommentInputFocused, setIsCommentInputFocused] = React.useState(false);

    // Pending comment state
    const [pendingComments, setPendingComments] = React.useState<PendingComment[]>([]);

    // Track whether there is more server comments to load
    const [hasMoreComments, setHasMoreComments] = React.useState(true);
    // Prevent multiple simultaneous loads
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    // Track if initial load is still loading
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);

    React.useEffect(() => {
        setCommentMenuOpenId(null);
        setOpenReportCommentId(null);
        setIsReportingComment(false);
        setOpenBanCommentId(null);
        setShowDeleteCommentId(null);
    }, [isShow, post?._id]);

    // Lấy comment mới nhất để truyền cursor cho apiLoadComment
    function getLastCursor() {
        if (comments.length === 0) return undefined;
        const last = comments[comments.length - 1];
        return { time: last.createdAt, id: last._id };
    }

    // Load initial comments on open modal
    React.useEffect(() => {
        let ignore = false;
        if (isShow && post?._id) {
            setComments([]);
            setPendingComments([]);
            setHasMoreComments(true);
            setIsInitialLoading(true);
            (async () => {
                try {
                    const res = await apiLoadComment({ postId: post._id });
                    if (!ignore && res && res.success && Array.isArray(res.data)) {
                        setComments(res.data);
                        // -- Update commentCount from res.total if present
                        const resTotal =
                            typeof res.total === "number"
                                ? res.total
                                : (Array.isArray(res.data) ? res.data.length : 0);
                        setCommentCount(resTotal);
                        // --- NEW: Gọi cb onLoadComment từ parent khi biết số lượng comment thực tế lần đầu load ---
                        if (typeof onLoadComment === "function") {
                            onLoadComment(post._id, resTotal);
                        }
                        if (!res.data.length || (Array.isArray(res.data) && res.data.length === 0)) {
                            setHasMoreComments(false);
                        }
                        if (!res.data.length || res.data.length < 5) setHasMoreComments(false);
                    }
                } catch (err) {
                    console.error('Lỗi load comment:', err);
                } finally {
                    if (!ignore) setIsInitialLoading(false);
                }
            })();
        }
        return () => { ignore = true; };
    }, [isShow, post?._id, onLoadComment, post._id]);

    // NO button; handle infinite scroll to load more when scroll to end of container
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Infinite scroll handler (load more comments)
    React.useEffect(() => {
        if (!isShow) return;
        const el = scrollContainerRef.current;
        if (!el) return;

        let ticking = false;

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                const threshold = 10;
                const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (distanceToBottom <= threshold && hasMoreComments && !isLoadingMore && comments.length > 0) {
                    loadMoreComments();
                }
                ticking = false;
            });
        };
        el.addEventListener('scroll', handleScroll);

        return () => {
            el.removeEventListener('scroll', handleScroll);
        };
    }, [isShow, hasMoreComments, isLoadingMore, comments.length]);

    // Load more comments by cursor
    const loadMoreComments = async () => {
        if (!post?._id || comments.length === 0 || isLoadingMore || !hasMoreComments) return;
        setIsLoadingMore(true);
        try {
            const last = comments[comments.length - 1];
            const cursor = { time: last.createdAt/*, id: last._id*/ };
            const res = await apiLoadComment({ postId: post._id, cursor });
            if (res && res.success && Array.isArray(res.data)) {
                setComments(prev => [...prev, ...res.data]);
                // -- Update commentCount from res.total if present
                if (typeof res.total === "number") {
                    setCommentCount(res.total);
                    // --- NEW: Gọi cb onLoadComment từ parent nếu có
                    if (typeof onLoadComment === "function") {
                        onLoadComment(post._id, res.total);
                    }
                }
                if (!res.data.length || res.data.length < 5) setHasMoreComments(false);
            } else {
                setHasMoreComments(false);
            }
        } catch (err) {
            setHasMoreComments(false);
            console.error("Lỗi tải thêm bình luận:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const [commentInput, setCommentInput] = React.useState("");
    const commentInputRef = React.useRef<HTMLTextAreaElement>(null);

    const MAX_TEXTAREA_HEIGHT = 500;

    const adjustTextareaHeight = () => {
        const textarea = commentInputRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            let newHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
            textarea.style.height = `${newHeight}px`;
        }
    };

    React.useEffect(() => {
        adjustTextareaHeight();
    }, [commentInput]);

    function getCurrentUserCommentMeta() {
        return {
            name:
                typeof myName === "string" && myName.length > 0
                    ? myName
                    : "Bạn",
            username:
                typeof myUsername === "string" && myUsername.length > 0
                    ? myUsername
                    : "me",
            avatar: myAvatar || "",
        };
    }

    // Đưa handleSendComment và handleDeleteOwnCommentConfirmed cập nhật comments và commentCount trong post
    const handleSendComment = async () => {
        const text = commentInput.trim();
        if (text.length === 0) return;

        const pendingId = "pending-" + Math.random().toString(36).slice(2, 10);

        const userMeta = getCurrentUserCommentMeta();
        const pendingCommentObj: PendingComment = {
            id: pendingId,
            user: {
                avatar: userMeta.avatar,
                name: userMeta.name,
                username: userMeta.username,
            },
            content: text,
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setPendingComments(prev => [pendingCommentObj, ...prev]);
        setCommentInput("");
        if (commentInputRef.current) {
            commentInputRef.current.focus();
            adjustTextareaHeight();
        }
        if (onSendComment) onSendComment(text);

        try {
            const res = await apiCommentPost({ postId: post._id, comment: text });
            if (res && res.success) {
                setPendingComments(prev => prev.filter(c => c.id !== pendingId));
                let displayUser = { ...res.comment.user };
                if (!displayUser.name && userMeta.name) displayUser.name = userMeta.name;
                if (!displayUser.username && userMeta.username) displayUser.username = userMeta.username;
                if (!displayUser.avatar && userMeta.avatar) displayUser.avatar = userMeta.avatar;

                const realComment: RealComment = {
                    _id: res.comment._id,
                    post: res.comment.post,
                    user: displayUser,
                    text: res.comment.text,
                    createdAt: res.comment.createdAt,
                    updatedAt: res.comment.updatedAt || res.comment.createdAt,
                };
                setComments(prev => [realComment, ...prev]);
                // Cộng 1 vào commentCount khi bình luận thành công
                setCommentCount((prev) => prev + 1);
                if (onPostComment) {
                    onPostComment(post._id, 1);
                }
                // NEW: Báo về parent số lượng mới nếu cần
                if (typeof onLoadComment === "function") {
                    onLoadComment(post._id, commentCount + 1);
                }
            } else {
                setPendingComments(prev => prev.filter(c => c.id !== pendingId));
            }
        } catch (err) {
            setPendingComments(prev => prev.filter(c => c.id !== pendingId));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendComment();
        }
    };

    const HEADER_HEIGHT = 54;
    const FOOTER_HEIGHT = 72 + 10;
    const modalRef = React.useRef<HTMLDivElement>(null);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (
            commentInputRef.current &&
            document.activeElement === commentInputRef.current
        ) {
            return;
        }
        if (
            modalRef.current &&
            !modalRef.current.contains(e.target as Node)
        ) {
            onClose();
        }
    };

    React.useEffect(() => {
        if (!isShow) return;
        const originalOverflow = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isShow]);

    React.useEffect(() => {
        if (!isShow) return;
        const handleKeyDownEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDownEscape);
        return () => window.removeEventListener("keydown", handleKeyDownEscape);
    }, [isShow, onClose]);

    // Report menu outside click handler for comment actions
    React.useEffect(() => {
        if (!commentMenuOpenId) return;

        const handleClick = (event: MouseEvent) => {
            if (
                (event.target as HTMLElement).closest(".comment-options-btn")
                || (event.target as HTMLElement).closest(".comment-options-dropdown")
            ) {
                return;
            }
            setCommentMenuOpenId(null);
        };

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [commentMenuOpenId]);

    // Check if the current user is the owner of the comment
    function isCommentOwner(comment: RealComment) {
        if (!myUsername) return false;
        return comment.user.username === myUsername;
    }

    function renderCommentItem(comment: AnyComment) {
        if ("pending" in comment && comment.pending === true) {
            return (
                <div key={comment.id} className="flex gap-2 items-start opacity-100 relative">
                    <Avatar
                        size={32}
                        src={comment.user.avatar}
                        className="rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 bg-[#242528] rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{comment.user.name}</span>
                            {comment.user.username && (
                                <span className="text-xs text-[#b0b3b8]">@{comment.user.username}</span>
                            )}
                            <span className="text-xs text-[#b0b3b8] ml-2">
                                {getTimeAgo(comment.createdAt)}
                            </span>
                            <span className="ml-2 text-xs text-blue-400 flex items-center animate-pulse" title="Đang gửi">
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="mr-1">
                                    <circle cx="12" cy="12" r="10" stroke="#60A5FA" strokeWidth="2" opacity="0.5" />
                                    <path d="M12 6v6l4 2" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                Đang gửi...
                            </span>
                        </div>
                        <div className={`text-white text-sm whitespace-pre-line mt-1 opacity-80 italic`}>{comment.content}</div>
                    </div>
                </div>
            )
        }

        const realComment = comment as RealComment;
        const isCurrentUserOwner = isCommentOwner(realComment);

        return (
            <div key={realComment._id} className="flex gap-2 items-start opacity-100 relative group">
                <Avatar
                    size={32}
                    src={realComment.user.avatar}
                    className="rounded-full flex-shrink-0"
                />
                <div className="flex-1 bg-[#242528] rounded-xl px-3 py-2 relative">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{realComment.user.name}</span>
                        {realComment.user.username
                            ? <span className="text-xs text-[#b0b3b8]">@{realComment.user.username}</span>
                            : (realComment.user._id &&
                                <span className="text-xs text-[#b0b3b8]">@{realComment.user._id.slice(-6)}</span>
                            )
                        }
                        <span className="text-xs text-[#b0b3b8] ml-2">{getTimeAgo(realComment.createdAt)}</span>
                        {/* Nút xóa cho owner hoặc admin và thêm dropdown actions cho admin/not owner */}
                        <div className="ml-auto relative flex items-center gap-1">
                            {/* Chủ comment thấy nút xóa */}
                            {isCurrentUserOwner && (
                                <button
                                    className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] max-w-[30px] max-h-[30px] bg-[#242528] border-none outline-none rounded-full opacity-70 hover:opacity-100 focus:bg-[#35363b] hover:bg-[#35363b] p-0 cursor-pointer flex items-center justify-center"
                                    onClick={() => setShowDeleteCommentId(realComment._id)}
                                    tabIndex={0}
                                    aria-label="Xóa bình luận"
                                    type="button"
                                    style={{ color: "#ef4444" }}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                            {/* Nếu admin thì hiển thị menu ellipsis cho mọi comment không do mình viết */}
                            {role === "Admin" && !isCurrentUserOwner && (
                                <button
                                    className="comment-options-btn w-[30px] h-[30px] min-w-[30px] min-h-[30px] max-w-[30px] max-h-[30px] bg-[#242528] transition-all border-none outline-none rounded-full opacity-70 hover:opacity-100 focus:bg-[#35363b] hover:bg-[#35363b] cursor-pointer p-0"
                                    onClick={() => setCommentMenuOpenId(prev => prev === realComment._id ? null : realComment._id)}
                                    tabIndex={0}
                                    aria-label="Tuỳ chọn (Admin)"
                                    type="button"
                                >
                                    <FontAwesomeIcon icon={faEllipsis} />
                                </button>
                            )}
                            {/* Nếu user thường, không phải chủ comment, thì chỉ cho report */}
                            {myUsername && !isCurrentUserOwner && role !== "Admin" && (
                                <button
                                    className="comment-options-btn w-[30px] h-[30px] min-w-[30px] min-h-[30px] max-w-[30px] max-h-[30px] bg-[#242528] transition-all border-none outline-none rounded-full opacity-70 hover:opacity-100 focus:bg-[#35363b] hover:bg-[#35363b] cursor-pointer p-0"
                                    onClick={() => setCommentMenuOpenId(prev => prev === realComment._id ? null : realComment._id)}
                                    tabIndex={0}
                                    aria-label="Tuỳ chọn"
                                    type="button"
                                >
                                    <FontAwesomeIcon icon={faEllipsis} />
                                </button>
                            )}
                            {(commentMenuOpenId === realComment._id) && (
                                <div className="comment-options-dropdown absolute right-0 top-7 z-40 min-w-[150px] bg-[#232529] border border-gray-700 rounded-xl shadow-md overflow-hidden">
                                    {/* Nếu admin được phép ban/xóa comment */}
                                    {(role === "Admin" && !isCurrentUserOwner) && (
                                        <>
                                            <button
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-[#31333b] text-red-500 flex items-center gap-2 cursor-pointer"
                                                onClick={() => handleOpenBanComment(realComment._id)}
                                                type="button"
                                            >
                                                <FontAwesomeIcon icon={faBan} />
                                                Xóa/Cấm bình luận
                                            </button>
                                        </>
                                    )}
                                    {role !== "Admin" && (
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-[#31333b] text-red-400 flex items-center gap-2 cursor-pointer"
                                            onClick={() => handleOpenReportComment(realComment._id)}
                                            type="button"
                                        >
                                            <FontAwesomeIcon icon={faFlag} />
                                            Báo cáo bình luận
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-white text-sm whitespace-pre-line mt-1">{realComment.text}</div>
                </div>
            </div>
        )
    }

    const isNoComments =
        !isInitialLoading && pendingComments.length === 0 && comments.length === 0 && !isLoadingMore;
    const showAllCommentsDisplayed = !isLoadingMore && !isNoComments && !hasMoreComments;

    return (
        <div
            className="fixed inset-0 z-250 flex items-center justify-center"
            style={{
                padding: "10px",
                background: "rgba(0,0,0,0.8)",
                backdropFilter: "blur(1px)",
                overflow: "hidden",
            }}
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                className="relative mx-auto bg-[#1e1e1f] rounded-3xl shadow-xl border border-[#363636] flex flex-col"
                style={{
                    maxHeight: "calc(100vh - 40px)",
                    height: "auto",
                    width: "680px",
                    maxWidth: "100vw",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ShowImage popup nếu đang mở */}
                {showImageState.open && (
                    <ShowImage
                        images={files}
                        initialIndex={showImageState.index}
                        onClose={closeShowImage}
                        avatar={rawAvatar}
                        avatarCroppedArea={post.bioUser?.avatarCroppedArea}
                        name={post.profileUser?.name}
                        username={post.profileUser?.username}
                        createdAt={post.createdAt}
                    />
                )}
                {/* Tiêu đề trên cùng */}
                <div
                    className="w-full flex items-center justify-center font-semibold text-white text-lg py-3 border-b border-[#343434] sticky top-0 left-0 z-30 bg-[#1e1e1f] rounded-t-3xl"
                    style={{
                        minHeight: HEADER_HEIGHT,
                        position: "sticky",
                        top: 0,
                    }}
                >
                    Bài viết của {postName}

                    {showBanButton ? (
                        <button
                            className="absolute right-14 top-1/2 -translate-y-1/2 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer transition-colors"
                            onClick={handleBan}
                            aria-label="Cấm người dùng"
                            tabIndex={0}
                            type="button"
                            style={{ marginRight: 8 }}
                        >
                            <FontAwesomeIcon icon={faBan} style={{ color: "#e11d48" }} />
                        </button>
                    ) : (
                        <button
                            className="absolute right-14 top-1/2 -translate-y-1/2 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer transition-colors"
                            onClick={handleDeleteOrReport}
                            aria-label={isOwner ? "Xóa bài viết" : "Báo cáo bài viết"}
                            tabIndex={0}
                            type="button"
                            style={{ marginRight: 8 }}
                        >
                            {isOwner ? (
                                <FontAwesomeIcon icon={faTrash} style={{ color: "#ef4444" }} />
                            ) : (
                                <FontAwesomeIcon icon={faFlag} style={{ color: "#f59e42" }} />
                            )}
                        </button>
                    )}
                    {/* Nút Đóng (X) */}
                    <button
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer"
                        onClick={onClose}
                        aria-label="Đóng"
                        tabIndex={0}
                        type="button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={20}
                            height={20}
                            fill="none"
                            viewBox="0 0 20 20"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l8 8M6 14L14 6" />
                        </svg>
                    </button>
                </div>

                {/* Popup xác nhận xóa bài viết */}
                {showDeleteConfirm && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-300"
                        style={{
                            background: "rgba(0,0,0,0.65)",
                        }}
                    >
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96">
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-lg text-white">Xác nhận xóa bài viết</div>
                                <button
                                    className="text-gray-400 hover:bg-gray-700 text-2xl cursor-pointer rounded-full w-10 h-10 flex items-center justify-center transition"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    aria-label="Đóng xác nhận xóa"
                                    type="button"
                                >&times;</button>
                            </div>
                            <div className="text-[#ddd] text-center mb-8">
                                Bạn có chắc chắn muốn bài viết này? Hành động này không thể hoàn tác.<br />
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    disabled={isDeleting}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    type="button"
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 90 }}
                                    disabled={isDeleting}
                                    onClick={handleConfirmDelete}
                                    type="button"
                                >{isDeleting ? (
                                    <svg className="animate-spin mr-2" style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                )}Xóa</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup xác nhận xóa bình luận của bản thân */}
                {showDeleteCommentId && (
                    <div className="fixed inset-0 flex items-center justify-center z-300"
                        style={{ background: "rgba(0,0,0,0.65)" }}
                    >
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96">
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-base text-white">Xác nhận xóa bình luận</div>
                                <button
                                    className="text-gray-400 text-2xl cursor-pointer rounded-full transition-colors duration-100 hover:bg-[#2e2e31]"
                                    style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    onClick={() => setShowDeleteCommentId(null)}
                                    aria-label="Đóng popup"
                                    type="button"
                                >&times;</button>
                            </div>
                            <div className="text-[#ddd] text-center mb-8">
                                Bạn có chắc chắn muốn xóa bình luận này không?
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    onClick={() => setShowDeleteCommentId(null)}
                                    type="button"
                                    disabled={isDeletingComment}
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 90 }}
                                    onClick={() => handleDeleteOwnCommentConfirmed(showDeleteCommentId!)}
                                    type="button"
                                    disabled={isDeletingComment}
                                >
                                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                    Xóa
                                </button> 
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup xác nhận xóa & cấm người dùng (dành cho admin - ban) */}
                {showBanPopup && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-300"
                        style={{
                            background: "rgba(30,30,30,0.82)",
                            backdropFilter: "blur(1.5px)"
                        }}
                    >
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative">
                            <PopupCloseButton onClick={() => setShowBanPopup(false)} ariaLabel="Đóng xác nhận ban" />
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-lg text-white">
                                    Xóa bài viết &amp; cấm người dùng
                                </div>
                            </div>
                            <div className="text-[#ddd] text-center mb-4">
                                Bạn có chắc chắn muốn xóa bài viết này và cấm người dùng? <br />
                            </div>
                            <div className="w-full flex flex-col gap-3 mb-6">
                                <label htmlFor="ban-days" className="text-sm text-white font-semibold mb-1 text-left">Nhập số ngày cấm(0 là không đổi):</label>
                                <input
                                    id="ban-days"
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    autoFocus
                                    className="w-full px-3 py-2 rounded border border-gray-600 bg-[#212124] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={banDays}
                                    onChange={e => {
                                        const v = e.target.value.replace(/[^0-9]/g, "");
                                        setBanDays(v);
                                        setBanError("");
                                    }}
                                    placeholder="Số ngày cấm (0 = không đổi)"
                                />
                                {banError && (
                                    <div className="text-red-400 text-xs mt-1">{banError}</div>
                                )}
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    onClick={() => setShowBanPopup(false)}
                                    type="button"
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 120 }}
                                    onClick={handleConfirmBan}
                                    type="button"
                                >
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup xác nhận xóa & cấm user cho bình luận (Admin) */}
                {openBanCommentId && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-300"
                        style={{
                            background: "rgba(30,30,30,0.82)",
                            backdropFilter: "blur(1.5px)"
                        }}
                    >
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative">
                            <PopupCloseButton onClick={() => setOpenBanCommentId(null)} ariaLabel="Đóng xác nhận ban" />
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-lg text-white">
                                    Xóa bình luận &amp; cấm người dùng
                                </div>
                            </div>
                            <div className="text-[#ddd] text-center mb-4">
                                Bạn có chắc chắn muốn xóa bình luận này và cấm người dùng? <br />
                            </div>
                            <div className="w-full flex flex-col gap-3 mb-6">
                                <label htmlFor="ban-days" className="text-sm text-white font-semibold mb-1 text-left">Nhập số ngày cấm(0 là không đổi):</label>
                                <input
                                    id="ban-days"
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    autoFocus
                                    className="w-full px-3 py-2 rounded border border-gray-600 bg-[#212124] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={banCommentDays}
                                    onChange={e => {
                                        const v = e.target.value.replace(/[^0-9]/g, "");
                                        setBanCommentDays(v);
                                        setBanCommentError("");
                                    }}
                                    placeholder="Số ngày cấm (0 = không đổi)"
                                />
                                {banCommentError && (
                                    <div className="text-red-400 text-xs mt-1">{banCommentError}</div>
                                )}
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    onClick={() => setOpenBanCommentId(null)}
                                    type="button"
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 120 }}
                                    onClick={handleConfirmBanComment}
                                    type="button"
                                >
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup xác nhận báo cáo bình luận */}
                {openReportCommentId && (
                    <div className="fixed inset-0 flex items-center justify-center z-300" style={{ background: "rgba(0,0,0,0.65)" }}>
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96">
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-lg text-white">Báo cáo bình luận</div>
                                <button
                                    className="text-gray-400 text-2xl cursor-pointer rounded-full transition-colors duration-100 hover:bg-[#2e2e31]"
                                    style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    onClick={() => setOpenReportCommentId(null)}
                                    aria-label="Đóng báo cáo"
                                    type="button"
                                >&times;</button>
                            </div>
                            <div className="text-[#ddd] text-center mb-8">
                                {(() => {
                                    const commentName = getCommentUserNameById(openReportCommentId);
                                    if (commentName && typeof commentName === "string" && commentName.trim().length > 0) {
                                        return (
                                            <>
                                                Bạn có chắc muốnbáo cáo bình luận của <span className="font-semibold text-blue-400">{commentName}</span> không?<br />
                                            </>
                                        );
                                    }
                                    return (
                                        <>
                                            Bạn có chắc muốn <span className="text-red-500 font-semibold">báo cáo</span> bình luận này không?<br />
                                        </>
                                    );
                                })()}
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    onClick={() => setOpenReportCommentId(null)}
                                    type="button"
                                    disabled={isReportingComment}
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 90 }}
                                    onClick={() => handleReportComment(openReportCommentId)}
                                    type="button"
                                    disabled={isReportingComment}
                                >
                                    {isReportingComment ? (
                                        <svg className="animate-spin mr-2" style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <FontAwesomeIcon icon={faFlag} className="mr-2" />
                                    )}
                                    Báo cáo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Nội dung cuộn được */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 flex flex-col custom-scroll"
                    style={{
                        maxHeight: `calc(100vh - 40px - ${HEADER_HEIGHT}px - ${FOOTER_HEIGHT}px)`,
                        overflowY: "auto",
                        paddingTop: 0,
                        paddingBottom: 0,
                    }}
                >
                    {/* Info row */}
                    <div className="flex w-full pt-2 px-2">
                        <div className="flex items-center relative pr-2 z-20 max-w-full">
                            <div className="flex items-center">
                                <Avatar
                                    src={postAvatar}
                                    size={40}
                                    className="rounded-full flex-shrink-0 mr-3"
                                />
                            </div>
                            <div className="flex flex-col justify-center leading-none">
                                <span className="font-semibold mb-1">{postName}</span>
                                <span className="text-sm text-[#b0b3b8]">
                                    {post.createdAt
                                        ? getTimeAgo(post.createdAt)
                                        : ""}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Text + Media */}
                    {post.text && (
                        <div className="whitespace-pre-wrap break-words mt-2 px-6 text-white">
                            {post.text}
                        </div>
                    )}
                    {fileCount > 0 && (
                        <div className="w-full" style={{ padding: 0, margin: 0 }}>{mediaBlock}</div>
                    )}

                    {/* React, comment, share */}
                    <div className="px-6 pt-2">
                        <PostReactButton
                            post={{ ...post, commentCount }}
                            onReact={(
                                reactionName,
                                prevReaction,
                                postId
                            ) => {
                                onReact(reactionName, prevReaction, post._id);
                            }}
                            onComment={handleExternalCommentDelta}
                            commentDelta={commentCountDelta}
                            onShare={onShare ? () => onShare(post._id) : () => { /* no-op */ }}
                            isOnPost={true}
                        />
                    </div>

                    {/* Comment section: hiển thị bình luận với dạng đúng */}
                    <div className="px-6 pb-6">
                        <div className="border-t border-[#343434] pt-2 mt-2">
                            <div className="text-white font-semibold mb-2">Bình luận</div>
                            <div className="flex flex-col gap-3 pr-1">
                                {[...pendingComments, ...comments]
                                    .map((comment: AnyComment) => renderCommentItem(comment))}
                                {isLoadingMore && hasMoreComments && (
                                    <div className="flex justify-center my-2 text-blue-400">Đang tải thêm bình luận...</div>
                                )}
                                {!isInitialLoading && !isLoadingMore && isNoComments && (
                                    <div className="flex justify-center my-2 text-[#aaa] text-xs italic">
                                        Hãy là người bình luận đầu tiên
                                    </div>
                                )}
                                {showAllCommentsDisplayed && (
                                    <div className="flex justify-center my-2 text-[#aaa] text-xs italic">Đã hiển thị tất cả bình luận</div>
                                )}
                                {isInitialLoading && (
                                    <div className="flex justify-center my-2 text-blue-400">Đang tải bình luận...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Comment Input dưới đáy */}
                <div
                    className="rounded-3xl"
                    style={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 30,
                        background: "#1e1e1f",
                        maxHeight: MAX_TEXTAREA_HEIGHT,
                    }}
                >
                    <div
                        className="w-full flex items-center gap-2 border-t border-[#343434]  bg-[#1e1e1f] px-4 py-3 rounded-b-3xl"
                        style={{
                            minHeight: 72,
                            overflow: "visible",
                            maxHeight: MAX_TEXTAREA_HEIGHT,
                        }}
                    >
                        <Avatar
                            src={myAvatar}
                            size={40}
                            className="rounded-full flex-shrink-0"
                        />
                        <div
                            className={`flex-1 flex items-center rounded-xl bg-[#242528] transition-colors`}
                            style={{
                                paddingLeft: 4,
                                paddingRight: 6,
                                paddingTop: 2,
                                paddingBottom: 2,
                                minHeight: 40,
                                maxHeight: MAX_TEXTAREA_HEIGHT,
                                transition: "box-shadow 0.2s, border 0.2s, height 0.1s",
                                border: isCommentInputFocused ? "1px solid #2563EB" : "1px solid transparent",
                            }}
                        >
                            <textarea
                                ref={commentInputRef}
                                value={commentInput}
                                onFocus={() => setIsCommentInputFocused(true)}
                                onBlur={() => setIsCommentInputFocused(false)}
                                onChange={e => setCommentInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 text-white px-1 py-2 outline-none resize-none custom-scroll"
                                placeholder="Nhập bình luận..."
                                maxLength={2000}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    minHeight: 36,
                                    width: "100%",
                                    height: "auto",
                                    overflowY: "auto",
                                    resize: "none",
                                    maxHeight: MAX_TEXTAREA_HEIGHT,
                                }}
                                rows={1}
                            />
                        </div>
                        <button
                            type="button"
                            className={`ml-1 px-4 py-2 rounded-full cursor-pointer font-semibold transition ${commentInput.trim() === ""
                                ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                            style={{ minWidth: 74 }}
                            disabled={commentInput.trim() === ""}
                            onClick={handleSendComment}
                        >
                            Gửi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Showpost;
