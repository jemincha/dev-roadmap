// ========================================
// DOM
// ========================================

const artistSearchForm = document.getElementById("artist-search-form");
const artistInput = document.getElementById("artist-input");
const searchDropdown = document.getElementById("search-dropdown");

const artistGraphs = document.getElementById("artist-graphs");

const detailPanel = document.getElementById("detail-panel");
const detailTitle = document.getElementById("detail-title");
const albumList = document.getElementById("album-list");
const closeDetailButton = document.getElementById("close-detail-button");


// ========================================
// MusicBrainz API 설정
// ========================================

const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";

const USER_AGENT = "WhoWorkedHardest/1.0 (jemin7707@gmail.com)";

// MusicBrainz는 IP 단위로 초당 요청 수를 제한한다.
// 검색 요청과 앨범 조회 요청이 섞여도 항상 이 간격을 지키도록
// 모든 요청을 fetchMusicBrainz() 하나로 통과시킨다.
const MIN_REQUEST_INTERVAL = 1000;
let lastRequestTime = 0;


// ========================================
// 상태
// ========================================

// 현재 추가된 아티스트
const selectedArtists = [];

// 현재 선택된 분기
let selectedQuarter = null;

// 검색 타이머
let searchTimer = null;

// 전체 그래프의 시작 연도
let graphStartYear = null;

// 현재 연도
const currentYear = new Date().getFullYear();


// ========================================
// 에러 처리
// ========================================

// MusicBrainz 요청이 실패했을 때 던지는 전용 에러 타입.
// fetch 자체가 실패한 네트워크 에러 등과 구분해서 다루기 위해 사용한다.
class MusicBrainzApiError extends Error {

    constructor(message, { status, url } = {}) {

        super(message);

        this.name = "MusicBrainzApiError";
        this.status = status;
        this.url = url;
    }
}


// 모든 API 에러가 거쳐가는 단일 지점.
// 지금은 콘솔에 일관된 형식으로 로깅만 하지만,
// 나중에 토스트/배너 등을 추가하고 싶으면 이 함수만 확장하면 된다.
function reportApiError(context, error) {

    console.error(`[MusicBrainz] ${context} 실패:`, error);
}


// ========================================
// MusicBrainz API
// ========================================

// MusicBrainz 요청 전용 fetch.
// - 요청 간격을 MIN_REQUEST_INTERVAL 이상으로 유지한다.
// - HTTP 에러(4xx/5xx)를 여기서 바로 MusicBrainzApiError로 변환해서 던진다.
//   (예전에는 각 호출부에서 response.ok를 따로 체크했는데,
//    getArtistAlbums()처럼 반복 호출하는 곳에서 매번 체크를 빠뜨리기 쉬워
//    한 곳으로 모았다.)
async function fetchMusicBrainz(url, context) {

    const elapsed =
        Date.now() - lastRequestTime;

    if (elapsed < MIN_REQUEST_INTERVAL) {

        await wait(MIN_REQUEST_INTERVAL - elapsed);

    }

    lastRequestTime = Date.now();

    const response = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT
        }
    });

    if (!response.ok) {

        throw new MusicBrainzApiError(
            `${context} 요청이 실패했습니다 (status: ${response.status})`,
            { status: response.status, url }
        );

    }

    return response;
}


// 아티스트 검색
async function searchArtists() {

    const query = artistInput.value.trim();

    if (query === "") {
        searchDropdown.innerHTML = "";
        return;
    }


    const url =
        `${MUSICBRAINZ_BASE_URL}/artist/` +
        `?query=${encodeURIComponent(query)}` +
        `&fmt=json` +
        `&limit=10`;


    try {

        const response =
            await fetchMusicBrainz(url, "아티스트 검색");


        const data = await response.json();

        renderArtistSearchResults(data.artists);


    } catch (error) {

        reportApiError("아티스트 검색", error);

        searchDropdown.innerHTML = `
            <p class="search-error">
                검색 결과를 가져오지 못했습니다.
            </p>
        `;
    }
}


