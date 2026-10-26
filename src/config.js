// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

// API Endpoints
export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/login/`,
  REGISTER: `${API_BASE_URL}/register/`,
  SONGS: `${API_BASE_URL}/songplayed/`,
  RADIO_STATIONS: `${API_BASE_URL}/radiostations/`,
};
