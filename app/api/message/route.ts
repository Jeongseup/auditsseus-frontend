import { NextRequest, NextResponse } from "next/server";

// 서버 측 환경 변수 접근
const API_URL = process.env.BACKEND_API;
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "30000", 10);

export async function POST(request: NextRequest) {
  try {
    let text: string = "";
    let file: File | null = null;

    // 요청 형식 확인 및 데이터 추출
    const contentType = request.headers.get("content-type") || "";

    // FormData로 전송된 경우 (파일 포함)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      // elizaOS API에 맞게 필드명 수정
      text = formData.get("text")?.toString() || "";

      // 파일이 있는 경우 처리
      const uploadedFile = formData.get("file") as File | null;
      if (uploadedFile) {
        file = uploadedFile;
        console.log("파일 업로드 감지:", file.name, file.type, file.size);
      }
    }
    // JSON으로 전송된 경우 (텍스트만)
    else {
      const data = await request.json();
      // elizaOS API에 맞게 필드명 수정
      text = data.text || "";
    }

    // 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    // elizaOS에 맞는 요청 형식 구성
    // FormData 객체 생성
    const backendFormData = new FormData();

    // elizaOS API에 맞게 필드 구성
    backendFormData.append("text", text);
    backendFormData.append("user", "user"); // 사용자 메시지임을 명시

    // 파일 추가 (있는 경우)
    if (file) {
      backendFormData.append("file", file);
    }

    console.log("백엔드로 요청 전송:", {
      text: text ? text.substring(0, 50) + "..." : "",
      user: "user",
      hasFile: !!file,
      fileType: file?.type,
      fileName: file?.name,
    });

    // 실제 백엔드 API 호출
    const response = await fetch(`${API_URL}/Sseus/message`, {
      method: "POST",
      // FormData의 경우 Content-Type 헤더를 자동으로 설정하도록 함
      body: backendFormData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`백엔드 API 요청 실패: ${response.status}`);
    }

    // 백엔드 응답을 그대로 클라이언트에 전달
    const responseData = await response.json();
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("API 라우트 오류:", error);

    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "요청 시간이 초과되었습니다." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
