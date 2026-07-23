import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/UIComponents';
import { supabase } from '../supabaseClient';

const ProductLogs = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // Just fetching recent raw products for demonstration
      const { data, error } = await supabase
        .from('raw_products')
        .select('*, suppliers(name)')
        .order('scraped_at', { ascending: false })
        .limit(50);
        
      if (data) setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const tableColumns = [
    { header: 'Product Name', accessor: 'raw_title' },
    { header: 'Barcode', accessor: 'raw_barcode', isNumeric: true },
    { 
      header: 'Supplier', 
      accessor: 'supplier',
      render: (row) => <span className="capitalize">{row.suppliers?.name || 'Unknown'}</span>
    },
    { header: 'Pack Info', accessor: 'raw_pack_info' },
    { 
      header: 'Scraped At', 
      accessor: 'scraped_at',
      isNumeric: true,
      render: (row) => new Date(row.scraped_at).toLocaleString()
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-sora font-semibold text-textPrimary">Raw Products & Logs</h2>
      <div className="h-[600px]">
        <DataTable 
          columns={tableColumns} 
          data={products} 
          isLoading={isLoading}
          emptyState={<div className="text-textSecondary">No raw products found.</div>}
        />
      </div>
    </div>
  );
};

export default ProductLogs;
