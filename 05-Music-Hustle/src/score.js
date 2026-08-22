// ========================================
// Contribution Level (그래프 색상 단계)
// ========================================

import { groupAlbumsByQuarter } from "./utils.js";

export function getMaxAlbums(groupedAlbums) {

    const counts =
        Object.values(groupedAlbums).map(function(albums) {
            return albums.length;
        });

    if (counts.length === 0) {
        return 0;
    }

    return Math.max(...counts);
}


export function getContributionLevel(albumCount, maxAlbums) {

    if (albumCount === 0 || maxAlbums === 0) {
        return 0;
    }

    const ratio = albumCount / maxAlbums;

    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;

    return 4;
}


// ========================================
// 발매 가중치
// ========================================
//
// 트랙 수 데이터를 API에서 가져올 수 없는 범위에서는,
// 발매 형식(Album > EP > Single)을 "작업 규모"의 근사치로 사용한다.
export const RELEASE_TYPE_WEIGHT = {
    Album: 3,
    EP: 2,
    Single: 1
};

export const DEFAULT_RELEASE_WEIGHT = 1;

// secondary-types(Live/Compilation/Remix 등)는 이미 fetch 응답에
// 딸려오는 데이터인데도 그동안 활용을 안 하고 있었다. 형식만
// 앨범/EP/싱글이어도 실제로는 "새 창작물"이 아닌 경우가 많아서 할인한다.
// 여러 타입이 겹치면 가장 보수적인(가장 낮은) 배율을 쓴다.
export const SECONDARY_TYPE_MULTIPLIER = {
    "Compilation": 0.3,
    "Live": 0.5,
    "Remix": 0.4,
    "DJ-mix": 0.3,
    "Mixtape/Street": 0.7,
    "Demo": 0.5,
    "Soundtrack": 0.8,
    "Interview": 0,
    "Audiobook": 0,
    "Spokenword": 0
};

export function getSecondaryTypeMultiplier(album) {

    const secondaryTypes = album["secondary-types"] || [];

    if (secondaryTypes.length === 0) {
        return 1;
    }

    const multipliers = secondaryTypes.map(function(type) {
        return SECONDARY_TYPE_MULTIPLIER[type] ?? 1;
    });

    return Math.min(...multipliers);
}


export function getReleaseWeight(album) {

    const primaryType = album["primary-type"];

    const baseWeight =
        RELEASE_TYPE_WEIGHT[primaryType] ?? DEFAULT_RELEASE_WEIGHT;

    return baseWeight * getSecondaryTypeMultiplier(album);
}


// ========================================
// Hustle Score 절대 기준선
// ========================================
//
// "비교 대상 중 최고값을 100으로" 하는 상대 정규화는 비교 대상이
// 바뀔 때마다 점수도 바뀌는 문제가 있었다. FIFA 능력치처럼 비교 대상과
// 무관하게 고유의 점수가 나오도록 고정 기준선(anchor) 대비로 계산한다.

// 앨범 1장(가중치 3)을 1년(4분기)에 하나씩 내는 페이스 → 0.75
export const OUTPUT_SCORE_CAP = 0.75;

// 활동 가능 분기의 절반 이상에서 발매하면 최상위 수준으로 본다.
export const CONSISTENCY_SCORE_CAP = 0.5;


// 선형 방식은 점수가 낮은 쪽에 몰려서 체감상 너무 박했다.
// 제곱근 곡선을 쓰면 순위는 그대로 유지하면서(단조증가) 점수 폭이 넓어진다.
export function getOutputScore(output) {

    const ratio = output / OUTPUT_SCORE_CAP;

    return Math.sqrt(Math.min(ratio, 1)) * 100;
}


export function getConsistencyScore(consistency) {

    const ratio = consistency / CONSISTENCY_SCORE_CAP;

    return Math.sqrt(Math.min(ratio, 1)) * 100;
}


export function getHustleScore(outputScore, consistencyScore) {

    return Math.round((outputScore * consistencyScore) / 100);
}


// ========================================
// 데이터 분석
// ========================================

export function analyzeArtist(artist, currentYear, currentQuarter) {

    // 아직 오지 않은 미래 분기는 "활동 가능 분기"에서 제외한다.
    const totalQuarters =
        (currentYear - artist.debutYear) * 4 + currentQuarter;

    const groupedAlbums =
        groupAlbumsByQuarter(artist.albums);

    const activeQuarters =
        Object.keys(groupedAlbums).length;

    const totalAlbums =
        artist.albums.length;

    const weightedTotal =
        artist.albums.reduce(function(sum, album) {
            return sum + getReleaseWeight(album);
        }, 0);

    const consistency =
        totalQuarters > 0 ? activeQuarters / totalQuarters : 0;

    // Output: 활동 기간 대비 "가중 발매 밀도"
    const output =
        totalQuarters > 0 ? weightedTotal / totalQuarters : 0;

    const outputScore = getOutputScore(output);
    const consistencyScore = getConsistencyScore(consistency);
    const hustleScore = getHustleScore(outputScore, consistencyScore);

    return {
        totalAlbums,
        weightedTotal,
        activeQuarters,
        totalQuarters,
        consistency,
        output,
        outputScore,
        consistencyScore,
        hustleScore
    };
}


export function compareArtists(artists, currentYear, currentQuarter) {

    const analyzableArtists =
        artists.filter(function(artist) {
            return !artist.loadFailed && !artist.isLoading;
        });

    if (analyzableArtists.length === 0) {
        return [];
    }

    const results =
        analyzableArtists.map(function(artist) {

            const analysis =
                analyzeArtist(artist, currentYear, currentQuarter);

            return { id: artist.id, name: artist.name, ...analysis };

        });

    results.sort(function(a, b) {
        return b.hustleScore - a.hustleScore;
    });

    return results;
}