import { useCallback } from "react";

/**
 * Hook for formatting dates based on a custom format string.
 * This version uses a more robust token matching system to correctly handle
 * multi-character formats like 'dd' or 'YYYY'.
 *
 * Supported tokens:
 * - YYYY = 4-digit year (e.g., 2025)
 * - YY   = 2-digit year (e.g., 25)
 * - MMMM = Full month name (e.g., August)
 * - MMM  = Short month name (e.g., Aug)
 * - MM   = Month with leading zero (e.g., 08)
 * - M    = Month without leading zero (e.g., 8)
 * - DDDD = Full day name (e.g., Saturday)
 * - DDD  = Short day name (e.g., Sat)
 * - DD   = Day of the month with leading zero (e.g., 05)
 * - D    = Day of the month without leading zero (e.g., 5)
 */
const useDateFormatter = () => {
    const formatDate = useCallback((date: Date | string, format: string): string => {
        const d = typeof date === "string" ? new Date(date) : date;

        // Check for invalid date
        if (isNaN(d.getTime())) {
            return "Invalid Date";
        }

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const dayNames = [
            "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
        ];

        const regex = /YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|DD|D|HH|H|hh|h|mm|m|ss|s|A|a|g|G|i/g;

        return format.replace(regex, (token) => {
            const hours = d.getHours();
            const hours12 = hours % 12 || 12;
            const ampm = hours >= 12 ? 'PM' : 'AM';

            switch (token) {
                case "YYYY":
                    return d.getFullYear().toString();
                case "YY":
                    return d.getFullYear().toString().slice(-2);
                case "MMMM":
                    return monthNames[d.getMonth()];
                case "MMM":
                    return monthNames[d.getMonth()].substring(0, 3);
                case "MM":
                    return String(d.getMonth() + 1).padStart(2, "0");
                case "M":
                    return String(d.getMonth() + 1);
                case "DDDD":
                    return dayNames[d.getDay()];
                case "DDD":
                    return dayNames[d.getDay()].substring(0, 3);
                case "DD":
                    return String(d.getDate()).padStart(2, "0");
                case "D":
                    return String(d.getDate());
                case "HH":
                    return String(hours).padStart(2, "0");
                case "H":
                case "G":
                    return String(hours);
                case "hh":
                    return String(hours12).padStart(2, "0");
                case "h":
                case "g":
                    return String(hours12);
                case "mm":
                case "i":
                    return String(d.getMinutes()).padStart(2, "0");
                case "m":
                    return String(d.getMinutes());
                case "ss":
                    return String(d.getSeconds()).padStart(2, "0");
                case "s":
                    return String(d.getSeconds());
                case "A":
                    return ampm;
                case "a":
                    return ampm.toLowerCase();
                default:
                    return token;
            }
        });
    }, []);

    return { formatDate };
};

export default useDateFormatter;
