const movieInput = document.getElementById("movie-input");
const searchButton = document.getElementById("search-button");
const movieResult = document.getElementById("movie-result");

const API_KEY = "d5f1e3ade2ee82bda60fcf040d4cdbc5";

searchButton.addEventListener("click", searchMovies);

movieInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchMovies();
    }
});

async function searchMovies() {
    const query = movieInput.value.trim();

    if (query === "") {
        movieResult.innerHTML = "<p>영화 제목을 입력해주세요.</p>";
        return;
    }

    movieResult.innerHTML = "<p>검색 중...</p>";

    const data = await getMovies(query);

    if (data === null) {
        movieResult.innerHTML = "<p>영화 정보를 가져오지 못했습니다.</p>";
        return;
    }

    const movies = data.results;
    movieResult.innerHTML = "";

    if (movies.length === 0) {
        movieResult.innerHTML = "<p>검색 결과가 없습니다.</p>";
        return;
    }

    movies.forEach(function(movie) {
        const movieCard = createMovieCard(movie);
        movieResult.appendChild(movieCard);
    });
}

async function getMovies(query) {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=ko-KR`;
    
    const response = await fetch(url);

    console.log(response);

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    return data;
}

function createMovieCard(movie) {
    const movieCard = document.createElement("div");
    
    const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

    movieCard.innerHTML = `
        <h2>${movie.title}</h2>
        <img src= "${posterUrl} alt= "${movie.title}}">    
        <p>${movie.release_date}</p>
        <p>평점: ${movie.vote_average}</p>
    `;

    return movieCard;
}