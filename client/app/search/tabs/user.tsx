"use client";
import React, { useState, useEffect } from "react";
import { apiGetRandomUser, apiSearchUser } from "@/api/search.api";
import RelationshipButton from "@/components/ui/RelationshipButton";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";

// Nhận props từ cha: keyParam, idtab, onSearchChange
interface UserTabProps {
    keyParam: string;
    idtab: any;
    onSearchChange: (newKey: string) => void;
}

const ageOptions = [
    { label: "Tất cả", value: "" },
    { label: "18-24", value: "18-24" },
    { label: "25-30", value: "25-30" },
    { label: "31-40", value: "31-40" },
];

function getAgeFromBirthday(birthday: string) {
    if (!birthday) return "";
    const birth = new Date(birthday);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function isAgeInRange(birthday: string, range: string) {
    if (!range) return true;
    const age = getAgeFromBirthday(birthday);
    if (!age) return false;
    switch (range) {
        case "18-24":
            return age >= 18 && age <= 24;
        case "25-30":
            return age >= 25 && age <= 30;
        case "31-40":
            return age >= 31 && age <= 40;
        default:
            return true;
    }
}

function UserCard({ user, myId }: { user: any, myId: any }) {
    const [relButtonBelow, setRelButtonBelow] = useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        function checkCardWidth() {
            if (cardRef.current) {
                setRelButtonBelow(cardRef.current.offsetWidth < 640);
            }
        }
        checkCardWidth();

        window.addEventListener("resize", checkCardWidth);
        return () => {
            window.removeEventListener("resize", checkCardWidth);
        };
    }, []);

    const displayUsername = user.username || "";
    const displayName = user.name || "Chưa đặt tên";
    const displayAvatar =
        user.bio && typeof user.bio === "object" && user.bio.avatar
            ? user.bio.avatar
            : user.avatar ||
                "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.name || "U");
    const displayAvatarCroppedArea =
        user.bio && typeof user.bio === "object" && user.bio.avatarCroppedArea
            ? user.bio.avatarCroppedArea
            : undefined;

    const relationship = user.relationship;

    // click vào user card thì router đến profile/userId
    const handleCardClick = (e: React.MouseEvent) => {
        // Nếu click vào RelationshipButton, không navigate
        // Dùng event delegation để kiểm tra nếu click nằm ngoài RelationshipButton
        if (
            (e.target as HTMLElement).closest(".relationship-button-root")
        ) {
            return;
        }
        if (user.user) {
            router.push(`/profile/${user.user}`);
        }
    };

    return (
        <div
            ref={cardRef}
            key={user.user || user.username}
            className={`p-4 rounded-xl border border-[#333334] w-full shadow-sm flex ${relButtonBelow ? "flex-col" : "flex-row"} justify-between items-stretch ${relButtonBelow ? "" : "items-center"} cursor-pointer hover:bg-[#232527] transition-colors`}
            style={{
                background: "#252728",
                color: "#fff"
            }}
            onClick={handleCardClick}
        >
            <div className="flex flex-row items-center gap-4 bg-[#252728] p-2 rounded-xl flex-1">
                <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                    <h3 className="font-semibold text-white">{displayName}</h3>
                    <p className="text-sm text-gray-300">
                        {displayUsername ? `@${displayUsername}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">
                        Tuổi: {getAgeFromBirthday(user.birthday) || "?"} | Địa chỉ:{" "}
                        {user.hometown || "?"}
                    </p>
                    {user.bio && typeof user.bio === "string" && (
                        <p className="text-xs text-gray-400 mt-1">{user.bio}</p>
                    )}
                </div>
            </div>
            {/* RelationshipButton: right on desktop, below on mobile or if card width < 640px */}
            <div className={`flex flex-col gap-2 ${relButtonBelow ? "items-end mt-4" : "sm:mt-0 sm:items-end"} relationship-button-root`}>
                <RelationshipButton
                    relationship={relationship}
                    myId={myId}
                    userId={user.user}
                    name={displayName}
                    avatar={displayAvatar}
                    avatarCroppedArea={displayAvatarCroppedArea}
                    username={displayUsername}
                />
            </div>
        </div>
    );
}

const UserTab: React.FC<UserTabProps> = ({ keyParam, idtab, onSearchChange }) => {
    const reduxUser = useSelector((state: any) => state.user);
    const myId = reduxUser.userId;

    // search khởi tạo là keyParam
    const [search, setSearch] = useState<string>(keyParam || "");
    const [ageFilter, setAgeFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorUsers, setErrorUsers] = useState<string | null>(null);
    const [showEmptyKeyError, setShowEmptyKeyError] = useState(false);

    // NEW: Tỉnh thành lấy từ API (chỉ dùng name)
    const [provinceOptions, setProvinceOptions] = useState<Array<{ label: string, value: string }>>([
        { label: "Tất cả", value: "" },
    ]);

    // FETCH API: fetch provinces (depth=2) and set options for location filter
    useEffect(() => {
        fetch("https://provinces.open-api.vn/api/v1/?depth=2")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const provinces = [
                        { label: "Tất cả", value: "" },
                        ...data.map((p: any) => ({
                            label: p.name,
                            value: p.name
                        }))
                    ];
                    setProvinceOptions(provinces);
                }
            })
            .catch((err) => {
                console.log("Error fetching provinces:", err);
                // fallback in error (still provide 'Tất cả')
                setProvinceOptions([{ label: "Tất cả", value: "" }]);
            });
    }, []);

    // Khi tab id thay đổi => search lại theo keyParam truyền vào prop
    useEffect(() => {
        console.log(keyParam, idtab)
        if (keyParam && keyParam.trim() !== "") {
            setSearch(keyParam); // state search cũng thay đổi cho input
            fetchSearchByKey(keyParam);
        } else {
            setSearch(""); // state search cũng thay đổi cho input
            setLoading(true);
            setErrorUsers(null);
            apiGetRandomUser()
                .then((res) => {
                    if (Array.isArray(res)) {
                        setUsers(res);
                    } else if (res && Array.isArray(res.users)) {
                        setUsers(res.users);
                    } else {
                        setUsers([]);
                    }
                })
                .catch(() => setUsers([]))
                .finally(() => setLoading(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idtab]);

    // Tách logic fetch search theo key truyền vào
    const fetchSearchByKey = async (key: string) => {
        if (!key || key.trim() === "") {
            setShowEmptyKeyError(true);
            setUsers([]);
            return;
        }
        setLoading(true);
        setErrorUsers(null);
        setShowEmptyKeyError(false);
        try {
            // Prepare filter object
            const filter: any = {};
            if (ageFilter) {
                filter.age = ageFilter;
            }
            if (locationFilter) {
                filter.hometown = locationFilter;
            }
            const res = await apiSearchUser({
                key: key.trim(),
                filter
            });
            if (Array.isArray(res)) {
                setUsers(res);
            } else if (res && Array.isArray(res.users)) {
                setUsers(res.users);
            } else {
                setUsers([]);
            }
        } catch (e: any) {
            setErrorUsers("Lỗi khi tìm kiếm người dùng!");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Khi nhấn nút tìm kiếm
    const handleSearchButtonClick = () => {
        fetchSearchByKey(search);
    };

    // Khi thay đổi ký tự ô tìm kiếm
    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearch(newValue);
        if (showEmptyKeyError && newValue.trim()) setShowEmptyKeyError(false);
        onSearchChange(newValue);
    };

    // Khi thay đổi filter, KHÔNG tự động search lại, chỉ thay đổi filter state
    // Người dùng phải bấm nút tìm kiếm để fetch lại với filter mới (nếu muốn)
    const handleAgeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setAgeFilter(e.target.value);
        // Không gọi fetchSearchByKey
    }

    const handleLocationFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLocationFilter(e.target.value);
        // Không gọi fetchSearchByKey
    }

    // Enter: giống nhấn nút
    const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setShowEmptyKeyError(false);
            if (search.trim() === "") {
                setShowEmptyKeyError(true);
                return;
            }
            handleSearchButtonClick();
        }
    };

    // Đặt lại các filter và trả về random user, đồng thời clear search
    const handleResetFilters = () => {
        setSearch("");
        setAgeFilter("");
        setLocationFilter("");
        setShowEmptyKeyError(false);
        setErrorUsers(null);
        onSearchChange(""); // update lên cha
        setLoading(true);
        apiGetRandomUser()
            .then((res) => {
                if (Array.isArray(res)) {
                    setUsers(res);
                } else if (res && Array.isArray(res.users)) {
                    setUsers(res.users);
                } else {
                    setUsers([]);
                }
            })
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
    };

    // Filter chỉ áp dụng trên danh sách đã fetch (users), KHÔNG fetch lại khi đổi filter
    const filteredUsers = users.filter((user) => {
        // Filter by age
        if (ageFilter && !isAgeInRange(user.birthday, ageFilter)) {
            return false;
        }
        // Filter by location
        if (
            locationFilter &&
            (!user.hometown ||
                (user.hometown && user.hometown !== locationFilter))
        ) {
            return false;
        }
        return true;
    });

    return (
        <div className="w-full flex flex-col flex-grow items-center">
            {/* Search + filters */}
            <div
                className="flex flex-wrap items-center sticky top-0 justify-between mb-6 gap-4 w-full z-5"
                style={{
                    background: "#1C1C1D",
                    paddingTop: "24px",
                    paddingBottom: "12px"
                }}
            >
                <div
                    className="flex items-center w-full max-w-md rounded-lg shadow-sm px-3 py-2"
                    style={{ background: "#333334" }}
                >
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên hoặc @username..."
                        value={search}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchInputKeyDown}
                        className="flex-1 outline-none ml-2 text-sm bg-transparent text-white placeholder:text-gray-400"
                        style={{ color: "#fff" }}
                    />
                    <button
                        onClick={handleSearchButtonClick}
                        className="ml-2 px-3 py-1 rounded-lg bg-[#2563eb] text-white text-sm border border-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
                        style={{ minWidth: 80 }}
                        disabled={loading}
                        type="button"
                    >
                        {loading ? "Đang tìm..." : "Tìm kiếm"}
                    </button>
                </div>
                {showEmptyKeyError && (
                    <div className="text-red-500 font-semibold text-sm px-2 py-1">
                        Hãy nhập từ khóa!
                    </div>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={ageFilter}
                        onChange={handleAgeFilterChange}
                    >
                        {ageOptions.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                style={{ background: "#252728", color: "#fff" }}
                            >
                                Tuổi: {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        className="rounded-lg px-3 py-1 text-sm"
                        style={{
                            background: "#252728",
                            color: "#fff",
                            border: "1px solid #333334"
                        }}
                        value={locationFilter}
                        onChange={handleLocationFilterChange}
                    >
                        {provinceOptions.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                style={{ background: "#252728", color: "#fff" }}
                            >
                                Địa chỉ: {opt.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleResetFilters}
                        className="px-3 py-1 rounded-lg bg-[#3B3D3E] text-white text-sm border border-[#333334] hover:bg-[#525355] transition-colors"
                        style={{ minWidth: 80 }}
                        type="button"
                        disabled={loading}
                    >
                        Đặt lại
                    </button>
                </div>
            </div>
            {/* User result list */}
            <div className="space-y-4 w-full">
                {loading && (
                    <div className="text-gray-400 text-center py-8 w-full">
                        Đang tìm kiếm người dùng...
                    </div>
                )}
                {!loading && errorUsers && (
                    <div className="text-red-400 text-center py-8">{errorUsers}</div>
                )}
                {!loading &&
                    !errorUsers &&
                    (filteredUsers.length === 0) && (
                        <div className="text-gray-400 text-center py-8">
                            Không tìm thấy người dùng phù hợp.
                        </div>
                    )}
                {!loading &&
                    !errorUsers &&
                    filteredUsers.map((user) => (
                        <UserCard user={user} myId={myId} key={user.user || user.username} />
                    ))}
            </div>
        </div>
    );
}

export default UserTab;
