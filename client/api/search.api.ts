import instance from "@/axiosConfig";

export const apiGetRandomUser = async () => {
  const response = await instance.post("/search/getRandomUser");
  return response.data;
};

export const apiSearchUser = async ({ key, filter }: { key: string, filter: any }) => {
  const response = await instance.post("/search/searchUser", { key, filter });
  console.warn("RES FROM KEY AKDJLASDJLJSAD: ", response)
  return response.data;
};

export const apiSearchPost = async ({
  key,
  filter,
  sort,
}: {
  key: string;
  filter: any;
  sort: any;
}) => {
  const response = await instance.post("/search/searchPost", { key, filter, sort });
  return response.data;
};
