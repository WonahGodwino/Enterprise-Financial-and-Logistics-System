import React from 'react';
import { ExpenseTracker } from '../../components/expenses/ExpenseTracker';

export const ExpenseReportsPage = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Expense Reports</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Export</button>
          <button className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Print</button>
          <button className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Share</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <ExpenseTracker />
        </div>
      </div>
    </div>
  );
};