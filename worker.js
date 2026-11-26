// 금성상회 청해진 · 이착륙 신고 → 디스코드 + 패드 사용 상태 저장 + 디스코드 슬래시 명령 (3단계)
// Cloudflare Worker. 아래 값은 코드에 쓰지 말고 대시보드의 "변수 및 비밀"에 넣어요.
//   DISCORD_WEBHOOK_URL   : 디스코드 웹후크 URL (비밀)
//   ALLOWED_ORIGIN        : 사이트 주소. 예) https://venusmc-kraken.alehuman824.workers.dev (끝에 / 없이)
//   DB                    : D1 데이터베이스 바인딩 (변수 이름 DB)
//   DISCORD_PUBLIC_KEY    : 디스코드 앱의 Public Key (변수)
//   DISCORD_APP_ID        : 디스코드 앱의 Application ID (변수)
//   DISCORD_CLIENT_SECRET : 디스코드 앱의 Client Secret (비밀, 명령어 등록할 때만 써요)
//   REGISTER_KEY          : 명령어 등록 주소를 지키는 임의의 긴 문자열 (비밀)
// 경로
//   POST /                : 사이트의 이착륙 신고
//   GET  /                : 현재 사용중인 패드 목록 {now, pads:{번호:{handle,ship,since,expires_at}}}
//   POST /discord         : 디스코드 슬래시 명령(/착륙, /이륙, /패드현황, /함선정보) 받는 곳 (Interactions Endpoint URL)
//   GET  /discord/register?key=REGISTER_KEY : 슬래시 명령을 디스코드에 등록 (처음 한 번, 명령을 바꿀 때)

const MAX = { nick: 32, ship: 60, memo: 120 };
const KINDS = ["착륙", "이륙"];
const PADS = {
  1: "소형 패드 1", 2: "소형 패드 2", 3: "소형 패드 3", 4: "소형 패드 4",
  5: "중형 패드 5", 6: "중형 패드 6",
};
// 사이트 ships.js와 같은 목록이에요 (스프레드시트 '리스트 포함 O'). 함선을 바꾸면 여기도 같이 바꿔요.
// [함선명, 크기, 소형패드(1~4), 중형패드 5, 중형패드 6] — 1 = 가능
const SHIPS = [["100 Series","S",1,0,0],["M50","S",1,0,0],["Pisces Series","S",1,0,0],["Razor Series","S",1,0,0],["Talon Series","S",0,1,1],["300 Series","S",1,0,0],["Arrow","S",1,0,0],["Aurora Mk I Series","S",1,0,0],["Aurora Mk II","S",1,0,0],["Avenger Series","S",1,0,0],["Basher","S",1,0,0],["Blade","S",1,0,0],["Buccaneer","S",1,0,0],["Clipper","S",0,1,1],["Cutter Series","S",1,0,0],["Defender","S",0,1,1],["Eclipse","S",0,1,1],["F7C Hornet Mk II Series","S",1,0,0],["F7C-M Super Hornet Mk I Series","S",1,0,0],["F8 Lightning Series","S",0,1,1],["Fortune","S",1,0,0],["Gladiator","S",1,0,0],["Gladius Series","S",1,0,0],["Golem Series","S",1,0,0],["Guardian Series","S",0,1,1],["Hawk","S",1,0,0],["Herald","S",1,0,0],["Hull A","S",1,0,0],["Hurricane","S",1,0,0],["Intrepid","S",0,1,1],["M80","S",0,1,1],["Mantis","S",0,1,1],["Meteor","S",0,1,1],["Mustang Series","S",1,0,0],["Nomad","S",0,1,1],["Prospector","S",1,0,0],["S-65 Stingray","S",1,0,0],["Sabre Series","S",0,1,1],["Salvation","S",1,0,0],["San'tok.yāi","S",1,0,0],["Scorpius Series","S",1,0,0],["Starlite","S",0,1,1],["Terrapin Series","S",1,0,0],["Vulture","S",0,1,1],["Wolf Series","S",1,0,0],["Syulen","S",1,1,1],["F7C-M Hornet Mk II Series","M",1,1,1],["Ares Series","M",0,1,1],["Cutlass Series","M",0,1,1],["Freelancer Series","M",0,1,1],["Glaive","M",0,1,1],["Khartu-al","M",1,1,1],["MOLE Series","M",0,1,1],["MOTH","M",0,1,1],["Prowler Series","M",0,1,1],["RAFT","M",0,1,1],["Reliant Series","M",1,1,1],["Scythe","M",0,1,1],["Shiv","M",0,1,0],["Spirit Series","M",0,1,0],["SRV","M",0,1,1],["Stinger","M",0,1,1],["Vanguard Series","M",0,1,1],["Constellation Mk IV Series","L",0,0,1]];

