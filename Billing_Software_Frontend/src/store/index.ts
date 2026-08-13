import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import customerAuthReducer from './customerAuthSlice';
import systemReducer from './systemSettingsSlice';
export const store = configureStore({
  reducer: {
    auth: authReducer,
    customerAuth: customerAuthReducer,
    systemSettings: systemReducer
  },
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
