"use client";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addBio, addProfile, setUserId } from "@/store/slices/userSlice";
import instance from "@/axiosConfig";

export function useInitUser() {
    const dispatch = useDispatch();
    const isAuthenticated = useSelector((state: any) => state.auth);
    useEffect(() => {
        const fetchBioAndName = async () => {
            try {
                const bioRes = await instance.post("/bio/getBio");
                //console.log('getBio response:', bioRes.data);

                const nameRes = await instance.post("/profile/getMyProfile");
                //console.log('getMyProfile response:', nameRes.data);

                // Dispatch dữ liệu response vào store
                if (bioRes?.data) {
                    dispatch(addBio(bioRes.data.bio));
                }
                if (nameRes?.data) {
                    // addProfile chỉ chứa các trường profile (name, username, ...), không chứa userId
                    const { userId, ...profileData } = nameRes.data;
                    dispatch(addProfile(profileData));
                    if (userId) {
                        dispatch(setUserId(userId));
                    }
                }
            } catch (error) {
                console.error('Error calling getBio or getName:', error);
            }
        };

        fetchBioAndName();
    }, [isAuthenticated]);
}