// 아티스트의 앨범 / EP 조회
//
// 예전에는 이 함수 안에서 에러를 잡아 빈 배열([])을 반환했다.
// 그러면 "앨범이 실제로 0개인 경우"와 "요청이 실패한 경우"가
// 호출하는 쪽에서 구분되지 않아, 데뷔 연도가 조용히 currentYear로
// 잘못 계산되는 문제(IU 이슈)로 이어졌다.
// 그래서 여기서는 에러를 잡지 않고 그대로 던지고,
// 실패 여부 판단은 호출하는 selectArtist()/retryArtistLoad()에서 하도록 바꿨다.
async function getArtistAlbums(artistId) {

    const albums = [];
    const limit = 100;
    let offset = 0;
    let total = null;

    do {

        const url =
            `${MUSICBRAINZ_BASE_URL}/release-group/` +
            `?artist=${artistId}` +
            `&type=album|ep` +
            `&fmt=json` +
            `&limit=${limit}` +
            `&offset=${offset}`;


        const response =
            await fetchMusicBrainz(url, "앨범 정보 조회");


        const data =
            await response.json();


        albums.push(
            ...(data["release-groups"] || [])
        );


        total = data["release-group-count"];


        offset += limit;


    } while (offset < total);


    return albums;
}

function wait(milliseconds) {

    return new Promise(function(resolve) {

        setTimeout(resolve, milliseconds);

    });
}

// ========================================
// 검색 결과 UI
// ========================================

function renderArtistSearchResults(artists) {

    searchDropdown.innerHTML = "";


    if (artists.length === 0) {

        searchDropdown.innerHTML = `
            <p class="search-empty">
                검색 결과가 없습니다.
            </p>
        `;

        return;
    }


    artists.forEach(function(artist) {

        const result =
            document.createElement("button");


        result.type = "button";
        result.className = "search-result";


        const artistType =
            artist.type || "아티스트";


        const country =
            artist.country
                ? ` · ${artist.country}`
                : "";

        // 동명이인 아티스트를 구분할 수 있도록
        // MusicBrainz의 disambiguation 정보를 함께 보여준다.
        const disambiguation =
            artist.disambiguation
                ? ` · ${artist.disambiguation}`
                : "";


        result.innerHTML = `
            <strong>${artist.name}</strong>

            <span>
                ${artistType}${country}${disambiguation}
            </span>
        `;


        result.addEventListener("click", function(event) {

            // selectArtist()가 searchDropdown.innerHTML을 비우면서
            // 클릭된 버튼 자신이 DOM에서 분리되어 버린다.
            // 그 상태로 이벤트가 document까지 버블링되면
            // event.target.closest(...)가 전부 null을 반환해
            // 상세 패널이 의도치 않게 닫히는 문제가 있어
            // 여기서 버블링을 막는다.
            event.stopPropagation();

            selectArtist(artist);

        });


        searchDropdown.appendChild(result);
    });
}


// ========================================
// 아티스트 선택
// ========================================

async function selectArtist(artist) {

    // 이미 추가된 아티스트인지 확인
    const alreadySelected =
        selectedArtists.some(function(selectedArtist) {

            return selectedArtist.id === artist.id;

        });


    if (alreadySelected) {
        return;
    }


    // 검색창 초기화는 성공/실패와 무관하게 바로 진행한다.
    artistInput.value = "";
    searchDropdown.innerHTML = "";


    const lifeSpanBegin =
        artist["life-span"]?.begin || null;


    let albums = [];
    let loadFailed = false;

    try {

        albums = await getArtistAlbums(artist.id);

    } catch (error) {

        reportApiError(`${artist.name} 앨범 조회`, error);

        loadFailed = true;

    }


    // 로드에 실패한 경우 debutYear를 함부로 계산하지 않는다.
    // "앨범이 0개"와 "조회 자체가 실패"는 다른 상태이므로
    // debutYear를 null로 남겨 그래프 시작 연도 계산에서 제외한다.
    const debutYear =
        loadFailed
            ? null
            : getDebutYear(artist, albums, lifeSpanBegin);


    const artistData = {

        id: artist.id,

        name: artist.name,

        type: artist.type || null,

        country: artist.country || null,

        begin: lifeSpanBegin,

        debutYear: debutYear,

        albums: albums,

        loadFailed: loadFailed

    };

    selectedArtists.push(artistData);


    updateGraphStartYear();

    renderArtistGraphs();
}


