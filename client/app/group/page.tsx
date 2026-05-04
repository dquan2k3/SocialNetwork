"use client";
import React, { useState, useRef, useEffect, Suspense } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquarePlus, faCrown } from "@fortawesome/free-solid-svg-icons";
import { getMyGroups } from "@/api/group.api";
// Đặt useSearchParams vào trong một component được suspend
import { useSearchParams } from "next/navigation";
import GroupPost from "@/components/ui/GroupPost";
import UpdateCoverPopup from "./component/updateCover";
import CreateGroupModal from "./component/createGroup";
import GroupSettingTab from "./component/setting";
import GroupMediaTab from "./component/media";
import GroupMemberTab from "./component/member";
import JoinGroupButton from "./component/joinGroup";

const GROUP_TABS = [
    { key: "all", label: "Bài viết" },
    { key: "setting", label: "Thông tin nhóm" },
    { key: "members", label: "Thành viên" },
    { key: "media", label: "Ảnh & Video" },
];

function GroupCircleCover({
    src,
    size,
    className,
}: {
    src?: string;
    size?: number;
    className?: string;
}) {
    if (!src) {
        return (
            <div
                className={`flex items-center justify-center bg-[#232425] text-[#b0b3b8] ${className || "rounded-full"}`}
                style={{
                    width: size || 40,
                    height: size || 40,
                    borderRadius: "50%",
                    fontSize: (size || 40) * 0.35,
                    fontWeight: 500,
                }}
            >

            </div>
        );
    }
    return (
        <img
            src={src}
            alt="cover"
            width={size || 40}
            height={size || 40}
            className={className || "rounded-full"}
            style={{
                objectFit: "cover",
                width: size || 40,
                height: size || 40,
                borderRadius: "50%",
            }}
        />
    );
}

