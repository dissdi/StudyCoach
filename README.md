# Study Coach APP

AI 기반 실시간 공부 코칭 앱. 웹캠으로 집중도를 분석하고 LLM 코치가 맞춤 피드백을 제공합니다.

---

## How to use?

### 1. 클론

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd "Study Coach APP develop"
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
cd apps/web
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 설정

앱 실행 후 **설정** 페이지에서 LLM API 키를 입력하세요.

- **OpenAI** — `gpt-4o-mini` 등 사용 시 OpenAI API 키 입력
- **Anthropic** — `claude-3-5-haiku` 등 사용 시 Anthropic API 키 입력

API 키는 브라우저 로컬스토리지에만 저장되며 외부로 전송되지 않습니다.

---

## 요구사항

- Node.js 18 이상
- 웹캠
