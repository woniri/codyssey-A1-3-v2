/* ==========================================================================
   think-travel (여행 책방) Javascript (Enhancement Core Logic)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // 1. DOM 요소 선택
  const btnToggleOptions = document.getElementById("btnToggleOptions");
  const optionsAccordion = document.getElementById("optionsAccordion");
  const accordionIcon = document.getElementById("accordionIcon");
  const creationForm = document.getElementById("creationForm");
  const creationCard = document.getElementById("creationCard");
  const bookshelfWrapper = document.getElementById("bookshelfWrapper");
  const booksGrid = document.getElementById("booksGrid");
  const bookshelfTitle = document.getElementById("bookshelfTitle");
  const btnRotateShelf = document.getElementById("btnRotateShelf");
  
  const loadingContainer = document.getElementById("loadingContainer");
  const loadingMessage = document.getElementById("loadingMessage");
  const bookWrapper = document.getElementById("bookWrapper");
  const ebook = document.getElementById("ebook");
  const bgBlur = document.getElementById("bgBlur");

  const btnPrevPage = document.getElementById("btnPrevPage");
  const btnNextPage = document.getElementById("btnNextPage");
  const pageIndicator = document.getElementById("pageIndicator");

  const btnPlayAudio = document.getElementById("btnPlayAudio");
  const btnStopAudio = document.getElementById("btnStopAudio");
  const audioStatus = document.getElementById("audioStatus");
  const btnDownloadBook = document.getElementById("btnDownloadBook");
  const btnShareBook = document.getElementById("btnShareBook");
  const btnOpenChatbot = document.getElementById("btnOpenChatbot");
  const btnCloseChatbot = document.getElementById("btnCloseChatbot");
  const chatbotDrawer = document.getElementById("chatbotDrawer");
  const chatbotMessages = document.getElementById("chatbotMessages");
  const chatbotInput = document.getElementById("chatbotInput");
  const btnSendChatMessage = document.getElementById("btnSendChatMessage");
  let chatbotHistory = []; // 챗봇 대화 기록 상태

  // 캐비닛 보관함 관련
  const btnOpenCabinet = document.getElementById("btnOpenCabinet");
  const btnCloseCabinet = document.getElementById("btnCloseCabinet");
  const cabinetDrawer = document.getElementById("cabinetDrawer");
  const cabinetList = document.getElementById("cabinetList");

  // 모달 팝업
  const errorModal = document.getElementById("errorModal");
  const errorTitle = document.getElementById("errorTitle");
  const errorMessage = document.getElementById("errorMessage");
  const btnCloseModal = document.getElementById("btnCloseModal");

  const btnHome = document.getElementById("btnHome");
  const btnBackToForm = document.getElementById("btnBackToForm");
  const btnBackToFormFromShelf = document.getElementById("btnBackToFormFromShelf");

  // 2. 전역 상태 데이터
  let currentSearchQuery = "";     // 원본 검색어 (예: "대한민국")
  let searchResultData = null;      // 1차 search 결과 (책 목록)
  let activeBookData = null;        // 2차 상세 스토리 생성 결과
  let currentPageIndex = 0;        // 뷰어 페이지 인덱스
  let totalPages = 0;              // 전체 페이지 개수
  let loadingInterval = null;      // 로딩 멘트 타이머
  let synth = window.speechSynthesis;
  let utterance = null;            // TTS
  let isPlayingAudio = false;
  let ambientAudio = null;         // ASMR 배경음용 Audio 객체

  // 책꽂이 로테이션 상태
  let shelfStartIndex = 0;
  const itemsPerShelf = 4;          // 한 선반에 꽂을 기본 책 개수 (3~5개 가변 범위 내 4권 기본값 권장)

  // 3. 캐비닛 슬라이드 Drawer 제어
  btnOpenCabinet.addEventListener("click", () => {
    loadCabinetList();
    cabinetDrawer.classList.add("open");
    chatbotDrawer.classList.remove("open"); // 챗봇이 열려있다면 닫기
  });

  btnCloseCabinet.addEventListener("click", () => {
    cabinetDrawer.classList.remove("open");
  });

  // 4. 아코디언 설정
  btnToggleOptions.addEventListener("click", () => {
    const isOpen = optionsAccordion.classList.contains("open");
    if (isOpen) {
      optionsAccordion.classList.remove("open");
      accordionIcon.textContent = "▼";
    } else {
      optionsAccordion.classList.add("open");
      accordionIcon.textContent = "▲";
    }
  });

  // 5. 1차 여행지 검색
  creationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const destination = document.getElementById("destination").value.trim();
    const style = document.querySelector('input[name="style"]:checked').value;
    const duration = document.getElementById("durationSelect").value;
    
    const checkedThemes = [];
    document.querySelectorAll('input[name="themes"]:checked').forEach((cb) => {
      checkedThemes.push(cb.value);
    });

    if (!destination) {
      showError("입력 오류", "여행지를 입력해 주세요.");
      return;
    }

    currentSearchQuery = destination;
    shelfStartIndex = 0; // 로테이션 오프셋 리셋

    creationCard.style.display = "none";
    loadingContainer.style.display = "flex";
    startLoadingMessages(destination, "search");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination,
          style: style,
          duration: duration,
          themes: checkedThemes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP 통신 에러: ${response.status}`);
      }

      const data = await response.json();
      searchResultData = data;
      
      stopLoadingMessages();
      loadingContainer.style.display = "none";

      if (data.splitType === "SINGLE" && data.books && data.books.length > 0) {
        const singleBook = data.books[0];
        loadBookDetail(singleBook, style, duration, checkedThemes);
      } else {
        renderBookShelf(style, duration, checkedThemes);
      }

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      creationCard.style.display = "block";
      
      let errorTitle = "서재 구성 실패";
      let errorMsg = err.message || "서재를 구성하는 도중 문제가 생겼습니다.";
      
      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("exhausted")) {
        errorTitle = "📖 서버가 잠시 여행을 떠났습니다 (API 한도 초과)";
        errorMsg = "하루 동안 엮을 수 있는 도서관 호출 한도(API Quota Limit)를 모두 소진했거나 요청이 너무 몰리고 있습니다. 잠시만 대기한 뒤 다시 시도해 주세요.";
      } else if (errorMsg.toLowerCase().includes("api key") || errorMsg.toLowerCase().includes("apikey") || errorMsg.toLowerCase().includes("auth") || errorMsg.includes("401")) {
        errorTitle = "🔑 열쇠가 유효하지 않습니다 (인증 실패)";
        errorMsg = "설정된 Gemini API 키가 유효하지 않거나 유실되었습니다. Vercel 환경 변수(GEMINI_API_KEY) 설정을 확인하고 재배포(Redeploy) 해주세요.";
      } else if (errorMsg.toLowerCase().includes("fetch") || errorMsg.toLowerCase().includes("network") || errorMsg.toLowerCase().includes("failed to fetch") || errorMsg.includes("500") || errorMsg.includes("502") || errorMsg.includes("504")) {
        errorTitle = "🌐 통신망이 끊겼습니다 (네트워크 오류)";
        errorMsg = "서버 함수가 응답하지 않거나 인터넷 연결이 원활하지 않습니다. 인터넷 연결을 확인하고 새로고침 후 다시 실행해 보세요.";
      } else {
        errorTitle = "📚 서재를 여는 데 실패했습니다";
        errorMsg = `서재를 탐색하는 도중 예기치 못한 에러가 발생했습니다.<br><br><span style="font-size:0.8rem; opacity:0.8; color:var(--color-secondary);">오류 메시지: ${errorMsg}</span>`;
      }
      
      showError(errorTitle, errorMsg);
    }
  });

  // 6. 스마트 서재(Book Shelf) 렌더러 (로테이션 및 이미지 썸네일 노출 탑재)
  function renderBookShelf(style, duration, themes) {
    if (!searchResultData || !searchResultData.books) return;
    
    booksGrid.innerHTML = "";
    bookshelfTitle.textContent = `📂 ${searchResultData.destination} 서재`;

    const allBooks = searchResultData.books;
    const totalBooks = allBooks.length;

    // 로테이션용 슬라이스 범위 계산 (3~5권 가변)
    // 전체 후보가 itemsPerShelf(4)보다 많으면 다른곳보기 버튼 활성화
    if (totalBooks <= itemsPerShelf) {
      btnRotateShelf.style.display = "none";
    } else {
      btnRotateShelf.style.display = "block";
    }

    // 오프셋을 기준으로 3~5권의 도서 서적을 잘라 꽂아줍니다.
    const shelfBooks = [];
    for (let i = 0; i < itemsPerShelf; i++) {
      const idx = (shelfStartIndex + i) % totalBooks;
      shelfBooks.push(allBooks[idx]);
    }
    
    shelfBooks.forEach((book) => {
      const bookCard = document.createElement("div");
      bookCard.className = "shelf-book loading-cover"; // 로딩 스켈레톤 기본 탑재
      
      // 책꽂이 책 표지 일러스트 썸네일 입히기 (Pollinations AI 화풍 연동)
      const thumbPrompt = book.coverPrompt || `${book.theme} cozy flat vector travel poster illustration, warm pastel color palette, minimal line art style, aesthetic composition, highly detailed`;
      const thumbUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(thumbPrompt)}?width=130&height=190&nologo=true`;
      
      const img = new Image();
      img.src = thumbUrl;
      img.onload = () => {
        bookCard.style.backgroundImage = `url('${thumbUrl}')`;
        bookCard.classList.remove("loading-cover");
        bookCard.classList.add("loaded-cover");
      };
      img.onerror = () => {
        // 이미지 로딩 실패 시 아늑한 그라데이션 폴백
        bookCard.style.background = "linear-gradient(135deg, #FAF6F0 0%, #D6A28C 100%)";
        bookCard.classList.remove("loading-cover");
      };

      bookCard.innerHTML = `
        <div class="shelf-book-title">${book.title}</div>
        <div class="shelf-book-badge">도서 제작</div>
      `;

      bookCard.addEventListener("click", () => {
        loadBookDetail(book, style, duration, themes);
      });

      booksGrid.appendChild(bookCard);
    });

    creationCard.style.display = "none";
    bookshelfWrapper.style.display = "flex";
  }

  // 🔄 다른 곳 보기 버튼 리스너 (로테이션 오프셋 조절)
  btnRotateShelf.addEventListener("click", () => {
    if (!searchResultData || !searchResultData.books) return;
    shelfStartIndex = (shelfStartIndex + itemsPerShelf) % searchResultData.books.length;
    
    // 현재 선택 옵션 값 복원하여 렌더링
    const style = document.querySelector('input[name="style"]:checked').value;
    const duration = document.getElementById("durationSelect").value;
    const checkedThemes = [];
    document.querySelectorAll('input[name="themes"]:checked').forEach((cb) => {
      checkedThemes.push(cb.value);
    });

    renderBookShelf(style, duration, checkedThemes);
  });

  // 7. 2차 상세 스토리 생성 API 호출 (캐시 우선 검사)
  async function loadBookDetail(book, style, duration, themes) {
    const storageKey = "my_travel_library";
    const cachedLibrary = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    const existingBook = cachedLibrary.find(b => b.destination === book.theme && b.style === style && b.duration === duration);

    if (existingBook) {
      activeBookData = existingBook;
      creationCard.style.display = "none";
      bookshelfWrapper.style.display = "none";
      buildEbook(existingBook);
      return;
    }

    bookshelfWrapper.style.display = "none";
    loadingContainer.style.display = "flex";
    startLoadingMessages(book.theme, "generate");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: book.theme,
          parent_destination: currentSearchQuery,
          style: style,
          duration: duration,
          themes: themes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP 상세 생성 에러: ${response.status}`);
      }

      const bookData = await response.json();
      if (bookData.error) {
        throw new Error(bookData.message);
      }

      activeBookData = bookData;
      
      // 커버 이미지 프리로드 (Pollinations AI 속도 지연 대응)
      const coverPrompt = bookData.coverImagePrompt || `${bookData.destination} cozy flat vector travel poster illustration, minimal line art style, warm pastel color palette, aesthetic composition, highly detailed`;
      const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=1024&height=768&nologo=true`;
      
      const img = new Image();
      img.src = coverImageUrl;
      
      // 최대 8초간 프리로드 대기 후 강제 진입 (에러/타임아웃 방지)
      const timeoutId = setTimeout(() => {
        proceed();
      }, 8000);
      
      img.onload = img.onerror = () => {
        clearTimeout(timeoutId);
        proceed();
      };
      
      function proceed() {
        stopLoadingMessages();
        loadingContainer.style.display = "none";
        saveToCabinet(bookData, style, duration);
        buildEbook(bookData);
      }

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      if (searchResultData && searchResultData.splitType === "SINGLE") {
        creationCard.style.display = "block";
      } else {
        bookshelfWrapper.style.display = "flex";
      }
      
      let errorTitle = "도서 제작 실패";
      let errorMsg = err.message || "책 스토리를 생성하는 데 실패했습니다.";
      
      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("exhausted")) {
        errorTitle = "📖 서버가 잠시 여행을 떠났습니다 (API 한도 초과)";
        errorMsg = "하루 동안 도서를 생성할 수 있는 API 호출 제한 한도를 소진했습니다. 잠시 후 다시 시도하시거나 API 할당량을 확인해 주세요.";
      } else if (errorMsg.toLowerCase().includes("api key") || errorMsg.toLowerCase().includes("apikey") || errorMsg.toLowerCase().includes("auth") || errorMsg.includes("401")) {
        errorTitle = "🔑 열쇠가 유효하지 않습니다 (인증 실패)";
        errorMsg = "Gemini API 키가 올바르지 않거나 활성화되지 않았습니다. Vercel 환경 변수(GEMINI_API_KEY) 설정을 확인하고 재배포(Redeploy) 해주세요.";
      } else if (errorMsg.toLowerCase().includes("fetch") || errorMsg.toLowerCase().includes("network") || errorMsg.toLowerCase().includes("failed to fetch") || errorMsg.includes("500") || errorMsg.includes("502") || errorMsg.includes("504")) {
        errorTitle = "🌐 통신망이 끊겼습니다 (네트워크 오류)";
        errorMsg = "백엔드 서버리스 서버 함수 응답 지연 또는 일시적 중단이 발생했습니다. 통신 상태를 확인하시거나 웹페이지를 새로고침 해보세요.";
      } else {
        errorTitle = "📚 책을 엮는 도중 펜촉이 부러졌습니다";
        errorMsg = `도서 제작 중 일시적인 오류가 발생했습니다.<br><br><span style="font-size:0.8rem; opacity:0.8; color:var(--color-secondary);">상세 에러: ${errorMsg}</span>`;
      }
      
      showError(errorTitle, errorMsg);
    }
  }

  // 8. 빈티지 아날로그 지도 SVG 렌더러 (실제 위경도 상대 매핑 기술 탑재)
  function generateSvgRouteMap(timeline, destination) {
    if (!timeline || timeline.length === 0) return "";
    
    const width = 320;
    const height = 200;
    const padding = 35; // 노드가 잘리지 않도록 안전 패딩 설정
    
    // 위경도 값이 있는 유효 지점 추출
    const validPoints = timeline.filter(item => typeof item.lat === 'number' && typeof item.lng === 'number');
    
    let coords = [];
    
    if (validPoints.length === 0) {
      // 위경도 좌표가 아예 없는 경우: 기본 정적 분산 좌표 사용 (폴백)
      const fallbackCoords = [
        { x: 60, y: 130 },
        { x: 130, y: 50 },
        { x: 210, y: 130 },
        { x: 275, y: 65 }
      ];
      coords = timeline.map((item, idx) => fallbackCoords[idx] || { x: 50 + idx * 70, y: 80 });
    } else if (validPoints.length === 1) {
      // 1개 지점만 있는 경우 정중앙
      coords = [{ x: width / 2, y: height / 2 }];
    } else {
      // 2개 이상 지점인 경우 Bounding Box 계산하여 비례 변환
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      
      validPoints.forEach(pt => {
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
        if (pt.lng < minLng) minLng = pt.lng;
        if (pt.lng > maxLng) maxLng = pt.lng;
      });
      
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;
      
      timeline.forEach(item => {
        if (typeof item.lat === 'number' && typeof item.lng === 'number') {
          // 경도(x축) 비례 계산
          const x = lngRange === 0 
            ? width / 2 
            : padding + ((item.lng - minLng) / lngRange) * (width - 2 * padding);
          
          // 위도(y축) 비례 계산 (위도가 클수록 지도 위쪽(y값이 작아짐))
          const y = latRange === 0 
            ? height / 2 
            : height - (padding + ((item.lat - minLat) / latRange) * (height - 2 * padding));
            
          coords.push({ x, y });
        } else {
          // 좌표가 잘못 누락된 경우 기본값
          coords.push({ x: width / 2, y: height / 2 });
        }
      });
    }
    
    let pathD = "";
    let nodesHtml = "";
    
    coords.forEach((pt, index) => {
      const item = timeline[index];
      if (index === 0) {
        pathD += `M ${pt.x} ${pt.y}`;
      } else {
        pathD += ` L ${pt.x} ${pt.y}`;
      }
      
      // 장소 이름 가독성을 극대화하기 위한 라벨 오프셋 자동 조정 (홀수/짝수 교차 위아래 배치)
      const labelYOffset = index % 2 === 0 ? 25 : -14;
      const timeYOffset = index % 2 === 0 ? -12 : 27;
      
      nodesHtml += `
        <g class="map-node">
          <!-- 핀 그림자 및 원형 핀 -->
          <circle cx="${pt.x}" cy="${pt.y}" r="9" fill="var(--color-secondary)" stroke="#fff" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(62,64,63,0.3));" />
          <circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#fff" />
          
          <!-- 시간대 및 장소명 라벨 (격차 교차 조절로 겹침 방지) -->
          <text x="${pt.x}" y="${pt.y + timeYOffset}" text-anchor="middle" class="map-node-time">${item.time}</text>
          <text x="${pt.x}" y="${pt.y + labelYOffset}" text-anchor="middle" class="map-node-label" style="font-weight: 700; fill: var(--text-charcoal); text-shadow: 0 1px 2px rgba(255,255,255,0.9);">${item.place}</text>
        </g>
      `;
    });
    
    return `
      <svg viewBox="0 0 320 200" class="vintage-route-map">
        <defs>
          <pattern id="mapGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(62,64,63,0.035)" stroke-width="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" rx="8" />
        
        <!-- 그리드 외곽 테두리선 -->
        <rect x="4" y="4" width="312" height="192" fill="none" stroke="rgba(62,64,63,0.08)" stroke-width="1.5" stroke-dasharray="3, 3" rx="4" />
        
        <!-- 경로 연결 점선 -->
        <path d="${pathD}" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-dasharray="6, 7" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));" />
        
        ${nodesHtml}
      </svg>
    `;
  }

  // 8. 3D 전자책 뷰어 빌더 (양면 와이드 전면 표지 및 빈티지 스크랩북 연동)
  function buildEbook(data) {
    ebook.innerHTML = "";
    currentPageIndex = 0;
    window.activeMaps = {}; // 이전 도서의 지도 인스턴스 캐시 리셋

    // 전체느낌.png의 화풍과 매칭되는 flat vector illustration cover URL
    const coverPrompt = data.coverImagePrompt || `${data.destination} cozy flat vector travel poster illustration, minimal line art style, warm pastel color palette, aesthetic composition, highly detailed`;
    const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=1024&height=768&nologo=true`;
    
    bgBlur.style.backgroundImage = `url('${coverImageUrl}')`;

    const tempPages = [];

    // [페이지 1~2] 양면 전면 표지 (Cover Spread)
    tempPages.push({
      type: "cover cover-half-left",
      html: `
        <div class="visual-panel cover-half-left-panel" style="padding: 0; background-image: url('${coverImageUrl}');">
          <!-- 커버 타이틀 (왼쪽) -->
          <div class="cover-text-left">
            <h1 class="cover-main-title">${data.destination}</h1>
            <p class="cover-sub-title">${data.subtitle}</p>
          </div>
        </div>
      `
    });

    tempPages.push({
      type: "cover cover-half-right",
      html: `
        <div class="visual-panel cover-half-right-panel" style="padding: 0; background-image: url('${coverImageUrl}');">
          <!-- 커버 타이틀 (오른쪽 데코) -->
          <div class="cover-text-right">
            <div class="cover-author-tag">AI가 엮음</div>
            <div class="cover-year-tag">${new Date().getFullYear()}년</div>
          </div>
        </div>
      `
    });

    // [페이지 3 ~ n] 본문 페이지 쌍 (Left: 스크랩북 이미지, Right: 텍스트)
    data.pages.forEach((p, idx) => {
      const titleHeaderHtml = idx === 0 
        ? `<div style="font-family: var(--font-serif); font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.5px; border-bottom: 1px dashed rgba(62,64,63,0.15); padding-bottom: 0.25rem;">
            ${data.title}
           </div>`
        : "";

      // Left: 스크랩북/폴라로이드 사진 프레임 (visual-image 클래스 제거하여 높이 붕괴 해결!)
      tempPages.push({
        type: "visual scrapbook-visual-panel",
        html: `
          <div class="visual-panel scrapbook-visual-panel-bg">
            <div class="photo-card-wrap">
              <div class="photo-tape-top"></div>
              <img class="scrapbook-photo" src="${p.imageUrl}" alt="${p.chapterTitle}" loading="lazy" decoding="async">
              <div class="photo-caption">${p.chapterTitle}</div>
            </div>
            <div class="visual-credits">사진 출처: Unsplash</div>
          </div>
        `
      });

      // Right: 텍스트
      tempPages.push({
        type: "story",
        audioText: p.audioText,
        html: `
          <div class="page-content story-panel">
            <div class="story-panel-inner">
              ${titleHeaderHtml}
              <div class="story-header">
                <div class="story-chapter">${p.chapterTitle || `제 ${idx + 1}장`}</div>
                <div class="story-title">${p.chapterTitle ? p.chapterTitle.split('.')[1] || p.chapterTitle : data.title}</div>
              </div>
              <div class="story-body">${p.storyText}</div>
            </div>
            <div class="story-footer">
              <span>여행 책방 📖</span>
              <span>${idx + 1}쪽</span>
            </div>
          </div>
        `
      });
    });

    // [일정 페이지] (Left: AI 생성 빈티지 지도 일러스트 + Leaflet.js 인터랙티브 지도, Right: 추천 일정 리스트 및 카카오/구글 맵/후기 연동)
    data.itinerary.forEach((dayPlan) => {
      let timelineHtml = "";
      
      // 국내 여행지 판별 (네이버 지도 대응용)
      const isDomestic = /서울|부산|제주|경주|강릉|대구|인천|광주|대전|울산|수원|전주|춘천|속초|대한민국|한국/i.test(data.destination);

      dayPlan.timeline.forEach((item, index) => {
        // 네이버 지도 및 구글 지도 동적 분기 링크 구성
        const mapUrl = isDomestic
          ? `https://map.naver.com/v5/search/${encodeURIComponent(item.place)}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.place + ' ' + data.destination)}`;
          
        const reviewUrl = isDomestic
          ? `https://search.naver.com/search.naver?query=${encodeURIComponent(item.place + ' 후기')}`
          : `https://www.google.com/search?q=${encodeURIComponent(item.place + ' ' + data.destination + ' reviews')}`;

        timelineHtml += `
          <div class="timeline-item">
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-place">
              <span class="place-name-txt">${item.place}</span>
              <div class="timeline-action-buttons">
                <a href="${mapUrl}" target="_blank" class="map-action-btn map-loc" title="지도 위치 확인">📍 위치</a>
                <a href="${reviewUrl}" target="_blank" class="map-action-btn map-rev" title="여행 후기 보기">💬 후기</a>
              </div>
            </div>
            <div class="timeline-desc">${item.desc}</div>
          </div>
        `;
      });

      // Left Page: 감성 아날로그 엽서 지도 (0초 로드, 실제 위경도 SVG 매핑 및 빈티지 스크랩북 콜라주 데코)
      const bgImgUrl = data.pages[dayPlan.day - 1]?.imageUrl || data.pages[0]?.imageUrl || "";
      const stampImgUrl = data.pages[(dayPlan.day) % data.pages.length]?.imageUrl || data.pages[0]?.imageUrl || "";

      tempPages.push({
        type: "visual itinerary-map-panel",
        html: `
          <div class="visual-panel map-panel-container" style="padding: 0; border: 1px solid rgba(150, 130, 110, 0.15); height: 100%; display: flex; flex-direction: column;">
            <!-- 탭 전환 컨트롤 버튼 -->
            <div class="map-tab-controls" style="z-index: 10;">
              <button class="map-tab-btn active" data-target="postcard-day-${dayPlan.day}">🎨 엽서 지도</button>
              <button class="map-tab-btn" data-target="interactive-day-${dayPlan.day}" data-day="${dayPlan.day}">🗺️ 실시간 약도</button>
            </div>
            
            <!-- 탭 1: 아날로그 감성 엽서 지도 (서버 통신 없이 0초 만에 렌더링) -->
            <div class="map-tab-content postcard-day-${dayPlan.day} active-tab" style="width: 100%; height: 100%; flex: 1; position: relative; overflow: hidden;">
              <!-- 엽서 배경 래퍼 (Unsplash 풍경 은은하게 합성) -->
              <div class="postcard-bg-wrap" style="background-image: url('${bgImgUrl}');"></div>
              
              <!-- 아날로그 모눈 격자 오버레이 -->
              <div class="postcard-grid-overlay"></div>
              
              <!-- 스크랩북 빈티지 콜라주 데코레이션 -->
              <div class="postcard-scrapbook-overlay">
                <!-- 마스킹 테이프 -->
                <div class="masking-tape"></div>
                
                <!-- 빈티지 우표 및 포스트마크 -->
                <div class="vintage-stamp">
                  <div class="stamp-inner" style="background-image: url('${stampImgUrl}');">
                    <span class="stamp-price">2026</span>
                  </div>
                  <div class="postmark-circle">${data.destination.substring(0, 8).toUpperCase()}</div>
                </div>
                
                <!-- 엽서 손글씨 타이포그래피 (Nanum Pen Script 적용) -->
                <div class="postcard-handwriting">
                  <div class="hand-title">${data.destination}</div>
                  <div class="hand-subtitle">Day ${dayPlan.day} 여정</div>
                </div>
              </div>

              <!-- 빈티지 경로 SVG 일러스트 오버레이 (실제 위경도 100% 반영) -->
              ${generateSvgRouteMap(dayPlan.timeline, data.destination)}
              
              <div class="map-panel-title-overlay">
                <span>Day ${dayPlan.day} 추천 경로</span>
                <button class="postcard-download-btn" data-url="${bgImgUrl}" data-filename="${data.destination}_Day${dayPlan.day}_Bg.jpg" title="엽서 배경 사진 다운로드">💾 풍경 저장</button>
              </div>
            </div>
            
            <!-- 탭 2: Leaflet 실시간 인터랙티브 지도 -->
            <div class="map-tab-content interactive-day-${dayPlan.day}" style="display: none; width: 100%; height: 100%; flex: 1; position: relative;">
              <div id="leaflet-map-day-${dayPlan.day}" class="leaflet-map-box"></div>
            </div>
          </div>
        `
      });

      // Right Page: 추천 일정 리스트
      tempPages.push({
        type: "itinerary",
        html: `
          <div class="page-content itinerary-panel">
            <h3>📅 추천 일정: Day ${dayPlan.day}</h3>
            <div class="timeline">
              ${timelineHtml}
            </div>
          </div>
        `
      });
    });

    // 짝수 페이지 맞춤 보정
    if (tempPages.length % 2 !== 0) {
      tempPages.push({
        type: "backcover",
        html: `
          <div class="page-content story-panel" style="background-color: var(--text-charcoal); color: #FFFFFF; justify-content: center; align-items: center; border-radius: 0 12px 12px 0;">
            <h4 style="font-family: var(--font-serif); font-size: 1.5rem; text-shadow: 0 2px 8px rgba(0,0,0,0.5);">📖 think-travel</h4>
            <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">나만을 위한 감성 여행 도서관</p>
          </div>
        `
      });
    }

    // Z-Index 설정
    tempPages.forEach((page, index) => {
      const pageDiv = document.createElement("div");
      
      if (index % 2 === 0) {
        pageDiv.className = `page page-left ${page.type.includes("cover") ? "book-cover" : "book-inside"} ${page.type}`;
      } else {
        pageDiv.className = `page page-right ${page.type.includes("backcover") ? "book-cover" : "book-inside"} ${page.type}`;
      }

      if (page.audioText) {
        pageDiv.setAttribute("data-audio-text", page.audioText);
      }

      pageDiv.innerHTML = page.html;
      ebook.appendChild(pageDiv);
    });

    totalPages = tempPages.length;
    bookWrapper.style.display = "flex";
    updateViewer();
  }

  // 9. 뷰어 화면 렌더링 업데이트
  function updateViewer() {
    const isMobile = window.innerWidth <= 768;
    const pages = ebook.querySelectorAll(".page");

    if (isMobile) {
      pages.forEach((page, idx) => {
        if (idx === currentPageIndex) {
          page.classList.add("active-page");
        } else {
          page.classList.remove("active-page");
        }
      });
      pageIndicator.textContent = `Page ${currentPageIndex + 1} / ${totalPages}`;
    } else {
      pages.forEach((page, idx) => {
        page.classList.add("active-page");
        
        if (idx < currentPageIndex) {
          page.style.transform = "rotateY(-180deg)";
          page.style.zIndex = idx;
        } else if (idx === currentPageIndex || idx === currentPageIndex + 1) {
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = 100;
        } else {
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = totalPages - idx;
        }
      });

      const currentSpread = Math.floor(currentPageIndex / 2) + 1;
      const totalSpreads = Math.ceil(totalPages / 2);
      pageIndicator.textContent = `Spread ${currentSpread} / ${totalSpreads}`;
    }

    btnPrevPage.disabled = currentPageIndex === 0;
    if (isMobile) {
      btnNextPage.disabled = currentPageIndex === totalPages - 1;
    } else {
      btnNextPage.disabled = currentPageIndex >= totalPages - 2;
    }

    if (isPlayingAudio) {
      playCurrentPageAudio();
    }
  }

  // 이전/다음 단추 리스너
  btnPrevPage.addEventListener("click", () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (currentPageIndex > 0) currentPageIndex--;
    } else {
      if (currentPageIndex >= 2) currentPageIndex -= 2;
    }
    updateViewer();
  });

  btnNextPage.addEventListener("click", () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (currentPageIndex < totalPages - 1) currentPageIndex++;
    } else {
      if (currentPageIndex < totalPages - 2) currentPageIndex += 2;
    }
    updateViewer();
  });

  window.addEventListener("resize", () => {
    if (activeBookData) {
      updateViewer();
    }
  });

  // 10. 로딩 메시지 순환
  function startLoadingMessages(dest, mode) {
    const searchMessages = [
      `"${dest}" 여행지를 분석하는 중... 🗺️`,
      `서재 책꽂이에 가이드북을 찾고 있습니다... 📖`,
      `책꽂이 정돈 중... 🧹`
    ];

    const generateMessages = [
      `"${dest}" 가이드북을 집필하는 중... ✍️`,
      `선택하신 작가의 문체로 감성 에세이를 다듬는 중... ✒️`,
      `아날로그 수채화 일러스트 커버를 인쇄하는 중... 🎨`,
      `일정별 아날로그 지도와 스크랩 티켓을 드로잉하는 중... 🗺️`,
      `공간 음향 및 낭독 서비스를 세팅하고 있습니다... 🎙️`
    ];

    const targetList = mode === "search" ? searchMessages : generateMessages;
    let idx = 0;
    loadingMessage.textContent = targetList[0];

    loadingInterval = setInterval(() => {
      idx = (idx + 1) % targetList.length;
      loadingMessage.textContent = targetList[idx];
    }, 2000);
  }

  function stopLoadingMessages() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }
  }

  // 11. 로컬 스토리지 책 보관함 제어 (개별 삭제 단추 탑재 및 전파 차단)
  function saveToCabinet(bookData, style, duration) {
    try {
      const storageKey = "my_travel_library";
      let library = JSON.parse(localStorage.getItem(storageKey)) || [];
      
      library = library.filter(b => b.title !== bookData.title);

      const coverPrompt = bookData.coverImagePrompt || `${bookData.destination} paper art`;
      const coverThumb = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=150&height=200&nologo=true`;

      const bookItem = {
        title: bookData.title,
        subtitle: bookData.subtitle,
        destination: bookData.destination,
        coverImagePrompt: bookData.coverImagePrompt,
        pages: bookData.pages,
        itinerary: bookData.itinerary,
        coverThumb: coverThumb,
        style: style,
        duration: duration,
        savedAt: new Date().toLocaleDateString()
      };

      library.unshift(bookItem);
      localStorage.setItem(storageKey, JSON.stringify(library));
    } catch (e) {
      console.warn("로컬 스토리지 사용 제한:", e);
    }
  }

  function loadCabinetList() {
    cabinetList.innerHTML = "";
    const storageKey = "my_travel_library";
    const library = JSON.parse(localStorage.getItem(storageKey)) || [];

    if (library.length === 0) {
      cabinetList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-size: 0.9rem;">
          📭 보관함이 비어 있습니다.<br>나만의 여행책을 생성해 보세요!
        </div>
      `;
      return;
    }

    library.forEach((book) => {
      const card = document.createElement("div");
      card.className = "cabinet-card";
      card.innerHTML = `
        <img class="cabinet-thumb" src="${book.coverThumb}" alt="${book.title}">
        <div class="cabinet-info">
          <div class="cabinet-title">${book.title}</div>
          <div class="cabinet-meta">${book.destination} | ${book.duration} (${book.savedAt})</div>
        </div>
        <!-- 개별 삭제 버튼 추가 -->
        <button class="btn-delete-card" title="보관함에서 삭제">×</button>
      `;

      // ⚠️ 삭제 단추 클릭 이벤트 (이벤트 버블링 차단 및 삭제 로직) ⚠️
      const btnDelete = card.querySelector(".btn-delete-card");
      btnDelete.addEventListener("click", (evt) => {
        evt.stopPropagation(); // 부모 카드 클릭 이벤트 전파 차단!
        
        let currentLibrary = JSON.parse(localStorage.getItem(storageKey)) || [];
        // 해당 도서 필터링 삭제
        currentLibrary = currentLibrary.filter(b => b.title !== book.title);
        localStorage.setItem(storageKey, JSON.stringify(currentLibrary));
        
        // 보관함 목록 리렌더링
        loadCabinetList();
      });

      // 카드 클릭 시 도서 즉시 열기
      card.addEventListener("click", () => {
        activeBookData = book;
        cabinetDrawer.classList.remove("open");
        
        creationCard.style.display = "none";
        bookshelfWrapper.style.display = "none";
        buildEbook(book);
      });

      cabinetList.appendChild(card);
    });
  }

  // 12. 소장용 HTML 파일 다운로드 모듈 (Export)
  btnDownloadBook.addEventListener("click", () => {
    if (!activeBookData) return;

    const data = activeBookData;
    const coverPrompt = data.coverImagePrompt || `${data.destination} paper diorama`;
    const coverImg = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=800&height=600&nologo=true`;

    let pagesHtml = "";
    data.pages.forEach((p, idx) => {
      const img = p.imageUrl || "https://images.unsplash.com/photo-1488646953014-85cb44e25828";
      pagesHtml += `
        <div class="book-page">
          <div class="visual-half">
            <img src="${img}" alt="${p.chapterTitle}">
          </div>
          <div class="text-half">
            <div class="chapter-no">제 ${idx + 1}장</div>
            <h2>${p.chapterTitle}</h2>
            <p>${p.storyText.replace(/\n/g, "<br>")}</p>
          </div>
        </div>
      `;
    });

    let itineraryHtml = "";
    data.itinerary.forEach((dayPlan) => {
      let tl = "";
      dayPlan.timeline.forEach((item) => {
        tl += `
          <div class="timeline-row">
            <div class="time-col">${item.time}</div>
            <div class="detail-col">
              <strong>${item.place}</strong>
              <p>${item.desc}</p>
            </div>
          </div>
        `;
      });
      itineraryHtml += `
        <div class="itinerary-sheet">
          <h2>📅 Day ${dayPlan.day} 추천 일정</h2>
          <div class="timeline-body">${tl}</div>
        </div>
      `;
    });

    const fullHtmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${data.title} - 여행 책방 소장본</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Maru+Buri:wght@400;600&family=Pretendard:wght@400;600&display=swap');
    body {
      font-family: 'Pretendard', sans-serif;
      background-color: #FAF6F0;
      color: #3E403F;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .print-container {
      width: 100%;
      max-width: 800px;
      background-color: #FFFFFF;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(62,64,63,0.1);
    }
    .cover-sheet {
      text-align: center;
      padding: 0;
      border-bottom: 2px dashed #8AA399;
      position: relative;
    }
    .cover-sheet img {
      width: 100%;
      max-height: 500px;
      object-fit: cover;
      filter: sepia(10%);
    }
    .book-page {
      display: flex;
      border-bottom: 1px solid rgba(62,64,63,0.1);
      min-height: 400px;
    }
    .visual-half {
      width: 50%;
      background-color: #FAF6F0;
    }
    .visual-half img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: sepia(10%);
    }
    .text-half {
      width: 50%;
      padding: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .chapter-no {
      font-size: 0.85rem;
      font-weight: 700;
      color: #8AA399;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .text-half h2 {
      font-family: 'Maru Buri', serif;
      font-size: 1.5rem;
      margin: 0 0 20px 0;
    }
    .text-half p {
      font-family: 'Maru Buri', serif;
      font-size: 1rem;
      line-height: 1.8;
      margin: 0;
      text-align: justify;
    }
    .itinerary-sheet {
      padding: 50px 40px;
      border-bottom: 1px solid rgba(62,64,63,0.1);
    }
    .itinerary-sheet h2 {
      font-family: 'Maru Buri', serif;
      font-size: 1.5rem;
      border-bottom: 2px solid #8AA399;
      padding-bottom: 10px;
      margin-top: 0;
    }
    .timeline-body {
      margin-top: 20px;
      border-left: 2px solid #AEBCC4;
      padding-left: 20px;
    }
    .timeline-row {
      margin-bottom: 20px;
      position: relative;
    }
    .timeline-row::before {
      content: "";
      position: absolute;
      left: -26px;
      top: 5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #8AA399;
      border: 2px solid #FFFFFF;
    }
    .time-col {
      font-size: 0.8rem;
      font-weight: 700;
      color: #D6A28C;
      margin-bottom: 3px;
    }
    .detail-col strong {
      font-family: 'Maru Buri', serif;
      font-size: 1.05rem;
    }
    .detail-col p {
      font-size: 0.85rem;
      color: #6A6E6C;
      margin: 5px 0 0 0;
    }
    footer {
      text-align: center;
      padding: 30px;
      font-size: 0.8rem;
      color: #AEBCC4;
    }
    @media print {
      body { background-color: #FFFFFF; padding: 0; }
      .print-container { box-shadow: none; border: none; }
      .book-page { page-break-inside: avoid; }
      .itinerary-sheet { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="cover-sheet">
      <img src="${coverImg}" alt="${data.title}">
    </div>
    <div style="padding: 40px; text-align: center; border-bottom: 1px solid rgba(62,64,63,0.1);">
      <h1 style="font-family: 'Maru Buri', serif; font-size: 2.2rem; margin: 0 0 10px 0;">${data.title}</h1>
      <p style="font-size: 1.1rem; color: #6A6E6C; margin: 0;">${data.subtitle}</p>
    </div>
    ${pagesHtml}
    ${itineraryHtml}
    <footer>
      <p>여행 책방 (think-travel) 📖 - AI 기반 나만의 문학 여행 책방</p>
    </footer>
  </div>
</body>
</html>
    `;

    const blob = new Blob([fullHtmlContent], { type: "text/html" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${data.destination}_가이드북_소장본.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  });

  // 14-2. 소셜 공유 링크 생성 및 복사 (전체 데이터 압축 포함형)
  btnShareBook.addEventListener("click", async () => {
    if (!activeBookData) return;
    
    // 버튼 로딩 피드백
    const originalText = btnShareBook.innerHTML;
    btnShareBook.innerHTML = "⏳ 생성 중...";
    btnShareBook.disabled = true;

    try {
      // 본 도서에 작가 스타일과 기간 정보가 누락되어 있다면 폼 데이터 등으로 채워 전송
      const dataToCompress = { ...activeBookData };
      if (!dataToCompress.style) {
        dataToCompress.style = document.querySelector('input[name="style"]:checked')?.value || "cherry";
      }
      if (!dataToCompress.duration) {
        dataToCompress.duration = document.getElementById("durationSelect")?.value || "당일치기";
      }
      
      // 도서 데이터 압축 인코딩
      const compressedData = await compressBookData(dataToCompress);
      
      const coverPrompt = activeBookData.coverImagePrompt || `${activeBookData.destination} cozy flat vector travel poster illustration`;
      const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=1024&height=768&nologo=true`;
      
      // book_data 파라미터를 해시(#)에 붙여 공유 링크 생성 (URL 파라미터 길이 한계 극복 및 414 방지)
      const shareUrl = `${window.location.origin}/api/share?title=${encodeURIComponent(activeBookData.title)}&subtitle=${encodeURIComponent(activeBookData.subtitle)}&img=${encodeURIComponent(coverImageUrl)}&dest=${encodeURIComponent(activeBookData.destination)}#${compressedData}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        showError("📖 공유 링크 복사 완료", "나만의 감성 가이드북 공유 링크가 복사되었습니다!<br>카카오톡이나 SNS에 공유하면 친구가 똑같은 책을 즉시 펼쳐볼 수 있습니다.", "🔗");
      }).catch(() => {
        showError("공유 링크", `아래 주소를 복사하여 공유해 보세요:<br><br><input type="text" value="${shareUrl}" style="width:100%; padding:8px; border:1px solid rgba(138,163,153,0.3); border-radius:6px; font-size:0.85rem;" onclick="this.select()">`, "🔗");
      });
    } catch (err) {
      console.error("Failed to generate compressed share link:", err);
      showError("공유 링크 생성 실패", "공유 링크를 생성하는 과정에서 에러가 발생했습니다: " + err.message);
    } finally {
      btnShareBook.innerHTML = originalText;
      btnShareBook.disabled = false;
    }
  });

  // 13. Web Speech TTS 음성 제어
  function playCurrentPageAudio() {
    stopAudio();

    if (!activeBookData) return;

    let textToSpeak = "";
    const pages = ebook.querySelectorAll(".page");
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      const activePage = pages[currentPageIndex];
      const audioText = activePage?.getAttribute("data-audio-text");
      const storyBody = activePage?.querySelector(".story-body");
      const itiPanel = activePage?.querySelector(".itinerary-panel");

      if (audioText) {
        textToSpeak = audioText;
      } else if (storyBody) {
        textToSpeak = storyBody.textContent;
      } else if (itiPanel) {
        textToSpeak = itiPanel.textContent;
      }
    } else {
      // ⚠️ 표지 스프레드가 1~2p로 양면 와이드화 됨에 따라 낭독 시작 페이지는 제3페이지(인덱스 2 또는 3) 텍스트 면이 됩니다.
      const rightPageIndex = currentPageIndex + 1;
      const rightPage = pages[rightPageIndex];
      const audioText = rightPage?.getAttribute("data-audio-text");
      const storyBody = rightPage?.querySelector(".story-body");
      const itiPanel = rightPage?.querySelector(".itinerary-panel");

      if (audioText) {
        textToSpeak = audioText;
      } else if (storyBody) {
        textToSpeak = storyBody.textContent;
      } else if (itiPanel) {
        textToSpeak = itiPanel.textContent;
      }
    }

    if (!textToSpeak) {
      audioStatus.textContent = "낭독할 텍스트가 없는 책장입니다.";
      return;
    }

    textToSpeak = textToSpeak.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

    utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR";
    utterance.rate = 1.0;
    utterance.pitch = 0.95;

    const voices = synth.getVoices();
    const koreanVoice = voices.find(v => v.lang.includes("KR") || v.lang.includes("kr"));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    utterance.onstart = () => {
      isPlayingAudio = true;
      btnPlayAudio.textContent = "⏸";
      audioIcon.textContent = "🎙️";
      audioStatus.textContent = "작가 필체 가이드북을 음악과 함께 읽어드리고 있습니다...";
      playAmbientSound(activeBookData.style);
    };

    utterance.onend = () => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "낭독이 끝났습니다.";
      stopAmbientSound();
    };

    utterance.onerror = () => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "음성 재생 중 지연이 감지되었습니다.";
      stopAmbientSound();
    };

    synth.speak(utterance);
  }

  // ASMR 공간 오디오 재생기
  function playAmbientSound(style) {
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio = null;
    }

    let soundUrl = "";
    if (style === "haruki") {
      // 카페 소음 / 재즈 바 분위기
      soundUrl = "https://www.soundjay.com/misc/sounds/sounds-cafe-ambience-1.mp3";
    } else if (style === "hesse") {
      // 서정적 숲바람/자연
      soundUrl = "https://www.soundjay.com/nature/sounds/wind-blowing-01.mp3";
    } else {
      // 빗소리 (김영하 스타일)
      soundUrl = "https://www.soundjay.com/nature/sounds/rain-07.mp3";
    }

    try {
      ambientAudio = new Audio(soundUrl);
      ambientAudio.loop = true;
      ambientAudio.volume = 0.12; // 작고 아늑한 배경 볼륨
      ambientAudio.play().catch(e => {
        console.warn("배경 오디오 자동 재생 차단됨:", e);
      });
    } catch (err) {
      console.warn("오디오 객체 로드 실패:", err);
    }
  }

  function stopAmbientSound() {
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio = null;
    }
  }

  function stopAudio() {
    if (synth.speaking) {
      synth.cancel();
    }
    isPlayingAudio = false;
    btnPlayAudio.textContent = "▶";
    audioIcon.textContent = "🔊";
    audioStatus.textContent = "낭독이 일시 정지되었습니다.";
    stopAmbientSound();
  }

  btnPlayAudio.addEventListener("click", () => {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      isPlayingAudio = true;
      playCurrentPageAudio();
    }
  });

  btnStopAudio.addEventListener("click", stopAudio);

  // 14. 복귀 및 리셋 기능
  function resetToHome() {
    stopAudio();
    activeBookData = null;
    searchResultData = null;
    currentPageIndex = 0;
    totalPages = 0;

    bookWrapper.style.display = "none";
    bookshelfWrapper.style.display = "none";
    creationCard.style.display = "block";
    bgBlur.style.backgroundImage = "none";

    creationForm.reset();
    optionsAccordion.classList.remove("open");
    accordionIcon.textContent = "▼";
  }

  btnBackToForm.addEventListener("click", () => {
    stopAudio();
    if (searchResultData && searchResultData.splitType === "SINGLE") {
      resetToHome();
    } else {
      bookWrapper.style.display = "none";
      bookshelfWrapper.style.display = "flex";
    }
  });

  btnBackToFormFromShelf.addEventListener("click", resetToHome);
  btnHome.addEventListener("click", resetToHome);

  // 15. 에러 알림 표시 및 닫기 처리 모듈 (API 한도, 네트워크 대응)
  function showError(title, message, icon = "⚠️") {
    const errorModal = document.getElementById("errorModal");
    const errorTitle = document.getElementById("errorTitle");
    const errorMessage = document.getElementById("errorMessage");
    const errorIconElement = errorModal.querySelector(".error-icon");
    
    if (errorIconElement) {
      errorIconElement.textContent = icon;
    }
    
    errorTitle.textContent = title;
    errorMessage.innerHTML = message;
    errorModal.style.display = "flex";
  }

  // 모달 닫기
  btnCloseModal.addEventListener("click", () => {
    errorModal.style.display = "none";
  });

  // 15-2. Leaflet.js 실시간 지도 초기화 및 캐시 관리 모듈 (선택지 A)
  window.activeMaps = window.activeMaps || {};

  function initLeafletMap(day, timeline, destination) {
    const mapId = `leaflet-map-day-${day}`;
    const container = document.getElementById(mapId);
    if (!container || window.activeMaps[mapId]) {
      if (window.activeMaps[mapId]) {
        window.activeMaps[mapId].invalidateSize();
      }
      return;
    }

    const points = timeline
      .filter(item => item.lat && item.lng)
      .map(item => [parseFloat(item.lat), parseFloat(item.lng)]);

    if (points.length === 0) {
      points.push([35.6895, 139.6917]); // 폴백: 도쿄
    }

    const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    const map = L.map(mapId, {
      center: [avgLat, avgLng],
      zoom: points.length > 1 ? 12 : 14,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(map);

    const latLngs = [];
    timeline.forEach((item, index) => {
      if (item.lat && item.lng) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        latLngs.push([lat, lng]);

        const numberIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div class="marker-number">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([lat, lng], { icon: numberIcon })
          .addTo(map)
          .bindPopup(`<b>Day ${day} - ${index + 1}코스</b><br><b>${item.place}</b><br>${item.time}`);
      }
    });

    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#D6A28C',
        weight: 3,
        dashArray: '5, 8',
        opacity: 0.9
      }).addTo(map);

      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    window.activeMaps[mapId] = map;
  }

  // 3D 전자책 내부의 탭 전환 및 지도 다운로드 위임 리스너
  ebook.addEventListener("click", (e) => {
    // 엽서 지도 이미지 개별 다운로드 처리
    const downloadBtn = e.target.closest(".postcard-download-btn");
    if (downloadBtn) {
      e.stopPropagation();
      const url = downloadBtn.getAttribute("data-url");
      const filename = downloadBtn.getAttribute("data-filename");
      downloadPostcardImage(url, filename);
      return;
    }

    const tabBtn = e.target.closest(".map-tab-btn");
    if (!tabBtn) return;

    const panel = tabBtn.closest(".map-panel-container");
    if (!panel) return;

    panel.querySelectorAll(".map-tab-btn").forEach(btn => btn.classList.remove("active"));
    panel.querySelectorAll(".map-tab-content").forEach(content => {
      content.style.display = "none";
      content.classList.remove("active-tab");
    });

    tabBtn.classList.add("active");
    const targetClass = tabBtn.getAttribute("data-target");
    const targetContent = panel.querySelector(`.${targetClass}`);
    if (targetContent) {
      targetContent.style.display = "block";
      targetContent.classList.add("active-tab");

      if (targetClass.startsWith("interactive-")) {
        const day = parseInt(tabBtn.getAttribute("data-day"), 10);
        if (activeBookData && activeBookData.itinerary) {
          const dayPlan = activeBookData.itinerary.find(d => d.day === day);
          if (dayPlan) {
            setTimeout(() => {
              initLeafletMap(day, dayPlan.timeline, activeBookData.destination);
            }, 50);
          }
        }
      }
    }
  });

  // 14-3. AI 엽서 지도 다운로드 구현 (CORS 대응 Blob 처리)
  async function downloadPostcardImage(url, filename) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      // CORS 문제 발생 시 폴백: 새 탭에서 열어 우클릭 저장 유도
      window.open(url, '_blank');
    }
  }

  // 15-3. AI 여행 사서 챗봇 제어 모듈
  function openChatbot() {
    if (!activeBookData) return;
    
    // 이전 대화 기록 상태 리셋
    chatbotMessages.innerHTML = "";
    chatbotHistory = [];
    
    // 도서 정보 가져오기
    const dest = activeBookData.destination;
    
    // 웰컴 메시지 작성
    appendChatBubble("librarian", `안녕하세요! 📖 <b>'${dest}'</b> 서재에 오신 것을 환영합니다. 저는 이 서재를 지키는 AI 여행 사서입니다.<br><br>책의 내용이나 '${dest}' 현지 교통, 숨겨진 맛집, 역사적 상식 등 궁금한 점이 있으시다면 편하게 저에게 물어보세요!`);
    
    // 드로어 열기
    chatbotDrawer.classList.add("open");
    
    // 캐비닛 드로어가 열려 있다면 닫기
    cabinetDrawer.classList.remove("open");
  }

  function closeChatbot() {
    chatbotDrawer.classList.remove("open");
  }

  function appendChatBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = text;
    chatbotMessages.appendChild(bubble);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return bubble;
  }

  async function handleSendChatMessage() {
    const question = chatbotInput.value.trim();
    if (!question || !activeBookData) return;

    // 인풋 비우기
    chatbotInput.value = "";
    
    // 사용자 버블 추가
    appendChatBubble("user", question);
    
    // 타이핑 인디케이터 버블 추가
    const indicator = appendChatBubble("librarian", `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `);
    
    try {
      // 작가 스타일 추출
      const style = activeBookData.style || "cherry";
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: activeBookData.destination,
          style: style,
          question: question,
          chat_history: chatbotHistory
        })
      });
      
      if (!response.ok) {
        throw new Error("서버와의 연결이 올바르지 않습니다.");
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.message);
      }
      
      // 타이핑 인디케이터 제거
      indicator.remove();
      
      // 사서 답변 버블 추가
      const answer = data.answer.replace(/\n/g, "<br>");
      appendChatBubble("librarian", answer);
      
      // 대화 기록 업데이트
      chatbotHistory.push({ role: "user", text: question });
      chatbotHistory.push({ role: "model", text: data.answer });
      
    } catch (err) {
      indicator.remove();
      appendChatBubble("system", `⚠️ 대화 오류: ${err.message || "사서와의 연결에 실패했습니다."}`);
    }
  }

  // 챗봇 드로어 버튼 이벤트 바인딩
  btnOpenChatbot.addEventListener("click", openChatbot);
  btnCloseChatbot.addEventListener("click", closeChatbot);
  btnSendChatMessage.addEventListener("click", handleSendChatMessage);
  
  chatbotInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendChatMessage();
    }
  });

  // 15-4. 공유 링크 유입 시 캐시가 없으면 즉시 백엔드에서 책 생성 실행
  async function generateSharedBook(destination, style, duration, themes) {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination,
          parent_destination: destination,
          style: style,
          duration: duration,
          themes: themes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP 상세 생성 에러: ${response.status}`);
      }

      const bookData = await response.json();
      if (bookData.error) {
        throw new Error(bookData.message);
      }

      activeBookData = bookData;
      
      const coverPrompt = bookData.coverImagePrompt || `${bookData.destination} cozy flat vector travel poster illustration, minimal line art style, warm pastel color palette, aesthetic composition, highly detailed`;
      const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=1024&height=768&nologo=true`;
      
      const img = new Image();
      img.src = coverImageUrl;
      
      const timeoutId = setTimeout(() => {
        proceed();
      }, 8000);
      
      img.onload = img.onerror = () => {
        clearTimeout(timeoutId);
        proceed();
      };
      
      function proceed() {
        stopLoadingMessages();
        loadingContainer.style.display = "none";
        saveToCabinet(bookData, style, duration);
        buildEbook(bookData);
      }

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      creationCard.style.display = "block";
      showError("공유 도서 로드 실패", `공유된 여행 일정을 불러오는 데 실패했습니다.<br><br><span style="font-size:0.8rem; color:var(--color-secondary);">${err.message}</span>`);
    }
  }

  // ==========================================================================
  // URL 데이터 압축 및 복원 헬퍼 유틸리티 (서버리스 0초 공유 실현)
  // ==========================================================================
  
  // JSON -> Gzip 압축 -> URL-Safe Base64 인코딩
  async function compressBookData(bookData) {
    try {
      const jsonString = JSON.stringify(bookData);
      const byteToCompress = new TextEncoder().encode(jsonString);
      const stream = new Response(byteToCompress).body.pipeThrough(new CompressionStream("deflate"));
      const compressedBlob = await new Response(stream).blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64UrlSafe = reader.result.split(',')[1]
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          resolve(base64UrlSafe);
        };
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });
    } catch (e) {
      console.warn("Compression Stream not supported or failed. Fallback to basic Base64 encoding.", e);
      const jsonString = JSON.stringify(bookData);
      return btoa(unescape(encodeURIComponent(jsonString)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
  }

  // URL-Safe Base64 -> Gzip 압축 해제 -> JSON 파싱
  async function decompressBookData(base64UrlSafe) {
    try {
      let base64 = base64UrlSafe.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const compressedBlob = new Blob([byteArray]);
      
      const stream = compressedBlob.stream().pipeThrough(new DecompressionStream("deflate"));
      const decompressedBuffer = await new Response(stream).arrayBuffer();
      const jsonString = new TextDecoder().decode(decompressedBuffer);
      return JSON.parse(jsonString);
    } catch (e) {
      console.warn("Decompression Stream failed. Fallback to decoding basic Base64.", e);
      try {
        let base64 = base64UrlSafe.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const jsonString = decodeURIComponent(escape(atob(base64)));
        return JSON.parse(jsonString);
      } catch (fallbackErr) {
        throw new Error("도서 공유 데이터 해제 실패: " + fallbackErr.message);
      }
    }
  }

  // 16. 공유 링크 유입 처리 모듈 (load_share 대응 및 book_data 해시 압축 해제 처리)
  async function checkSharedLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const loadShare = urlParams.get("load_share");
    const bookDataHash = window.location.hash.substring(1); // #을 뺀 해시 압축 데이터 가져오기
    const dest = urlParams.get("dest");
    const title = urlParams.get("title");
    
    if (loadShare === "true") {
      // URL 지저분한 파라미터 및 해시 클린업 (뒤로가기 시 복원 방지 및 주소창 정리)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      // UI 로딩 상태로 즉시 돌입
      creationCard.style.display = "none";
      bookshelfWrapper.style.display = "none";
      loadingContainer.style.display = "flex";
      loadingMessage.textContent = "공유받은 도서를 서재에서 꺼내는 중... 📖";

      // 1순위: 해시(#)로 압축된 book_data가 실려온 경우 ➡️ 0초 만에 압축 해제 후 다이렉트 뷰 (서버리스 최적화)
      if (bookDataHash) {
        try {
          const decompressedBook = await decompressBookData(bookDataHash);
          activeBookData = decompressedBook;
          
          // 내 보관함에도 자동으로 끼워 넣어줌
          saveToCabinet(decompressedBook, decompressedBook.style || "cherry", decompressedBook.duration || "당일치기");
          
          setTimeout(() => {
            loadingContainer.style.display = "none";
            buildEbook(decompressedBook);
          }, 600);
          return;
        } catch (err) {
          console.error("Failed to restore shared book from compressed URL hash parameter. Fallback to regeneration:", err);
        }
      }

      // 2순위 폴백: 압축 데이터가 유실되었거나 구버전 공유 링크인 경우 ➡️ 캐시 룩업 또는 백엔드 재생성 호출
      if (dest) {
        const storageKey = "my_travel_library";
        const library = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const foundBook = library.find(b => b.destination === dest && b.title === title);
        
        if (foundBook) {
          activeBookData = foundBook;
          loadingContainer.style.display = "none";
          buildEbook(foundBook);
          return;
        }

        const style = urlParams.get("style") || "cherry";
        const duration = urlParams.get("duration") || "당일치기";
        const themesStr = urlParams.get("themes") || "";
        const themes = themesStr ? themesStr.split(",") : [];

        startLoadingMessages(dest, "generate");
        generateSharedBook(dest, style, duration, themes);
      } else {
        loadingContainer.style.display = "none";
        creationCard.style.display = "block";
        showError("도서 정보 부족", "공유받은 도서의 키워드 정보가 올바르지 않습니다.");
      }
    }
  }

  // 페이지 기동 시 즉각 공유 여부 확인
  checkSharedLink();
});
