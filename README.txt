🃏 Texas Hold'em Poker: Deathmatch Edition

FastAPI와 React 기반의 전략적 텍사스 홀덤 게임입니다. 
딜러와의 자산 경쟁을 통해 한쪽을 파산시키는 몰입감 있는 게임 경험을 제공합니다.

■ ✨ 주요 기능

  [💰 자금 및 베팅 시스템]
  ● 데스매치 구조: 플레이어/딜러 각 $2,000 초기 자산 부여, 한쪽 파산 시 종료
  ● 단계별 추가 베팅: Ante(참가비) 외에 단계별 Call, Check, Raise 로직 적용
  ● 전략적 Fold: 패배 예상 시 기권(Fold)을 통한 손실 최소화 연출

  [🏆 지능형 게임 로직]
  ● 정밀한 턴 제어 (New): 딜러 버튼(D) 위치에 따른 선공/후공 로직 엄격 적용
  ● 라운드 자동 동기화 (New): 유저 Call 시 즉시 페이즈 전환 및 다음 선공 결정
  ● 실시간 족보 계산: 카드 오픈 단계별 최상의 5장(Best Hand) 실시간 업데이트
  ● 데이터 무결성: 모든 카드 생성 및 베팅 계산은 백엔드에서 중앙 집중 처리

  [🎨 시각 연출 및 UX/UI]
  ● 비동기 연출 엔진 (New): async/await를 활용한 순차적 게임 흐름 구현
  ● 대화형 인터페이스: 딜러의 의사결정을 실시간 말풍선으로 시각화
  ● 승리 하이라이트: 쇼다운 시 승리 족보 구성 카드를 금빛 테두리로 강조
  ● 인터랙티브 레이아웃: 상단 실시간 자산 바 및 하단 액션 버튼 배치

■ 🚀 시작하기 (Quick Start)

  1. 사전 요구사항: Docker Desktop 설치 필수
  2. 컨테이너 실행: docker-compose up --build
  3. 서비스 접속:
     - Frontend: http://localhost:5173
     - Backend API: http://localhost:8000

■ 📂 프로젝트 구조

  📂 frontend/ : React 기반 UI 및 프론트엔드 비동기 연출 상태 관리
  📂 backend/  : FastAPI 기반 API 서버 환경 설정 (main.py)
  📂 modules/  : 게임 핵심 엔진 및 비즈니스 로직 모듈
    - game_service.py : [핵심] 턴 제어, 페이즈 전환 및 게임 흐름 관리
    - cards.py        : 덱 생성, 셔플 및 카드 분배 로직
    - evaluator.py    : 족보 분석 및 랭킹 계산
    - game_engine.py  : 승패 판정 및 판돈 정산 로직

■ 💡 향후 개선 사항 (Next Steps)

  ● 멀티미디어: 카드 딜링 효과음 및 승리 시 칩 사운드 추가
  ● 지능형 AI: 승률 분석 및 블러핑 확률을 도입한 유동적 AI 고도화
  ● 모바일 최적화: 다양한 기기에 대응하는 반응형 레이아웃 강화