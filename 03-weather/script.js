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

async function getWeather(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;

    const response = await fetch(url);

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    return data;
}

async function searchWeather() {
    const city = cityInput.value.trim();

    if (city === "") {
        showError("도시를 입력해주세요.");
        return;
    }

    weatherResult.innerHTML = "<p>날씨 정보를 가져오는 중...</p>";

    const data = await getWeather(city);

    if (data === null) {
        showError("도시를 찾을 수 없습니다.");
        return;
    }

    displayWeather(data);
}


function displayWeather(data) {
    const cityName = data.name;
    const temperature = data.main.temp;
    const weatherId = data.weather[0].id;
    const icon = data.weather[0].icon; 
    const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    const description = translateWeather(weatherId);
    const feelsLike = data.main.feels_like;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;

    weatherResult.innerHTML = `
        <h2>${cityName}</h2>
        <img src="${iconUrl}" alt="${description}">
        <p>${temperature}</p>
        <p>${description}</p>
        <p>체감온도: ${feelsLike}°C</p>
        <p>습도: ${humidity}%</p>
        <p>풍속: ${windSpeed} m/s</p>
    `;
}

function showError(message) {
    weatherResult.innerHTML = `<p>${message}</p>`;
}

function translateWeather(id) {
    if (id === 800) {
        return "맑음";
    }

    const category = Math.floor(id / 100);

    if (category === 2) {
        return "뇌우";
    }

    else if (category === 3) {
        return "이슬비";
    }

    else if (category === 5) {
        return "비";
    }

    else if (category === 6) {
        return "눈";
    }

    else if (category === 7) {
        return "안개";
    }

    else if (category === 8) {
        return "구름";
    }

    return "알 수 없음"
}