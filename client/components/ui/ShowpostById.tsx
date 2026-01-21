"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import PostReactButton from "./PostReactButton";
import { apiGetSinglePost } from "@/api/profile.api";
import {
    apiCommentPost,
    apiLoadComment,
    apiSharePost,
    apiReactPost,
    apiDeletePost,
    apiReport,
    apiReportComment,
    apiDeleteComment,
} from "@/api/post.api";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faFlag, faBan, faEllipsis } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";
import { apiBanUserAndRemovePost, apiBanUserAndRemoveComment } from "@/api/management.api";
import ShowImage from "./ShowImage";

interface ShowpostByIdProps {
    postId: string | null;
    isShow: boolean;
    onClose: () => void;
    onDelete?: (postId: string) => void;
}

const PopupCloseButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel?: string }) => (
    <button
        className="absolute right-3 top-3 text-gray-400 hover:bg-gray-700 text-2xl cursor-pointer rounded-full w-10 h-10 flex items-center justify-center transition"
        onClick={onClick}
        aria-label={ariaLabel || "Đóng"}
        type="button"
        tabIndex={0}
        style={{ zIndex: 2 }}
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
}: { src?: string; size?: number; className?: string; croppedArea?: any }) {
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

interface UserBio {
    avatar: string;
    cover?: string;
    avatarCroppedArea?: any;
    coverCroppedArea?: any;
}

interface ProfileUser {
    name: string;
    username: string;
}

interface PostFile {
    file_type: string;
    file_url: string;
    order_index: number;
}

interface ReactCounts {
    angry: number;
    fun: number;
    like: number;
    love: number;
    sad: number;
    [key: string]: number;
}

type ReactionName = "like" | "love" | "fun" | "sad" | "angry";
type ReactionCount = {
    like: number;
    love: number;
    fun: number;
    sad: number;
    angry: number;
};
interface PostType {
    _id?: string;
    reactCounts?: Partial<ReactionCount>;
    myReact?: ReactionName | null;
    commentCount?: number;
    shareCount?: number;
    hasShared?: boolean;
    [key: string]: any;
}

export interface Post {
    _id: string;
    user: string;
    bioUser: UserBio;
    profileUser: ProfileUser;
    text: string;
    privacy: "public" | "private" | string;
    files: PostFile[];
    reactCounts: ReactCounts;
    shareCount: number;
    commentCount: number;
    comments: any[];
    createdAt: string;
    updatedAt: string;
    myReact: string | null;
    hasShared: boolean;
}

// Add type for image to match ShowImage.images prop
type ImageObj = {
    file_type?: string;
    file_url?: string;
    order_index?: number;
};

function getPostReactButtonProps(post: Post): PostType {
    return {
        _id: post._id,
        reactCounts: post.reactCounts,
        myReact: (["like", "love", "fun", "sad", "angry"].includes(post.myReact as string)
            ? post.myReact
            : null) as ReactionName | null,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        hasShared: post.hasShared,
    };
}

const ShowPostById: React.FC<ShowpostByIdProps> = ({ postId, isShow, onClose, onDelete }) => {
    const [post, setPost] = useState<Post | undefined>(undefined);
    const [pendingReact, setPendingReact] = useState<boolean>(false);
    const [pendingShare, setPendingShare] = useState<boolean>(false);
    const [pendingComment, setPendingComment] = useState<boolean>(false);
    const [commentText, setCommentText] = useState<string>("");
    const [commentError, setCommentError] = useState<string | null>(null);
    const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const showImageRef = useRef<HTMLDivElement>(null); // <- Add this line

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);

    const [showDeleteCommentId, setShowDeleteCommentId] = useState<string | null>(null);

    const [showBanPopup, setShowBanPopup] = useState(false);
    const [banDays, setBanDays] = useState("0");
    const [banError, setBanError] = useState("");

    const [comments, setComments] = useState<any[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreComments, setHasMoreComments] = useState(true);

    const [showReportCommentId, setShowReportCommentId] = useState<string | null>(null);
    const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);

    const [showBanCommentPopup, setShowBanCommentPopup] = useState(false);
    const [commentSelectedForBan, setCommentSelectedForBan] = useState<{ commentId: string, userId: string } | null>(null);
    const [banCommentDays, setBanCommentDays] = useState("0");
    const [banCommentError, setBanCommentError] = useState("");
    const [pendingBanComment, setPendingBanComment] = useState(false);

    // SHOWIMAGE STATE
    const [showImage, setShowImage] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

    const user = useSelector((state: any) => state.user);
    const myName = user.profile?.name;
    const myUsername = user.profile?.username;
    const myId = user?.userId;
    const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);

    const auth = useSelector((state: any) => state.auth)
    const role = auth?.user?.role

    useEffect(() => {
        if (!isShow) return;
        const originalOverflow = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isShow]);

    useEffect(() => {
        if (!isShow) return;
        const handleKeyDownEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDownEscape);
        return () => window.removeEventListener("keydown", handleKeyDownEscape);
    }, [isShow, onClose]);

    useEffect(() => {
        if (!commentMenuOpenId) return;
        const handleClick = (e: MouseEvent) => {
            const dropdowns = document.querySelectorAll(".comment-options-dropdown");
            let found = false;
            dropdowns.forEach((el: any) => {
                if (el.contains(e.target as Node)) found = true;
            });
            if (!found) setCommentMenuOpenId(null);
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [commentMenuOpenId]);

    useEffect(() => {
        let ignore = false;
        if (isShow && postId) {
            setPost(undefined);
            setComments([]);
            setHasMoreComments(true);
            apiGetSinglePost(postId).then(res => {
                if (ignore) return;
                if (res && res.success && res.post && res.post._id) {
                    setPost(res.post);
                    if (res.post.comments && Array.isArray(res.post.comments)) {
                        setComments(res.post.comments);
                        setHasMoreComments(!(res.post.comments.length < 5));
                    } else {
                        setComments([]);
                        setHasMoreComments(true);
                    }
                } else {
                    setPost(undefined);
                    setComments([]);
                }
            });
        } else if (!isShow) {
            setPost(undefined);
            setComments([]);
        }
        return () => { ignore = true; };
    }, [postId, isShow]);

    useEffect(() => {
        if (isShow && commentTextareaRef.current) {
            setTimeout(() => {
                commentTextareaRef.current?.setSelectionRange(commentText.length, commentText.length);
            }, 180);
        }
    }, [isShow, commentText.length]);

    const commentsContainerRef = useRef<HTMLDivElement>(null);

    const loadMoreComments = useCallback(async () => {
        if (!post || !post._id || comments.length === 0 || isLoadingMore || !hasMoreComments) return;
        setIsLoadingMore(true);

        try {
            const last = comments[comments.length - 1];
            const cursor = { time: last.createdAt };
            const res = await apiLoadComment({ postId: post._id, cursor });
            if (res && res.success && Array.isArray(res.data)) {
                setComments(prev => [...prev, ...res.data]);
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
    }, [post, comments, isLoadingMore, hasMoreComments]);

    useEffect(() => {
        if (!isShow) return;
        const container = commentsContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (!container || isLoadingMore || !hasMoreComments || !comments.length) return;
            if (
                container.scrollHeight - container.scrollTop - container.clientHeight < 20
            ) {
                loadMoreComments();
            }
        };
        container.addEventListener("scroll", handleScroll);
        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, [isShow, comments, isLoadingMore, hasMoreComments, loadMoreComments]);

    if (!isShow) return null;

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (showImage.open && showImageRef.current && showImageRef.current.contains(e.target as Node)) {
            // Click inside ShowImage: prevent closing
            return;
        }
        if (
            modalRef.current &&
            !modalRef.current.contains(e.target as Node)
        ) {
            onClose();
        }
    };

    const handleReact = async (
        reactionName: "like" | "love" | "fun" | "sad" | "angry" | null,
        prevReaction: "like" | "love" | "fun" | "sad" | "angry" | null,
        postId?: string
    ) => {
        if (!postId || !post || pendingReact) return;
        setPendingReact(true);

        let prevPostState: Post | undefined;
        setPost(prev => {
            prevPostState = prev;
            if (!prev) return prev;
            let newReactCounts = {
                like: prev.reactCounts?.like ?? 0,
                love: prev.reactCounts?.love ?? 0,
                fun: prev.reactCounts?.fun ?? 0,
                sad: prev.reactCounts?.sad ?? 0,
                angry: prev.reactCounts?.angry ?? 0,
            };
            if (prevReaction && prevReaction !== reactionName && newReactCounts[prevReaction] > 0) {
                newReactCounts[prevReaction] = newReactCounts[prevReaction] - 1;
            }
            if (reactionName && reactionName !== prevReaction) {
                newReactCounts[reactionName] = (newReactCounts[reactionName] ?? 0) + 1;
            }
            if (reactionName === null && prevReaction && newReactCounts[prevReaction] > 0) {
                newReactCounts[prevReaction] = newReactCounts[prevReaction] - 1;
            }
            return {
                ...prev,
                myReact: reactionName,
                reactCounts: newReactCounts,
            };
        });

        try {
            const res = await apiReactPost({ postId, react: reactionName || "" });
            if (!res?.success && prevPostState) {
                setPost(prevPostState);
            }
        } catch (e) {
            if (prevPostState) setPost(prevPostState);
        } finally {
            setPendingReact(false);
        }
    };

    const handleShare = async () => {
        if (!post || pendingShare) return;
        setPendingShare(true);
        setPost(prev => {
            if (!prev) return prev;
            let shareCount = typeof prev.shareCount === "number" ? prev.shareCount : 0;
            let newHasShared = !prev.hasShared;
            shareCount = newHasShared ? shareCount + 1 : Math.max(0, shareCount - 1);
            return {
                ...prev,
                hasShared: newHasShared,
                shareCount,
            };
        });
        try {
            const res = await apiSharePost({ postId: post._id });
            if (res) {
                const { share } = res;
                setPost(prev => {
                    if (!prev) return prev;
                    let shareCount = typeof prev.shareCount === "number" ? prev.shareCount : 0;
                    if (typeof prev.hasShared === "boolean") {
                        if (share === null && prev.hasShared) shareCount = shareCount > 0 ? shareCount - 1 : 0;
                        else if (share && !prev.hasShared) shareCount = shareCount + 1;
                    } else if (share) {
                        shareCount = shareCount + 1;
                    } else {
                        shareCount = shareCount > 0 ? shareCount - 1 : 0;
                    }
                    return {
                        ...prev,
                        hasShared: !!share,
                        shareCount,
                    };
                });
            }
        } catch (err) {
            setPost(prev => {
                if (!prev) return prev;
                let shareCount = typeof prev.shareCount === "number" ? prev.shareCount : 0;
                let newHasShared = !prev.hasShared;
                shareCount = newHasShared ? shareCount + 1 : Math.max(0, shareCount - 1);
                return { ...prev, hasShared: !newHasShared, shareCount };
            });
        } finally {
            setPendingShare(false);
        }
    };

    const handleDelete = async () => {
        if (!post) return;
        setPendingDelete(true);
        try {
            const res = await apiDeletePost({ postId: post._id });
            toast.success(res.message);
            if (onDelete) {
                onDelete(post._id);
            }
            onClose();
        } catch (err) {
            toast.warn(getErrorMessage(err));
        } finally {
            setPendingDelete(false);
        }
    };

    const handleDeleteOrReport = async () => {
        if (!post) return;
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

    const handleAdminBanUser = () => {
        setShowBanPopup(true);
        setBanDays("0");
        setBanError("");
    };

    const handleConfirmBan = () => {
        if (!post) return;
        const days = Number(banDays) || 0;
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

    const handleConfirmBanComment = async () => {
        if (!commentSelectedForBan) return;
        setPendingBanComment(true);
        setBanCommentError("");
        try {
            const days = Number(banCommentDays) || 0;
            const { commentId, userId } = commentSelectedForBan;
            await apiBanUserAndRemoveComment(commentId, days, userId);
            setComments(prev => prev.filter(c => c._id !== commentId));
            setPost(prev =>
                prev
                    ? {
                        ...prev,
                        commentCount:
                            typeof prev.commentCount === "number"
                                ? Math.max(prev.commentCount - 1, 0)
                                : 0,
                    }
                    : prev
            );
            toast.success("Đã xóa bình luận và cấm người dùng thành công.");
        } catch (err) {
            setBanCommentError(getErrorMessage(err));
            toast.warn(getErrorMessage(err));
        }
        setShowBanCommentPopup(false);
        setPendingBanComment(false);
        setCommentSelectedForBan(null);
    };

    const handleDeleteOwnComment = async (commentId: string) => {
        setShowDeleteCommentId(commentId);
    };

    const handleDeleteOwnCommentConfirmed = async (commentId: string) => {
        try {
            const res: any = await apiDeleteComment({ commentId });
            if (res?.success) {
                setComments(prev => prev.filter((c: any) => c._id !== commentId));
                setPost(prev =>
                    prev
                        ? {
                            ...prev,
                            commentCount:
                                typeof prev.commentCount === "number"
                                    ? Math.max(prev.commentCount - 1, 0)
                                    : 0,
                        }
                        : prev
                );
                toast.success(res.message || "Đã xóa bình luận.");
            } else {
                toast.warn(res?.message || "Xóa bình luận thất bại");
            }
        } catch (err) {
            toast.warn(getErrorMessage(err));
        }
        setShowDeleteCommentId(null);
    };

    const isOwner = !!(myId && post?.user && post.user === myId);
    const showBanButton = role === "Admin" && !isOwner;
    const showReportButton = !isOwner && !showBanButton;
    const showDeleteButton = isOwner;

    const handleCommentSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!post || pendingComment) return;
        const text = commentText.trim();
        if (!text) {
            setCommentError("Vui lòng nhập nội dung bình luận.");
            if (commentTextareaRef.current) commentTextareaRef.current.focus();
            return;
        }
        setCommentError(null);
        setPendingComment(true);

        try {
            const res = await apiCommentPost({ postId: post._id, comment: text });

            if (res?.success && res.comment) {
                let newComment: any = {
                    ...res.comment,
                    user: {
                        ...res.comment.user,
                        name: myName || res.comment.user?.name,
                        username: myUsername || res.comment.user?.username,
                        avatar: myAvatar || res.comment.user?.avatar,
                    }
                };
                setComments(prev => [newComment, ...prev]);
                setPost(prev =>
                    prev
                        ? {
                            ...prev,
                            commentCount:
                                typeof prev.commentCount === "number"
                                    ? prev.commentCount + 1
                                    : 1,
                        }
                        : prev
                );
                setCommentText("");
                setTimeout(() => {
                    if (commentTextareaRef.current) {
                        commentTextareaRef.current.style.height = "36px";
                    }
                }, 0);
            } else {
                setCommentError((res && res.message) || "Gửi bình luận thất bại.");
            }
        } catch (_err) {
            setCommentError("Đã có lỗi khi gửi bình luận.");
        } finally {
            setPendingComment(false);
        }
    };

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCommentText(e.target.value);
        setCommentError(null);

        const el = e.target;
        el.style.height = "36px";
        el.style.height = el.scrollHeight + "px";
    };

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (pendingComment || !commentText.trim()) return;
            handleCommentSubmit();
        }
    };

    const handleOpenReportComment = (commentId: string) => {
        setShowReportCommentId(commentId);
        setCommentMenuOpenId(null);
    };
    const handleCloseReportComment = () => setShowReportCommentId(null);
    const handleConfirmReportComment = async () => {
        if (!showReportCommentId) {
            return;
        }
        const reported = comments.find(c => c._id === showReportCommentId);
        const commentId: string = showReportCommentId;
        const userId =
            reported?.user?._id ||
            reported?.user_id ||
            reported?.userId ||
            "(không xác định)";
        const currentPostId = post?._id || "";
        try {
            // @ts-ignore
            const res = await apiReportComment({
                commentId: commentId,
                postId: currentPostId,
                userId: userId,
            });
            toast.success(res.message || "Báo cáo bình luận thành công.");
        } catch (err) {
            toast.warn(getErrorMessage(err));
        } finally {
            setShowReportCommentId(null);
        }
    };

    if (typeof post === "undefined") {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
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
                    className="relative mx-auto bg-[#1e1e1f] rounded-3xl shadow-xl border border-[#363636] flex flex-col items-center justify-center"
                    style={{
                        height: "250px",
                        width: "480px",
                        maxWidth: "90vw",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="text-white text-lg font-semibold my-4">
                        Đang tải dữ liệu...
                    </div>
                </div>
            </div>
        );
    }

    if (!post) {
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
                    className="relative mx-auto bg-[#1e1e1f] rounded-3xl shadow-xl border border-[#363636] flex flex-col items-center justify-center"
                    style={{
                        height: "250px",
                        width: "480px",
                        maxWidth: "90vw",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="text-white text-lg font-semibold my-4">
                        Không tìm thấy bài viết này!
                    </div>
                    <button
                        className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold"
                        onClick={onClose}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        );
    }

    const files = Array.isArray(post?.files) ? post.files : [];
    const fileCount = files.length;
    const imageFiles: ImageObj[] = files.filter(f => f.file_type === "image");

    const handleShowImage = (index: number) => {
        setShowImage({ open: true, index });
    };

    let mediaBlock = null;

    // Chỉ kiểm tra imageFiles chứ không phải file_type !== "video"
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
                    className={`w-full h-full object-cover ${extra.className || ""}`}
                    style={{
                        ...extra.style,
                        borderRadius: undefined,
                    }}
                >
                    <source src={file.file_url} />
                </video>
            );
        }
        const imgIndex = imageFiles.findIndex(f => f.file_url === file.file_url);
        return (
            <img
                key={idx}
                src={file.file_url}
                alt="post_file"
                className={`w-full h-full object-cover cursor-pointer ${extra.className || ""}`}
                style={{
                    ...extra.style,
                    borderRadius: undefined,
                }}
                onClick={() => imgIndex >= 0 && handleShowImage(imgIndex)}
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
                            const showIdx = imageFiles.findIndex(img => img.file_url === f.file_url);
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
                                        onClick={() => {
                                            if (showIdx >= 0) handleShowImage(showIdx);
                                        }}
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
            {/* ShowImage is wrapped with a div with a ref for click-inside detection */}
            {showImage.open && (
                <div ref={showImageRef} style={{ zIndex: 300, position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShowImage
                        images={imageFiles}
                        initialIndex={showImage.index}
                        onClose={() => setShowImage({ open: false, index: 0 })}

                        avatar={post?.bioUser?.avatar || ""}
                        avatarCroppedArea={post?.bioUser?.avatarCroppedArea}
                        name={post?.profileUser?.name || ""}
                        username={post?.profileUser?.username || ""}
                        createdAt={post?.createdAt || ""}
                    />
                </div>
            )}
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
                {/* Tiêu đề trên cùng */}
                <div
                    className="w-full flex items-center justify-center font-semibold text-white text-lg py-3 border-b border-[#343434] sticky top-0 left-0 z-30 bg-[#1e1e1f] rounded-t-3xl"
                    style={{
                        minHeight: 54,
                        position: "sticky",
                        top: 0,
                    }}
                >
                    Bài viết của {post?.profileUser?.name}
                    {showDeleteButton && (
                        <button
                            className="absolute right-14 top-1/2 -translate-y-1/2 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer transition-colors"
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label="Xóa bài viết"
                            tabIndex={0}
                            type="button"
                            style={{ marginRight: 8 }}
                        >
                            <FontAwesomeIcon icon={faTrash} style={{ color: "#ef4444" }} />
                        </button>
                    )}
                    {showReportButton && (
                        <button
                            className="absolute right-14 top-1/2 -translate-y-1/2 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer transition-colors"
                            onClick={handleDeleteOrReport}
                            aria-label="Báo cáo bài viết"
                            tabIndex={0}
                            type="button"
                            style={{ marginRight: 8 }}
                        >
                            <FontAwesomeIcon icon={faFlag} style={{ color: "#f59e42" }} />
                        </button>
                    )}
                    {showBanButton && (
                        <button
                            className="absolute right-14 top-1/2 -translate-y-1/2 bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-600 focus:outline-none z-10 cursor-pointer transition-colors"
                            onClick={handleAdminBanUser}
                            aria-label="Cấm người dùng này"
                            tabIndex={0}
                            type="button"
                            style={{ marginRight: 8 }}
                        >
                            <FontAwesomeIcon icon={faBan} style={{ color: "#f43f5e" }} />
                        </button>
                    )}
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

                {/* Ban popup (Admin remove & ban user) */}
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

                {/* Ban comment popup (Admin remove & ban user for comment) */}
                {showBanCommentPopup && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-300"
                        style={{
                            background: "rgba(30,30,30,0.82)",
                            backdropFilter: "blur(1.5px)"
                        }}
                    >
                        <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96 relative">
                            <PopupCloseButton onClick={() => setShowBanCommentPopup(false)} ariaLabel="Đóng xác nhận ban" />
                            <div className="mb-4 w-full flex items-center justify-between">
                                <div className="font-semibold text-lg text-white">
                                    Xóa bình luận &amp; cấm người dùng
                                </div>
                            </div>
                            <div className="text-[#ddd] text-center mb-4">
                                Bạn có chắc chắn muốn xóa bình luận này và cấm người dùng? <br />
                            </div>
                            <div className="w-full flex flex-col gap-3 mb-6">
                                <label htmlFor="ban-comment-days" className="text-sm text-white font-semibold mb-1 text-left">Nhập số ngày cấm(0 là không đổi):</label>
                                <input
                                    id="ban-comment-days"
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
                                    onClick={() => setShowBanCommentPopup(false)}
                                    type="button"
                                    disabled={pendingBanComment}
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 120 }}
                                    onClick={handleConfirmBanComment}
                                    type="button"
                                    disabled={pendingBanComment}
                                >
                                    {pendingBanComment ? (
                                        <svg className="animate-spin mr-2" style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : null}
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showDeleteConfirm && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-300"
                        style={{
                            background: "rgba(0,0,0,0.65)"
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
                                Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.<br />
                            </div>
                            <div className="flex justify-end items-center w-full gap-3">
                                <button
                                    className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                    style={{ minWidth: 80 }}
                                    disabled={pendingDelete}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    type="button"
                                >Hủy</button>
                                <button
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                    style={{ minWidth: 90 }}
                                    disabled={pendingDelete}
                                    onClick={handleDelete}
                                    type="button"
                                >{pendingDelete ? (
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

                {/* Xác nhận xóa bình luận cá nhân */}
                {showDeleteCommentId && (() => {
                    const comment = comments.find((c: any) => c._id === showDeleteCommentId);
                    return (
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
                                    >Hủy</button>
                                    <button
                                        className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                        style={{ minWidth: 90 }}
                                        onClick={() => handleDeleteOwnCommentConfirmed(comment._id)}
                                        type="button"
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Report comment popup */}
                {showReportCommentId && (() => {
                    const reportedCmt = comments.find(c => c._id === showReportCommentId);
                    return (
                        <div className="fixed inset-0 flex items-center justify-center z-300"
                            style={{ background: "rgba(0,0,0,0.65)" }}
                        >
                            <div className="bg-[#232325] rounded-2xl p-6 shadow-xl border border-[#444] flex flex-col items-center max-w-[90vw] w-96">
                                <div className="mb-4 w-full flex items-center justify-between">
                                    <div className="font-semibold text-base text-white">Báo cáo bình luận</div>
                                    <button
                                        className="text-gray-400 text-2xl cursor-pointer rounded-full transition-colors duration-100 hover:bg-[#2e2e31]"
                                        style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                        onClick={handleCloseReportComment}
                                        aria-label="Đóng báo cáo"
                                        type="button"
                                    >&times;</button>
                                </div>
                                <div className="text-[#ddd] text-center mb-6">
                                    Bạn có chắc muốn <span className="text-red-400 font-semibold">báo cáo</span> bình luận của <b>{reportedCmt?.user?.name || "người này"}</b> không?
                                </div>
                                <div className="flex justify-end items-center w-full gap-3">
                                    <button
                                        className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition cursor-pointer"
                                        style={{ minWidth: 80 }}
                                        onClick={handleCloseReportComment}
                                        type="button"
                                    >Hủy</button>
                                    <button
                                        className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition flex items-center justify-center cursor-pointer"
                                        style={{ minWidth: 100 }}
                                        onClick={handleConfirmReportComment}
                                        type="button"
                                    >
                                        <FontAwesomeIcon icon={faFlag} className="mr-2" />
                                        Báo cáo
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Main Nội dung cuộn được */}
                <div
                    ref={commentsContainerRef}
                    className="flex-1 flex flex-col custom-scroll"
                    style={{
                        maxHeight: `calc(100vh - 40px - 54px - 82px)`,
                        overflowY: "auto",
                        paddingTop: 0,
                        paddingBottom: 0,
                    }}
                >
                    {/* Info row */}





                    <div className="flex w-full pt-2 px-2">
                        <div className="flex items-center relative pr-2 z-20 max-w-full">
                            <Avatar
                                src={post?.bioUser?.avatar}
                                size={40}
                                className="rounded-full flex-shrink-0 mr-3"
                            />
                            <div className="flex flex-col justify-center leading-none">
                                <span className="font-semibold mb-1">{post?.profileUser?.name}</span>
                                <span className="text-sm text-[#b0b3b8]">
                                    {post?.createdAt
                                        ? getTimeAgo(post.createdAt)
                                        : ""}
                                </span>
                            </div>
                        </div>
                    </div>






                    {/* Text + Media */}
                    {post?.text && (
                        <div className="whitespace-pre-wrap break-words mt-2 px-6 text-white">{post.text}</div>
                    )}
                    {fileCount > 0 && (
                        <div className="w-full" style={{ padding: 0, margin: 0 }}>{mediaBlock}</div>
                    )}
                    <div className="px-6">
                        <PostReactButton
                            post={getPostReactButtonProps(post)}
                            onReact={(
                                reactionName,
                                prevReaction,
                                postId
                            ) => {
                                handleReact(reactionName, prevReaction, post._id);
                            }}
                            onComment={() => {
                                if (commentTextareaRef.current) {
                                    commentTextareaRef.current.focus();
                                }
                            }}
                            onShare={handleShare}
                            isOnPost={true}
                        />
                    </div>
                    {/* Comment section */}
                    <div className="px-6 pb-6">
                        <div className="border-t border-[#343434] pt-2 mt-2">
                            <div className="text-white font-semibold mb-2">Bình luận</div>
                            <div className="flex flex-col gap-3 pr-1">
                                {comments.length > 0 ? comments.map((comment: any) => {
                                    const isMine = comment.user?._id === myId || comment.user?.username === myUsername;
                                    const isAdmin = role === "Admin";
                                    const realComment = comment;
                                    const canShowDots = (!isMine && myUsername) || isMine || isAdmin;
                                    const userIdComment =
                                        realComment.user?._id ||
                                        realComment.user_id ||
                                        realComment.userId || "";

                                    return (
                                        <div key={realComment._id} className="flex gap-2 items-start opacity-100 relative group">
                                            <Avatar
                                                size={32}
                                                src={
                                                    realComment.user?._id === myId
                                                        ? myAvatar
                                                        : (realComment.user?.avatar || realComment.user_avatar || "")
                                                }
                                                className="rounded-full flex-shrink-0"
                                            />
                                            <div className={`flex-1 bg-[#242528] rounded-xl px-3 py-2 min-w-0 ${realComment.posting ? "opacity-70" : ""} relative`}>
                                                <div className="flex items-center gap-2 w-full">
                                                    <span className="font-semibold text-sm text-white truncate">
                                                        {realComment.user?._id === myId
                                                            ? (myName || myUsername || "Tôi")
                                                            : (realComment.user?.name || realComment.user_name || "")}
                                                    </span>
                                                    <span className="text-xs text-[#b0b3b8] truncate">
                                                        @{realComment.user?._id === myId
                                                            ? (myUsername || "me")
                                                            : (realComment.user?.username || realComment.user_username || "")}
                                                    </span>
                                                    <span className="text-xs text-[#b0b3b8] ml-2 whitespace-nowrap select-none">
                                                        {getTimeAgo(realComment.createdAt)}
                                                        {realComment.posting && (
                                                            <span className="ml-2 text-[#5ecbff] animate-pulse">Đang gửi...</span>
                                                        )}
                                                    </span>
                                                    <div className="ml-auto relative">
                                                        {/* Nếu là bình luận của mình thì hiện nút thùng rác thay vì dots */}
                                                        {isMine && !realComment.posting && (
                                                            <button
                                                                className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] max-w-[30px] max-h-[30px] bg-[#242528] border-none outline-none rounded-full opacity-70 hover:opacity-100 focus:bg-[#35363b] hover:bg-[#35363b] cursor-pointer p-0 flex items-center justify-center"
                                                                onClick={() => handleDeleteOwnComment(realComment._id)}
                                                                tabIndex={0}
                                                                aria-label="Xóa bình luận"
                                                                type="button"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} style={{ color: "#ef4444" }} />
                                                            </button>
                                                        )}
                                                        {/* Nếu không phải mình hoặc là admin, show các menu như cũ */}
                                                        {!isMine && canShowDots && !realComment.posting && (
                                                            <>
                                                                <button
                                                                    className="comment-options-btn w-[30px] h-[30px] min-w-[30px] min-h-[30px] max-w-[30px] max-h-[30px] bg-[#242528] transition-all border-none outline-none rounded-full opacity-70 hover:opacity-100 focus:bg-[#35363b] hover:bg-[#35363b] cursor-pointer p-0"
                                                                    onClick={() => setCommentMenuOpenId(prev => prev === realComment._id ? null : realComment._id)}
                                                                    tabIndex={0}
                                                                    aria-label="Tuỳ chọn"
                                                                    type="button"
                                                                >
                                                                    <FontAwesomeIcon icon={faEllipsis} />
                                                                </button>
                                                                {commentMenuOpenId === realComment._id && (
                                                                    <div className="comment-options-dropdown absolute right-0 top-7 z-40 min-w-[150px] bg-[#232529] border border-gray-700 rounded-xl shadow-md overflow-hidden">
                                                                        {/* Nếu là admin: nút xóa/cấm */}
                                                                        {isAdmin && !isMine && (
                                                                            <button
                                                                                className="w-full text-left px-4 py-2 text-sm hover:bg-[#31333b] text-pink-400 flex items-center gap-2 cursor-pointer"
                                                                                onClick={() => {
                                                                                    setCommentMenuOpenId(null);
                                                                                    setShowBanCommentPopup(true);
                                                                                    setBanCommentError("");
                                                                                    setBanCommentDays("0");
                                                                                    setCommentSelectedForBan({
                                                                                        commentId: realComment._id,
                                                                                        userId: userIdComment || "",
                                                                                    });
                                                                                }}
                                                                                type="button"
                                                                            >
                                                                                <FontAwesomeIcon icon={faBan} />
                                                                                Xóa &amp; cấm
                                                                            </button>
                                                                        )}
                                                                        {/* Nếu không phải mình: báo cáo */}
                                                                        {!isMine && !isAdmin && (
                                                                            <button
                                                                                className="w-full text-left px-4 py-2 text-sm hover:bg-[#31333b] text-red-500 flex items-center gap-2 cursor-pointer"
                                                                                onClick={() => {
                                                                                    setCommentMenuOpenId(null);
                                                                                    handleOpenReportComment(realComment._id);
                                                                                }}
                                                                                type="button"
                                                                            >
                                                                                <FontAwesomeIcon icon={faFlag} />
                                                                                Báo cáo bình luận
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-white text-sm whitespace-pre-line mt-1 break-words">{realComment.text}</div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex justify-center my-2 text-[#aaa] text-xs italic">
                                        Hãy là người bình luận đầu tiên
                                    </div>
                                )}
                                {isLoadingMore && (
                                    <div className="text-center text-xs text-[#5ecbff] py-2 animate-pulse">
                                        Đang tải thêm bình luận...
                                    </div>
                                )}
                                {!hasMoreComments && comments.length > 0 && (
                                    <div className="text-center text-xs text-[#aaa] py-2">
                                        Đã hiển thị tất cả bình luận.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comment input (giao diện & chức năng giống Showpost) */}
                <form
                    className="rounded-3xl"
                    style={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 30,
                        background: "#1e1e1f",
                        maxHeight: 500
                    }}
                    autoComplete="off"
                    onSubmit={handleCommentSubmit}
                    spellCheck={false}
                >
                    <div
                        className="w-full flex items-center gap-2 border-t border-[#343434] bg-[#1e1e1f] px-4 py-3 rounded-b-3xl"
                        style={{
                            minHeight: 72,
                            overflow: "visible",
                            maxHeight: 500
                        }}
                    >
                        <Avatar
                            src={myAvatar}
                            size={40}
                            className="rounded-full flex-shrink-0"
                        />
                        <div
                            className={`flex-1 flex items-center rounded-xl bg-[#242528] transition-colors ${commentError ? "border border-red-500" : ""}`}
                            style={{
                                paddingLeft: 4,
                                paddingRight: 6,
                                paddingTop: 2,
                                paddingBottom: 2,
                                minHeight: 40,
                                maxHeight: 500,
                                transition: "box-shadow 0.2s, border 0.2s, height 0.1s",
                                border: "1px solid transparent"
                            }}
                        >
                            <textarea
                                ref={commentTextareaRef}
                                value={commentText}
                                onChange={handleCommentChange}
                                onKeyDown={handleCommentKeyDown}
                                className="flex-1 text-white px-1 py-2 outline-none resize-none custom-scroll bg-transparent"
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
                                    maxHeight: 500
                                }}
                                rows={1}
                                disabled={pendingComment}
                                spellCheck={false}
                            />
                        </div>
                        <button
                            type="submit"
                            className={`ml-1 px-4 py-2 rounded-full cursor-pointer font-semibold transition-colors duration-75
                                ${commentText.trim() && !pendingComment
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-500 text-gray-300 cursor-not-allowed!"
                                }`}
                            style={{ minWidth: 74 }}
                            disabled={pendingComment || !commentText.trim()}
                        >
                            {pendingComment ? (
                                <span className="flex gap-1 items-center">
                                    <svg className="animate-spin h-4 w-4 text-white mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4zm2 5.291A7.962 7.962 0 004 12h4a4 4 0 014 4v4a7.962 7.962 0 01-6-2.709z"></path>
                                    </svg>
                                    Gửi
                                </span>
                            ) : (
                                "Gửi"
                            )}
                        </button>
                    </div>
                    {commentError && (
                        <div className="text-xs text-red-400 pl-[64px] pt-1 mb-2">{commentError}</div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ShowPostById;
