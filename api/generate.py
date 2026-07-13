from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import google.generativeai as genai

# Gemini API 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Unsplash API 설정
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # CORS 처리를 위한 OPTIONS 응답
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        # 1. CORS 헤더 설정
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        try:
            # 2. POST 요청 바디 파싱
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length).decode("utf-8")
            
            if not post_data:
                raise ValueError("요청 본문이 비어있습니다.")
                
            request_json = json.loads(post_data)
            destination = request_json.get("destination", "").strip()
            style = request_json.get("style", "cherry") # cherry (체리), expert (전문가), kids (아이용)
            duration = request_json.get("duration", "당일치기")
            themes = request_json.get("themes", [])

            if not destination:
                raise ValueError("여행지(destination)를 입력해 주세요.")

            # API 키 누락 검사
            if not GEMINI_API_KEY:
                raise ValueError("서버에 Gemini API Key가 설정되지 않았습니다. 관리자 설정을 확인해주세요.")

            # 3. Gemini 프롬프트 작성
            theme_str = ", ".join(themes) if themes else "일반 역사 및 문화"
            
            # 가이드 톤앤매너 설정
            style_instruction = ""
            if style == "cherry":
                style_instruction = "친근하고 상냥한 이모지를 듬뿍 섞은 '🍒체리'의 친절한 구어체 가이드 톤"
            elif style == "expert":
                style_instruction = "정중하고 차분하며 깊이 있는 역사 해설자 학술 가이드 톤"
            elif style == "kids":
                style_instruction = "초등학생도 쉽게 이해할 수 있는 동화 이야기꾼 톤"
            else:
                style_instruction = "흥미로운 전설과 비화가 깃든 다정하고 격식 있는 어조"

            prompt = f"""
역사학자이자 감성적인 여행 도서관 사서로서, 아래 입력 조건에 맞춰 여행 가이드 e-Book 콘텐츠(역사/비화 포함)와 추천 일정을 생성해 주세요.

[입력 조건]
- 대상 여행지: {destination}
- 스토리텔링 톤앤매너: {style_instruction}
- 여행 추천 일정 기간: {duration}
- 주요 관심사: {theme_str}

[생성 및 분할 제약 규칙]
- 입력 대상지의 성격과 규모를 분석하여, 단일 챕터(SINGLE)로 구성할지 또는 여러 세부 명소 리스트로 분할할 시리즈(SERIES)인지 결정하십시오.
- 책 본문(pages)은 총 4페이지로 구성합니다. 각 페이지는 역사적 전설, 문화적 의의, 흥미진진한 비하인드 스토리(Hallucination 없는 실제 팩트)를 가독성 좋은 한국어로 서술해 주세요.
- 각 페이지당 storyText는 약 200~300자 내외로 구성합니다.
- audioText는 TTS 낭독용입니다. 이모지, 괄호, 특수기호 등을 제외하고 부드럽고 자연스럽게 흘러가도록 텍스트를 정리해 주세요.
- imagePrompt는 해당 페이지의 테마를 표현하는 무광 종이 디오라마(handcrafted paper diorama)를 묘사하는 영어 키워드 및 배경 검색 태그로 적어주세요.
- 추천 일정(itinerary)은 {duration}에 맞추어 시간대별 코스(Day 1, Day 2 등)를 타임라인으로 상세화해 주세요. (Day별로 최소 3개 이상의 핵심 장소와 상세 추천 설명 포함)

반드시 아래 제공된 JSON 포맷 스키마에 맞추어 완전한 JSON 형식으로 출력해야 합니다. JSON 텍스트 바깥에 불필요한 백틱(```json 등)이나 마크다운 텍스트는 절대 포함하지 마십시오.

[JSON Output Schema]
{{
  "title": "책의 메인 제목 (예: '천년의 고도, 경주 불국사를 걷다')",
  "subtitle": "감성적인 소제목 (예: '신라의 불교 예술과 석조에 담긴 천년의 이야기')",
  "splitType": "SINGLE 또는 SERIES 중 적절한 것 선택",
  "pages": [
    {{
      "pageNumber": 1,
      "chapterTitle": "챕터 제목",
      "storyText": "본문 내용",
      "audioText": "오디오 낭독용 정제 텍스트",
      "imagePrompt": "Unsplash 및 AI 생성용 영어 이미지 키워드 (예: 'Bulguksa temple gyeongju cherry blossom paper art style')"
    }}
  ],
  "itinerary": [
    {{
      "day": 1,
      "timeline": [
        {{
          "time": "09:00",
          "place": "장소 이름",
          "desc": "방문 팁 및 상세한 추천 정보"
        }}
      ]
    }}
  ]
}}
"""

            # 4. Gemini API 호출
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.7
                }
            )

            # 5. Gemini 응답 파싱
            result_data = json.loads(response.text.strip())

            # 6. Unsplash 이미지 매칭 작업
            for page in result_data.get("pages", []):
                query = page.get("imagePrompt", destination)
                image_url = get_unsplash_image(query)
                page["imageUrl"] = image_url

            # 7. 최종 결과 클라이언트에 반환
            self.wfile.write(json.dumps(result_data, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            # 에러 발생 시 500 에러 대신 200번 상태코드로 감싼 뒤 JSON 에러 정보를 반환하여 클라이언트 단에서 파싱 유도
            error_response = {
                "error": True,
                "message": f"콘텐츠 생성 중 오류가 발생했습니다: {str(e)}"
            }
            self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode("utf-8"))

def get_unsplash_image(query):
    """
    Unsplash API를 호출하여 이미지 URL을 획득합니다.
    API Key가 없거나 호출에 실패한 경우, 적절한 무료 대체 이미지 주소를 반환합니다.
    """
    # 기본 대체 풍경 이미지 리스트 (안전한 도메인)
    default_images = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", # 바다 풍경
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80", # 로드 트립
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80", # 강/배 풍경
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80"  # 평화로운 호수
    ]
    
    if not UNSPLASH_ACCESS_KEY:
        # 키가 없는 경우 검색 쿼리에 맞는 Unsplash Source 힌트(무료 리다이렉트 뷰어)를 사용하거나 기본 리스트에서 리턴
        # pixabay나 unsplash의 static 검색 주소를 우회적으로 반환하여 프론트엔드가 자연스럽게 처리하도록 함
        # 예: https://images.unsplash.com/featured/?<query>
        clean_query = requests.utils.quote(query)
        return f"https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80" # 기본 풍경 고정
        
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
                # 고해상도 이미지 반환
                return data["results"][0]["urls"]["regular"]
    except Exception:
        pass
        
    # 최종 예외 상황 대처
    import random
    return random.choice(default_images)
