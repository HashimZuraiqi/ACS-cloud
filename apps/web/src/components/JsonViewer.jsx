import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
const JsonNode = ({ data, level }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  if (data === null) return <span className="text-gray-500">null</span>;
  if (typeof data === 'boolean') return <span className="text-purple-400">{data.toString()}</span>;
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'string') return <span className="text-green-400">&quot;{data}&quot;</span>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    return (<div><button onClick={() => setIsExpanded(!isExpanded)} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-300">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}<span>[{data.length}]</span></button>{isExpanded && <div className="ml-4 border-l border-gray-700 pl-4 mt-1">{data.map((item, i) => <div key={i} className="my-1"><span className="text-gray-500">{i}: </span><JsonNode data={item} level={level + 1} /></div>)}</div>}</div>);
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="text-gray-400">{'{}'}</span>;
    return (<div><button onClick={() => setIsExpanded(!isExpanded)} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-300">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}<span>{'{'}{keys.length}{'}'}</span></button>{isExpanded && <div className="ml-4 border-l border-gray-700 pl-4 mt-1">{keys.map(key => <div key={key} className="my-1"><span className="text-cyan-400">&quot;{key}&quot;</span><span className="text-gray-500">: </span><JsonNode data={data[key]} level={level + 1} /></div>)}</div>}</div>);
  }
  return <span className="text-gray-400">{String(data)}</span>;
};
const JsonViewer = ({ data, className }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(JSON.stringify(data, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (<div className={cn('relative', className)}><div className="absolute top-2 right-2 z-10"><button onClick={handleCopy} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors" title="Copy JSON">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}</button></div><div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[600px] font-mono text-sm"><JsonNode data={data} level={0} /></div></div>);
};
export default JsonViewer;