// /함선정보용 상세 데이터 (FleetYards 공개 API, 2026-11-27 기준). 값: [변형 이름, 역할, 화물 SCU, 인게임 aUEC 가격(없으면 null)]
// 가격은 인게임 상점에서 팔 때만 있고, 패치마다 바뀌어요.
const SHIP_INFO = {"100 Series":[["100i","pathfinder",2,1089270],["125a","light_fighter",2,1508220],["135c","freight",6,1490580]],"M50":[["M50","racing",0,1424430]],"Pisces Series":[["C8 Pisces","pathfinder",4,745290],["C8R Pisces","medical",0,555660],["C8X Pisces Expedition","pathfinder",4,515970]],"Razor Series":[["Razor","racing",0,1770360],["Razor EX","light_fighter",0,1669820],["Razor LX","racing",0,1831410]],"Talon Series":[["Talon","light_fighter",0,3260250],["Talon Shrike","light_fighter",0,3260250]],"300 Series":[["300i","touring",8,1375920],["315p","pathfinder",12,1490580],["325a","light_fighter",4,1852200],["350r","racing",4,3748500]],"Arrow":[["Arrow","light_fighter",0,1984500]],"Aurora Mk I Series":[["Aurora Mk I CL","freight",6,null],["Aurora Mk I ES","pathfinder",3,null],["Aurora Mk I LN","light_fighter",3,null],["Aurora Mk I LX","pathfinder",3,null],["Aurora Mk I MR","light_fighter",3,null],["Aurora Mk I SE","light_fighter",6,null]],"Aurora Mk II":[["Aurora Mk II","light_fighter",2,904932]],"Avenger Series":[["Avenger Stalker","light_fighter",0,1508220],["Avenger Titan","freight",8,1290370],["Avenger Titan Renegade","freight",8,1759590],["Avenger Warlock","light_fighter",0,2136640]],"Basher":[["Basher","light_fighter",0,3174190]],"Blade":[["Blade","light_fighter",0,7796250]],"Buccaneer":[["Buccaneer","light_fighter",0,1580040]],"Clipper":[["Clipper","generalist",12,3619730]],"Cutter Series":[["Cutter","pathfinder",4,603288],["Cutter Rambler","expedition",2,703836],["Cutter Scout","pathfinder",2,670320]],"Defender":[["Defender","light_fighter",0,6237000]],"Eclipse":[["Eclipse","bomber",0,7541100]],"F7C Hornet Mk II Series":[["F7A Hornet Mk II","medium_fighter",0,null],["F7C Hornet Mk II","medium_fighter",2,4650340],["F7C-R Hornet Tracker Mk II","pathfinder",0,4882860],["F7C-S Hornet Ghost Mk II","medium_fighter",0,5115370]],"F7C-M Super Hornet Mk I Series":[["F7C-M Super Hornet Heartseeker Mk I","medium_fighter",0,null],["F7C-M Super Hornet Mk I","medium_fighter",0,null],["F7C-M Super Hornet Mk II","medium_fighter",0,null]],"F8 Lightning Series":[["F8C Lightning","heavy_fighter",0,null],["F8C Lightning Executive Edition","heavy_fighter",0,null]],"Fortune":[["Fortune","salvage",16,1795500]],"Gladiator":[["Gladiator","bomber",0,4365900]],"Gladius Series":[["Gladius","light_fighter",0,2262330],["Gladius Pirate Edition","light_fighter",0,null],["Gladius Valiant","light_fighter",0,2765070]],"Golem Series":[["Golem","mining",0,1005480],["Golem OX","freight",64,1149120]],"Guardian Series":[["Guardian","heavy_fighter",0,6284250],["Guardian MX","heavy_fighter",0,7038360],["Guardian QI","heavy_fighter",0,null]],"Hawk":[["Hawk","light_fighter",0,2646000]],"Herald":[["Herald","data",0,1220940]],"Hull A":[["Hull A","freight",64,1615950]],"Hurricane":[["Hurricane","heavy_fighter",0,5556600]],"Intrepid":[["Intrepid","freight",8,1173060]],"M80":[["M80","heavy_fighter",2,7938000]],"Mantis":[["Mantis","light_fighter",0,3231900]],"Meteor":[["Meteor","medium_fighter",0,4309200]],"Mustang Series":[["Mustang Alpha","freight",4,610470],["Mustang Beta","pathfinder",0,622440],["Mustang Delta","light_fighter",0,1228500],["Mustang Gamma","racing",0,1178100],["Mustang Omega","racing",0,null]],"Nomad":[["Nomad","freight",24,1436400]],"Prospector":[["Prospector","mining",0,2783020]],"S-65 Stingray":[["S-65 Stingray","medium_fighter",0,null]],"Sabre Series":[["Sabre","medium_fighter",0,4273290],["Sabre Comet","medium_fighter",0,4650340],["Sabre Firebird","medium_fighter",0,5580410],["Sabre Peregrine","racing",0,3845960],["Sabre Raven","medium_fighter",0,null],["Sabre Raven EX","medium_fighter",0,null]],"Salvation":[["Salvation","salvage",6,1185030]],"San'tok.yāi":[["San'tok.yāi","medium_fighter",0,9355500]],"Scorpius Series":[["Scorpius","heavy_fighter",0,5171040],["Scorpius Antares","heavy_fighter",0,4955580]],"Starlite":[["Starlite","refuel",0,1058400]],"Terrapin Series":[["Terrapin","pathfinder",0,5433120],["Terrapin Medic","medical",0,5704770]],"Vulture":[["Vulture","salvage",12,2513700]],"Wolf Series":[["L-21 Wolf","light_fighter",0,2381400],["L-22 Alpha Wolf","light_fighter",0,4536000]],"Syulen":[["Syulen","pathfinder",6,2082500]],"F7C-M Hornet Mk II Series":[["F7A Hornet Mk II","medium_fighter",0,null],["F7C Hornet Mk II","medium_fighter",2,4650340],["F7C-R Hornet Tracker Mk II","pathfinder",0,4882860],["F7C-S Hornet Ghost Mk II","medium_fighter",0,5115370]],"Ares Series":[["Ares Inferno","heavy_fighter",0,4725000],["Ares Ion","heavy_fighter",0,4725000]],"Cutlass Series":[["Cutlass Black","medium_fighter",46,2010960],["Cutlass Blue","medium_fighter",12,3519180],["Cutlass Red","medical",12,2714800],["Cutlass Steel","dropship",0,3797480]],"Freelancer Series":[["Freelancer","freight",66,2962580],["Freelancer DUR","expedition",36,3151100],["Freelancer MAX","freight",120,4039880],["Freelancer MIS","gunship",36,4713190]],"Glaive":[["Glaive","medium_fighter",0,null]],"Khartu-al":[["Khartu-al","light_fighter",0,7229250]],"MOLE Series":[["MOLE","mining",32,8483740]],"MOTH":[["MOTH","salvage",224,8483740]],"Prowler Series":[["Prowler","dropship",0,18711000],["Prowler Utility","freight",32,16839000]],"RAFT":[["RAFT","freight",192,3366560]],"Reliant Series":[["Reliant Kore","freight",6,1633900],["Reliant Mako","data",0,2388020],["Reliant Sen","science",0,2136640],["Reliant Tana","light_fighter",1,1885280]],"Scythe":[["Scythe","medium_fighter",0,null]],"Shiv":[["Shiv","heavy_fighter",32,5556600]],"Spirit Series":[["A1 Spirit","bomber",0,4961250],["C1 Spirit","freight",64,3118500],["E1 Spirit","passenger",64,null]],"SRV":[["SRV","recovery",12,3770550]],"Stinger":[["Stinger","heavy_fighter",0,8930250]],"Vanguard Series":[["Vanguard Harbinger","heavy_fighter",0,8200400],["Vanguard Hoplite","dropship",0,6645250],["Vanguard Sentinel","heavy_fighter",0,7776700],["Vanguard Warden","heavy_fighter",0,7354900]],"Constellation Mk IV Series":[["Constellation Mk IV Andromeda","gunship",96,9652610],["Constellation Mk IV Aquila","expedition",96,11577400],["Constellation Mk IV Phoenix","touring",80,14076700],["Constellation Mk IV Taurus","freight",174,7641650]]};
const ROLE_KO = { light_fighter: "경전투기", medium_fighter: "중형 전투기", heavy_fighter: "중무장 전투기", snub_fighter: "스눕 전투기", fighter: "전투기", freight: "화물", mining: "채굴", salvage: "인양", medical: "의료", expedition: "탐사", pathfinder: "정찰·탐색", touring: "관광", racing: "레이싱", bomber: "폭격", gunship: "건쉽", dropship: "강습 수송", interdiction: "차단", refuel: "급유", repair: "수리", data: "데이터", science: "과학", passenger: "여객", generalist: "범용", recovery: "구조·회수", starter: "입문" };

