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

// 현재 분기(1~4).
// totalQuarters를 계산할 때 아직 오지 않은 미래 분기까지
// "활동 가능 분기"로 잘못 세지 않기 위해 사용한다.
const currentQuarter =
    Math.floor(new Date().getMonth() / 3) + 1;


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

        // type에 single을 추가해 싱글 발매까지 포함한다.
        // (album|ep만 쓰면 싱글 중심으로 활동하는 아티스트가
        //  구조적으로 항상 활동이 적어 보이는 문제가 있었다.)
        //
        // 평점(inc=ratings)은 실제로 붙여서 테스트해본 결과
        // MusicBrainz 자체의 평점 데이터가 대부분의 아티스트에게
        // 거의 채워져 있지 않아(특히 최근 데뷔 아티스트) 지금 단계의
        // 지표로 쓰기엔 신뢰도가 너무 낮아 제외했다.
        // 나중에 다시 시도하려면 이 URL에 `&inc=ratings`를 추가하고
        // analyzeArtist()에 quality 필드를 다시 계산하면 된다.
        const url =
            `${MUSICBRAINZ_BASE_URL}/release-group/` +
            `?artist=${artistId}` +
            `&type=album|ep|single` +
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
// 데이터 분석 (Hustle Score - Phase 5-1)
// ========================================
//
// 아티스트 한 명의 활동 데이터를 분석한다.
//
// 원래는 Output(발매 밀도) 옆에 Quality(평점)도 별개 지표로
// 두려고 했으나, 실제로 MusicBrainz 평점을 붙여서 테스트해보니
// 대부분의 아티스트(특히 최근 데뷔)에게 평점 데이터 자체가
// 거의 없어 지표로 쓰기엔 신뢰도가 너무 낮았다. 그래서 MVP에서는
// "얼마나 좋은 작품을 냈는가"는 다루지 않고 "얼마나 열심히,
// 꾸준히 냈는가"에만 집중한다. 평점 데이터를 나중에 다른 소스
// (예: Spotify)로 보강하게 되면 quality 필드를 다시 추가하면 된다.
//
// totalQuarters는 전체 그래프의 공유 시간축(graphStartYear)이 아니라
// 아티스트 자신의 활동 기간(debutYear ~ 현재)만 기준으로 삼는다.
// 공유 시간축을 쓰면 늦게 데뷔한 아티스트는 활동하지도 않은
// no-data 구간까지 분모에 끼어들어 불리해지기 때문이다.

// 트랙 수 데이터를 API에서 가져올 수 없는 현재 범위에서는,
// 발매 형식(Album > EP > Single)을 "작업 규모"의 근사치로 사용해
// 가중치를 둔다. 나중에 트랙 수 같은 더 정확한 데이터를 확보하면
// 이 가중치를 그 값으로 교체하면 된다.
const RELEASE_TYPE_WEIGHT = {
    Album: 3,
    EP: 2,
    Single: 1
};

const DEFAULT_RELEASE_WEIGHT = 1;

function getReleaseWeight(album) {

    const primaryType = album["primary-type"];

    return RELEASE_TYPE_WEIGHT[primaryType] ?? DEFAULT_RELEASE_WEIGHT;
}


function analyzeArtist(artist) {

    // 아직 오지 않은 미래 분기는 "활동 가능 분기"에서 제외한다.
    const totalQuarters =
        (currentYear - artist.debutYear) * 4 + currentQuarter;


    const groupedAlbums =
        groupAlbumsByQuarter(artist.albums);

    const activeQuarters =
        Object.keys(groupedAlbums).length;

    const totalAlbums =
        artist.albums.length;

    // 앨범/EP/싱글 개수를 그대로 더하지 않고
    // getReleaseWeight()로 가중치를 매겨서 합산한다.
    const weightedTotal =
        artist.albums.reduce(function(sum, album) {

            return sum + getReleaseWeight(album);

        }, 0);


    const consistency =
        totalQuarters > 0
            ? activeQuarters / totalQuarters
            : 0;

    // Output: 활동 기간 대비 "가중 발매 밀도".
    // (단순 발매 건수가 아니라 Album/EP/Single 가중치를 반영한 값)
    const output =
        totalQuarters > 0
            ? weightedTotal / totalQuarters
            : 0;


    return {
        totalAlbums,
        weightedTotal,
        activeQuarters,
        totalQuarters,
        consistency,
        output
    };
}


