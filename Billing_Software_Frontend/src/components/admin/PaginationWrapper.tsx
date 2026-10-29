import React from "react";
import { Pagination } from "@mui/material";
import type { PaginationProps } from "@mui/material";

interface PaginationWrapperProps extends Omit<PaginationProps, 'onChange'> {
  page: number;
  count: number;
  from: number;
  to: number;
  total: number;
  onChange: (event: React.ChangeEvent<unknown>, page: number) => void;
  paginationVariant?: any;
  paginationShape?: 'rounded' | 'circular';
}

const PaginationWrapper: React.FC<PaginationWrapperProps> = ({
  page,
  count,
  from,
  to,
  total,
  onChange,
  paginationVariant,
  paginationShape,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 text-center sm:text-left">
      <p className="text-gray-950 text-xs sm:text-sm font-medium">
        Showing {total > 0 ? from : 0} to {to} of {total} entries
      </p>

      <Pagination
        count={count}
        page={page}
        onChange={onChange}
        variant={paginationVariant || 'outlined'}
        shape={paginationShape || 'rounded'}
        size="small"
        sx={{
          '& .MuiPaginationItem-root': {
            // color: '#7538fe',
            color: '#A43275',
            fontWeight: 'medium',
            minWidth: { xs: '28px', sm: '32px' },
            height: { xs: '28px', sm: '32px' },
            margin: { xs: '0 1px', sm: '0 3px' },
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
          },
          '& .MuiPaginationItem-page.Mui-selected': {
            // backgroundColor: '#7538fe',
            backgroundColor: '#A43275',
            color: 'white',
            '&:hover': {
              // backgroundColor: '#7538fe',
              backgroundColor: '#A43275',
            },
          },
          '& .MuiPaginationItem-page:hover': {
            // backgroundColor: '#ede9fe',
            backgroundColor: '#CCA2BB',
          },
        }}
      />
    </div>
  );
};

export default PaginationWrapper;
