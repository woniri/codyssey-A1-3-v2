from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import requests
from google import genai
from google.genai import types

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 오픈 그래프(Open Graph) 동적 공유 카드 렌더링용 엔드포인트
@app.get("/api/share", response_class=HTMLResponse)
async def share_page(title: str = "think-travel", subtitle: str = "문학 여행 가이드북", img: str = "", dest: str = ""):
    # 이미지 최적화 기본값
    if not img:
        img = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80"
        
    html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - 여행 책방</title>
  <meta name="description" content="{subtitle}">
  
  <!-- 오픈 그래프 (Open Graph) 동적 메타 태그 -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title} 📖">
  <meta property="og:description" content="{subtitle}">
  <meta property="og:image" content="{img}">
  <meta property="og:url" content="https://think-travel.vercel.app/api/share">
  
  <!-- 트위터 카드 -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title} 📖">
  <meta name="twitter:description" content="{subtitle}">
  <meta name="twitter:image" content="{img}">
  
  <!-- 메인 웹 서비스로 리다이렉트 (사용자 유입 시 자연스러운 전환) -->
  <script>
    const destParam = "{dest}";
    if (destParam) {{
      window.location.href = "/?load_share=true&dest=" + encodeURIComponent(destParam);
    }} else {{
      window.location.href = "/";
    }}
  </script>
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; padding: 50px;">
    <h2>{title}</h2>
    <p>{subtitle}</p>
    <p>나만의 감성 문학 여행 가이드북 제작소, 여행 책방으로 이동하고 있습니다...</p>
  </div>
</body>
</html>
"""
    return html_content

class SearchRequest(BaseModel):
    destination: str
    style: Optional[str] = "cherry"
    duration: Optional[str] = "당일치기"
    themes: Optional[List[str]] = []

class GenerateBookRequest(BaseModel):
    destination: str
    parent_destination: str
    style: Optional[str] = "cherry"
    duration: Optional[str] = "당일치기"
    themes: Optional[List[str]] = []

# API Key 정보 로드
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")

def get_gemini_client():
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Vercel Settings 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다. API 키를 등록하고 Redeploy 해주세요."
        )
    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GenAI Client 초기화 실패: {str(e)}"
        )

# 헬스체크용 GET 엔드포인트
@app.get("/api/generate")
async def health_check():
    return {
        "status": "healthy", 
        "service": "Book어 Trip API Backend",
        "api_key_configured": bool(GEMINI_API_KEY)
    }

# 1. 여행지 검색 및 서재 분할 판정 API (책꽂이 썸네일용 coverPrompt 필드 및 6~7개 후보군 구성)
@app.post("/api/search")
async def search_destination(req: SearchRequest):
    destination = req.destination.strip()
    if not destination:
        raise HTTPException(status_code=400, detail="여행지 이름을 입력해 주세요.")

    client = get_gemini_client()

    prompt = f"""
여행 분석가로서, 입력된 여행지/명소인 '{destination}'의 규모를 분석하여 서재 분할 타입(splitType)을 판정하고 도서 목록을 작성해 주세요.

[중요 판정 기준]
1. 입력어가 '국가', '대륙', 혹은 광역 행정 구역(예: 대한민국, 일본, 중국, 미국, 유럽, 경상도, 전라도 등 넓은 지역)인 경우에만 'SERIES'로 판정합니다.
   - 이 경우, 해당 광역 구역 내에서 여행하기 좋은 하위 도시나 주요 대형 명소들을 **총 6~7권의 넉넉한 도서 후보 리스트**로 설계해 주세요.
   - 예: '대한민국' 입력 시 ➡️ '서울: 전통과 현대의 심장', '부산: 바다와 빛의 도시', '제주도: 화산섬의 자연과 신화', '경주: 천년 신라의 고도', '전주: 맛과 멋의 한옥마을', '강릉: 커피와 푸른 동해 바다' 등 총 6~7권의 목록 제공.
2. 입력어가 일반적인 '도시 단위'(예: 서울, 대구, 부산, 도쿄, 뉴욕, 경주, 항저우 등)이거나 '특정 단일 명소'(예: 불국사, 에펠탑 등)인 경우에는 무조건 'SINGLE'로 판정합니다.
   - 이 경우, 해당 대상만을 깊이 있게 다루는 단일 가이드북 1권만 목록에 넣어주세요.
   - 예: '서울' 입력 시 ➡️ 'SINGLE' 판정, '서울: 천년의 고도와 현대의 조화' 1권의 책으로 구성.

