
import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const SESSION_STORAGE_KEY = "fintara.session";

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

let accessToken = null;

export function setAccessToken(token, expiresAt, user) {
  const expiration = Date.parse(expiresAt);

  if (
    !token ||
    !user ||
    !Number.isFinite(expiration) ||
    expiration <= Date.now()
  ) {
    throw new Error("The API returned an invalid or expired session.");
  }

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ token, expiresAt: expiration, user })
  );
  accessToken = token;
}

export function restoreSession() {
  const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!storedSession) {
    accessToken = null;
    return null;
  }

  let session;

  try {
    session = JSON.parse(storedSession);
  } catch {
    clearAccessToken();
    return null;
  }

  if (
    !session.token ||
    !session.user ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now()
  ) {
    clearAccessToken();
    return null;
  }

  accessToken = session.token;

  return session;
}

export function clearAccessToken() {
  accessToken = null;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export function getApiError(error) {
  if (error.response?.status === 401) {
    return "Your session is invalid or expired. Please sign in again.";
  }

  if (error.response?.status === 403) {
    return "You are not authorized to perform this action.";
  }

  const errors = error.response?.data?.errors;

  if (errors) {
    return Object.entries(errors)
      .map(([field, messages]) =>
        `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`
      )
      .join("\n");
  }

  if (error.response?.status === 404) {
    return "The requested resource was not found.";
  }

  if (error.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (!error.response) {
    return "Cannot connect to the API. Check that Laravel is running.";
  }

  return error.response.data?.message || "An unexpected error occurred.";
}
