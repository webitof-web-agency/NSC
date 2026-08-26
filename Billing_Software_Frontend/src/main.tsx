import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HashRouter, BrowserRouter } from 'react-router-dom';
import './index.css';
import { initializeAuth } from './store/auth/authSlice';
import { initializeCustomerAuth } from './store/customerAuthSlice';
import { store } from './store';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
store.dispatch(initializeAuth());
store.dispatch(initializeCustomerAuth());

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { ErrorBoundary } from './components/ErrorBoundary';

// Detect if we are inside Electron
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
const RouterConfig = isElectron ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterConfig>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <HelmetProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </HelmetProvider>
        </LocalizationProvider>
      </RouterConfig>
    </Provider>
  </React.StrictMode>
);