const EXPIRE_MS = 30 * 60 * 1000; // 착륙 후 자동 해제까지 30분

let ready; // 테이블 준비는 인스턴스당 한 번만
const initDb = (db) => (ready ??= (async () => {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS pads (pad_id INTEGER PRIMARY KEY, handle TEXT NOT NULL, ship TEXT NOT NULL, since INTEGER NOT NULL, expires_at INTEGER NOT NULL)"
  ).run();
  await db.prepare("ALTER TABLE pads ADD COLUMN discord_id TEXT").run().catch(() => {}); // 이미 있으면 무시
  await db.prepare("CREATE TABLE IF NOT EXISTS user_handles (discord_id TEXT PRIMARY KEY, handle TEXT NOT NULL)").run();
})().catch((e) => { ready = undefined; throw e; }));

const clean = (v, n) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);
const shipPool = (pad) => {
  const col = pad <= 4 ? 2 : pad === 5 ? 3 : 4; // [이름, 크기, 소형패드, 중형5, 중형6]
  return SHIPS.filter((s) => s[col] === 1).map((s) => s[0]);
};

// ---------- 신고 처리 (사이트와 디스코드 명령이 같이 써요) ----------
async function report(env, { pad, kind, nick, ship, memo, discordId = null, via }) {
  const padId = Number(pad);
  kind = clean(kind, 4); nick = clean(nick, MAX.nick); ship = clean(ship, MAX.ship); memo = clean(memo, MAX.memo);
  const landing = kind === "착륙";

  if (!PADS[padId]) return { status: 400, text: "패드 번호가 올바르지 않아요." };
  if (!KINDS.includes(kind)) return { status: 400, text: "착륙/이륙 구분이 올바르지 않아요." };
  if (!nick || (landing && !ship)) return { status: 400, text: "닉네임과 함선을 입력해주세요." };

  let occupied = false;
  if (env.DB) {
    try {
      await initDb(env.DB);
      const now = Date.now();
      if (landing) {
        // 비어 있거나 만료됐거나 같은 사람일 때만 점유돼요 (한 문장으로 처리해서 동시 신청에도 안전해요).
        const res = await env.DB.prepare(
          "INSERT INTO pads (pad_id, handle, ship, since, expires_at, discord_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
          "ON CONFLICT(pad_id) DO UPDATE SET handle = excluded.handle, ship = excluded.ship, since = excluded.since, expires_at = excluded.expires_at, discord_id = excluded.discord_id " +
          "WHERE pads.expires_at <= ?4 OR lower(pads.handle) = lower(excluded.handle) OR (excluded.discord_id IS NOT NULL AND pads.discord_id = excluded.discord_id)"
        ).bind(padId, nick, ship, now, now + EXPIRE_MS, discordId).run();
        if (!res.meta.changes) {
          const cur = await env.DB.prepare("SELECT handle, ship FROM pads WHERE pad_id = ?").bind(padId).first();
          return { status: 409, text: `${PADS[padId]}은(는) 이미 ${cur ? cur.handle + " (" + cur.ship + ")" : "다른 분"}이 사용 중이에요.` };
        }
        occupied = true;
      } else {
        const cur = await env.DB.prepare("SELECT handle, ship, discord_id FROM pads WHERE pad_id = ? AND expires_at > ?").bind(padId, now).first();
        if (cur && discordId && cur.discord_id === discordId) nick = cur.handle; // 내가 착륙한 패드면 그 핸들로 기록해요
        const res = await env.DB.prepare(
          "DELETE FROM pads WHERE pad_id = ?1 AND (lower(handle) = lower(?2) OR expires_at <= ?3 OR (?4 IS NOT NULL AND discord_id = ?4))"
        ).bind(padId, nick, now, discordId).run();
        if (!res.meta.changes && cur) {
          return { status: 409, text: `${PADS[padId]}은(는) ${cur.handle} (${cur.ship})이 사용 중이라 다른 핸들로는 이륙 신고를 할 수 없어요.` };
        }
        if (!ship) ship = cur?.ship || "-";
      }
    } catch { return { status: 500, text: "패드 상태를 저장하지 못했어요." }; }
  }
  if (!ship) ship = "-";

  const payload = {
    // 닉네임·메모에 @everyone 같은 멘션이 들어 있어도 알림이 가지 않게 막아요.
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `${landing ? "🛬 착륙" : "🛫 이륙"} 신고 · ${PADS[padId]}`,
      color: landing ? 0x4cc38a : 0xd4af5a,
      fields: [
        { name: "인게임 핸들", value: nick, inline: true },
        { name: "함선", value: ship, inline: true },
        ...(memo ? [{ name: "메모", value: memo }] : []),
      ],
      footer: { text: `금성상회 청해진 ${via}${landing && env.DB ? " · 착륙 30분 뒤 자동 해제" : ""}` },
      timestamp: new Date().toISOString(),
    }],
  };
  const r = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!r.ok) {
    // 디스코드 전송이 실패하면 방금 잡은 패드를 되돌려요.
    if (occupied) await env.DB.prepare("DELETE FROM pads WHERE pad_id = ? AND lower(handle) = lower(?)").bind(padId, nick).run().catch(() => {});
    return { status: 502, text: "디스코드 전송에 실패했어요." };
  }
  return { status: 200, text: "ok", nick, landing, padName: PADS[padId] };
}

