import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { detectCompanyFromFilename, detectReportingPeriod, detectDocumentType } from '../lib/asxCompanies';

interface FileWithMetadata {
  file: File;
  company_name: string;
  company_ticker: string;
  document_type: string;
  reporting_period: string;
}

interface FileUploadProps {
  onUpload: (file: File, metadata: {
    company_name: string;
    company_ticker?: string;
    document_type?: string;
    reporting_period?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const documentTypes = [
  { value: 'annual_report', label: 'Annual Report' },
  { value: 'half_year', label: 'Half-Year Results' },
  { value: 'quarterly', label: 'Quarterly Results' },
  { value: 'asx_announcement', label: 'ASX Announcement' },
  { value: 'investor_presentation', label: 'Investor Presentation' },
  { value: 'other', label: 'Other' },
];

export default function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithMetadata[] = acceptedFiles
      .filter(file => file.type === 'application/pdf')
      .map(file => {
        // Auto-detect company info from filename
        const detectedCompany = detectCompanyFromFilename(file.name);
        const detectedPeriod = detectReportingPeriod(file.name);
        const detectedType = detectDocumentType(file.name);
        
        return {
          file,
          company_name: detectedCompany?.name || '',
          company_ticker: detectedCompany?.ticker || '',
          document_type: detectedType,
          reporting_period: detectedPeriod,
        };
      });

    if (newFiles.length !== acceptedFiles.length) {
      setError('Some files were skipped - only PDF files are accepted');
    } else {
      setError(null);
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: isLoading,
  });

  const updateFileMetadata = (index: number, field: keyof FileWithMetadata, value: string) => {
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, [field]: value } : f
    ));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      
      if (!fileData.company_name.trim()) {
        setError(`Please enter the company name for "${fileData.file.name}"`);
        return;
      }

      setUploadingIndex(i);
      
      try {
        await onUpload(fileData.file, {
          company_name: fileData.company_name.trim(),
          company_ticker: fileData.company_ticker.trim() || undefined,
          document_type: fileData.document_type,
          reporting_period: fileData.reporting_period.trim() || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to upload ${fileData.file.name}`);
        setUploadingIndex(null);
        return;
      }
    }

    // All uploads successful - reset
    setFiles([]);
    setUploadingIndex(null);
    setError(null);
  };

  const handleUploadSingle = async (index: number) => {
    const fileData = files[index];
    
    if (!fileData.company_name.trim()) {
      setError(`Please enter the company name for "${fileData.file.name}"`);
      return;
    }

    setUploadingIndex(index);
    
    try {
      await onUpload(fileData.file, {
        company_name: fileData.company_name.trim(),
        company_ticker: fileData.company_ticker.trim() || undefined,
        document_type: fileData.document_type,
        reporting_period: fileData.reporting_period.trim() || undefined,
      });
      
      // Remove uploaded file from list
      removeFile(index);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload ${fileData.file.name}`);
    }
    
    setUploadingIndex(null);
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>
      
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Drop the PDF files here...'
            : 'Drag & drop PDF files here, or click to select'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Upload multiple files at once. Company info will be auto-detected from filenames.
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </h3>
            {files.length > 1 && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
          </div>

          {files.map((fileData, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              {/* File header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <DocumentIcon className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                    {fileData.file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({(fileData.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={uploadingIndex !== null}
                  className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Metadata inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fileData.company_name}
                    onChange={(e) => updateFileMetadata(index, 'company_name', e.target.value)}
                    className="input text-sm py-1.5"
                    placeholder="Company name"
                    disabled={uploadingIndex !== null}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ticker</label>
                  <input
                    type="text"
                    value={fileData.company_ticker}
                    onChange={(e) => updateFileMetadata(index, 'company_ticker', e.target.value.toUpperCase())}
                    className="input text-sm py-1.5"
                    placeholder="e.g., CBA"
                    disabled={uploadingIndex !== null}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type</label>
                  <select
                    value={fileData.document_type}
                    onChange={(e) => updateFileMetadata(index, 'document_type', e.target.value)}
                    className="input text-sm py-1.5"
                    disabled={uploadingIndex !== null}
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Period</label>
                  <input
                    type="text"
                    value={fileData.reporting_period}
                    onChange={(e) => updateFileMetadata(index, 'reporting_period', e.target.value)}
                    className="input text-sm py-1.5"
                    placeholder="e.g., FY24"
                    disabled={uploadingIndex !== null}
                  />
                </div>
              </div>

              {/* Individual upload button */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleUploadSingle(index)}
                  disabled={uploadingIndex !== null || !fileData.company_name.trim()}
                  className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingIndex === index ? 'Uploading...' : 'Upload this file'}
                </button>
              </div>
            </div>
          ))}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Upload all button */}
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={uploadingIndex !== null || files.some(f => !f.company_name.trim())}
            className="btn-primary w-full"
          >
            {uploadingIndex !== null ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading {uploadingIndex + 1} of {files.length}...
              </span>
            ) : (
              `Upload All (${files.length} file${files.length > 1 ? 's' : ''})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
