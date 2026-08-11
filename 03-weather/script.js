const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const weatherResult = document.getElementById("weather-result");

const API_KEY = "8041273c8f602214fb7f33eeb73caad3";

searchButton.addEventListener("click", searchWeather);

cityInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchWeather();
    }
});

async function searchWeather() {
    const city = cityInput.value.trim();

    if (city === "") {
        weatherResult.innerHTML = "<p>도시를 입력해주세요.</p>";
        return;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;

    
    weatherResult.innerHTML = "<p>날씨 정보를 가져오는 중...</p>";

    const response = await fetch(url);

    if (!response.ok) {
        weatherResult.innerHTML = "<p>도시를 찾을 수 없습니다.</p>";
        return;
    }

    const data = await response.json();

    const cityName = data.name;
    const temperature = data.main.temp;
    const description = data.weather[0].description;

    weatherResult.innerHTML = `
        <h2>${cityName}</h2>
        <p>${temperature}</p>
        <p>${description}</p>
    `;
}

