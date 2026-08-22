// ========================================
// 공용 순수 함수
// ========================================
//
// 이 파일에는 DOM이나 네트워크에 의존하지 않는 순수 함수만 둔다.
// (테스트하기 쉽고, 다른 모듈 어디서든 부작용 걱정 없이 가져다 쓸 수 있다.)

export function wait(milliseconds) {

    return new Promise(function(resolve) {

        setTimeout(resolve, milliseconds);

    });
}


// MusicBrainz의 날짜 문자열("1997-05-21", "1997-05", "1997")을
// new Date(...)로 파싱하면 UTC 자정으로 해석된 뒤
// getFullYear()/getMonth()는 로컬 타임존 기준으로 값을 뽑아오기 때문에
// 타임존에 따라 연도/분기가 하루이틀 차이로 밀리는 문제가 있다.
// Date 객체를 거치지 않고 문자열을 직접 파싱해 이 문제를 피한다.
export function parseYearAndQuarter(dateString) {

    const [yearStr, monthStr] = dateString.split("-");

    const year = Number(yearStr);

    // 월 정보가 없는 경우(예: "1997") 일단 Q1로 취급한다.
    const month = monthStr ? Number(monthStr) : 1;

    const quarter = Math.floor((month - 1) / 3) + 1;

    return { year, quarter };
}


export function groupAlbumsByQuarter(albums) {

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