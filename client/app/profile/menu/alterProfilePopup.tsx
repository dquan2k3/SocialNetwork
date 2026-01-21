"use client";
import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil, faTimes } from "@fortawesome/free-solid-svg-icons";
import Cropper from "react-easy-crop";
import { apiUpdateProfile } from "@/api/bio.api";
import { updateProfile } from "@/services/bio";
import { useDispatch } from "react-redux";

function isSafeImageSrc(src: string) {
  if (!src) return false;
  return (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("file:") ||
    src.startsWith("filesystem:")
  );
}

async function fetchImageAsDataURL(url: string) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Failed to fetch image");
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    try {
      const response = await fetch(url, { mode: "no-cors" });
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      throw err;
    }
  }
}

async function cropImageToDataURL(imageSrc: string, area: any): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!imageSrc || !area) return resolve(imageSrc);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const { x, y, width, height } = area;
      if (!width || !height) return resolve(imageSrc);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(imageSrc);
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => resolve(imageSrc);
  });
}

type CropShape = "rect" | "round";

interface ImageCropperProps {
  imageSrc: string;
  onCropDone: (blob: Blob, cropObj: any, zoomObj: any) => void;
  onCancel: () => void;
  crop: any;
  setCrop: any;
  zoom: any;
  setZoom: any;
  setCroppedAreaPixels: any;
  aspect?: number;
  cropShape?: CropShape;
  width?: number;
  height?: number;
}

const ImageCropper = ({
  imageSrc,
  onCropDone,
  onCancel,
  crop,
  setCrop,
  zoom,
  setZoom,
  setCroppedAreaPixels,
  aspect = 1,
  cropShape = "round",
  width = 400,
  height = 400,
}: ImageCropperProps) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCroppedImage = async () => {
    setProcessing(true);
    setError(null);
    let safeSrc = imageSrc;
    try {
      if (!isSafeImageSrc(imageSrc)) {
        safeSrc = await fetchImageAsDataURL(imageSrc);
      }
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = safeSrc;
      await image.decode();

      const area = crop.croppedAreaPixels;
      const fallbackWidth = Math.round(width);
      const fallbackHeight = Math.round(height);

      const canvasWidth = area && area.width > 0 ? area.width : fallbackWidth;
      const canvasHeight = area && area.height > 0 ? area.height : fallbackHeight;

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setError("Không thể tạo ảnh đã cắt.");
        setProcessing(false);
        return;
      }

      ctx.drawImage(
        image,
        area && area.width > 0 ? area.x : 0,
        area && area.height > 0 ? area.y : 0,
        area && area.width > 0 ? area.width : fallbackWidth,
        area && area.height > 0 ? area.height : fallbackHeight,
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Không thể tạo ảnh đã cắt.");
          setProcessing(false);
          return;
        }
        onCropDone(blob, crop, zoom);
        setProcessing(false);
      }, "image/jpeg");
    } catch (err) {
      setError(
        "Không thể crop ảnh này. Ảnh từ nguồn bên ngoài có thể không cho phép chỉnh sửa do bảo mật (CORS). Hãy thử tải ảnh về máy và upload lại."
      );
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative bg-black rounded-lg"
        style={{ width: width, height: height, minWidth: 100, minHeight: 100 }}
      >
        <Cropper
          image={imageSrc}
          crop={crop.value}
          zoom={zoom.value}
          aspect={aspect}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, croppedAreaPixels) => {
            setCroppedAreaPixels(croppedAreaPixels);
            crop.croppedAreaPixels = croppedAreaPixels;
          }}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={getCroppedImage}
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={processing}
        >
          {processing ? "Đang xử lý..." : "Lưu"}
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded"
          disabled={processing}
        >
          Hủy
        </button>
      </div>
      {error && (
        <div className="text-red-400 text-sm mt-2 text-center max-w-[350px]">
          {error}
        </div>
      )}
    </div>
  );
};

interface ProfilePopupCroppedStat {
  cropX: number;
  cropY: number;
  zoom: number;
}

interface AlterProfilePopupProps {
  showPopup: boolean;
  setShowPopup: (v: boolean) => void;
  avatar: string;
  cover: string;
  avatarCroppedStat?: ProfilePopupCroppedStat;
  avatarCroppedArea?: any;
  coverCroppedStat?: ProfilePopupCroppedStat;
  coverCroppedArea?: any;
  description?: string;
  username?: string;
  userId?: string;
  getCloudinaryImageLink: (avatar: string, area: any, size?: number) => string;
  getCloudinaryCoverLink: (cover: string, area: any, w?: number, h?: number) => string;
  apiChangeBio?: (payload: any) => Promise<void>;
  apiGetBio?: () => any;
  dispatch?: (action: any) => void;
}

const noopAsync = async (_payload: any) => {};
const noop = () => {};