반드시 아래 제공된 JSON 포맷 스키마에 맞춰 완전한 JSON 형식으로 출력해야 합니다. JSON 텍스트 바깥에 불필요한 백틱(```json 등)이나 마크다운 텍스트는 절대 포함하지 마십시오.

[JSON Output Schema]
{{
  "splitType": "SERIES 또는 SINGLE 중 적절한 것 판정",
  "destination": "{destination}",
  "books": [
    {{
      "id": "영문 소문자와 숫자 조합의 고유 ID (예: south_korea_seoul)",
      "title": "책의 감성적인 대제목",
      "subtitle": "책의 소제목",
      "theme": "책의 구체적 명소/주제명 (2차 책 생성 시 API 쿼리로 사용할 구체적 명칭, 예: '서울')",
      "coverPrompt": "이 책의 표지 및 책꽂이 카드 썸네일로 어울리는 수채화 디오라마 일러스트 묘사 영어 키워드 (예: 'water color paper-cut diorama of seoul Gyeongbokgung palace, warm palette, travel illustration, no text')"
    }}
  ]
}}
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7
            )
        )
        return json.loads(response.text.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서재 구성 중 서버 오류 발생: {str(e)}")

# 2. 선택된 명소의 상세 스토리 및 추천 일정 생성 API
@app.post("/api/generate")
async def generate_travel_book(req: GenerateBookRequest):
    destination = req.destination.strip()
    parent_destination = req.parent_destination.strip()
    style = req.style
    duration = req.duration
    themes = req.themes

    if not destination:
        raise HTTPException(status_code=400, detail="명소(destination)가 지정되지 않았습니다.")

    client = get_gemini_client()

    theme_str = ", ".join(themes) if themes else "일반 역사 및 문화"
    
    style_instruction = ""
    if style == "kimyoungha":
        style_instruction = "소설가 김영하의 문체 (이성적이고 현대적이며, 감각적인 통찰이 돋보이는 도시 산문체. 세련된 문장, 여행자로서의 깊은 자아 성찰과 관찰이 돋보이는 톤앤매너)"
    elif style == "haruki":
        style_instruction = "소설가 무라카미 하루키의 문체 (재즈, 위스키, 시니컬하면서도 쓸쓸한 독백이 섞인 현대 서사체. 특유의 은유와 일인칭 시점의 독특한 감성, 조금은 건조하지만 흡입력 있는 문체)"
    elif style == "hesse":
        style_instruction = "문학가 헤르만 헤세의 문체 (자연에 대한 찬미, 자아 성찰, 고전적이고 절제된 낭만주의 문체. 서정적이고 아름다운 자연/도시 묘사와 영혼의 순례자 같은 철학적 성찰이 가미된 톤앤매너)"
    else:
        style_instruction = "이성적이고 감성적인 통찰이 돋보이는 여행 문학 산문체"

    prompt = f"""
역사학자이자 감성적인 여행 도서관 사서로서, 아래 조건에 맞춰 대상 여행지의 가이드 e-Book 스토리와 시간대별 일정을 완성해 주세요.

[입력 조건]
- 대상 상세 명소: {destination}
- 전체 여행 범위: {parent_destination}
- 가이드 스토리텔링 톤앤매너: {style_instruction}
- 추천 일정 기간: {duration} (예: 2박 3일이면 1일차, 2일차, 3일차 일정이 모두 포함되어야 함)
- 주요 관심 테마: {theme_str}

[스토리텔링 제약 규칙]
- 책 본문(pages)은 반드시 총 4페이지로 구성합니다. 각 페이지는 역사적 전설, 숨겨진 비화, 문화적 배경 등 깊이 있는 정보를 제공하되 백과사전식 나열이 아닌 선택된 작가의 문체 특징을 고스란히 살려 시적이고 세련된 스토리로 채워주세요.
- 각 페이지당 storyText는 한국어 기준 200~300자 내외입니다.
- audioText는 낭독용입니다. 특수문자, 이모지, 괄호를 제외하고 한국어로 물 흐르듯 자연스럽게 낭독되도록 정돈해 주세요.
- 표지용 일러스트 프롬프트는 따뜻하고 감성적인 플랫 벡터 여행 포스터 일러스트(flat vector cozy travel poster illustration, minimal line art style, warm pastel color palette with cream, terracotta and light blue, aesthetic composition, highly detailed, no text) 스타일로 영어로 작성해 주세요.
  (예: 'flat vector cozy travel poster illustration of Gyeongju, warm pastel color palette with cream and terracotta, minimal line art, serene landscape, aesthetic composition, highly detailed, no text')
- 본문 1~4장의 이미지 검색용 영어 키워드는 해당 페이지에 수록될 관광지 풍경 실사 사진을 Unsplash에서 검색할 수 있는 구체적인 실제 키워드로 영어로 적어주세요.
  (예: 'Gyeongju Bulguksa temple autumn view')

[추천 일정 및 지도 프롬프트 제약 규칙]
- 기간('{duration}')에 명시된 일차별 타임라인을 빠짐없이 엮어주세요.
- 예를 들어, '{duration}'이 '2박 3일'인 경우, JSON 출력의 'itinerary' 배열 안에는 반드시 day: 1, day: 2, day: 3에 해당하는 객체가 모두 존재해야 합니다. 절대 누락하지 마십시오!
- 각 일차별 timeline은 3개 이상의 대표 명소 동선과 체류 시간 팁, 로컬 맛집 정보 등을 흥미롭게 서술해 주세요.
- **중요 - 위도 및 경도 좌표 추가:** timeline 배열의 각 장소(place)에 대해 실제 지리적 위도(lat)와 경도(lng)를 실수(float) 값으로 정확하게 구글 맵 기준으로 찾아서 채워주세요. (예: 도쿄 타워의 경우 lat: 35.6586, lng: 139.7454)
- **중요 - mapImagePrompt 구성:** 각 일차별로 'mapImagePrompt' 필드를 반드시 영어로 생성해 주세요. 이 프롬프트는 아래 가이드를 준수하여 대상 도시 및 해당 일차의 방문지명(place 명칭들)에 맞춰 동적으로 변경되게 작성해야 합니다.
  * [가이드라인]:
    - **[Purpose]**: Create a travel map postcard for '{destination}' containing local landmarks and a path.
    - **[Scene]**: A warm cream paper card showing a hand-drawn route map of '{destination}'. Connect timeline locations (e.g. the places in timeline) with simple dashed lines. Accent the card with ticket stubs, postage stamps, masking tape, and receipts to look like a page from a travel note.
    - **[Style]**: Map postcard illustration combined with scrapbook collage. Use thin ink lines, watercolor texture, cream/beige/terracotta color palette, retro stamp details.
    - **[Composition]**: 1536x1024 landscape card layout. Route map in the center, title "Route Map" on top, stamp on top right, travel note box on bottom right.
    - **[Text]**: Explicitly mention text to include in English: Title: '{destination} finds', subtitle: 'Day {day} route', labels for places (insert the timeline place names in English), postmark: '{destination}', note title: 'TRAVEL NOTE' with a small summary sentence.

반드시 아래 제공된 JSON 포맷 스키마에 맞춰 완전한 JSON 형식으로 출력해야 합니다. JSON 텍스트 바깥에 불필요한 백틱(```json 등)이나 마크다운 텍스트는 절대 포함하지 마십시오.

