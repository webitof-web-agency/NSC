import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { isTokenExpired } from "@utils/auth";
import { logoutCustomer } from "@store/customerAuthSlice";

const CustomerProtectedRoute: React.FC = () => {
    const { isAuthenticated, token } = useSelector((state: RootState) => state.customerAuth);
    const dispatch = useDispatch();
    const location = useLocation();

    if (!isAuthenticated || !token || isTokenExpired(token)) {
        dispatch(logoutCustomer());
        return <Navigate to="/customer/login" state={{ from: location.pathname }} replace />;
    }

    return <Outlet />;
};

export default CustomerProtectedRoute;
