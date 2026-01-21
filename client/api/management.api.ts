import instance from "@/axiosConfig";

export const apiLoadDashboard = async (filter?: string) => {
  const response = await instance.get("/management/loadDashboard", {
    params: filter ? { filter } : undefined,
  });
  return response.data;
};


export const apiRecentDashboard = async (cursor?: string) => {
  const response = await instance.get("/management/getRecentDashboard", {
    params: cursor ? { cursor } : undefined,
  });
  return response.data;
};

export const apiLoadUser = async (
  params?: { cursor?: string; keyword?: string; priority?: string }
) => {
  const response = await instance.get("/management/loadUser", {
    params,
  });
  return response.data;
};

export const apiFindUser = async (username: string) => {
  const response = await instance.get("/management/findUser", { params: { username } });
  return response.data;
};

export const apiBanUser = async (userId: string, banDays: number) => {
  console.log("apiBanUser called with:", { userId, banDays });
  const response = await instance.post("/management/banUser", { userId, banDays });
  return response.data;
};

export const apiLoadReportPost = async () => {
  const response = await instance.get("/management/loadReportPost");
  return response.data;
};

export const apiSearchReportPost = async (search: string) => {
  const response = await instance.get("/management/searchReportPost", { params: { search } });
  return response.data;
};



export const apiLoadReportComment = async () => {
  const response = await instance.get("/management/loadReportComment");
  return response.data;
};

export const apiRemovePostReport = async (postId: string) => {
  const response = await instance.post("/management/removePostReport", { postId });
  return response.data;
};

export const apiRemoveCommentReport = async (commentId: string) => {
  const response = await instance.post("/management/removeCommentReport", { commentId });
  return response.data;
};

export const apiBanUserAndRemoveComment = async (
  commentId: string,
  days: number,
  userId: string
) => {
  const response = await instance.post("/management/banUserAndRemoveComment", {
    commentId,
    days,
    userId,
  });
  return response.data;
};


export const apiBanUserAndRemovePost = async (
  postId: string,
  days: number
) => {
  const response = await instance.post("/management/banUserAndRemovePost", {
    postId,
    days,
  });
  return response.data;
};

export const apiBanUserDueToMessage = async (
  userId: string,
  banDays: number,
) => {
  const response = await instance.post("/management/banUserDueToMessage", {
    userId,
    banDays,
  });
  return response.data;
};

export const apiRemoveRoomChat = async (
  conversationId: string,
) => {
  const response = await instance.post("/management/removeRoomChat", {
    conversationId,
  });
  return response.data;
};




export const apiLoadUserReport = async () => {
  const response = await instance.get("/management/loadUserReport");
  return response.data;
};

export const apiBanUserDueToProfile = async (
  userId: string,
  banDays: number,
  isDelAvatar: boolean,
  isDelCover: boolean,
  isDelName: boolean,
  isDelUsername: boolean,
) => {
  const response = await instance.post("/management/banUserDueToProfile", {
    userId,
    banDays,
    isDelAvatar,
    isDelCover,
    isDelName,
    isDelUsername,
  });
  return response.data;
};


export const apiBanUserWithReason = async (
  userId: string,
  banDays: number,
  reason: string,
  reportId?: string
) => {
  console.log("banUserWithReason called with:", { userId, banDays, reason, reportId });
  const response = await instance.post("/management/banUserWithReason", { userId, banDays, reason, reportId });
  return response.data;
};

export const apiLoadReportMessage = async () => {
  const response = await instance.get("/management/loadReportMessage");
  return response.data;
};

export const apiDeleteReport = async (reportId: string) => {
  const res = await instance.delete("/management/deleteReport", { data: { reportId } });
  return res.data;
};

export const apoLoadReportedMessage = async (
  conversationId: string,
  reportTime: string,
  userId?: string,
) => {
  console.log("apoLoadReportedMessage called with:", { conversationId, reportTime, userId });
  if (!conversationId) throw new Error("conversationId is required");
  if (!reportTime) throw new Error("reportTime is required");
  const params: any = { conversationId, reportTime };
  if (userId) params.userId = userId;
  const response = await instance.get("/management/loadReportedMessage", {
    params,
  });
  console.log(response)
  return response.data;
};
