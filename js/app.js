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

  // 책꽂이 로테이션 상태
  let shelfStartIndex = 0;
  const itemsPerShelf = 4;          // 한 선반에 꽂을 기본 책 개수 (3~5개 가변 범위 내 4권 기본값 권장)

  // 3. 캐비닛 슬라이드 Drawer 제어
  btnOpenCabinet.addEventListener("click", () => {
    loadCabinetList();
    cabinetDrawer.classList.add("open");
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
      showError("검색 에러", err.message || "서재를 구성하는 도중 문제가 생겼습니다.");
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
      bookCard.className = "shelf-book";
      
      // 책꽂이 책 표지 일러스트 썸네일 입히기 (Pollinations AI 무광 일러스트 연동)
      const thumbPrompt = book.coverPrompt || `${book.theme} paper cut diorama`;
      const thumbUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(thumbPrompt)}?width=130&height=190&nologo=true`;
      
      bookCard.style.backgroundImage = `url('${thumbUrl}')`;

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
      stopLoadingMessages();
      loadingContainer.style.display = "none";

      saveToCabinet(bookData, style, duration);
      buildEbook(bookData);

    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      if (searchResultData && searchResultData.splitType === "SINGLE") {
        creationCard.style.display = "block";
      } else {
        bookshelfWrapper.style.display = "flex";
      }
      showError("도서 제작 에러", err.message || "책 스토리를 생성하는 데 실패했습니다.");
    }
  }

  // 8. 3D 전자책 뷰어 빌더 (양면 와이드 전면 표지 구현)
  function buildEbook(data) {
    ebook.innerHTML = "";
    currentPageIndex = 0;

    const coverPrompt = data.coverImagePrompt || `${data.destination} water color paper diorama travel poster`;
    const coverImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=1024&height=768&nologo=true`;
    
    bgBlur.style.backgroundImage = `url('${coverImageUrl}')`;

    const tempPages = [];

    // ⚠️ 양면 전면 표지 (Cover Spread) 구현 (1p Left + 2p Right 슬라이싱 결합) ⚠️
    // 글자 없는 수채화 디오라마 이미지를 책을 펴자마자 양면 와이드로 꽉 차게 노출시킵니다.
    tempPages.push({
      type: "cover cover-half-left",
      html: `
        <div class="visual-panel" style="padding: 0; background-image: url('${coverImageUrl}');">
        </div>
      `
    });

    tempPages.push({
      type: "cover cover-half-right",
      html: `
        <div class="visual-panel" style="padding: 0; background-image: url('${coverImageUrl}');">
        </div>
      `
    });

    // [페이지 3 ~ n] 본문 페이지 쌍 (Left: 이미지, Right: 텍스트)
    data.pages.forEach((p, idx) => {
      // 본문 텍스트 (오른쪽 면) - 제1장 텍스트 영역 상단에 책 제목과 소제목 노출
      const titleHeaderHtml = idx === 0 
        ? `<div style="font-family: var(--font-serif); font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.5px; border-bottom: 1px dashed rgba(62,64,63,0.15); padding-bottom: 0.25rem;">
            ${data.title}
           </div>`
        : "";

      tempPages.push({
        type: "visual",
        html: `
          <div class="visual-panel">
            <img class="visual-image" src="${p.imageUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828'}" alt="${p.chapterTitle}">
            <div class="visual-title">${p.chapterTitle}</div>
            <div class="visual-credits">Photo matching via Unsplash</div>
          </div>
        `
      });

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
              <span>북어 트립 🍒</span>
              <span>Page ${idx + 1}</span>
            </div>
          </div>
        `
      });
    });

    // [일정 페이지]
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

      // 좌측 이미지면 생성 (일정의 풍경 느낌을 대변할 실사 Unsplash 기본 사진 배치)
      tempPages.push({
        type: "visual",
        html: `
          <div class="visual-panel">
            <img class="visual-image" src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80" alt="Travel Timeline">
            <div class="visual-title">추천 일정: Day ${dayPlan.day}</div>
            <div class="visual-credits">Itinerary Road Map</div>
          </div>
        `
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

    // 짝수 페이지 맞춤 보정
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
      `"${dest}" 가이드북을 만드는 중... ✍️`,
      `역사적 비하인드 스토리 팩트 검증 중... 🏛️`,
      `수채화 디오라마 화풍의 양면 표지를 그리는 중... 🎨`,
      `내레이터 Cherry가 낭독 준비를 하고 있습니다... 🍒`,
      `책장 마감 및 배치가 완료 중입니다... 📚`
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
      <p>북어 트립 (Book어 Trip) 🍒 - AI 기반 나만의 여행 책방</p>
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
});
