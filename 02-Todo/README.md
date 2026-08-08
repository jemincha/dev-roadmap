# Todo List

HTML, CSS, JavaScript를 이용해 만든 간단한 Todo List 웹 애플리케이션입니다.

JavaScript의 DOM 조작부터 이벤트 처리, 데이터 관리, 브라우저 저장소까지 학습하는 것을 목적으로 제작했습니다.

## 기능

* Todo 추가
* Enter 키를 이용한 Todo 추가
* 빈 입력 방지
* Todo 완료 / 미완료 상태 변경
* Todo 삭제
* `localStorage`를 이용한 Todo 데이터 저장
* 페이지 새로고침 후 Todo 복원

## 사용 기술

* HTML
* CSS
* JavaScript
* Browser `localStorage`

## 주요 학습 내용

### DOM 조작

JavaScript를 이용해 HTML 요소를 동적으로 생성하고 화면에 추가하거나 삭제하는 방법을 학습했습니다.

```javascript
document.createElement()
appendChild()
remove()
```

### 이벤트 처리

사용자의 클릭과 키보드 입력에 따라 기능이 실행되도록 이벤트 리스너를 사용했습니다.

```javascript
addEventListener()
```

### 객체와 배열을 이용한 데이터 관리

Todo 하나를 객체로 표현하고, 여러 Todo를 배열로 관리했습니다.

```javascript
{
    id: 123456789,
    text: "JavaScript 공부",
    completed: false
}
```

### 데이터와 화면의 분리

Todo 데이터를 `todos` 배열에서 관리하고, 이를 바탕으로 DOM을 생성하는 구조로 리팩토링했습니다.

주요 함수의 역할을 분리했습니다.

* `addTodo()` — Todo 데이터 생성 및 추가
* `createTodoElement()` — Todo 데이터를 HTML 요소로 변환
* `renderTodos()` — Todo 배열을 화면에 렌더링
* `saveTodos()` — Todo 데이터를 localStorage에 저장
* `loadTodos()` — localStorage의 데이터를 불러오기

### localStorage

브라우저의 `localStorage`를 이용해 페이지를 새로고침해도 Todo 데이터가 유지되도록 구현했습니다.

저장할 때는 `JSON.stringify()`를 사용하고, 불러올 때는 `JSON.parse()`를 사용했습니다.

## 배운 점

처음에는 Todo를 생성할 때 DOM을 직접 조작하는 방식으로 구현했지만, 이후 Todo를 객체와 배열로 관리하도록 구조를 변경했습니다.

이를 통해 **데이터와 화면을 별도로 관리하고, 데이터의 상태를 기준으로 화면을 구성하는 방식**을 경험했습니다.

향후 React와 같은 프론트엔드 프레임워크를 학습할 때 이 경험을 기반으로 상태 관리와 렌더링의 개념을 확장할 예정입니다.