// 앨범 조회에 실패한 아티스트를 다시 시도
async function retryArtistLoad(artistId) {

    const artist =
        selectedArtists.find(function(artist) {

            return artist.id === artistId;

        });


    if (!artist) {
        return;
    }


    try {

        const albums =
            await getArtistAlbums(artistId);

        artist.albums = albums;

        artist.debutYear =
            getDebutYear(artist, albums, artist.begin);

        artist.loadFailed = false;


    } catch (error) {

        reportApiError(`${artist.name} 앨범 재조회`, error);

        artist.loadFailed = true;

    }


    updateGraphStartYear();

    renderArtistGraphs();
}


// ========================================
// 아티스트 제거
// ========================================

function removeArtist(artistId) {

    const index =
        selectedArtists.findIndex(function(artist) {

            return artist.id === artistId;

        });


    if (index === -1) {
        return;
    }


    selectedArtists.splice(index, 1);


    updateGraphStartYear();

    renderArtistGraphs();

    closeDetailPanel();
}


// ========================================
// 그래프 시작 연도 계산
// ========================================

function updateGraphStartYear() {

    // 로드에 실패해 debutYear가 없는 아티스트는
    // 그래프 시작 연도 계산에서 제외한다.
    const artistsWithDebutYear =
        selectedArtists.filter(function(artist) {

            return artist.debutYear !== null;

        });


    if (artistsWithDebutYear.length === 0) {

        graphStartYear = null;

        return;
    }


    let earliestYear = currentYear;


    artistsWithDebutYear.forEach(function(artist) {

        if (artist.debutYear < earliestYear) {

            earliestYear = artist.debutYear;

        }

    });


    graphStartYear = earliestYear;
}


// 아티스트 데뷔 연도
//
// life-span.begin은 아티스트 타입에 따라 의미가 다르다.
//   - Group(밴드): 결성년도에 가까워 데뷔 연도의 근사치로 쓸 만하다.
//   - Person(솔로 아티스트): 생년월일이라 데뷔 연도와 무관하다.
//
// 따라서 가장 신뢰할 수 있는 기준은 "실제 발매된 앨범 중 가장 이른 연도"이며,
// 앨범 데이터가 하나도 없을 때만 life-span.begin을 보조로 사용한다.
// 그마저도 없으면 이 아티스트가 그래프 시작 연도 계산을 왜곡하지 않도록
// 현재 연도를 기본값으로 사용한다.
//
// 주의: 이 함수는 "앨범 조회 자체가 실패했는지"는 판단하지 않는다.
// 그건 selectArtist()/retryArtistLoad()에서 loadFailed로 별도 처리한다.
function getDebutYear(artist, albums, lifeSpanBegin) {

    const albumYears = albums
        .map(function(album) {
            return album["first-release-date"];
        })
        .filter(Boolean)
        .map(function(dateString) {
            return parseYearAndQuarter(dateString).year;
        });


    if (albumYears.length > 0) {

        return Math.min(...albumYears);

    }


    if (artist.type === "Group" && lifeSpanBegin) {

        return parseYearAndQuarter(lifeSpanBegin).year;

    }


    return currentYear;
}


// ========================================
// 날짜 파싱
// ========================================

