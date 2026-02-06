
'use client';

import React, { useState } from 'react';
import { Loader2, Search, MessageSquare, Save } from 'lucide-react';

export default function SourcingDashboard() {
    const [category, setCategory] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const handleSearch = async () => {
        if (!category) return;
        setIsLoading(true);
        addLog(`Starting research for: ${category}`);

        try {
            // In a real app, this would call a server action or API route
            // For now, we simulate the API call to our new modules
            const res = await fetch('/api/debug/sourcing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'research', category })
            });

            const data = await res.json();

            if (data.suppliers) {
                setSuppliers(data.suppliers);
                addLog(`Found ${data.suppliers.length} potential suppliers.`);
            } else {
                addLog('No suppliers found or error occurred.');
            }

        } catch (error) {
            addLog(`Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartChat = async (supplier: any) => {
        addLog(`Initiating AI Chat with ${supplier.name} (${supplier.phone})...`);
        try {
            const res = await fetch('/api/debug/sourcing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'initiate_chat', supplier })
            });
            const data = await res.json();
            addLog(`Chat Result: ${data.message || 'Sent'}`);
        } catch (error) {
            addLog(`Chat Error: ${error}`);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Search className="w-8 h-8 text-blue-600" />
                Supplier AI Agent
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Panel: Controls */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4">Research Parameters</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                                <input
                                    type="text"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="e.g. Mobile Covers, Cables"
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={isLoading || !category}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                            >
                                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                                Find Suppliers
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-900 text-green-400 p-4 rounded-xl shadow-sm h-[400px] overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? <p className="text-gray-500">System ready...</p> : logs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Results */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[600px]">
                        <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
                            <span>Discovered Suppliers</span>
                            <span className="text-sm font-normal text-gray-500">{suppliers.length} found</span>
                        </h2>

                        {suppliers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Search className="w-12 h-12 mb-2 opacity-20" />
                                <p>No suppliers loaded yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {suppliers.map((s, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900">{s.name}</h3>
                                            <p className="text-sm text-gray-600 flex items-center gap-2">
                                                <span className="font-mono bg-gray-100 px-1 rounded">{s.phone}</span>
                                                <span className="text-gray-400">•</span>
                                                <span>{s.location || 'Unknown Location'}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{s.description}</p>
                                        </div>
                                        <div className="flex flex-col gap-2 justify-center">
                                            <button
                                                onClick={() => handleStartChat(s)}
                                                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Contact
                                            </button>
                                            <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2">
                                                <Save className="w-4 h-4" />
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
