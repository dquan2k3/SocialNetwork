import instance from "@/axiosConfig";

export interface ReportUserParams {
  userId: string;
  reason: string;
  type: string;
}


export const apiReportUser = async (params: ReportUserParams) => {
  const response = await instance.post("/report/report", {
    userId: params.userId,
    reason: params.reason,
    type: params.type,
  });
  return response.data;
};

export interface ReportMessageParams {
  userId?: string;
  conversationId: string;
  type: string;
}


export const apiReportMessage = async (params: ReportMessageParams) => {
  const payload: any = {
    conversationId: params.conversationId,
    type: params.type,
  };
  if (params.userId) {
    payload.userId = params.userId;
  }

  console.log("apiReportMessage payload:", payload);
  const response = await instance.post("/report/reportMessage", payload);
  return response.data;
};
