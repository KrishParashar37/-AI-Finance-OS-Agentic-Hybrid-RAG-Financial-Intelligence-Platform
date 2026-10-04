"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Bitcoin, LineChart, PieChart, RefreshCcw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

const MOCK_PORTFOLIO_DATA = [
  { date: "Jan", value: 125000 },
  { date: "Feb", value: 132000 },
  { date: "Mar", value: 128000 },
  { date: "Apr", value: 145000 },
  { date: "May", value: 152000 },
  { date: "Jun", value: 148000 },
  { date: "Jul", value: 165000 },
];

const MOCK_ASSETS = [
  { id: 1, name: "Apple Inc. (AAPL)", type: "Stock", value: 45000, change: 2.5, icon: LineChart, color: "text-blue-500" },
  { id: 2, name: "Bitcoin (BTC)", type: "Crypto", value: 65000, change: -1.2, icon: Bitcoin, color: "text-orange-500" },
  { id: 3, name: "S&P 500 ETF (VOO)", type: "Index Fund", value: 35000, change: 1.8, icon: PieChart, color: "text-emerald-500" },
  { id: 4, name: "Tesla (TSLA)", type: "Stock", value: 20000, change: 5.4, icon: LineChart, color: "text-red-500" },
];

export function InvestmentsFeature() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investments Dashboard</h1>
          <p className="text-muted-foreground">Track your stocks, crypto, and mutual funds portfolio.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
        >
          <RefreshCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Sync Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-card rounded-xl border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Total Portfolio Value
          </p>
          <p className="text-3xl font-bold mt-2">{money(165000)}</p>
          <p className="text-sm text-emerald-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> +12.5% All Time
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-card rounded-xl border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Today's Returns</p>
          <p className="text-3xl font-bold mt-2 text-emerald-500">+{money(1250)}</p>
          <p className="text-sm text-emerald-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> +0.76% Today
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-card rounded-xl border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Cash Balance</p>
          <p className="text-3xl font-bold mt-2">{money(12500)}</p>
          <p className="text-sm text-muted-foreground mt-2">Available to invest</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 bg-card rounded-xl border shadow-sm h-[400px]">
        <h2 className="text-lg font-semibold mb-4">Portfolio Performance (6 Months)</h2>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={MOCK_PORTFOLIO_DATA}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-background border rounded-lg shadow-md p-3">
                      <p className="font-semibold">{payload[0].payload.date}</p>
                      <p className="text-primary">{money(Number(payload[0].value))}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-4">
        <h2 className="text-lg font-semibold">Your Assets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOCK_ASSETS.map((asset) => (
            <div key={asset.id} className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full bg-secondary ${asset.color}`}>
                  <asset.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold">{asset.name}</p>
                  <p className="text-sm text-muted-foreground">{asset.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">{money(asset.value)}</p>
                <p className={`text-sm flex items-center justify-end gap-1 ${asset.change >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {asset.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(asset.change)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
