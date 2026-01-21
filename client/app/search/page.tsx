"use client";
import React, { useState, useEffect } from "react";
// api imports and filters removed (all handled in tabs)
import { useSelector } from "react-redux";
import { useSearchParams } from "next/navigation";
import UserTab from "./tabs/user";
import PostTab from "./tabs/post";
import GroupTab from "./tabs/group";

export default function SearchPage() {
    const reduxUser = useSelector((state: any) => state.user);
    const myId = reduxUser.userId;
    const searchParams = useSearchParams();

    // Biến chứa key và idtab, có thể thay đổi
    const [searchParamsState, setSearchParamsState] = useState({
        key: searchParams.get("key") || "",
        idtab: searchParams.get("id") || "",
    });

    useEffect(() => {
        setSearchParamsState({
            key: searchParams.get("key") || "",
            idtab: searchParams.get("id") || "",
        });
    }, [searchParams]);

    // Hàm chỉ thay đổi key
    const onSearchChange = (newKey: string) => {
        setSearchParamsState(prev => ({
            ...prev,
            key: newKey
        }));
    };

    // Tab state
    const [tab, setTab] = useState<"users" | "posts" | "groups">("users");
    // Window width state for responsive sidebar
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1024
    );

    // Sync từ URL params nếu cần (giữ nguyên placeholder)
    useEffect(() => {
        function handleResize() {
            setWindowWidth(window.innerWidth);
        }
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Sidebar tab rendering and tab switch logic are kept here.
    const renderSidebarTabs = () => (
        windowWidth < 640 ? (
            <aside
                className="w-full bg-[#252728] flex flex-row px-2 gap-3 border-b border-gray-800 sticky top-0 h-[64px] self-start z-30 items-center"
                style={{
                    minHeight: 64,
                    background: "#252728",
                    position: "sticky",
                    top: 0,
                    zIndex: 30
                }}
            >
                <span className="text-white font-semibold text-lg pl-2 flex-shrink-0">
                    Kết quả tìm kiếm
                </span>
                <button
                    className={`flex-1 py-2 px-0 text-white text-center font-semibold rounded-lg transition-colors mt-0
                    ${tab === "users" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer mx-1`}
                    onClick={() => setTab("users")}
                    style={{ transition: "background-color 0.15s" }}
                >
                    Mọi người
                </button>
                <button
                    className={`flex-1 py-2 px-0 text-white text-center font-semibold rounded-lg transition-colors mt-0
                    ${tab === "posts" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer mx-1`}
                    onClick={() => setTab("posts")}
                    style={{ transition: "background-color 0.15s" }}
                >
                    Bài viết
                </button>
                <button
                    className={`flex-1 py-2 px-0 text-white text-center font-semibold rounded-lg transition-colors mt-0
                    ${tab === "groups" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer mx-1`}
                    onClick={() => setTab("groups")}
                    style={{ transition: "background-color 0.15s" }}
                >
                    Nhóm
                </button>
            </aside>
        ) : (
            <aside
                className="w-[300px] bg-[#252728] flex flex-col px-4 gap-3 border-r border-gray-800 sticky top-0 h-[calc(100vh-64px)] self-start"
            >
                <span className="py-6 text-white font-semibold text-2xl">
                    Kết quả tìm kiếm
                </span>
                <button
                    className={`py-4 px-2 text-white text-center font-semibold rounded-lg transition-colors
                    ${tab === "users" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer
                    `}
                    onClick={() => setTab("users")}
                    style={{
                        transition: "background-color 0.15s",
                    }}
                >
                    Mọi người
                </button>
                <button
                    className={`py-4 px-2 text-white text-center font-semibold rounded-lg transition-colors
                    ${tab === "posts" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer
                    `}
                    onClick={() => setTab("posts")}
                    style={{
                        transition: "background-color 0.15s",
                    }}
                >
                    Bài viết
                </button>
                <button
                    className={`py-4 px-2 text-white text-center font-semibold rounded-lg transition-colors
                    ${tab === "groups" ? "bg-[#3B3D3E]" : "hover:bg-[#232324]"}
                    cursor-pointer
                    `}
                    onClick={() => setTab("groups")}
                    style={{
                        transition: "background-color 0.15s",
                    }}
                >
                    Nhóm
                </button>
            </aside>
        )
    );

    // Main
    return (
        <div className="bg-[#1C1C1D] w-full flex-1 min-h-full">
            <div className={`w-full text-white flex-grow ${windowWidth < 640 ? "flex flex-col" : "flex"}`}>
                {renderSidebarTabs()}
                <main className="flex-1 flex justify-center">
                    <div
                        className="w-full max-w-[800px] flex flex-col flex-grow items-center"
                        style={{ flexBasis: "66.666667%" }}
                    >
                        {/* Render tab content by tab */}
                        {tab === "users" && (
                            <UserTab
                                keyParam={searchParamsState.key}
                                idtab={searchParamsState.idtab}
                                onSearchChange={onSearchChange}
                            />
                        )}
                        {tab === "posts" && (
                            <PostTab
                                keyParam={searchParamsState.key}
                                idtab={searchParamsState.idtab}
                                onSearchChange={onSearchChange}
                            />
                        )}
                        {tab === "groups" && (
                            <GroupTab
                                keyParam={searchParamsState.key}
                                idtab={searchParamsState.idtab}
                                onSearchChange={onSearchChange}
                            />
                        )}
                    </div>
                </main>
                {windowWidth < 640 ? null : (
                    <aside
                        className="w-48 bg-[#1C1C1D] flex flex-col items-stretch px-0 sticky"
                        style={{
                            right: 0,
                            zIndex: 20,
                            top: "64px",
                            height: "calc(100vh - 64px)",
                            alignSelf: "flex-start"
                        }}
                    >
                        {/* Empty for balancing layout */}
                    </aside>
                )}
            </div>
        </div>
    );
}
