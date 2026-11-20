"use client";
import { useEffect, useState } from "react";
import { api, ago, fmtFull, Icon, Badge, Empty, Skeleton, ErrorBox, SearchBox, Switch, useLoad, useDebounced, useUI } from "./ui";

const SOURCES = [["all", "すべて"], ["post", "投稿"], ["chat", "チャット"], ["profile", "プロフィール"], ["ai", "AI"]];
const TONE = { post: "blue", chat: "green", profile: "gray", music: "violet", ai: "violet", upload: "violet", generated: "violet" };

function Thumb({ it, blur, onOpen }) {
  const [bad, setBad] = useState(false); const [shown, setShown] = useState(false);
  return (
    <div className="imgcard" onClick={() => (blur && !shown ? setShown(true) : onOpen())}>
      {bad ? <div className="imgbad"><Icon name="alert" /><span>読み込めません</span></div>
        : <img src={it.url} alt="" loading="lazy" referrerPolicy="no-referrer" className={blur && !shown ? "blurred" : ""} onError={() => setBad(true)} />}
      <div className="imgcap"><Badge tone={TONE[it.source] || "gray"}>{it.label}</Badge><span className="imgname">{it.username || (it.user_id ? "ID " + String(it.user_id).slice(0, 6) : "不明")}</span></div>
    </div>
  );
}

function Lightbox({ list, index, setIndex, go, onClose }) {
  const { toast } = useUI(); const it = list[index];
  useEffect(() => {
    const f = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft" && index > 0) setIndex(index - 1); if (e.key === "ArrowRight" && index < list.length - 1) setIndex(index + 1); };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, [index, list.length]); // eslint-disable-line
  return (
    <div className="overlay lightbox-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lightbox">
        <div className="lb-img"><img src={it.url} alt="" referrerPolicy="no-referrer" /></div>
        <div className="lb-side">
          <div className="row" style={{ justifyContent: "space-between" }}><Badge tone={TONE[it.source] || "gray"}>{it.label}</Badge><button className="btn ghost sm" onClick={onClose}><Icon name="x" /></button></div>
          <div className="stack" style={{ gap: 8 }}>
            <div><div className="sub">ユーザー</div><b>{it.username || (it.user_id ? "ID " + it.user_id : "不明")}</b></div>
            <div><div className="sub">日時</div><span title={fmtFull(it.at)}>{it.at ? `${fmtFull(it.at)}(${ago(it.at)})` : "不明(日時の記録なし)"}</span></div>
            {it.ref && <div><div className="sub">投稿ID</div><span className="mono">{it.ref}</span></div>}
            {it.extra && <div><div className="sub">生成の指示(AI)</div><span style={{ wordBreak: "break-word" }}>{it.extra}</span></div>}
            <div><div className="sub">URL</div><span className="mono" style={{ wordBreak: "break-all", fontSize: 11 }}>{it.url}</span></div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn sm primary" href={it.url} target="_blank" rel="noopener noreferrer">新しいタブで開く</a>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(it.url); toast("URLをコピーしました"); }}>URLをコピー</button>
            {it.username && <button className="btn sm" onClick={() => go("users", { q: it.username })}>ユーザーを開く</button>}
            {it.username && <button className="btn sm soft-danger" onClick={() => go("bans", { username: it.username })}>BAN管理へ</button>}
            {it.delete_url && <a className="btn sm soft-danger" href={it.delete_url} target="_blank" rel="noopener noreferrer">ImgBBの削除ページ</a>}
          </div>
          <div className="row" style={{ marginTop: "auto", justifyContent: "space-between" }}>
            <button className="btn sm" disabled={index <= 0} onClick={() => setIndex(index - 1)}>← 前へ</button><span className="sub">{index + 1} / {list.length}</span><button className="btn sm" disabled={index >= list.length - 1} onClick={() => setIndex(index + 1)}>次へ →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Images({ go }) {
  const [source, setSource] = useState("all"); const [text, setText] = useState(""); const q = useDebounced(text, 500);
  const [blur, setBlur] = useState(false); const [limit, setLimit] = useState(80); const [open, setOpen] = useState(-1);
  const { data, loading, error, reload } = useLoad(() => api(`/api/admin/images?source=${source}&username=${encodeURIComponent(q)}&limit=${limit}`), [source, q, limit]);
  const imgs = data?.images || [];
  return <>
    <div className="chips">{SOURCES.map(([k, l]) => <button key={k} className={`chip-btn ${source === k ? "on" : ""}`} onClick={() => setSource(k)}>{l}</button>)}</div>
    <div className="row">
      <SearchBox value={text} onChange={setText} placeholder="ユーザー名で絞り込み" />
      <label className="row sub" style={{ gap: 8 }}><Switch checked={blur} onChange={setBlur} />ぼかして表示(クリックで表示)</label>
      <button className="btn" onClick={reload}><Icon name="refresh" size={15} />更新</button>
    </div>
    <ErrorBox text={error} />
    {data?.notes?.length > 0 && <div className="notice warn"><Icon name="alert" /><span>{data.notes.join(" / ")}</span></div>}
    {loading && !data ? <Skeleton rows={4} /> : !imgs.length ? <div className="card"><Empty icon="inbox" text="画像がありません(投稿・チャット・AIの画像は、APIの新しい版を反映すると、URLがログにも残り表示されます)" /></div> : <>
      <div className="imggrid">{imgs.map((it, i) => <Thumb key={it.url} it={it} blur={blur} onOpen={() => setOpen(i)} />)}</div>
      {imgs.length >= limit && <div><button className="btn" onClick={() => setLimit(limit + 80)}>さらに読み込む</button></div>}
    </>}
    {open >= 0 && imgs[open] && <Lightbox list={imgs} index={open} setIndex={setOpen} go={go} onClose={() => setOpen(-1)} />}
    <div className="sub">投稿・チャット・プロフィールの画像はSupabaseから、AIへ送った画像・AI生成画像と、アップロードの記録はAxiomから集めています。同じ画像は1枚にまとめます。</div>
  </>;
}
