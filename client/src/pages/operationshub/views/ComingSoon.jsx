import React from 'react';
import { FiClock } from 'react-icons/fi';

const ComingSoon = ({ moduleName }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-200 rounded-2xl shadow-sm animate-in fade-in duration-300">
    <FiClock className="h-12 w-12 text-gray-300 mb-4" />
    <h2 className="text-xl font-bold text-gray-900 capitalize">{moduleName}</h2>
    <p className="text-sm text-gray-500 mt-2">This module is currently under construction.</p>
  </div>
);

export default ComingSoon;