import { ToastContainer } from 'react-toastify';
import AppRoutes from './routes/AppRoutes';
import type { AppDispatch, RootState } from './store';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { hydrateFromStorage, fetchSystemSettings } from '@store/systemSettingsSlice';
import { SetupStatusProvider } from '@context/SetupStatusContext';
import ElectronStatusBar from '@components/ElectronStatusBar';

function App() {
  const dispatch: AppDispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch(hydrateFromStorage())
      .unwrap()
      .then((settings) => {
        if (!settings && token) {
          return dispatch(fetchSystemSettings(token));
        }
        if (settings && token) {
          // refresh with latest settings when authenticated
          return dispatch(fetchSystemSettings(token));
        }
      })
      .finally(() => {
        setHydrated(true);
      });
  }, [dispatch, token]);

  // Block rendering until hydration done
  if (!hydrated) {
    return <></>;
  }

  return (
    <>
      {/* Electron-only top status bar — invisible in browser */}
      <ElectronStatusBar />
      <SetupStatusProvider>
        <AppRoutes />
      </SetupStatusProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
