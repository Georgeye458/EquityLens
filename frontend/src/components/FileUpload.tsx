import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyTicker, setCompanyTicker] = useState('');
  const [documentType, setDocumentType] = useState('annual_report');
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload a PDF file');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: isLoading,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    if (!companyName.trim()) {
      setError('Please enter the company name');
      return;
    }

    try {
      await onUpload(selectedFile, {
        company_name: companyName.trim(),
        company_ticker: companyTicker.trim() || undefined,
        document_type: documentType,
        reporting_period: reportingPeriod.trim() || undefined,
      });
      
      // Reset form
      setSelectedFile(null);
      setCompanyName('');
      setCompanyTicker('');
      setDocumentType('annual_report');
      setReportingPeriod('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : selectedFile
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          
          {selectedFile ? (
            <div className="flex items-center justify-center space-x-3">
              <DocumentIcon className="w-8 h-8 text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="p-1 rounded-full hover:bg-gray-200"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <>
              <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? 'Drop the PDF here...'
                  : 'Drag & drop a PDF file here, or click to select'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Maximum 50MB, up to 300 pages</p>
            </>
          )}
        </div>

        {/* Metadata inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="companyName" className="label mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input"
              placeholder="e.g., Commonwealth Bank"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="companyTicker" className="label mb-1">
              Ticker Symbol
            </label>
            <input
              type="text"
              id="companyTicker"
              value={companyTicker}
              onChange={(e) => setCompanyTicker(e.target.value.toUpperCase())}
              className="input"
              placeholder="e.g., CBA"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="documentType" className="label mb-1">
              Document Type
            </label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="input"
              disabled={isLoading}
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="reportingPeriod" className="label mb-1">
              Reporting Period
            </label>
            <input
              type="text"
              id="reportingPeriod"
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value)}
              className="input"
              placeholder="e.g., FY24, H1 2024"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!selectedFile || !companyName.trim() || isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading...
            </span>
          ) : (
            'Upload & Process'
          )}
        </button>
      </form>
    </div>
  );
}
