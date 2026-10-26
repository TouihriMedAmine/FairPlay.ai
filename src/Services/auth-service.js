import axios from "axios";
import { API_ENDPOINTS } from "../config";

export const login = (username, password) => {
  return axios
    .post(API_ENDPOINTS.LOGIN, {
      username,
      password,
    })
    .then((response) => response.data);
};

export const logout = () => {
  localStorage.removeItem("user");
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  if (userStr) return JSON.parse(userStr);

  return null;
};

export async function register(username,email, password) {
  const response = await axios.post(API_ENDPOINTS.REGISTER, {
    username,
    email,
    password
  });
  return response.data;
}


