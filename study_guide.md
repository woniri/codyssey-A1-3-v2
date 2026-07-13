# 🎒 프로그래밍 입문자를 위한 '북어 트립' 아키텍처 학습 가이드

이 학습서에서는 '북어 트립' 프로젝트에 적용된 현대 웹 프로그래밍의 핵심 개념과 파일 구조, 그리고 각 기능들이 어떻게 서로 맞물려 통신하는지 이론적으로 설명합니다. 웹 주니어 개발자로 성장하기 위한 첫걸음으로 아래 원리들을 차근차근 배워 봅시다!

---

## 1. 클라이언트-서버 모델 & HTTP 통신
우리가 사용하는 모든 웹 사이트는 기본적으로 **클라이언트(Client)**와 **서버(Server)**가 통신하는 구조입니다.

```
┌────────────────────────┐                   ┌────────────────────────┐
│  Client (브라우저)      │ ─── HTTP POST ──> │   Server (FastAPI)     │
│  - index.html, CSS, JS │ <── JSON Data ─── │   - api/index.py       │
└────────────────────────┘                   └────────────────────────┘
```

* **클라이언트 (Client)**: 사용자가 직접 눈으로 보고 조작하는 웹 브라우저(`index.html`, `js/app.js`)입니다. 사용자가 입력창에 도시 이름을 쓰면 브라우저는 이를 가공하여 서버로 보내달라는 요청을 작성합니다.
* **서버 (Server)**: 보이지 않는 클라우드 우주 어딘가에서 연산과 정보 가공을 전담하는 컴퓨터(`api/index.py`)입니다.
* **HTTP 통신 (Request & Response)**:
  * **요청 (Request)**: 브라우저가 `fetch()` 함수를 사용하여 서버의 `/api/generate` 주소로 사용자 취향(스타일, 일정, 테마)을 담아 **POST** 방식으로 전달합니다.
  * **응답 (Response)**: 서버는 Gemini AI와 통신하여 팩트 기반 이야기를 조립한 후, 구조화된 **JSON 데이터** 형태로 변환하여 클라이언트에게 다시 응답해 줍니다.

---

## 2. FastAPI 라우팅 및 데이터 검증 (Python Backend)
서버 코드는 파이썬의 초고속 현대식 웹 프레임워크인 **FastAPI**로 만들어졌습니다.

### ① 데코레이터 라우팅 (Routing)
FastAPI는 파이썬 데코레이터 문법(`@app.post()`, `@app.get()`)을 사용하여 특정 웹 주소(URL)로 인입되는 요청을 담당 파이썬 함수와 연결해 줍니다.
* `@app.post("/api/search")`: 사용자가 검색어를 보낼 때 서재의 책 목록을 쪼개어 판정해 주는 함수를 실행합니다.
* `@app.post("/api/generate")`: 구체적인 책 스토리 본문과 일정을 생성하는 함수를 실행합니다.

### ② Pydantic을 활용한 데이터 검증
FastAPI는 **Pydantic** 라이브러리를 내장하여 클라이언트가 보낸 데이터가 규격에 맞는지 자동으로 검증해 줍니다.
```python
class TravelRequest(BaseModel):
    destination: str
    style: Optional[str] = "cherry"
    duration: Optional[str] = "당일치기"
    themes: Optional[List[str]] = []
```
클라이언트가 보내온 JSON 데이터가 이 구조와 다르면, 서버는 즉시 에러(`422 Unprocessable Entity`)를 내어 서버 내부 코드가 안전하게 실행될 수 있도록 방어 장벽을 형성합니다.

---

## 3. CORS 보안과 Vercel 라우팅 우회 (Rewrites)
웹 프로그래밍을 처음 시작할 때 가장 많이 겪는 장벽 중 하나가 바로 **CORS(Cross-Origin Resource Sharing)** 보안 오류입니다.

### ① CORS란 무엇인가요?
브라우저는 보안상 기본적으로 **본인의 도메인(A 웹사이트)**에서 **다른 도메인(B 서버 API)**으로 직접 데이터를 호출하는 것을 차단합니다. 

### ② 해결책: Middleware & Vercel Rewrites
* **서버 측 대처**: `api/index.py` 내부에 FastAPI CORS 미들웨어를 장착하여 외부 브라우저의 접근을 허용했습니다.
  ```python
  app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
  ```
