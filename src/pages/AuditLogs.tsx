import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { Clock, Activity, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/api/auth/audit-logs')
      .then(res => res.json())
      .then(setLogs);
  }, []);

  const renderDifferences = (oldStr: string, newStr: string) => {
    if(!oldStr || !newStr) return null;
    try {
      const o = JSON.parse(oldStr);
      const n = JSON.parse(newStr);
      const changes = [];
      for(let key in o) {
        if(o[key] !== n[key] && key !== 'updated_at') {
           changes.push(
             <div key={key} className="text-sm bg-neutral-50 p-2 rounded flex items-center justify-between">
                <span className="font-mono text-neutral-500">{key}</span>
                <div className="flex items-center gap-2">
                   <span className="text-red-500 line-through">{String(o[key])}</span>
                   <ArrowLeft className="w-3 h-3 text-neutral-400" />
                   <span className="text-green-600 font-bold">{String(n[key])}</span>
                </div>
             </div>
           );
        }
      }
      return <div className="space-y-1 mt-2">{changes}</div>;
    } catch(e) {
      return null;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-neutral-800">سجل النشاطات (Audit Log)</h1>
        <p className="text-neutral-500 mt-2">تتبع التغييرات الحساسة في النظام.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">لا توجد سجلات حالياً</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                       <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">{log.user_name}</h4>
                      <div className="text-sm text-neutral-500 flex items-center gap-1">
                        <span className="font-mono bg-neutral-100 px-1 rounded text-xs">{log.action}</span>
                        <span>على الجدول</span>
                        <span className="font-mono bg-neutral-100 px-1 rounded text-xs">{log.table_name}</span>
                        <span>(رقم {log.record_id})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-neutral-400 font-mono" dir="ltr">
                    <Clock className="w-4 h-4" />
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </div>
                </div>
                {renderDifferences(log.old_value, log.new_value)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
