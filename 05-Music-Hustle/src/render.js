import { groupAlbumsByQuarter } from "./utils.js";
import { getCoverArtThumbnail } from "./api.js";
import {
    getMaxAlbums,
    getContributionLevel,
    compareArtists
} from "./score.js";
import {
    selectedArtists,
    graphStartYear,
    currentYear,
    currentQuarter
} from "./state.js";

// ========================================
// DOM 참조
// ========================================

const artistGraphs = document.getElementById("artist-graphs");
const detailPanel = document.getElementById("detail-panel");
const detailTitle = document.getElementById("detail-title");
const albumList = document.getElementById("album-list");


// ========================================
// 검색 결과 드롭다운
// ========================================

export function renderArtistSearchResults(artists, searchDropdown, onSelect) {

    searchDropdown.innerHTML = "";

    if (artists.length === 0) {
        searchDropdown.innerHTML = `
            <p class="search-empty">검색 결과가 없습니다.</p>
        `;
        return;
    }

    artists.forEach(function(artist) {

        const result = document.createElement("button");
        result.type = "button";
        result.className = "search-result";

        const artistType = artist.type || "아티스트";
        const country = artist.country ? ` · ${artist.country}` : "";
        // 동명이인 아티스트를 구분할 수 있도록 disambiguation을 함께 보여준다.
        const disambiguation =
            artist.disambiguation ? ` · ${artist.disambiguation}` : "";

        result.innerHTML = `
            <strong>${artist.name}</strong>
            <span>${artistType}${country}${disambiguation}</span>
        `;

        result.addEventListener("click", function(event) {

            // onSelect가 searchDropdown.innerHTML을 비우면서 클릭된 버튼
            // 자신이 DOM에서 분리된다. 그 상태로 이벤트가 document까지
            // 버블링되면 detail-panel이 의도치 않게 닫히는 문제가 있어
            // 여기서 버블링을 막는다.
            event.stopPropagation();
            onSelect(artist);

        });

        searchDropdown.appendChild(result);

    });
}


// ========================================
// 온보딩 프리셋 (빈 화면에서 뭘 검색할지 막막함 해소)
// ========================================

const ONBOARDING_PRESETS = ["Radiohead", "IU", "NewJeans", "Nirvana"];

export function renderOnboardingPresets(onPickPreset) {

    const wrapper = document.createElement("div");
    wrapper.className = "onboarding";

    wrapper.innerHTML = `
        <p class="empty-state">아티스트를 검색해서 추가해보세요.</p>
        <p class="onboarding-label">또는 예시로 바로 시작:</p>
    `;

    const chipRow = document.createElement("div");
    chipRow.className = "onboarding-chips";

    ONBOARDING_PRESETS.forEach(function(name) {

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "onboarding-chip";
        chip.textContent = name;

        chip.addEventListener("click", function() {
            onPickPreset(name);
        });

        chipRow.appendChild(chip);

    });

    wrapper.appendChild(chipRow);

    artistGraphs.innerHTML = "";
    artistGraphs.appendChild(wrapper);
}


// ========================================
// 아티스트 그래프 전체 렌더링
// ========================================

export function renderArtistGraphs() {

    artistGraphs.innerHTML = "";

    if (selectedArtists.length === 0) {
        artistGraphs.innerHTML = `
            <p class="empty-state">아티스트를 검색해서 추가해보세요.</p>
        `;
        return;
    }

    selectedArtists.forEach(function(artist) {
        artistGraphs.appendChild(createArtistChart(artist));
    });

    logHustleAnalysis();
}


