'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Search, MessageSquare, Save, UserCheck, Clock, CheckCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client directly
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SourcingDashboard() {
    const [category, setCategory] = useState('');
    const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [discoveredSuppliers, setDiscoveredSuppliers] = useState<any[]>([]);
    const [savedSuppliers, setSavedSuppliers] = useState<any[]>([]);

    // Supabase client defined globally or via hook not strictly needed for this simple dashboard
    // using the const supabase defined above

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    // Fetch Saved Suppliers
    const fetchSavedSuppliers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) addLog(`Error fetching saved: ${error.message}`);
        else setSavedSuppliers(data || []);
        setIsLoading(false);
    };

    // Load saved on tab switch
    useEffect(() => {
        if (activeTab === 'saved') {
            fetchSavedSuppliers();
        }
    }, [activeTab]);

    const handleSearch = async () => {
        if (!category) return;
        setIsLoading(true);
        addLog(`Starting research for: ${category}`);

        try {
            const res = await fetch('/api/debug/sourcing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'research', category })
            });

            const data = await res.json();

            if (data.suppliers) {
                setDiscoveredSuppliers(data.suppliers);
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

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('search')}
                    className={`pb-2 px-1 font-medium ${activeTab === 'search' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                >
                    Find New Suppliers
                </button>
                <button
                    onClick={() => setActiveTab('saved')}
                    className={`pb-2 px-1 font-medium ${activeTab === 'saved' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                >
                    Saved / Responded
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Panel: Controls (Only for Search Tab) */}
                {activeTab === 'search' && (
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
                                        placeholder="e.g. Mobile Covers"
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
                )}

                {/* Right Panel: Results */}
                <div className={activeTab === 'search' ? "md:col-span-2" : "md:col-span-3"}>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[600px]">

                        {activeTab === 'search' ? (
                            <>
                                <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
                                    <span>Discovered Results</span>
                                    <span className="text-sm font-normal text-gray-500">{discoveredSuppliers.length} found</span>
                                </h2>
                                {discoveredSuppliers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <Search className="w-12 h-12 mb-2 opacity-20" />
                                        <p>Enter a category to search.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {discoveredSuppliers.map((s, i) => (
                                            <SupplierCard key={i} supplier={s} onChat={() => handleStartChat(s)} />
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
                                    <span>My Saved Suppliers</span>
                                    <button onClick={fetchSavedSuppliers} className="text-sm text-blue-600 hover:underline">Refresh</button>
                                </h2>
                                {isLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : savedSuppliers.length === 0 ? (
                                    <div className="text-center text-gray-400 py-12">No suppliers have responded yet.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {savedSuppliers.map((s, i) => (
                                            <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors border-l-4 border-l-green-500">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-gray-900">{s.name}</h3>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'verified' ? 'bg-green-100 text-green-700' :
                                                            s.status === 'responded' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {s.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 flex items-center gap-2">
                                                        <span className="font-mono bg-gray-100 px-1 rounded">{s.phone}</span>
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">Updated: {new Date(s.updated_at).toLocaleString()}</p>

                                                    {s.is_verified && (
                                                        <div className="flex items-center gap-1 text-green-600 text-xs mt-2 font-medium">
                                                            <CheckCircle className="w-3 h-3" /> VERIFIED VENDOR
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2 justify-center">
                                                    <button
                                                        onClick={() => handleStartChat(s)}
                                                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        Resume Chat
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SupplierCard({ supplier, onChat }: { supplier: any, onChat: () => void }) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex-1">
                <h3 className="font-bold text-gray-900">{supplier.name}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="font-mono bg-gray-100 px-1 rounded">{supplier.phone}</span>
                    <span className="text-gray-400">•</span>
                    <span>{supplier.location || 'Online'}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{supplier.description}</p>
            </div>
            <div className="flex flex-col gap-2 justify-center">
                <button
                    onClick={onChat}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                    <MessageSquare className="w-4 h-4" />
                    Contact
                </button>
            </div>
        </div>
    );
}