[JSON Output Schema]
{{
  "title": "책의 감성적인 메인 제목 (예: '달빛 아래 속삭이는 서호의 백사 전설')",
  "subtitle": "책의 소제목 (예: '시인 소동파와 전설적인 신화가 빚어낸 항저우의 심장')",
  "destination": "{destination}",
  "coverImagePrompt": "표지용 플랫 벡터 일러스트 묘사 영어 키워드 (예: 'flat vector cozy travel poster illustration of seoul skyline, warm pastel color palette')",
  "pages": [
    {{
      "pageNumber": 1,
      "chapterTitle": "챕터 제목",
      "storyText": "본문 내용",
      "audioText": "오디오 낭독용 정제 텍스트",
      "imageSearchQuery": "본문 실제 Unsplash 사진 검색용 영어 키워드 (예: 'seoul gyeongbokgung palace autumn landscape')"
    }}
  ],
  "itinerary": [
    {{
      "day": 1,
      "mapImagePrompt": "이 일차의 추천 동선을 그리기 위한 영문 이미지 생성 프롬프트 (위의 가이드라인 형식을 적용)",
      "timeline": [
        {{
          "time": "09:00",
          "place": "장소 이름",
          "desc": "추천 팁 및 동선 해설",
          "lat": 35.6895,
          "lng": 139.6917
        }}
      ]
    }}
  ]
}}
"""

    try:
        # 2. Gemini API 호출
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7
            )
        )

        # 3. JSON 데이터 파싱
        result_data = json.loads(response.text.strip())

        # 4. Unsplash 실제 풍경 이미지 매칭 연동
        for page in result_data.get("pages", []):
            query = page.get("imageSearchQuery", destination)
            image_url = get_unsplash_image(query)
            page["imageUrl"] = image_url

        return result_data

    except Exception as e:
        return {
            "error": True,
            "message": f"도서 생성 중 서버 내부 오류가 발생했습니다: {str(e)}"
        }

def get_unsplash_image(query):
    default_images = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80"
    ]
    
    clean_query = requests.utils.quote(query)
    if not UNSPLASH_ACCESS_KEY:
        # Unsplash의 키가 없을 때 고정된 단일 이미지 대신 키워드에 따른 동적 대표 이미지 서비스 활용
        return f"https://images.unsplash.com/featured/1200x900/?{clean_query}"
        
    try:
        url = "https://api.unsplash.com/search/photos"
        params = {
            "query": query,
            "per_page": 1,
            "orientation": "landscape"
        }
        headers = {
            "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"
        }
        res = requests.get(url, params=params, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data.get("results"):
                return data["results"][0]["urls"]["regular"]
    except Exception:
        pass
        
    # 만약 검색에 실패할 경우 키워드 기반의 featured 이미지 혹은 기본 목록 중 랜덤 선택
    return f"https://images.unsplash.com/featured/1200x900/?{clean_query}"


class ChatRequest(BaseModel):
    destination: str
    style: str
    question: str
    chat_history: Optional[List[dict]] = []

@app.post("/api/chat")
async def chat_with_librarian(req: ChatRequest):
    client = get_gemini_client()
    
    style_instruction = ""
    if req.style == "kimyoungha":
        style_instruction = "소설가 김영하의 문체 (차분하고 성찰적이며 이성적인 한국어 높임말)"
    elif req.style == "haruki":
        style_instruction = "소설가 무라카미 하루키의 문체 (재즈와 위스키가 어울리는 쓸쓸하면서도 독특한 은유의 1인칭 높임말)"
    elif req.style == "hesse":
        style_instruction = "문학가 헤르만 헤세의 문체 (서정적이고 자연을 닮은 철학적 성찰이 가미된 정중한 높임말)"
    else:
        style_instruction = "감성적인 문학 여행 전문 사서의 정중한 어조"
        
    system_instruction = f"""
당신은 여행지 '{req.destination}'에 관한 안내 책을 관리하는 '여행 책방의 AI 사서'입니다.
기본적으로 친절하고 유식하게 책방의 책 속 정보와 실용적인 여행 팁(맛집, 명소, 교통 정보, 상식 등)을 답변해야 합니다.
사용자가 선택한 테마 스타일인 '{style_instruction}'의 문체 매너를 20~30% 정도 가미하여, 다소 차분하고 서정적이며 격조 있는 톤으로 존댓말로 답변해 주세요.
주어진 여행지인 '{req.destination}' 외의 다른 엉뚱한 국가나 도시는 가급적 배제하고, 질문에 명확하게 밀착해서 답변을 제공하십시오.
이모지는 답변당 1~2개 이내로 아주 제한적으로 사용하여 품격 있는 서재 분위기를 유지하세요.
"""
    
    # Gemini 대화 내역 포맷으로 변환
    contents = []
    for msg in req.chat_history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg.get("text", ""))]
        ))
        
    # 새로운 질문 추가
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=req.question)]
    ))
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=800
            )
        )
        return {
            "answer": response.text.strip(),
            "error": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사서와의 대화에 실패했습니다: {str(e)}")


