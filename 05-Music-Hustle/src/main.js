import { searchArtistsApi, getArtistAlbums, lookupArtistById, reportApiError } from "./api.js";
import {
    selectedArtists,
    selectedQuarter,
    isArtistSelected,
    addArtist,
    removeArtist as removeArtistFromState,
    findArtist,
    getDebutYear,
    updateGraphStartYear,
    setSelectedQuarter,
    clearSelectedQuarter
} from "./state.js";
import { groupAlbumsByQuarter } from "./utils.js";
import {
    renderArtistSearchResults,
    renderArtistGraphs,
    renderOnboardingPresets,
    renderHustleRanking,
    showDetailPanel,
    closeDetailPanel,
    renderAttributionFooter
} from "./render.js";

// ========================================
// DOM 참조
// ========================================

const artistSearchForm = document.getElementById("artist-search-form");
const artistInput = document.getElementById("artist-input");
const searchDropdown = document.getElementById("search-dropdown");
const artistGraphs = document.getElementById("artist-graphs");
const closeDetailButton = document.getElementById("close-detail-button");


// ========================================
// 에러 모니터링 (Sentry) — 선택 사항
// ========================================
//
// sentry.io에서 발급받은 DSN을 아래에 채워 넣고, index.html의 Sentry CDN
// <script> 주석을 해제하면 활성화된다. DSN이 비어 있으면 아무 것도 하지
// 않으므로 지금 상태로는 안전하게 무시된다.
const SENTRY_DSN = ""; // TODO: sentry.io DSN을 여기에 붙여넣으세요.

function initErrorMonitoring() {

    if (!SENTRY_DSN) {
        return;
    }

    if (typeof window.Sentry === "undefined") {
        console.warn("Sentry DSN은 설정됐지만 Sentry SDK가 로드되지 않았습니다. index.html의 CDN 스크립트 주석을 확인하세요.");
        return;
    }

    window.Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0 });
}


// ========================================
// 렌더 전체 갱신
// ========================================
//
// 아티스트 목록이 비어있는지에 따라 온보딩 화면과 실제 그래프 화면 중
// 무엇을 그릴지 결정하고, 랭킹 패널은 두 경우 모두 갱신한다.
function refreshUI() {

    if (selectedArtists.length === 0) {
        renderOnboardingPresets(addArtistByName);
    } else {
        renderArtistGraphs();
    }

    renderHustleRanking();

    syncStateToUrl();
}


// ========================================
// 검색
// ========================================

let searchTimer = null;
let isComposing = false;

// 검색 요청 하나하나에 순번을 매겨서, 늦게 도착한 오래된 응답이
// 이미 그려진 최신 결과를 덮어쓰지 않게 한다. (rate limit 큐 때문에
// 요청마다 지연 시간이 달라서 응답 순서가 역전될 수 있다.)
let searchRequestId = 0;

async function searchArtists() {

    const query = artistInput.value.trim();
    const requestId = ++searchRequestId;

    if (query === "") {
        searchDropdown.innerHTML = "";
        return;
    }

    try {

        const artists = await searchArtistsApi(query);

        if (requestId !== searchRequestId) {
            return; // 이미 낡은 응답
        }

        renderArtistSearchResults(artists, searchDropdown, selectArtist);

    } catch (error) {

        if (requestId !== searchRequestId) {
            return;
        }

        reportApiError("아티스트 검색", error);

        searchDropdown.innerHTML = `
            <p class="search-error">검색 결과를 가져오지 못했습니다.</p>
        `;
    }
}


artistSearchForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // 대기 중인 디바운스 타이머가 있으면 지워서 중복 요청을 막는다.
    clearTimeout(searchTimer);
    searchArtists();
});


artistInput.addEventListener("compositionstart", function() {
    isComposing = true;
});

artistInput.addEventListener("compositionend", function() {
    isComposing = false;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(searchArtists, 500);
});

artistInput.addEventListener("input", function() {

    // 한글 등 조합 중에 발생하는 input 이벤트는 무시한다.
    // (조합이 끝나면 compositionend 핸들러가 디바운스를 시작한다.)
    if (isComposing) {
        return;
    }

    clearTimeout(searchTimer);
    searchTimer = setTimeout(searchArtists, 500);
});


closeDetailButton.addEventListener("click", closeDetailPanel);


document.addEventListener("click", function(event) {

    if (!event.target.closest(".search-container")) {
        searchDropdown.innerHTML = "";
    }

    if (
        !event.target.closest(".detail-panel") &&
        !event.target.closest(".quarter-cell")
    ) {
        closeDetailPanel();
        clearSelectedQuarter();
    }
});


// ========================================
// 아티스트 선택 / 제거 / 재시도
// ========================================

