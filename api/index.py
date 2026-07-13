from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
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

# API 입력 파라미터 구조체
class SearchRequest(BaseModel):
    destination: str
    style: Optional[str] = "cherry"
    duration: Optional[str] = "당일치기"
    themes: Optional[List[str]] = []

class GenerateBookRequest(BaseModel):
    destination: str          # 서재에서 선택된 상세 명소 (예: "항저우 서호")
    parent_destination: str   # 원본 검색 지역 (예: "항저우" - 동선 계산용)
    style: Optional[str] = "cherry"
    duration: Optional[str] = "당일치기"
    themes: Optional[List[str]] = []

# API Key 정보 로드
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

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

# 1. 여행지 검색 및 서재 분할 판정 API
@app.post("/api/search")
async def search_destination(req: SearchRequest):
    destination = req.destination.strip()
    if not destination:
        raise HTTPException(status_code=400, detail="여행지 이름을 입력해 주세요.")

    client = get_gemini_client()

    prompt = f"""
여행 분석가로서, 입력된 여행지/명소인 '{destination}'의 규모와 지리적 위상을 분석해 서재를 구성해 주세요.

[판정 규칙]
1. 입력 대상이 대도시, 시/도 단위, 혹은 여러 명소를 포괄하는 대형 구역(예: 경주, 항저우, 서울, 제주도, 도쿄, 뉴욕)일 경우 'SERIES'로 판정합니다.
   - 이 경우, 해당 지역 내에서 가볼 만한 주요 명소/테마별로 쪼개진 '도서 시리즈 목록'을 최소 3권 최대 4권 설계해 주세요.
   - 예: '경주' 입력 시 ➡️ '경주 불국사', '경주 황리단길', '경주 대릉원과 첨성대' 3권의 책으로 나눔.
2. 입력 대상이 단일 랜드마크, 절, 성, 박물관 등 소규모 명소(예: 불국사, 청수사, 에펠탑, 자유의 여신상)일 경우 'SINGLE'로 판정합니다.
   - 이 경우, 해당 소규모 명소 전용의 단일 도서 1권만 목록에 넣어주세요.

반드시 아래 제공된 JSON 포맷 스키마에 맞춰 완전한 JSON 형식으로 출력해야 합니다. JSON 텍스트 바깥에 불필요한 백틱(```json 등)이나 마크다운 텍스트는 절대 포함하지 마십시오.

[JSON Output Schema]
{{
  "splitType": "SERIES 또는 SINGLE 중 적절한 것 판정",
  "destination": "{destination}",
  "books": [
    {{
      "id": "영문 소문자와 숫자 조합의 고유 ID (예: gyeongju_bulguksa)",
      "title": "책의 감성적인 대제목 (예: '불심으로 엮은 돌의 성전, 불국사')",
      "subtitle": "책의 소제목 (예: '석굴암과 다보탑에 서린 천년 신라의 불교 예술')",
      "theme": "책의 핵심 세부 명소/주제명 (2차 책 생성 시 API 쿼리로 사용할 구체적 명칭, 예: '경주 불국사')"
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
    
    # 톤앤매너 프롬프트: 아동용 느낌을 지우고 세련되고 다정한 경어체 전문가 체리로 수정
    style_instruction = ""
    if style == "cherry":
        style_instruction = "친근하고 다정한 로컬 전문가 '🍒체리'의 구어체 가이드 톤 (지적이고 세련된 경어체 사용, 무의미한 유아용 어조 배제)"
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

[스토리텔링 및 AI 이미지 연동 제약 규칙]
- 책 본문(pages)은 반드시 총 4페이지로 구성합니다. 각 페이지는 역사적 전설, 숨겨진 비화, 문화적 배경 등 깊이 있는 정보를 제공하되 백과사전식 나열이 아닌 시적이고 세련된 스토리로 채워주세요.
- 각 페이지당 storyText는 한국어 기준 200~300자 내외입니다.
- audioText는 낭독용입니다. 특수문자, 이모지, 괄호를 제외하고 한국어로 물 흐르듯 자연스럽게 낭독되도록 정돈해 주세요.
- imagePrompt는 Pollinations AI 이미지 생성을 위한 고도의 영어 묘사문입니다. 
  사용자가 요구한 'layered paper-cut collage, handcrafted paper diorama, museum-quality travel poster' 스타일을 완벽히 투영하여, {destination}의 공간감과 분위기를 묘사하는 영어 프롬프트를 챕터별로 정교하게 지어주세요. 
  (예: 'layered paper-cut collage of Bulguksa temple Korea, handcrafted paper diorama, museum-quality travel poster style, warm color palette, matte texture, soft lighting, sharp paper edges, no text')

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
  "pages": [
    {{
      "pageNumber": 1,
      "chapterTitle": "챕터 제목",
      "storyText": "본문 내용",
      "audioText": "오디오 낭독용 정제 텍스트",
      "imagePrompt": "Pollinations AI용 영어 프롬프트 (예: 'layered paper-cut collage, Bulguksa temple in autumn, handcrafted paper diorama, travel poster aesthetic, matte texture')"
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
        raise HTTPException(status_code=500, detail=f"도서 생성 중 서버 오류 발생: {str(e)}")