// ---------- 디스코드 슬래시 명령 ----------
const padChoices = Object.entries(PADS).map(([v, name]) => ({ name, value: Number(v) }));
const COMMANDS = [
  {
    name: "패드현황", description: "크라켄 패드 6개의 사용 현황 보기", type: 1, contexts: [0], integration_types: [0],
  },
  {
    name: "함선정보", description: "함선의 역할·화물·가격과 착륙 가능한 패드 보기", type: 1, contexts: [0], integration_types: [0],
    options: [
      { type: 3, name: "함선", description: "함선 이름 (입력하면 목록이 나와요)", required: true, autocomplete: true },
    ],
  },
  {
    name: "착륙", description: "크라켄 패드에 착륙 신고", type: 1, contexts: [0], integration_types: [0],
    options: [
      { type: 4, name: "패드", description: "착륙할 패드", required: true, choices: padChoices },
      { type: 3, name: "함선", description: "함선 이름 (입력하면 목록이 나와요)", required: true, autocomplete: true },
      { type: 3, name: "핸들", description: "인게임 핸들 (한 번 쓰면 기억해요)", required: false, max_length: MAX.nick },
      { type: 3, name: "메모", description: "메모 (선택)", required: false, max_length: MAX.memo },
    ],
  },
  {
    name: "이륙", description: "크라켄 패드에서 이륙 신고", type: 1, contexts: [0], integration_types: [0],
    options: [
      { type: 4, name: "패드", description: "이륙하는 패드", required: true, choices: padChoices },
      { type: 3, name: "핸들", description: "인게임 핸들 (착륙할 때 쓴 것)", required: false, max_length: MAX.nick },
      { type: 3, name: "메모", description: "메모 (선택)", required: false, max_length: MAX.memo },
    ],
  },
];

