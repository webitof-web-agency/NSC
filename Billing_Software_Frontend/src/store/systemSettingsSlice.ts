import Constants from "@constants/api";
import type { SystemSettings } from "@models/system-settings";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

interface SystemSettingsState {
    data: SystemSettings | null
}

const initialState: SystemSettingsState = {
    data: null
}
export const hydrateFromStorage = createAsyncThunk("system/hydrate", async () => {
    const raw = localStorage.getItem("systemSettings");
    if (!raw) return null;
    return JSON.parse(raw);
});

export const fetchSystemSettings = createAsyncThunk("system/save", async (token: string) => {
    const response = await axios.get(Constants.FETCH_SYSTEM_SETTINGS_URL, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = response.data.data || null;
    if (data) {
        localStorage.setItem("systemSettings", JSON.stringify(data));
    }
    return data;
})

const systemSettingsSlice = createSlice({
    name: "system",
    initialState,
    reducers: {
        setSystemSettings: (state, action) => {
            state.data = action.payload;
            if (action.payload) {
                localStorage.setItem("systemSettings", JSON.stringify(action.payload));
            }
        },
        clearSystemSettings: (state) => {
            state.data = null;
            localStorage.removeItem("systemSettings");
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(hydrateFromStorage.fulfilled, (state, action) => {
                state.data = action.payload;
            })
            .addCase(fetchSystemSettings.fulfilled, (state, action) => {
                state.data = action.payload;
            });
    },
})

export const { setSystemSettings, clearSystemSettings } = systemSettingsSlice.actions;
export default systemSettingsSlice.reducer;
