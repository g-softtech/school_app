/**
 * FilePreview
 * Renders an inline preview for uploaded files:
 * - PDF  → <iframe> embed
 * - Images → <img> with lightbox
 * - Other → download link with icon
 *
 * Props:
 *   fileUrl     string  — relative path e.g. '/uploads/lessons/abc.pdf'
 *   fileName    string  — original file name
 *   size        'sm' | 'md' | 'lg'  default 'md'
 */
import { useState } from 'react';
import { FiDownload, FiFile, FiFileText, FiImage, FiX, FiMaximize2 } from 'react-icons/fi';

import { SERVER_URL as API_URL } from '../../utils/constants';

function getFileType(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext))                          return 'pdf';
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return 'image';
  if (['doc','docx'].includes(ext))                   return 'word';
  return 'other';
}

function FileIcon({ type, size = 20 }) {
  if (type === 'pdf')   return <FiFileText size={size} className="text-red-500" />;
  if (type === 'image') return <FiImage    size={size} className="text-blue-500" />;
  return <FiFile size={size} className="text-secondary-500" />;
}

export default function FilePreview({ fileUrl, fileName = 'attachment', size = 'md' }) {
  const [showModal, setShowModal] = useState(false);

  if (!fileUrl) return null;

  const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`;
  const type    = getFileType(fileName);

  const heights = { sm: 'h-40', md: 'h-56', lg: 'h-80' };

  // Image — show thumbnail + click to enlarge
  if (type === 'image') {
    return (
      <>
        <div className={`relative ${heights[size]} rounded-xl overflow-hidden border border-secondary-200 bg-secondary-50 group cursor-pointer`} onClick={() => setShowModal(true)}>
          <img src={fullUrl} alt={fileName} className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <FiMaximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
          </div>
        </div>
        <a href={fullUrl} download={fileName} className="inline-flex items-center gap-1.5 text-xs text-secondary-500 hover:text-primary-600 mt-1.5 transition-colors">
          <FiDownload size={12} /> Download {fileName}
        </a>

        {/* Lightbox */}
        {showModal && (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white" onClick={() => setShowModal(false)}>
              <FiX size={18} />
            </button>
            <img src={fullUrl} alt={fileName} className="max-w-full max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </>
    );
  }

  // PDF — inline iframe embed
  if (type === 'pdf') {
    return (
      <div className="space-y-2">
        <div className={`${heights[size]} rounded-xl overflow-hidden border border-secondary-200`}>
          <iframe
            src={`${fullUrl}#toolbar=0&navpanes=0`}
            title={fileName}
            className="w-full h-full"
            type="application/pdf"
          />
        </div>
        <a href={fullUrl} download={fileName} className="inline-flex items-center gap-1.5 text-xs text-secondary-500 hover:text-primary-600 transition-colors">
          <FiDownload size={12} /> Download {fileName}
        </a>
      </div>
    );
  }

  // Other — download card
  return (
    <a
      href={fullUrl}
      download={fileName}
      className="flex items-center gap-3 p-3 border border-secondary-200 rounded-xl hover:bg-secondary-50 hover:border-primary-300 transition-all group"
    >
      <div className="w-10 h-10 bg-secondary-100 group-hover:bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
        <FileIcon type={type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary-800 truncate">{fileName}</p>
        <p className="text-xs text-secondary-400">Click to download</p>
      </div>
      <FiDownload size={15} className="text-secondary-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
    </a>
  );
}
