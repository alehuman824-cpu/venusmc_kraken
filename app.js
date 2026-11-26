(() => {
  const CFG = window.CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // ---------- 핫스팟 좌표 ----------
  // 사선 뷰: viewBox 1200 x 675
  const SHIP = "105,580 240,500 322,444 248,414 208,400 202,335 215,300 240,340 305,296 380,245 405,242 460,190 490,195 545,188 600,195 630,215 700,140 830,88 930,58 1020,32 1055,45 1105,95 1100,140 1085,215 1040,255 1015,300 960,320 850,335 745,425 665,470 600,490 590,560 548,605 520,590 430,570 330,585 240,605 180,607";
  const PAD_REGION = "222,352 312,290 398,240 488,192 598,188 630,228 575,268 700,232 830,204 860,206 860,300 745,428 602,460 360,470 322,438 350,420 300,418";

  // 상단 뷰: viewBox 2576 x 1449. 소형 패드 1~4, 중형 패드 5·6
  const PADS = [
    { id: 1, size: "S", name: "소형 패드 1", pts: "1377,285 1472,285 1475,562 1285,562", label: [1380, 440] },
    { id: 2, size: "S", name: "소형 패드 2", pts: "1135,285 1230,285 1232,562 1043,562", label: [1138, 440] },
    { id: 3, size: "S", name: "소형 패드 3", pts: "892,285 987,285 990,562 800,562",     label: [895, 440] },
    { id: 4, size: "S", name: "소형 패드 4", pts: "650,285 745,285 748,562 558,562",     label: [653, 440] },
    { id: 5, size: "M", name: "중형 패드 5", pts: "718,668 1005,668 1005,882 718,882",   label: [861, 790] },
    { id: 6, size: "M", name: "중형 패드 6", pts: "1153,788 1437,788 1437,1000 1153,1000", label: [1295, 910] }
  ];

  const stage = $("#stage"), shop = $("#shop"), back = $("#btnBack");
  const svgP = $("#svgPersp"), svgT = $("#svgTop");
  let state = "home";
  let padStatus = {};      // 패드 번호 -> {handle, ship, expires_at}
  let statusSkew = 0;      // 서버 시계 - 내 시계
  let pollTimer = null;

  function poly(parent, pts, cls, title, onClick) {
    const p = document.createElementNS(NS, "polygon");
    p.setAttribute("points", pts);
    p.setAttribute("class", cls);
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    p.setAttribute("aria-label", title);
    p.addEventListener("click", onClick);
    p.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } });
    const t = document.createElementNS(NS, "title"); t.textContent = title; p.appendChild(t);
    parent.appendChild(p); return p;
  }
  function text(parent, x, y, str, cls) {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("class", cls);
    t.textContent = str; parent.appendChild(t);
  }

  // 사선 뷰 핫스팟: 상태에 따라 구성이 달라요
  function buildPersp() {
    svgP.innerHTML = "";
    if (state === "home") {
      poly(svgP, SHIP, "hs ship", "크라켄 프라이베이티어", () => go("zoom"));
    } else if (state === "zoom") {
      poly(svgP, SHIP, "hs", "몸통 · 상점", () => go("shop"));
      poly(svgP, PAD_REGION, "hs", "패드 · 이착륙 신고", () => go("pads"));
    }
  }
  function buildTop() {
    svgT.innerHTML = "";
    PADS.forEach(p => {
      const busy = padStatus[p.id];
      poly(svgT, p.pts, busy ? "hs busy" : "hs", busy ? `${p.name} · 사용중 (${busy.handle})` : p.name, () => openReport(p));
      text(svgT, p.label[0], p.label[1], String(p.id), "hs-label");
      if (busy) {
        text(svgT, p.label[0], p.label[1] + 56, `사용중(${Array.from(busy.handle).slice(0, 5).join("")})`, "hs-busy");
      }
    });
  }

  // ---------- 패드 사용 상태 ----------
  async function loadStatus() {
    if (!CFG.REPORT_ENDPOINT) return;
    try {
      const r = await fetch(CFG.REPORT_ENDPOINT, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      padStatus = d.pads || {};
      statusSkew = (d.now || Date.now()) - Date.now();
      if (state === "pads") buildTop();
    } catch (_) {}
  }
  function startPolling() {
    if (pollTimer || !CFG.REPORT_ENDPOINT) return;
    loadStatus();
    pollTimer = setInterval(loadStatus, 15000);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
  const minLeft = (b) => Math.max(1, Math.ceil((b.expires_at - (Date.now() + statusSkew)) / 60000));

  function go(next) {
    state = next;
    const inShop = next === "shop";
    stage.hidden = inShop; shop.hidden = !inShop;
    if (!inShop) { stage.dataset.state = next; }
    back.hidden = next === "home";
    buildPersp();
    if (next === "pads") { buildTop(); startPolling(); } else stopPolling();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  back.addEventListener("click", () => {
    if (state === "pads") go("zoom");
    else if (state === "shop") go("zoom");
    else go("home");
  });
  $("#btnShop").addEventListener("click", () => go("shop"));

  // ---------- 모달 ----------
  const modal = $("#modal"), mBody = $("#mBody");
  const open = (html) => { mBody.innerHTML = html; modal.hidden = false; };
  const close = () => { modal.hidden = true; mBody.innerHTML = ""; };
  $("#mClose").addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  // ---------- 이착륙 신고 ----------
  function openReport(pad) {
    const saved = JSON.parse(localStorage.getItem("gs_reporter") || "{}");
    // ships.js: 이 패드에 착륙 가능한 함선만 크기별로 나눠서 보여줘요.
    const allowed = (window.shipsForPad ? window.shipsForPad(pad.id) : []);
    const names = allowed.map(s => s[0]);
    const sel = names.includes(saved.ship) ? saved.ship : "";
    const opt = (list) => list.map(s => `<option value="${esc(s[0])}"${s[0] === sel ? " selected" : ""}>${esc(s[0])}</option>`).join("");
    const groups = [["S", "소형함"], ["M", "중형함"], ["L", "대형함"]]
      .map(([k, label]) => [label, allowed.filter(s => s[1] === k)])
      .filter(([, list]) => list.length);
    const shipOpts = groups.map(([label, list]) => `<optgroup label="${label}">${opt(list)}</optgroup>`).join("");
    const kinds = groups.map(([label]) => label).join("·");
    open(`
      <h2>이착륙 신고 · ${esc(pad.name)}</h2>
      ${padStatus[pad.id] ? `<p class="msg err">현재 ${esc(padStatus[pad.id].handle)} (${esc(padStatus[pad.id].ship)})이 사용 중이에요. 약 ${minLeft(padStatus[pad.id])}분 뒤 자동 해제돼요.</p>` : ""}
      <p class="sub">제출하면 금성상회 디스코드 채널에 올라가요. 착륙하면 30분 동안 사용중으로 표시돼요.</p>
      <form id="rf" autocomplete="off">
        <div class="seg">
          <input type="radio" name="kind" id="k1" value="착륙" checked><label for="k1">착륙</label>
          <input type="radio" name="kind" id="k2" value="이륙"><label for="k2">이륙</label>
        </div>
        <label for="nick">닉네임 (인게임 핸들)</label>
        <input id="nick" name="nick" maxlength="32" required value="${esc(saved.nick || "")}">
        <label for="ship">함선 (${kinds})</label>
        <select id="ship" name="ship" required>
          <option value="" disabled${sel ? "" : " selected"}>함선을 선택하세요</option>
          ${shipOpts}
        </select>
        <label for="memo">메모 (선택)</label>
        <textarea id="memo" name="memo" rows="2" maxlength="120" placeholder="예: 화물 하역 후 곧 이륙"></textarea>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="submit" type="submit">신고하기</button>
        <div class="msg" id="rmsg"></div>
      </form>`);
    $("#rf").addEventListener("submit", e => submitReport(e, pad));
  }

  async function submitReport(e, pad) {
    e.preventDefault();
    const f = e.target, msg = $("#rmsg"), btn = f.querySelector(".submit");
    const data = {
      pad: pad.id, padName: pad.name,
      kind: f.kind.value, nick: f.nick.value.trim(), ship: f.ship.value.trim(),
      memo: f.memo.value.trim(), website: f.website.value
    };
    localStorage.setItem("gs_reporter", JSON.stringify({ nick: data.nick, ship: data.ship }));
    const line = `[금성상회 청해진] ${data.kind} 신고 · ${data.padName} · ${data.nick} / ${data.ship}${data.memo ? " · " + data.memo : ""}`;

    if (!CFG.REPORT_ENDPOINT) {
      try { await navigator.clipboard.writeText(line); } catch (_) {}
      msg.className = "msg ok";
      msg.textContent = "데모 모드예요(디스코드 미연결). 신고 문구를 복사해뒀어요: " + line;
      return;
    }
    btn.disabled = true; msg.className = "msg"; msg.textContent = "전송 중…";
    try {
      const r = await fetch(CFG.REPORT_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      if (r.status === 409) {
        msg.className = "msg err"; msg.textContent = await r.text();
        btn.disabled = false; loadStatus();
        return;
      }
      if (!r.ok) throw new Error((await r.text()) || r.status);
      msg.className = "msg ok"; msg.textContent = "신고가 접수됐어요. 안전 비행하세요!";
      loadStatus();
      setTimeout(close, 1400);
    } catch (err) {
      msg.className = "msg err"; msg.textContent = "전송에 실패했어요. 잠시 후 다시 시도해주세요.";
      btn.disabled = false;
    }
  }

  // ---------- 위치 ----------
  function ago(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (isNaN(m)) return "";
    if (m < 1) return "방금 전";
    if (m < 60) return `${m}분 전`;
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
    return `${Math.floor(m / 1440)}일 전`;
  }
  async function openLoc() {
    open(`<h2>크라켄 프라이베이티어 위치</h2><p class="sub">불러오는 중…</p>`);
    try {
      const d = await (await fetch("data/location.json", { cache: "no-cache" })).json();
      open(`<h2>크라켄 프라이베이티어 위치</h2>
        <div class="loc-card">
          <div class="when">${esc(d.system)} 시스템</div>
          <div class="big">${esc(d.place)}</div>
          <div class="when">마지막 갱신 ${esc(ago(d.updated))} · ${esc(new Date(d.updated).toLocaleString("ko-KR"))}</div>
        </div>
        <p class="sub" style="margin-top:12px">${esc(d.note)}</p>`);
    } catch (_) {
      open(`<h2>크라켄 프라이베이티어 위치</h2><p class="msg err">위치 정보를 불러오지 못했어요.</p>`);
    }
  }
  $("#btnLoc").addEventListener("click", openLoc);

  go("home");
})();
