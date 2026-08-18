const movieInput = document.getElementById("movie-input");
const searchButton = document.getElementById("search-button");
const movieResult = document.getElementById("movie-result");

const API_KEY = "YOUR_API_KEY";

searchButton.addEventListener("click", searchMovies);

movieInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchMovies();
    }
});

async function searchMovies() {
    const query = movieInput.value.trim();

    if (query === "") {
        showMessage("영화 제목을 입력해주세요.");
        return;
    }

    showMessage("검색 중...");

    const data = await getMovies(query);

    if (data === null) {
        showMessage("영화 정보를 가져오지 못했습니다.");
        return;
    }

    const movies = data.results;
    displayMovies(movies);
}

function showMessage(message) {
    movieResult.innerHTML = `<p>${message}</p>`;
}

function displayMovies(movies) {
    movieResult.innerHTML = "";

    if (movies.length === 0) {
        showMessage("검색 결과가 없습니다.");
        return;
    }

    movies.forEach(function(movie) {
        const movieCard = createMovieCard(movie);
        movieResult.appendChild(movieCard);
    });
}

async function getMovies(query) {
    try{
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=ko-KR`;
    
        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        return data;
    } catch (error) {
        return null;
    }
}

function createMovieCard(movie) {
    const movieCard = document.createElement("div");
    
    const posterHtml = getPosterHtml(movie);

    const stars = getStars(movie.vote_average);

    movieCard.innerHTML = `
        ${posterHtml}
        <h2>${movie.title}</h2>    
        <p>📅${movie.release_date || "개봉일 정보 없음"}</p>
        <p>${stars} ${movie.vote_average > 0 ? movie.vote_average : "평점 정보 없음"}</p>
    `;

    movieCard.addEventListener("click", function() {
    const url = `https://www.themoviedb.org/movie/${movie.id}`;
    window.open(url, "_blank");
});

    return movieCard;
}

function getPosterHtml(movie) {
    if (movie.poster_path) {
        return `
            <img 
            src= "https://image.tmdb.org/t/p/w500${movie.poster_path}" 
            alt= "${movie.title}}">
        

        `;
    }

    return `
        <div class="no-poster">포스터 없음</div>
    `
}


function getStars(voteAverage) {
    const score = Math.round(voteAverage / 2);

    const filledStars = "⭐".repeat(score);
    const emptyStars = "☆".repeat(5 - score);

    return filledStars + emptyStars;
}

