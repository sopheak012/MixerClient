import { useState, useEffect } from "react";
import axios from "axios";
import { useGlobalState } from "../contexts/GlobalContext";
import SpotifyWebApi from "spotify-web-api-node";
import { CLIENT_ID } from "../utils/Constants";

export const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
});

export default function useAuth(code) {
  const [accessToken, setAccessToken] = useState();
  const [refreshToken, setRefreshToken] = useState();
  const [expiresIn, setExpiresIn] = useState();
  const { setToken } = useGlobalState();

  useEffect(() => {
    axios
      .post(`${import.meta.env.VITE_REACT_APP_Mixer_BACKEND_URL}/login`, {
        code: code,
      })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setToken(res.data.accessToken);
        localStorage.setItem("api-key", res.data.accessToken);

        setRefreshToken(res.data.refreshToken);
        setExpiresIn(res.data.expiresIn);
        window.history.pushState({}, null, "/");
      })
      .catch((err) => {
        window.location = "/";
      });
  }, [code, setToken]);

  useEffect(() => {
    if (!refreshToken || !expiresIn) return;
    const interval = setInterval(() => {
      axios
        .post(`${import.meta.env.VITE_Mixer_BACKEND_URL}/refresh`, {
          refreshToken,
        })
        .then((res) => {
          setAccessToken(res.data.accessToken);
          setToken(res.data.accessToken);
          spotifyApi.setAccessToken(res.data.accessToken);
          localStorage.setItem("api-key", res.data.accessToken);
          setExpiresIn(res.data.expiresIn);
        })
        .catch(() => {
          window.location = "/";
        });
    }, (expiresIn - 60) * 1000);

    return () => clearInterval(interval);
  }, [refreshToken, expiresIn, setToken]);

  return accessToken;
}
