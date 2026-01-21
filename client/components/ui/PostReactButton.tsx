import React, { useState, useRef, useEffect, RefObject } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faThumbsUp,
    faHeart,
    faFaceLaugh,
    faFaceSadCry,
    faFaceAngry,
    faShare,
    faComment,
} from "@fortawesome/free-solid-svg-icons";

// Import useSelector for redux user selector
import { useSelector } from "react-redux";

const reactionColors = {
    like: { emoji: "text-blue-500", text: "text-blue-500 dark:text-blue-400 font-bold", icon: "#3b82f6" },
    love: { emoji: "text-red-500", text: "text-red-500 font-bold", icon: "#ef4444" },
    fun: { emoji: "text-yellow-400", text: "text-yellow-500 font-bold", icon: "#facc15" },
    sad: { emoji: "text-yellow-500", text: "text-yellow-600 font-bold", icon: "#eab308" },
    angry: { emoji: "text-orange-500", text: "text-orange-500 font-bold", icon: "#f97316" },
    default: { emoji: "text-gray-400", text: "text-gray-500 dark:text-white", icon: "#9ca3af" }
};

const reactionIcons: Record<string, any> = {
    like: faThumbsUp,
    love: faHeart,
    fun: faFaceLaugh,
    sad: faFaceSadCry,
    angry: faFaceAngry,
    default: faThumbsUp,
};

const reactions = [
    { name: "like", icon: faThumbsUp, tooltip: "Thích" },
    { name: "love", icon: faHeart, tooltip: "Yêu thích" },
    { name: "fun", icon: faFaceLaugh, tooltip: "Haha" },
    { name: "sad", icon: faFaceSadCry, tooltip: "Buồn" },
    { name: "angry", icon: faFaceAngry, tooltip: "Tức giận" },
];

type ReactionName = "like" | "love" | "fun" | "sad" | "angry";
type ReactionCount = {
    [key in ReactionName]: number;
};

interface PostType {
    _id?: string;
    reactCounts?: Partial<ReactionCount>;
    myReact?: ReactionName | null;
    commentCount?: number;
    shareCount?: number;
    hasShared?: boolean;
    author?: any; // Possibility the author can be an object or id
    userId?: string; // In case author is named userId
    [key: string]: any;
}

type ReactHandler = (reactionName: ReactionName | null, prevReaction: ReactionName | null, postId?: string) => void;
type CommentHandler = () => void;
type ShareHandler = () => void;

interface PostReactButtonProps {
    post?: PostType;
    onReact: ReactHandler;
    onComment?: CommentHandler;
    onShare?: ShareHandler;
    isOnPost?: boolean;
    [key: string]: any;
}

function isReactionName(value: string): value is ReactionName {
    return ["like", "love", "fun", "sad", "angry"].includes(value);
}

