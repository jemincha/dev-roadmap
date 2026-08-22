// ========================================
// MusicBrainz / Cover Art Archive API
// ========================================

const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const USER_AGENT = "WhoWorkedHardest/1.0 (jemin7707@gmail.com)";

const COVER_ART_ARCHIVE_BASE_URL = "https://coverartarchive.org";

// MusicBrainz는 IP 단위로 초당 요청 수를 제한한다.
// 검색/앨범 조회/재조회 등 모든 요청이 이 큐를 거치게 해서
// 요청 간격을 항상 MIN_REQUEST_INTERVAL 이상으로 유지한다.
const MIN_REQUEST_INTERVAL = 1000;
let lastRequestTime = 0;

// 앨범 데이터 로컬 캐시. 24시간 동안은 재요청하지 않는다.
const ALBUM_CACHE_PREFIX = "hustle:albums:";
const ALBUM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;


// MusicBrainz 요청이 실패했을 때 던지는 전용 에러 타입.
export class MusicBrainzApiError extends Error {

    constructor(message, { status, url } = {}) {

        super(message);

        this.name = "MusicBrainzApiError";
        this.status = status;
        this.url = url;
    }
}


// 모든 API 에러가 거쳐가는 단일 지점.
// window.Sentry가 로드되어 있으면(= index.html에서 CDN 스크립트를 활성화하고
// DSN을 설정한 경우) 에러를 함께 전송한다. 없으면 콘솔 로깅만 한다.
export function reportApiError(context, error) {

    console.error(`[MusicBrainz] ${context} 실패:`, error);

    if (typeof window !== "undefined" && window.Sentry) {

        window.Sentry.captureException(error, {
            tags: { context }
        });

    }
}


async function fetchMusicBrainz(url, context) {

    const elapsed =
        Date.now() - lastRequestTime;

    if (elapsed < MIN_REQUEST_INTERVAL) {
        await new Promise(function(resolve) {
            setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed);
        });
    }

    lastRequestTime = Date.now();

    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT }
    });

    if (!response.ok) {

        throw new MusicBrainzApiError(
            `${context} 요청이 실패했습니다 (status: ${response.status})`,
            { status: response.status, url }
        );

    }

    return response;
}


export async function searchArtistsApi(query) {

    const url =
        `${MUSICBRAINZ_BASE_URL}/artist/` +
        `?query=${encodeURIComponent(query)}` +
        `&fmt=json&limit=10`;

    const response =
        await fetchMusicBrainz(url, "아티스트 검색");

    const data = await response.json();

    return data.artists || [];
}


// URL 상태 공유(?artists=id1,id2) 복원 시, MBID만 갖고 있으니
// 아티스트 메타데이터(이름/타입/국가/life-span)를 다시 조회해야 한다.
export async function lookupArtistById(artistId) {

    const url =
        `${MUSICBRAINZ_BASE_URL}/artist/${artistId}?fmt=json`;

    const response =
        await fetchMusicBrainz(url, "아티스트 상세 조회");

    return response.json();
}


function getCachedAlbums(artistId) {

    try {

        const raw =
            localStorage.getItem(ALBUM_CACHE_PREFIX + artistId);

        if (!raw) {
            return null;
        }

        const cached = JSON.parse(raw);

        if (
            !cached ||
            typeof cached.timestamp !== "number" ||
            !Array.isArray(cached.albums)
        ) {
            return null;
        }

        if (Date.now() - cached.timestamp > ALBUM_CACHE_TTL_MS) {
            localStorage.removeItem(ALBUM_CACHE_PREFIX + artistId);
            return null;
        }

        return cached.albums;

    } catch (error) {

        // 캐시는 최적화일 뿐이므로 읽기 실패는 조용히 "캐시 없음"으로 처리한다.
        return null;
    }
}


function setCachedAlbums(artistId, albums) {

    try {

        localStorage.setItem(
            ALBUM_CACHE_PREFIX + artistId,
            JSON.stringify({ timestamp: Date.now(), albums })
        );

    } catch (error) {
        // 저장 공간 초과 등은 기능에 지장이 없으므로 무시한다.
    }
}


// 예전에는 이 함수 안에서 에러를 잡아 빈 배열([])을 반환했었는데,
// 그러면 "앨범이 0개"와 "조회 자체가 실패"가 호출부에서 구분이 안 돼서
// 데뷔 연도가 조용히 currentYear로 잘못 계산되는 문제(IU 이슈)로 이어졌다.
// 그래서 에러는 여기서 잡지 않고 그대로 던지고, 판단은 호출부에서 한다.
export async function getArtistAlbums(artistId) {

    const cachedAlbums = getCachedAlbums(artistId);

    if (cachedAlbums) {
        return cachedAlbums;
    }

    const albums = [];
    const limit = 100;
    let offset = 0;
    let total = null;

    do {

        // type에 single을 포함해 싱글 중심 아티스트가 부당하게
        // 저평가되지 않게 한다. secondary-types도 여기서 같이 딸려온다
        // (score.js의 가중치 계산에 사용).
        const url =
            `${MUSICBRAINZ_BASE_URL}/release-group/` +
            `?artist=${artistId}` +
            `&type=album|ep|single` +
            `&fmt=json&limit=${limit}&offset=${offset}`;

        const response =
            await fetchMusicBrainz(url, "앨범 정보 조회");

        const data = await response.json();

        albums.push(...(data["release-groups"] || []));

        total = data["release-group-count"];

        offset += limit;

    } while (offset < total);

    setCachedAlbums(artistId, albums);

    return albums;
}


// 커버 아트가 없는 release-group도 많으므로(전체 커버리지가 100%가 아니다)
// 404는 에러가 아니라 "커버 아트 없음"이라는 정상 상황으로 취급한다.
// Cover Art Archive는 MusicBrainz와 별개 호스트라 rate limit 큐를 타지 않는다.
export async function getCoverArtThumbnail(releaseGroupId) {

    const url =
        `${COVER_ART_ARCHIVE_BASE_URL}/release-group/${releaseGroupId}`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        const frontImage =
            data.images?.find(function(image) { return image.front; }) ||
            data.images?.[0];

        return frontImage?.thumbnails?.["250"] || null;

    } catch (error) {

        console.warn(
            `[CoverArtArchive] ${releaseGroupId} 커버 아트 조회 실패:`,
            error
        );

        return null;
    }
}