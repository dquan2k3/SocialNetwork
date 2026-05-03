import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes, faQuestion } from "@fortawesome/free-solid-svg-icons";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import Cropper from "react-easy-crop";
import { apiCreateGroupConversation, apiLoadListFriend } from "@/api/conversation.api";

// New: Accept onGroupCreated prop
interface CreateGroupButtonProps {
  onGroupCreated?: (group: {
    conversationId: string;
    groupAvatar: string | null;
    groupName: string;
    owner: string;
    requireApproval: boolean;
  }) => void;
}

interface CroppedAreaPixels {
  width: number;
  height: number;
  x: number;
  y: number;
}

const getCroppedImg = async (
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<{ url: string; file: File } | null> => {
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();
      image.setAttribute("crossOrigin", "anonymous");
      image.onload = () => resolve(image);
      image.onerror = error => reject(error);
      image.src = url;
    });

  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(
    image as CanvasImageSource,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );
  return new Promise<{ url: string; file: File } | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const fileUrl = URL.createObjectURL(blob);
      resolve({ url: fileUrl, file });
    }, "image/jpeg");
  });
};

const CreateGroupButton: React.FC<CreateGroupButtonProps> = ({ onGroupCreated }) => {
  const [open, setOpen] = useState(false);

  // Group data state
  const [groupName, setGroupName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [showApprovalTooltip, setShowApprovalTooltip] = useState(false);

  // Friend select state
  const [searchFriend, setSearchFriend] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  // friendList sẽ giữ danh sách bạn bè từ api, lúc đầu = null
  const [friendList, setFriendList] = useState<any[] | null>(null);
  const [isLoadingFriendList, setIsLoadingFriendList] = useState<boolean>(false);

  // Avatar crop
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [lastOriginAvatar, setLastOriginAvatar] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const [croppedAvatarUrl, setCroppedAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const prevCrop = useRef<{ x: number; y: number } | null>(null);
  const prevZoom = useRef<number>(1);

  // Add loading state for create group
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // useEffect: load friend list từ API khi mở popup
  useEffect(() => {
    if (!open) return;
    setIsLoadingFriendList(true);
    apiLoadListFriend()
      .then((res: any) => {
        let friends: any[] = [];
        // Sử dụng đúng res.friends (KHÔNG DÙNG dummy nữa)
        if (res && res.success === true && Array.isArray(res.friends)) {
          friends = res.friends.map((item: any) => ({
            userId: item.id,
            name: item.name,
            avatar: item.avatar,
            avatarCroppedArea: item.avatarCroppedArea ?? null,
          }));
        } else {
          friends = [];
        }
        setFriendList(friends);
      })
      .catch((err: any) => {
        console.error("apiLoadListFriend error:", err);
        setFriendList([]);
      })
      .finally(() => {
        setIsLoadingFriendList(false);
      });
  }, [open]);

  // FRIENDS FILTER
  const filteredFriends =
    Array.isArray(friendList)
      ? friendList.filter(
          (f) =>
            typeof f === "object" &&
            f !== null &&
            typeof f.name === "string" &&
            f.name.toLowerCase().includes(searchFriend.toLowerCase())
        )
      : [];

  const onFriendClick = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const url = URL.createObjectURL(e.target.files[0]);
      setAvatarSrc(url);
      setLastOriginAvatar(url);
      setCropping(true);
      setCroppedAvatarUrl(null);
      setAvatarFile(undefined);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const onCropComplete = (_: any, croppedAreaPixelsArg: CroppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixelsArg);
    prevCrop.current = crop;
    prevZoom.current = zoom;
  };

  const handleSaveCrop = async () => {
    if (!avatarSrc || !croppedAreaPixels) return;
    const result = await getCroppedImg(avatarSrc, croppedAreaPixels);
    if (!result) return;
    setCroppedAvatarUrl(result.url);
    setAvatarFile(result.file);
    setCropping(false);
    setAvatarSrc(null);
    prevCrop.current = crop;
    prevZoom.current = zoom;
  };

  const handleAvatarEdit = () => {
    if (!lastOriginAvatar) return;
    setCropping(true);
    setAvatarSrc(lastOriginAvatar);
    setCroppedAvatarUrl(null);
    setAvatarFile(undefined);
    setCrop(prevCrop.current ?? { x: 0, y: 0 });
    setZoom(prevZoom.current ?? 1);
  };

  const handleOpen = () => {
    setOpen(true);
    setGroupName("");
    setRequireApproval(false);
    setSelectedFriends([]);
    setSearchFriend("");
    setAvatarSrc(null);
    setLastOriginAvatar(null);
    setCroppedAvatarUrl(null);
    setAvatarFile(undefined);
    setCropping(false);
    setZoom(1);
    setHoverAvatar(false);
    setCrop({ x: 0, y: 0 });
    prevCrop.current = { x: 0, y: 0 };
    prevZoom.current = 1;
    setFriendList(null);
    setIsLoadingFriendList(false);
    setIsCreatingGroup(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Modified: Handle confirm with loading effect and call onGroupCreated
  const handleConfirm = () => {
    if (isCreatingGroup) return;
    setIsCreatingGroup(true);
    apiCreateGroupConversation({
      groupName,
      requireApproval,
      selectedFriends,
      avatarFile,
    })
      .then((data) => {
        setIsCreatingGroup(false);

        // Call onGroupCreated if provided
        if (onGroupCreated && data && data.conversationId) {
          onGroupCreated({
            conversationId: data.conversationId,
            groupAvatar: data.groupAvatar ?? null,
            groupName: data.groupName ?? groupName,
            owner: data.owner ?? "",
            requireApproval: typeof data.requireApproval === "boolean" ? data.requireApproval : requireApproval
          });
        }

        handleClose();
      })
      .catch((error) => {
        setIsCreatingGroup(false);
        console.error("Error creating group:", error);
      });
  };

  const handleCropperWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!cropping) return;
    e.preventDefault();
    let nextZoom = zoom - e.deltaY * 0.003;
    if (nextZoom < 1) nextZoom = 1;
    if (nextZoom > 3) nextZoom = 3;
    setZoom(nextZoom);
    prevZoom.current = nextZoom;
  };

  return (
    <div>
      {/* BUTTON */}
      <button
        onClick={handleOpen}
        className="bg-transparent border-[1.3px] border-[#1d8bf1] text-[#1d8bf1] rounded-md px-3 py-[4.5px] font-semibold flex items-center gap-[5px] transition-colors hover:bg-[#232323] text-[14.3px] cursor-pointer"
        type="button"
      >
        <FontAwesomeIcon icon={faPlus} style={{ fontSize: 15 }} />
        Tạo nhóm chat
      </button>

      {/* MODAL */}
      {open && (
        <div
          className="fixed inset-0 z-200 bg-black/80 flex items-center justify-center"
        >
          <div className="bg-[#212123] rounded-2xl w-[820px] max-w-[95vw] shadow-lg relative p-0">
            {/* HEADER */}
            <div className="rounded-t-2xl border-b border-[#35353C] flex items-center justify-between px-3 py-[9px] pl-6 font-extrabold text-[21px] tracking-tight text-white relative">
              <div>Tạo nhóm chat</div>
              <button
                onClick={handleClose}
                className="bg-[#35353C] border-none rounded-full p-[6px] cursor-pointer text-white transition-colors hover:bg-[#45454d]"
                title="Thoát"
                type="button"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* BODY */}
            <div className="px-6 pt-[22px] pb-[19px]">
              {/* Group Name */}
              <label className="block mb-2 text-[#CDCDCD] font-medium text-[15px]">
                Tên nhóm chat
              </label>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm..."
                className="px-3 py-2 rounded-md outline-none border border-[#35353C] bg-[#29292C] text-white w-full text-[15px] mb-4"
              />

              {/* Require Approval */}
              <div className="flex items-center mb-4">
                <label className="text-[#cdcdcd] font-medium text-[15px] flex items-center">
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={() => setRequireApproval(v => !v)}
                    className="mr-2 accent-[#1d8bf1]"
                  />
                  Cần duyệt tham gia
                </label>
                <div
                  className="ml-2 flex items-center relative"
                  onMouseEnter={() => setShowApprovalTooltip(true)}
                  onMouseLeave={() => setShowApprovalTooltip(false)}
                >
                  <span
                    className="border border-[#4E4E55] rounded-full w-[22px] h-[22px] flex items-center justify-center text-[#b3b3b4] text-[14px] bg-[#2B2B2E] cursor-pointer transition-colors"
                  >
                    <FontAwesomeIcon icon={faQuestion} />
                  </span>
                  {showApprovalTooltip && (
                    <div
                      className="absolute top-7 left-1/2 -translate-x-1/2 bg-[#232327] text-white border border-[#444] rounded-lg p-2 text-[13.2px] font-medium shadow-lg min-w-[270px] z-200 whitespace-normal"
                    >
                      Nếu bật thì người tham gia bằng link nhóm sẽ cần phải duyệt,<br /> còn người trong nhóm mời thì vẫn sẽ không cần.
                    </div>
                  )}
                </div>
              </div>

              {/* FRIENDS */}
              <div className="mb-[18px]">
                <label className="block text-[#CDCDCD] font-medium text-[15px] mb-2">
                  Bạn bè
                </label>
                <div className="mb-2 flex gap-1.5">
                  <input
                    type="text"
                    value={searchFriend}
                    onChange={e => setSearchFriend(e.target.value)}
                    placeholder="Tìm kiếm bạn bè..."
                    className="flex-1 px-3 py-2 rounded-md outline-none border border-[#35353C] bg-[#29292C] text-white text-[15px]"
                  />
                  {selectedFriends.length > 0 && (
                    <div className="self-center text-[13.8px] bg-[#185dc5] text-white rounded-lg px-[14px] py-1 font-semibold relative top-[1px]">
                      Đã chọn: {selectedFriends.length}
                    </div>
                  )}
                </div>
                <div
                  className="rounded-md bg-[#232326] border border-[#35353C] px-[2px] py-[3px] custom-scroll h-[260px] overflow-y-auto"
                >
                  {isLoadingFriendList ? (
                    <div className="text-[#aaa] p-5 text-center">Loading...</div>
                  ) : Array.isArray(friendList) && friendList.length === 0 ? (
                    <div className="text-[#aaa] p-5 text-center">Không tìm thấy bạn bè nào</div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="text-[#aaa] p-5 text-center">Không tìm thấy bạn bè nào</div>
                  ) : (
                    filteredFriends.map(f => (
                      <div
                        key={f.userId}
                        onClick={() => onFriendClick(f.userId)}
                        className={`flex items-center cursor-pointer px-2 py-[7px] rounded-lg mb-[3px] transition-colors ${
                          selectedFriends.includes(f.userId) ? "bg-[#1877F2]" : "bg-none"
                        }`}
                      >
                        <img
                          src={
                            f.avatar
                              ? f.avatar
                              : "https://ui-avatars.com/api/?name=" +
                                encodeURIComponent(f.name || "U") +
                                "&background=475569&color=fff&size=64"
                          }
                          alt={f.name}
                          className="w-8 h-8 rounded-full mr-2.5 border-[2.2px] border-[#38383A]"
                        />
                        <span
                          className={`text-[15.3px] tracking-tight ${
                            selectedFriends.includes(f.userId)
                              ? "text-white font-semibold"
                              : "text-[#dedede] font-medium"
                          }`}
                        >
                          {f.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AVATAR */}
              <div className="mb-[22px]">
                <span className="inline-block text-[#CDCDCD] font-medium text-[15px] mb-2">
                  Ảnh đại diện nhóm
                </span>
                <div className="mt-2">
                  {!croppedAvatarUrl && !cropping && (
                    <button
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className="py-2 px-5 bg-[#222226] text-[#1d8bf1] border border-[#1d8bf1] rounded-lg font-bold text-[15.2px] cursor-pointer transition-colors hover:bg-[#24242b]"
                      type="button"
                    >
                      Chọn ảnh
                    </button>
                  )}
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  {/* Crop */}
                  {cropping && avatarSrc && (
                    <div className="mt-3 relative" onWheel={handleCropperWheel}>
                      <div className="w-[210px] h-[210px] relative bg-[#141419] rounded-lg mx-auto overflow-hidden flex items-center justify-center">
                        <Cropper
                          image={avatarSrc}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="round"
                          showGrid={false}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={onCropComplete}
                        />
                      </div>
                      <div className="flex gap-2.5 justify-center mt-4">
                        <button
                          onClick={handleSaveCrop}
                          type="button"
                          className="py-2 px-5 bg-[#1877F2] text-white border-none rounded-lg font-bold text-[15.2px] cursor-pointer transition-colors hover:bg-[#037AE7]"
                        >
                          Lưu ảnh
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Show cropped avatar */}
                  {croppedAvatarUrl && !cropping && (
                    <div className="mt-4 text-center">
                      <div
                        className={`inline-block relative w-[106px] h-[106px] rounded-full overflow-hidden cursor-pointer`}
                        onMouseEnter={() => setHoverAvatar(true)}
                        onMouseLeave={() => setHoverAvatar(false)}
                        onClick={handleAvatarEdit}
                        title="Sửa lại avatar"
                      >
                        <img
                          src={croppedAvatarUrl}
                          alt="Avatar"
                          className={`w-[106px] h-[106px] rounded-full transition-[filter] duration-150 ${
                            hoverAvatar ? "brightness-50" : ""
                          }`}
                        />
                        {hoverAvatar && (
                          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-[15.2px] pointer-events-none bg-none py-2 px-4 rounded-lg">
                            Sửa
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirm button */}
              <button
                className={`bg-[#1d8bf1] text-white border-none py-[10px] font-extrabold text-[16px] w-full rounded-xl mt-0.5 transition-colors hover:bg-[#037AE7] cursor-pointer flex items-center justify-center`}
                onClick={handleConfirm}
                type="button"
                disabled={isCreatingGroup}
              >
                {isCreatingGroup ? (
                  // Simple loading spinner (TailwindCSS or minimal inline CSS)
                  <>
                    <svg
                      className="animate-spin mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                    Đang tạo...
                  </>
                ) : (
                  "Xác nhận"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateGroupButton;
