import axios from "axios";

export const api = axios.create({ baseURL: "/api", withCredentials: true });

export const errMsg = (e) =>
  e.response?.data?.errors?.[0]?.message ||
  e.response?.data?.message ||
  "Something went wrong. Please try again.";