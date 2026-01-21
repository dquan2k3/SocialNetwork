"use client";
import { apiCheckLogin } from "@/api/auth.api";
import { loginSuccess } from "@/store/slices/authSlice";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

export function useCheckLogin() {
    const dispatch = useDispatch();

    useEffect(() => {
        const checklogin = async () => {
            try {
                const data = await apiCheckLogin();
                if (data && data.user) {
                    dispatch(
                        loginSuccess({
                            user: data.user,
                        })
                    );
                }
            } catch (error) {
                // Không làm gì khác
            }
        };

        checklogin();
    }, [dispatch]);
}