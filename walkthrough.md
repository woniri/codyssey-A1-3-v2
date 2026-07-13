# 📖 여행 e-Book 플랫폼 개발 완료 검증 및 배포 안내서 (Walkthrough)

이 문서는 AI 기반 여행 스토리텔링 전자책 플랫폼의 전체 코드 아키텍처, 기능 검증 시나리오, 그리고 GitHub와 Vercel을 연동한 무료 배포 설정법을 제공합니다.

---

## 1. 프로젝트 폴더 및 파일 구조

프로젝트 루트 디렉토리 [new-travel](file:///d:/Temp/0.코디세이/new-travel)의 최종 구조는 아래와 같습니다.

```
d:/Temp/0.코디세이/new-travel/
├── index.html                   # 메인 폼 및 e-Book 뷰어가 통합된 HTML5 구조
├── css/
│   └── styles.css               # 페이퍼 아트 스타일링, 서울 감성 파스텔 톤, 3D 책 회전 CSS
├── js/
│   └── app.js                   # 프론트엔드 비즈니스 로직 (CORS API 통신, Web Speech TTS, 반응형 뷰포트 분기)
├── api/
│   └── generate.py              # Vercel Python Serverless Function (Gemini LLM 호출 및 이미지 연동)
├── requirements.txt             # Python 의존 라이브러리 목록 (google-generativeai, requests)
├── vercel.json                  # Vercel 빌드 및 라우팅 설정 파일
├── travel_ebook_platform_plan.md  # 최종 기획서
├── study_guide.md               # 초등학생 눈높이 학습용 교육 문서
└── walkthrough.md               # [현재 파일] 개발 완성 검증 및 배포 안내서
```

---

## 2. 주요 기술적 핵심 구현사항

### ① 페이퍼 컷팅(Paper-cut) 아트 CSS 디자인
* 무광 질감을 표현하기 위해 CSS SVG Filter 효과를 결합하여 웹 화면에 보이지 않는 아주 미세한 입자 노이즈를 얹었습니다.
* 여러 장의 오려낸 종이가 겹쳐서 떠 있는 입체감을 주기 위해, 요소들에 넓게 퍼지는 다중 입체 섀도우를 입혔습니다.
  ```css
  box-shadow: 0 8px 24px rgba(62, 64, 63, 0.08), 
              0 2px 8px rgba(62, 64, 63, 0.04);
  ```
* 톤다운된 서울 감성의 파스텔 팔레트(한지 백색 `#FAF6F0`, 기와 회색 `#3E403F`, 단청 녹청색 `#8AA399`, 살구색 `#D6A28C`)를 CSS 변수화하여 테마 무드를 통일했습니다.

### ② 모바일 / PC 반응형 분기 대응 (CSS Media Query)
* **데스크톱/태블릿**: 양면 펼침형 책 뷰어를 렌더링하고, 이전/다음 버튼 클릭 시 3D 변환(`rotateY(-180deg)`)과 `z-index` 재계산을 통해 책장이 넘어가며 겹치는 효과를 구현했습니다.
* **모바일 (768px 이하)**: 펼침 뷰어가 공간적 한계를 가지므로, `display: none`과 `active-page` 클래스를 제어하는 **단일 카드 슬라이드 뷰**로 자동 전환 및 마감 처리했습니다.

### ③ 백엔드 Gemini API & Unsplash 이미지 연동
* 파이썬 API `api/generate.py`에서는 사용자가 고른 관심사, 기간, 목소리 스타일을 매개변수화해 Gemini API에 JSON 구조로 응답하도록 요령껏 프롬프팅(`Structured JSON Output`)합니다.
* 책의 표지와 각 페이지 챕터 내용에 맞는 감성 풍경 사진을 가져오기 위해 Unsplash API 조회 모듈을 탑재했으며, API Key가 누락되었을 시 깨지지 않도록 방어 코드(무료 풍경 이미지 주소로 리다이렉션)가 장착되어 있습니다.

### ④ 서버 비용 0원의 오디오 내레이션
* 유료 TTS 솔루션 대신, 프론트엔드 브라우저 내장 API인 `window.speechSynthesis`를 호출하여 한국어 보이스(`ko-KR`)로 책 내용을 읽어줍니다. 
* 페이지 전환 시 이전에 읽던 오디오를 자동 정지(`synth.cancel()`)하고, 새 페이지 스크립트를 동기화하여 읽는 매끄러운 UX를 탑재했습니다.

---

## 3. GitHub 및 Vercel 무료 배포 설정 가이드 (CI/CD)

이 플랫폼은 Git과 Vercel의 무료 요금제를 사용하여 5분 안에 전 세계에 출시할 수 있습니다.

### Step 1. GitHub 원격 저장소 생성 및 코드 푸시
1. 본인의 GitHub에 로그인하고 새로운 Repository(예: `my-travel-book`)를 생성합니다.
2. 로컬 컴퓨터의 프로젝트 루트 폴더에서 아래 Git 명령어를 실행해 업로드합니다.
   ```bash
   git init
   git add .
   git commit -m "feat: AI 여행 스토리텔링 책방 최초 완성"
   git branch -M main
   git remote add origin https://github.com/사용자이름/my-travel-book.git
   git push -u origin main
   ```

### Step 2. Vercel 가입 및 프로젝트 연동
1. [Vercel 공식 홈페이지](https://vercel.com)에 GitHub 계정으로 가입 및 로그인합니다.
2. 대시보드에서 `Add New` ➡️ `Project`를 누르고, 방금 업로드한 GitHub 저장소(`my-travel-book`)를 찾아 **Import** 합니다.

### Step 3. 환경 변수 (Environment Variables) 등록 (⚠️ 매우 중요!)
배포 설정창 하단의 **Environment Variables** 탭을 열고 아래 인증키 정보를 정확히 기재합니다.
* **`GEMINI_API_KEY`**: Google AI Studio에서 발급받은 무료 Gemini API 키.
* **`UNSPLASH_ACCESS_KEY`**: Unsplash Developer 사이트에서 발급받은 이미지 API 액세스 키 (생략 시 기본 풍경 매칭으로 우회 작동).

### Step 4. 배포(Deploy) 완료
* **Deploy** 버튼을 누르면 Vercel이 파이썬 패키지를 자동으로 내려받고 빌드하여 1~2분 안에 무료 도메인 주소(예: `https://my-travel-book.vercel.app`)를 발급해 줍니다.
* 이후 GitHub 저장소로 코드를 푸시(`git push`)할 때마다 Vercel이 변경 사항을 감지해 자동으로 최신 배포를 갱신합니다.

---

## 4. 품질 검증 및 테스트 시나리오

서비스 배포 전 다음 시나리오를 통해 안정성을 검증합니다.

| 테스트 ID | 테스트 영역 | 검증 항목 | 기대 결과 |
| :--- | :--- | :--- | :--- |
| **TC-01** | **입력 폼 및 옵션** | 세부 옵션 아코디언 버튼 클릭 | 세부 설정창이 부드러운 애니메이션으로 여닫히며 아이콘 텍스트 변환 검증 |
| **TC-02** | **예외 및 실패** | 검색창 비우고 제출 / API 미등록 상태 호출 | 에러 메시지가 담긴 모달 경고창이 정확히 노출되며 복구 여부 확인 |
| **TC-03** | **반응형 레이아웃** | 브라우저 창 너비를 768px 이하로 인위적 축소 | 3D 양면 책에서 모바일 전용 1면 카드 뷰 및 슬라이드 구조로 자동 전환 검증 |
| **TC-04** | **오디오 낭독** | 재생(▶) 및 일시정지(⏸) 버튼 작동 | 음성이 매끄러운 한국어 발음으로 재생되며, 페이지 이동 시 낭독이 정지 후 새로 동기화되는지 확인 |
| **TC-05** | **데이터 무결성** | 생성 완료 후 홈 이동 및 초기화 | 홈 버튼 및 뒤로가기 클릭 시 전자책이 해제되고 폼 데이터가 깨끗이 초기화되는지 확인 |