const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
async function verifySignature(request, body, publicKey) {
  const sig = request.headers.get("X-Signature-Ed25519");
  const ts = request.headers.get("X-Signature-Timestamp");
  if (!sig || !ts || !publicKey) return false;
  const data = new TextEncoder().encode(ts + body);
  for (const alg of [{ name: "Ed25519" }, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }]) {
    let key;
    try { key = await crypto.subtle.importKey("raw", hex(publicKey), alg, false, ["verify"]); } catch { continue; }
    try { return await crypto.subtle.verify(alg, key, hex(sig), data); } catch { return false; }
  }
  return false;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const say = (content) => json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } }); // 나에게만 보이는 답

// 나에게만 보이는 임베드 답
const sayEmbed = (embed) => json({ type: 4, data: { embeds: [embed], flags: 64, allowed_mentions: { parse: [] } } });
const won = (n) => n.toLocaleString("en-US") + " aUEC";

// ---------- /패드현황 ----------
async function padStatus(env) {
  if (!env.DB) return say("패드 상태 저장소가 아직 연결되지 않았어요.");
  let rows;
  try {
    await initDb(env.DB);
    const now = Date.now();
    ({ results: rows } = await env.DB.prepare("SELECT pad_id, handle, ship, expires_at FROM pads WHERE expires_at > ?").bind(now).all());
  } catch { return say("패드 상태를 불러오지 못했어요. 잠시 뒤에 다시 해주세요."); }
  const by = Object.fromEntries(rows.map((r) => [r.pad_id, r]));
  const now = Date.now();
  const used = rows.length;
  const fields = Object.entries(PADS).map(([id, name]) => {
    const r = by[id];
    const value = r
      ? `🔴 사용 중\n${r.handle} · ${r.ship}\n약 ${Math.max(1, Math.ceil((r.expires_at - now) / 60000))}분 뒤 자동 해제`
      : "🟢 비어 있어요";
    return { name, value, inline: true };
  });
  return sayEmbed({
    title: "⚓ 청해진 패드 현황",
    description: used === 0 ? "지금은 패드가 모두 비어 있어요. 편하게 입항하세요!" : `${Object.keys(PADS).length}개 중 ${used}개 사용 중이에요.`,
    color: used === Object.keys(PADS).length ? 0xd9534f : 0x4cc38a,
    fields,
    footer: { text: "착륙은 /착륙, 이륙은 /이륙으로 신고해주세요" },
    timestamp: new Date().toISOString(),
  });
}

