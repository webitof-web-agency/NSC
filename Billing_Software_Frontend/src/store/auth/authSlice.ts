import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import Cookies from "js-cookie";
import Constants from "../../constants/api";
import { getLocalBackendUrl } from "../../utils/apiBaseUrl";

export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
}

export interface AuthUser {
    _id?: string;
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    profileImage?: string;
    profileImageUrl?: string;
    user_type?: number;
}

interface LoginResponse {
    token: string;
    user: AuthUser;
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
            const response = await axios.post<LoginResponse>(Constants.LOGIN_URL, {
                email: credentials.email,
                password: credentials.password,
            });

            const { token, user } = response.data;

            const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
            Cookies.set("authToken", token, { secure: isSecure, sameSite: "Lax", expires: 7 });
            Cookies.set("authUser", JSON.stringify(user), { secure: isSecure, sameSite: "Lax", expires: 7 });
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem("authToken", token);
                localStorage.setItem("authUser", JSON.stringify(user));
            }

            // In Electron: after a successful ONLINE login, cache token + user into
            // the local backend so offline login works without re-authenticating.
            if (typeof window !== 'undefined' && 'electronAPI' in window) {
                try {
                    await axios.post(
                        `${getLocalBackendUrl()}/api/local/sync-token`,
                        { token, user },
                        { timeout: 5000 }
                    );
                } catch (syncErr) {
                    console.warn('[authSlice] Could not cache token to local backend:', syncErr);
                }
                // Trigger bootstrap sync with the fresh cloud token
                void (window as any).electronAPI?.triggerSync(token);
            }

            return { token, user };
        } catch (error: unknown) {
            let errorMessage = "Login failed. Please try again.";
            if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
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

            // Clear cookies & localStorage
            Cookies.remove("authToken");
            Cookies.remove("authUser");
            Cookies.remove("systemSettings");
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem("authToken");
                localStorage.removeItem("authUser");
                localStorage.removeItem("systemSettings");
            }
        },
        initializeAuth: (state) => {
            // Read from cookies or localStorage
            const token = Cookies.get("authToken") || (typeof localStorage !== 'undefined' ? localStorage.getItem("authToken") : null);
            const user = Cookies.get("authUser") || (typeof localStorage !== 'undefined' ? localStorage.getItem("authUser") : null);

            if (token && user) {
                try {
                    const parsedUser = typeof user === 'string' ? JSON.parse(user) : user;
                    state.token = token;
                    state.user = parsedUser;
                    state.isAuthenticated = true;

                    // Ensure both cookies and localStorage are synced
                    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
                    Cookies.set("authToken", token, { secure: isSecure, sameSite: "Lax", expires: 7 });
                    Cookies.set("authUser", JSON.stringify(parsedUser), { secure: isSecure, sameSite: "Lax", expires: 7 });
                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem("authToken", token);
                        localStorage.setItem("authUser", JSON.stringify(parsedUser));
                    }

                    // In Electron: cache token + user into the local backend on startup
                    if (typeof window !== 'undefined' && 'electronAPI' in window) {
                        axios.post(
                            `${getLocalBackendUrl()}/api/local/sync-token`,
                            { token, user: parsedUser },
                            { timeout: 5000 }
                        ).then(() => {
                            void (window as any).electronAPI?.triggerSync(token);
                        }).catch((syncErr) => {
                            console.warn('[authSlice] initializeAuth sync-token warning:', syncErr.message);
                            void (window as any).electronAPI?.triggerSync(token);
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse user data from storage", e);
                    state.isAuthenticated = false;
                    state.user = null;
                    state.token = null;
                    Cookies.remove("authToken");
                    Cookies.remove("authUser");
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem("authToken");
                        localStorage.removeItem("authUser");
                    }
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
            .addCase(loginUser.fulfilled, (state, action: PayloadAction<LoginResponse>) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action: PayloadAction<unknown>) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = typeof action.payload === 'string' ? action.payload : "Login failed.";
            });
    },
});

export const { logout, initializeAuth } = authSlice.actions;

export default authSlice.reducer;
