import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("careerlens-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    return typeof detail === "string" ? detail : error.message || "The request failed.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
