import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface CustomTimePickerProps {
    value: string; // "HH:mm" in 24h
    onChange: (value: string) => void;
    isDisabled?: boolean;
}

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const ampmOptions = ['AM', 'PM'];

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isDisabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Parse value to 12h format
    const [h24, m] = (value || '00:00').split(':');
    const h24Num = parseInt(h24, 10) || 0;
    const isPM = h24Num >= 12;

    const currentHour12 = h24Num % 12 === 0 ? 12 : h24Num % 12;
    const hourStr = currentHour12.toString().padStart(2, '0');
    const minStr = (m || '00').padStart(2, '0');
    const ampmStr = isPM ? 'PM' : 'AM';

    const [selectedHour, setSelectedHour] = useState(hourStr);
    const [selectedMinute, setSelectedMinute] = useState(minStr);
    const [selectedAmpm, setSelectedAmpm] = useState(ampmStr);

    // Sync external value changes to local state
    useEffect(() => {
        const [newH, newM] = (value || '00:00').split(':');
        const newHNum = parseInt(newH, 10) || 0;
        const pm = newHNum >= 12;
        const h12 = newHNum % 12 === 0 ? 12 : newHNum % 12;
        setSelectedHour(h12.toString().padStart(2, '0'));
        setSelectedMinute((newM || '00').padStart(2, '0'));
        setSelectedAmpm(pm ? 'PM' : 'AM');
    }, [value]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateTime = (h: string, min: string, ap: string) => {
        let hNum = parseInt(h, 10);
        if (ap === 'PM' && hNum < 12) hNum += 12;
        if (ap === 'AM' && hNum === 12) hNum = 0;
        const finalH = hNum.toString().padStart(2, '0');
        onChange(`${finalH}:${min}`);
    };

    const handleHourClick = (h: string) => {
        setSelectedHour(h);
        updateTime(h, selectedMinute, selectedAmpm);
    };

    const handleMinuteClick = (m: string) => {
        setSelectedMinute(m);
        updateTime(selectedHour, m, selectedAmpm);
    };

    const handleAmpmClick = (ap: string) => {
        setSelectedAmpm(ap);
        updateTime(selectedHour, selectedMinute, ap);
    };

    // Auto-scroll logic for selected items when opened
    const hourRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Small timeout to allow DOM to render before scrolling
            setTimeout(() => {
                const hourEl = document.getElementById(`hour-${selectedHour}`);
                if (hourEl && hourRef.current) {
                    hourRef.current.scrollTop = hourEl.offsetTop - hourRef.current.offsetTop - 80;
                }
                const minEl = document.getElementById(`min-${selectedMinute}`);
                if (minEl && minRef.current) {
                    minRef.current.scrollTop = minEl.offsetTop - minRef.current.offsetTop - 80;
                }
            }, 10);
        }
    }, [isOpen]);

    return (
        <div className="relative min-w-[140px]" ref={wrapperRef}>
            <div
                className={`h-10 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 transition-colors flex items-center justify-between ${isDisabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer focus-within:ring-1 focus-within:ring-primary focus-within:border-primary hover:border-primary'}`}
                onClick={() => !isDisabled && setIsOpen(!isOpen)}
            >
                <span>{`${selectedHour}:${selectedMinute} ${selectedAmpm}`}</span>
                <Clock size={16} className="text-gray-500" />
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 bg-white border border-gray-200 shadow-xl rounded-md flex overflow-hidden w-[210px] select-none left-0 lg:left-auto">
                    {/* Hours */}
                    <div className="flex-1 h-64 overflow-y-auto no-scrollbar border-r border-gray-100 scroll-smooth" ref={hourRef}>
                        {hours.map(h => (
                            <div
                                key={h}
                                id={`hour-${h}`}
                                onClick={() => handleHourClick(h)}
                                className={`text-center py-2.5 text-sm cursor-pointer transition-colors ${h === selectedHour ? 'bg-primary text-white font-medium sticky top-0 bottom-0 z-10' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                {h}
                            </div>
                        ))}
                    </div>
                    {/* Minutes */}
                    <div className="flex-1 h-64 overflow-y-auto no-scrollbar border-r border-gray-100 scroll-smooth" ref={minRef}>
                        {minutes.map(m => (
                            <div
                                key={m}
                                id={`min-${m}`}
                                onClick={() => handleMinuteClick(m)}
                                className={`text-center py-2.5 text-sm cursor-pointer transition-colors ${m === selectedMinute ? 'bg-primary text-white font-medium sticky top-0 bottom-0 z-10' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                {m}
                            </div>
                        ))}
                    </div>
                    {/* AM / PM */}
                    <div className="flex-1 h-64 overflow-y-auto no-scrollbar scroll-smooth">
                        {ampmOptions.map(ap => (
                            <div
                                key={ap}
                                onClick={() => handleAmpmClick(ap)}
                                className={`text-center py-2.5 text-sm cursor-pointer transition-colors ${ap === selectedAmpm ? 'bg-primary text-white font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                {ap}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default CustomTimePicker;