// MusicBrainz의 날짜 문자열("1997-05-21", "1997-05", "1997")을
// new Date(...)로 파싱하면 UTC 자정으로 해석된 뒤
// getFullYear()/getMonth()는 로컬 타임존 기준으로 값을 뽑아오기 때문에
// 타임존에 따라 연도/분기가 하루이틀 차이로 밀리는 문제가 있다.
// Date 객체를 거치지 않고 문자열을 직접 파싱해 이 문제를 피한다.
function parseYearAndQuarter(dateString) {

    const [yearStr, monthStr] = dateString.split("-");

    const year = Number(yearStr);

    // 월 정보가 없는 경우(예: "1997") 일단 Q1로 취급한다.
    const month = monthStr ? Number(monthStr) : 1;

    const quarter = Math.floor((month - 1) / 3) + 1;

    return { year, quarter };
}


// ========================================
// 앨범 데이터 그룹화
// ========================================

function groupAlbumsByQuarter(albums) {

    const groupedAlbums = {};


    albums.forEach(function(album) {

        const releaseDate =
            album["first-release-date"];


        if (!releaseDate) {
            return;
        }


        const { year, quarter } =
            parseYearAndQuarter(releaseDate);


        const key =
            `${year}-Q${quarter}`;


        if (!groupedAlbums[key]) {

            groupedAlbums[key] = [];

        }


        groupedAlbums[key].push(album);
    });


    return groupedAlbums;
}


// ========================================
// 이벤트
// ========================================

artistSearchForm.addEventListener("submit", function(event) {
    event.preventDefault();

    searchArtists();
});


// 검색창 입력
artistInput.addEventListener("input", function() {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(function() {
        searchArtists();
    }, 500);

});


// 상세 패널 닫기
closeDetailButton.addEventListener("click", function() {
    closeDetailPanel();
});


// 문서 전체 클릭
document.addEventListener("click", function(event) {

    // 검색창 바깥을 클릭하면 검색 결과 닫기
    if (!event.target.closest(".search-container")) {
        searchDropdown.innerHTML = "";
    }

    // 상세 패널과 분기 셀 외부를 클릭하면 상세 패널 닫기
    if (
        !event.target.closest(".detail-panel") &&
        !event.target.closest(".quarter-cell")
    ) {
        closeDetailPanel();
    }
});


// 그래프 이벤트 위임
artistGraphs.addEventListener("click", function(event) {

    // 아티스트 제거
    const removeButton =
        event.target.closest(".remove-artist-button");

    if (removeButton) {

        const artistId =
            removeButton.dataset.artistId;

        removeArtist(artistId);

        return;
    }


    // 앨범 조회 재시도
    const retryButton =
        event.target.closest(".retry-artist-button");

    if (retryButton) {

        const artistId =
            retryButton.dataset.artistId;

        retryArtistLoad(artistId);

        return;
    }


    // 분기 선택
    const quarterCell =
        event.target.closest(".quarter-cell");

    if (quarterCell) {

        const artistId =
            quarterCell.dataset.artistId;

        const year =
            Number(quarterCell.dataset.year);

        const quarter =
            Number(quarterCell.dataset.quarter);

        selectQuarter(
            artistId,
            year,
            quarter
        );
    }
});


// ========================================
// 아티스트 그래프 전체 렌더링
// ========================================

function renderArtistGraphs() {

    artistGraphs.innerHTML = "";


    if (selectedArtists.length === 0) {

        artistGraphs.innerHTML = `
            <p class="empty-state">
                아티스트를 검색해서 추가해보세요.
            </p>
        `;

        return;
    }


    selectedArtists.forEach(function(artist) {

        const artistChart =
            createArtistChart(artist);


        artistGraphs.appendChild(artistChart);

    });
}


// ========================================
// 아티스트 그래프 생성
// ========================================

