import instance from "@/axiosConfig";

export async function apiGetIncomeUser(userId: string) {
    try {
        const res = await instance.get(`/conversation/incomeUser/${userId}`);
        return res.data;
    } catch (err) {
        console.error("apiGetIncomeUser error:", err);
        throw err;
    }
}

export async function apiGetIncomeGroup(conversationId: string) {
    try {
        const res = await instance.get(`/conversation/incomeGroup/${conversationId}`);
        return res.data;
    } catch (err) {
        console.error("apiGetIncomeGroup error:", err);
        throw err;
    }
}


export async function getConversationDetail(payload: { userId: string, conversationId?: string, cursorAt?: string }) {
    try {
        console.log("getConversationDetail payload:", payload);
        const res = await instance.post(`/conversation/getConversationDetail`, payload);
        console.warn(res.data)
        return res.data;
    } catch (err) {
        console.error("getConversationId error:", err);
        throw err;
    }
}

// Hàm loadMessage lấy tin nhắn với conversationId và cursorAt
export async function loadMessage(conversationId: string, cursorAt?: string) {
    try {
        console.log("LOADDD")
        const res = await instance.post(`/conversation/loadMessage`, {
            conversationId,
            cursorAt,
        });
        return res.data;
    } catch (err) {
        console.error("loadMessage error:", err);
        throw err;
    }
}


export async function getMessageList() {
    try {
        const res = await instance.get(`/conversation/getMessageList`);
        return res.data;
    } catch (err) {
        console.error("getMessageListByUserId error:", err);
        throw err;
    }
}

export async function getOneMessageListbyConversationId(conversationId: string) {
    try {
        const res = await instance.get(`/conversation/getMessageList/${conversationId}`);
        return res.data;
    } catch (err) {
        console.error("getOneMessageListbyConversationId error:", err);
        throw err;
    }
}


export async function apiCreateGroupConversation({
    groupName,
    requireApproval,
    selectedFriends,
    avatarFile
}: {
    groupName: string,
    requireApproval: boolean,
    selectedFriends: any[], 
    avatarFile?: File
}) {
    try {
        const formData = new FormData();
        formData.append("groupName", groupName);
        formData.append("requireApproval", String(requireApproval));
        formData.append("selectedFriends", JSON.stringify(selectedFriends));
        if (avatarFile) {
            formData.append("avatar", avatarFile);
        }

        // Log form data sent
        // Note: FormData cannot be logged directly, so iterate entries
        const fdEntries: any = {};
        formData.forEach((value, key) => {
            if (value instanceof File) {
                fdEntries[key] = {
                    name: value.name,
                    size: value.size,
                    type: value.type
                };
            } else {
                fdEntries[key] = value;
            }
        });
        console.log("apiCreateGroup - FormData sent:", fdEntries);

        const res = await instance.post(`/conversation/createGroup`, formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });
        console.log("apiCreateGroup - response:", res);
        return res.data;
    } catch (err) {
        console.error("apiCreateGroup error:", err);
        throw err;
    }
}

export async function apiLoadListFriend() {
    try {
        const res = await instance.get(`/conversation/friendList`);
        return res.data;
    } catch (err) {
        console.error("apiLoadListFriend error:", err);
        throw err;
    }
}

export async function apiGetGroupUser(conversationId: string) {
    try {
        const res = await instance.get(`/conversation/getGroupUser/${conversationId}`);
        console.log(res.data)
        return res.data;
    } catch (err) {
        console.error("apiGetGroupUser error:", err);
        throw err;
    }
}


export async function apiUpdateMessagePriority(messagePriority: string) {
    try {
        const res = await instance.post(`/conversation/updateMessagePriority`, { messagePriority });
        return res.data;
    } catch (err) {
        console.error("apiUpdateMessagePriority error:", err);
        throw err;
    }
}

export async function apiUpdateGroupMessagePriority(groupMessagePriority: string) {
    try {
        const res = await instance.post(`/conversation/updateGroupMessagePriority`, { groupMessagePriority });
        return res.data;
    } catch (err) {
        console.error("apiUpdateGroupMessagePriority error:", err);
        throw err;
    }
}

export async function apiGetNotificationPriorities() {
    try {
        const res = await instance.get(`/conversation/getNotificationPriorities`);
        return res.data;
    } catch (err) {
        console.error("apiGetNotificationPriorities error:", err);
        throw err;
    }
}

