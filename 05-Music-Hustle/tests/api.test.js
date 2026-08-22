import { test, before } from "node:test";
import assert from "node:assert/strict";

// getArtistAlbums()는 캐시 히트 시 fetch를 아예 안 타므로,
// localStorage만 목업해도 캐시 동작을 충분히 검증할 수 있다.
const store = {};

before(() => {

    global.localStorage = {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = value; },
        removeItem: (key) => { delete store[key]; }
    };

    // getArtistAlbums이 캐시 미스일 때 fetch를 시도하지 않도록,
    // 이 테스트 파일에서는 캐시 히트 케이스만 검증한다(실제 네트워크 호출 방지).
    global.fetch = async () => {
        throw new Error("이 테스트에서는 fetch가 호출되면 안 된다 (캐시 히트를 기대함)");
    };

});

const { getArtistAlbums } = await import("../src/api.js");

test("getArtistAlbums: 캐시가 있으면 fetch 없이 캐시된 값을 반환한다", async () => {

    const cacheKey = "hustle:albums:cached-artist";

    store[cacheKey] = JSON.stringify({
        timestamp: Date.now(),
        albums: [{ title: "Cached Album" }]
    });

    const albums = await getArtistAlbums("cached-artist");

    assert.equal(albums.length, 1);
    assert.equal(albums[0].title, "Cached Album");
});

test("getArtistAlbums: 캐시가 만료됐으면(25시간 전) fetch를 시도한다", async () => {

    const cacheKey = "hustle:albums:expired-artist";

    store[cacheKey] = JSON.stringify({
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        albums: [{ title: "Old Album" }]
    });

    // fetch가 실제로 호출되며 위에서 정의한 mock이 에러를 던지는 걸로
    // "fetch 시도가 일어났다"는 걸 간접 확인한다.
    await assert.rejects(() => getArtistAlbums("expired-artist"));
});