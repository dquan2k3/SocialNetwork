import React, { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { apiUpdateGroupCover } from "@/api/group.api"; // import API

interface AlterCoverProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
  onCoverChange?: (params: { groupId: string; newCover: string; newName?: string }) => void;
  initialName?: string; // Optional, if you want to prefill name
}

function getCroppedImg(
  imageSrc: string,
  crop: any,
  zoom: number,
  croppedAreaPixels: any
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = function () {
      // Kích thước tối đa của ảnh cover: 1680 x 575
      const maxWidth = 1680;
      const maxHeight = 575;
      let outWidth = croppedAreaPixels.width;
      let outHeight = croppedAreaPixels.height;

      // Nếu crop vượt quá kích thước tối đa thì scale crop về tối đa
      let scale = Math.min(maxWidth / outWidth, maxHeight / outHeight, 1);
      outWidth = Math.round(outWidth * scale);
      outHeight = Math.round(outHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(null);

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        outWidth,
        outHeight
      );
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.95
      );
    };
    img.onerror = () => {
      reject(null);
    };
  });
}

const UpdateCoverPopup: React.FC<AlterCoverProps> = ({
  groupId,
  open,
  onClose,
  onCoverChange,
  initialName = "",
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [hovering, setHovering] = useState(false);

  const inputFile = useRef<HTMLInputElement>(null);

  const [imageBuffer, setImageBuffer] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // giữ raw-cropped blob cho submit
  const croppedBlobRef = useRef<Blob | null>(null);

  // Thêm state cho name
  const [name, setName] = useState<string>(initialName);

  // Reset name when open changes
  React.useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageUrl(reader.result as string);
        setImageBuffer(reader.result as string);
      });
      reader.readAsDataURL(e.target.files[0]);
      setCroppedImage(null);
      croppedBlobRef.current = null;
      setErrorMsg(null);
    }
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirmCrop = async () => {
    if (imageUrl && croppedAreaPixels) {
      const blob = await getCroppedImg(imageUrl, crop, zoom, croppedAreaPixels);
      if (blob) {
        const previewUrl = URL.createObjectURL(blob);
        setCroppedImage(previewUrl);
        setImageUrl(null);
        croppedBlobRef.current = blob;
      }
    }
  };

  const handleEditImage = () => {
    if (imageBuffer) {
      setImageUrl(imageBuffer);
      setCroppedImage(null);
      croppedBlobRef.current = null;
      setErrorMsg(null);
    }
  };

  const handlePickNewImage = () => {
    setImageUrl(null);
    setCroppedImage(null);
    setImageBuffer(null);
    croppedBlobRef.current = null;
    setErrorMsg(null);
    setTimeout(() => {
      if (inputFile.current) inputFile.current.value = "";
      if (inputFile.current) inputFile.current.click();
    }, 0);
  };

  // Call the API to update group cover with blob and groupId, name
  const handleFinalConfirm = async () => {
    setErrorMsg(null);
    if (croppedBlobRef.current && groupId && name.trim() !== "") {
      setLoading(true);
      try {
        // Sửa apiUpdateGroupCover để nhận thêm name là tham số thứ 3
        const res = await apiUpdateGroupCover(groupId, croppedBlobRef.current, name.trim());
        // Nếu res.success, truyền về onCoverChange
        if (onCoverChange && res && res.success) {
          // Truyền đúng định dạng object: { groupId, newCover, newName }
          onCoverChange({
            groupId,
            newCover: res.cover,
            newName: res.name,
          });
        }
        onClose();
      } catch (err: any) {
        setErrorMsg(
          err?.response?.data?.message ||
            "Lỗi khi cập nhật ảnh bìa, vui lòng thử lại."
        );
      }
      setLoading(false);
    } else if (name.trim() === "") {
      setErrorMsg("Tên nhóm không được để trống.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#232427] rounded-xl w-full max-w-[1152px] p-3 relative flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Đóng bằng dấu X - bg tròn màu xám */}
        <button
          className="absolute right-6 top-6 text-2xl text-[#b0b3b8] hover:text-white cursor-pointer select-none z-20 flex items-center justify-center bg-[#323336] hover:bg-[#44454a] transition-colors duration-150"
          style={{
            border: "none",
            boxShadow: "none",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: undefined,
          }}
          type="button"
          aria-label="Đóng"
          onClick={onClose}
        >
          ×
        </button>
        <div className="font-bold text-2xl text-white mb-7">
          Thay đổi ảnh bìa nhóm
        </div>
        
        {/* Name input */}
        <div className="w-full mb-6 flex flex-col items-center">
          <label htmlFor="groupNameInput" className="w-[948px] max-w-full text-left font-semibold text-white mb-2 text-base">
            Tên nhóm
          </label>
          <input
            id="groupNameInput"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nhập tên nhóm"
            className="w-[948px] max-w-full px-4 py-2 rounded-lg border border-[#3479EF] bg-[#111316] text-white outline-none focus:border-[#225ac7] text-base transition"
            autoFocus
            disabled={loading}
            spellCheck={false}
          />
        </div>

        <input
          type="file"
          accept="image/*"
          ref={inputFile}
          style={{ display: "none" }}
          onChange={onSelectFile}
        />

        <div className="w-full flex flex-col items-center">
          {/* Chọn ảnh mới nếu chưa có gì luôn */}
          {!imageUrl && !croppedImage && (
            <button
              className="w-[948px] max-w-full h-[342px] bg-[#1a1b1d] border-2 border-dashed border-[#3479EF] 
                text-[#b0b3b8] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[#232233] mb-4"
              type="button"
              onClick={() => inputFile.current && inputFile.current.click()}
              style={{ minWidth: 240 }}
            >
              <span className="text-lg">Chọn ảnh bìa mới</span>
            </button>
          )}

          {/* Crop view */}
          {imageUrl && (
            <div className="relative w-[948px] max-w-full h-[342px] bg-black rounded-lg overflow-hidden flex items-center justify-center mb-4">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1680 / 575}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={false}
              />
              {/* Không còn thanh zoom, không có lưới */}
            </div>
          )}

          {/* Hiển thị ảnh đã crop; hover hiện "Sửa ảnh" và click ảnh cũng sửa */}
          {croppedImage && !imageUrl && (
            <div
              className="relative w-[948px] max-w-full h-[342px] mb-4 rounded-lg overflow-hidden group cursor-pointer"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              onClick={handleEditImage}
              style={{ minHeight: 180 }}
            >
              <img
                src={croppedImage}
                alt="Ảnh bìa đã cắt"
                className={
                  "w-full h-full object-cover rounded-lg border border-[#3479EF] transition duration-150 ease-in-out select-none cursor-pointer" +
                  (hovering ? " grayscale-[0.1] brightness-90" : "")
                }
                draggable={false}
              />
              <div
                className={
                  "absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-150" +
                  (hovering ? " bg-black/25 opacity-100" : " bg-transparent opacity-0")
                }
              />
              {/* Hiện nút sửa */}
              {hovering && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-lg font-semibold px-4 py-2 select-none z-20 cursor-pointer"
                  style={{
                    background: "transparent",
                    border: "none",
                    boxShadow: "none"
                  }}
                >
                  Sửa ảnh
                </div>
              )}
            </div>
          )}

          {/* Nếu đã chọn ảnh hoặc crop xong thì hiện cụm nút phía dưới ảnh */}
          {(imageUrl || croppedImage || imageBuffer) && (
            <div className="w-[948px] max-w-full flex flex-row justify-end items-center gap-3 mb-4">
              <button
                className="px-3 py-2 rounded-lg bg-[#323334] text-[#b0b3b8] border border-[#3a4046] hover:bg-[#252728] hover:text-white transition text-sm cursor-pointer"
                type="button"
                onClick={handlePickNewImage}
                disabled={loading}
              >
                Chọn ảnh mới
              </button>
              {/* Nút lưu crop - chỉ hiện khi đang crop */}
              {imageUrl && (
                <button
                  className="px-5 py-2 rounded-lg bg-[#3479EF] text-white font-semibold hover:bg-[#225ac7] transition cursor-pointer"
                  onClick={handleConfirmCrop}
                  type="button"
                  disabled={loading}
                >
                  Lưu
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nút xác nhận cuối cùng, luôn ở dưới cùng, full width, màu xanh biển */}
        <div className="w-full flex flex-col gap-3 mt-6">
          <button
            className="w-full px-6 py-2 rounded-lg bg-[#3479EF] text-white font-bold text-lg hover:bg-[#225ac7] transition cursor-pointer"
            type="button"
            style={{ letterSpacing: 1 }}
            disabled={!croppedImage || loading || name.trim() === ""}
            onClick={handleFinalConfirm}
          >
            {loading ? "Đang cập nhật..." : "Xác nhận"}
          </button>
        </div>
        {errorMsg && (
          <div className="text-red-500 mt-4 font-semibold text-center">{errorMsg}</div>
        )}
      </div>
    </div>
  );
};

export default UpdateCoverPopup;
