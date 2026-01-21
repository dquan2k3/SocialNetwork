"use client";
import React, { useEffect, useState, useCallback } from "react";
import PostingPopup from "./PostingPopup";
import Showpost from "./Showpost";
import {
  apiGetProfilePost,
  apiReactPost,
  apiSharePost,
  apiUploadPost,
} from "@/api/post.api";
import PostReactButton from "./PostReactButton";
import { useSelector } from "react-redux";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { useRouter } from "next/navigation"; // Add this for routing
import ShowImage from "./ShowImage";

// --- BEGIN: Types bổ sung & trùng khớp HomePost ---
export type ReactNameType = "like" | "love" | "fun" | "sad" | "angry";
export type MyReactType = ReactNameType | null;

export interface PostFileType {
  file_url: string;
  file_type: string;
  [key: string]: any;
}

export interface PostType {
  _id: string;
  text: string;
  files?: PostFileType[];
  liked?: boolean;
  likeCount?: number;
  reactCounts?: { [key in ReactNameType]?: number };
  commentCount?: number;
  shareCount?: number;
  hasShared?: boolean;
  avatar?: string;
  name?: string;
  username?: string;
  avatarCroppedArea?: any;
  createdAt?: string;
  myReact?: MyReactType;
  user: string;
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
  shareUserName?: string;
  shareAt?: string | Date;
  type?: string;
  _showTempName?: string;
  _showTempAvatar?: string;
  _showTempUsername?: string;
  shareUserId?: string;
}

export type PostProps = {
  pageType?: string;
  userId?: string;
  name?: string;
  username?: string;
  avatar?: string;
  avatarCroppedArea?: any;
  myAvatar?: string;
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

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
      <span className="animate-pulse text-[#58A2F7]">.</span>
      <span className="animate-pulse text-[#58A2F7] delay-150">.</span>
      <span className="animate-pulse text-[#58A2F7] delay-300">.</span>
    </span>
  );
}

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

// --- NEW: onLoadComment handler: đặt (set) số lượng commentCount của post chỉ định bằng một giá trị mới ---
const useHandleLoadComment = (setPosts: React.Dispatch<React.SetStateAction<PostType[]>>) => {
  return useCallback(
    (postId: string, commentCount: number) => {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? { ...post, commentCount: Math.max(0, commentCount) }
            : post
        )
      );
    },
    [setPosts]
  );
};

