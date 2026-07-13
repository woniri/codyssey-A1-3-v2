from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

# 1. 여행지 검색 및 서재 분할 판정 API (국가 ➡️ SERIES / 도시 ➡️ SINGLE 판정 고도화)
@app.post("/api/search")
async def search_destination(req: SearchRequest):
    destination = req.destination.strip()
    if not destination:
        raise HTTPException(status_code=400, detail="여행지 이름을 입력해 주세요.")

    client = get_gemini_client()

    prompt = f"""
여행 분석가로서, 입력된 여행지/명소인 '{destination}'의 규모를 정확하게 분석하여 서재 분할 타입(splitType)을 판정해 주세요.

[중요 판정 기준]
1. 입력어가 '국가', '대륙', 혹은 광역 행정 구역(예: 대한민국, 일본, 중국, 미국, 경상도, 전라도 등 넓은 지역)인 경우에만 'SERIES'로 판정합니다.
   - 이 경우, 해당 국가나 구역 내에서 가볼 만한 대표적인 도시나 대규모 행정 지역들을 3~4개의 시리즈 도서 목록으로 설계해 주세요.
   - 예: '대한민국' 입력 시 ➡️ '서울: 전통과 현대의 심장', '부산: 바다와 빛의 도시', '제주도: 화산섬의 자연과 신화' 3권의 책으로 분할 구성.
2. 입력어가 일반적인 '도시 단위'(예: 서울, 대구, 부산, 도쿄, 뉴욕, 경주, 항저우 등)이거나 '특정 단일 명소'(예: 불국사, 석굴암, 청수사, 에펠탑 등)인 경우에는 무조건 'SINGLE'로 판정합니다.
   - 이 경우, 해당 대상만을 다루는 단일 가이드북 1권만 목록에 넣어주세요.
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
      "theme": "책의 구체적 명소/주제명 (2차 책 생성 시 API 쿼리로 사용할 구체적 명칭, 예: '서울')"
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

# 2. 선택된 명소의 상세 스토리 및 추천 일정 생성 API (본문 Unsplash 실사 연동)
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
    if style == "cherry":
        style_instruction = "친근하고 다정한 로컬 전문가 '🍒체리'의 구어체 가이드 톤 (지적이고 세련된 경어체 사용, 이모지는 적절히만 사용)"
    elif style == "expert":
        style_instruction = "정중하고 지적이며 깊이 있는 역사 해설자의 전통 학술 가이드 톤"
    elif style == "kids":
        style_instruction = "아이들의 상상력을 자극하는 쉽고 재미있는 구어체 동화 이야기꾼 톤"
    else:
        style_instruction = "다정하고 깊이 있는 현지 전문가 스토리텔러 톤"

    prompt = f"""
역사학자이자 감성적인 여행 도서관 사서로서, 아래 조건에 맞춰 대상 여행지의 가이드 e-Book 스토리와 시간대별 일정을 완성해 주세요.

[입력 조건]
- 대상 상세 명소: {destination}
- 전체 여행 범위: {parent_destination}
- 가이드 스토리텔링 톤앤매너: {style_instruction}
- 추천 일정 기간: {duration} (예: 2박 3일이면 1일차, 2일차, 3일차 일정이 모두 포함되어야 함)
- 주요 관심 테마: {theme_str}

[스토리텔링 제약 규칙]
- 책 본문(pages)은 반드시 총 4페이지로 구성합니다. 각 페이지는 역사적 전설, 숨겨진 비화, 문화적 배경 등 깊이 있는 정보를 제공하되 백과사전식 나열이 아닌 시적이고 세련된 스토리로 채워주세요.
- 각 페이지당 storyText는 한국어 기준 200~300자 내외입니다.
- audioText는 낭독용입니다. 특수문자, 이모지, 괄호를 제외하고 한국어로 물 흐르듯 자연스럽게 낭독되도록 정돈해 주세요.
- 표지용 일러스트 프롬프트는 수채화 느낌의 무광 종이 디오라마(water color paper-cut diorama illustration) 스타일로 영어로 작성해 주세요.
  (예: 'water color paper-cut diorama of Gyeongju, warm palette, matte paper texture, soft studio lighting, sharp borders, travel poster illustration, no text')
- 본문 1~4장의 이미지 검색용 영어 키워드는 해당 페이지에 수록될 관광지 풍경 실사 사진을 Unsplash에서 검색할 수 있는 구체적인 실제 키워드로 영어로 적어주세요.
  (예: 'Gyeongju Bulguksa temple autumn view')

[추천 일정 제약 규칙]
- 기간('{duration}')에 명시된 일차별 타임라인을 빠짐없이 엮어주세요.
- 예를 들어, '{duration}'이 '2박 3일'인 경우, JSON 출력의 'itinerary' 배열 안에는 반드시 day: 1, day: 2, day: 3에 해당하는 객체가 모두 존재해야 합니다. 절대 누락하지 마십시오!
- 각 일차별 timeline은 3개 이상의 대표 명소 동선과 체류 시간 팁, 로컬 맛집 정보 등을 흥미롭게 서술해 주세요.

반드시 아래 제공된 JSON 포맷 스키마에 맞춰 완전한 JSON 형식으로 출력해야 합니다. JSON 텍스트 바깥에 불필요한 백틱(```json 등)이나 마크다운 텍스트는 절대 포함하지 마십시오.

[JSON Output Schema]
{{
  "title": "책의 감성적인 메인 제목 (예: '달빛 아래 속삭이는 서호의 백사 전설')",
  "subtitle": "책의 소제목 (예: '시인 소동파와 전설적인 신화가 빚어낸 항저우의 심장')",
  "destination": "{destination}",
  "coverImagePrompt": "표지용 수채화 디오라마 일러스트 묘사 영어 키워드 (예: 'water color paper-cut diorama of seoul skyline')",
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
      "timeline": [
        {{
          "time": "09:00",
          "place": "장소 이름",
          "desc": "추천 팁 및 동선 해설"
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
        # 본문 페이지는 실제 Unsplash 사진을 불러옵니다.
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
    
    if not UNSPLASH_ACCESS_KEY:
        # 키가 없는 경우 검색어 기반의 Unsplash 오픈 이미지 주소 우회 조합
        clean_query = requests.utils.quote(query)
        return f"https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80"
        
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
        
    import random
    return random.choice(default_images)
