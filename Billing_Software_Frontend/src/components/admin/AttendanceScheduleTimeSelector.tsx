import React from "react";
import CustomTimePicker from "./CustomTimePicker";

interface AttendanceScheduleTimeSelectorProps {
    startTime: string;
    endTime: string;
    onChange: (next: { startTime: string; endTime: string }) => void;
    onSave: () => void;
    isSaving?: boolean;
    isDisabled?: boolean;
    hasChanges?: boolean;
}

const AttendanceScheduleTimeSelector: React.FC<AttendanceScheduleTimeSelectorProps> = ({
    startTime,
    endTime,
    onChange,
    onSave,
    isSaving = false,
    isDisabled = false,
    hasChanges = false
}) => {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-3">
            <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 pb-1">Schedule Check-In</label>
                <CustomTimePicker
                    value={startTime}
                    onChange={(val) => onChange({ startTime: val, endTime })}
                    isDisabled={isDisabled || isSaving}
                />
            </div>
            <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 pb-1">Schedule Check-Out</label>
                <CustomTimePicker
                    value={endTime}
                    onChange={(val) => onChange({ startTime, endTime: val })}
                    isDisabled={isDisabled || isSaving}
                />
            </div>
            <button
                type="button"
                onClick={onSave}
                disabled={isDisabled || isSaving || !hasChanges}
                className="h-10 px-4 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? "Saving..." : "Save Schedule"}
            </button>
        </div>
    );
};

export default AttendanceScheduleTimeSelector;
