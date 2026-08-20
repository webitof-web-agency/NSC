import { useState, useRef, useEffect } from "react";
import { PlusCircle, X } from "lucide-react";

interface Item {
    id: string | number;
    name: string;
    subLabel?: string;
}

interface SmartDropdownProps {
    items: Item[];
    value: string;
    onChange: (value: string) => void; // called only when user types
    onSelect: (item: Item | null) => void; // called when user selects/unselects
    onAddNew?: () => void;
    placeholder?: string;
    addNewLabel?: string;
    selectedItem?: Item | null; // for showing selected item
    serverside?: boolean; // true = parent handles filtering; false = client-side filter
    disabled?: boolean;
    loading?: boolean;
    maxLength?: number;
    sanitizeInput?: (value: string) => string;
    label?: string;
    inputRef?: React.Ref<HTMLInputElement>;
    showItemDetails?: boolean;
}

const SmartDropdown: React.FC<SmartDropdownProps> = ({
    items,
    onChange,
    onSelect,
    onAddNew,
    placeholder,
    addNewLabel = "Add New Item",
    selectedItem,
    serverside = true,
    disabled = false,
    loading = false,
    maxLength,
    sanitizeInput,
    label,
    inputRef,
    showItemDetails = false,
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    const [displayInput, setDisplayInput] = useState<string>(
        typeof selectedItem?.name === "string" ? selectedItem.name : ""
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sync displayInput if parent selectedItem changes
    useEffect(() => {
        setDisplayInput(selectedItem?.subLabel || selectedItem?.name || "");
    }, [selectedItem]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown) return;

        if (e.key === "ArrowDown") {
            e.preventDefault(); // prevent cursor jump
            setActiveIndex((prev) => (prev + 1) % items.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault(); // prevent cursor jump
            setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault(); // prevent form submit
            const selected = filteredItems[activeIndex];
            if (selected) {
                onSelect(selected);
                setDisplayInput(selected.subLabel || selected.name);
                setShowDropdown(false);
            }
        }
    };


    const filteredItems = !serverside
        ? items.filter(item =>
            (item.name || "")
                .toLowerCase()
                .includes((displayInput || "").toLowerCase())
        )
        : items;

    const makeUcFirst = (str?: string) => {
        if (!str || typeof str !== "string") return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    };
    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className={`p-2 h-10 mt-1 w-full pr-8 border text-gray-700 text-sm border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder={placeholder}
                    value={makeUcFirst(displayInput)}
                    onChange={(e) => {
                        const nextValue = sanitizeInput
                            ? sanitizeInput(e.target.value)
                            : e.target.value;
                        setDisplayInput(nextValue);
                        onChange(nextValue);
                        setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    maxLength={maxLength}
                />

                {selectedItem && (
                    <button
                        type="button"
                        aria-label="Clear selection"
                        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-red-500"
                        onClick={() => {
                            onSelect(null);
                            setDisplayInput("");
                            onChange("");
                            setShowDropdown(false);
                        }}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {showDropdown && (
                <div className="absolute top-full left-0 w-full bg-white text-gray-950 border border-gray-200 z-50 rounded-md shadow-lg">
                    {/* Items section (scrollable) */}
                    <ul className="max-h-40 overflow-auto">
                        {!loading && filteredItems.length > 0 && (
                            filteredItems.map((item, index) => (
                                <li
                                    key={item.id}
                                    className={`p-2 cursor-pointer hover:bg-third ${index === activeIndex ? "bg-third" : ""
                                        }`}
                                    onMouseDown={() => {
                                        onSelect(item);
                                        setDisplayInput(item.subLabel || item.name);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        {showItemDetails ? (
                                            <>
                                                <span className="text-sm font-semibold text-gray-800">
                                                    {makeUcFirst(item.name)}
                                                </span>
                                                {item.subLabel && item.subLabel !== item.name && (
                                                    <span className="mt-0.5 text-xs text-gray-500">
                                                        {item.subLabel}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="font-medium text-sm text-gray-600">
                                                {item.subLabel || item.name}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))
                        )
                        }

                        {filteredItems.length === 0 && !loading && displayInput && (
                            <li className="p-2 text-center text-gray-500 text-sm">
                                No items found for "{displayInput}"
                            </li>
                        )}

                        {loading && (
                            <li className="p-2 text-center text-gray-500 text-sm">
                                Loading...
                            </li>
                        )}
                    </ul>

                    {onAddNew && (
                        <div
                            className="p-2 border-t border-gray-200 cursor-pointer
                   hover:bg-third bottom-0 bg-white"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onAddNew();
                                setShowDropdown(false);
                            }}
                        >
                            <div className="flex items-center text-sm text-primary font-medium">
                                <PlusCircle size={16} className="mr-2" />
                                {addNewLabel}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmartDropdown;
