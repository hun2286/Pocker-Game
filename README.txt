🃏 Texas Hold'em Poker: Deathmatch Edition
FastAPI와 React 기반의 전략적 텍사스 홀덤 게임입니다. 딜러와의 자산 경쟁을 통해 한쪽을 파산시키는 몰입감 있는 게임 경험을 제공합니다.

✨ 주요 기능
💰 자금 및 배팅 시스템 (Betting System)
데스매치 구조: 플레이어/딜러 각 $1,000 초기 자산 부여, 한쪽 파산 시 종료

단계별 추가 배팅: Ante(참가비) 외에 Flop, Turn, River 단계별 Call(추가 배팅) 로직 적용

전략적 Fold: 패배 예상 시 기권을 통한 손실 최소화 및 판돈 딜러 귀속 메커니즘

🏆 지능형 게임 로직 (Game Logic)
실시간 족보 계산: 카드 오픈 단계별 최적의 핸드(Best Hand) 실시간 업데이트 및 표시

정밀한 승패 판정: 동일 족보 시 하이카드 및 키커 비교를 통한 단독 승자/무승부(Chop) 판정

데이터 무결성: 모든 카드 생성 및 배팅 계산은 백엔드(FastAPI)에서 중앙 집중 처리

🎨 시각 연출 및 (UX/UI)
승리 하이라이트: 쇼다운 시 승리 족보 구성 카드(2~5장)를 금빛 테두리로 강조

파산 엔딩 오버레이: 게임 종료 시 CHAMPION / GAMEOVER 결과창을 화면 전체에 렌더링

인터랙티브 레이아웃: 상단 실시간 자산 바(Status Bar) 및 하단 액션 버튼 배치

🚀 시작하기 (Quick Start)
사전 요구사항: Docker Desktop 설치 필수

컨테이너 빌드 및 실행

docker-compose up --build

서비스 접속

Frontend: http://localhost:5173

Backend API: http://localhost:8000

📂 프로젝트 구조
frontend/: React 기반 UI 및 프론트엔드 상태 관리

backend/: FastAPI 기반 API 서버 및 게임 상태 제어

modules/: 게임 핵심 엔진

cards.py: 덱 생성 및 카드 분배

evaluator.py: 족보 분석 및 랭킹 계산

game_engine.py: 승패 판정 및 자금 정산 로직

💡 향후 개선 사항 (Next Steps)
멀티미디어: 카드 딜링 효과음 및 승리 시 칩 쏟아지는 사운드 추가

확률 엔진: 현재 핸드 기준 특정 족보 완성 확률 실시간 시각화

지능형 AI: 딜러의 승률 분석을 통한 유동적인 배팅(Raise/Fold/Bluffing) 로직 구현