// Change starts here: enable horizontal scroll for tabs under 880px
function GroupTabMenu({
    tab,
    setTab,
}: {
    tab: string;
    setTab: (key: string) => void;
}) {
    return (
        <div
            className="flex w-full items-center px-8 mt-2 z-30"
            style={{
                backgroundColor: "#000000",
                marginTop: "-1rem",
                position: "sticky",
                top: "0",
            }}
        >
            <div
                className="flex w-full justify-between items-center border-b border-[#232425]"
                style={{
                    overflowX: "auto",
                    scrollbarWidth: "none",
                }}
            >
                <div
                    className="flex gap-2 w-full pt-4"
                    style={{
                        minWidth: 0,
                        overflowX: "auto",
                        scrollbarWidth: "none",
                    }}
                >
                    {/* CSS below allows horizontal scroll below 880px */}
                    <style>
                        {`
                        @media (max-width: 880px) {
                          .group-tabs-scroll {
                            overflow-x: auto !important;
                            -webkit-overflow-scrolling: touch;
                            flex-wrap: nowrap !important;
                          }
                          .group-tabs-scroll::-webkit-scrollbar {
                            display: none;
                          }
                          .group-tabs-button {
                            min-width: 120px;
                            flex-shrink: 0;
                          }
                        }
                        `}
                    </style>
                    <div className="flex gap-2 w-full pt-4 group-tabs-scroll" style={{ minWidth: 0 }}>
                        {GROUP_TABS.map(tabItem => (
                            <button
                                key={tabItem.key}
                                className={`
                                group flex items-center justify-center cursor-pointer hover:bg-[#1d1d1d]! px-0 relative transition
                                ${tab === tabItem.key ? "font-semibold text-[#3479EF]" : "text-[#b0b3b8] hover:text-white"}
                                rounded-lg
                                group-tabs-button
                                `}
                                style={{ fontSize: "16px", padding: "0 4px", height: "48px", border: "none", background: "none", minWidth: 120 }}
                                onClick={() => setTab(tabItem.key)}
                            >
                                {tab === tabItem.key && (
                                    <span
                                        className="absolute left-0 bottom-0 h-1 w-full rounded-b-full bg-[#3479EF]"
                                        style={{ bottom: "0px" }}
                                    ></span>
                                )}
                                <span className="relative px-4 py-2 w-full flex justify-center z-10">
                                    {tabItem.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getPrivacyLabel(privacy?: string) {
    if (!privacy) return "";
    switch (privacy) {
        case "public":
            return "công khai";
        case "private":
            return "riêng tư";
        case "secret":
            return "bí mật";
        default:
            return privacy;
    }
}

// SuspendedSearchParamsWrapper wraps the code using useSearchParams in <Suspense>
function SuspendedSearchParamsWrapper({ children }: { children: (searchParams: ReturnType<typeof useSearchParams>) => React.ReactNode }) {
    const searchParams = useSearchParams();
    return <>{children(searchParams)}</>;
}

export default function GroupPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <GroupPageInner />
        </Suspense>
    );
}

// Phần code còn lại chuyển sang GroupPageInner, gọi useSearchParams ở đây trong khối được suspend
function GroupPageInner() {
    const searchParams = useSearchParams();
    const groupParamId = searchParams.get("groupId");
    const [groups, setGroups] = useState<any[]>([]);
    const [loadingGroups, setLoadingGroups] = useState<boolean>(true);
    const [groupStatus, setGroupStatus] = useState<any>(undefined);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [tab, setTab] = useState<string>("all");
    const [search, setSearch] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
    const [showAlterCover, setShowAlterCover] = useState<boolean>(false);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                setLoadingGroups(true);
                const data = await getMyGroups(groupParamId ? { groupId: groupParamId } : undefined);
                if (data && Array.isArray(data.groups)) {
                    console.warn(data)
                    setGroups(data.groups);
                    let realStatus: any = undefined;
                    if (groupParamId) {
                        const matchedGroup = data.groups.find((g: any) => g._id === groupParamId);
                        if (matchedGroup && typeof matchedGroup.status !== "undefined") {
                            realStatus = matchedGroup.status;
                        } else if ("status" in data && typeof data.status !== "undefined") {
                            realStatus = data.status;
                        }
                    }
                    setGroupStatus(realStatus);
                    if (data.groups.length > 0) {
                        if (groupParamId && data.groups.find((g: any) => g._id === groupParamId)) {
                            setSelectedGroupId(groupParamId);
                        } else {
                            setSelectedGroupId(data.groups[0]._id);
                        }
                    }
                } else {
                    setGroups([]);
                    setGroupStatus(undefined);
                }
            } catch (error) {
                console.error("Lỗi khi gọi getMyGroups:", error);
                setGroupStatus(undefined);
            } finally {
                setLoadingGroups(false);
            }
        };
        fetchGroups();
    }, [groupParamId]);

    const filteredGroupsRaw = search.trim()
        ? groups.filter(
            g => g.name?.toLowerCase().includes(search.trim().toLowerCase())
        )
        : groups;

    let filteredGroups: any[] = [];
    if (groupParamId && filteredGroupsRaw.some(g => g._id === groupParamId)) {
        const topGroup = filteredGroupsRaw.find(g => g._id === groupParamId);
        const restGroups = filteredGroupsRaw.filter(g => g._id !== groupParamId);
        filteredGroups = [topGroup, ...restGroups];
    } else {
        filteredGroups = filteredGroupsRaw;
    }

    useEffect(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [search]);

    useEffect(() => {
        if (debouncedSearch !== "") {
            console.log("Tìm kiếm nhóm theo:", debouncedSearch);
        }
    }, [debouncedSearch]);

    // Khi chuyển group thì sẽ quay sang trang post
    useEffect(() => {
        // Khi selectedGroupId thay đổi, chuyển tab về "all"
        setTab("all");
    }, [selectedGroupId]);

    const selectedGroup = groups.find(g => g._id === selectedGroupId);

    const handleCoverChange = (groupId: string, newCover: string, newName?: string) => {
        setGroups(prevGroups =>
            prevGroups.map(group =>
                group._id === groupId
                    ? { ...group, cover: newCover, ...(newName !== undefined ? { name: newName } : {}) }
                    : group
            )
        );
    };

    const handlePrivacyChange = (groupId: string, privacy: string) => {
        setGroups(prevGroups =>
            prevGroups.map(group =>
                group._id === groupId
                    ? { ...group, privacy }
                    : group
            )
        );
    };

    const handleStatusChange = (groupId: string, status: any) => {
        setGroups(prevGroups =>
            prevGroups.map(group =>
                group._id === groupId ? { ...group, status } : group
            )
        );
        if (groupId === groupParamId) {
            setGroupStatus(status);
        }
    };

    // === Thêm hàm để đổi số lượng thành viên ===
    const handleMemberCountChange = (groupId: string, newCount: number) => {
        setGroups(prevGroups =>
            prevGroups.map(group =>
                group._id === groupId ? { ...group, memberCount: newCount } : group
            )
        );
    };

    let content = null;
    if (tab === "all") {
        // Sử dụng GroupPost và truyền groupId vào (sửa tại đây)
        content = selectedGroupId && <GroupPost groupId={selectedGroupId} />;
    } else if (tab === "setting") {
        content = (
            <GroupSettingTab
                groupId={selectedGroup?._id}
                isOwner={selectedGroup?.isOwner}
                onPrivacyChange={handlePrivacyChange}
            />
        );
    } else if (tab === "members") {
        // TRUYỀN groupId vào GroupMemberTab và truyền thêm isOwner
        // THÊM onChangeMemberCount
        content = (
            <GroupMemberTab
                groupId={selectedGroup?._id}
                isOwner={selectedGroup?.isOwner}
                memberCount={getMemberCount(selectedGroup)}
                onChangeMember={(newCount: number) => {
                    console.log(newCount)
                    if (selectedGroup?._id) {
                        handleMemberCountChange(selectedGroup._id, newCount);
                    }
                }}
            />
        );
    } else if (tab === "media") {
        content = <GroupMediaTab groupId={selectedGroup?._id} />;
    }

    const COVER_DEFAULT_HEIGHT = "h-[28rem]";
    const COVER_MD_HEIGHT = "md:h-[36rem]";

    function CoverImageOrPlaceholder({ cover, className }: { cover?: string; className?: string }) {
        if (!cover) {
            return (
                <div
                    className={`flex items-center justify-center bg-[#232425] text-[#b0b3b8] ${className || ""} ${COVER_DEFAULT_HEIGHT} ${COVER_MD_HEIGHT} rounded-b-[18px] shadow-[0_4px_24px_0_rgba(0,0,0,0.16)]`}
                    style={{
                        width: "100%",
                        fontSize: 24,
                        fontWeight: 500,
                        textAlign: "center",
                        minHeight: 120,
                    }}
                >
                </div>
            );
        }
        return (
            <img
                src={cover}
                alt="cover"
                className={`w-full ${COVER_DEFAULT_HEIGHT} ${COVER_MD_HEIGHT} object-cover object-center rounded-b-[18px] shadow-[0_4px_24px_0_rgba(0,0,0,0.16)] ${className || ""}`}
                style={{ display: "block" }}
            />
        );
    }

    // Đã có memberCount, không dùng fake "123" thành viên nữa:
    function getMemberCount(group: any) {
        if (typeof group?.memberCount === "number") return group.memberCount;
        // Fallback: Nếu không có memberCount, trả về 0
        return 0;
    }

    // Lấy chiều rộng động tương ứng với phần nội dung được scroll, không ép cover và info nhóm có w-full nhỏ (w-full sẽ nhỏ lại theo màn, gây "tràn đen")
    // Áp dụng minWidth tương ứng cho khối cover+name+info, match với scroll width vùng tab nội dung.
    // Mặc định scroll vùng content nhóm sẽ minWidth 600px cứng, nên dùng luôn
    // => nếu vùng scroll ngang rộng hơn màn hình, cover và tên nhóm sẽ theo chiều ngang đó

    // Đặt 2 giá trị này đồng nhất với thân nội dung, cập nhật lại bên dưới nếu bạn thay đổi minWidth của tab nội dung.
    const GROUP_CONTENT_MIN_WIDTH = 600;

    return (
        <>
            <CreateGroupModal
                open={showCreateGroupModal}
                onClose={() => setShowCreateGroupModal(false)}
                onSuccess={() => setShowCreateGroupModal(false)}
            />
            {selectedGroup && (
                <UpdateCoverPopup
                    groupId={selectedGroup._id}
                    initialName={selectedGroup.name}
                    open={showAlterCover}
                    onClose={() => setShowAlterCover(false)}
                    onCoverChange={({ groupId, newCover, newName }) => {
                        handleCoverChange(groupId, newCover, newName);
                    }}
                />
            )}
            <div
                className="flex w-full min-h-full h-full flex-1"
                style={{ backgroundColor: "#000000" }}
            >
                <aside
                    className="w-72 pr-4 pt-5 pl-3 border-r border-[#232425] h-full sticky top-0 flex flex-col self-start"
                    style={{ backgroundColor: "#000000" }}
                >
                    <div className="mb-8 flex flex-col flex-1 h-full">
                        <div className="flex items-center justify-between px-2 mb-4">
                            <div className="font-bold text-xl text-white">Nhóm của bạn</div>
                            <button
                                className="flex items-center gap-[6px] bg-[#3479EF] text-white hover:bg-[#225ac7] font-semibold text-base px-3 py-2 rounded transition"
                                onClick={() => setShowCreateGroupModal(true)}
                            >
                                <FontAwesomeIcon icon={faSquarePlus} className="w-5 h-5" />
                                <span className="whitespace-nowrap">Tạo nhóm</span>
                            </button>
                        </div>
                        <div className="mb-4 px-2">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm kiếm nhóm..."
                                className="w-full py-2 px-3 rounded-lg"
                                style={{
                                    fontSize: 15,
                                    backgroundColor: "#161616",
                                    border: "1px solid #323334",
                                    color: "#fff",
                                }}
                            />
                        </div>
                        <div
                            className="flex flex-col gap-2 flex-1 custom-scroll"
                            style={{
                                maxHeight: "100%",
                                overflowY: "auto",
                                paddingRight: "4px",
                            }}
                        >
                            {loadingGroups ? (
                                <div className="text-[#b0b3b8] text-center pt-6">Đang tải danh sách nhóm...</div>
                            ) : (
                                filteredGroups.map(group => {
                                    let btnBg = "";
                                    let txtColor = "";
                                    let fontWeight = "font-medium";
                                    let hoverStyle = "";
                                    let underline = "";

                                    if (group._id === groupParamId && group._id === selectedGroupId) {
                                        btnBg = "bg-[#3479EF]";
                                        txtColor = "text-white";
                                        fontWeight = "font-bold";
                                        hoverStyle = "";
                                        underline = "";
                                    } else if (group._id === selectedGroupId) {
                                        btnBg = "bg-[#3479EF]";
                                        txtColor = "text-white";
                                        fontWeight = "font-medium";
                                        hoverStyle = "";
                                        underline = "";
                                    } else if (group._id === groupParamId) {
                                        btnBg = "bg-[#5996c9]";
                                        txtColor = "text-white";
                                        fontWeight = "font-bold";
                                        hoverStyle = "";
                                        underline = "";
                                    } else {
                                        btnBg = "bg-[#16191C]";
                                        txtColor = "text-[#b0b3b8]";
                                        fontWeight = "font-medium";
                                        hoverStyle = "hover:bg-[#222] hover:text-white";
                                        underline = "";
                                    }
                                    return (
                                        <button
                                            key={group._id}
                                            className={[
                                                "flex items-center gap-3 w-full px-3 py-3 rounded-xl cursor-pointer",
                                                btnBg,
                                                txtColor,
                                                fontWeight,
                                                hoverStyle,
                                                "transition",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => {
                                                setSelectedGroupId(group._id);
                                            }}
                                            style={
                                                (group._id === groupParamId || group._id === selectedGroupId)
                                                    ? undefined
                                                    : { backgroundColor: "#16191C" }
                                            }
                                        >
                                            <GroupCircleCover
                                                src={group.cover}
                                                size={40}
                                            />
                                            <span className="flex items-center gap-1">
                                                {group.isOwner === 1 && (
                                                    <FontAwesomeIcon icon={faCrown} className="text-yellow-400 mr-1" />
                                                )}
                                                <span
                                                    className={[
                                                        group._id === groupParamId ? "font-bold" : "",
                                                        underline,
                                                    ].filter(Boolean).join(" ")}
                                                >
                                                    {group.name.length > 30
                                                        ? group.name.slice(0, 30) + "..."
                                                        : group.name}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                            {!loadingGroups && filteredGroups.length === 0 && (
                                <div className="text-[#b0b3b8] text-center pt-6">
                                    Không tìm thấy nhóm nào.
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
                <main
                    className="flex-1 flex flex-col min-h-full overflow-hidden"
                    style={{ backgroundColor: "#000000" }}
                >
                    <div
                        className="flex-1 flex flex-col overflow-y-auto custom-scroll"
                        style={{ backgroundColor: "#000000" }}
                    >
                        {/* Scroll area starts here */}
                        {/* Wrapper "scroll-x" dưới đây cho phép khi thu nhỏ màn, cả block cover, name và tab sẽ scroll ngang cùng nhau */}
                        <div
                            className="overflow-x-auto custom-scroll"
                            style={{
                                WebkitOverflowScrolling: "touch",
                                scrollbarWidth: "auto",
                                background: "#000000",
                            }}
                        >
                            <div
                                className="w-full"
                                style={{
                                    minWidth: GROUP_CONTENT_MIN_WIDTH,
                                    // vẫn w-full để các block con có thể dùng mx-auto căn giữa
                                }}
                            >
                                {selectedGroup && (
                                    <div className="relative group/cover-selectable" style={{
                                        minWidth: GROUP_CONTENT_MIN_WIDTH,
                                        // vẫn giữ w-full ở đây, không dùng fit-content, để block cover có thể căn giữa hoặc full theo ý muốn
                                        width: "100%"
                                    }}>
                                        {selectedGroup.isOwner === 1 ? (
                                            <button
                                                type="button"
                                                className="relative group z-0 p-0 border-none outline-none bg-transparent"
                                                style={{
                                                    cursor: "pointer",
                                                    width: "100%"
                                                }}
                                                onClick={() => setShowAlterCover(true)}
                                            >
                                                <CoverImageOrPlaceholder cover={selectedGroup.cover}
                                                    className={""}
                                                />
                                                <div
                                                    className="absolute inset-0 rounded-b-[18px] pointer-events-none transition bg-black/0 group-hover:bg-black/40"
                                                    style={{ zIndex: 2 }}
                                                />
                                                <div
                                                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition font-semibold text-white opacity-0 group-hover:opacity-100 select-none"
                                                    style={{ zIndex: 3, fontSize: 19, letterSpacing: 0.5, textShadow: "0 1px 8px rgba(0,0,0,0.44)" }}
                                                >
                                                    Thay đổi thông tin nhóm
                                                </div>
                                            </button>
                                        ) : (
                                            <CoverImageOrPlaceholder cover={selectedGroup.cover}
                                                className={""}
                                            />
                                        )}
                                    </div>
                                )}

                                {selectedGroup && (
                                    <div
                                        className="flex flex-row items-center justify-between px-8 pt-5 pb-3"
                                        style={{
                                            background: "#000000",
                                            minWidth: GROUP_CONTENT_MIN_WIDTH,
                                            width: "100%",
                                        }}
                                    >
                                        <div className="flex flex-col">
                                            <div className="text-2xl md:text-3xl font-bold text-white drop-shadow flex items-center gap-2">
                                                {selectedGroup.name}
                                            </div>
                                            <div className="text-sm text-[#b0b3b8] drop-shadow">
                                                {`Nhóm${selectedGroup.privacy ? ` ${getPrivacyLabel(selectedGroup.privacy)}` : ""} • ${getMemberCount(selectedGroup)} thành viên`}
                                            </div>
                                        </div>

                                        <JoinGroupButton
                                            groupId={selectedGroup._id}
                                            name={selectedGroup.name}
                                            status={selectedGroup.status}
                                            onStatusChange={handleStatusChange}
                                        />

                                    </div>
                                )}

                                <div
                                    className="w-full"
                                    style={{
                                        minWidth: GROUP_CONTENT_MIN_WIDTH,
                                        // giữ w-full để các content bên trong (tab + content) có thể dùng mx-auto căn giữa
                                    }}
                                >
                                    <div className="sticky top-0 z-20 bg-black min-w-fit">
                                        <GroupTabMenu tab={tab} setTab={setTab} />
                                    </div>
                                    <div
                                        className="flex-1 py-6 flex items-center flex-col gap-6 w-full mx-auto min-h-0"
                                        style={{ minWidth: `${GROUP_CONTENT_MIN_WIDTH}px` }}
                                    >
                                        {content}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Scroll area ends here */}
                    </div>
                </main>
            </div>
        </>
    );
}
