import React from 'react';

const DataTable = ({ columns, data, onRowClick, isLoading, emptyState, errorState }) => {
  if (errorState) return errorState;
  
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-border">
            <tr>
              {columns.map((col, i) => (
                <th 
                  key={i} 
                  className={`py-3 px-4 text-xs font-inter font-medium text-textSecondary uppercase tracking-wider ${col.align === 'right' ? 'text-right' : ''} ${col.width || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              // Skeleton loading
              Array(5).fill(0).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-${rowIndex}-${colIndex}`} className="py-3 px-4">
                      <div className={`h-4 bg-gray-100 rounded animate-pulse ${col.align === 'right' ? 'ml-auto' : ''}`} style={{ width: col.align === 'right' ? '60%' : '80%' }}></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`group transition-colors duration-150 ${onRowClick ? 'cursor-pointer hover:bg-gray-50/50' : ''}`}
                >
                  {columns.map((col, colIndex) => (
                    <td 
                      key={colIndex} 
                      className={`py-2.5 px-4 text-sm ${col.isNumeric ? 'font-mono tabular-nums text-textPrimary' : 'font-inter text-textPrimary'} ${col.align === 'right' ? 'text-right' : ''}`}
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