// ---------- /함선정보 ----------
function shipInfo(name) {
  const s = SHIPS.find((x) => x[0].toLowerCase() === name.toLowerCase());
  if (!s) return say("❌ 목록에서 함선을 골라주세요. 입력하면 나오는 후보 중에서 선택하면 돼요.");
  const [shipName, size, p14, p5, p6] = s;
  const sizeKo = { S: "소형", M: "중형", L: "대형" }[size] || size;
  const pads = [p14 ? "소형 패드 1~4" : "", p5 ? "중형 패드 5" : "", p6 ? "중형 패드 6" : ""].filter(Boolean).join(", ") || "-";
  const variants = SHIP_INFO[shipName] || [];
  const lines = variants.map(([vn, role, cargo, price]) =>
    `**${vn}** · ${ROLE_KO[role] || role} · 화물 ${cargo ? cargo + " SCU" : "없음"} · ${price ? won(price) : "인게임 판매 안 함"}`);
  return sayEmbed({
    title: `🚀 ${shipName}`,
    color: 0xd4af5a,
    fields: [
      { name: "크기", value: sizeKo, inline: true },
      { name: "착륙 가능한 패드", value: pads, inline: true },
      ...(lines.length ? [{ name: variants.length > 1 ? `변형 ${variants.length}종` : "정보", value: lines.join("\n").slice(0, 1024) }] : []),
    ],
    footer: { text: "출처: FleetYards (2026-11-27 기준) · 가격은 패치마다 달라질 수 있어요" },
  });
}

