"use client";
import React, { useState } from "react";
import Dashboard from "./tabs/Dashboard";
import UserManagement from "./tabs/UserManagement";
import ReportManagement from "./tabs/ReportManagement";

const Admin = () => {
    const [activeTab, setActiveTab] = useState("dashboard");

    const tabList = [
        { key: "dashboard", label: "Dashboard" },
        { key: "users", label: "Quản lý người dùng" },
        { key: "reports", label: "Quản lý báo cáo" },
    ];

    // Hàm chuyển tab, cho phép truyền xuống các tab con nếu muốn
    const handleChangeTab = (tabKey: string) => {
        setActiveTab(tabKey);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "dashboard":
                return <Dashboard onChangeTab={handleChangeTab} />;
            case "users":
                return <UserManagement />;
            case "reports":
                return <ReportManagement />;
            default:
                return null;
        }
    };

    return (
        <div className="h-full w-screen flex flex-col">
            {/* Tăng max-w để trang dài hơn theo chiều ngang */}
            <div className="flex-1 bg-[#232324] p-8">
                <div className="max-w-5xl mx-auto bg-[#1c1c1d] rounded-lg shadow p-8">
                    <div className="flex space-x-6 border-b border-[#353535] mb-6">
                        {tabList.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => handleChangeTab(tab.key)}
                                className={`
                                    py-2 px-5 text-base font-semibold border-b-2 transition
                                    ${activeTab === tab.key
                                        ? "border-blue-500 text-blue-400"
                                        : "border-transparent text-gray-400 hover:text-white"}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="py-2 px-2">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Admin;