async function selectArtist(artist) {

    if (isArtistSelected(artist.id)) {
        return;
    }

    artistInput.value = "";
    searchDropdown.innerHTML = "";

    const lifeSpanBegin = artist["life-span"]?.begin || null;

    // 데이터가 도착하기 전에도 카드가 바로 보이도록, 로딩 중 상태를
    // 먼저 추가하고 그린다.
    const artistData = {
        id: artist.id,
        name: artist.name,
        type: artist.type || null,
        country: artist.country || null,
        begin: lifeSpanBegin,
        debutYear: null,
        albums: [],
        loadFailed: false,
        isLoading: true
    };

    addArtist(artistData);
    refreshUI();

    let albums = [];
    let loadFailed = false;

    try {
        albums = await getArtistAlbums(artist.id);
    } catch (error) {
        reportApiError(`${artist.name} 앨범 조회`, error);
        loadFailed = true;
    }

    artistData.albums = albums;
    artistData.debutYear = loadFailed ? null : getDebutYear(artist, albums, lifeSpanBegin);
    artistData.loadFailed = loadFailed;
    artistData.isLoading = false;

    updateGraphStartYear();
    refreshUI();
}


// 검색 → 선택을 한 번에 묶은 헬퍼. 온보딩 프리셋 클릭 시 사용한다.
async function addArtistByName(name) {

    try {

        const results = await searchArtistsApi(name);

        if (results.length === 0) {
            return;
        }

        // 가장 관련도 높은 첫 번째 결과를 그대로 추가한다.
        await selectArtist(results[0]);

    } catch (error) {
        reportApiError(`프리셋(${name}) 추가`, error);
    }
}


async function retryArtistLoad(artistId) {

    const artist = findArtist(artistId);

    if (!artist) {
        return;
    }

    artist.isLoading = true;
    artist.loadFailed = false;
    refreshUI();

    try {

        const albums = await getArtistAlbums(artistId);
        artist.albums = albums;
        artist.debutYear = getDebutYear(artist, albums, artist.begin);
        artist.loadFailed = false;

    } catch (error) {

        reportApiError(`${artist.name} 앨범 재조회`, error);
        artist.loadFailed = true;
    }

    artist.isLoading = false;

    updateGraphStartYear();
    refreshUI();
}


function removeArtist(artistId) {

    const removed = removeArtistFromState(artistId);

    if (!removed) {
        return;
    }

    updateGraphStartYear();
    refreshUI();
    closeDetailPanel();
    clearSelectedQuarter();
}


// ========================================
// 분기 선택
// ========================================

function selectQuarter(artistId, year, quarter) {

    const artist = findArtist(artistId);

    if (!artist) {
        return;
    }

    const quarterKey = `${year}-Q${quarter}`;

    if (
        selectedQuarter &&
        selectedQuarter.artistId === artistId &&
        selectedQuarter.key === quarterKey
    ) {
        closeDetailPanel();
        clearSelectedQuarter();
        return;
    }

    setSelectedQuarter({ artistId, key: quarterKey, year, quarter });

    const groupedAlbums = groupAlbumsByQuarter(artist.albums);
    const albums = groupedAlbums[quarterKey] || [];

    showDetailPanel(artist, year, quarter, albums);
}


// 그래프 영역 이벤트 위임 (제거 / 재시도 / 분기 선택)
artistGraphs.addEventListener("click", function(event) {

    const removeButton = event.target.closest(".remove-artist-button");
    if (removeButton) {
        removeArtist(removeButton.dataset.artistId);
        return;
    }

    const retryButton = event.target.closest(".retry-artist-button");
    if (retryButton) {
        retryArtistLoad(retryButton.dataset.artistId);
        return;
    }

    const quarterCell = event.target.closest(".quarter-cell");
    if (quarterCell) {
        selectQuarter(
            quarterCell.dataset.artistId,
            Number(quarterCell.dataset.year),
            Number(quarterCell.dataset.quarter)
        );
    }
});


// ========================================
// URL 상태 공유
// ========================================
//
// 선택된 아티스트들의 MBID를 쿼리 파라미터에 반영해서, 링크를 공유하거나
// 새로고침해도 같은 비교 세트를 복원할 수 있게 한다.
function syncStateToUrl() {

    const ids = selectedArtists
        .filter(function(artist) { return !artist.isLoading; })
        .map(function(artist) { return artist.id; });

    const url = new URL(window.location.href);

    if (ids.length === 0) {
        url.searchParams.delete("artists");
    } else {
        url.searchParams.set("artists", ids.join(","));
    }

    window.history.replaceState(null, "", url);
}


async function restoreStateFromUrl() {

    const url = new URL(window.location.href);
    const idsParam = url.searchParams.get("artists");

    if (!idsParam) {
        return;
    }

    const ids = idsParam.split(",").filter(Boolean);

    // 여러 명을 순차적으로 복원한다. MusicBrainz rate limit이 있어
    // Promise.all로 동시에 쏘지 않고 한 명씩 처리한다.
    for (const id of ids) {

        if (isArtistSelected(id)) {
            continue;
        }

        try {

            const artist = await lookupArtistById(id);
            await selectArtist(artist);

        } catch (error) {

            reportApiError(`URL 복원 중 아티스트(${id}) 조회`, error);
        }
    }
}


// ========================================
// 초기화
// ========================================

initErrorMonitoring();
renderAttributionFooter();

restoreStateFromUrl().then(function() {
    refreshUI();
});