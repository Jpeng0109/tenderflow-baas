import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EtherscanDashboard from './components/EtherscanDashboard';
import TransactionDetail from './components/TransactionDetail';
import BlockDetail from './components/BlockDetail';
import './styles/etherscan.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EtherscanDashboard />} />
        <Route path="/block/:num" element={<BlockDetail />} />
        <Route path="/tx/:hash" element={<TransactionDetail />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
