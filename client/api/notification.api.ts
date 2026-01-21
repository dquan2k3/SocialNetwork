import instance from "@/axiosConfig";

export const apiGetNotifyList = async () => {
    try {
        const response = await instance.get('/notification/getNotifyList');
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


export const apiGetMyAction = async (cursor?: string) => {
    try {
        const params: any = {};
        if (cursor) {
            params.cursor = cursor;
        }
        const response = await instance.get('/notification/getMyAction', { params });
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