function createArtistChart(artist) {

    const article =
        document.createElement("article");


    article.className =
        "artist-chart";


    // 아티스트 헤더
    const artistHeader =
        document.createElement("header");


    artistHeader.className =
        "artist-header";


    artistHeader.innerHTML = `
        <div class="artist-info">

            <h2>${artist.name}</h2>

            ${
                artist.country
                    ? `<span>${artist.country}</span>`
                    : ""
            }

        </div>

        <button
            type="button"
            class="remove-artist-button"
            data-artist-id="${artist.id}"
        >
            ×
        </button>
    `;


    article.appendChild(artistHeader);


    // 앨범 조회에 실패한 경우 그래프 대신 에러 상태를 보여준다.
    if (artist.loadFailed) {

        const errorBox =
            document.createElement("div");


        errorBox.className =
            "artist-load-error";


        errorBox.innerHTML = `
            <p>앨범 정보를 가져오지 못했습니다.</p>

            <button
                type="button"
                class="retry-artist-button"
                data-artist-id="${artist.id}"
            >
                다시 시도
            </button>
        `;


        article.appendChild(errorBox);


        return article;
    }


    // Contribution Graph
    const groupedAlbums =
        groupAlbumsByQuarter(artist.albums);

    const graph =
        createContributionGraph(
            artist,
            groupedAlbums
        );


    article.appendChild(graph);


    return article;
}


// ========================================
// Contribution Graph 생성
// ========================================
//
// 연도를 좌우로, 각 연도 안의 4개 분기를 위아래로 배치하기 위해
// 셀을 flat하게 한 부모에 나열하지 않고
// "연도 하나 = year-column 하나" 단위로 감싼다.
//
//   .contribution-graph (가로 방향)
//    ├─ .year-column (1997)
//    │    ├─ .year-label
//    │    └─ .quarter-stack (세로 방향, Q1~Q4)
//    ├─ .year-column (1998)
//    └─ ...

function createContributionGraph(
    artist,
    groupedAlbums
) {

    const graph =
        document.createElement("div");


    graph.className =
        "contribution-graph";


    // 이 아티스트의 최대 분기 발매량
    const maxAlbums =
        getMaxAlbums(groupedAlbums);


    for (
        let year = graphStartYear;
        year <= currentYear;
        year++
    ) {

        const yearColumn =
            createYearColumn(
                artist,
                year,
                groupedAlbums,
                maxAlbums
            );


        graph.appendChild(yearColumn);

    }


    return graph;
}


function createYearColumn(
    artist,
    year,
    groupedAlbums,
    maxAlbums
) {

    const column =
        document.createElement("div");


    column.className =
        "year-column";


    const yearLabel =
        document.createElement("span");


    yearLabel.className =
        "year-label";


    yearLabel.textContent =
        year;


    const quarterStack =
        document.createElement("div");


    quarterStack.className =
        "quarter-stack";


    for (
        let quarter = 1;
        quarter <= 4;
        quarter++
    ) {

        // 데뷔 이전 구간은 발매량이 0이라서가 아니라
        // 애초에 활동 자체가 없었던 시기이므로
        // level-0과 구분되는 "빈 공간"으로 표시한다.
        const isBeforeDebut =
            year < artist.debutYear;


        const key =
            `${year}-Q${quarter}`;


        const albums =
            groupedAlbums[key] || [];


        const cell =
            createQuarterCell(
                artist,
                year,
                quarter,
                albums,
                maxAlbums,
                isBeforeDebut
            );


        quarterStack.appendChild(cell);

    }


    column.appendChild(yearLabel);

    column.appendChild(quarterStack);


    return column;
}


function getMaxAlbums(groupedAlbums) {

    const counts =
        Object.values(groupedAlbums)
            .map(function(albums) {

                return albums.length;

            });


    if (counts.length === 0) {
        return 0;
    }


    return Math.max(...counts);
}

// ========================================
// 분기 Cell 생성
// ========================================