// ========================================
// 아티스트 비교 (Hustle Score - Phase 5-2)
// ========================================
//
// Hustle Score = 가중 발매 밀도(output) × 꾸준함(consistency)
//
// 이 값 자체는 아주 작은 소수(예: 0.05)라 그대로는 비교하기 어렵다.
// 그래서 "지금 비교 중인 아티스트들 중 최고값"을 100으로 놓고
// 상대적으로 정규화한다.
//
// 주의: 이 점수는 절대적인 척도가 아니라
// "현재 선택된 아티스트들 사이의 상대 비교" 값이다.
// 비교 대상 아티스트가 추가/제거되면 다른 아티스트의 점수도 바뀐다.
function compareArtists(artists) {

    const analyzableArtists =
        artists.filter(function(artist) {

            return !artist.loadFailed;

        });


    if (analyzableArtists.length === 0) {
        return [];
    }


    const withRawScore =
        analyzableArtists.map(function(artist) {

            const analysis = analyzeArtist(artist);

            const rawScore =
                analysis.output * analysis.consistency;

            return {
                id: artist.id,
                name: artist.name,
                totalAlbums: analysis.totalAlbums,
                weightedTotal: analysis.weightedTotal,
                activeQuarters: analysis.activeQuarters,
                totalQuarters: analysis.totalQuarters,
                consistency: analysis.consistency,
                output: analysis.output,
                rawScore: rawScore
            };

        });


    const maxRawScore =
        Math.max(
            ...withRawScore.map(function(entry) {
                return entry.rawScore;
            })
        );


    const results =
        withRawScore.map(function(entry) {

            const hustleScore =
                maxRawScore > 0
                    ? Math.round((entry.rawScore / maxRawScore) * 100)
                    : 0;

            return {
                ...entry,
                hustleScore
            };

        });


    // Hustle Score 내림차순 정렬
    results.sort(function(a, b) {

        return b.hustleScore - a.hustleScore;

    });


    return results;
}


// 지금은 비교 UI(Phase 5-3) 이전 단계라,
// 실제 데이터가 말이 되는지 콘솔에서 바로 확인할 수 있도록
// 아티스트 목록이 바뀔 때마다 순위표로 찍어준다.
function logHustleAnalysis() {

    const ranking =
        compareArtists(selectedArtists);

    if (ranking.length === 0) {
        return;
    }


    const rows =
        ranking.map(function(entry, index) {

            return {
                "순위": index + 1,
                "아티스트": entry.name,
                "Hustle Score": entry.hustleScore,
                "가중 발매 점수": entry.weightedTotal,
                "총 발매(앨범/EP/싱글)": entry.totalAlbums,
                "활동 분기": `${entry.activeQuarters} / ${entry.totalQuarters}`,
                "Consistency": entry.consistency.toFixed(2),
                "Output(가중 밀도)": entry.output.toFixed(3)
            };

        });


    console.table(rows);
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


    // Phase 5-1: 아직 비교 UI는 없지만,
    // 분석 함수가 만들어내는 실제 데이터를 바로 확인할 수 있도록
    // 렌더링할 때마다 콘솔에 표로 출력한다.
    logHustleAnalysis();
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


    if (primaryType === "Single") {

        return "Single";

    }


    if (secondaryTypes.length > 0) {

        return secondaryTypes.join(", ");

    }


    return "Release";
}