import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import Cookies from "js-cookie";
import Constants from "../../constants/api";

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

            //  Store securely in cookies (7 days expiry)
            Cookies.set("authToken", token, { secure: true, sameSite: "Strict", expires: 7 });
            Cookies.set("authUser", JSON.stringify(user), { secure: true, sameSite: "Strict", expires: 7 });

            // Electron is local-first. The local backend keeps a separate cloud sync
            // credential, so never replace it with this local API token.
            if (typeof window !== 'undefined' && 'electronAPI' in window) {
                void window.electronAPI?.triggerSync();
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

                    // The cloud sync credential is owned by the local backend. Ask the
                    // main process to use it without copying the local JWT into that slot.
                    if (typeof window !== 'undefined' && 'electronAPI' in window) {
                        void window.electronAPI?.triggerSync();
                    }
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
