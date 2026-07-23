import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import StatusBadge, { EmptyState } from '../../components/UIComponents';
import { Users } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const SubscriberManagement = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchSubscribers(); }, []);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'retailer')
        .order('created_at', { ascending: false });
      setSubscribers(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { header: 'Name', accessor: 'full_name', render: r => r.full_name || '—' },
    { header: 'Business', accessor: 'company_name', render: r => r.company_name || '—' },
    {
      header: 'Status', accessor: 'account_status',
      render: r => {
        const typeMap = { active: 'success', trial: 'info', pending: 'warning', expired: 'danger', suspended: 'danger' };
        return <StatusBadge status={r.account_status} type={typeMap[r.account_status] || 'default'} />;
      }
    },
    { header: 'Registered', accessor: 'created_at', isNumeric: true, render: r => new Date(r.created_at).toLocaleDateString('en-GB') },
    {
      header: 'Actions', accessor: 'actions', align: 'right',
      render: r => (
        <div className="flex justify-end gap-2">
          {r.account_status === 'pending' && (
            <button onClick={() => updateStatus(r.id, 'trial')} className="text-xs px-2.5 py-1.5 bg-accentSoft text-accent border border-accent/30 rounded hover:bg-accent/20 transition-colors font-medium">
              Start Trial
            </button>
          )}
          {['trial', 'pending'].includes(r.account_status) && (
            <button onClick={() => updateStatus(r.id, 'active')} className="text-xs px-2.5 py-1.5 bg-green-50 text-success border border-green-200 rounded hover:bg-green-100 transition-colors font-medium">
              Activate
            </button>
          )}
          {r.account_status === 'active' && (
            <button onClick={() => updateStatus(r.id, 'suspended')} className="text-xs px-2.5 py-1.5 bg-red-50 text-danger border border-red-200 rounded hover:bg-red-100 transition-colors font-medium">
              Suspend
            </button>
          )}
          {['suspended', 'expired'].includes(r.account_status) && (
            <button onClick={() => updateStatus(r.id, 'active')} className="text-xs px-2.5 py-1.5 bg-accentSoft text-accent border border-accent/30 rounded hover:bg-accent/20 transition-colors font-medium">
              Restore
            </button>
          )}
        </div>
      )
    }
  ];

  const updateStatus = async (userId, newStatus) => {
    if (!confirm(`Change account status to "${newStatus}"?`)) return;
    await supabase.from('profiles').update({ account_status: newStatus }).eq('id', userId);
    fetchSubscribers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora font-bold text-xl text-textPrimary tracking-tight">Subscriber Management</h1>
          <p className="text-textSecondary text-sm mt-0.5">Manage retailer accounts and access status.</p>
        </div>
      </div>
      <div className="h-[600px]">
        <DataTable
          columns={columns}
          data={subscribers}
          isLoading={isLoading}
          emptyState={
            <EmptyState icon={Users} title="No retailer accounts yet" description="Retailer accounts appear here once users register through the public registration page." />
          }
        />
      </div>
    </div>
  );
};
export default SubscriberManagement;
