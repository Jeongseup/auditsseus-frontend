"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { 
  Send, 
  Image as ImageIcon, 
  ExternalLink, 
  FileUp, 
  X, 
  FileText} from "lucide-react";

// 클라이언트에서는 환경 변수가 필요하지 않음

interface IAttachment {
  url: string;
  contentType: string;
  title: string;
}

interface Message {
  text: string;
  isUser: boolean;
  isImage?: boolean;
  imagePreview?: string;
  createdAt?: number;
  attachments?: IAttachment[];
  isLoading?: boolean;
  action?: {
    type: string;
    url?: string;
    title?: string;
  };
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // 스크롤을 맨 아래로 이동시키는 함수
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  // 메시지 변경 시 스크롤 처리를 위한 useEffect
  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];
    
    // 즉시 스크롤
    scrollToBottom();
    
    // 렌더링 이후 여러 시점에서 스크롤 시도
    timeoutIds.push(
      setTimeout(scrollToBottom, 100),
      setTimeout(scrollToBottom, 300),
      setTimeout(scrollToBottom, 500)
    );
    
    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [messages]);

  // 로딩 상태 변경 시에도 스크롤 처리
  useEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading]);

  // 컴포넌트가 마운트될 때 스크롤 처리
  useEffect(() => {
    scrollToBottom();
  }, []);

  useEffect(() => {
    if (isInputFocused) {
      textareaRef.current?.focus();
    }
  }, [isInputFocused]);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로 이동시키는 효과 제거 (중복)

  // 파일 선택 핸들러
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 파일 변경 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      setSelectedFile(file);
    } else if (file) {
      // 지원하지 않는 파일 형식에 대한 콘솔 경고
      console.warn("지원하지 않는 파일 형식:", file.type);
      alert("지원하지 않는 파일 형식입니다. 이미지 또는 PDF 파일만 업로드할 수 있습니다.");
    }
  };

  // 선택한 파일 제거
  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 메시지 전송 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return;
    if (!input.trim() && !selectedFile) return;
    
    // AbortController 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5분 타임아웃
    
    // 첨부 파일이 있는 경우 첨부 파일 정보 생성
    const attachments: IAttachment[] | undefined = selectedFile
      ? [{
          url: URL.createObjectURL(selectedFile),
          contentType: selectedFile.type,
          title: selectedFile.name,
        }]
      : undefined;
    
    // 사용자 메시지 추가
    const userMessage: Message = {
      text: input.trim(),
      isUser: true,
      createdAt: Date.now(),
      attachments
    };
    
    // 로딩 메시지 추가
    const loadingMessage: Message = {
      text: "응답 생성 중...",
      isUser: false,
      isLoading: true,
      createdAt: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsLoading(true);
    
    try {
      let response;
      
      // 파일이 있는 경우 FormData로 요청
      if (selectedFile) {
        const formData = new FormData();
        formData.append('text', input.trim() || '');
        formData.append('file', selectedFile);
        
        response = await fetch('/api/message', {
          method: "POST",
          body: formData,
          signal: controller.signal // AbortController 시그널 추가
        });
      } else {
        response = await fetch('/api/message', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: input.trim() }),
          signal: controller.signal // AbortController 시그널 추가
        });
      }
      
      if (!response.ok) {
        let errorMsg = '서버 오류가 발생했습니다';
        
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || `API 요청 실패: ${response.status}`;
        } catch (err) {
          errorMsg = `API 요청 실패: ${response.status} - ${response.statusText}, ${String(err)}`;
        }
        
        throw new Error(errorMsg);
      }

      // 응답 데이터 파싱 시도
      let data;
      try {
        const textData = await response.text();
        try {
          data = JSON.parse(textData);
        } catch (parseError) {
          console.error("JSON 파싱 오류:", parseError);
          // JSON 파싱 실패 시 텍스트 응답을 그대로 사용
          data = { response: textData };
        }
      } catch (error) {
        console.error("응답 데이터 읽기 오류:", error);
        throw new Error("서버 응답을 처리할 수 없습니다. 관리자에게 문의하세요.");
      }
      
      // 로딩 메시지 제거 및 AI 응답 추가
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isLoading);
        
        // API 응답 처리
        if (Array.isArray(data)) {
          // 배열인 경우 각 메시지를 순차적으로 추가
          return [
            ...filtered,
            ...data.map(messageResponse => ({
              text: messageResponse.text || "응답이 없습니다.", 
              isUser: false,
              createdAt: Date.now(),
              action: messageResponse.action
            }))
          ];
        } else if (data.response) {
          // 단일 응답인 경우
          return [...filtered, { 
            text: data.response, 
            isUser: false,
            createdAt: Date.now()
          }];
        } else {
          // 기타 경우
          return [...filtered, { 
            text: "응답 형식이 올바르지 않습니다.", 
            isUser: false,
            createdAt: Date.now()
          }];
        }
      });
    } catch (error) {
      console.error("Error sending message:", error);
      let errorMessage = "메시지 전송 중 오류가 발생했습니다.";
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage = "요청 시간이 초과되었습니다. 나중에 다시 시도해 주세요.";
      } else if (error instanceof Error) {
        // 504 Gateway Timeout 에러 처리
        if (error.message.includes("504")) {
          errorMessage = "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
        } else {
          errorMessage = `오류가 발생했습니다: ${error.message}`;
        }
      }
      
      // 로딩 메시지 제거 및 오류 메시지 추가
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isLoading);
        return [...filtered, { 
          text: errorMessage, 
          isUser: false,
          createdAt: Date.now()
        }];
      });
    } finally {
      clearTimeout(timeoutId); // 타임아웃 타이머 정리
      setIsLoading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 메시지 렌더링 함수
  const renderMessage = (message: Message, index: number) => {
    return (
      <div 
        key={index} 
        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div 
          className={`rounded-lg p-4 max-w-[80%] ${
            message.isUser 
              ? 'bg-blue-600 text-white rounded-br-none' 
              : 'bg-slate-700 text-slate-100 rounded-bl-none'
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
            </div>
          ) : (
            <>
              {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
              
              {/* 첨부 파일 렌더링 */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2">
                  {message.attachments.map((attachment, i) => (
                    <div key={i} className="mt-2">
                      {attachment.contentType.startsWith('image/') ? (
                        <div className="relative">
                          <div className="relative w-full h-[300px]">
                            <Image 
                              src={attachment.url} 
                              alt={attachment.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 80vw"
                              className="rounded-md object-cover"
                            />
                          </div>
                          <span className="block text-xs opacity-70 mt-1">{attachment.title}</span>
                        </div>
                      ) : attachment.contentType === 'application/pdf' ? (
                        <div className="bg-slate-800 p-3 rounded-md flex items-center gap-2">
                          <FileText size={20} />
                          <span className="truncate">{attachment.title}</span>
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-auto text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              
              {/* 액션 버튼 렌더링 */}
              {message.action && message.action.type === 'link' && message.action.url && (
                <a 
                  href={message.action.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block mt-3 bg-blue-700 hover:bg-blue-600 text-white py-2 px-4 rounded text-center"
                >
                  {message.action.title || '결과 보기'}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] border rounded-lg bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 shadow-xl">
      <div className="bg-gradient-to-r from-blue-500/10 to-emerald-400/10 p-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            {/* 움직이는 아우라 효과 */}
            <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-r from-blue-500/40 to-emerald-400/40 blur-sm animate-pulse"></div>
            <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-400/20 blur-md animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-indigo-500/10 to-emerald-400/10 blur-lg animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            {/* 움직이는 원형 효과 */}
            <div className="absolute inset-0 -m-4 rounded-full border border-blue-500/30 animate-ping" style={{ animationDuration: '4s' }}></div>
            <div className="absolute inset-0 -m-5 rounded-full border border-emerald-400/20 animate-ping" style={{ animationDuration: '7s', animationDelay: '1s' }}></div>
            
            {/* 중앙 AI 아이콘 */}
            <div className="relative w-8 h-8 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10">
              AI
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Auditsseus AI</h3>
        </div>
      </div>
      
      <ScrollArea 
        className="flex-1 p-4 overflow-y-auto"
        ref={scrollAreaRef}
      >
        <div className="space-y-6 min-h-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 opacity-80">
              <div className="bg-gradient-to-r from-blue-500/20 to-emerald-500/20 p-6 rounded-full">
                <div className="relative w-16 h-16">
                  {/* 아우라 효과 - 큰 버전 */}
                  <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-r from-blue-500/40 to-emerald-400/40 blur-sm animate-pulse"></div>
                  <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-400/20 blur-md animate-pulse" style={{ animationDelay: '0.7s' }}></div>
                  <div className="absolute inset-0 -m-5 rounded-full bg-gradient-to-r from-indigo-500/10 to-emerald-400/10 blur-lg animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                  
                  {/* 움직이는 원형 효과 */}
                  <div className="absolute inset-0 -m-6 rounded-full border border-blue-500/30 animate-ping" style={{ animationDuration: '5s' }}></div>
                  <div className="absolute inset-0 -m-8 rounded-full border border-emerald-400/20 animate-ping" style={{ animationDuration: '8s', animationDelay: '2s' }}></div>
                  
                  {/* 중앙 AI 아이콘 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10">
                    AI
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-200">Auditsseus AI 어시스턴트</h3>
              <p className="text-slate-400 max-w-md">
                스마트 컨트랙트 코드 분석과 보안 감사에 관한 질문을 해보세요. 이미지나 PDF 파일을 업로드하여 분석을 요청할 수도 있습니다.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, i) => renderMessage(message, i))}
            </>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-slate-700">
        <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-2">
          {/* 선택된 파일이 있으면 표시 */}
          {selectedFile && (
            <div className="flex items-center gap-2 bg-slate-700 p-2 rounded-md">
              <div className="flex items-center gap-2 flex-1 truncate">
                {selectedFile.type.startsWith("image/") ? (
                  <ImageIcon size={16} className="text-blue-400" />
                ) : (
                  <FileText size={16} className="text-blue-400" />
                )}
                <span className="text-sm truncate">{selectedFile.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost" 
                size="icon"
                className="h-6 w-6 p-0 rounded-full text-slate-400 hover:text-white hover:bg-slate-600"
                onClick={removeSelectedFile}
              >
                <X size={14} />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* 숨겨진 파일 입력 필드 */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf"
            />
            
            {/* 파일 업로드 버튼 */}
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              className="rounded-full h-10 w-10 text-slate-400 border-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-500"
              onClick={handleFileSelect}
              disabled={isLoading}
            >
              <FileUp className="h-5 w-5" />
            </Button>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedFile ? "파일과 함께 보낼 메시지를 입력하세요 (선택사항)" : "메시지를 입력하세요..."}
              className="flex-1 bg-slate-700 border-slate-600 focus:border-blue-500 text-slate-100 rounded-full"
              disabled={isLoading}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
            <Button 
              type="submit" 
              disabled={isLoading || (!input.trim() && !selectedFile)}
              className="rounded-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 