export async function apiDisbandGroupConversation(conversationId: string) {
    try {
        const res = await instance.post(`/conversation/disbandGroupConversation`, { conversationId });
        return res.data;
    } catch (err) {
        console.error("apiDisbandGroupConversation error:", err);
        throw err;
    }
}

export async function apiLeaveGroupConversation(conversationId: string) {
    try {
        const res = await instance.post(`/conversation/leaveGroupConversation`, { conversationId });
        return res.data;
    } catch (err) {
        console.error("apiLeaveGroupConversation error:", err);
        throw err;
    }
}

export async function apiGetOnlineUser() {
    try {
        const res = await instance.get(`/conversation/getOnlineUser`);
        return res.data;
    } catch (err) {
        console.error("apiGetOnlineUser error:", err);
        throw err;
    }
}

export async function apiSelfChat(text: string) {
    try {
        const res = await instance.post(`/conversation/selfChat`, { text });
        return res.data;
    } catch (err) {
        console.error("apiSelfChat error:", err);
        throw err;
    }
}

// API to get all self chats for the current user
export async function apiGetSelfChat() {
    try {
        const res = await instance.get(`/conversation/getSelfChat`);
        console.log(res.data)
        return res.data;
    } catch (err) {
        console.error("apiGetSelfChat error:", err);
        throw err;
    }
}

export async function apiSummaryGroupConversation(conversationId: string | number) {
    try {
        const res = await instance.post(`/conversation/summaryGroupConversation`, { conversationId });
        console.log(res.data)
        return res.data;
    } catch (err) {
        console.error("apiSummaryGroupConversation error:", err);
        throw err;
    }
}

// API to load information about a group conversation
export async function apiLoadInfoGroupConversation(conversationId: string) {
    try {
        const res = await instance.get(`/conversation/loadInfoGroupConversation`, {
            params: { conversationId },
        });
        return res.data;
    } catch (err) {
        console.error("apiLoadInfoGroupConversation error:", err);
        throw err;
    }
}

export async function apiApplyJoinGroupConversation(conversationId: string) {
    try {
        const res = await instance.post(`/conversation/applyJoinGroupConversation`, { conversationId });
        return res.data;
    } catch (err) {
        console.error("apiApplyJoinGroupConversation error:", err);
        throw err;
    }
}

export async function apiCancelJoinGroupConversation(conversationId: string) {
    try {
        const res = await instance.post(`/conversation/cancelApplyJoinGroupConversation`, { conversationId });
        return res.data;
    } catch (err) {
        console.error("apiCancelJoinGroupConversation error:", err);
        throw err;
    }
}


export async function apiLoadGroupManager(conversationId: string) {
    try {
        const res = await instance.get(`/conversation/loadGroupManager`, {
            params: { conversationId },
        });
        return res.data;
    } catch (err) {
        console.error("apiLoadGroupManager error:", err);
        throw err;
    }
}

export async function apiChangeNeedApproval(conversationId: string) {
    try {
        const res = await instance.post('/conversation/changeNeedApproval', { conversationId });
        return res.data;
    } catch (err) {
        console.error("apiChangeNeedApproval error:", err);
        throw err;
    }
}

export async function apiKickUser(conversationId: string, userId: string) {
    try {
        const res = await instance.post('/conversation/kickUser', { conversationId, userId });
        return res.data;
    } catch (err) {
        console.error("apiKickUser error:", err);
        throw err;
    }
}

export async function apiApproveUser(conversationId: string, userId: string) {
    try {
        const res = await instance.post('/conversation/approveUser', { conversationId, userId });
        return res.data;
    } catch (err) {
        console.error("apiApproveUser error:", err);
        throw err;
    }
}

export async function apiDeclineUser(conversationId: string, userId: string) {
    try {
        const res = await instance.post('/conversation/declineUser', { conversationId, userId });
        return res.data;
    } catch (err) {
        console.error("apiDeclineUser error:", err);
        throw err;
    }
}

export async function apiTransferOwner(conversationId: string, userId: string) {
    try {
        console.log("apiTransferOwner called with:", { conversationId, userId });
        const res = await instance.post('/conversation/transferOwner', { conversationId, userId });
        return res.data;
    } catch (err) {
        console.error("apiTransfer error:", err);
        throw err;
    }
}