export default function Post(props: PostProps & { myId?: string; myName?: string; myUsername?: string; }) {
  const router = useRouter();

  const user = useSelector((state: any) => state.user);

  const myName = user.profile?.name;
  const myUsername = user.profile?.username;
  const myId = user?.userId;
  const myAvatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);
  const myAvatarCroppedArea = user.bio?.avatarCroppedArea;

  const {
    userId,
    name,
    username,
    avatar,
    avatarCroppedArea,
    myId: propMyId,
    myName: propMyName,
    myUsername: propMyUsername,
    myAvatar: propMyAvatar
  } = props;

  const displayName = typeof name === "undefined" ? "Bạn" : name;

  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [textToPost, setTextToPost] = useState<string>("");
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ADD avatarCroppedArea for showImage
  const [showImage, setShowImage] = useState<boolean>(false);
  const [showImageFiles, setShowImageFiles] = useState<PostFileType[]>([]);
  const [showImageIdx, setShowImageIdx] = useState<number>(0);
  const [showImageCreatedAt, setShowImageCreatedAt] = useState<string | number | Date | undefined>("");
  const [showImagePosterAvatar, setShowImagePosterAvatar] = useState<string | undefined>("");
  const [showImageAvatarCroppedArea, setShowImageAvatarCroppedArea] = useState<any | undefined>(undefined);

  const [showPostPopup, setShowPostPopup] = useState<boolean>(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const [pendingReactPostId, setPendingReactPostId] = useState<string | null>(null);
  const [pendingSharePostId, setPendingSharePostId] = useState<string | null>(null);

  const handlePostComment = useCallback(
    (postId: string, delta: number) => {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) + delta) }
            : post
        )
      );
    },
    []
  );

  const handleLoadComment = useHandleLoadComment(setPosts);

  useEffect(() => {
    setLoadingPosts(true);
    setError("");
    const fn = userId
      ? () => apiGetProfilePost(userId)
      : () => apiGetProfilePost();
    fn()
      .then((res: any) => {
        //console.log(res)
        if (res?.data?.posts) {
          const patched: PostType[] = res.data.posts.map((p: any) => {
            // bioUser: { avatar, avatarCroppedArea, ... }
            const showBioUser = p.bioUser
              ? p.bioUser
              : {
                  avatar: p.avatar || "",
                  avatarCroppedArea: p.avatarCroppedArea || null,
                };
            const showProfileUser = p.profileUser
              ? p.profileUser
              : {
                  name: p.name || "",
                  username: p.username || "",
                };
            let shareUserId = undefined;
            if (p.type === "share" && p.user && typeof p.user === "string") {
              shareUserId = p.user;
            } else if (p.type === "share" && p.user && p.user._id) {
              shareUserId = p.user._id;
            }
            return {
              ...p,
              liked: typeof p.liked === "boolean" ? p.liked : false,
              likeCount: typeof p.likeCount === "number" ? p.likeCount : 0,
              commentCount: typeof p.commentCount === "number" ? p.commentCount : 0,
              shareCount: typeof p.shareCount === "number" ? p.shareCount : 0,
              files: Array.isArray(p.files) ? p.files : [],
              avatar: undefined,
              name: undefined,
              username: undefined,
              avatarCroppedArea: undefined,
              myReact:
                typeof p.myReact === "string"
                  ? p.myReact
                  : p.liked
                  ? "like"
                  : null,
              reactCounts: {
                like: p.reactCounts?.like || p.likeCount || 0,
                love: p.reactCounts?.love || 0,
                fun: p.reactCounts?.fun || 0,
                sad: p.reactCounts?.sad || 0,
                angry: p.reactCounts?.angry || 0,
              },
              hasShared: typeof p.hasShared === "boolean" ? p.hasShared : false,
              user: typeof p.user === "string" ? p.user : (p.user && (p.user._id || p.user.id)) || "",
              bioUser: showBioUser,
              profileUser: showProfileUser,
              shareUserName: p.shareUserName,
              shareAt: p.shareAt,
              type: p.type,
              shareUserId: shareUserId,
            };
          });

          const sorted = [...patched].sort((a, b) => {
            const getDate = (post: PostType) =>
              post.type === "share"
                ? (post.shareAt ? new Date(post.shareAt).getTime() : 0)
                : (post.createdAt ? new Date(post.createdAt).getTime() : 0)
            ;
            return getDate(b) - getDate(a);
          });

          setPosts(sorted);
        } else {
          setPosts([]);
        }
      })
      .catch((err) => {
        setError("Không tải được bài viết.");
        setPosts([]);
        //console.error("apiGetProfilePost error:", err);
      })
      .finally(() => {
        setLoadingPosts(false);
      });
  }, [userId]);

  const selectedPost: PostType | null = selectedPostId
    ? (() => {
        const post = posts.find((p) => p._id === selectedPostId);
        if (!post) return null;

        const showBioUser =
          post.bioUser
            ? post.bioUser
            : {
                avatar: "",
                avatarCroppedArea: null,
              };
        const showProfileUser =
          post.profileUser
            ? post.profileUser
            : {
                name: "",
                username: "",
              };

        return {
          ...post,
          avatar: undefined,
          name: undefined,
          username: undefined,
          bioUser: showBioUser,
          profileUser: showProfileUser,
          myReact:
            post.myReact !== undefined
              ? post.myReact
              : post.liked
              ? "like"
              : null,
          liked:
            typeof post.liked === "boolean"
              ? post.liked
              : false,
          likeCount:
            typeof post.likeCount === "number"
              ? post.likeCount
              : 0,
          commentCount:
            typeof post.commentCount === "number"
              ? post.commentCount
              : 0,
          shareCount:
            typeof post.shareCount === "number"
              ? post.shareCount
              : 0,
          hasShared:
            typeof post.hasShared === "boolean" ? post.hasShared : false,
          user: post.user,
          shareUserName: post.shareUserName,
          shareAt: post.shareAt,
          type: post.type,
          shareUserId: (post as any).shareUserId
        };
      })()
    : null;

  function Avatar({
    src,
    size,
    className,
    croppedArea,
    onClick,
    clickable,
  }: {
    src?: string;
    size?: number;
    className?: string;
    croppedArea?: any;
    onClick?: (e: React.MouseEvent) => void;
    clickable?: boolean;
  }) {
    let imgUrl = src;
    if (src && croppedArea && src.includes("cloudinary")) {
      imgUrl = getCloudinaryImageLink(src, croppedArea, size || 40);
    }
    return (
      <img
        src={imgUrl || "https://ui-avatars.com/api/?name=Demo&background=random"}
        alt="avatar"
        width={size || 40}
        height={size || 40}
        className={`${className || "rounded-full"}${clickable ? " cursor-pointer hover:brightness-90" : ""}`}
        style={{
          objectFit: "cover",
          width: size || 40,
          height: size || 40,
        }}
        onClick={clickable ? onClick : undefined}
      />
    );
  }

  const handleCloseShowImage = () => {
    setShowImage(false);
    setShowImageFiles([]);
    setShowImageIdx(0);
    setShowImageCreatedAt("");
    setShowImagePosterAvatar(undefined);
    setShowImageAvatarCroppedArea(undefined);
  };

  // Sửa lại: khi mở ShowImage sẽ truyền toàn bộ files, đúng index và createdAt của post đó,
  // VÀ AVATAR gốc chưa crop của người đăng bài, VÀ avatarCroppedArea của bioUser
  const handleOpenShowImage = ({
    files,
    fileIdx,
    createdAt,
    avatar,
    avatarCroppedArea,
  }: {
    files: PostFileType[];
    fileIdx: number;
    createdAt?: string | number | Date;
    avatar?: string;
    avatarCroppedArea?: any;
  }) => {
    setShowImageFiles(files);
    setShowImageIdx(fileIdx);
    setShowImageCreatedAt(createdAt);
    setShowImagePosterAvatar(avatar);
    setShowImageAvatarCroppedArea(avatarCroppedArea);
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

  const handleComment = (post: PostType) => {
    setSelectedPostId(post._id);
    setShowPostPopup(true);
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
    setShowPostPopup(false);
    setSelectedPostId((currentId) => (currentId === postId ? null : currentId));
  };

  const handleShare = async (post?: PostType) => {
    if (!post || !post._id) return;
    if (pendingSharePostId === post._id) return;
    setPendingSharePostId(post._id);

    let prevPostState: PostType[] = [];
    setPosts((prev) => {
      prevPostState = prev.map((p) => ({ ...p }));
      return prev.map((p) =>
        p._id === post._id
          ? {
              ...p,
              hasShared: !p.hasShared,
              shareCount:
                typeof p.shareCount === "number"
                  ? p.hasShared
                    ? Math.max(0, p.shareCount - 1)
                    : p.shareCount + 1
                  : p.hasShared
                  ? 0
                  : 1,
            }
          : p
      );
    });

    try {
      const res = await apiSharePost({ postId: post._id });
      if (!res?.success) {
        setPosts(prevPostState);
      } else if (
        res?.data &&
        Object.prototype.hasOwnProperty.call(res.data, "share")
      ) {
        const share = res.data.share;
        setPosts((prev) =>
          prev.map((p) =>
            p._id === post._id
              ? {
                  ...p,
                  hasShared: !!share,
                  shareCount:
                    typeof p.shareCount === "number"
                      ? share
                        ? p.hasShared
                          ? p.shareCount
                          : p.shareCount + 1
                        : p.hasShared
                        ? Math.max(0, p.shareCount - 1)
                        : p.shareCount
                      : share
                      ? 1
                      : 0,
                }
              : p
          )
        );
      }
    } catch (e) {
      setPosts(prevPostState);
    } finally {
      setPendingSharePostId(null);
    }
  };

  // Sửa lại: truyền avatarCroppedArea (bioUser.avatarCroppedArea) khi mở/hiển thị ảnh post
  const renderMedia = (
    file: PostFileType,
    idx: number,
    extra: { className?: string; style?: React.CSSProperties } = {},
    files?: PostFileType[],
    postCreatedAt?: string | number | Date,
    postAvatar?: string,
    postAvatarCroppedArea?: any
  ) => {
    if (file.file_type === "video") {
      return (
        <video
          key={idx}
          controls
          className={`w-full h-full object-cover rounded-lg ${
            extra.className || ""
          }`}
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
        className={`w-full h-full object-cover rounded-lg cursor-pointer ${
          extra.className || ""
        }`}
        style={extra.style}
        onClick={() =>
          handleOpenShowImage({
            files: files || [file],
            fileIdx: idx,
            createdAt: postCreatedAt,
            avatar: postAvatar,
            avatarCroppedArea: postAvatarCroppedArea
          })
        }
      />
    );
  };

  const handlePost = async (
    postData: PostData
  ): Promise<PostResult> => {
    if (!postData || !postData.text || !postData.text.trim()) {
      return { success: false, error: "EMPTY_POST" };
    }
    setIsLoading(true);
    try {
      const res = await apiUploadPost(postData);
      if (res && res.data && res.data.success && res.data.post) {
        const postFromApi = res.data.post;
        const displayFiles = Array.isArray(postFromApi.files)
          ? postFromApi.files.map((f: any) => ({ ...f }))
          : [];

        const newBioUser = {
          avatar: myAvatar,
          avatarCroppedArea: myAvatarCroppedArea,
        };
        const newProfileUser = {
          name: myName,
          username: myUsername,
        };

        const newPost: PostType = {
          ...postFromApi,
          files: displayFiles,
          reactCounts: {
            like: 0,
            love: 0,
            fun: 0,
            sad: 0,
            angry: 0
          },
          liked: false,
          myReact: null,
          commentCount: typeof postFromApi.commentCount === "number" ? postFromApi.commentCount : 0,
          shareCount: typeof postFromApi.shareCount === "number" ? postFromApi.shareCount : 0,
          likeCount: typeof postFromApi.likeCount === "number" ? postFromApi.likeCount : 0,
          hasShared: false,
          avatar: undefined,
          name: undefined,
          username: undefined,
          avatarCroppedArea: undefined,
          user: myId,
          bioUser: newBioUser,
          profileUser: newProfileUser,
          _showTempName: myName,
          _showTempAvatar: myAvatar,
          _showTempUsername: myUsername,
          shareUserName: postFromApi.shareUserName,
          shareAt: postFromApi.shareAt,
          type: postFromApi.type,
        };
        setPosts((prev) => [newPost, ...prev]);
        setTextToPost("");
        return { success: true };
      }
    } catch (err) {
      //console.error("Error when uploading post:", err);
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

  const handleReact = async (
    reactionName: ReactNameType | null,
    prevReaction: ReactNameType | null,
    postId?: string
  ) => {
    if (!postId) return;
    if (pendingReactPostId === postId) return;
    setPendingReactPostId(postId);

    let prevPostsState: PostType[] = [];
    setPosts((prev) => {
      prevPostsState = prev.map((p) => ({ ...p }));
      return prev.map((item) => {
        if (item._id === postId) {
          let newReactCounts: { [key in ReactNameType]: number } = {
            like: item.reactCounts?.like ?? 0,
            love: item.reactCounts?.love ?? 0,
            fun: item.reactCounts?.fun ?? 0,
            sad: item.reactCounts?.sad ?? 0,
            angry: item.reactCounts?.angry ?? 0,
          };
          if (
            prevReaction &&
            prevReaction !== reactionName &&
            newReactCounts[prevReaction] > 0
          ) {
            newReactCounts[prevReaction] = newReactCounts[prevReaction] - 1;
          }
          if (reactionName && reactionName !== prevReaction) {
            newReactCounts[reactionName] =
              (newReactCounts[reactionName] ?? 0) + 1;
          }
          if (
            reactionName === null &&
            prevReaction &&
            newReactCounts[prevReaction] > 0
          ) {
            newReactCounts[prevReaction] = newReactCounts[prevReaction] - 1;
          }
          let likeCount = newReactCounts.like;
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

    try {
      const res = await apiReactPost({
        postId,
        react: reactionName || "",
      });
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
        setPosts(prevPostsState);
      }
    } catch (err) {
      setPosts(prevPostsState);
    } finally {
      setPendingReactPostId(null);
    }
  };

  // --- UI ---
  return (
    <div className="flex w-full gap-6 justify-center">
      {/* ShowImage popup */}
      {showImage && (
        <ShowImage
          images={showImageFiles}
          initialIndex={showImageIdx}
          onClose={handleCloseShowImage}
          avatar={showImagePosterAvatar}
          // avatar của người đăng bài, và chưa qua crop
          avatarCroppedArea={showImageAvatarCroppedArea}
          name={myName || name}
          username={myUsername || username}
          createdAt={showImageCreatedAt}
        />
      )}

      {/* Showpost popup */}
      {showPostPopup && selectedPost && (
        <Showpost
          isShow={showPostPopup}
          post={selectedPost}
          onClose={handleCloseShowPost}
          onReact={handleReact}
          onShare={() => handleShare(selectedPost)}
          myName={myName}
          myUsername={myUsername}
          myAvatar={myAvatar}
          onDelete={handleDeletePost}
          onPostComment={handlePostComment}
          onLoadComment={handleLoadComment}
        />
      )}

      {!userId && (
        <PostingPopup
          isPosting={isPosting}
          onClose={() => {
            if (!isLoading) setIsPosting(false);
          }}
          onPost={handlePost}
          textToPost={textToPost}
          setTextToPost={setTextToPost}
        />
      )}

      <div className="w-full flex flex-col gap-4">
        {!userId && (
          <div className="bg-[#252728] rounded-lg p-4 flex flex-col items-center">
            <div className="w-full min-h-[56px] flex gap-4">
              <div className="w-[56px] h-[56px] flex items-center justify-center">
                <Avatar src={myAvatar || avatar} size={45} className="rounded-full" croppedArea={myAvatarCroppedArea || avatarCroppedArea} />
              </div>
              <div className="flex-1 min-h-[56px] flex items-center justify-center">
                <div
                  className="min-h-[45px] text-[#7E7F81] font-[500] text-[18px] w-full flex items-center bg-[#333334] rounded-3xl px-4 py-2 cursor-pointer hover:bg-[#484849]"
                  onClick={handleClickOpenPostingPopup}
                  title={
                    textToPost && textToPost.length > 140
                      ? textToPost
                      : undefined
                  }
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
        )}

        <div className="flex flex-col gap-4">
          {loadingPosts && (
            <div className="bg-[#252728] rounded-lg p-4 text-white">
              <span className="text-[#58A2F7] font-semibold">
                Đang tải bài viết
              </span>
              <LoadingDots />
            </div>
          )}
          {!loadingPosts && error && (
            <div className="bg-[#252728] rounded-lg p-4 text-red-400">{error}</div>
          )}
          {!loadingPosts && !error && posts && posts.length === 0 && (
            <div className="bg-[#252728] rounded-lg p-4 text-[#b0b3b8]">
              Chưa có bài viết nào
            </div>
          )}
          {!loadingPosts &&
            !error &&
            posts &&
            posts.length > 0 &&
            posts.map((p, idx) => {
              const files = Array.isArray(p.files) ? p.files : [];
              const fileCount = files.length;
              let mediaBlock = null;
              // Truyền avatar và avatarCroppedArea của bioUser gốc cho showImage
              const postRawAvatar = p.bioUser?.avatar || "";
              const postRawAvatarCroppedArea = p.bioUser?.avatarCroppedArea;

              if (fileCount === 1) {
                mediaBlock = (
                  <div className="mt-3 w-full">
                    {renderMedia(
                      files[0],
                      0,
                      {
                        style: {
                          height: "auto",
                          maxHeight: "800px",
                          minHeight: "200px",
                          objectFit: "contain",
                        },
                      },
                      files,
                      p.createdAt,
                      postRawAvatar,
                      postRawAvatarCroppedArea
                    )}
                  </div>
                );
              } else if (fileCount === 2) {
                mediaBlock = (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {files.map((f, idx2) =>
                      renderMedia(f, idx2, { className: "h-64" }, files, p.createdAt, postRawAvatar, postRawAvatarCroppedArea)
                    )}
                  </div>
                );
              } else if (fileCount === 3) {
                mediaBlock = (
                  <div className="mt-3 grid grid-rows-2 gap-2" style={{ height: "400px" }}>
                    <div className="row-span-1">
                      {renderMedia(
                        files[0],
                        0,
                        {
                          className: "w-full h-full",
                          style: { height: "196px" },
                        },
                        files,
                        p.createdAt,
                        postRawAvatar,
                        postRawAvatarCroppedArea
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 row-span-1">
                      {files.slice(1, 3).map((f, idx2) =>
                        renderMedia(
                          f,
                          idx2 + 1,
                          {
                            className: "w-full h-full",
                            style: { height: "196px" },
                          },
                          files,
                          p.createdAt,
                          postRawAvatar,
                          postRawAvatarCroppedArea
                        )
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
                      renderMedia(
                        f,
                        idx2,
                        {
                          className: "w-full h-full",
                          style: { height: "196px" },
                        },
                        files,
                        p.createdAt,
                        postRawAvatar,
                        postRawAvatarCroppedArea
                      )
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
                          {renderMedia(
                            f,
                            idx2,
                            {
                              className: "w-full h-full",
                              style: { height: "100%" },
                            },
                            files,
                            p.createdAt,
                            postRawAvatar,
                            postRawAvatarCroppedArea
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2" style={{ height: "196px" }}>
                      {files.slice(2, 5).map((f, idx2) => {
                        if (idx2 === 2 && moreCount > 0) {
                          return (
                            <div key={idx2} className="relative w-1/3 h-full">
                              {renderMedia(
                                f,
                                idx2 + 2,
                                {
                                  className: "w-full h-full",
                                  style: { height: "100%" },
                                },
                                files,
                                p.createdAt,
                                postRawAvatar,
                                postRawAvatarCroppedArea
                              )}
                              <div
                                className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-lg cursor-pointer"
                                onClick={() =>
                                  handleOpenShowImage({
                                    files: files,
                                    fileIdx: idx2 + 2,
                                    createdAt: p.createdAt,
                                    avatar: postRawAvatar,
                                    avatarCroppedArea: postRawAvatarCroppedArea
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
                            {renderMedia(
                              f,
                              idx2 + 2,
                              {
                                className: "w-full h-full",
                                style: { height: "100%" },
                              },
                              files,
                              p.createdAt,
                              postRawAvatar,
                              postRawAvatarCroppedArea
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const postAvatar = p.bioUser?.avatar
                ? getCloudinaryImageLink(p.bioUser.avatar, p.bioUser.avatarCroppedArea, 40)
                : "https://ui-avatars.com/api/?name=Demo&background=random";
              const postName = p.profileUser?.name || "";

              const handleClickPosterProfile = (e: React.MouseEvent, userId: string) => {
                e.stopPropagation();
                if (userId) {
                  router.push(`/profile/${userId}`);
                }
              };

              return (
                <div
                  key={p._id}
                  className="bg-[#252728] rounded-lg p-4 text-white"
                >
                  <div className="w-full flex items-center">
                    <Avatar
                      src={p.bioUser?.avatar}
                      croppedArea={p.bioUser?.avatarCroppedArea}
                      size={40}
                      className="rounded-full flex-shrink-0 mr-3"
                      clickable={true}
                      onClick={e => handleClickPosterProfile(e, p.user)}
                    />
                    <div className="leading-none flex flex-col justify-center">
                      <div className="flex items-center">
                        <span
                          className="font-semibold mb-1 hover:underline cursor-pointer"
                          onClick={(e) => handleClickPosterProfile(e, p.user)}
                        >
                          {postName}
                        </span>
                        {p.type === "share" && p.shareUserName && (
                          <span className="text-xs text-gray-400 flex gap- items-center mt-0.5 ml-2 select-text">
                            Đã chia sẻ bởi{" "}
                            <span
                              className="ml-1 font-semibold cursor-default hover:underline"
                              style={{ pointerEvents: "none", textDecoration: "none" }}
                            >
                              {p.shareUserName}
                            </span>
                            {p.shareAt && (
                              <div className="ml-1">
                                vào <span>{getTimeAgo(p.shareAt)}</span>
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#b0b3b8]">
                        {p.createdAt ? getTimeAgo(p.createdAt) : ""}
                      </div>
                    </div>
                  </div>
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
