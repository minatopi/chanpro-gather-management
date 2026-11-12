"use client";
import { useEffect, useMemo, useState } from "react";
import { api, fmtFull, ago, Icon, Badge, Empty, Skeleton, ErrorBox, SearchBox, Switch, Seg, useLoad, useDebounced } from "./ui";
import { CATEGORIES, describeLog, metaOf } from "./logtext";

const KINDS = [["all", "すべて"], ["login", "認証"], ["read", "読み込み"], ["change", "変更"], ["account", "アカウント"], ["admin", "管理操作"], ["ip", "セキュリティ"], ["error", "エラー"], ["status", "ステータス"]];
const KIND_HINT = { all: "読み込みログを除いたすべて", login: "ログイン・新規作成の成功/失敗(失敗理由つき)", read: "データの読み込み(DB読み込み・閲覧など)", change: "投稿・いいね・DMなど、ユーザーが行った変更", account: "新規作成・アカウント情報の更新・アカウント削除", admin: "管理サイトのログイン・設定変更・BANなどの管理操作", ip: "BAN・アクセス集中・機能停止による拒否", error: "APIのエラー", status: "機能の停止・復旧の記録" };
const isIp = (t) => /^(\d{1,3}\.){3}\d{1,3}$/.test(t) || (t.includes(":") && /^[0-9a-f:.]+$/i.test(t));
const day = (t) => { const d = new Date(t), n = new Date(); const same = d.toDateString() === n.toDateString(); const y = new Date(n - 86400000).toDateString() === d.toDateString(); return same ? "今日" : y ? "昨日" : d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" }); };

function Line({ r }) {
  const [open, setOpen] = useState(false);
  const d = describeLog(r); const cat = CATEGORIES[d.cat] || CATEGORIES.other; const meta = metaOf(r);
  return (
    <div className={`logline ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
      <span className={`cat cat-${cat.tone}`}>{cat.label}</span>
      <div className="logmain">
        <div className={`logtext ${d.tone ? "t-" + d.tone : ""}`}>{d.text}{d.reason && <span className="logreason">{d.reason}</span>}</div>
        {(d.detail || meta.length > 0) && <div className="logmeta">{[d.detail, ...meta].filter(Boolean).join("　・　")}</div>}
        {open && <pre className="lograw">{JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !["_rowId", "_sysTime"].includes(k))), null, 2)}</pre>}
      </div>
      <div className="logtime" title={fmtFull(r._time)}>{new Date(r._time).toLocaleTimeString("ja-JP")}<span>{ago(r._time)}</span></div>
    </div>
  );
}

export function Logs({ params }) {
  const [kind, setKind] = useState(params?.kind || "all"); const [hours, setHours] = useState(24);
  const [text, setText] = useState(params?.username || ""); const q = useDebounced(text, 500); const [auto, setAuto] = useState(false);
  const { data, loading, error, reload } = useLoad(() => api(`/api/admin/axiom?kind=${kind}&hours=${hours}&${isIp(q) ? "ip" : "username"}=${encodeURIComponent(q)}`), [kind, hours, q]);
  useEffect(() => { if (!auto) return; const t = setInterval(reload, 20000); return () => clearInterval(t); }, [auto, reload]);
  const rows = data?.rows || [];
  const groups = useMemo(() => { const g = []; for (const r of rows) { const d = day(r._time); if (!g.length || g[g.length - 1].day !== d) g.push({ day: d, items: [] }); g[g.length - 1].items.push(r); } return g; }, [rows]);
  return <>
    <div className="chips">{KINDS.map(([k, l]) => <button key={k} className={`chip-btn ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>{l}</button>)}</div>
    <div className="row">
      <SearchBox value={text} onChange={setText} placeholder="ユーザー名またはIPで絞り込み" />
      <select className="select" style={{ width: 150 }} value={hours} onChange={(e) => setHours(e.target.value)}>{[[1, "直近1時間"], [24, "直近24時間"], [72, "直近3日"], [168, "直近7日"], [720, "直近30日"]].map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select>
      <label className="row sub" style={{ gap: 8 }}><Switch checked={auto} onChange={setAuto} />自動更新</label>
      <button className="btn" onClick={reload}><Icon name="refresh" size={15} />更新</button>
    </div>
    <div className="sub">{KIND_HINT[kind]}。行をクリックすると詳細(生データ)が開きます。</div>
    <ErrorBox text={error} />
    {loading && !data ? <Skeleton rows={7} /> : !rows.length ? <div className="card"><Empty icon="list" text="該当するログがありません" /></div> : (
      <div className="card loglist">
        {groups.map((g) => <div key={g.day}><div className="log-day">{g.day}<Badge tone="gray">{g.items.length}件</Badge></div>{g.items.map((r, i) => <Line key={r._time + i} r={r} />)}</div>)}
      </div>
    )}
    <div className="sub">最大300件まで表示します(新しい順)。</div>
  </>;
}
