# Movie

TMDB API를 활용한 영화 검색 웹 애플리케이션

## 프로젝트 소개

영화 제목을 검색하면 TMDB(The Movie Database) API를 통해 영화 정보를 받아와 카드 형태로 보여주는 간단한 웹 애플리케이션입니다.

JavaScript를 이용한 API 연동, 비동기 데이터 처리, JSON 데이터 접근, DOM 조작, 예외 처리 및 UI 구성을 직접 구현하는 것을 목표로 제작했습니다.

## 주요 기능

- 영화 제목 검색
- 검색 버튼을 통한 검색
- Enter 키를 이용한 검색
- TMDB API 연동
- 검색 결과 영화 카드 출력
- 영화 포스터 표시
- 영화 제목 표시
- 개봉일 표시
- TMDB 평점 표시
- 10점 만점 평점을 5개의 별점으로 변환
- 포스터가 없는 영화에 대한 예외 처리
- 개봉일 및 평점 정보가 없는 경우 대체 문구 표시
- 검색 중 상태 표시
- 검색 결과가 없는 경우 오류 메시지 표시
- 반응형 Grid 기반 영화 카드 UI

## 사용 기술

- HTML5
- CSS3
- JavaScript
- TMDB API
- Git
- GitHub

## API 데이터 처리

TMDB 영화 검색 API를 통해 검색 결과를 JSON 형태로 받아옵니다.

```javascript
const response = await fetch(url);
const data = await response.json();
````

API 응답의 `results` 배열에서 영화 목록을 추출한 후 각 영화의 필요한 정보만 사용합니다.

```javascript
const movies = data.results;
```

주요 사용 데이터는 다음과 같습니다.

| 데이터            | 설명         |
| -------------- | ---------- |
| `title`        | 영화 제목      |
| `poster_path`  | 영화 포스터 경로  |
| `release_date` | 개봉일        |
| `vote_average` | TMDB 평균 평점 |

## 영화 카드 생성

검색 결과 배열을 순회하면서 각 영화에 대한 카드를 생성합니다.

```javascript
movies.forEach(function(movie) {
    const movieCard = createMovieCard(movie);
    movieResult.appendChild(movieCard);
});
```

영화 객체 하나를 카드로 변환하는 역할은 `createMovieCard()` 함수가 담당합니다.

## 예외 데이터 처리

API 응답에는 모든 데이터가 항상 존재하는 것은 아닙니다.

예를 들어 다음과 같은 데이터가 반환될 수 있습니다.

```javascript
{
    poster_path: null,
    release_date: "",
    vote_average: 0
}
```

이에 따라 다음과 같이 처리합니다.

* 포스터가 없는 경우 → `포스터 없음` 표시
* 개봉일이 없는 경우 → `개봉일 정보 없음` 표시
* 평점이 없는 경우 → `평점 정보 없음` 표시

이를 통해 API 데이터가 불완전하더라도 카드의 레이아웃이 깨지지 않도록 했습니다.

## 평점 별점 변환

TMDB의 평점은 10점 만점이므로 이를 5점 만점의 별점으로 변환합니다.

```javascript
function getStars(voteAverage) {
    const score = Math.round(voteAverage / 2);

    const filledStars = "⭐".repeat(score);
    const emptyStars = "☆".repeat(5 - score);

    return filledStars + emptyStars;
}
```

예를 들어:

```text
8.2 → ⭐⭐⭐⭐☆
6.5 → ⭐⭐⭐☆☆
4.2 → ⭐⭐☆☆☆
```

영화 카드에서는 변환된 별점과 실제 평점을 함께 표시합니다.

```text
⭐⭐⭐⭐☆ 8.2
```

## UI

영화 카드는 CSS Grid를 이용해 반응형으로 배치했습니다.

```css
#movie-result {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 25px;
}
```

화면 너비에 따라 카드의 개수가 자동으로 조정되며, 좁은 화면에서는 다음 줄로 넘어갑니다.

포스터는 일정한 비율을 유지하도록 설정했습니다.

```css
#movie-result img {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
}
```

영화 제목은 별도의 영역으로 강조하고, 개봉일과 평점은 보조 정보로 배치했습니다.

## Git / API Key 관리

개발 과정에서 실제 TMDB API Key를 소스 코드에 포함한 상태로 Git에 커밋하는 실수가 있었습니다.

노출된 API Key는 폐기하고 새로운 키를 발급했습니다.

이후 로컬 커밋을 정리하고 실제 API Key가 포함되지 않은 상태로 다시 커밋하여 원격 저장소와 동기화했습니다.

이 과정을 통해 다음 Git 명령어를 실제 상황에서 경험했습니다.

```bash
git reset HEAD~1
git commit --amend --no-edit
git pull --rebase origin main
git push origin main
```

API Key와 같은 민감한 정보는 Git 저장소에 직접 포함하지 않는 것이 중요하다는 점을 확인했습니다.

향후 리팩토링 과정에서 API Key 관리 방식도 개선할 예정입니다.

## 배운 점

### 1. API 응답 구조 확인

API를 연결한 후 바로 데이터를 사용하기보다 `console.log(data)`를 통해 실제 응답 구조를 확인하고 필요한 데이터를 추출하는 과정을 경험했습니다.

### 2. 비동기 처리

`fetch()`와 `async / await`를 사용하여 API 요청과 응답 처리 과정을 구현했습니다.

### 3. 배열과 객체 데이터 처리

API에서 반환된 배열을 순회하면서 각각의 객체에서 필요한 속성을 추출하는 방법을 익혔습니다.

### 4. DOM 조작

JavaScript를 이용해 영화 카드를 생성하고 HTML 요소를 동적으로 추가하는 과정을 구현했습니다.

### 5. 함수의 역할 분리

API 요청, 영화 카드 생성, 별점 변환 등의 기능을 별도의 함수로 분리하여 코드의 역할을 나누는 방법을 익혔습니다.

### 6. 예외 상황 처리

포스터, 개봉일, 평점 등이 없는 경우를 직접 확인하고 대체 UI를 제공하는 방법을 경험했습니다.

### 7. Git 활용

커밋, reset, amend, rebase, push 등을 실제 개발 과정에서 사용하면서 Git의 기본적인 작업 흐름과 커밋 관리 방법을 익혔습니다.

## 향후 개선 예정

* JavaScript 코드 추가 리팩토링
* 함수별 책임 명확화
* API Key 관리 방식 개선
* 검색 결과 개수 표시
* 영화 상세 정보 기능
* 검색 결과 정렬 및 필터
* 페이지네이션
* UI 세부 디자인 개선
* 추가적인 예외 상황 테스트

## 프로젝트 상태

현재 기본적인 영화 검색 및 카드 출력 기능과 UI 개선을 완료했습니다.

다음 단계에서는 코드 리팩토링과 테스트를 진행한 후 프로젝트를 최종적으로 정리할 예정입니다.
