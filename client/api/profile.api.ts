import instance from "@/axiosConfig";

// -------- Info --------

export interface ChangeUsernamePayload {
  username: string;
}
export async function apiChangeUsername(payload: ChangeUsernamePayload) {
  const response = await instance.post("/profile/changeUsername", payload);
  console.log(response)
  return response.data;
}

export interface ChangeNamePayload {
  name: string;
}
export async function apiChangeName(payload: ChangeNamePayload) {
  const response = await instance.post("/profile/changeName", payload);
  return response.data;
}

export interface ChangeLivingPayload {
  living: string;
  dateLiving: string;
  privateLiving: string;
}
export async function apiChangeLiving(payload: ChangeLivingPayload) {
  const response = await instance.post("/profile/changeLiving", payload);
  return response.data;
}

export interface ChangeHometownPayload {
  hometown: string;
  privateHometown: string;
}
export async function apiChangeHometown(payload: ChangeHometownPayload) {
  const response = await instance.post("/profile/changeHometown", payload);
  return response.data;
}

export interface ChangeBirthDayPayload {
  birthday: string;
  privateBirthday: string;
}
export async function apiChangeBirthDay(payload: ChangeBirthDayPayload) {
  const response = await instance.post("/profile/changeBirthDay", payload);
  return response.data;
}

export interface ChangeSchoolPayload {
  school: string;
  privateSchool: string;
  graduated: boolean;
}
export async function apiChangeSchool(payload: ChangeSchoolPayload) {
  const response = await instance.post("/profile/changeSchool", payload);
  return response.data;
}

export async function apiGetInfo(userId?: string) {
  const payload = userId ? { userId } : {};
  const response = await instance.post("/profile/getInfo", payload);
  return response.data;
}

export async function apiGetProfile(userId?: string) {
  const response = await instance.post("/profile/getProfile", userId ? { userId } : {});
  console.log(response.data);
  return response.data;
}


// -------- Contact --------
export interface ChangeEmailContactPayload {
  email: string;
}
export async function apiChangeEmailContact(payload: ChangeEmailContactPayload) {
  const response = await instance.post("/profile/changeEmailContact", payload);
  return response.data;
}

export interface ChangePhoneContactPayload {
  phone: string;
}
export async function apiChangePhoneContact(payload: ChangePhoneContactPayload) {
  const response = await instance.post("/profile/changePhoneContact", payload);
  return response.data;
}

export interface ChangeWebsiteContactPayload {
  website: string;
}
export async function apiChangeWebsiteContact(payload: ChangeWebsiteContactPayload) {
  const response = await instance.post("/profile/changeWebsiteContact", payload);
  return response.data;
}

export async function apiGetContact(userId?: string) {
  const payload = userId ? { userId } : {};
  const response = await instance.post("/profile/getContact", payload);
  return response.data;
}

// -------- Event --------
export interface AddEventPayload {
  event: string;
  date: string;
}
export async function apiAddEvent(payload: AddEventPayload) {
  const response = await instance.post("/profile/addEvent", payload);
  console.log(response)
  return response.data;
}

export interface UpdateEventPayload {
  id: string;
  event: string;
  date: string;
}
export async function apiUpdateEvent(payload: UpdateEventPayload) {
  const response = await instance.post("/profile/updateEvent", payload);
  return response.data;
}

export interface DeleteEventPayload {
  id: string;
}
export async function apiDeleteEvent(payload: DeleteEventPayload) {
  const response = await instance.post("/profile/deleteEvent", payload);
  return response.data;
}

export async function apiGetEvent(userId?: string) {
  const payload = userId ? { userId } : {};
  const response = await instance.post("/profile/getEvent", payload);
  return response.data;
}


// -------- Image & Video --------
export async function apiGetImage(userId: string) {
  const response = await instance.post("/api/getImage", { userId });
  return response.data;
}

export async function apiGetVideo() {
  const response = await instance.post("/api/getVideo");
  return response.data;
}

// -------- User Profile --------
export async function apiGetUserProfile(userId: string) {
  const response = await instance.post("/profile/getUserProfile", { userId });
  return response.data;
}

export async function apiGetUserFriend(userId: string) {
  const response = await instance.get("/api/getUserFriend", {
    params: { userId },
  });
  return response.data;
}

export async function apiGetUserPost(userId: string) {
  const response = await instance.get("/api/getUserPost", {
    params: { userId },
  });
  return response.data;
}

export async function apiGetMedia(userId: string) {
  try {
    const response = await instance.post("/post/getMedia", { userId });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Lỗi server:', error.response.data);
    } else {
      console.error('Lỗi khác:', error.message);     
    }
    throw error;
  }
}
export async function apiGetSinglePost(postId: string) {
  const response = await instance.get("/post/singlePost", {
    params: { postId },
  });
  return response.data;
}

