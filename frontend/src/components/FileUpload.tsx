import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, File, X, Loader2 } from 'lucide-react';
import { detectCompanyFromFilename, detectReportingPeriod, detectDocumentType } from '../lib/asxCompanies';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
      
      removeFile(index);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload ${fileData.file.name}`);
    }
    
    setUploadingIndex(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-accent"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          <CloudUpload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? 'Drop the PDF files here...'
              : 'Drag & drop PDF files here, or click to select'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Upload multiple files at once. Company info will be auto-detected from filenames.
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </h3>
              {files.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiles([])}
                >
                  Clear all
                </Button>
              )}
            </div>

            {files.map((fileData, index) => (
              <div key={index} className="border rounded-lg p-4 bg-muted/30">
                {/* File header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <File className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-foreground truncate max-w-xs">
                      {fileData.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(fileData.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    disabled={uploadingIndex !== null}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Metadata inputs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Company Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={fileData.company_name}
                      onChange={(e) => updateFileMetadata(index, 'company_name', e.target.value)}
                      placeholder="Company name"
                      disabled={uploadingIndex !== null}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
                    <Input
                      type="text"
                      value={fileData.company_ticker}
                      onChange={(e) => updateFileMetadata(index, 'company_ticker', e.target.value.toUpperCase())}
                      placeholder="e.g., CBA"
                      disabled={uploadingIndex !== null}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                    <Select
                      value={fileData.document_type}
                      onValueChange={(value) => updateFileMetadata(index, 'document_type', value)}
                      disabled={uploadingIndex !== null}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Period</label>
                    <Input
                      type="text"
                      value={fileData.reporting_period}
                      onChange={(e) => updateFileMetadata(index, 'reporting_period', e.target.value)}
                      placeholder="e.g., FY24"
                      disabled={uploadingIndex !== null}
                    />
                  </div>
                </div>

                {/* Individual upload button */}
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleUploadSingle(index)}
                    disabled={uploadingIndex !== null || !fileData.company_name.trim()}
                  >
                    {uploadingIndex === index ? 'Uploading...' : 'Upload this file'}
                  </Button>
                </div>
              </div>
            ))}

            {/* Error message */}
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Upload all button */}
            <Button
              className="w-full"
              onClick={handleUploadAll}
              disabled={uploadingIndex !== null || files.some(f => !f.company_name.trim())}
            >
              {uploadingIndex !== null ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading {uploadingIndex + 1} of {files.length}...
                </span>
              ) : (
                `Upload All (${files.length} file${files.length > 1 ? 's' : ''})`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