const AlterProfilePopup: React.FC<AlterProfilePopupProps> = ({
  showPopup,
  setShowPopup,
  avatar,
  cover,
  avatarCroppedStat,
  avatarCroppedArea,
  coverCroppedStat,
  coverCroppedArea,
  description,
  username,
  userId,
}) => {
  const dispatch = useDispatch();
  const [avatarData, setAvatarData] = useState<any>({
    original: null,
    blob: null,
    url: "",
    crop: { x: 0, y: 0 },
    zoom: 1,
    croppedAreaPixels: null,
  });

  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [crop, setCrop] = useState<any>({ value: { x: 0, y: 0 }, croppedAreaPixels: null });
  const [zoom, setZoom] = useState<any>({ value: 1 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isNewFileAvatar, setIsNewFileAvatar] = useState(false);
  const [cfNewAvatar, setCfNewAvatar] = useState(false);
  const [oldAvatar, setOldAvatar] = useState<any>(null);
  const [avatarSavedCrop, setAvatarSavedCrop] = useState<any>(null);
  const [avatarSavedZoom, setAvatarSavedZoom] = useState<any>(null);
  const [avatarSavedArea, setAvatarSavedArea] = useState<any>(null);

  const [avatarSavedCropNewFile, setAvatarSavedCropNewFile] = useState<any>(null);
  const [avatarSavedZoomNewFile, setAvatarSavedZoomNewFile] = useState<any>(null);
  const [avatarSavedAreaNewFile, setAvatarSavedAreaNewFile] = useState<any>(null);

  const [avatarOriginalPreviewUrl, setAvatarOriginalPreviewUrl] = useState<string>("");

  const [avatarPreviewForNewFile, setAvatarPreviewForNewFile] = useState<string>("");

  const [coverData, setCoverData] = useState<any>({
    original: null,
    blob: null,
    url: "",
    crop: { x: 0, y: 0 },
    zoom: 1,
    croppedAreaPixels: null,
  });
  const [showCoverCrop, setShowCoverCrop] = useState(false);
  const [coverCrop, setCoverCrop] = useState<any>({ value: { x: 0, y: 0 }, croppedAreaPixels: null });
  const [coverZoom, setCoverZoom] = useState<any>({ value: 1 });
  const [coverCroppedAreaPixels, setCoverCroppedAreaPixels] = useState<any>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [isNewFileCover, setIsNewFileCover] = useState(false);
  const [cfNewCover, setCfNewCover] = useState(false);
  const [oldCover, setOldCover] = useState<any>(null);
  const [coverSavedCrop, setCoverSavedCrop] = useState<any>(null);
  const [coverSavedZoom, setCoverSavedZoom] = useState<any>(null);
  const [coverSavedArea, setCoverSavedArea] = useState<any>(null);

  const [bio, setBio] = useState<string>("");
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState<string>("");
  const [originalBio, setOriginalBio] = useState<string>("");

  const [avatarChanged, setAvatarChanged] = useState(false);
  const [coverChanged, setCoverChanged] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [loadConfirm, setLoadConfirm] = useState(false);

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>("");

  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>("");

  // --- Disable body scroll when popup open ---
  useEffect(() => {
    if (showPopup) {
      // Lưu giá trị overflow cũ và set overflow:hidden khi popup mở
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    // Khi popup không open, reset scroll (tránh lỗi khi toggle nhiều lần)
    document.body.style.overflow = "";
    return;
  }, [showPopup]);
  // --- End disable scroll ---------

  useEffect(() => {
    setAvatarData({
      original: null,
      blob: null,
      url: avatar || "",
      crop: {
        x: avatarCroppedStat?.cropX ?? 0,
        y: avatarCroppedStat?.cropY ?? 0,
      },
      zoom: avatarCroppedStat?.zoom ?? 1,
      croppedAreaPixels: avatarCroppedArea || null,
    });
    setShowAvatarCrop(false);
    setCrop({
      value: {
        x: avatarCroppedStat?.cropX ?? 0,
        y: avatarCroppedStat?.cropY ?? 0,
      },
      croppedAreaPixels: avatarCroppedArea || null,
    });
    setZoom({ value: avatarCroppedStat?.zoom ?? 1 });
    setCroppedAreaPixels(avatarCroppedArea || null);

    setIsNewFileAvatar(false);
    setCfNewAvatar(false);
    setOldAvatar(null);

    setAvatarSavedCrop(null);
    setAvatarSavedZoom(null);
    setAvatarSavedArea(null);
    setAvatarSavedCropNewFile(null);
    setAvatarSavedZoomNewFile(null);
    setAvatarSavedAreaNewFile(null);

    setAvatarPreviewForNewFile("");

    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";

    setCoverData({
      original: null,
      blob: null,
      url: cover || "",
      crop: {
        x: coverCroppedStat?.cropX ?? 0,
        y: coverCroppedStat?.cropY ?? 0,
      },
      zoom: coverCroppedStat?.zoom ?? 1,
      croppedAreaPixels: coverCroppedArea || null,
    });
    setShowCoverCrop(false);
    setCoverCrop({
      value: {
        x: coverCroppedStat?.cropX ?? 0,
        y: coverCroppedStat?.cropY ?? 0,
      },
      croppedAreaPixels: coverCroppedArea || null,
    });
    setCoverZoom({ value: coverCroppedStat?.zoom ?? 1 });
    setCoverCroppedAreaPixels(coverCroppedArea || null);
    setIsNewFileCover(false);
    setCfNewCover(false);
    setOldCover(null);
    setCoverSavedCrop(null);
    setCoverSavedZoom(null);
    setCoverSavedArea(null);
    if (coverFileInputRef.current) coverFileInputRef.current.value = "";

    const cleanDescription =
      typeof description === "string"
        ? description.replace(/^"(.*)"$/, "$1")
        : description || "";
    setBio(cleanDescription);
    setBioInput(cleanDescription);
    setOriginalBio(cleanDescription);
    setEditingBio(false);

    setAvatarChanged(false);
    setCoverChanged(false);
    setDescriptionChanged(false);

    if ((avatarSavedArea && avatarSavedArea.width > 0 && avatarSavedArea.height > 0) && avatar) {
      cropImageToDataURL(avatar, avatarSavedArea).then((croppedDataUrl) => {
        setAvatarPreviewUrl(croppedDataUrl as string);
        setAvatarOriginalPreviewUrl(croppedDataUrl as string);
      });
    } else if (avatar && avatarCroppedArea && avatarCroppedArea.width > 0 && avatarCroppedArea.height > 0) {
      cropImageToDataURL(avatar, avatarCroppedArea).then((croppedDataUrl) => {
        setAvatarPreviewUrl(croppedDataUrl as string);
        setAvatarOriginalPreviewUrl(croppedDataUrl as string);
      });
    } else {
      setAvatarPreviewUrl(avatar || "");
      setAvatarOriginalPreviewUrl(avatar || "");
    }

    if ((coverSavedArea && coverSavedArea.width > 0 && coverSavedArea.height > 0) && cover) {
      cropImageToDataURL(cover, coverSavedArea).then((croppedDataUrl) => {
        setCoverPreviewUrl(croppedDataUrl as string);
      });
    } else if (cover && coverCroppedArea && coverCroppedArea.width > 0 && coverCroppedArea.height > 0) {
      cropImageToDataURL(cover, coverCroppedArea).then((croppedDataUrl) => {
        setCoverPreviewUrl(croppedDataUrl as string);
      });
    } else {
      setCoverPreviewUrl(cover || "");
    }
  }, [
    avatar,
    cover,
    avatarCroppedStat,
    avatarCroppedArea,
    coverCroppedStat,
    coverCroppedArea,
    description,
    showPopup,
  ]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setOldAvatar(avatarData);
      const url = URL.createObjectURL(file);
      setAvatarData({
        original: file,
        blob: null,
        url: url,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
      });
      setCrop({ value: { x: 0, y: 0 }, croppedAreaPixels: null });
      setZoom({ value: 1 });
      setCroppedAreaPixels(null);
      setIsNewFileAvatar(true);
      setShowAvatarCrop(true);
      setAvatarPreviewUrl(url);
      setAvatarSavedCrop(null);
      setAvatarSavedZoom(null);
      setAvatarSavedArea(null);

      setAvatarSavedCropNewFile(null);
      setAvatarSavedZoomNewFile(null);
      setAvatarSavedAreaNewFile(null);

      setAvatarPreviewForNewFile("");
    }
  };

  const handleAvatarClick = () => {
    setShowAvatarCrop(true);
    if (avatarSavedCrop && avatarSavedZoom && avatarSavedArea) {
      setCrop({ value: { ...avatarSavedCrop }, croppedAreaPixels: avatarSavedArea });
      setZoom({ value: avatarSavedZoom });
      setCroppedAreaPixels(avatarSavedArea);
    } else if (isNewFileAvatar) {
      if (avatarSavedCropNewFile && avatarSavedZoomNewFile && avatarSavedAreaNewFile) {
        setCrop({ value: { ...avatarSavedCropNewFile }, croppedAreaPixels: avatarSavedAreaNewFile });
        setZoom({ value: avatarSavedZoomNewFile });
        setCroppedAreaPixels(avatarSavedAreaNewFile);
      } else {
        setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarData.croppedAreaPixels });
        setZoom({ value: avatarData.zoom });
        setCroppedAreaPixels(avatarData.croppedAreaPixels);
      }
    } else if (avatarData && avatarData.crop && avatarData.zoom && avatarData.croppedAreaPixels) {
      setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarData.croppedAreaPixels });
      setZoom({ value: avatarData.zoom });
      setCroppedAreaPixels(avatarData.croppedAreaPixels);
    } else if (avatarCroppedStat) {
      setCrop({
        value: {
          x: avatarCroppedStat.cropX,
          y: avatarCroppedStat.cropY,
        },
        croppedAreaPixels: avatarCroppedArea || null,
      });
      setZoom({ value: avatarCroppedStat.zoom });
      setCroppedAreaPixels(avatarCroppedArea || null);
    } else {
      setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarData.croppedAreaPixels });
      setZoom({ value: avatarData.zoom });
      setCroppedAreaPixels(avatarData.croppedAreaPixels);
    }
  };

  const updateAvatarPreview = (src: string, area: any) => {
    if (!src) {
      setAvatarPreviewUrl("");
      setAvatarPreviewForNewFile("");
    } else if (isNewFileAvatar) {
      if (area && area.width > 0 && area.height > 0) {
        cropImageToDataURL(src, area).then((cropped) => {
          setAvatarPreviewUrl(cropped as string);
          setAvatarPreviewForNewFile(cropped as string);
        });
      } else {
        setAvatarPreviewUrl(src);
        setAvatarPreviewForNewFile(src);
      }
    } else if (area && area.width > 0 && area.height > 0) {
      cropImageToDataURL(src, area).then((cropped) => {
        setAvatarPreviewUrl(cropped as string);
        setAvatarOriginalPreviewUrl(cropped as string);
      });
      setAvatarPreviewForNewFile("");
    } else {
      setAvatarPreviewUrl(src);
      setAvatarOriginalPreviewUrl(src);
      setAvatarPreviewForNewFile("");
    }
  };

  const updateCoverPreview = (src: string, area: any) => {
    if (!src) {
      setCoverPreviewUrl("");
    } else if (isNewFileCover) {
      if (area && area.width > 0 && area.height > 0) {
        cropImageToDataURL(src, area).then((cropped) => setCoverPreviewUrl(cropped as string));
      } else {
        setCoverPreviewUrl(src);
      }
    } else if (area && area.width > 0 && area.height > 0) {
      cropImageToDataURL(src, area).then((cropped) => setCoverPreviewUrl(cropped as string));
    } else {
      setCoverPreviewUrl(src);
    }
  };

  const handleCropDone = (blob: Blob, cropObj: any, zoomObj: any) => {
    setAvatarData((prev: any) => ({
      ...prev,
      blob: blob,
      url: prev.url,
      crop: { ...crop.value },
      zoom: zoom.value,
      croppedAreaPixels: croppedAreaPixels,
    }));
    setShowAvatarCrop(false);
    setAvatarChanged(true);
    if (isNewFileAvatar) setCfNewAvatar(true);
    setOldAvatar(null);

    setAvatarSavedCrop({ ...crop.value });
    setAvatarSavedZoom(zoom.value);
    setAvatarSavedArea(croppedAreaPixels);

    if (isNewFileAvatar) {
      setAvatarSavedCropNewFile({ ...crop.value });
      setAvatarSavedZoomNewFile(zoom.value);
      setAvatarSavedAreaNewFile(croppedAreaPixels);

      const fileOrUrl = avatarData.original
        ? typeof avatarData.original === "string"
          ? avatarData.original
          : URL.createObjectURL(avatarData.original)
        : avatarData.url;

      if (croppedAreaPixels && croppedAreaPixels.width > 0 && croppedAreaPixels.height > 0) {
        cropImageToDataURL(fileOrUrl, croppedAreaPixels).then((cropped) => {
          setAvatarPreviewForNewFile(cropped as string);
        });
      } else {
        setAvatarPreviewForNewFile(fileOrUrl);
      }
    }

    const fileOrUrl = avatarData.original
      ? typeof avatarData.original === "string"
        ? avatarData.original
        : URL.createObjectURL(avatarData.original)
      : avatarData.url;
    if (!isNewFileAvatar) {
      if (croppedAreaPixels && croppedAreaPixels.width > 0 && croppedAreaPixels.height > 0) {
        cropImageToDataURL(fileOrUrl, croppedAreaPixels).then((cropped) => {
          setAvatarOriginalPreviewUrl(cropped as string);
        });
      } else {
        setAvatarOriginalPreviewUrl(fileOrUrl);
      }
    }

    updateAvatarPreview(fileOrUrl, croppedAreaPixels);
  };

  const handleCropCancel = () => {
    setShowAvatarCrop(false);
    if (isNewFileAvatar && oldAvatar) {
      setAvatarData(oldAvatar);
      setCrop({ value: { ...oldAvatar.crop }, croppedAreaPixels: oldAvatar.croppedAreaPixels || null });
      setZoom({ value: oldAvatar.zoom });
      setCroppedAreaPixels(oldAvatar.croppedAreaPixels || null);
      setIsNewFileAvatar(false);
      setOldAvatar(null);

      setAvatarSavedCropNewFile(null);
      setAvatarSavedZoomNewFile(null);
      setAvatarSavedAreaNewFile(null);
      setAvatarPreviewForNewFile("");

      if (oldAvatar.croppedAreaPixels && oldAvatar.croppedAreaPixels.width > 0 && oldAvatar.croppedAreaPixels.height > 0) {
        updateAvatarPreview(oldAvatar.url, oldAvatar.croppedAreaPixels);
      } else {
        updateAvatarPreview(oldAvatar.url, null);
      }
      return;
    }
    if (avatarSavedCrop && avatarSavedZoom && avatarSavedArea && avatarPreviewForNewFile) {
      setCrop({ value: { ...avatarSavedCrop }, croppedAreaPixels: avatarSavedArea });
      setZoom({ value: avatarSavedZoom });
      setCroppedAreaPixels(avatarSavedArea);
      setAvatarPreviewUrl(avatarPreviewForNewFile);
    } else if (avatarSavedCrop && avatarSavedZoom && avatarSavedArea) {
      setCrop({ value: { ...avatarSavedCrop }, croppedAreaPixels: avatarSavedArea });
      setZoom({ value: avatarSavedZoom });
      setCroppedAreaPixels(avatarSavedArea);
      setAvatarPreviewUrl(avatarOriginalPreviewUrl);
    } else if (avatarData && avatarData.crop && avatarData.zoom && avatarData.croppedAreaPixels) {
      setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarData.croppedAreaPixels });
      setZoom({ value: avatarData.zoom });
      setCroppedAreaPixels(avatarData.croppedAreaPixels);
      setAvatarPreviewUrl(avatarOriginalPreviewUrl);
    } else if (avatarCroppedArea && avatar && avatarCroppedArea.width > 0 && avatarCroppedArea.height > 0) {
      setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarCroppedArea });
      setZoom({ value: avatarData.zoom });
      setCroppedAreaPixels(avatarCroppedArea);
      setAvatarPreviewUrl(avatarOriginalPreviewUrl);
    } else {
      setCrop({ value: { ...avatarData.crop }, croppedAreaPixels: avatarData.croppedAreaPixels || null });
      setZoom({ value: avatarData.zoom });
      setCroppedAreaPixels(avatarData.croppedAreaPixels || null);
      setAvatarPreviewUrl(avatarOriginalPreviewUrl);
    }
    setIsNewFileAvatar(false);
  };

  const handleSetCrop = (val: any) => setCrop((prev: any) => ({ ...prev, value: val }));
  const handleSetZoom = (val: any) => setZoom((prev: any) => ({ ...prev, value: val }));
  const handleSetCroppedAreaPixels = (pixels: any) => setCroppedAreaPixels(pixels);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setOldCover(coverData);
      const url = URL.createObjectURL(file);
      setCoverData({
        original: file,
        blob: null,
        url: url,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
      });
      setCoverCrop({ value: { x: 0, y: 0 }, croppedAreaPixels: null });
      setCoverZoom({ value: 1 });
      setCoverCroppedAreaPixels(null);
      setIsNewFileCover(true);
      setShowCoverCrop(true);
      setCoverPreviewUrl(url);
      setCoverSavedCrop(null);
      setCoverSavedZoom(null);
      setCoverSavedArea(null);
    }
  };

  const handleCoverClick = () => {
    setShowCoverCrop(true);

    if (coverSavedCrop && coverSavedZoom && coverSavedArea) {
      setCoverCrop({ value: { ...coverSavedCrop }, croppedAreaPixels: coverSavedArea });
      setCoverZoom({ value: coverSavedZoom });
      setCoverCroppedAreaPixels(coverSavedArea);
    } else if (!isNewFileCover && coverCroppedStat) {
      setCoverCrop({
        value: {
          x: coverCroppedStat.cropX,
          y: coverCroppedStat.cropY,
        },
        croppedAreaPixels: coverCroppedArea || null,
      });
      setCoverZoom({ value: coverCroppedStat.zoom });
      setCoverCroppedAreaPixels(coverCroppedArea || null);
    } else {
      setCoverCrop({ value: { ...coverData.crop }, croppedAreaPixels: coverData.croppedAreaPixels });
      setCoverZoom({ value: coverData.zoom });
      setCoverCroppedAreaPixels(coverData.croppedAreaPixels);
    }
  };

  const handleCoverCropDone = (blob: Blob, cropObj: any, zoomObj: any) => {
    setCoverData((prev: any) => ({
      ...prev,
      blob: blob,
      url: prev.url,
      crop: { ...coverCrop.value },
      zoom: coverZoom.value,
      croppedAreaPixels: coverCroppedAreaPixels,
    }));
    setShowCoverCrop(false);
    setCoverChanged(true);
    if (isNewFileCover) setCfNewCover(true);
    setOldCover(null);

    setCoverSavedCrop({ ...coverCrop.value });
    setCoverSavedZoom(coverZoom.value);
    setCoverSavedArea(coverCroppedAreaPixels);

    const fileOrUrl = coverData.original
      ? typeof coverData.original === "string"
        ? coverData.original
        : URL.createObjectURL(coverData.original)
      : coverData.url;

    updateCoverPreview(fileOrUrl, coverCroppedAreaPixels);
  };

  const handleCoverCropCancel = () => {
    setShowCoverCrop(false);
    if (isNewFileCover && oldCover) {
      setCoverData(oldCover);
      setCoverCrop({ value: { ...oldCover.crop }, croppedAreaPixels: oldCover.croppedAreaPixels || null });
      setCoverZoom({ value: oldCover.zoom });
      setCoverCroppedAreaPixels(oldCover.croppedAreaPixels || null);
      setIsNewFileCover(false);
      setOldCover(null);
      setCoverSavedCrop(null);
      setCoverSavedZoom(null);
      setCoverSavedArea(null);

      if (oldCover.croppedAreaPixels && oldCover.croppedAreaPixels.width > 0 && oldCover.croppedAreaPixels.height > 0) {
        updateCoverPreview(oldCover.url, oldCover.croppedAreaPixels);
      } else {
        updateCoverPreview(oldCover.url, null);
      }
      return;
    }

    if (coverSavedCrop && coverSavedZoom && coverSavedArea && coverSavedArea.width > 0 && coverSavedArea.height > 0) {
      setCoverCrop({ value: { ...coverSavedCrop }, croppedAreaPixels: coverSavedArea });
      setCoverZoom({ value: coverSavedZoom });
      setCoverCroppedAreaPixels(coverSavedArea);
      updateCoverPreview(cover, coverSavedArea);
    } else if (coverData && coverData.crop && coverData.zoom && coverData.croppedAreaPixels) {
      setCoverCrop({ value: { ...coverData.crop }, croppedAreaPixels: coverData.croppedAreaPixels });
      setCoverZoom({ value: coverData.zoom });
      setCoverCroppedAreaPixels(coverData.croppedAreaPixels);
      updateCoverPreview(cover, coverData.croppedAreaPixels);
    } else if (coverCroppedArea && cover && coverCroppedArea.width > 0 && coverCroppedArea.height > 0) {
      setCoverCrop({ value: { ...coverData.crop }, croppedAreaPixels: coverCroppedArea });
      setCoverZoom({ value: coverData.zoom });
      setCoverCroppedAreaPixels(coverCroppedArea);
      updateCoverPreview(cover, coverCroppedArea);
    } else {
      setCoverCrop({ value: { ...coverData.crop }, croppedAreaPixels: coverData.croppedAreaPixels || null });
      setCoverZoom({ value: coverData.zoom });
      setCoverCroppedAreaPixels(coverData.croppedAreaPixels || null);
      updateCoverPreview(cover, coverData.croppedAreaPixels);
    }
    setIsNewFileCover(false);
  };

  const handleSetCoverCrop = (val: any) => setCoverCrop((prev: any) => ({ ...prev, value: val }));
  const handleSetCoverZoom = (val: any) => setCoverZoom((prev: any) => ({ ...prev, value: val }));
  const handleSetCoverCroppedAreaPixels = (pixels: any) => setCoverCroppedAreaPixels(pixels);

  const handleAvatarChangeClick = () => {
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = "";
      avatarFileInputRef.current.click();
    }
  };

  const handleCoverChangeClick = () => {
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
      coverFileInputRef.current.click();
    }
  };

  const handleEditBioClick = () => {
    setEditingBio(true);
    setBioInput(bio);
    setOriginalBio(bio);
  };
  const handleBioInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBioInput(e.target.value);
  };
  const handleBioSave = () => {
    setBio(bioInput);
    setEditingBio(false);
    setDescriptionChanged(true);
  };
  const handleBioCancel = () => {
    setBioInput(originalBio);
    setEditingBio(false);
  };

  const isEditing = editingBio;

  const handleConfirm = async () => {
    setLoadConfirm(true);

    const avatarCropStat = {
      x: avatarData.crop?.x ?? 0,
      y: avatarData.crop?.y ?? 0,
      zoom: avatarData.zoom ?? 1,
    };
    const avatarCropArea = {
      x: avatarData.croppedAreaPixels?.x ?? 0,
      y: avatarData.croppedAreaPixels?.y ?? 0,
      width: avatarData.croppedAreaPixels?.width ?? 0,
      height: avatarData.croppedAreaPixels?.height ?? 0,
    };
    const avatarObj = avatarChanged
      ? {
          original:
            cfNewAvatar && avatarData.original && typeof avatarData.original !== "string"
              ? avatarData.original
              : null,
          cropStat: avatarData.crop ? avatarCropStat : undefined,
          cropArea: avatarData.croppedAreaPixels ? avatarCropArea : undefined,
          cfNewAvatar,
        }
      : null;

    const coverCropStat = {
      x: coverData.crop?.x ?? 0,
      y: coverData.crop?.y ?? 0,
      zoom: coverData.zoom ?? 1,
    };
    const coverCropArea = {
      x: coverData.croppedAreaPixels?.x ?? 0,
      y: coverData.croppedAreaPixels?.y ?? 0,
      width: coverData.croppedAreaPixels?.width ?? 0,
      height: coverData.croppedAreaPixels?.height ?? 0,
    };
    const coverObj = coverChanged
      ? {
          original:
            cfNewCover && coverData.original && typeof coverData.original !== "string"
              ? coverData.original
              : null,
          cropStat: coverData.crop ? coverCropStat : undefined,
          cropArea: coverData.croppedAreaPixels ? coverCropArea : undefined,
          cfNewCover,
        }
      : null;

    const updatePayload = {
      userId,
      username,
      avatar: avatarObj,
      cover: coverObj,
      bio: bio ?? "",
      avatarChanged: !!avatarChanged,
      coverChanged: !!coverChanged,
      descriptionChanged: !!descriptionChanged,
      cfNewAvatar: !!cfNewAvatar,
      cfNewCover: !!cfNewCover,
    };

    try {
      await updateProfile(updatePayload, dispatch);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadConfirm(false);
      setShowPopup(false);
    }
  };

  // Helper function to resolve which image src to use, with fallback and default image.
  const getValidImgSrc = (mainSrc: string, fallbackSrc: string, defaultSrc?: string) => {
    if (mainSrc && mainSrc.trim() !== "") return mainSrc;
    if (fallbackSrc && fallbackSrc.trim() !== "") return fallbackSrc;
    // Provide a default image or blank fallback, e.g. a data:image/svg+xml icon
    if (defaultSrc !== undefined) return defaultSrc;
    return "data:image/svg+xml;utf8,<svg width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='%23222'/></svg>";
  };

  return (
    <div
      className={`fixed ${showPopup ? "flex" : "!hidden"} w-full inset-0 z-[100] items-start justify-center overflow-auto`}
    >
      <div
        className="fixed inset-0 z-[-1] bg-black"
        style={{
          opacity: 0.85,
        }}
      ></div>
      <div className="w-full overflow-y-auto flex pt-32 pb-16 justify-center">
        <div className="w-full sm:w-[90%] md:w-[700px] bg-[#252728] rounded-[18px] border border-[#303233]">
          <div className="w-full h-[60px] rounded-t-[18px] border-b border-[#303233] flex items-center justify-center relative">
            <h2 className="flex-1 text-center text-white font-semibold text-xl">
              Chỉnh sửa trang cá nhân
            </h2>
            <button
              type="button"
              className="absolute right-4 w-[36px] h-[36px] flex items-center justify-center rounded-full bg-[#3B3D3E] hover:bg-[#4F5152] text-[#b0b3b8] cursor-pointer"
              title="Hủy"
              onClick={() => setShowPopup(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="w-full flex gap-2 flex-col p-2">
            {/* Avatar */}
            <div className="w-full">
              <div className="w-full flex flex-row justify-between">
                <span className="text-white font-semibold text-xl p-2">
                  Ảnh đại diện
                </span>
                <button
                  type="button"
                  className="text-[#4B83C4] hover:text-[#649FE3] hover:bg-[#3B3D3E] font-[400] text-xl p-2 rounded-md cursor-pointer"
                  style={{ userSelect: "none" }}
                  onClick={handleAvatarChangeClick}
                >
                  Thay đổi
                </button>
                <input
                  ref={avatarFileInputRef}
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              </div>
              <div className="flex-1 w-full h-full flex justify-center items-center p-4">
                {!showAvatarCrop ? (
                  <div
                    className="relative group"
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "#222",
                    }}
                    onClick={handleAvatarClick}
                  >
                    <img
                      src={getValidImgSrc(avatarPreviewUrl, avatarData.url)}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        transition: "filter 0.2s",
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50"
                      style={{
                        borderRadius: "50%",
                        color: "#fff",
                        fontWeight: 500,
                        fontSize: 20,
                        letterSpacing: 1,
                      }}
                    >
                      <FontAwesomeIcon className="text-sm pr-1" icon={faPencil} /> Sửa
                    </div>
                  </div>
                ) : (
                  <ImageCropper
                    imageSrc={
                      avatarData.original
                        ? typeof avatarData.original === "string"
                          ? avatarData.original
                          : URL.createObjectURL(avatarData.original)
                        : avatarData.url
                    }
                    onCropDone={handleCropDone}
                    onCancel={handleCropCancel}
                    setCrop={handleSetCrop}
                    setZoom={handleSetZoom}
                    setCroppedAreaPixels={handleSetCroppedAreaPixels}
                    aspect={1}
                    cropShape="round"
                    width={400}
                    height={400}
                    crop={crop}
                    zoom={zoom}
                  />
                )}
              </div>
            </div>
            {/* Cover */}
            <div className="w-full">
              <div className="w-full flex flex-row justify-between">
                <span className="text-white font-semibold text-xl p-2">
                  Ảnh bìa
                </span>
                <button
                  type="button"
                  className="text-[#4B83C4] hover:text-[#649FE3] hover:bg-[#3B3D3E] font-[400] text-xl p-2 rounded-md cursor-pointer"
                  style={{ userSelect: "none" }}
                  onClick={handleCoverChangeClick}
                >
                  Thay đổi
                </button>
                <input
                  ref={coverFileInputRef}
                  id="cover-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverFileChange}
                />
              </div>
              <div className="flex-1 w-full h-full flex justify-center items-center p-4">
                {!showCoverCrop ? (
                  <div
                    className="relative group"
                    style={{
                      width: 500,
                      height: 185,
                      borderRadius: "12px",
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "#222",
                    }}
                    onClick={handleCoverClick}
                  >
                    <img
                      src={getValidImgSrc(coverPreviewUrl, coverData.url)}
                      alt="cover"
                      className="w-full h-full object-cover"
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "12px",
                        transition: "filter 0.2s",
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50"
                      style={{
                        borderRadius: "12px",
                        color: "#fff",
                        fontWeight: 500,
                        fontSize: 20,
                        letterSpacing: 1,
                      }}
                    >
                      <FontAwesomeIcon className="text-sm pr-1" icon={faPencil} /> Sửa
                    </div>
                  </div>
                ) : (
                  <ImageCropper
                    imageSrc={
                      coverData.original
                        ? typeof coverData.original === "string"
                          ? coverData.original
                          : URL.createObjectURL(coverData.original)
                        : coverData.url
                    }
                    onCropDone={handleCoverCropDone}
                    onCancel={handleCoverCropCancel}
                    crop={coverCrop}
                    setCrop={handleSetCoverCrop}
                    zoom={coverZoom}
                    setZoom={handleSetCoverZoom}
                    setCroppedAreaPixels={handleSetCoverCroppedAreaPixels}
                    aspect={2.7}
                    cropShape="rect"
                    width={500}
                    height={185}
                  />
                )}
              </div>
            </div>
            {/* Bio */}
            <div className="w-full">
              <div className="w-full flex flex-row justify-between">
                <span className="text-white font-semibold text-xl p-2">
                  Tiểu sử
                </span>
                {!editingBio ? (
                  <button
                    className="text-[#4B83C4] hover:text-[#649FE3] hover:bg-[#3B3D3E] font-[400] text-xl p-2 rounded-md"
                    onClick={handleEditBioClick}
                  >
                    Chỉnh sửa
                  </button>
                ) : null}
              </div>
              <div className="flex-1 w-full h-full flex justify-center items-center p-4">
                {!editingBio ? (
                  <span className="text-[16px] text-white">
                    {bio && bio.trim() !== "" ? bio : "Mô tả gì đó về bản thân bạn..."}
                  </span>
                ) : (
                  <div className="w-full flex flex-col items-center gap-2">
                    <textarea
                      className="w-full min-h-[100px] max-h-[200px] rounded-md p-2 text-[16px] text-white bg-[#232425] border border-[#303233] focus:outline-none resize-y"
                      value={bioInput}
                      onChange={handleBioInputChange}
                      maxLength={200}
                      placeholder="Nhập tiểu sử của bạn (tối đa 200 ký tự)..."
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end w-full">
                      <button
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        onClick={handleBioSave}
                      >
                        Lưu
                      </button>
                      <button
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        onClick={handleBioCancel}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="w-full h-[70px] p-3">
            <div
              className={`w-full h-full rounded-lg text-2xl flex items-center justify-center font-[500] 
                ${loadConfirm
                  ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                  : "bg-[#243A52] text-[#639AD8] cursor-pointer hover:bg-[#3A4E64] hover:text-[#83BDFF]"
                }`
              }
              style={loadConfirm ? { pointerEvents: "none" } : {}}
              onClick={!loadConfirm && !isEditing ? handleConfirm : undefined}
            >
              {loadConfirm ? "Loading..." : "Xác nhận"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlterProfilePopup;