function ReactionMenu({
    onSelect,
    anchorRef,
    highlighted,
    onMenuMouseEnter,
    onMenuMouseLeave,
    visible,
}: {
    onSelect?: (reactionName: ReactionName) => void;
    anchorRef?: RefObject<HTMLButtonElement> | undefined;
    highlighted?: string | null;
    onMenuMouseEnter?: (reactionName?: ReactionName) => void;
    onMenuMouseLeave?: () => void;
    visible: boolean;
}) {
    if (!visible) return null;
    const buttonHeight =
        anchorRef && "current" in anchorRef && anchorRef.current
            ? (anchorRef.current.getBoundingClientRect().height || 0) + 8
            : 40;

    return (
        <div
            className="absolute flex gap-2 px-4 py-2 rounded-xl shadow-lg z-50 min-w-max w-full"
            style={{
                bottom: buttonHeight,
                left: 0,
            }}
            onMouseEnter={onMenuMouseEnter as any}
            onMouseLeave={onMenuMouseLeave}
        >
            <div className="bg-[#27282A] flex gap-5 px-1 py-[2px] rounded-full border border-gray-500">
                {reactions.map((reaction) => (
                    <button
                        key={reaction.name}
                        className={`text-[45px] w-[45px] flex text-center items-center justify-center transition-transform leading-none p-0 relative bg-transparent border-none focus:outline-none cursor-pointer ${highlighted === reaction.name ? "scale-125" : "hover:scale-125"
                            } ${reactionColors[reaction.name as ReactionName]?.emoji || reactionColors.default.emoji}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelect && onSelect(reaction.name as ReactionName)}
                        onMouseEnter={() => onMenuMouseEnter && onMenuMouseEnter(reaction.name as ReactionName)}
                        type="button"
                        tabIndex={-1}
                        aria-label={reaction.tooltip}
                    >
                        <FontAwesomeIcon icon={reaction.icon} />
                    </button>
                ))}
            </div>
        </div>
    );
}

const PostReactButton: React.FC<PostReactButtonProps> = ({
    post = {},
    onReact,
    onComment,
    onShare,
    isOnPost = false,
}) => {
    const user = useSelector((state: any) => state.user);
    const myId = user?.userId;
    
    const posterId: string | undefined = post.user;
    const isShareDisabled = (myId && posterId && myId === posterId);

    // State that is kept for menu interactions only (not for react or count status)
    const [hover, setHover] = useState<boolean>(false);
    const [showMenu, setShowMenu] = useState<boolean>(false);
    const [isPointerInside, setIsPointerInside] = useState<boolean>(false);
    const [mouseDown, setMouseDown] = useState<boolean>(false);
    const [highlighted, setHighlighted] = useState<ReactionName | null>(null);

    const [isNarrow, setIsNarrow] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate selected state/counter based on props (NOT LOCAL STATE)
    const selectedReaction = post.myReact ?? null;
    const countState: ReactionCount = {
        like: post.reactCounts?.like ?? 0,
        love: post.reactCounts?.love ?? 0,
        fun: post.reactCounts?.fun ?? 0,
        sad: post.reactCounts?.sad ?? 0,
        angry: post.reactCounts?.angry ?? 0,
    };

    // Responsive check for < 490px
    useEffect(() => {
        function checkWidth() {
            if (!containerRef.current) return;
            const width = containerRef.current.offsetWidth;
            setIsNarrow(width < 490);
        }
        checkWidth();

        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, []);

    useEffect(() => {
        // Recheck on mount/layout change
        function checkWidth() {
            if (!containerRef.current) return;
            setIsNarrow(containerRef.current.offsetWidth < 490);
        }
        checkWidth();
    });

    const likeBtnRef = useRef<HTMLButtonElement>(null);
    const reactionMenuRef = useRef<HTMLDivElement>(null);
    const hoverTimer = useRef<NodeJS.Timeout | null>(null);
    const closeTimer = useRef<NodeJS.Timeout | null>(null);
    const showMenuTimer = useRef<NodeJS.Timeout | null>(null);

    const displayReaction = selectedReaction;
    let reactionObj;
    if (displayReaction) {
        reactionObj = reactions.find((r) => r.name === displayReaction);
    } else {
        reactionObj = reactions.find((r) => r.name === "like");
    }
    const currentTooltip = reactionObj ? reactionObj.tooltip : "Thích";
    const isInitialDefault = selectedReaction === null;

    useEffect(() => {
        if (!isPointerInside && !mouseDown && hover) {
            closeTimer.current = setTimeout(() => {
                if (!isPointerInside && !mouseDown) {
                    setHover(false);
                    setHighlighted(null);
                }
            }, 100);
        } else {
            if (closeTimer.current) clearTimeout(closeTimer.current);
        }
        return () => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
        };
    }, [isPointerInside, mouseDown, hover]);

    useEffect(() => {
        if (hover) {
            showMenuTimer.current = setTimeout(() => {
                setShowMenu(true);
            }, 100);
        } else {
            setShowMenu(false);
            if (showMenuTimer.current) clearTimeout(showMenuTimer.current);
        }
        return () => {
            if (showMenuTimer.current) clearTimeout(showMenuTimer.current);
        };
    }, [hover]);

    useEffect(() => {
        return () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
            if (closeTimer.current) clearTimeout(closeTimer.current);
            if (showMenuTimer.current) clearTimeout(showMenuTimer.current);
        };
    }, []);

    const lastMenuSelectType = useRef<"click" | "drag" | null>(null);

    // All logic related to counts/state below must use `post`/`countState`, not local state!

    // Event handlers --- only call onReact! Do not update any local state for selectedReaction or counts.

    const handleLikeBtnMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHover(true);
        setMouseDown(true);
        setIsPointerInside(true);
    };

    const handleLikeBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (mouseDown && hover && showMenu) {
            return;
        }

        if (lastMenuSelectType.current === "drag") {
            const prev = selectedReaction;
            let next: ReactionName | null;
            if (prev === "like") next = null;
            else if (prev === null) next = "like";
            else next = null;
            if (typeof onReact === "function") {
                onReact(next, prev, post._id);
            }
            lastMenuSelectType.current = null;
            return;
        }

        const prev = selectedReaction;
        let next: ReactionName | null;
        if (prev === null) next = "like";
        else next = null;
        if (typeof onReact === "function") {
            onReact(next, prev, post._id);
        }
    };

    const handleLikeBtnMouseEnter = () => {
        setIsPointerInside(true);
        if (mouseDown) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            setHover(true);
        }, 600) as unknown as NodeJS.Timeout;
    };

    const handleLikeBtnMouseLeave = () => {
        setIsPointerInside(false);
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };

    const handleLikeBtnMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (mouseDown && hover) {
            if (highlighted) {
                const prev = selectedReaction;
                if (typeof onReact === "function") {
                    onReact(highlighted, prev, post._id);
                }
                setHover(false);
                setMouseDown(false);
                setHighlighted(null);
                lastMenuSelectType.current = "drag";
                return;
            } else {
                setHover(false);
            }
        }
        setMouseDown(false);
        setHighlighted(null);
    };

    const handleMenuMouseMove = (e: { clientX: number; clientY: number }) => {
        if (!reactionMenuRef.current) return;
        const buttons = Array.from(reactionMenuRef.current.querySelectorAll("button"));
        let found: ReactionName | null = null;
        for (let i = 0; i < buttons.length; ++i) {
            const btn = buttons[i];
            const btnRect = btn.getBoundingClientRect();
            if (
                e.clientX >= btnRect.left &&
                e.clientX <= btnRect.right &&
                e.clientY >= btnRect.top &&
                e.clientY <= btnRect.bottom
            ) {
                found = reactions[i]?.name as ReactionName;
                break;
            }
        }
        if (found) {
            setHighlighted(found);
        } else {
            setHighlighted(null);
        }
    };

    const handleMenuMouseEnter = (reactionName?: ReactionName) => {
        setIsPointerInside(true);
        if (reactionName) setHighlighted(reactionName);
    };

    const handleMenuMouseLeave = () => {
        setIsPointerInside(false);
    };

    const handleMenuMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (highlighted) {
            const prev = selectedReaction;
            if (typeof onReact === "function") {
                onReact(highlighted, prev, post._id);
            }
            setHover(false);
            setMouseDown(false);
            setHighlighted(null);
            lastMenuSelectType.current = "drag";
            return;
        }
        setMouseDown(false);
        setHover(false);
        setHighlighted(null);
    };

    const handleLikeBtnTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHover(true);
        setMouseDown(true);
        if (e && e.preventDefault) e.preventDefault();
        setIsPointerInside(true);
    };

    const handleLikeBtnTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
        const prev = selectedReaction;
        if (hover && highlighted) {
            if (typeof onReact === "function") {
                onReact(highlighted, prev, post._id);
            }
            lastMenuSelectType.current = "drag";
        } else {
            let next: ReactionName | null;
            if (prev === null) {
                next = "like";
            } else if (prev === "like") {
                next = null;
            } else {
                next = "like";
            }
            if (typeof onReact === "function") {
                onReact(next, prev, post._id);
            }
            lastMenuSelectType.current = null;
        }
        setMouseDown(false);
        setHover(false);
        setHighlighted(null);
        setIsPointerInside(false);
    };

    let reactionTextColor: string, emojiColor: string;
    let faIconColorClass = "";
    if (isInitialDefault) {
        reactionTextColor = reactionColors.default.text;
        emojiColor = reactionColors.default.emoji;
        faIconColorClass = "text-gray-400";
    } else if (selectedReaction === "like") {
        reactionTextColor = reactionColors.like.text;
        emojiColor = reactionColors.like.emoji;
        faIconColorClass = "text-blue-500";
    } else {
        reactionTextColor = reactionColors[selectedReaction as ReactionName]?.text || reactionColors.default.text;
        emojiColor = reactionColors[selectedReaction as ReactionName]?.emoji || reactionColors.default.emoji;
        switch (selectedReaction) {
            case "love":
                faIconColorClass = "text-red-500";
                break;
            case "fun":
                faIconColorClass = "text-yellow-500";
                break;
            case "sad":
                faIconColorClass = "text-yellow-500";
                break;
            case "angry":
                faIconColorClass = "text-orange-500";
                break;
            default:
                faIconColorClass = emojiColor;
        }
    }

    const getReactionCount = (name: ReactionName) =>
        countState && typeof countState[name] === "number"
            ? countState[name]
            : 0;

    // COMMENT COUNT: chỉ lấy từ props, không dùng delta
    const commentCount = typeof post.commentCount === "number" ? post.commentCount : 0;

    const shareCount = typeof post.shareCount === "number" ? post.shareCount : 0;

    // Always use post._id as postId, as required by prompt.
    const postId = post._id;

    // Calculate total count
    const totalReactionCount = reactions.reduce((sum, r) => sum + (getReactionCount(r.name as ReactionName)), 0);

    // SHARE BUTTON LOGIC - prompt
    const hasShared = !!post.hasShared;

    // Determine share button text and title
    let shareBtnText = "Chia sẻ";
    let shareBtnTitle = "Chia sẻ";
    if (hasShared) {
        shareBtnText = "Đã chia sẻ";
        shareBtnTitle = "Hủy chia sẻ";
    }

    // Chỉ gọi onComment nếu có, không cập nhật delta
    const handleCommentClick = () => {
        if (typeof onComment === "function") {
            onComment();
        }
    };

    return (
        <div className="flex flex-col pt-2" ref={containerRef}>
            <div className="flex items-center gap-3 mb-1 px-2 rounded-full border border-gray-500 text-white select-none">
                {/* Reaction counts */}
                <div className="flex items-center whitespace-nowrap">
                    {!isNarrow ? (
                        reactions.map((r) => {
                            const count = getReactionCount(r.name as ReactionName);
                            if (count === 0) return null;
                            const color = reactionColors[r.name as ReactionName]?.icon || reactionColors.default.icon;
                            return (
                                <div
                                    key={r.name}
                                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-700/10"
                                    style={{ fontSize: 16, fontWeight: 500, color: "white", whiteSpace: "nowrap" }}
                                >
                                    <span className="emoji" style={{ fontSize: 20 }}>
                                        <FontAwesomeIcon icon={r.icon} style={{ color }} />
                                    </span>
                                    <span style={{ minWidth: 20, textAlign: "center", color: "white" }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        // Chỉ hiển thị khi có react (totalReactionCount > 0)
                        totalReactionCount > 0 && (
                            <div
                                className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-700/10"
                                style={{ fontSize: 16, fontWeight: 500, color: "white", whiteSpace: "nowrap" }}
                            >
                                <span className="emoji" style={{ fontSize: 20 }}>
                                    <FontAwesomeIcon icon={faThumbsUp} style={{ color: reactionColors.like.icon }} />
                                </span>
                                <span style={{ fontSize: 20, color: "white", margin: "0 4px" }}>...</span>
                                <span style={{ minWidth: 20, textAlign: "center", color: "white" }}>
                                    {totalReactionCount}
                                </span>
                            </div>
                        )
                    )}
                </div>
                <div className="flex-grow" />
                <div className="flex items-center gap-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                        <FontAwesomeIcon icon={faComment} className="inline mr-1" />
                        <span className="inline">{commentCount}</span>
                    </div>
                    {/* Only show share count when not narrow */}
                    {!isNarrow && (
                        <div className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                            <FontAwesomeIcon icon={faShare} className="inline mr-1" />
                            <span className="inline">{shareCount}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4 w-full">
                <div className="relative w-full flex items-center">
                    {showMenu && !isNarrow && (
                        <div
                            className="absolute left-0 w-full"
                            style={{
                                bottom: '-20px',
                                marginBottom: 0,
                            }}
                            ref={reactionMenuRef}
                            onMouseEnter={() => handleMenuMouseEnter(highlighted ?? undefined)}
                            onMouseLeave={handleMenuMouseLeave}
                            onMouseMove={mouseDown ? handleMenuMouseMove : undefined}
                            onMouseUp={mouseDown ? handleMenuMouseUp : undefined}
                            onTouchMove={(e) => {
                                if (!reactionMenuRef.current) return;
                                const touch = e.touches && e.touches[0];
                                if (!touch) return;
                                const fakeEvent = {
                                    clientX: touch.clientX,
                                    clientY: touch.clientY,
                                };
                                handleMenuMouseMove(fakeEvent);
                            }}
                            onTouchEnd={handleLikeBtnTouchEnd as any}
                        >
                            <ReactionMenu
                                onSelect={(name) => {
                                    const prev = selectedReaction;
                                    if (typeof onReact === "function") {
                                        onReact(name, prev, postId);
                                    }
                                    setHover(false);
                                    setMouseDown(false);
                                    setHighlighted(null);
                                    lastMenuSelectType.current = "click";
                                }}
                                anchorRef={likeBtnRef as RefObject<HTMLButtonElement>}
                                onMenuMouseEnter={handleMenuMouseEnter}
                                onMenuMouseLeave={handleMenuMouseLeave}
                                highlighted={highlighted}
                                visible={true}
                            />
                        </div>
                    )}
                    <button
                        ref={likeBtnRef}
                        className={`flex items-center justify-center gap-1 px-3 py-1 rounded-md transition-colors border-transparent w-full hover:bg-gray-100/20 hover:border-gray-300 bg-transparent ${reactionTextColor} cursor-pointer whitespace-nowrap`}
                        onMouseDown={handleLikeBtnMouseDown}
                        onMouseUp={handleLikeBtnMouseUp}
                        onMouseEnter={handleLikeBtnMouseEnter}
                        onMouseLeave={handleLikeBtnMouseLeave}
                        onClick={handleLikeBtnClick}
                        onTouchStart={handleLikeBtnTouchStart}
                        onTouchEnd={handleLikeBtnTouchEnd}
                        type="button"
                        aria-label={currentTooltip}
                    >
                        <span className={`text-[22px] ${faIconColorClass}`}>
                            <FontAwesomeIcon icon={
                                isInitialDefault
                                    ? reactionIcons.default
                                    : reactionIcons[selectedReaction ?? "default"]
                            } />
                        </span>
                        <span className="inline">{currentTooltip}</span>
                    </button>
                </div>
                <div className="w-full flex items-center">
                    <button
                        className="flex items-center justify-center gap-1 px-3 py-1 rounded-md transition-colors border-transparent w-full text-[#1c1c1d] dark:text-white hover:bg-gray-100/20 hover:border-gray-300 bg-transparent cursor-pointer whitespace-nowrap"
                        type="button"
                        disabled={isOnPost}
                        onClick={isOnPost ? undefined : handleCommentClick}
                        aria-disabled={isOnPost}
                        tabIndex={isOnPost ? -1 : 0}
                    >
                        <span className="text-[22px]">
                            <FontAwesomeIcon icon={faComment} />
                        </span>
                        <span className="inline">Bình luận</span>
                    </button>
                </div>
                {/* Only show the share button when not narrow */}
                {!isNarrow && (
                    <div className="w-full flex items-center">
                        <button
                            className={
                                `flex items-center justify-center gap-1 px-3 py-1 rounded-md transition-colors border-transparent w-full 
                                hover:bg-gray-100/20 hover:border-gray-300 bg-transparent text-[#1c1c1d] dark:text-white 
                                whitespace-nowrap
                                ${isShareDisabled ? "opacity-60 cursor-not-allowed !bg-transparent !text-gray-400 dark:!text-gray-500 hover:!bg-transparent hover:!text-gray-400 dark:hover:!bg-transparent dark:hover:!text-gray-500" : "cursor-pointer"}`
                            }
                            type="button"
                            onClick={onShare}
                            title={shareBtnTitle}
                            style={
                                isShareDisabled
                                    ? { }
                                    : hasShared
                                        ? { color: "#3b82f6", fontWeight: "bold" }
                                        : {}
                            }
                            disabled={isShareDisabled}
                            aria-disabled={isShareDisabled}
                            tabIndex={isShareDisabled ? -1 : 0}
                        >
                            <span className="text-[22px]">
                                <FontAwesomeIcon icon={faShare} />
                            </span>
                            <span className="inline">{shareBtnText}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostReactButton;
