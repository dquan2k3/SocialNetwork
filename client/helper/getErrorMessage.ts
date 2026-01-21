export function getErrorMessage(err: unknown): string {
  // Xử lý lỗi axios trả về từ interceptor (là object với key 'message' hoặc 'error')
  if (typeof err === "object" && err !== null) {
    if ("message" in err && typeof (err as any).message === "string") {
      return (err as any).message;
    }
    if ("error" in err && typeof (err as any).error === "string") {
      return (err as any).error;
    }
  }
  if (err instanceof Error) return err.message;
  return "Có lỗi xảy ra";
}