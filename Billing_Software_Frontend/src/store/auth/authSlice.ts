import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import Cookies from "js-cookie";
import Constants from "../../constants/api";

export interface AuthState {
    isAuthenticated: boolean;
    user: any;
    token: string | null;
    isLoading: boolean;
    error: string | null;
}

// initial state
const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: "",
    isLoading: false,
    error: null,
};

// --- LOGIN ASYNC ACTION ---
export const loginUser = createAsyncThunk(
    "auth/login",
    async (credentials: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await axios.post(Constants.LOGIN_URL, {
                email: credentials.email,
                password: credentials.password,
            });

            const { token, user } = response.data;

            //  Store securely in cookies (7 days expiry)
            Cookies.set("authToken", token, { secure: true, sameSite: "Strict", expires: 7 });
            Cookies.set("authUser", JSON.stringify(user), { secure: true, sameSite: "Strict", expires: 7 });

            // In Electron: cache the token in the local backend so SyncManager can use it
            // when syncing offline data to Atlas (fire-and-forget — don't block login)
            if (typeof window !== 'undefined' && 'electronAPI' in window) {
                const localPort = (window as any).__electronLocalBackendPort || 3002;
                axios.post(`http://localhost:${localPort}/api/local/sync-token`, { token })
                    .then(() => {
                        // Token is now cached — safe to trigger sync
                        // SyncManager will pick up the token and push any pending offline records
                        (window as any).electronAPI?.triggerSync?.();
                    })
                    .catch(() => { /* non-critical */ });
            }

            return { token, user };
        } catch (error: any) {
            let errorMessage = "Login failed. Please try again.";
            if (axios.isAxiosError(error) && error.response) {
                errorMessage = error.response.data.message || error.response.statusText;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return rejectWithValue(errorMessage);
        }
    }
);

// --- SLICE ---
export const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        logout: (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.token = null;
            state.error = null;

            // Clear cookies
            Cookies.remove("authToken");
            Cookies.remove("authUser");
            Cookies.remove("systemSettings");
        },
        initializeAuth: (state) => {
            //  Read from cookies
            const token = Cookies.get("authToken");
            const user = Cookies.get("authUser");

            if (token && user) {
                try {
                    state.token = token;
                    state.user = JSON.parse(user);
                    state.isAuthenticated = true;
                } catch (e) {
                    console.error("Failed to parse user data from cookies", e);
                    state.isAuthenticated = false;
                    state.user = null;
                    state.token = null;
                    Cookies.remove("authToken");
                    Cookies.remove("authUser");
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ token: string; user: any }>) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action: PayloadAction<any>) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = action.payload || "Login failed.";
            });
    },
});

export const { logout, initializeAuth } = authSlice.actions;

export default authSlice.reducer;