function createQuarterCell(
    artist,
    year,
    quarter,
    albums,
    maxAlbums,
    isBeforeDebut
) {

    const cell =
        document.createElement("button");


    cell.type = "button";

    cell.className =
        "quarter-cell";


    // 데뷔 이전 구간은 빈 공간으로만 표시하고
    // 클릭해서 상세 정보를 열 수 없게 한다.
    if (isBeforeDebut) {

        cell.classList.add("no-data");

        cell.disabled = true;

        cell.title = `${year} Q${quarter} · 활동 이전`;

        return cell;
    }


    cell.dataset.artistId =
        artist.id;


    cell.dataset.year =
        year;


    cell.dataset.quarter =
        quarter;


    const albumCount =
        albums.length;


    const level =
        getContributionLevel(
            albumCount,
            maxAlbums
        );


    cell.classList.add(
        `level-${level}`
    );


    cell.title =
        `${year} Q${quarter} · ${albumCount}장`;


    return cell;
}

function getContributionLevel(
    albumCount,
    maxAlbums
) {

    if (albumCount === 0) {
        return 0;
    }


    if (maxAlbums === 0) {
        return 0;
    }


    const ratio =
        albumCount / maxAlbums;


    if (ratio <= 0.25) {
        return 1;
    }


    if (ratio <= 0.5) {
        return 2;
    }


    if (ratio <= 0.75) {
        return 3;
    }


    return 4;
}


// ========================================
// 분기 선택
// ========================================

function selectQuarter(
    artistId,
    year,
    quarter
) {

    const artist =
        selectedArtists.find(function(artist) {

            return artist.id === artistId;

        });


    if (!artist) {
        return;
    }


    const quarterKey =
        `${year}-Q${quarter}`;


    // 현재 열려 있는 같은 분기를
    // 다시 클릭하면 닫는다.
    if (
        selectedQuarter &&
        selectedQuarter.artistId === artistId &&
        selectedQuarter.key === quarterKey
    ) {

        closeDetailPanel();

        return;
    }


    selectedQuarter = {

        artistId: artistId,

        key: quarterKey,

        year: year,

        quarter: quarter

    };


    const groupedAlbums =
        groupAlbumsByQuarter(artist.albums);


    const albums =
        groupedAlbums[quarterKey] || [];


    showDetailPanel(
        artist,
        year,
        quarter,
        albums
    );
}


// ========================================
// 상세 패널
// ========================================

function showDetailPanel(
    artist,
    year,
    quarter,
    albums
) {

    detailPanel.classList.add("active");


    detailTitle.textContent =
        `${artist.name} · ${year} Q${quarter}`;


    albumList.innerHTML = "";


    if (albums.length === 0) {

        albumList.innerHTML = `
            <p class="detail-placeholder">
                이 기간에는 발매된 앨범이 없습니다.
            </p>
        `;

        return;
    }


    albums.forEach(function(album) {

        const albumCard =
            createAlbumCard(album);


        albumList.appendChild(albumCard);

    });
}


// 상세 패널 닫기
function closeDetailPanel() {

    detailPanel.classList.remove("active");


    selectedQuarter = null;


    detailTitle.textContent =
        "분기를 선택해주세요";


    albumList.innerHTML = `
        <p class="detail-placeholder">
            그래프의 분기를 클릭하면
            해당 기간에 발매된 앨범을 확인할 수 있습니다.
        </p>
    `;
}


// ========================================
// 앨범 카드
// ========================================

function createAlbumCard(album) {

    const card =
        document.createElement("article");


    card.className =
        "album-card";


    const releaseDate =
        album["first-release-date"];


    card.innerHTML = `

        <div class="album-info">

            <h3>${album.title}</h3>

            <p>
                ${releaseDate || "발매일 정보 없음"}
            </p>

            <p>
                ${getReleaseTypeLabel(album)}
            </p>

        </div>
    `;


    return card;
}


// MusicBrainz release-group type 표시
function getReleaseTypeLabel(album) {

    const primaryType =
        album["primary-type"];


    const secondaryTypes =
        album["secondary-types"] || [];


    if (primaryType === "Album") {

        return "Album";

    }


    if (primaryType === "EP") {

        return "EP";

    }


    if (secondaryTypes.length > 0) {

        return secondaryTypes.join(", ");

    }


    return "Release";
}