import { useEffect, useState } from "react";
import { useDebounce } from "./useDebounce";

type SearchParamValue = string | number | boolean | null | undefined;

type UseDebouncedSearchParamArgs = {
    search: string;
    limit: number;
    setSearchParams: (params: Record<string, string>) => void;
    delay?: number;
    extraParams?: Record<string, SearchParamValue>;
};

export function useDebouncedSearchParam({
    search,
    limit,
    setSearchParams,
    delay = 500,
    extraParams = {},
}: UseDebouncedSearchParamArgs) {
    const [searchInput, setSearchInput] = useState<string>(search);
    const debouncedSearchInput = useDebounce(searchInput, delay);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (debouncedSearchInput === search) return;

        const params: Record<string, string> = {
            search: debouncedSearchInput,
            limit: String(limit),
            page: "1",
        };

        Object.entries(extraParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                params[key] = String(value);
            }
        });

        setSearchParams(params);
    }, [debouncedSearchInput, search, limit, setSearchParams, extraParams]);

    return [searchInput, setSearchInput] as const;
}
