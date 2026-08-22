import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYearAndQuarter, groupAlbumsByQuarter } from "../src/utils.js";

test("parseYearAndQuarter: 완전한 날짜(YYYY-MM-DD)", () => {
    assert.deepEqual(parseYearAndQuarter("1997-05-21"), { year: 1997, quarter: 2 });
});

test("parseYearAndQuarter: 연-월(YYYY-MM)", () => {
    assert.deepEqual(parseYearAndQuarter("2022-01"), { year: 2022, quarter: 1 });
});

test("parseYearAndQuarter: 연도만(YYYY) -> Q1로 취급", () => {
    assert.deepEqual(parseYearAndQuarter("2010"), { year: 2010, quarter: 1 });
});

test("parseYearAndQuarter: 분기 경계값 (12월 -> Q4, 10월 -> Q4, 9월 -> Q3)", () => {
    assert.equal(parseYearAndQuarter("2020-12-31").quarter, 4);
    assert.equal(parseYearAndQuarter("2020-10-01").quarter, 4);
    assert.equal(parseYearAndQuarter("2020-09-30").quarter, 3);
});

test("groupAlbumsByQuarter: 같은 분기 앨범을 묶는다", () => {
    const albums = [
        { title: "A", "first-release-date": "1997-05-21" },
        { title: "B", "first-release-date": "1997-06-01" },
        { title: "C", "first-release-date": "1998-01-01" }
    ];

    const grouped = groupAlbumsByQuarter(albums);

    assert.equal(grouped["1997-Q2"].length, 2);
    assert.equal(grouped["1998-Q1"].length, 1);
});

test("groupAlbumsByQuarter: 발매일 없는 앨범은 건너뛴다", () => {
    const albums = [
        { title: "A", "first-release-date": "1997-05-21" },
        { title: "B (발매일 없음)" }
    ];

    const grouped = groupAlbumsByQuarter(albums);
    const totalCounted = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    assert.equal(totalCounted, 1);
});