# Lacquer & Pearl — 나전칠기 : 전통 공예 장인

옻칠하고, 자개를 오려 붙이고, 갈아내어 나만의 나전칠기를 완성하는 힐링 공예 게임.
하나의 Next.js 코드로 **웹**과 **안드로이드(Google Play)** 를 함께 지원합니다.

## 게임 구성 (MVP)

- **의뢰 모드**: 손님의 주문(모양·옻칠 색·자개 문양/개수)을 받아 제작 → 일치도 + 솜씨로 등급(S~D)과 사례금·명성 획득
- **자유 디자인**: 원하는 대로 만들어 공방에 전시하거나 판매
- **제작 10단계**: 디자인 → 삼베 바르기 → 옻칠 → 건조(습도·온도 조절) → 자개 자르기(줄음질/끊음질/기계) → 아교 바르고 붙이기 → 유산지 다림질 → 종이 떼기 → 메움칠 → 갈아내기
- **나의 공방**: 작품 전시, 판매, 이미지 저장/공유, "실물 제작 관심" 등록 (수요 검증용)
- **재료 상점**: 판매금으로 백골·삼베·옻·아교·자개 구매 (인앱 결제 자리는 "준비 중"으로 표시)
- 효과음·배경음은 Web Audio로 합성(외부 음원 파일 없음), 진행 상황은 기기 로컬 저장

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
```

## 웹 배포

```bash
npm run build      # out/ 폴더에 정적 사이트 생성
npm run preview    # 로컬에서 out/ 확인
```

`out/` 폴더를 Vercel, Netlify, GitHub Pages, Firebase Hosting 등 아무 정적 호스팅에 올리면 됩니다.

## 안드로이드 (Capacitor)

필요: Android Studio (SDK + 내장 JDK)

```bash
npm run android        # 웹 빌드 후 android/ 프로젝트에 복사
npm run android:open   # Android Studio로 열어서 실행/디버그
npm run android:apk    # 디버그 APK → android/app/build/outputs/apk/debug/
```

터미널에서 gradle을 직접 실행할 때 Java를 찾지 못하면 Android Studio 내장 JDK를 지정하세요:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

### Google Play 콘솔 업로드

1. Android Studio → **Build › Generate Signed App Bundle** 에서 업로드 키(keystore)를 만들고 서명된 `.aab` 생성
   (keystore 파일과 비밀번호는 절대 잃어버리지 않게 보관하고 git에 올리지 마세요)
2. 업데이트마다 `android/app/build.gradle` 의 `versionCode` 를 1씩 올리고 `versionName` 갱신
3. Play 콘솔에서 앱 생성 → 내부 테스트 트랙에 `.aab` 업로드

## 아이콘

`public/logo.png` 의 엠블럼으로 웹 아이콘과 안드로이드 런처 아이콘/스플래시를 생성합니다.

```bash
npm run icons
```
