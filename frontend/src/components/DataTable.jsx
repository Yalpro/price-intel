import React from 'react';

const DataTable = ({ columns, data, onRowClick, isLoading, emptyState, errorState }) => {
  if (errorState) return errorState;

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-[#121815] sticky top-0 z-10 border-b border-border">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`py-3.5 px-4 text-[11px] font-inter font-bold text-textPrimary uppercase tracking-wider ${col.align === 'right' ? 'text-right' : ''} ${col.width || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-surface">
            {isLoading ? (
              Array(5).fill(0).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-${rowIndex}-${colIndex}`} className="py-3 px-4">
                      <div className={`h-4 bg-[#1A221D] rounded animate-pulse ${col.align === 'right' ? 'ml-auto' : ''}`} style={{ width: col.align === 'right' ? '60%' : '80%' }}></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`group transition-colors duration-150 ${onRowClick ? 'cursor-pointer hover:bg-[#1A221D]/60' : 'hover:bg-[#161D19]/40'}`}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`py-3 px-4 text-xs ${col.isNumeric ? 'font-mono tabular-nums text-textPrimary' : 'font-inter text-textPrimary'} ${col.align === 'right' ? 'text-right' : ''}`}
                    >
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
