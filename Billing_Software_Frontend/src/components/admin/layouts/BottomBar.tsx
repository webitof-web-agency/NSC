import { LogOut, Settings, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "@store/auth/authSlice";
import type { AppDispatch } from "@store/index";
import { useDispatch } from "react-redux";
import type { RootState } from '@store/index';
import { useSelector } from 'react-redux';

const BottomBar: React.FC = () => {
    const navigate = useNavigate();
    const dispatch: AppDispatch = useDispatch();

    const { user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);

    return (
        <div className="bottom-0 px-6 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
                <LogOut
                    size={36}
                    onClick={() => dispatch(logout())}
                    className="text-primary p-2 rounded-lg cursor-pointer bg-gray-200 hover:bg-gray-300 transition-all"
                />
                {user?.user_type === 1 || systemSettings?.permissions?.some(p => p.moduleSlug === 'settings' && p.view) ? (
                    <Settings
                        onClick={() => navigate("/admin/settings/company-settings")}
                        size={36}
                        className="text-primary p-2 rounded-lg cursor-pointer bg-gray-200 hover:bg-gray-300 transition-all"
                    />
                ) : null}
                <UserCircle2
                    onClick={() => navigate("/admin/settings/profile")}
                    size={36}
                    className="text-primary p-2 rounded-lg cursor-pointer bg-gray-200 hover:bg-gray-300 transition-all"
                />
            </div>
        </div>
    );
};

export default BottomBar;
