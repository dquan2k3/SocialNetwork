import React, { useState, useEffect } from "react";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";

type ImageObj = {
    file_type?: string;
    file_url?: string;
    order_index?: number;
};

interface ShowImageProps {
    images?: ImageObj[];
    initialIndex?: number;
    onClose?: () => void;
    avatar?: string;
    avatarCroppedArea?: any;
    name?: string;
    username?: string;
    createdAt?: string | number | Date;
}

function formatDate(datetime?: string | number | Date): string {
    if (!datetime) return "";
    try {
        const d = new Date(datetime);
        if (isNaN(d.getTime())) return "";
        const pad = (n: number) => n < 10 ? `0${n}` : n;
        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        const hour = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${day}/${month}/${year} ${hour}:${min}`;
    } catch {
        return "";
    }
}

const ShowImage: React.FC<ShowImageProps> = ({
    images = [],
    initialIndex = 0,
    onClose,
    avatar,
    avatarCroppedArea,
    name,
    username,
    createdAt
}) => {
    // Lọc ra chỉ các ảnh (không bao gồm video)
    const imageOnlyArr = images.filter((img) => img.file_type === "image");
    // Đảm bảo filtered array có ít nhất 1 phần tử nếu muốn hiển thị
    if (!imageOnlyArr || imageOnlyArr.length === 0) return null;

    // Đảm bảo initialIndex trỏ tới thứ tự ảnh, không phải theo index cũ.
    // Nếu initialIndex truyền vào < imageOnlyArr.length thì giữ, 
    // còn nếu truyền vào là của array gốc (hỗ trợ backward compatibility): 
    // -> mapping về index mới nếu array gốc có video phía trước
    // index ảnh trong images
    let realInitialIndex = initialIndex;
    // map sang index của imageOnlyArr nếu initialIndex là index gốc
    if (images && images.length > 0) {
        let count = 0;
        for (let k = 0; k < images.length; k++) {
            if (images[k].file_type === "image") {
                if (k === initialIndex) {
                    realInitialIndex = count;
                    break;
                }
                count++;
            }
        }
        // Nếu initialIndex là 0 hoặc không phải vị trí ảnh -> mặc định là 0
        if (initialIndex === 0 && images[0]?.file_type !== "image") realInitialIndex = 0;
        // Nếu index không khớp phần tử ảnh nào (ví dụ truyền 3 mà chỉ có 2 ảnh) => về 0
        if (realInitialIndex >= imageOnlyArr.length) realInitialIndex = 0;
    } else {
        realInitialIndex = 0;
    }

    const [current, setCurrent] = useState(realInitialIndex);

    useEffect(() => {
        // Chỉ ẩn scroll khi modal ShowImage xuất hiện
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const avatar80x80 = getCloudinaryImageLink(avatar || "", avatarCroppedArea, 80);

    const singleImage = imageOnlyArr.length === 1;

    const getImageUrl = (imgObj?: ImageObj) => {
        if (!imgObj) return "";
        if (imgObj.file_type === "image" && imgObj.file_url) return imgObj.file_url;
        // fallback
        return "";
    };

    const handlePrev = () => {
        setCurrent((prev) => (prev === 0 ? imageOnlyArr.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrent((prev) => (prev === imageOnlyArr.length - 1 ? 0 : prev + 1));
    };

    const handleClose = () => {
        if (onClose) onClose();
    };

    const currentImageObj = imageOnlyArr[current];
    const imgUrl = getImageUrl(currentImageObj);

    const formattedCreatedAt = formatDate(createdAt);

    return (
        <div
            className="fixed inset-0 z-4000 flex items-center justify-center"
            style={{ zIndex: 200 }}
        >
            {/* Overlay */}
            <div className="fixed inset-0 bg-black opacity-80 pointer-events-auto" style={{ zIndex: 100 }}></div>
            {/* Main content */}
            <div className="relative flex flex-row w-[90vw] h-[90vh] max-h-[95vh] rounded-2xl overflow-hidden z-[101]">
                {/* Left side - image viewer with parent div for bg match & padding */}
                <div className="flex-1 bg-[#242627] flex items-center justify-center relative h-full w-full p-3">
                    <div className="w-full h-full flex items-center justify-center bg-black rounded-xl relative">
                        {/* Prev Button */}
                        {!singleImage && (
                            <button
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[#3B3D3E] hover:bg-[#4F5152] text-[#b0b3b8] focus:outline-none"
                                onClick={handlePrev}
                                aria-label="Ảnh trước"
                            >
                                {/* Left Chevron */}
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                            </button>
                        )}
                        {/* Image */}
                        <div
                            className="flex items-center justify-center rounded-lg w-full h-full"
                            style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                width: "100%",
                                height: "100%"
                            }}
                        >
                            {imgUrl ? (
                                <img
                                    src={imgUrl}
                                    alt={`Ảnh ${current + 1}`}
                                    className="transition-all duration-100"
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: "100%",
                                        width: "auto",
                                        height: "auto",
                                        display: "block",
                                        margin: "auto"
                                    }}
                                    draggable={false}
                                />
                            ) : (
                                <div className="text-white text-center w-full">
                                    Không có ảnh để hiển thị
                                </div>
                            )}
                        </div>
                        {/* Next Button */}
                        {!singleImage && (
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[#3B3D3E] hover:bg-[#4F5152] text-[#b0b3b8] focus:outline-none"
                                onClick={handleNext}
                                aria-label="Ảnh sau"
                            >
                                {/* Right Chevron */}
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                            </button>
                        )}
                        {/* Footer: index */}
                        {!singleImage && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#242627cc] px-4 py-1 rounded text-[#b0b3b8] text-sm">
                                Ảnh {current + 1} / {imageOnlyArr.length}
                            </div>
                        )}
                    </div>
                </div>
                {/* Right side - profile info */}
                <div className="w-[340px] min-w-[280px] max-w-[400px] h-full bg-[#242627] border-l border-[#2B2D2E] flex flex-col relative">
                    {/* Close Button */}
                    <button
                        type="button"
                        className="absolute top-3 right-3 w-[40px] h-[40px] flex items-center justify-center rounded-full bg-[#3B3D3E] hover:bg-[#4F5152] text-[#b0b3b8] z-20 cursor-pointer"
                        title="Đóng"
                        onClick={handleClose}
                    >
                        {/* Close (X) icon */}
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                    </button>
                    {/* Profile Info */}
                    <div className="flex flex-col items-center justify-center mt-16">
                        <div className="w-[80px] h-[80px] bg-blue-300 rounded-full overflow-hidden mb-3">
                            <img
                                src={avatar80x80}
                                alt="Avatar"
                                className="w-full h-full object-cover rounded-full"
                            />
                        </div>
                        <span className="font-semibold text-white text-[20px]">{name}</span>
                        {username && (
                            <span className="font-[300] text-[#b0b3b8] text-[15px] mt-1">@{username}</span>
                        )}
                        {formattedCreatedAt && (
                            <span className="text-[#94989D] text-[13px] mt-1">
                                Đăng ngày: {formattedCreatedAt}
                            </span>
                        )}
                    </div>
                    {/* (Optional) Add more profile details or actions here */}
                </div>
            </div>
        </div>
    );
};

export default ShowImage;
