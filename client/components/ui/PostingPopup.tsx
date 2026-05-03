import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    FaRegImage,
    FaRegPlayCircle,
    FaTimes
} from "react-icons/fa";
import { useSelector } from "react-redux";

type SelectedMedia = {
    file: File;
    url: string;
    type: "image" | "video";
};

interface PostingPopupProps {
    isPosting: boolean;
    textToPost: string;
    setTextToPost: (v: string) => void;
    onClose: () => void;
    onPost: (postData: any) => Promise<{ success: boolean; error?: string }>;
}

const PostingPopup = ({
    isPosting,
    textToPost,
    onPost,
    setTextToPost,
    onClose,
}: PostingPopupProps) => {
    const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
    const [hasPostError, setHasPostError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const videoInputRef = useRef<HTMLInputElement | null>(null);
    const contentWrapperRef = useRef<HTMLDivElement | null>(null);

    const user = useSelector((state: any) => state.user);

    const avatar = getCloudinaryImageLink(user.bio?.avatar, user.bio?.avatarCroppedArea, 56);
    const name = user.profile?.name;

    useEffect(() => {
        if (isPosting) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isPosting]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPosting]);

    useEffect(() => {
        const textarea = textareaRef.current;
        const wrapper = contentWrapperRef.current;

        if (!textarea) return;

        const oldTextareaScrollTop = textarea.scrollTop;
        const oldTextareaScrollLeft = textarea.scrollLeft;
        const oldWrapperScrollTop = wrapper ? wrapper.scrollTop : 0;
        const oldSelectionStart = textarea.selectionStart;
        const oldSelectionEnd = textarea.selectionEnd;

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;

        textarea.scrollTop = oldTextareaScrollTop;
        textarea.scrollLeft = oldTextareaScrollLeft;
        if (wrapper) {
            wrapper.scrollTop = oldWrapperScrollTop;
        }
        if (typeof oldSelectionStart === "number" && typeof oldSelectionEnd === "number") {
            textarea.setSelectionRange(oldSelectionStart, oldSelectionEnd);
        }
    }, [textToPost]);

    useEffect(() => {
        if (isPosting) {
            setHasPostError(false);
        }
    }, [isPosting]);

    const clearSelectedMedia = useCallback(() => {
        setSelectedMedia(prev => {
            prev.forEach(media => URL.revokeObjectURL(media.url));
            return [];
        });
    }, []);

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        if (hasPostError) setHasPostError(false);
        setTextToPost(e.currentTarget.value);
    };

    const handlePost = async () => {
        if (isSubmitting) return;
        const hasContent = !!(textToPost?.trim()) || selectedMedia.length > 0;
        if (!hasContent) {
            setHasPostError(true);
            return;
        }

        // files: truyền file media thực cho upload cloud
        const filesToSend = selectedMedia.map(media => media.file);

        const postData = {
            text: textToPost,
            files: filesToSend,
        };

        try {
            setIsSubmitting(true);
            const postPromise = onPost(postData);
            onClose();
            const result = await postPromise;
            if (result?.success) {
                clearSelectedMedia();
                setTextToPost("");
                setHasPostError(false);
            } else {
                setHasPostError(true);
            }
        } catch (error) {
            console.error("Error while posting:", error);
            setHasPostError(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddImageClick = () => {
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
            imageInputRef.current.click();
        }
    };

    const handleAddVideoClick = () => {
        if (videoInputRef.current) {
            videoInputRef.current.value = "";
            videoInputRef.current.click();
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newImages = files.map(file => ({
            file,
            url: URL.createObjectURL(file),
            type: "image" as const,
        }));
        setSelectedMedia(prev => [...prev, ...newImages]);
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newVideos = files.map(file => ({
            file,
            url: URL.createObjectURL(file),
            type: "video" as const,
        }));
        setSelectedMedia(prev => [...prev, ...newVideos]);
    };

    const handleRemoveMedia = (idx: number) => {
        setSelectedMedia(prev => {
            URL.revokeObjectURL(prev[idx].url);
            return prev.filter((_, i) => i !== idx);
        });
    };

    function MediaRemoveButton({ onClick }: { onClick: () => void }) {
        return (
            <button
                type="button"
                className="absolute top-3 right-3 rounded-full"
                title="Xoá media"
                onClick={onClick}
                tabIndex={0}
                style={{
                    background: "rgba(0,0,0,0.7)",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    cursor: "pointer",
                    zIndex: 20,
                    border: "none",
                    outline: "none",
                }}
            >
                <FaTimes className="w-5 h-5" />
            </button>
        );
    }

    function MediaPreviewGrid({ media, onRemove }: { media: SelectedMedia[], onRemove: (idx: number) => void }) {
        const count = media.length;
        if (count === 0) return null;

        // For simplicity, show all in a single column, stacking previews.
        // (Keep same UI as before for images count<=4, but allow mixing images/videos)
        return (
            <div className="w-[572px] mt-3 flex flex-col gap-2">
                {media.map((item, idx) => (
                    <div
                        key={idx}
                        className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center"
                        style={{
                            height: count === 1 ? 572 : (count <= 2 ? 286 : 180),
                            minHeight: 150,
                            aspectRatio: "1/1",
                        }}
                    >
                        {item.type === "image" ? (
                            <img
                                src={item.url || undefined}
                                alt={`selected-img-${idx}`}
                                className="w-full h-full object-contain"
                                style={{ aspectRatio: "1/1" }}
                            />
                        ) : (
                            <video
                                src={item.url || undefined}
                                controls
                                className="w-full h-full object-contain"
                                style={{ aspectRatio: "1/1", background: "black" }}
                            />
                        )}
                        <MediaRemoveButton onClick={() => onRemove(idx)} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{
                display: isPosting ? "flex" : "none",
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(7px)",
            }}
            onClick={onClose}
        >
            <div
                className="relative bg-[#26282B] rounded-xl shadow-lg w-[624px] max-h-[90vh] flex flex-col"
                style={{ minHeight: 460, overflow: "hidden" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header (fixed) */}
                <div
                    className="w-full h-[58px] flex items-center justify-center relative px-4 border-b border-[#35383b] bg-[#26282B]"
                    style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                    }}
                >
                    <span className="text-xl font-bold text-[#f1f1f2]">Đăng bài viết</span>
                    <button
                        className="absolute right-2 top-2 flex items-center justify-center w-[36px] h-[36px] rounded-full hover:bg-[#35383b] transition"
                        onClick={onClose}
                        title="Đóng"
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                    >
                        <FaTimes className="w-5 h-5 text-[#b0b3b8]" />
                    </button>
                </div>
                {/* User Bar */}
                <div className="flex items-center p-4 gap-3">
                    {avatar && avatar !== "" ? (
                        <img
                            src={avatar}
                            alt="avatar"
                            width={48}
                            height={48}
                            className="rounded-full object-cover"
                            style={{ width: 48, height: 48 }}
                        />
                    ) : null}
                    <div className="flex flex-col gap-0">
                        <span className="font-semibold text-white text-base leading-tight">{name}</span>
                        <span className="font-normal text-xs text-[#b0b3b8] bg-[#35383b] rounded px-2 py-0.5 w-fit mt-1">Công khai</span>
                    </div>
                </div>
                {/* Content */}
                <div
                    ref={contentWrapperRef}
                    className="flex-1 w-full px-4 pt-1 overflow-y-auto"
                    style={{
                        minHeight: 0,
                        maxHeight: 800,
                        transition: "max-height 0.2s"
                    }}
                >
                    <div className="flex flex-col items-center w-full overflow-hidden">
                        <div className="w-full max-w-[572px] flex flex-col overflow-hidden">
                            <textarea
                                ref={textareaRef}
                                value={textToPost}
                                onInput={handleTextareaInput}
                                placeholder={hasPostError ? "Lỗi" : "Viết gì đó đi..."}
                                rows={1}
                                className={`w-full overflow-hidden bg-transparent outline-none border-none text-lg resize-none overflow-auto font-normal py-2 px-1 pb-0 text-white ${hasPostError ? "placeholder-[#ff5c5c]" : "placeholder-[#A6A9AE]"}`}
                                style={{
                                    minHeight: 44,
                                    boxSizing: "border-box"
                                }}
                            />
                        </div>
                        {selectedMedia.length > 0 &&
                            <MediaPreviewGrid media={selectedMedia} onRemove={handleRemoveMedia} />
                        }
                    </div>
                </div>
                {/* Footer */}
                <div className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#333334] text-[#b0b3b8] font-medium hover:bg-[#484849] transition"
                            onClick={handleAddImageClick}
                        >
                            <FaRegImage className="h-5 w-5" style={{ color: "#45bd62" }} />
                            Ảnh
                        </button>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={handleImageChange}
                        />
                        <button
                            type="button"
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#333334] text-[#b0b3b8] font-medium hover:bg-[#484849] transition"
                            onClick={handleAddVideoClick}
                        >
                            <FaRegPlayCircle className="h-5 w-5" style={{ color: "#f3425f" }} />
                            Video
                        </button>
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={handleVideoChange}
                        />
                    </div>
                    <button
                        type="button"
                        className="w-full py-2 rounded-lg font-semibold text-lg transition cursor-pointer text-white"
                        onClick={handlePost}
                        disabled={isSubmitting}
                        style={{
                            backgroundColor: "#2176FF",
                            opacity: isSubmitting ? 0.6 : 1,
                            cursor: isSubmitting ? "not-allowed" : "pointer"
                        }}
                    >
                        Đăng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PostingPopup;
