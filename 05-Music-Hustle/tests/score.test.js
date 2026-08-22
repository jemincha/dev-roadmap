import { test } from "node:test";
import assert from "node:assert/strict";
import {
    getContributionLevel,
    getMaxAlbums,
    getReleaseWeight,
    getSecondaryTypeMultiplier,
    getOutputScore,
    getConsistencyScore,
    getHustleScore,
    analyzeArtist,
    compareArtists
} from "../src/score.js";

test("getContributionLevel: 경계값 (0%, 25%, 50%, 75%, 100%)", () => {
    assert.equal(getContributionLevel(0, 4), 0);
    assert.equal(getContributionLevel(1, 4), 1); // 25%
    assert.equal(getContributionLevel(2, 4), 2); // 50%
    assert.equal(getContributionLevel(3, 4), 3); // 75%
    assert.equal(getContributionLevel(4, 4), 4); // 100%
});

test("getContributionLevel: maxAlbums가 0이면 항상 0", () => {
    assert.equal(getContributionLevel(0, 0), 0);
});

test("getMaxAlbums: 그룹 중 최댓값을 찾는다", () => {
    const grouped = { "2020-Q1": [1, 2], "2020-Q2": [1, 2, 3], "2020-Q3": [1] };
    assert.equal(getMaxAlbums(grouped), 3);
});

test("getMaxAlbums: 빈 객체는 0", () => {
    assert.equal(getMaxAlbums({}), 0);
});

test("getReleaseWeight: 기본 가중치 (Album=3, EP=2, Single=1)", () => {
    assert.equal(getReleaseWeight({ "primary-type": "Album" }), 3);
    assert.equal(getReleaseWeight({ "primary-type": "EP" }), 2);
    assert.equal(getReleaseWeight({ "primary-type": "Single" }), 1);
});

test("getReleaseWeight: secondary-types 할인 적용 (Live -> 0.5배)", () => {
    const album = { "primary-type": "Album", "secondary-types": ["Live"] };
    assert.equal(getReleaseWeight(album), 3 * 0.5);
});

test("getReleaseWeight: 여러 secondary-types 겹치면 가장 낮은 배율 적용", () => {
    const album = { "primary-type": "Album", "secondary-types": ["Live", "Compilation"] };
    assert.equal(getSecondaryTypeMultiplier(album), 0.3);
});

test("getOutputScore / getConsistencyScore: 기준선 이상이면 100으로 상한", () => {
    assert.equal(getOutputScore(999), 100);
    assert.equal(getConsistencyScore(999), 100);
});

test("getOutputScore / getConsistencyScore: 단조증가(순서를 보존)", () => {
    const low = getOutputScore(0.1);
    const high = getOutputScore(0.5);
    assert.ok(high > low);
});

test("getHustleScore: 둘 중 하나가 0이면 최종 점수도 0", () => {
    assert.equal(getHustleScore(0, 80), 0);
    assert.equal(getHustleScore(80, 0), 0);
});

test("analyzeArtist: 절대 척도이므로 비교 대상과 무관하게 같은 값이 나온다", () => {

    const currentYear = 2026;
    const currentQuarter = 3;

    const artist = {
        id: "test-artist",
        debutYear: 2020,
        albums: [
            { "primary-type": "Album", "first-release-date": "2021-01-01" },
            { "primary-type": "EP", "first-release-date": "2022-06-01" }
        ]
    };

    const resultAlone = analyzeArtist(artist, currentYear, currentQuarter);
    const resultAgain = analyzeArtist(artist, currentYear, currentQuarter);

    assert.deepEqual(resultAlone, resultAgain);
});

test("compareArtists: Hustle Score 내림차순 정렬", () => {

    const currentYear = 2026;
    const currentQuarter = 3;

    const busy = {
        id: "busy", name: "Busy Artist", debutYear: 2024,
        albums: [
            { "primary-type": "Album", "first-release-date": "2024-01-01" },
            { "primary-type": "Album", "first-release-date": "2024-06-01" },
            { "primary-type": "EP", "first-release-date": "2025-01-01" }
        ]
    };

    const quiet = {
        id: "quiet", name: "Quiet Artist", debutYear: 1990,
        albums: [
            { "primary-type": "Album", "first-release-date": "1995-01-01" }
        ]
    };

    const ranking = compareArtists([busy, quiet], currentYear, currentQuarter);

    assert.equal(ranking[0].id, "busy");
    assert.ok(ranking[0].hustleScore >= ranking[1].hustleScore);
});

test("compareArtists: loadFailed/isLoading 아티스트는 제외", () => {

    const currentYear = 2026;
    const currentQuarter = 3;

    const failed = { id: "failed", name: "Failed", loadFailed: true, debutYear: 2020, albums: [] };
    const loading = { id: "loading", name: "Loading", isLoading: true, debutYear: 2020, albums: [] };

    const ranking = compareArtists([failed, loading], currentYear, currentQuarter);

    assert.equal(ranking.length, 0);
});