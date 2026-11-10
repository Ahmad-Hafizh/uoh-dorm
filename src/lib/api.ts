import axios from "axios";

export const API = "/api";
export const api = axios.create({ baseURL: API, withCredentials: true, timeout: 15000 });

export function formatApiError(detail: unknown): string {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(formatApiError).join(" ");
  if (typeof detail === "object" && "msg" in detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
