import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CroppedStat {
  zoom?: number;
  cropX?: number;
  cropY?: number;
}

interface CroppedArea {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface Bio {
  avatar?: string;
  avatarCroppedStat?: CroppedStat;
  avatarCroppedArea?: CroppedArea;
  cover?: string;
  coverCroppedStat?: CroppedStat;
  coverCroppedArea?: CroppedArea;
  description?: string;
}

export interface Profile {
  name?: string;
  username?: string;
  nameChangedDate?: string | null;
  usernameChangedDate?: string | null;
}

interface UserBioState {
  bio: Bio | null;
  profile: Profile | null;
  userId: string | null;
}

const initialState: UserBioState = {
  bio: null,
  profile: null,
  userId: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    addBio: (state, action: PayloadAction<Bio>) => {
      state.bio = action.payload;
    },
    removeBio: (state) => {
      state.bio = null;
    },
    addProfile: (state, action: PayloadAction<Profile>) => {
      state.profile = action.payload;
    },
    removeProfile: (state) => {
      state.profile = null;
    },
    setUserId: (state, action: PayloadAction<string>) => {
      state.userId = action.payload;
    },
    removeUserId: (state) => {
      state.userId = null;
    },
    changeName: (state, action: PayloadAction<string>) => {
      if (state.profile) {
        state.profile.name = action.payload;
      }
    },
  }
});

export const { addBio, removeBio, addProfile, removeProfile, setUserId, removeUserId, changeName } = userSlice.actions;
export default userSlice.reducer;
