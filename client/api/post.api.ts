import instance from "@/axiosConfig";

// Hàm gửi bài viết kèm file (ảnh, video, ...)
export const apiUploadPost = async (postData: { text: string; files?: File[]; [key: string]: any }) => {
    try {
        const formData = new FormData();
        formData.append("text", postData.text);

        // Thêm các trường khác ngoài 'text' và 'files' (nếu có)
        Object.entries(postData).forEach(([key, value]) => {
            if (key !== "text" && key !== "files" && value !== undefined) {
                formData.append(key, value);
            }
        });

        if (postData.files && postData.files.length > 0) {
            postData.files.forEach((file) => {
                formData.append("files", file);
            });
        }

        const response = await instance.post("/post/uploadPost", formData, {
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

export const apiGetProfilePost = async (userId?: string) => {
    try {
        let response;
        if (userId) {
            response = await instance.get('/post/getProfilePosts', {
                params: { userId }
            });
        } else {
            response = await instance.get('/post/getProfilePosts');
        }
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

export const apiGetSinglePost = async (postId: string) => {
    try {
        const response = await instance.post('/api/singlePost', { postId });
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

export const apiGetHomePost = async (cursorAt?: string) => {
    try {
        const params: any = {};
        if (cursorAt) {
            params.cursorAt = cursorAt;
        }
        const response = await instance.get('/post/homePosts', { params });
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


export const apiReactPost = async ({ postId, react }: { postId: string, react: string }) => {
    try {
        const response = await instance.post('/post/reactPost', { postId, react });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            console.log(error)
            console.error('Lỗi server:', error.response.data);
        } else {
            console.error('Lỗi khác:', error.message);
        }
        throw error;
    }
};

export const apiCommentPost = async ({ postId, comment }: { postId: string, comment: string }) => {
    try {
        const response = await instance.post('/post/commentPost', { postId, comment });
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

export const apiLoadComment = async ({ postId, cursor }: { postId: string, cursor?: { time: string } }) => {
    try {
        const params: any = { postId, ...(cursor || {}) };
        const response = await instance.get('/post/loadComment', { params });
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

export const apiDeleteComment = async ({ commentId }: { commentId: string }) => {
    try {
        const response = await instance.delete('/post/deleteComment', { data: { commentId } });
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



export const apiSharePost = async ({ postId }: { postId: string }) => {
    try {
        const response = await instance.post('/post/sharePost', { postId });
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

export const apiReport = async ({ postId }: { postId: string }) => {
    try {
        const response = await instance.post('/post/reportPost', { postId });
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

export const apiDeletePost = async ({ postId }: { postId: string }) => {
    try {
        const response = await instance.delete('/post/deletePost', { data: { postId } });
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

export const apiReportComment = async ({
    commentId,
    postId,
    userId,
}: {
    commentId: string;
    postId: string;
    userId: string;
}) => {
    try {
        const response = await instance.post('/post/reportComment', {
            commentId,
            postId,
            userId,
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

