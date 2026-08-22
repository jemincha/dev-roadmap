import { parseYearAndQuarter } from "./utils.js";

// ========================================
// 상태
// ========================================
//
// ES 모듈의 export let/const는 "live binding"이라, 이 값을 재할당하면
// 이 모듈을 import한 다른 모든 파일에서도 최신 값이 그대로 보인다.
// (배열은 push/splice처럼 참조를 유지한 채 내용만 바꾸면 되므로 문제 없음.)

export const selectedArtists = [];

export let selectedQuarter = null;

export let graphStartYear = null;

export const currentYear = new Date().getFullYear();

// 현재 분기(1~4). totalQuarters 계산 시 아직 안 지난 미래 분기가
// 분모에 잘못 끼는 걸 막기 위해 쓴다.
export const currentQuarter =
    Math.floor(new Date().getMonth() / 3) + 1;


export function findArtist(artistId) {

    return selectedArtists.find(function(artist) {
        return artist.id === artistId;
    });
}


export function isArtistSelected(artistId) {

    return selectedArtists.some(function(artist) {
        return artist.id === artistId;
    });
}


export function addArtist(artistData) {

    selectedArtists.push(artistData);
}


export function removeArtist(artistId) {

    const index =
        selectedArtists.findIndex(function(artist) {
            return artist.id === artistId;
        });

    if (index === -1) {
        return false;
    }

    selectedArtists.splice(index, 1);

    return true;
}


export function setSelectedQuarter(quarterInfo) {

    selectedQuarter = quarterInfo;
}


export function clearSelectedQuarter() {

    selectedQuarter = null;
}


// 아티스트 데뷔 연도.
//
// life-span.begin은 아티스트 타입에 따라 의미가 다르다.
//   - Group(밴드): 결성년도에 가까워 데뷔 연도의 근사치로 쓸 만하다.
//   - Person(솔로 아티스트): 생년월일이라 데뷔 연도와 무관하다.
// 가장 신뢰할 수 있는 기준은 "실제 발매된 앨범 중 가장 이른 연도"이며,
// 앨범 데이터가 없을 때만 life-span.begin을 보조로(Group에 한해) 사용한다.
export function getDebutYear(artist, albums, lifeSpanBegin) {

    const albumYears = albums
        .map(function(album) { return album["first-release-date"]; })
        .filter(Boolean)
        .map(function(dateString) { return parseYearAndQuarter(dateString).year; });

    if (albumYears.length > 0) {
        return Math.min(...albumYears);
    }

    if (artist.type === "Group" && lifeSpanBegin) {
        return parseYearAndQuarter(lifeSpanBegin).year;
    }

    return currentYear;
}


// 전체 그래프의 시작 연도 = 선택된 아티스트 중 가장 이른 데뷔 연도.
// 로드 실패/로딩 중이라 debutYear가 없는 아티스트는 계산에서 제외한다.
export function updateGraphStartYear() {

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