function createArtistChart(artist) {

    const article = document.createElement("article");
    article.className = "artist-chart";

    const artistHeader = document.createElement("header");
    artistHeader.className = "artist-header";
    artistHeader.innerHTML = `
        <div class="artist-info">
            <h2>${artist.name}</h2>
            ${artist.country ? `<span>${artist.country}</span>` : ""}
        </div>
        <button
            type="button"
            class="remove-artist-button"
            data-artist-id="${artist.id}"
            aria-label="${artist.name} 제거"
        >×</button>
    `;
    article.appendChild(artistHeader);

    if (artist.isLoading) {
        const loadingBox = document.createElement("div");
        loadingBox.className = "artist-loading";
        loadingBox.innerHTML = `
            <div class="artist-loading-bar"></div>
            <p class="artist-loading-text">발매 기록을 불러오는 중...</p>
        `;
        article.appendChild(loadingBox);
        return article;
    }

    if (artist.loadFailed) {
        const errorBox = document.createElement("div");
        errorBox.className = "artist-load-error";
        errorBox.innerHTML = `
            <p>앨범 정보를 가져오지 못했습니다.</p>
            <button
                type="button"
                class="retry-artist-button"
                data-artist-id="${artist.id}"
            >다시 시도</button>
        `;
        article.appendChild(errorBox);
        return article;
    }

    const groupedAlbums = groupAlbumsByQuarter(artist.albums);
    article.appendChild(createContributionGraph(artist, groupedAlbums));

    return article;
}


// 연도를 좌우로, 각 연도 안의 4개 분기를 위아래로 배치한다.
function createContributionGraph(artist, groupedAlbums) {

    const graph = document.createElement("div");
    graph.className = "contribution-graph";

    const maxAlbums = getMaxAlbums(groupedAlbums);

    for (let year = graphStartYear; year <= currentYear; year++) {
        graph.appendChild(createYearColumn(artist, year, groupedAlbums, maxAlbums));
    }

    return graph;
}


function createYearColumn(artist, year, groupedAlbums, maxAlbums) {

    const column = document.createElement("div");
    column.className = "year-column";

    const yearLabel = document.createElement("span");
    yearLabel.className = "year-label";
    yearLabel.textContent = year;

    const quarterStack = document.createElement("div");
    quarterStack.className = "quarter-stack";

    for (let quarter = 1; quarter <= 4; quarter++) {

        // 데뷔 이전 구간은 발매량 0이 아니라 "빈 공간"으로 표시한다.
        const isBeforeDebut = year < artist.debutYear;
        const key = `${year}-Q${quarter}`;
        const albums = groupedAlbums[key] || [];

        quarterStack.appendChild(
            createQuarterCell(artist, year, quarter, albums, maxAlbums, isBeforeDebut)
        );
    }

    column.appendChild(yearLabel);
    column.appendChild(quarterStack);

    return column;
}


function createQuarterCell(artist, year, quarter, albums, maxAlbums, isBeforeDebut) {

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "quarter-cell";

    if (isBeforeDebut) {
        cell.classList.add("no-data");
        cell.disabled = true;
        cell.title = `${year} Q${quarter} · 활동 이전`;
        cell.setAttribute("aria-label", `${artist.name} ${year}년 ${quarter}분기, 활동 이전`);
        return cell;
    }

    cell.dataset.artistId = artist.id;
    cell.dataset.year = year;
    cell.dataset.quarter = quarter;

    const albumCount = albums.length;
    const level = getContributionLevel(albumCount, maxAlbums);

    cell.classList.add(`level-${level}`);
    cell.title = `${year} Q${quarter} · ${albumCount}장`;
    // title 속성은 스크린리더가 안정적으로 읽지 않으므로 aria-label도 별도로 채운다.
    cell.setAttribute(
        "aria-label",
        `${artist.name} ${year}년 ${quarter}분기, 발매 ${albumCount}건`
    );

    return cell;
}


// ========================================
// 상세 패널
// ========================================

export function showDetailPanel(artist, year, quarter, albums) {

    detailPanel.classList.add("active");
    detailTitle.textContent = `${artist.name} · ${year} Q${quarter}`;

    albumList.innerHTML = "";

    if (albums.length === 0) {
        albumList.innerHTML = `
            <p class="detail-placeholder">이 기간에는 발매된 앨범이 없습니다.</p>
        `;
        return;
    }

    albums.forEach(function(album) {
        albumList.appendChild(createAlbumCard(album));
    });
}


export function closeDetailPanel() {

    detailPanel.classList.remove("active");
    detailTitle.textContent = "분기를 선택해주세요";

    albumList.innerHTML = `
        <p class="detail-placeholder">
            그래프의 분기를 클릭하면
            해당 기간에 발매된 앨범을 확인할 수 있습니다.
        </p>
    `;
}


