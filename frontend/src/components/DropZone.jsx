import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';

export default function DropZone({ onFile, accept = '.pdf,.doc,.docx', label = 'Drop your document here', uploading = false, uploaded = false }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setFileName(file.name); onFile(file); }
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) { setFileName(file.name); onFile(file); }
  }

  function clear(e) {
    e.stopPropagation();
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !fileName && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer
        ${dragging ? 'border-blue-400 bg-blue-50 scale-[1.01]' : uploaded ? 'border-green-400 bg-green-50' : fileName ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
      `}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-blue-600">Analyzing document...</p>
          <p className="text-xs text-blue-500">AI is reading lease terms</p>
        </div>
      ) : uploaded ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle size={32} className="text-green-500" />
          <p className="text-sm font-semibold text-green-700">Upload complete — terms extracted</p>
        </div>
      ) : fileName ? (
        <div className="flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">{fileName}</p>
              <p className="text-xs text-gray-500">Ready to upload</p>
            </div>
          </div>
          <button onClick={clear} className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-200' : 'bg-gray-100'}`}>
            <Upload size={22} className={dragging ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">or click to browse · PDF, DOC up to 25MB</p>
          </div>
        </div>
      )}
    </div>
  );
}
