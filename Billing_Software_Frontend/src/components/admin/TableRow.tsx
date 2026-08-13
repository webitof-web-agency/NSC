import { ActionMenu } from '@components/admin/ActionMenu';

type Action<T> = {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
};

type TableRowProps<T> = {
  index: number;
  row: T;
  columns: React.ReactNode[];
  actions?: Action<T>[];
};

const TableRow = <T,>({ index, row, columns, actions }: TableRowProps<T>) => {

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-1 text-sm text-gray-700">{index}</td>
      {columns.map((col, colIndex) => (
        <td key={colIndex} className={`px-3 py-1 text-sm text-gray-500 font-medium`}>
          {col}
        </td>
      ))}
      {actions && (
        <td className="px-3 py-1">
          <div className="flex justify-start">
            <ActionMenu row={row} actions={actions} />
          </div>
        </td>
      )}
    </tr>
  );
};

export default TableRow;