function createAlbumCard(album) {

    const card = document.createElement("article");
    card.className = "album-card";

    const releaseDate = album["first-release-date"];

    card.innerHTML = `
        <div class="album-thumbnail" data-role="thumbnail">
            <div class="album-thumbnail-placeholder"></div>
        </div>
        <div class="album-info">
            <h3>${album.title}</h3>
            <p>${releaseDate || "발매일 정보 없음"}</p>
            <p>${getReleaseTypeLabel(album)}</p>
        </div>
    `;

    // 상세 패널을 여는 순간 모든 이미지를 기다리지 않도록, 카드는 먼저
    // 렌더링하고 이미지는 도착하는 대로 채워 넣는다. 지금 열린 분기의
    // 앨범들에 대해서만 요청하므로 요청량이 자연히 작다.
    loadAlbumThumbnail(card, album.id);

    return card;
}


async function loadAlbumThumbnail(card, releaseGroupId) {

    const thumbnailUrl = await getCoverArtThumbnail(releaseGroupId);
    const thumbnailContainer = card.querySelector('[data-role="thumbnail"]');

    if (!thumbnailContainer) {
        return;
    }

    if (!thumbnailUrl) {
        thumbnailContainer.innerHTML = "";
        thumbnailContainer.classList.add("no-thumbnail");
        return;
    }

    const img = document.createElement("img");
    img.src = thumbnailUrl;
    img.alt = "";
    img.loading = "lazy";

    thumbnailContainer.innerHTML = "";
    thumbnailContainer.appendChild(img);
}


function getReleaseTypeLabel(album) {

    const primaryType = album["primary-type"];
    const secondaryTypes = album["secondary-types"] || [];

    if (primaryType === "Album") return "Album";
    if (primaryType === "EP") return "EP";
    if (primaryType === "Single") return "Single";
    if (secondaryTypes.length > 0) return secondaryTypes.join(", ");

    return "Release";
}


// ========================================
// Hustle Ranking (Phase 5-3)
// ========================================

let hustleRankingSection = null;

function getOrCreateHustleRankingSection() {

    if (hustleRankingSection) {
        return hustleRankingSection;
    }

    const dashboard = document.querySelector(".dashboard");

    if (!dashboard) {
        return null;
    }

    hustleRankingSection = document.createElement("section");
    hustleRankingSection.id = "hustle-ranking";
    hustleRankingSection.className = "hustle-ranking";

    dashboard.insertAdjacentElement("afterend", hustleRankingSection);

    return hustleRankingSection;
}


export function renderHustleRanking() {

    const section = getOrCreateHustleRankingSection();

    if (!section) {
        return;
    }

    const ranking = compareArtists(selectedArtists, currentYear, currentQuarter);

    if (ranking.length === 0) {
        section.innerHTML = "";
        section.classList.remove("active");
        return;
    }

    section.classList.add("active");

    section.innerHTML = `
        <header class="hustle-ranking-header">
            <div class="hustle-ranking-title-row">
                <h2>Hustle Ranking</h2>
                <button type="button" id="export-ranking-button" class="export-ranking-button">
                    이미지로 저장
                </button>
            </div>
            <p class="hustle-ranking-note">
                절대 기준선 대비 점수라, 비교 대상이 늘어나거나 줄어도
                각 아티스트의 점수 자체는 바뀌지 않습니다.
            </p>
        </header>
    `;

    const list = document.createElement("ol");
    list.className = "hustle-ranking-list";

    ranking.forEach(function(entry) {

        const item = document.createElement("li");
        item.className = "hustle-ranking-item";

        item.innerHTML = `
            <div class="hustle-ranking-top">
                <span class="hustle-ranking-artist">${entry.name}</span>
                <span class="hustle-ranking-score">${entry.hustleScore}</span>
            </div>
            <div class="hustle-bar-row">
                <span class="hustle-bar-label">Output</span>
                <div class="hustle-bar-track">
                    <div class="hustle-bar-fill output" style="width: ${entry.outputScore}%;"></div>
                </div>
                <span class="hustle-bar-value">${Math.round(entry.outputScore)}</span>
            </div>
            <div class="hustle-bar-row">
                <span class="hustle-bar-label">Consistency</span>
                <div class="hustle-bar-track">
                    <div class="hustle-bar-fill consistency" style="width: ${entry.consistencyScore}%;"></div>
                </div>
                <span class="hustle-bar-value">${Math.round(entry.consistencyScore)}</span>
            </div>
        `;

        list.appendChild(item);

    });

    section.appendChild(list);

    const exportButton = section.querySelector("#export-ranking-button");
    exportButton.addEventListener("click", function() {
        exportHustleRankingImage(ranking);
    });
}