async function handleDiscord(request, env) {
  const body = await request.text();
  if (!(await verifySignature(request, body, env.DISCORD_PUBLIC_KEY))) return new Response("invalid signature", { status: 401 });
  let it;
  try { it = JSON.parse(body); } catch { return new Response("bad request", { status: 400 }); }

  if (it.type === 1) return json({ type: 1 }); // PING

  const optList = it.data?.options || [];
  const opts = Object.fromEntries(optList.map((o) => [o.name, o.value]));

  if (it.type === 4) { // 자동완성: 함선 이름
    const q = String(optList.find((o) => o.focused)?.value ?? "").toLowerCase();
    const pool = it.data?.name === "함선정보" ? SHIPS.map((s) => s[0]) : shipPool(Number(opts["패드"]) || 1);
    const starts = pool.filter((s) => s.toLowerCase().startsWith(q));
    const has = pool.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    const choices = [...starts, ...has].slice(0, 25).map((s) => ({ name: s, value: s }));
    return json({ type: 8, data: { choices } });
  }

  if (it.type !== 2) return say("지원하지 않는 요청이에요.");

  const kind = it.data?.name;
  if (kind === "패드현황") return padStatus(env);
  if (kind === "함선정보") return shipInfo(clean(opts["함선"], MAX.ship));
  if (!KINDS.includes(kind)) return say("알 수 없는 명령이에요.");
  const pad = Number(opts["패드"]);
  const user = it.member?.user || it.user || {};
  const discordId = user.id || null;
  const display = it.member?.nick || user.global_name || user.username || "";

  let ship = "";
  if (kind === "착륙") {
    ship = clean(opts["함선"], MAX.ship);
    if (!shipPool(pad).includes(ship)) {
      return say(`❌ ${PADS[pad] || "그 패드"}에 맞는 함선이 아니에요. 입력하면 나오는 목록에서 골라주세요.`);
    }
  }

  // 핸들: 직접 입력 > 전에 기억해 둔 것 > 디스코드 별명
  let nick = clean(opts["핸들"], MAX.nick), remembered = false;
  if (env.DB && discordId) {
    try {
      await initDb(env.DB);
      if (nick) {
        await env.DB.prepare("INSERT INTO user_handles (discord_id, handle) VALUES (?1, ?2) ON CONFLICT(discord_id) DO UPDATE SET handle = excluded.handle").bind(discordId, nick).run();
      } else {
        const row = await env.DB.prepare("SELECT handle FROM user_handles WHERE discord_id = ?").bind(discordId).first();
        if (row) { nick = row.handle; remembered = true; }
      }
    } catch { /* 기억 기능이 안 돼도 신고는 계속해요 */ }
  }
  const usedDisplay = !nick;
  if (!nick) nick = clean(display, MAX.nick);

  const res = await report(env, { pad, kind, nick, ship, memo: opts["메모"], discordId, via: "디스코드 명령" });
  if (res.status !== 200) return say(`❌ ${res.text}`);
  let msg = `✅ ${res.padName} ${kind} 신고 완료 · ${res.nick}${res.landing ? " · 30분 뒤 자동 해제돼요" : ""}`;
  if (usedDisplay) msg += `\n디스코드 별명으로 신고했어요. 인게임 핸들이 다르면 \`핸들\` 칸에 한 번 입력해주세요. 다음부터 기억해요.`;
  else if (remembered && kind === "착륙") msg += "\n(기억해 둔 핸들이에요. 바꾸려면 `핸들` 칸에 입력하세요.)";
  return say(msg);
}

