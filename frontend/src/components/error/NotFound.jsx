// frontend/src/components/error/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, Compass } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-red-600">404</h1>
          <div className="relative">
            <Compass className="h-24 w-24 text-gray-300 mx-auto animate-spin-slow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">🧭</span>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Page Not Found
        </h2>
        
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved. 
          Let's get you back on track!
        </p>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search for help..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link
            to="/"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
          >
            <Home className="h-8 w-8 text-red-600 mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">Go to Dashboard</h3>
            <p className="text-sm text-gray-500">Return to your dashboard</p>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
          >
            <ArrowLeft className="h-8 w-8 text-red-600 mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">Go Back</h3>
            <p className="text-sm text-gray-500">Return to previous page</p>
          </button>
        </div>

        {/* Help Links */}
        <div className="mt-8 text-sm text-gray-500">
          <p className="mb-2">Popular destinations:</p>
          <div className="flex justify-center space-x-6">
            <Link to="/vehicles" className="text-red-600 hover:underline">
              Vehicles
            </Link>
            <Link to="/expenses" className="text-red-600 hover:underline">
              Expenses
            </Link>
            <Link to="/reports" className="text-red-600 hover:underline">
              Reports
            </Link>
            <Link to="/help" className="text-red-600 hover:underline">
              Help Center
            </Link>
          </div>
        </div>
      </div>

      {/* Add this missing style for the spinning animation */}
      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default NotFound;