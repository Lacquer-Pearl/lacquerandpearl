# Lacquer & Pearl — Godot 4

웹(Next.js) 버전을 Godot 4.7 기준으로 이식한 포트입니다.  
타이틀 → 의뢰/자유 제작 → 10단계 크래프트 → 결과/상점/공방 루프가 동작합니다.

## 실행

1. [Godot 4.7+](https://godotengine.org/download) 설치 (이 Mac에는 Homebrew로 설치됨)
2. Godot에서 `godot/project.godot` 열기
3. F5 (Play)

CLI:

```bash
cd godot
godot --path . --editor
# 또는 바로 실행
godot --path .
```

## 포함 내용

- KO/EN 언어 전환, 저장(`user://lacquer_pearl_save.cfg`)
- 의뢰 게시판 / 자유 디자인 / 상점 / 공방 갤러리
- 제작 단계: 디자인 → 삼베 → 옻칠 → 건조 → 절단 → 붙이기 → 다림 → 떼기 → 메움 → 갈기
- 3D 작품 프리뷰 (SubViewport + Mesh)
- 결과 화면 설문 보상 (+100 엽전, 1회)
- Export presets: Web / Android / iOS

## 배포 메모

- **Web**: Export → Web → `export/web/index.html` (Godot Web export 템플릿 필요)
- **Android**: Android SDK + debug keystore 설정 후 APK/AAB
- **iOS**: macOS + Xcode + Apple 개발자 계정 필요

웹 Next.js 원본은 저장소 루트에 그대로 있습니다. Godot 포트는 `godot/` 폴더입니다.
