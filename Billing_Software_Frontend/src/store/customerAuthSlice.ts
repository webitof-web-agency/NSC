import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import Cookies from "js-cookie";
import Constants from "@constants/api";

export interface CustomerAuthState {
    isAuthenticated: boolean;
    customer: any;
    token: string | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: CustomerAuthState = {
    isAuthenticated: false,
    customer: null,
    token: "",
    isLoading: false,
    error: null,
};

export const loginCustomer = createAsyncThunk(
    "customerAuth/login",
    async (credentials: { phone: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await axios.post(Constants.CUSTOMER_LOGIN_URL, credentials);
            const { token, customer } = response.data;

            Cookies.set("customerAuthToken", token, { secure: true, sameSite: "Strict", expires: 7 });
            Cookies.set("customerAuthUser", JSON.stringify(customer), { secure: true, sameSite: "Strict", expires: 7 });

            return { token, customer };
        } catch (error: any) {
            let errorMessage = "Customer login failed. Please try again.";
            if (axios.isAxiosError(error) && error.response) {
                errorMessage = error.response.data.message || error.response.statusText;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return rejectWithValue(errorMessage);
        }
    }
);

const customerAuthSlice = createSlice({
    name: "customerAuth",
    initialState,
    reducers: {
        logoutCustomer: (state) => {
            state.isAuthenticated = false;
            state.customer = null;
            state.token = null;
            state.error = null;
            Cookies.remove("customerAuthToken");
            Cookies.remove("customerAuthUser");
        },
        initializeCustomerAuth: (state) => {
            const token = Cookies.get("customerAuthToken");
            const customer = Cookies.get("customerAuthUser");

            if (token && customer) {
                try {
                    state.token = token;
                    state.customer = JSON.parse(customer);
                    state.isAuthenticated = true;
                } catch (error) {
                    state.isAuthenticated = false;
                    state.customer = null;
                    state.token = null;
                    Cookies.remove("customerAuthToken");
                    Cookies.remove("customerAuthUser");
                }
            }
        },
        setCustomerSession: (state, action: PayloadAction<{ token: string; customer: any }>) => {
            state.isAuthenticated = true;
            state.token = action.payload.token;
            state.customer = action.payload.customer;
            state.error = null;
            Cookies.set("customerAuthToken", action.payload.token, { secure: true, sameSite: "Strict", expires: 7 });
            Cookies.set("customerAuthUser", JSON.stringify(action.payload.customer), { secure: true, sameSite: "Strict", expires: 7 });
        },
        updateCustomerProfileState: (state, action: PayloadAction<any>) => {
            state.customer = action.payload;
            Cookies.set("customerAuthUser", JSON.stringify(action.payload), { secure: true, sameSite: "Strict", expires: 7 });
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginCustomer.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginCustomer.fulfilled, (state, action: PayloadAction<{ token: string; customer: any }>) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.customer = action.payload.customer;
                state.error = null;
            })
            .addCase(loginCustomer.rejected, (state, action: PayloadAction<any>) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.customer = null;
                state.token = null;
                state.error = action.payload || "Login failed.";
            });
    }
});

export const { logoutCustomer, initializeCustomerAuth, setCustomerSession, updateCustomerProfileState } = customerAuthSlice.actions;
export default customerAuthSlice.reducer;
