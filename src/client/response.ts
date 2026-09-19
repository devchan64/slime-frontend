export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  const invalidResponse = () => new ApiError(
    "INVALID_API_RESPONSE",
    response.status >= 500
      ? `서버 응답 오류 (HTTP ${response.status}). API 서버 연결 상태를 확인한 뒤 다시 시도해 주세요.`
      : `서버가 올바른 JSON 응답을 보내지 않았습니다 (HTTP ${response.status}).`,
    response.status,
  );
  if (!body.trim()) throw invalidResponse();
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType?.endsWith("+json")) throw invalidResponse();
  let data: unknown;
  try { data = JSON.parse(body); }
  catch { throw invalidResponse(); }
  if (data === null || typeof data !== "object") throw invalidResponse();
  if (!response.ok) {
    const error = data as Record<string, unknown>;
    throw new ApiError(
      typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      typeof error.message === "string" ? error.message : `요청을 처리하지 못했습니다 (HTTP ${response.status}).`,
      response.status,
    );
  }
  return data;
}