* **Vercel 설정 파일 ([vercel.json](file:///d:/Temp/0.코디세이/new-travel/vercel.json))**:
  Vercel에 배포할 때, 정적 파일(HTML/JS)과 백엔드 파이썬이 동일한 도메인 아래서 마치 하나의 웹사이트처럼 동작하도록 `rewrites`를 통해 경로를 매핑시킵니다.
  ```json
  {
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api/index.py" }
    ]
  }
  ```
  이 지시문을 받으면 Vercel 서버는 브라우저가 보낸 `/api/...` 요청을 내부에서 안전하게 파이썬 `index.py`로 전달해 주기 때문에 CORS 이슈를 완벽하게 예방할 수 있습니다.

---

## 4. LocalStorage를 활용한 클라이언트 측 영구 데이터 보존
서버의 데이터베이스(DB)를 구축하려면 비용과 공수가 듭니다. 대신 우리는 웹 브라우저가 사용자 기기 하드디스크에 직접 저장할 수 있는 공간을 제공하는 **LocalStorage(로컬 스토리지)** 기술을 채택했습니다.

### ① 로컬 스토리지의 특징
* 서버에 트래픽을 주지 않고 브라우저가 스스로 저장하는 로컬 보관소입니다.
* 쿠키(Cookie)와 달리 만료 기한이 없어 사용자가 수동으로 브라우저 데이터를 지우기 전까지는 영구히 유지됩니다.
* 단, 오직 **문자열(String)** 데이터만 저장할 수 있습니다.

### ② JSON 직렬화 & 역직렬화 (Serialization & Deserialization)
우리가 만든 책 데이터는 복잡한 중첩 객체(Object)입니다. 이를 로컬 스토리지에 저장하기 위해 문자열로 변환하고, 다시 복원하는 기술을 사용합니다.
* **직렬화 (`JSON.stringify`)**: 복잡한 책 데이터를 글자 텍스트 덩어리로 변환하여 로컬 스토리지에 밀어 넣습니다.
  ```javascript
  localStorage.setItem("my_travel_library", JSON.stringify(libraryArray));
  ```
* **역직렬화 (`JSON.parse`)**: 로컬 스토리지에서 글자 덩어리를 꺼내와 자바스크립트가 읽을 수 있는 실제 데이터 객체로 재조립합니다.
  ```javascript
  const library = JSON.parse(localStorage.getItem("my_travel_library"));
  ```

---

## 5. Web Speech API (브라우저 네이티브 TTS 핸들링)
텍스트를 오디오 목소리로 읽어주는 TTS(Text-To-Speech) 기술을 구현하기 위해 브라우저의 하드웨어 및 OS 엔진을 호출했습니다.

* **SpeechSynthesis**: 자바스크립트가 브라우저 내장 낭독 기계를 제어하는 메인 조종 장치입니다.
* **SpeechSynthesisUtterance**: 읽을 텍스트 내용과 낭독 조건(언어, 속도, 피치)을 담는 '낭독 우편물' 객체입니다.
  ```javascript
  const utterance = new SpeechSynthesisUtterance("읽을 텍스트");
  utterance.lang = "ko-KR"; // 한국어 설정
  utterance.pitch = 0.95;   // 세련된 저음 가이드 톤 연출
  window.speechSynthesis.speak(utterance); // 낭독 시작!
  ```
이 방식을 활용하면 서버 비용이 0원이 되며 사용자의 디바이스가 낭독을 책임지게 됩니다.

---

## 6. 동적 Blob & 가상 Object URL을 이용한 파일 내보내기 (Export)
우리가 작성한 책을 개인 컴퓨터로 다운로드받는 기능은 **바이너리 파일 생성 및 DOM 트리거 기술**로 구현되었습니다.

1. **HTML 텍스트 문서 가공**: `js/app.js`에서 현재 열람 중인 도서 스토리와 일러스트 이미지 링크를 취합해 인쇄용 미려한 스타일이 내장된 HTML 문자열을 작성합니다.
2. **Blob 객체 생성**: 자바스크립트 메모리상에 텍스트 데이터를 컴퓨터가 이진수로 읽을 수 있는 파일 데이터인 **Blob(Binary Large Object)** 객체로 포장합니다.
   ```javascript
   const blob = new Blob([fullHtmlContent], { type: "text/html" });
   ```
3. **가상 URL 발급 (`URL.createObjectURL`)**: 메모리에 잡혀 있는 Blob 데이터에 임시 가상 인터넷 주소(Object URL)를 매핑해 줍니다.
4. **가상 DOM 클릭 유도**: 메모리상에 보이지 않는 `<a>` 다운로드 링크 태그를 생성하고, 강제로 `.click()` 이벤트를 터뜨려 사용자의 다운로드 폴더로 파일이 안전하게 내려가도록 유도한 후 리소스를 즉시 반환합니다.

---

축하합니다! 이로써 '북어 트립' 프로젝트에 숨겨진 다양한 현대 웹 통신 및 자바스크립트 API의 작동 원리를 배우셨습니다. 
이 이론적 지식을 바탕으로 코드를 보며 실무 웹 아키텍처의 기틀을 다져보세요! 🍒💻
