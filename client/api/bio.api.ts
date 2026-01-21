import instance from "@/axiosConfig";

/**
 * Gửi FormData sẵn có (từ service) tới API backend /bio/changebio.
 * @param formData - FormData đã được build ở client/services/bio.ts
 * @returns response từ server
 */
export async function apiUpdateProfile(formData: FormData) {
    const response = await instance.post("/bio/changebio", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        }
    });
    return response;
}


export async function apiGetCoverHome() {
    const response = await instance.post("/bio/getcoverhome");
    return response.data;
}
