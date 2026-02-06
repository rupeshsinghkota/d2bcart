'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Search, MessageSquare, Save, CheckCircle } from 'lucide-react';
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
    const [customContext, setCustomContext] = useState('');

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

    const [autoContact, setAutoContact] = useState(false);

    const handleSearch = async (location: string = "India") => {
        if (!category) return;
        setIsLoading(true);
        addLog(`Starting research for: ${category} in ${location} (Auto-Contact: ${autoContact ? 'ON' : 'OFF'})`);

        try {
            const res = await fetch('/api/debug/sourcing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'research', category, location, autoContact, customContext })
            });

            const data = await res.json();

            if (data.logs) {
                data.logs.forEach((l: string) => addLog(l));
            }

            if (data.suppliers && data.suppliers.length > 0) {
                setDiscoveredSuppliers(data.suppliers);
                addLog(`Found ${data.suppliers.length} potential suppliers.`);

                if (autoContact) {
                    addLog(`[Auto-Pilot] 🤖 Starting outreach with 30s safety delay...`);
                    for (const s of data.suppliers) {
                        await handleStartChat(s);
                        // Increase delay to 30s to avoid Meta blocking (Error 131026)
                        await new Promise(r => setTimeout(r, 30000));
                    }
                    addLog(`[Auto-Pilot] ✅ Sequence completed.`);
                }
            } else {
                addLog('No new suppliers found.');
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
                body: JSON.stringify({ action: 'initiate_chat', supplier, customContext })
            });
            const data = await res.json();

            if (data.success) {
                addLog(`✅ SUCCESS: ${data.message.slice(0, 50)}...`);
                // Update local status in discovered results
                setDiscoveredSuppliers(prev =>
                    prev.map(s => s.phone === supplier.phone ? { ...s, status: 'contacted' } : s)
                );
            } else {
                addLog(`⚠️ ALERT: ${data.message}`);
            }
        } catch (error) {
            addLog(`❌ Chat Error: ${error}`);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Search className="w-8 h-8 text-blue-600" />
                Supplier AI Agent
            </h1>

            {/* Meta Quality Warning */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xl">⚠️</span>
                </div>
                <div>
                    <h3 className="font-bold text-amber-900 leading-none mb-1">Meta Quality Safety Alert</h3>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        To avoid **Error 131026 (Message Undeliverable)**, we've increased the outreach delay to **30 seconds**.
                        If your messages continue to fail, please check your **Meta Business Suite** and pause outreach until your Quality Score recovers.
                    </p>
                </div>
            </div>

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
                                {/* Category Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                                    <div className="space-y-2">
                                        <select
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            value={category}
                                        >
                                            <option value="">Select or Type...</option>
                                            <option value="Mobile Covers">Mobile Covers</option>
                                            <option value="Tempered Glass">Tempered Glass</option>
                                            <option value="Data Cables">Data Cables</option>
                                            <option value="Smart Watch Straps">Smart Watch Straps</option>
                                            <option value="Earbuds (TWS)">Earbuds (TWS)</option>
                                            <option value="Chargers & Adapters">Chargers & Adapters</option>
                                            <option value="Power Banks">Power Banks</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            placeholder="Or type custom category..."
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Location Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Location</label>
                                    <input
                                        type="text"
                                        defaultValue="India"
                                        id="locationInput"
                                        placeholder="e.g. Delhi, Mumbai, Karol Bagh"
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leaves empty to search pan-India.</p>
                                </div>

                                {/* Auto-Contact Toggle */}
                                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900">Auto-Contact</p>
                                        <p className="text-[10px] text-blue-700 leading-tight">AI will message new suppliers instantly.</p>
                                    </div>
                                    <button
                                        onClick={() => setAutoContact(!autoContact)}
                                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${autoContact ? 'bg-blue-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoContact ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Custom Instruction */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom AI Sourcing Instruction</label>
                                    <textarea
                                        value={customContext}
                                        onChange={(e) => setCustomContext(e.target.value)}
                                        placeholder="e.g. Mention we are looking for premium silicone cases for iPhone 15."
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-20"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">This context will be used to personalize the first AI message.</p>
                                </div>

                                <button
                                    onClick={() => {
                                        const locInput = document.getElementById('locationInput') as HTMLInputElement;
                                        handleSearch(locInput.value || "India");
                                    }}
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
                                        <p>Select a category to start searching.</p>
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
    const isContacted = supplier.status === 'contacted';

    return (
        <div className={`flex flex-col sm:flex-row gap-4 p-4 border rounded-lg transition-colors ${isContacted ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{supplier.name}</h3>
                    {isContacted && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">CONTACTED</span>}
                </div>
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
                    disabled={isContacted}
                    className={`px-4 py-2 text-white text-sm rounded-lg flex items-center gap-2 ${isContacted ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    <MessageSquare className="w-4 h-4" />
                    {isContacted ? 'Message Sent' : 'Contact'}
                </button>
            </div>
        </div>
    );
}
