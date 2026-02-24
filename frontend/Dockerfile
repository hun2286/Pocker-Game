# 1. 노드 20 사용
FROM node:20-alpine

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 소스 코드 복사
COPY . .

# 5. Vite 개발 서버 실행 (포트 5173)
# --host 설정을 해야 컨테이너 외부에서 접속 가능합니다.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]