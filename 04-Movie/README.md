# Movie Search 

TMDB API를 활용해 영화 제목을 검색하고 검색 결과를 카드 형태로 보여주는 웹 애플리케이션입니다.

JavaScript의 비동기 처리와 외부 API 활용을 학습하고, API에서 받은 데이터를 DOM으로 가공하여 화면에 출력하는 과정을 경험하는 것을 목표로 제작했습니다.

---

## 주요 기능

- 영화 제목 검색
- 검색 버튼 및 Enter 키를 통한 검색
- TMDB API를 이용한 영화 데이터 조회
- 영화 포스터 출력
- 포스터가 없는 경우 대체 화면 출력
- 영화 제목, 개봉일, 평점 표시
- 평점을 5개의 별로 시각화
- 검색 결과가 없는 경우 안내 메시지 출력
- API 요청 실패 및 네트워크 오류 처리
- 영화 카드 클릭 시 TMDB 영화 상세 페이지를 새 탭에서 열기
- 반응형 영화 카드 그리드
- 영화 카드 hover 효과

---

## 사용 기술

- HTML
- CSS
- JavaScript
- TMDB API
- Fetch API
- async / await
- DOM

---

## 학습한 핵심 개념

### 1. Fetch API

외부 API에 HTTP 요청을 보내 영화 데이터를 가져왔습니다.

```javascript
const response = await fetch(url);
```

### 2. async / await

API 요청과 같은 비동기 작업을 동기 코드와 비슷한 형태로 작성했습니다.

```javascript
async function getMovies(query) {
    const response = await fetch(url);
    const data = await response.json();

    return data;
}
```

### 3. 예외 처리

HTTP 응답 자체가 실패하는 경우와 네트워크 오류 등으로 `fetch()` 자체가 실패하는 경우를 처리했습니다.

```javascript
try {
    const response = await fetch(url);

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    return data;
} catch (error) {
    return null;
}
```

### 4. 배열 데이터 처리

API에서 반환된 영화 배열을 `forEach()`로 순회하며 각각의 영화 카드를 생성했습니다.

```javascript
movies.forEach(function(movie) {
    const movieCard = createMovieCard(movie);
    movieResult.appendChild(movieCard);
});
```

### 5. DOM 조작

JavaScript를 이용해 영화 카드를 동적으로 생성하고 HTML에 추가했습니다.

```javascript
const movieCard = document.createElement("div");
movieCard.innerHTML = `...`;
movieResult.appendChild(movieCard);
```

### 6. 함수의 역할 분리

검색 전체 흐름을 담당하는 함수와 API 요청, 영화 카드 생성, 포스터 처리, 별점 계산 등의 세부 작업을 분리했습니다.

```text
searchMovies()
 ├─ getMovies()
 └─ displayMovies()
      └─ createMovieCard()
           ├─ getPosterHtml()
           └─ getStars()
```

각 함수가 하나의 명확한 역할을 담당하도록 리팩토링했습니다.

### 7. 데이터 상태 구분

검색 결과가 없는 경우와 API 요청 자체가 실패한 경우를 구분했습니다.

```text
API 요청 성공
    ↓
results.length === 0
    ↓
"검색 결과가 없습니다."

API 요청 실패
    ↓
null
    ↓
"영화 정보를 가져오지 못했습니다."
```

이를 통해 **빈 데이터와 요청 실패는 서로 다른 상태**라는 것을 확인했습니다.

### 8. 이벤트 처리

검색 버튼 클릭과 Enter 키 입력을 통해 동일한 검색 함수를 실행하도록 구현했습니다.

또한 영화 카드를 클릭하면 해당 영화의 TMDB 상세 페이지가 새 탭에서 열리도록 구현했습니다.

```javascript
movieCard.addEventListener("click", function() {
    const url = `https://www.themoviedb.org/movie/${movie.id}`;
    window.open(url, "_blank");
});
```

### 9. 데이터 가공

TMDB에서 받은 평점 데이터를 5개의 별로 변환했습니다.

```javascript
function getStars(voteAverage) {
    const score = Math.round(voteAverage / 2);

    const filledStars = "⭐".repeat(score);
    const emptyStars = "☆".repeat(5 - score);

    return filledStars + emptyStars;
}
```

---

## 오류 및 문제 해결

### `Assignment to constant variable`

영화 데이터를 저장하는 과정에서 `const`로 선언한 변수를 다시 할당하여 발생한 오류를 해결했습니다.

이를 통해 `const`와 `let`의 차이를 실제 코드에서 확인했습니다.

### 검색 중 메시지가 사라지지 않는 문제

검색 시작 시:

```javascript
movieResult.innerHTML = "<p>검색 중...</p>";
```

를 출력한 뒤 검색 결과를 표시하는 과정에서 기존 HTML을 초기화하지 않아 발생했습니다.

검색 결과를 표시하기 전에:

```javascript
movieResult.innerHTML = "";
```

를 실행하여 해결했습니다.

### 포스터가 없는 영화 처리

TMDB의 `poster_path`가 `null`인 영화도 존재하기 때문에 조건문을 사용하여 대체 화면을 표시했습니다.

```text
포스터 존재 → 포스터 출력
포스터 없음 → "포스터 없음" 출력
```

### API Key GitHub 노출

개발 과정에서 API Key를 코드에 직접 작성한 상태로 Git에 커밋하는 실수가 있었습니다.

이후 기존 API Key를 폐기하고 새 Key를 발급했으며, 커밋 전 실제 Key가 코드와 Git diff에 포함되지 않았는지 확인하는 과정을 추가했습니다.

> API Key는 GitHub에 공개 저장소로 올리지 않도록 주의해야 합니다.

---

## 프로젝트를 통해 배운 것

이번 프로젝트에서는 단순히 API를 호출하는 것에서 끝나지 않고,

**사용자 입력 → API 요청 → 비동기 응답 → 데이터 가공 → DOM 생성 → 사용자 인터랙션**

이라는 실제 웹 애플리케이션의 기본적인 흐름을 경험했습니다.

특히 이전 프로젝트보다 코드의 규모가 커지면서 함수별 역할을 구분하고, 오류 상황을 고려하여 프로그램의 흐름을 설계하는 경험을 할 수 있었습니다.

또한 리팩토링 과정에서 **모든 코드를 무조건 별도의 함수로 분리하는 것이 좋은 것은 아니라는 점**도 확인했습니다.

함수 분리는 코드가 실제로 더 읽기 쉬워지고 특정 책임을 독립적으로 관리할 필요가 있을 때 적용하는 것을 기준으로 삼았습니다.

---

## 다음 단계

이번 프로젝트를 마지막으로 기본 JavaScript 프로젝트 단계에서 외부 API 활용까지 경험했습니다.

다음 프로젝트부터는 단순한 예제 프로젝트를 따라 만드는 방식에서 벗어나, 직접 아이디어를 선정하고 서비스를 기획한 뒤 필요한 기술을 하나씩 학습하는 방식으로 프로젝트를 진행할 예정입니다.

```