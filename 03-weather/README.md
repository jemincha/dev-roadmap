# Weather App

OpenWeatherMap API를 활용한 날씨 검색 웹 애플리케이션입니다.

## Features

- 도시 이름으로 날씨 검색
- Enter 키를 이용한 검색
- OpenWeatherMap API 연동
- 현재 기온 표시
- 체감온도 표시
- 습도 표시
- 풍속 표시
- 날씨 상태 한국어 표시
- 날씨 상태에 따른 아이콘 표시
- 도시 입력 및 검색 오류 처리
- API 요청 중 로딩 메시지 표시
- 반응형 UI

## Refactoring

기능별로 코드를 분리하여 관리했습니다.

- `getWeather()` : API 요청 및 데이터 반환
- `searchWeather()` : 사용자 입력 처리 및 전체 검색 흐름 관리
- `displayWeather()` : 날씨 데이터를 화면에 표시
- `showError()` : 오류 메시지 표시
- `translateWeather()` : OpenWeatherMap의 weather ID를 한국어 날씨 상태로 변환

## Tech Stack

- HTML
- CSS
- JavaScript
- OpenWeatherMap API