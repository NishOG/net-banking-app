import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Download, RefreshCw, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const TransactionItem = React.memo(({ transaction, index }) => {
  const isIncome = transaction.type === 'Income' || transaction.type === 'Transfer In' || transaction.type === 'Salary Credit';
  const formattedAmount = `₹${Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <motion.tr 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
            {isIncome ? (
              <ArrowDownRight className="h-5 w-5 text-secondary" />
            ) : (
              <ArrowUpRight className="h-5 w-5 text-gray-400 dark:text-gray-400" />
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</div>
            <div className="text-sm text-gray-500">{transaction.category}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-700 dark:text-gray-300">{new Date(transaction.created_at).toLocaleDateString()}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{transaction.reference_id}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500 dark:text-gray-400">Account</div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 mt-1 border border-green-200 dark:border-green-500/20">
          Completed
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className={clsx(
          "text-sm font-bold",
          isIncome ? "text-secondary" : "text-gray-900 dark:text-white"
        )}>
          {isIncome ? '+' : '-'}{formattedAmount}
        </div>
      </td>
    </motion.tr>
  );
});

export default function TransactionHistory() {
  const { user, account } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const accountNumber = account?.account_number;

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .or(`from_account.eq.${accountNumber},to_account.eq.${accountNumber}`)
          .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        if (isMounted) setTransactions(data || []);
    } catch {
      setError("Failed to load transactions. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    if (accountNumber) {
      fetchData();
    } else {
      setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 0);
    }
    
    return () => { isMounted = false; };
  }, [accountNumber]);

  const handleManualRefresh = async () => {
    if (!accountNumber) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .or(`from_account.eq.${accountNumber},to_account.eq.${accountNumber}`)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      setTransactions(data || []);
    } catch {
      setError("Failed to load transactions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isIncome = t.type === 'Income' || t.type === 'Transfer In' || t.type === 'Salary Credit';
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.reference_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'All' || 
                           (filter === 'Income' && isIncome) || 
                           (filter === 'Expense' && !isIncome);
      return matchesSearch && matchesFilter;
    });
  }, [transactions, searchTerm, filter]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Qubix Bank', 14, 22);
    
    doc.setFontSize(14);
    doc.text('Account Statement', 14, 32);
    
    doc.setFontSize(10);
    doc.text(`Account Name: ${user?.email}`, 14, 42);
    doc.text(`Account Number: ${account?.account_number || 'N/A'}`, 14, 48);
    
    const today = new Date().toLocaleDateString();
    doc.text(`Generated On: ${today}`, 14, 54);

    let currentBal = Number(account?.balance || 0);
    let totalCredits = 0;
    let totalDebits = 0;
    const tableData = [];
    
    let runningBal = currentBal;
    
    // transactions are newest first
    for (const tx of transactions) {
      const isIncome = tx.type === 'Income' || tx.type === 'Transfer In' || tx.type === 'Salary Credit';
      const amt = Number(tx.amount);
      
      if (isIncome) totalCredits += amt;
      else totalDebits += amt;
      
      const rowBal = runningBal;
      
      // prepend so table is oldest first
      tableData.unshift([
        new Date(tx.created_at).toLocaleDateString(),
        tx.description,
        isIncome ? '' : `Rs. ${amt.toFixed(2)}`,
        isIncome ? `Rs. ${amt.toFixed(2)}` : '',
        `Rs. ${rowBal.toFixed(2)}`
      ]);
      
      if (isIncome) runningBal -= amt;
      else runningBal += amt;
    }

    doc.autoTable({
      startY: 60,
      head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    const finalY = doc.lastAutoTable.finalY || 60;
    doc.text(`Total Credits: Rs. ${totalCredits.toFixed(2)}`, 14, finalY + 10);
    doc.text(`Total Debits: Rs. ${totalDebits.toFixed(2)}`, 14, finalY + 16);

    doc.save('statement.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">View and download your recent activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            title="Refresh Transactions"
          >
            <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin text-primary")} />
          </button>
          <button 
            onClick={generatePDF}
            disabled={loading || error}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Statement
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-900/30">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
              placeholder="Search by description or reference ID..."
            />
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500 hidden md:block" />
            <div className="flex bg-white dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200 dark:border-gray-700 w-full md:w-auto">
              {['All', 'Income', 'Expense'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={clsx(
                    'flex-1 md:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    filter === type 
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm dark:shadow' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {error ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{error}</h3>
              <button 
                onClick={handleManualRefresh}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date & Ref
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">Loading transactions...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.map((transaction, index) => (
                  <TransactionItem 
                    key={transaction.id} 
                    transaction={transaction} 
                    index={index} 
                  />
                ))}
                
                {!loading && !error && filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-10 w-10 text-gray-400 dark:text-gray-600 mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 text-lg">No transactions found</p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