// ---------- 명령어 등록 (브라우저로 주소를 열면 실행돼요) ----------
async function registerCommands(request, env) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.REGISTER_KEY || key !== env.REGISTER_KEY) return new Response("forbidden", { status: 403 });
  if (!env.DISCORD_APP_ID || !env.DISCORD_CLIENT_SECRET) return new Response("DISCORD_APP_ID / DISCORD_CLIENT_SECRET 이 필요해요.", { status: 500 });
  const t = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.DISCORD_APP_ID}:${env.DISCORD_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials&scope=applications.commands.update",
  });
  if (!t.ok) return new Response("토큰 발급 실패 (" + t.status + "): Client Secret을 확인해주세요.", { status: 502 });
  const { access_token } = await t.json();
  const r = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
    body: JSON.stringify(COMMANDS),
  });
  const text = await r.text();
  return new Response(r.ok ? `등록 완료! (${COMMANDS.map((c) => "/" + c.name).join(", ")})` : `등록 실패 (${r.status}): ${text}`, { status: r.ok ? 200 : 502 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/discord" && request.method === "POST") return handleDiscord(request, env);
    if (url.pathname === "/discord/register" && request.method === "GET") return registerCommands(request, env);

    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (status, text) => new Response(text, { status, headers: cors });

    if (request.method === "OPTIONS") return reply(204, null);

    if (request.method === "GET") {
      if (!env.DB) return reply(503, "저장소가 아직 연결되지 않았어요.");
      try {
        await initDb(env.DB);
        const now = Date.now();
        const { results } = await env.DB.prepare(
          "SELECT pad_id, handle, ship, since, expires_at FROM pads WHERE expires_at > ?"
        ).bind(now).all();
        const pads = {};
        for (const r of results) pads[r.pad_id] = { handle: r.handle, ship: r.ship, since: r.since, expires_at: r.expires_at };
        return new Response(JSON.stringify({ now, pads }), {
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      } catch { return reply(500, "상태를 불러오지 못했어요."); }
    }

    if (request.method !== "POST") return reply(405, "POST만 가능해요.");
    if (!allowed || origin !== allowed) return reply(403, "허용되지 않은 주소예요.");

    let b;
    try { b = await request.json(); } catch { return reply(400, "형식이 올바르지 않아요."); }

    // 숨김 칸(website)이 채워져 있으면 봇이에요. 성공한 척하고 버려요.
    if (b.website) return reply(200, "ok");

    const res = await report(env, { pad: b.pad, kind: b.kind, nick: b.nick, ship: b.ship, memo: b.memo, via: "사이트" });
    return reply(res.status, res.text);
  },
};
