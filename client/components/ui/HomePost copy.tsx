"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import PostingPopup from "./PostingPopup";
import Showpost from "./Showpost";
import ShowImage from "./ShowImage";
import { apiGetHomePost, apiReactPost, apiSharePost, apiUploadPost } from "@/api/post.api";
import { getCloudinaryImageLink, getCloudinaryCoverLink } from "@/helper/croppedImageHelper";
import { useSelector } from "react-redux";
import RelationshipButton from "@/components/ui/RelationshipButton";
import PostReactButton from "./PostReactButton";

function LoadingDots() {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
            <span className="animate-pulse text-[#58A2F7]">.</span>
            <span className="animate-pulse text-[#58A2F7] delay-150">.</span>
            <span className="animate-pulse text-[#58A2F7] delay-300">.</span>
        </span>
    );
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
    // bổ sung để hỗ trợ tạm hiển thị cho post mới đăng
    _showTempName?: string;
    _showTempAvatar?: string;
    _showTempUsername?: string;
};

export default function HomePost() {
    const [isPosting, setIsPosting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [textToPost, setTextToPost] = useState("");
    const [posts, setPosts] = useState<PostType[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [error, setError] = useState("");
    const user = useSelector((state: any) => state.user);
    const myName = user.profile?.name;
    const myUsername = user.profile?.username;
    const myId = user?.userId;
    const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);
    const [relationshipVersion] = useState<{ [key: string]: number }>({});
    const [showImage, setShowImage] = useState(false);
    const [showImageFiles, setShowImageFiles] = useState<any[]>([]);
    const [showImageIdx, setShowImageIdx] = useState(0);
    const [showImageMetadata, setShowImageMetadata] = useState<{
        avatar?: string;
        avatarCroppedArea?: any;
        name?: string;
        username?: string;
        createdAt?: string;
    } | null>(null);

    const [showPostPopup, setShowPostPopup] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    // State to track postId now waiting react/share responses
    const [pendingReactPostId, setPendingReactPostId] = useState<string | null>(null);
    const [pendingSharePostId, setPendingSharePostId] = useState<string | null>(null);

    useEffect(() => {
        setLoadingPosts(true);
        setError('');
        apiGetHomePost()
            .then((res: any) => {
                console.log(res)
                if (res?.data?.posts) {
                    // Ensure reactCounts exists and is filled
                    const patchedPosts = res.data.posts.map((p: any) => {
                        let reactCounts = p.reactCounts;
                        // Patch to always have all reactions
                        if (!reactCounts) {
                            reactCounts = { like: 0, love: 0, fun: 0, sad: 0, angry: 0 };
                        } else {
                            reactCounts = {
                                like: typeof reactCounts.like === "number" ? reactCounts.like : 0,
                                love: typeof reactCounts.love === "number" ? reactCounts.love : 0,
                                fun: typeof reactCounts.fun === "number" ? reactCounts.fun : 0,
                                sad: typeof reactCounts.sad === "number" ? reactCounts.sad : 0,
                                angry: typeof reactCounts.angry === "number" ? reactCounts.angry : 0,
                            };
                        }
                        let myReact = typeof p.myReact !== "undefined" ? p.myReact : null;
                        // If legacy "liked" field, infer myReact for backward compatibility
                        if (typeof myReact === "undefined" && typeof p.liked !== "undefined") {
                            myReact = p.liked ? "like" : null;
                        }
                        //reactCounts = { like: 11, love: 11, fun: 11, sad: 11, angry: 0 };
                        return {
                            ...p,
                            reactCounts,
                            myReact,
                            commentCount: typeof p.commentCount === "number" ? p.commentCount : 0,
                            shareCount: typeof p.shareCount === "number" ? p.shareCount : 0,
                            likeCount: typeof p.likeCount === "number" ? p.likeCount : reactCounts.like,
                            files: Array.isArray(p.files) ? p.files : [],
                        };
                    });
                    setPosts(patchedPosts);
                } else {
                    setPosts([]);
                }
            })
            .catch((err) => {
                setError("Không tải được bài viết.");
                setPosts([]);
                console.error('apiGetProfilePost error:', err);
            })
            .finally(() => {
                setLoadingPosts(false);
            });
    }, []);

    const selectedPost: PostType | null = selectedPostId
        ? posts.find((p) => p._id === selectedPostId) || null
        : null;

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

    // Hàm onChange relationship cập nhật relationship của user ở mọi post nếu trùng userId
    const handleRelationshipChange = (userId: string, relationship: any) => {
        setPosts(prevPosts =>
            prevPosts.map(post => {
                if (post.user === userId) {
                    return { ...post, relationship: relationship };
                }
                return post;
            })
        );
    };

    const handleCloseShowImage = () => {
        setShowImage(false);
        setShowImageFiles([]);
        setShowImageIdx(0);
        setShowImageMetadata(null);
    };

    // Modified handler: expects all image files of the post, and index of the image clicked
    const handleOpenShowImage = ({
        files,
        fileIdx,
        avatar,
        avatarCroppedArea,
        name,
        username,
        createdAt
    }: {
        files: any[];
        fileIdx: number;
        avatar?: string;
        avatarCroppedArea?: any;
        name?: string;
        username?: string;
        createdAt?: string;
    }) => {
        setShowImageFiles(files);
        setShowImageIdx(fileIdx);
        setShowImageMetadata({
            avatar,
            avatarCroppedArea,
            name,
            username,
            createdAt
        });
        setShowImage(true);
    };

    const handleOpenShowPost = (post: PostType) => {
        setSelectedPostId(post._id);
        setShowPostPopup(true);
    };

    const handleCloseShowPost = () => {
        setShowPostPopup(false);
        setSelectedPostId(null);
    };

    // ---- NEW: handler xóa post theo id khỏi UI ----
    const handleDeletePost = (postId: string) => {
        setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
        // Nếu đang popup detail post thì tắt nếu vừa xóa post đó:
        setShowPostPopup(false);
        setSelectedPostId((currentId) => (currentId === postId ? null : currentId));
    };

    // --- NEW: onPostComment handler truyền sang Showpost: tăng/giảm số commentCount trong state ---
    const handlePostComment = useCallback((
        postId: string,
        delta: number // +1 thêm bình luận, -1 xóa bình luận
    ) => {
        setPosts(prevPosts =>
            prevPosts.map(post =>
                post._id === postId
                    ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) + delta) }
                    : post
            )
        );
    }, []);

    // --- NEW: onLoadComment handler: đặt (set) số lượng commentCount của post chỉ định bằng một giá trị mới ---
    const handleLoadComment = useCallback((
        postId: string,
        commentCount: number
    ) => {
        setPosts(prevPosts =>
            prevPosts.map(post =>
                post._id === postId
                    ? { ...post, commentCount: Math.max(0, commentCount) }
                    : post
            )
        );
    }, []);

    // Needs to know about the *post* context to pass into handleOpenShowImage
    const renderMedia = (
        file: any,
        idx: number,
        extra: { className?: string; style?: React.CSSProperties } = {},
        postContext?: PostType,
        allFilesOfPost?: any[]
    ) => {
        if (file.file_type === "video") {
            return (
                <video
                    key={idx}
                    controls
                    className={`w-full h-full object-cover rounded-lg ${extra.className || ""}`}
                    style={extra.style}
                >
                    <source src={file.file_url} />
                </video>
            );
        }
        return (
            <img
                key={idx}
                src={file.file_url}
                alt="post_file"
                className={`w-full h-full object-cover rounded-lg cursor-pointer ${extra.className || ""}`}
                style={extra.style}
                onClick={() =>
                    handleOpenShowImage({
                        files: allFilesOfPost || [file],
                        fileIdx: idx,
                        avatar: postContext?.bioUser?.avatar,

                        avatarCroppedArea: postContext?.bioUser?.avatarCroppedArea,
                        name: postContext
                            ? (postContext._showTempName || postContext.profileUser?.name)
                            : undefined,
                        username: postContext
                            ? (postContext._showTempUsername || postContext.profileUser?.username)
                            : undefined,
                        createdAt: postContext?.createdAt
                    })
                }
            />
        );
    };

    type PostData = {
        text: string;
        files?: File[];
        [key: string]: any;
    };

    type PostResult = {
        success: boolean;
        error?: string;
    };

    const handlePost = async (postData: PostData): Promise<PostResult> => {
        if (!postData || !postData.text || !postData.text.trim()) {
            return { success: false, error: "EMPTY_POST" };
        }
        setIsLoading(true);
        try {
            const res = await apiUploadPost(postData);
            console.log(res)
            if (res && res.data && res.data.success && res.data.post) {
                // Xử lý tạm thời các trường name và avatar nếu API chưa trả về
                const postFromApi = res.data.post;
                const displayFiles = Array.isArray(postFromApi.files)
                    ? postFromApi.files.map((f: any) => ({ ...f }))
                    : [];
                let reactCounts = postFromApi.reactCounts;
                // patch for new post
                if (!reactCounts) {
                    reactCounts = { like: 0, love: 0, fun: 0, sad: 0, angry: 0 };
                } else {
                    reactCounts = {
                        like: typeof reactCounts.like === "number" ? reactCounts.like : 0,
                        love: typeof reactCounts.love === "number" ? reactCounts.love : 0,
                        fun: typeof reactCounts.fun === "number" ? reactCounts.fun : 0,
                        sad: typeof reactCounts.sad === "number" ? reactCounts.sad : 0,
                        angry: typeof reactCounts.angry === "number" ? reactCounts.angry : 0,
                    };
                }
                // Chèn thông tin chuẩn để Showpost có thể nhận ra người đăng bài là current user ngay sau khi đăng
                const newPost: PostType = {
                    ...postFromApi,
                    files: displayFiles,
                    reactCounts,
                    commentCount: typeof postFromApi.commentCount === "number" ? postFromApi.commentCount : 0,
                    shareCount: typeof postFromApi.shareCount === "number" ? postFromApi.shareCount : 0,
                    likeCount: typeof postFromApi.likeCount === "number" ? postFromApi.likeCount : reactCounts.like,
                    user: myId, // Dùng myId là user của post mới
                    profileUser: {
                        name: myName,
                        username: myUsername
                    },
                    bioUser: {
                        avatar: user.bio?.avatar,
                        avatarCroppedArea: user.bio?.avatarCroppedArea,
                        cover: user.bio?.cover,
                        coverCroppedArea: user.bio?.coverCroppedArea,
                    },
                    // backup cho các trường tạm để hỗ trợ hiển thị nếu props trên chưa đủ
                    _showTempName: myName,
                    _showTempAvatar: myAvatar,
                    _showTempUsername: myUsername,
                };
                setPosts((prev) => [newPost, ...prev]);
                setTextToPost("");
                return { success: true };
            }
        } catch (err) {
            console.error("Error when uploading post:", err);
            return { success: false, error: "UPLOAD_FAILED" };
        } finally {
            setIsLoading(false);
        }
        return { success: false };
    };

    const handleClickOpenPostingPopup = () => {
        if (!isLoading) {
            setIsPosting(true);
        }
    };

    // --- onReact handler for PostReactButton ---
    const handleReact = async (
        reactionName: "like" | "love" | "fun" | "sad" | "angry" | null,
        prevReaction: "like" | "love" | "fun" | "sad" | "angry" | null,
        postId?: string
    ) => {
        if (!postId) return;
        if (pendingReactPostId === postId) return;

        setPendingReactPostId(postId);

        // Save previous state for rollback
        let prevPostsState: PostType[] = [];
        setPosts((prev) => {
            prevPostsState = prev;
            return prev.map((item) => {
                if (item._id === postId) {
                    let newReactCounts = {
                        like: item.reactCounts?.like ?? 0,
                        love: item.reactCounts?.love ?? 0,
                        fun: item.reactCounts?.fun ?? 0,
                        sad: item.reactCounts?.sad ?? 0,
                        angry: item.reactCounts?.angry ?? 0,
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
                    let likeCount = typeof item.likeCount === "number"
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
            });
        });

        // Call real API
        try {
            const res = await apiReactPost({ postId, react: reactionName || "" });
            // console.log(res)
            if (res && res.success && res.reactCounts) {
                const newReact = typeof res.react === "string" ? res.react : reactionName;
                setPosts((prev) =>
                    prev.map((item) => {
                        if (item._id === postId) {
                            let likeCount =
                                typeof item.likeCount === "number"
                                    ? res.reactCounts.like
                                    : item.likeCount;
                            return {
                                ...item,
                                myReact: newReact,
                                reactCounts: { ...res.reactCounts },
                                likeCount,
                            };
                        }
                        return item;
                    })
                );
            } else {
                // rollback to previous state if not success
                setPosts(prevPostsState);
            }
        } catch (err) {
            // rollback to previous state on error
            setPosts(prevPostsState);
        } finally {
            setPendingReactPostId(null);
        }
    };

    // --- onComment handler for PostReactButton ---
    const handleComment = (post?: PostType) => {
        if (post) handleOpenShowPost(post);
    };

    // --- onShare handler for PostReactButton ---
    const handleShare = async (post?: PostType) => {
        if (!post || !myId) return;
        if (pendingSharePostId === post._id) return; // ngăn share lại khi đang đợi response
        setPendingSharePostId(post._id);

        try {
            const res = await apiSharePost({ postId: post._id });
            if (res) {
                const { share } = res;
                setPosts((prevPosts) => {
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

    // --- Sửa các hàm lấy tên/avatar/username để hiển thị tạm khi vừa đăng bài ---
    function getPostAvatar(post: PostType, size: number = 40): string {
        // Ưu tiên trường _showTempAvatar nếu có (từ redux)
        if (post._showTempAvatar) {
            return post._showTempAvatar;
        }
        if (post.bioUser && post.bioUser.avatar) {
            return getCloudinaryImageLink(post.bioUser.avatar, post.bioUser.avatarCroppedArea, size);
        }
        return "https://ui-avatars.com/api/?name=Demo&background=random";
    }
    function getPostName(post: PostType): string {
        // Ưu tiên trường _showTempName nếu có (từ redux)
        if (post._showTempName) return post._showTempName;
        if (post.profileUser && post.profileUser.name) {
            return post.profileUser.name;
        }
        return "Bạn";
    }

    function getPostUsername(post: PostType): string {
        // Ưu tiên trường _showTempUsername nếu có (từ redux)
        if (post._showTempUsername) return post._showTempUsername;
        if (post.profileUser && post.profileUser.username) {
            return post.profileUser.username;
        }
        return "";
    }

    // --- Hover State logic BEGIN ---
    const [hoveredInfoId, setHoveredInfoId] = useState<string | null>(null);

    // Track time of last mouse activity outside all hovers (div gốc và floating)
    const lastMouseOutTimestamp = useRef<number>(0);

    // -- THROTTLED setHoveredInfoId handlers begin --
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    // Track if mouse is over floating block or info row, per postId
    const isInsideHover = useRef<{ [postId: string]: boolean }>({});

    // Helper handler: Set/clear hoveredInfoId only if really outside
    // This version will ensure floating is only shown when mouse is inside at least one hover zone.
    const throttledHoverHandler = useCallback((postId: string) => {
        if (hoveredInfoId === postId) return;
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setHoveredInfoId(postId);
        isInsideHover.current[postId] = true;
    }, [hoveredInfoId]);

    const throttledUnhoverHandler = useCallback((postId: string) => {
        isInsideHover.current[postId] = false;
        lastMouseOutTimestamp.current = Date.now();

        // Wait 50ms, then check if hovered
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        hoverTimeout.current = setTimeout(() => {
            // Kiểm tra nếu thực sự chuột đã rời cả floating và info row
            if (!isInsideHover.current[postId]) {
                setHoveredInfoId(curr => (curr === postId ? null : curr));
            }
        }, 50);
    }, []);

    // NEW: On document mousemove, nếu hovering block hay row không còn DOM hover, ẩn floating (fix stuck)
    useEffect(() => {
        // clear on unmount
        return () => {
            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
            isInsideHover.current = {};
        };
    }, []);

    // Đoạn này là fix stuck hover bằng cách check event bubbling ở document (click/di chuột cách xa sẽ tắt)
    // Bạn có thể kiểm tra quán tính move, nếu floating bị kẹt
    useEffect(() => {
        function handleGlobalMouseMove(e: MouseEvent) {
            // Nếu không có floating nào cần show, bỏ qua
            if (!hoveredInfoId) return;

            // Lấy phần tử floating block hiện đang hiện
            const block = document.querySelector(
                `[data-float-hover="${hoveredInfoId}"]`
            );
            const row = document.querySelector(
                `[data-row-hover="${hoveredInfoId}"]`
            );

            // Nếu không có block và row thì ẩn luôn (rare)
            if (!block && !row) {
                setHoveredInfoId(null);
                return;
            }

            // Kiểm tra nếu mouse đang thực sự ngoài block và ngoài row thì tắt floating (fix stuck)
            if (block && !block.contains(e.target as Node) && row && !row.contains(e.target as Node)) {
                setHoveredInfoId(null);
            }
        }

        window.addEventListener("mousemove", handleGlobalMouseMove, true);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove, true);
        };
    }, [hoveredInfoId]);
    // --- Hover State logic END ---

    return (
        <div className="flex w-full gap-6 justify-center">
            {/* ShowImage popup */}
            {showImage && (
                <ShowImage
                    images={showImageFiles}
                    initialIndex={showImageIdx}
                    onClose={handleCloseShowImage}
                    avatar={showImageMetadata?.avatar}
                    avatarCroppedArea={showImageMetadata?.avatarCroppedArea}
                    name={showImageMetadata?.name}
                    username={showImageMetadata?.username}
                    createdAt={showImageMetadata?.createdAt}
                />
            )}

            {/* Showpost popup */}
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
                    onDelete={handleDeletePost}
                    myAvatar={myAvatar}
                    myName={myName}
                    myUsername={myUsername}
                    onPostComment={handlePostComment}
                    onLoadComment={handleLoadComment}
                />
            )}

            <PostingPopup
                isPosting={isPosting}
                onClose={() => {
                    if (!isLoading) setIsPosting(false);
                }}
                onPost={handlePost}
                textToPost={textToPost}
                setTextToPost={setTextToPost}
            />

            <div className="w-full flex flex-col gap-4">
                {/* New post input area */}
                <div className="bg-[#252728] rounded-lg p-4 flex flex-col items-center">
                    <div className="w-full min-h-[56px] flex gap-4">
                        <div className="w-[56px] h-[56px] flex items-center justify-center">
                            <Avatar src={myAvatar} size={45} className="rounded-full" />
                        </div>
                        <div className="flex-1 min-h-[56px] flex items-center justify-center">
                            <div
                                className="min-h-[45px] text-[#7E7F81] font-[500] text-[18px] w-full flex items-center bg-[#333334] rounded-3xl px-4 py-2 cursor-pointer hover:bg-[#484849]"
                                onClick={handleClickOpenPostingPopup}
                                title={textToPost && textToPost.length > 140 ? textToPost : undefined}
                                style={{ wordBreak: "break-all", whiteSpace: "pre-line" }}
                            >
                                {isLoading ? (
                                    <span className="flex items-center font-medium text-[#58A2F7]">
                                        Đang đăng tải bài viết
                                        <LoadingDots />
                                    </span>
                                ) : textToPost ? (
                                    textToPost.length > 140
                                        ? textToPost.slice(0, 140) + "..."
                                        : textToPost
                                ) : (
                                    "Đăng bài viết mới?"
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Danh sách bài viết */}
                <div className="flex flex-col gap-4">
                    {loadingPosts && (
                        <div className="bg-[#252728] rounded-lg p-4 text-white">
                            <span className="text-[#58A2F7] font-semibold">Đang tải bài viết</span>
                            <LoadingDots />
                        </div>
                    )}
                    {!loadingPosts && error && (
                        <div className="bg-[#252728] rounded-lg p-4 text-red-400">{error}</div>
                    )}
                    {!loadingPosts && !error && posts && posts.length === 0 && (
                        <div className="bg-[#252728] rounded-lg p-4 text-[#b0b3b8]">Chưa có bài viết nào</div>
                    )}
                    {!loadingPosts &&
                        !error &&
                        posts &&
                        posts.length > 0 &&
                        posts.map((p, idx) => {
                            const files = Array.isArray(p.files) ? p.files : [];
                            const fileCount = files.length;
                            let mediaBlock = null;
                            if (fileCount === 1) {
                                mediaBlock = (
                                    <div className="mt-3 w-full">
                                        {renderMedia(files[0], 0, {
                                            style: {
                                                height: "auto",
                                                maxHeight: "800px",
                                                minHeight: "200px",
                                                objectFit: "contain",
                                            },
                                        }, p, files)}
                                    </div>
                                );
                            } else if (fileCount === 2) {
                                mediaBlock = (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {files.map((f, idx2) =>
                                            renderMedia(f, idx2, { className: "h-64" }, p, files)
                                        )}
                                    </div>
                                );
                            } else if (fileCount === 3) {
                                mediaBlock = (
                                    <div className="mt-3 grid grid-rows-2 gap-2" style={{ height: "400px" }}>
                                        <div className="row-span-1">
                                            {renderMedia(files[0], 0, {
                                                className: "w-full h-full",
                                                style: { height: "196px" },
                                            }, p, files)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 row-span-1">
                                            {files.slice(1, 3).map((f, idx2) =>
                                                renderMedia(f, idx2 + 1, {
                                                    className: "w-full h-full",
                                                    style: { height: "196px" },
                                                }, p, files)
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
                                            renderMedia(f, idx2, {
                                                className: "w-full h-full",
                                                style: { height: "196px" },
                                            }, p, files)
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
                                                    {renderMedia(f, idx2, {
                                                        className: "w-full h-full",
                                                        style: { height: "100%" },
                                                    }, p, files)}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2" style={{ height: "196px" }}>
                                            {files.slice(2, 5).map((f, idx2) => {
                                                if (idx2 === 2 && moreCount > 0) {
                                                    return (
                                                        <div key={idx2} className="relative w-1/3 h-full">
                                                            {renderMedia(f, idx2 + 2, {
                                                                className: "w-full h-full",
                                                                style: { height: "100%" },
                                                            }, p, files)}
                                                            <div
                                                                className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-lg cursor-pointer"
                                                                onClick={() =>
                                                                    handleOpenShowImage({
                                                                        files: files,
                                                                        fileIdx: idx2 + 2,
                                                                        avatar: p.bioUser?.avatar,                                                                            
                                                                        avatarCroppedArea: p.bioUser?.avatarCroppedArea,
                                                                        name: p._showTempName || p.profileUser?.name,
                                                                        username: p._showTempUsername || p.profileUser?.username,
                                                                        createdAt: p.createdAt
                                                                    })
                                                                }
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
                                                        {renderMedia(f, idx2 + 2, {
                                                            className: "w-full h-full",
                                                            style: { height: "100%" },
                                                        }, p, files)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }
                            const postName = getPostName(p);
                            const postAvatar = getPostAvatar(p, 40);
                            const postUsername = getPostUsername(p);

                            const shouldUseHover = user && p.user !== user.userId;
                            const showFloating = shouldUseHover && hoveredInfoId === p._id;

                            // Sử dụng data attributes xác định để truy cập outside click/move detection
                            // Chuột vào hoặc rời info row
                            const handleMouseEnter = () => {
                                if (shouldUseHover) {
                                    isInsideHover.current[p._id] = true;
                                    throttledHoverHandler(p._id);
                                }
                            };
                            const handleMouseLeave = () => {
                                if (shouldUseHover) {
                                    isInsideHover.current[p._id] = false;
                                    throttledUnhoverHandler(p._id);
                                }
                            };

                            // Chuột vào hoặc rời floating popover
                            const handleFloatingMouseEnter = () => {
                                if (shouldUseHover) {
                                    isInsideHover.current[p._id] = true;
                                    throttledHoverHandler(p._id);
                                }
                            };
                            const handleFloatingMouseLeave = () => {
                                if (shouldUseHover) {
                                    isInsideHover.current[p._id] = false;
                                    throttledUnhoverHandler(p._id);
                                }
                            };

                            return (
                                <div
                                    key={p._id}
                                    className="bg-[#252728] rounded-lg p-4 text-white group relative"
                                >
                                    {/* WRAPPER cho info-row + info-hover-block */}
                                    <div style={{ position: "relative" }}>
                                        {showFloating && (
                                            <div
                                                data-float-hover={p._id}
                                                className={
                                                    `absolute top-10 z-50 w-[420px] bg-[#252728] border border-gray-600 rounded-xl flex-col transition-opacity duration-200 flex pointer-events-auto opacity-100`
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
                                            >
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
                                    />
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
