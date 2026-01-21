import instance from "@/axiosConfig";

export const testGroup = async () => {
  const response = await instance.get("/group/test");
  return response.data;
};

export const apiCreateGroup = async ({ name }: { name: string }) => {
  const response = await instance.post("/group/createGroup", { name });
  return response.data;
};

export const getMyGroups = async (params?: { groupId?: string }) => {
  const response = await instance.get("/group/getMyGroups", {
    params,
  });
  return response.data;
};

export const apiUpdateGroupCover = async (
  groupId: string,
  coverImage: File | Blob,
  name: string
) => {
  const formData = new FormData();
  formData.append("cover", coverImage);
  formData.append("groupId", groupId);
  formData.append("name", name);

  const response = await instance.post("/group/updateCover", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const apiUpdateSetting = async ({ groupId, description, privacy, requireApproval }: { groupId: string; description: string; privacy: "public" | "private" | "secret"; requireApproval: boolean }) => {
  const response = await instance.post("/group/updateSetting", { groupId, description, privacy, requireApproval });
  return response.data;
};

export const apiGetSetting = async (groupId: string) => {
  const response = await instance.get("/group/getSetting", {
    params: { groupId },
  });
  return response.data;
};


export const apiSearchGroup = async ({ key, filter, sort }: { key: string; filter?: { type?: "" | "public" | "private" }; sort?: "most_members" | "recent" | "oldest" }) => {
  const response = await instance.get("/group/searchGroup", {
    params: {
      key,
      type: filter?.type,
      sort,
    },
  });
  return response.data;
};

export const apiJoinGroup = async ({ groupId, message }: { groupId: string; message?: string }) => {
  const response = await instance.post("/group/joinGroup", {
    groupId,
    message,
  });
  return response.data;
};

export const apiCancelJoinGroup = async ({ groupId }: { groupId: string }) => {
  const response = await instance.post("/group/cancelJoinGroup", {
    groupId,
  });
  return response.data;
};

export const apiLeaveGroup = async ({ groupId }: { groupId: string }) => {
  const response = await instance.post("/group/leaveGroup", {
    groupId,
  });
  return response.data;
};

export const apiLoadMember = async ({ groupId }: { groupId: string }) => {
  const response = await instance.get("/group/loadMember", {
    params: { groupId },
  });
  return response.data;
};

export const apiAcceptMember = async ({ groupId, userId }: { groupId: string; userId: string }) => {
  const response = await instance.post("/group/acceptMember", {
    groupId,
    userId,
  });
  return response.data;
};

export const apiRejectMember = async ({ groupId, userId }: { groupId: string; userId: string }) => {
  const response = await instance.post("/group/rejectMember", {
    groupId,
    userId,
  });
  return response.data;
};

export const apiBanMember = async ({ groupId, userId, days }: { groupId: string; userId: string; days: number }) => {
  const response = await instance.post("/group/banMember", {
    groupId,
    userId,
    days,
  });
  return response.data;
};

export const apiGetGroupPost = async (groupId: string) => {
    try {
        const response = await instance.get('/group/groupPosts', {
            params: { groupId },
        });
        return response;
    } catch (error: any) {
        if (error.response) {
            console.error('Lỗi server:', error.response.data);
        } else {
            console.error('Lỗi khác:', error.message);
        }
        throw error;
    }
};

export const apiUploadGroupPost = async (postData: { text: string; groupId: string; files?: File[]; [key: string]: any }) => {
  try {
      const formData = new FormData();
      formData.append("text", postData.text);
      formData.append("groupId", postData.groupId);

      // Thêm các trường khác ngoài 'text', 'files', và 'groupId' (nếu có)
      Object.entries(postData).forEach(([key, value]) => {
          if (key !== "text" && key !== "files" && key !== "groupId" && value !== undefined) {
              formData.append(key, value);
          }
      });

      if (postData.files && postData.files.length > 0) {
          postData.files.forEach((file) => {
              formData.append("files", file);
          });
      }

      const response = await instance.post("/group/uploadGroupPost", formData, {
          headers: {
              "Content-Type": "multipart/form-data",
          },
      });
      return response;
  } catch (error: any) {
      if (error.response) {
          console.error("Lỗi server:", error.response.data);
      } else {
          console.error("Lỗi khác:", error.message);
      }
      throw error;
  }
};

export const apiGetGroupMedia = async (groupId: string) => {
    try {
      console.log(groupId)
        const response = await instance.get('/group/getGroupMedia', {
            params: { groupId },
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            console.error('Lỗi server:', error.response.data);
        } else {
            console.error('Lỗi khác:', error.message);
        }
        throw error;
    }
};
