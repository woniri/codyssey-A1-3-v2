/* ==========================================================================
   Travel e-Book Platform Javascript (API Integration & UI Interaction)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // DOM 요소 선택
  const btnToggleOptions = document.getElementById("btnToggleOptions");
  const optionsAccordion = document.getElementById("optionsAccordion");
  const accordionIcon = document.getElementById("accordionIcon");
  const creationForm = document.getElementById("creationForm");
  const creationCard = document.getElementById("creationCard");
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

  const errorModal = document.getElementById("errorModal");
  const errorTitle = document.getElementById("errorTitle");
  const errorMessage = document.getElementById("errorMessage");
  const btnCloseModal = document.getElementById("btnCloseModal");

  const btnHome = document.getElementById("btnHome");
  const btnBackToForm = document.getElementById("btnBackToForm");

  // 상태 변수
  let bookData = null;       // API로부터 받아온 책 데이터
  let currentPageIndex = 0;  // 현재 뷰어의 페이지 인덱스
  let totalPages = 0;        // 전체 페이지 수
  let loadingInterval = null;// 로딩 메시지 변환용 타이머
  let synth = window.speechSynthesis;
  let utterance = null;      // 현재 음성 객체
  let isPlayingAudio = false;

  // 1. 아코디언 상세 설정 제어
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

  // 2. 폼 제출 및 가이드북 생성 처리
  creationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const destination = document.getElementById("destination").value.trim();
    const style = document.querySelector('input[name="style"]:checked').value;
    const duration = document.querySelector('input[name="duration"]:checked').value;
    
    // 테마 다중 선택 값 가져오기
    const checkedThemes = [];
    document.querySelectorAll('input[name="themes"]:checked').forEach((checkbox) => {
      checkedThemes.push(checkbox.value);
    });

    if (!destination) {
      showError("입력 요류", "어디로 여행할지 도시 또는 관광지 이름을 입력해 주세요.");
      return;
    }

    // 폼 카드 숨기고 로딩 오버레이 노출
    creationCard.style.display = "none";
    loadingContainer.style.display = "flex";
    startLoadingMessages(destination);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: destination,
          style: style,
          duration: duration,
          themes: checkedThemes
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP 통신 실패: 상태 코드 ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message);
      }

      // 데이터 검증 및 저장
      bookData = data;
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      
      // 전자책 빌드 및 노출
      buildBook(bookData);
      
    } catch (err) {
      stopLoadingMessages();
      loadingContainer.style.display = "none";
      creationCard.style.display = "block";
      showError("도서 제작 실패", err.message || "여행 책자를 만드는 도중 알 수 없는 에러가 발생했습니다. 다시 시도해 주세요.");
    }
  });

  // 3. 감성적인 로딩 상태 메시지 자동 전환
  function startLoadingMessages(dest) {
    const messages = [
      `"${dest}"(으)로 떠날 짐을 꾸리는 중... 🧳`,
      `현지 정보 수집 및 실시간 팩트 확인 중... 🔍`,
      `페이퍼 아트 스타일 표지 및 삽화를 그리는 중... 🎨`,
      `감성적인 해설 스토리를 다듬는 중... 📝`,
      `내레이터의 마이크 음성 상태를 확인하는 중... 🎤`,
      `마지막 책장 제본 및 바인딩 작업 중... 📖`
    ];
    let index = 0;
    loadingMessage.textContent = messages[0];
    
    loadingInterval = setInterval(() => {
      index = (index + 1) % messages.length;
      loadingMessage.textContent = messages[index];
    }, 2500);
  }

  function stopLoadingMessages() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }
  }

  // 4. 에러 알림 모달 출력
  function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorModal.style.display = "flex";
  }

  btnCloseModal.addEventListener("click", () => {
    errorModal.style.display = "none";
  });

  // 5. 전자책 빌딩 로직 (DOM 동적 생성)
  function buildBook(data) {
    ebook.innerHTML = ""; // 기존 내용 초기화
    currentPageIndex = 0;

    // 뒷배경 이미지 변경 (대표 이미지 얹어서 블러 처리)
    const coverImage = data.pages[0]?.imageUrl || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e";
    bgBlur.style.backgroundImage = `url('${coverImage}')`;

    // 5-1. 표지 (Cover) 생성
    const coverPage = document.createElement("div");
    coverPage.className = "page page-left book-cover active-page";
    coverPage.innerHTML = `
      <div class="visual-panel">
        <img class="visual-image" src="${coverImage}" alt="${data.title}">
        <div class="visual-title">${data.title}</div>
        <div class="visual-credits">${data.subtitle || '나만의 가이드북'}</div>
      </div>
    `;
    ebook.appendChild(coverPage);

    // 5-2. 책 내부 본문 페이지 생성 (페이지당 Left-Right 쌍)
    // Left: 이미지, Right: 텍스트
    data.pages.forEach((p, idx) => {
      // 본문 텍스트 페이지 생성
      const textPage = document.createElement("div");
      textPage.className = "page page-right book-inside";
      
      textPage.innerHTML = `
        <div class="page-content story-panel">
          <div class="story-header">
            <div class="story-chapter">${p.chapterTitle || `제 ${idx + 1}장`}</div>
            <div class="story-title">${p.chapterTitle ? p.chapterTitle.split('.')[1] || p.chapterTitle : data.title}</div>
          </div>
          <div class="story-body">${p.storyText}</div>
          <div class="story-footer">
            <span>AI 여행 책방</span>
            <span>Page ${idx + 1}</span>
          </div>
        </div>
      `;
      ebook.appendChild(textPage);

      // 다음 페이지 비주얼(삽화) 페이지 생성 (다음 쌍을 위한 Left)
      const visualPage = document.createElement("div");
      visualPage.className = "page page-left book-inside";
      visualPage.innerHTML = `
        <div class="visual-panel">
          <img class="visual-image" src="${p.imageUrl || coverImage}" alt="${p.chapterTitle}">
          <div class="visual-title">${p.chapterTitle}</div>
          <div class="visual-credits">Photo matching via Unsplash</div>
        </div>
      `;
      ebook.appendChild(visualPage);
    });

    // 5-3. 일정 페이지 (Itinerary) 생성
    data.itinerary.forEach((dayPlan, idx) => {
      const itiPage = document.createElement("div");
      itiPage.className = "page page-right book-inside";

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

      itiPage.innerHTML = `
        <div class="page-content itinerary-panel">
          <h3>📅 추천 일정: Day ${dayPlan.day}</h3>
          <div class="timeline">
            ${timelineHtml}
          </div>
        </div>
      `;
      ebook.appendChild(itiPage);
    });

    // 전체 실제 생성된 DOM 페이지 목록 계산
    const allPages = ebook.querySelectorAll(".page");
    totalPages = allPages.length;
    
    // UI 세팅 및 노출
    bookWrapper.style.display = "flex";
    updateViewer();
  }

  // 6. 뷰어 조작 및 모바일/PC 레이아웃 분기 제어
  function updateViewer() {
    const isMobile = window.innerWidth <= 768;
    const pages = ebook.querySelectorAll(".page");

    if (isMobile) {
      // 모바일 모드: 활성화된 1개 카드만 block 처리
      pages.forEach((page, idx) => {
        if (idx === currentPageIndex) {
          page.classList.add("active-page");
        } else {
          page.classList.remove("active-page");
        }
      });
      pageIndicator.textContent = `Page ${currentPageIndex + 1} / ${totalPages}`;
    } else {
      // PC/태블릿 모드: 3D 책 넘김 효과 (이전/다음 쌍으로 조율)
      // PC는 짝수/홀수 두 개의 페이지가 동시에 보임
      pages.forEach((page, idx) => {
        page.classList.add("active-page");
        
        // Z-Index 및 3D 겹침 순서 정렬
        if (idx < currentPageIndex) {
          // 이미 넘어간 페이지들 (왼쪽으로 뒤집어 포갬)
          if (idx % 2 === 0) {
            // Left page
            page.style.transform = "rotateY(-180deg)";
            page.style.zIndex = idx;
          } else {
            // Right page
            page.style.transform = "rotateY(-180deg)";
            page.style.zIndex = idx;
          }
        } else if (idx === currentPageIndex || idx === currentPageIndex + 1) {
          // 현재 활성화되어 펼쳐져 있는 양면 페이지
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = 100;
        } else {
          // 아직 펼쳐지지 않은 다음 페이지들 (오른쪽에 대기)
          page.style.transform = "rotateY(0deg)";
          page.style.zIndex = totalPages - idx;
        }
      });
      
      const currentSpread = Math.floor(currentPageIndex / 2) + 1;
      const totalSpreads = Math.ceil(totalPages / 2);
      pageIndicator.textContent = `Spread ${currentSpread} / ${totalSpreads}`;
    }

    // 이전/다음 버튼 활성화 검사
    btnPrevPage.disabled = currentPageIndex === 0;
    
    if (isMobile) {
      btnNextPage.disabled = currentPageIndex === totalPages - 1;
    } else {
      btnNextPage.disabled = currentPageIndex >= totalPages - 2;
    }

    // 새로운 페이지 낭독 자동 동기화
    if (isPlayingAudio) {
      playCurrentPageAudio();
    }
  }

  // 버튼 클릭 리스너
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

  // 창 크기 변경에 따른 반응형 변환 대응
  window.addEventListener("resize", () => {
    if (bookData) {
      updateViewer();
    }
  });

  // 7. TTS 음성 낭독 제어 (Web Speech API)
  function playCurrentPageAudio() {
    stopAudio();

    if (!bookData) return;

    // 현재 표시되고 있는 텍스트 페이지 추출
    let textToSpeak = "";
    
    // 모바일/PC 모드에 맞는 페이지 본문 텍스트 수집
    const pages = ebook.querySelectorAll(".page");
    
    if (window.innerWidth <= 768) {
      // 모바일은 활성 페이지에서 오디오 스크립트 탐색
      const activePage = pages[currentPageIndex];
      const storyBody = activePage.querySelector(".story-body");
      const itiPanel = activePage.querySelector(".itinerary-panel");
      
      if (storyBody) {
        textToSpeak = storyBody.textContent;
      } else if (itiPanel) {
        textToSpeak = itiPanel.textContent;
      } else {
        textToSpeak = bookData.title + ". " + (bookData.subtitle || "");
      }
    } else {
      // PC 모드는 펼쳐진 두 페이지 중 오른쪽에 있는 텍스트 영역에서 가져옴
      const rightPageIndex = currentPageIndex + 1;
      const rightPage = pages[rightPageIndex];
      
      if (rightPage) {
        const storyBody = rightPage.querySelector(".story-body");
        const itiPanel = rightPage.querySelector(".itinerary-panel");
        
        if (storyBody) {
          textToSpeak = storyBody.textContent;
        } else if (itiPanel) {
          textToSpeak = itiPanel.textContent;
        }
      } else {
        // 첫 커버인 경우
        textToSpeak = bookData.title + ". " + (bookData.subtitle || "");
      }
    }

    if (!textToSpeak) {
      audioStatus.textContent = "낭독할 텍스트가 없습니다.";
      return;
    }

    // 낭독 텍스트의 특수기호나 이모지 정제
    textToSpeak = textToSpeak.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

    // Web Speech Utterance 객체 생성
    utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR";
    utterance.rate = 1.0; // 속도
    utterance.pitch = 1.0; // 음높이

    // 한국어 목소리 설정 (가장 자연스러운 시스템 보이스 매칭)
    const voices = synth.getVoices();
    const koreanVoice = voices.find(v => v.lang.includes("KR") || v.lang.includes("kr"));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    // 이벤트 리스너
    utterance.onstart = () => {
      isPlayingAudio = true;
      btnPlayAudio.textContent = "⏸";
      audioIcon.textContent = "🍒";
      audioStatus.textContent = "가이드북을 읽어드리고 있습니다...";
    };

    utterance.onend = () => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "낭독이 끝났습니다.";
    };

    utterance.onerror = (e) => {
      isPlayingAudio = false;
      btnPlayAudio.textContent = "▶";
      audioIcon.textContent = "🔊";
      audioStatus.textContent = "음성 재생 중 오류가 발생했습니다.";
      console.error("SpeechSynthesisUtterance Error:", e);
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

  // 오디오 제어 버튼 이벤트 리스너
  btnPlayAudio.addEventListener("click", () => {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      isPlayingAudio = true;
      playCurrentPageAudio();
    }
  });

  btnStopAudio.addEventListener("click", () => {
    stopAudio();
  });

  // 브라우저 보이스 로드 이벤트 (일부 모바일 브라우저는 비동기로 보이스를 로드함)
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {};
  }

  // 8. 페이지 복귀 및 리셋 로직
  function resetToForm() {
    stopAudio();
    bookData = null;
    currentPageIndex = 0;
    totalPages = 0;
    
    // UI 전환
    bookWrapper.style.display = "none";
    creationCard.style.display = "block";
    bgBlur.style.backgroundImage = "none";
    
    // 폼 초기화
    creationForm.reset();
    optionsAccordion.classList.remove("open");
    accordionIcon.textContent = "▼";
  }

  btnBackToForm.addEventListener("click", resetToForm);
  btnHome.addEventListener("click", resetToForm);
});
