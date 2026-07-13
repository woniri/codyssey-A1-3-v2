/* ==========================================================================
   Book어 Trip (북어 트립) Javascript (Enhancement Core Logic)
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
  let currentSearchQuery = ""; // 원본 검색어 (예: "항저우")
  let searchResultData = null;  // 1차 search 결과 (책 목록)
  let activeBookData = null;    // 2차 상세 스토리 생성 결과 (본문 & 일정)
  let currentPageIndex = 0;    // 뷰어 페이지 인덱스
  let totalPages = 0;          // 전체 페이지 개수
  let loadingInterval = null;  // 로딩 멘트 순환용 타이머
  let synth = window.speechSynthesis;
  let utterance = null;        // TTS 인스턴스
  let isPlayingAudio = false;

  // 3. 캐비닛 슬라이드 Drawer 제어
  btnOpenCabinet.addEventListener("click", () => {
    loadCabinetList();
    cabinetDrawer.classList.add("open");
  });

  btnCloseCabinet.addEventListener("click", () => {
    cabinetDrawer.classList.remove("open");
  });

  // 4. 아코디언 설정 열기/닫기
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

  // 5. 1차 여행지 검색 (서재 분할 판정 API 호출)
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

    // 폼 감추고 로딩 활성화
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

      // 스마트 서재 책꽂이 화면 그리기
      renderBookShelf(data, style, duration, checkedThemes);

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      creationCard.style.display = "block";
      showError("검색 에러", err.message || "서재를 구성하는 도중 문제가 생겼습니다.");
    }
  });

  // 6. 스마트 서재(Book Shelf UI) 렌더러
  function renderBookShelf(searchData, style, duration, themes) {
    booksGrid.innerHTML = "";
    bookshelfTitle.textContent = `📂 ${searchData.destination} 서재`;
    
    searchData.books.forEach((book) => {
      const bookCard = document.createElement("div");
      bookCard.className = "shelf-book";
      
      // 저채도 톤의 표지 등 가죽 컬러 랜덤 부여
      const coverColors = ["#8AA399", "#D6A28C", "#AEBCC4", "#798E85"];
      const randomColor = coverColors[Math.floor(Math.random() * coverColors.length)];
      bookCard.style.borderLeftColor = randomColor;

      bookCard.innerHTML = `
        <div class="shelf-book-title">${book.title}</div>
        <div class="shelf-book-badge">${searchData.splitType === "SERIES" ? "시리즈 도서" : "단독 도서"}</div>
      `;

      // 책 클릭 시 2차 본문 상세 생성 진입
      bookCard.addEventListener("click", () => {
        loadBookDetail(book, style, duration, themes);
      });

      booksGrid.appendChild(bookCard);
    });

    creationCard.style.display = "none";
    bookshelfWrapper.style.display = "flex";
  }

  // 7. 2차 상세 스토리 생성 API 호출
  async function loadBookDetail(book, style, duration, themes) {
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
      stopLoadingMessages();
      loadingContainer.style.display = "none";

      // 8. 로컬 스토리지에 도서 저장 (보관함용)
      saveToCabinet(bookData, style, duration);

      // 책 빌딩 및 표시
      buildEbook(bookData);

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      bookshelfWrapper.style.display = "flex";
      showError("도서 제작 에러", err.message || "책 스토리를 생성하는 데 실패했습니다.");
    }
  }

  // 8. 3D 전자책 뷰어 빌더 (2박 3일 누락 및 짝수 보정 해결)
  function buildEbook(data) {
    ebook.innerHTML = "";
    currentPageIndex = 0;

    // AI 이미지 생성 (Pollinations AI 사용 ➡️ Unsplash의 무작위 오차 제거)
    // 1페이지 대표 표지 이미지
    const firstPagePrompt = data.pages[0]?.imagePrompt || `${data.destination} paper diorama travel poster`;
    const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(firstPagePrompt)}?width=1024&height=768&nologo=true`;
    
    // 블러 배경 설정
    bgBlur.style.backgroundImage = `url('${coverImageUrl}')`;

    // 가변 렌더링용 임시 페이지 배열
    const tempPages = [];

    // [페이지 1] 표지 (Cover)
    tempPages.push({
      type: "cover",
      html: `
        <div class="visual-panel">
          <img class="visual-image" src="${coverImageUrl}" alt="${data.title}">
          <div class="visual-title">${data.title}</div>
          <div class="visual-credits">${data.subtitle || 'Book어 Trip'}</div>
        </div>
      `
    });

    // [페이지 2 ~ 2+n] 본문 페이지 쌍 (Left: 이미지, Right: 텍스트)
    data.pages.forEach((p, idx) => {
      const generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(p.imagePrompt)}?width=1024&height=768&nologo=true`;
      
      // 본문 텍스트 (오른쪽 면)
      tempPages.push({
        type: "story",
        audioText: p.audioText,
        html: `
          <div class="page-content story-panel">
            <div class="story-header">
              <div class="story-chapter">${p.chapterTitle || `제 ${idx + 1}장`}</div>
              <div class="story-title">${p.chapterTitle ? p.chapterTitle.split('.')[1] || p.chapterTitle : data.title}</div>
            </div>
            <div class="story-body">${p.storyText}</div>
            <div class="story-footer">
              <span>북어 트립 🍒</span>
              <span>Page ${idx + 1}</span>
            </div>
          </div>
        `
      });

      // 다음 본문을 위한 일러스트 (왼쪽 면)
      tempPages.push({
        type: "visual",
        html: `
          <div class="visual-panel">
            <img class="visual-image" src="${generatedImageUrl}" alt="${p.chapterTitle}">
            <div class="visual-title">${p.chapterTitle}</div>
            <div class="visual-credits">AI Generated Paper-cut Diorama</div>
          </div>
        `
      });
    });

    // [일정 페이지] 2박 3일, 3박 4일 일정 루프 전개 (누락 원천 차단)
    data.itinerary.forEach((dayPlan) => {
      let timelineHtml = "";
      dayPlan.timeline.forEach((item) => {
        timelineHtml += `
          <div class="timeline-item">
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-place">${item.place}</div>
            <div class="timeline-desc">${item.desc}</div>
          </div>
        `;
      });

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

    // ⚠️ 3D 양면 책 넘김 레이아웃 짝수 짝 맞춤 보정 ⚠️
    // 페이지 수가 홀수개이면, 마지막 면이 뒤표지 없이 열리게 되므로, 빈 책장(Back Cover)을 추가해 짝수로 맞춰줍니다.
    if (tempPages.length % 2 !== 0) {
      tempPages.push({
        type: "backcover",
        html: `
          <div class="page-content story-panel" style="background-color: var(--text-charcoal); color: #FFFFFF; justify-content: center; align-items: center; border-radius: 0 12px 12px 0;">
            <h4 style="font-family: var(--font-serif); font-size: 1.5rem; text-shadow: 0 2px 8px rgba(0,0,0,0.5);">📖 북어 트립</h4>
            <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">나만을 위한 감성 여행 도서관</p>
          </div>
        `
      });
    }

    // 최종 정리된 페이지 목록을 DOM에 삽입 및 Z-Index 정비
    tempPages.forEach((page, index) => {
      const pageDiv = document.createElement("div");
      
      // 홀수 인덱스는 오른쪽 면, 짝수 인덱스는 왼쪽 면 (0부터 시작하므로 짝수가 Left, 홀수가 Right)
      if (index % 2 === 0) {
        pageDiv.className = `page page-left ${page.type === "cover" ? "book-cover" : "book-inside"}`;
      } else {
        pageDiv.className = `page page-right ${page.type === "backcover" ? "book-cover" : "book-inside"}`;
      }

      // 낭독 텍스트 메타데이터 탑재
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

  // 9. 뷰어 화면 렌더링 업데이트 (반응형 모바일-PC 분기)
  function updateViewer() {
    const isMobile = window.innerWidth <= 768;
    const pages = ebook.querySelectorAll(".page");

    if (isMobile) {
      // 모바일: 단일 활성페이지만 노출
      pages.forEach((page, idx) => {
        if (idx === currentPageIndex) {
          page.classList.add("active-page");
        } else {
          page.classList.remove("active-page");
        }
      });
      pageIndicator.textContent = `Page ${currentPageIndex + 1} / ${totalPages}`;
    } else {
      // PC/태블릿: 3D 책장 뒤집기 Z-Index & Rotate 처리
      pages.forEach((page, idx) => {
        page.classList.add("active-page");
        
        if (idx < currentPageIndex) {
          // 이미 넘어간 왼쪽 페이지들
          page.style.transform = "rotateY(-180deg)";
          page.style.zIndex = idx;
        } else if (idx === currentPageIndex || idx === currentPageIndex + 1) {
          // 현재 펼쳐진 정면 양면 페이지
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = 100;
        } else {
          // 오른쪽 대기 페이지들
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = totalPages - idx;
        }
      });

      const currentSpread = Math.floor(currentPageIndex / 2) + 1;
      const totalSpreads = Math.ceil(totalPages / 2);
      pageIndicator.textContent = `Spread ${currentSpread} / ${totalSpreads}`;
    }

    // 조작 단추 활성화 제어
    btnPrevPage.disabled = currentPageIndex === 0;
    if (isMobile) {
      btnNextPage.disabled = currentPageIndex === totalPages - 1;
    } else {
      btnNextPage.disabled = currentPageIndex >= totalPages - 2;
    }

    // 페이지 변경 시 오디오 자동 동기화
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

  // 10. 로딩 단계별 메시지 제어
  function startLoadingMessages(dest, mode) {
    const searchMessages = [
      `"${dest}" 여행 경로를 분석하는 중... 🗺️`,
      `대규모 도시인지 랜드마크인지 조사 중... 🔍`,
      `여행 책꽂이에 알맞은 도서를 준비 중... 📖`,
      `서재 정리를 마무리하고 있습니다... 🧹`
    ];

    const generateMessages = [
      `"${dest}" 이야기를 엮어내는 중... ✍️`,
      `역사학자가 사실 관계를 최종 체크하고 있습니다... 🏛️`,
      `종이 공예 디오라마 화풍의 일러스트를 오려내는 중... 🎨`,
      `내레이터 Cherry가 낭독 대본을 살피는 중... 🍒`,
      `책장 제본 및 바인딩 완료 중... 📚`
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

  // 11. 로컬 스토리지 내 책 보관함 제어
  function saveToCabinet(bookData, style, duration) {
    try {
      const storageKey = "my_travel_library";
      let library = JSON.parse(localStorage.getItem(storageKey)) || [];
      
      // 이미 같은 책이 존재하면 지우고 최신화(중복 방지)
      library = library.filter(b => b.title !== bookData.title);

      const coverPrompt = bookData.pages[0]?.imagePrompt || `${bookData.destination} paper art`;
      const coverThumb = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=150&height=200&nologo=true`;

      // 보존할 도서 구조체
      const bookItem = {
        title: bookData.title,
        subtitle: bookData.subtitle,
        destination: bookData.destination,
        pages: bookData.pages,
        itinerary: bookData.itinerary,
        coverThumb: coverThumb,
        style: style,
        duration: duration,
        savedAt: new Date().toLocaleDateString()
      };

      library.unshift(bookItem); // 최신 생성 도서를 맨 위로
      localStorage.setItem(storageKey, JSON.stringify(library));
    } catch (e) {
      console.warn("로컬 스토리지 한도 초과 또는 사용 불가 상태:", e);
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
      `;

      card.addEventListener("click", () => {
        // 즉시 로딩 없이 로컬에서 불러오기
        activeBookData = book;
        cabinetDrawer.classList.remove("open");
        
        // UI 모드 전환
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
    const coverPrompt = data.pages[0]?.imagePrompt || `${data.destination} paper diorama`;
    const coverImg = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=800&height=600&nologo=true`;

    // 본문 페이지 변환
    let pagesHtml = "";
    data.pages.forEach((p, idx) => {
      const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(p.imagePrompt)}?width=800&height=600&nologo=true`;
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

    // 추천 일정 페이지 변환
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

    // 인쇄 및 감상용 단청색 HTML 서식 조립
    const fullHtmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${data.title} - 북어 트립 소장본</title>
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
      padding: 60px 40px;
      border-bottom: 2px dashed #8AA399;
      position: relative;
    }
    .cover-sheet img {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 30px;
      filter: sepia(10%);
    }
    .cover-sheet h1 {
      font-family: 'Maru Buri', serif;
      font-size: 2.2rem;
      margin: 0 0 10px 0;
    }
    .cover-sheet p {
      font-size: 1.1rem;
      color: #6A6E6C;
      margin: 0;
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
      <h1>${data.title}</h1>
      <p>${data.subtitle}</p>
    </div>
    ${pagesHtml}
    ${itineraryHtml}
    <footer>
      <p>북어 트립 (Book어 Trip) 🍒 - AI 기반 나만의 여행 책방</p>
    </footer>
  </div>
</body>
</html>
    `;

    // 가상 링크를 통한 다운로드 실행
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

  // 13. Web Speech TTS 음성 제어 (Cherry의 지적이고 다정한 어조 구현)
  function playCurrentPageAudio() {
    stopAudio();

    if (!activeBookData) return;

    let textToSpeak = "";
    const pages = ebook.querySelectorAll(".page");
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // 모바일 활성 페이지에서 데이터 스크립트 확보
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
      // PC: 펼쳐진 두 면 중 오른쪽 면(홀수 인덱스)의 텍스트 수급
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

    // 텍스트 기호 정제
    textToSpeak = textToSpeak.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

    utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR";
    utterance.rate = 1.0;
    utterance.pitch = 0.95; // 지적인 느낌을 위해 음높이를 미세하게 조율

    const voices = synth.getVoices();
    const koreanVoice = voices.find(v => v.lang.includes("KR") || v.lang.includes("kr"));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    utterance.onstart = () => {
      isPlayingAudio = true;
      btnPlayAudio.textContent = "⏸";
      audioIcon.textContent = "🍒";
      audioStatus.textContent = "가이드북을 상냥하게 읽어드리고 있습니다...";
    };

    utterance.onend = () => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "낭독이 끝났습니다.";
    };

    utterance.onerror = () => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "음성 재생 중 지연이 감지되었습니다.";
    };

    synth.speak(utterance);
  }

  function stopAudio() {
    if (synth.speaking) {
      synth.cancel();
    }
    isPlayingAudio = false;
    btnPlayAudio.textContent = "▶";
    audioIcon.textContent = "🔊";
    audioStatus.textContent = "낭독이 일시 정지되었습니다.";
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

    // UI 복귀
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
    // 상세 e-Book 보기에서 책꽂이 서재 화면으로 한 단계 복귀
    bookWrapper.style.display = "none";
    bookshelfWrapper.style.display = "flex";
  });

  btnBackToFormFromShelf.addEventListener("click", resetToHome);
  btnHome.addEventListener("click", resetToHome);
});
