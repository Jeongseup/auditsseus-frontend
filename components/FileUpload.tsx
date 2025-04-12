"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, FileText, Image as ImageIcon, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';

type FileWithPreview = {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text' | 'unknown';
};

interface FileUploadProps {
  id?: string;
  onFileSelected?: (file: File) => void;
}

export const FileUpload = ({ id, onFileSelected }: FileUploadProps = {}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const newFiles = acceptedFiles.map(file => {
      // 파일 타입 판별
      let type: 'image' | 'pdf' | 'text' | 'unknown' = 'unknown';
      let preview = '';

      if (file.type.startsWith('image/')) {
        type = 'image';
        preview = URL.createObjectURL(file);
      } else if (file.type === 'application/pdf') {
        type = 'pdf';
      } else if (file.type === 'text/plain') {
        type = 'text';
      }

      return {
        file,
        preview,
        type
      };
    });

    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    
    // 파일이 선택되었을 때 콜백 호출
    if (onFileSelected && acceptedFiles.length > 0) {
      onFileSelected(acceptedFiles[0]);
    }
    
    // 이미지 파일인 경우 자동으로 분석 시작 (다음 렌더링 사이클에서)
    if (newFiles.some(f => f.type === 'image')) {
      setTimeout(() => {
        if (files.length > 0 || newFiles.length > 0) {
          setIsProcessing(true);
          setProcessingStatus('processing');
          setProcessingProgress(0);
          
          // 프로그레스 시뮬레이션
          const interval = setInterval(() => {
            setProcessingProgress(prev => {
              if (prev >= 100) {
                clearInterval(interval);
                return 100;
              }
              return prev + 5;
            });
          }, 100);
          
          // API 호출 시뮬레이션
          setTimeout(() => {
            clearInterval(interval);
            setProcessingProgress(100);
            setProcessingStatus('success');
            setIsProcessing(false);
            
            // API 호출 성공
            toast.success('분석이 완료되었습니다.');
          }, 2000);
        }
      }, 0);
    }
  }, [onFileSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'application/pdf': [],
      'text/plain': []
    }
  });

  const removeFile = (index: number) => {
    setFiles(files => {
      const newFiles = [...files];
      // 브라우저 메모리에서 URL 객체 해제
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-6 w-6 text-blue-400" />;
      case 'pdf':
        return <FileText className="h-6 w-6 text-orange-400" />;
      case 'text':
        return <File className="h-6 w-6 text-emerald-400" />;
      default:
        return <File className="h-6 w-6 text-slate-400" />;
    }
  };

  const resetAll = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setProcessingStatus('idle');
    setProcessingProgress(0);
  };

  return (
    <div className="w-full space-y-6">
      {processingStatus === 'idle' && (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${isDragActive 
              ? 'border-blue-400 bg-blue-900/20' 
              : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-700/20'}`}
        >
          <input {...getInputProps()} id={id} />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-14 h-14 rounded-full bg-blue-900/50 flex items-center justify-center mb-2">
              <Upload className="h-7 w-7 text-blue-400" />
            </div>
            <p className="text-base font-medium text-slate-200">
              {isDragActive 
                ? '파일을 여기에 놓으세요...' 
                : '파일을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              지원 파일 형식: 이미지(JPG, PNG, GIF), PDF, 텍스트 파일
            </p>
          </div>
        </div>
      )}

      {processingStatus === 'processing' && (
        <div className="rounded-xl border border-slate-700 p-8 bg-slate-800">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-r-transparent animate-spin"></div>
              <span className="text-sm font-medium text-blue-400">{processingProgress}%</span>
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">분석 중...</h3>
            <p className="text-slate-400 max-w-sm mx-auto mb-4">
              파일을 분석하는 중입니다. 잠시만 기다려주세요.
            </p>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2 max-w-md">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all" 
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500">{files.length}개 파일 처리 중</p>
          </div>
        </div>
      )}

      {processingStatus === 'success' && (
        <div className="rounded-xl border border-blue-900/50 p-8 bg-blue-900/20">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">분석 완료</h3>
            <p className="text-slate-400 max-w-sm mx-auto mb-6">
              {files.length}개 파일의 분석이 완료되었습니다.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="rounded-full border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={resetAll}
              >
                새 파일 업로드
              </Button>
              <Button className="rounded-full bg-blue-400 hover:bg-blue-500 text-slate-900">
                결과 확인하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {processingStatus === 'idle' && files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-200">업로드된 파일 ({files.length}개)</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setFiles([])}
            >
              모두 삭제
            </Button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-3"
              >
                {file.type === 'image' && file.preview ? (
                  <div className="relative h-10 w-10">
                    <Image 
                      src={file.preview} 
                      alt={file.file.name}
                      fill
                      className="object-cover rounded"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center bg-slate-700 rounded">
                    {getFileIcon(file.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{file.file.name}</p>
                  <p className="text-xs text-slate-400">
                    {(file.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-300"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">삭제</span>
                </Button>
              </div>
            ))}
          </div>

          <Button 
            className="w-full rounded-xl h-12 bg-blue-400 hover:bg-blue-500 text-slate-900 mt-4" 
            onClick={() => {
              setIsProcessing(true);
              setProcessingStatus('processing');
              setProcessingProgress(0);
              
              // 프로그레스 시뮬레이션
              const interval = setInterval(() => {
                setProcessingProgress(prev => {
                  if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                  }
                  return prev + 5;
                });
              }, 100);
              
              // API 호출 시뮬레이션
              setTimeout(() => {
                clearInterval(interval);
                setProcessingProgress(100);
                setProcessingStatus('success');
                setIsProcessing(false);
                
                // API 호출 성공
                toast.success('분석이 완료되었습니다.');
              }, 2000);
            }}
            disabled={isProcessing}
          >
            {isProcessing ? '처리 중...' : '분석하기'}
          </Button>
        </div>
      )}
    </div>
  );
}; 