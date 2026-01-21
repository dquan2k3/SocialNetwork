import instance from "@/axiosConfig";

export const apiSendFriendRequest = async ({ recipient, message }: { recipient: string, message: string }) => {
  const response = await instance.post("/relationship/sendFriendRequest", { recipient, message });
  console.log(response.data);
  return response.data;
};

export const apiGetRelationship = async (otherUserId: string) => {
  const response = await instance.get("/relationship/getRelationship", { params: { otherUserId } });
  return response.data;
};

export const apiCancelRelationship = async (relationshipId: string) => {
  const response = await instance.post("/relationship/cancelRelationship", { relationshipId });
  return response.data;
};

export const apiAcceptFriendRequest = async (relationshipId: string) => {
  const response = await instance.post("/relationship/acceptFriendRequest", { relationshipId });
  return response.data;
};

export const apiRejectFriendRequest = async (relationshipId: string) => {
  const response = await instance.post("/relationship/rejectFriendRequest", { relationshipId });
  return response.data;
};

export const apiBlockUser = async (userId: string) => {
  const response = await instance.post("/relationship/blockUser", { userId });
  return response.data;
};


export const apiGetFriend = async (type: 'friend' | 'requester' | 'recipient' | 'birthday') => {
  const response = await instance.get("/relationship/getFriend", { params: { type } });
  console.log('response truyền vào:', response);
  return response.data;
};

export const apiGetUserFriend = async (userId: string, type: 'friend' | 'mutual') => {
  const response = await instance.get("/relationship/getUserFriend", { params: { userId, type } });
  return response.data;
};
