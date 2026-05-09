# StudyCoach 📚

> CV + LLM 기반 실시간 공부 코칭 앱

열품타에 AI를 더한 공부 코치 앱. 카메라로 집중도/감정을 실시간 분석하고, Claude AI가 맞춤 코칭 메시지를 제공합니다.

---

## 🚀 빠른 시작

### 요구사항
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS 시뮬레이터 또는 실제 기기 (카메라 기능은 실기기 권장)
- Expo Go 앱 (실기기 테스트용)

### 설치 및 실행

```bash
cd StudyCoach
npm install
npx expo start
```

QR 코드 스캔 → Expo Go로 실행

---

## 🏗️ 프로젝트 구조

```
StudyCoach/
├── App.tsx                      # 앱 진입점
├── src/
│   ├── types/index.ts           # 공용 타입 정의
│   ├── constants/index.ts       # 색상, 임계값, 상수
│   ├── store/useStudyStore.ts   # Zustand 전역 상태
│   ├── navigation/              # React Navigation 설정
│   ├── screens/
│   │   ├── HomeScreen.tsx       # 홈 (과목 선택 + 시작)
│   │   ├── StudySessionScreen.tsx  # 세션 (카메라 + 타이머 + 코치)
│   │   ├── ReportScreen.tsx     # 세션 리포트
│   │   ├── StatsScreen.tsx      # 주간 통계
│   │   └── SettingsScreen.tsx   # 설정 (API 키, 코치 스타일)
│   ├── components/
│   │   ├── StudyTimer.tsx       # 타이머 디스플레이
│   │   ├── CameraFeed.tsx       # 카메라 뷰 + Face Detector
│   │   ├── FocusIndicator.tsx   # 집중도 게이지 바
│   │   └── CoachMessage.tsx     # AI 코치 메시지 버블
│   ├── hooks/
│   │   ├── useStudyTimer.ts     # 타이머 로직
│   │   ├── useFaceAnalysis.ts   # Face detector 이벤트 처리
│   │   └── useCoach.ts          # LLM 코치 트리거 로직
│   └── services/
│       ├── cvService.ts         # Face detection → 집중도/감정 변환
│       └── llmService.ts        # Anthropic API 호출 + Mock
```

---

## 🧠 핵심 기능

### CV 집중도 분석 (expo-face-detector / Google ML Kit)
| 감지 항목 | 방법 |
|---------|------|
| 눈 개방도 | `leftEyeOpenProbability`, `rightEyeOpenProbability` |
| 졸음 감지 | 눈 개방도 < 0.3 → `tired` |
| 자리 이탈 | 10초 이상 얼굴 미감지 → `absent` |
| 집중도 점수 | 눈 개방도 기반 0~100 점수 |

### LLM 코칭 (Claude API)
- 트리거: 집중도 < 40, 졸음, 자리이탈, 뽀모도로 마일스톤 (25/50/90분)
- 쿨다운: 같은 트리거 60초 이내 재발동 방지
- 페르소나: 친구 / 선생님 / 트레이너

---

## 🔑 API 키 설정

1. [Anthropic Console](https://console.anthropic.com)에서 API 키 발급
2. 앱 설정 탭 → API 키 입력

API 키 없이도 내장 Mock 메시지로 작동합니다.

---

## 📱 다음 단계 (TODO)

- [ ] 세션 데이터 AsyncStorage 영구 저장
- [ ] 집중도 시계열 그래프 (리포트 화면)
- [ ] 음성 TTS 코칭 (expo-av)
- [ ] 뽀모도로 타이머 모드
- [ ] 공부 목표 설정
- [ ] 친구와 공부 시간 공유 (소셜 기능)

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Expo (React Native) + TypeScript |
| 상태 관리 | Zustand |
| 네비게이션 | React Navigation v6 |
| CV | expo-face-detector (Google ML Kit) |
| LLM | Anthropic Claude API (claude-haiku-4-5) |
| 스타일 | React Native StyleSheet (다크 테마) |
