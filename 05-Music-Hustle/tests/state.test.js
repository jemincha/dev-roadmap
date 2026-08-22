import { test } from "node:test";
import assert from "node:assert/strict";
import {
    selectedArtists,
    graphStartYear,
    addArtist,
    removeArtist,
    isArtistSelected,
    findArtist,
    getDebutYear,
    updateGraphStartYear
} from "../src/state.js";

test("addArtist / isArtistSelected / findArtist", () => {

    addArtist({ id: "a1", name: "Test Artist", debutYear: 2020 });

    assert.equal(isArtistSelected("a1"), true);
    assert.equal(isArtistSelected("nonexistent"), false);
    assert.equal(findArtist("a1").name, "Test Artist");

    removeArtist("a1");
});

test("removeArtist: 존재하지 않는 id는 false 반환, 목록 그대로", () => {

    const before = selectedArtists.length;
    const removed = removeArtist("no-such-id");

    assert.equal(removed, false);
    assert.equal(selectedArtists.length, before);
});

test("getDebutYear: 앨범 발매 연도 중 최솟값을 우선 사용", () => {

    const artist = { type: "Group" };
    const albums = [
        { "first-release-date": "2015-01-01" },
        { "first-release-date": "2010-06-01" }
    ];

    assert.equal(getDebutYear(artist, albums, "1990"), 2010);
});

test("getDebutYear: 앨범이 없으면 Group 타입에 한해 life-span.begin 사용", () => {

    const groupArtist = { type: "Group" };
    assert.equal(getDebutYear(groupArtist, [], "1991-05-01"), 1991);

    // Person 타입은 life-span.begin이 생년월일이라 데뷔 연도로 쓰지 않는다.
    const personArtist = { type: "Person" };
    const result = getDebutYear(personArtist, [], "1988-01-01");
    assert.notEqual(result, 1988);
});

test("updateGraphStartYear: 가장 이른 데뷔 연도를 기준으로 삼는다", () => {

    selectedArtists.length = 0; // 테스트 격리를 위해 초기화

    addArtist({ id: "a1", debutYear: 2010 });
    addArtist({ id: "a2", debutYear: 1987 });

    updateGraphStartYear();

    // graphStartYear는 ES 모듈 live binding이라, state.js에서 값이
    // 바뀌면 이 파일에서 import한 바인딩도 재조회 없이 자동 반영된다.
    assert.equal(graphStartYear, 1987);

    selectedArtists.length = 0;
});

test("updateGraphStartYear: debutYear가 null인(로딩/실패) 아티스트는 제외", () => {

    selectedArtists.length = 0;

    addArtist({ id: "a1", debutYear: null }); // 로딩 중
    addArtist({ id: "a2", debutYear: 2005 });

    updateGraphStartYear();

    assert.equal(graphStartYear, 2005);

    selectedArtists.length = 0;
});