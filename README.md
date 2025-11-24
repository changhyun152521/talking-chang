# 창현이에게 하고싶은말

Firebase를 활용한 방명록 웹 애플리케이션입니다.

## 기능

- 방명록 작성, 수정, 삭제
- Firebase Authentication을 통한 로그인/회원가입
- 실시간 데이터 동기화 (Firebase Realtime Database)
- 관리자 페이지
- 반응형 디자인 (모바일/데스크톱)

## 기술 스택

- HTML5
- CSS3
- JavaScript (Vanilla)
- Firebase (Authentication, Realtime Database)

## 파일 구조

```
├── index.html      # 메인 페이지
├── admin.html      # 관리자 페이지
├── style.css       # 스타일시트
├── script.js       # 메인 JavaScript 로직
└── README.md       # 프로젝트 설명
```

## 사용 방법

1. Firebase 프로젝트 설정
   - Firebase 콘솔에서 프로젝트 생성
   - Authentication 활성화 (이메일/비밀번호)
   - Realtime Database 생성 및 규칙 설정

2. Firebase 설정
   - `index.html`의 Firebase 설정 정보를 본인의 프로젝트 정보로 변경

3. 로컬 실행
   - 웹 서버를 통해 `index.html` 실행

## 배포

GitHub Pages 또는 Firebase Hosting을 통해 배포할 수 있습니다.