// ========================================
// 이미지 export (Canvas로 직접 그려서 PNG 다운로드)
// ========================================
//
// DOM을 그대로 캡처하는 라이브러리(html2canvas 등)는 쓰지 않는다.
// 이 프로젝트의 원칙(불필요한 외부 라이브러리 지양)에 맞게, 필요한 정보만
// Canvas API로 직접 그린 뒤 PNG로 내보낸다.
function exportHustleRankingImage(ranking) {

    const width = 640;
    const rowHeight = 110;
    const headerHeight = 90;
    const height = headerHeight + ranking.length * rowHeight + 30;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    // 배경
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 제목
    ctx.fillStyle = "#1f2328";
    ctx.font = "bold 24px -apple-system, sans-serif";
    ctx.fillText("Hustle Ranking", 24, 40);

    ctx.fillStyle = "#656d76";
    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillText("누가 제일 허슬했나 — 절대 기준선 대비 점수", 24, 62);

    let y = headerHeight;

    ranking.forEach(function(entry, index) {

        // 아티스트 이름 + 점수
        ctx.fillStyle = "#1f2328";
        ctx.font = "bold 16px -apple-system, sans-serif";
        ctx.fillText(`${index + 1}. ${entry.name}`, 24, y + 20);

        ctx.fillStyle = "#216e39";
        ctx.font = "bold 20px -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(String(entry.hustleScore), width - 24, y + 24);
        ctx.textAlign = "left";

        // Output / Consistency 막대
        drawScoreBar(ctx, "Output", entry.outputScore, y + 40, width, "#30a14e");
        drawScoreBar(ctx, "Consistency", entry.consistencyScore, y + 68, width, "#0969da");

        y += rowHeight;

    });

    const link = document.createElement("a");
    link.download = "hustle-ranking.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}


function drawScoreBar(ctx, label, score, y, canvasWidth, color) {

    const barX = 90;
    const barMaxWidth = canvasWidth - barX - 60;
    const barWidth = (score / 100) * barMaxWidth;

    ctx.fillStyle = "#656d76";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText(label, 24, y + 9);

    ctx.fillStyle = "#d0d7de";
    ctx.fillRect(barX, y, barMaxWidth, 8);

    ctx.fillStyle = color;
    ctx.fillRect(barX, y, barWidth, 8);

    ctx.fillStyle = "#1f2328";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText(Math.round(score), barX + barMaxWidth + 10, y + 9);
}


// ========================================
// 콘솔 검증용 로그 (개발 중 데이터 확인용)
// ========================================

function logHustleAnalysis() {

    const ranking = compareArtists(selectedArtists, currentYear, currentQuarter);

    if (ranking.length === 0) {
        return;
    }

    const rows = ranking.map(function(entry, index) {
        return {
            "순위": index + 1,
            "아티스트": entry.name,
            "Hustle Score": entry.hustleScore,
            "Output점수": Math.round(entry.outputScore),
            "Consistency점수": Math.round(entry.consistencyScore),
            "가중 발매 점수": entry.weightedTotal,
            "총 발매(앨범/EP/싱글)": entry.totalAlbums,
            "활동 분기": `${entry.activeQuarters} / ${entry.totalQuarters}`
        };
    });

    console.table(rows);
}


// ========================================
// 라이선스 고지 (Footer)
// ========================================

export function renderAttributionFooter() {

    if (document.querySelector(".attribution-footer")) {
        return;
    }

    const footer = document.createElement("footer");
    footer.className = "attribution-footer";

    footer.innerHTML = `
        <p>
            아티스트 및 발매 정보 제공:
            <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer">MusicBrainz</a>
            (CC0 / CC BY-NC-SA) ·
            앨범 아트 제공:
            <a href="https://coverartarchive.org" target="_blank" rel="noopener noreferrer">Cover Art Archive</a>
        </p>
        <p>본 서비스는 비영리 목적으로 운영됩니다.</p>
    `;

    document.body.appendChild(footer);
}