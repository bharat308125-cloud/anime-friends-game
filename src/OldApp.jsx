import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes('YOUR_PROJECT') ? createClient(url, key) : null;

const ONE_PIECE = [
  ['Luffy','/characters/luffy.jpg'],['Zoro','/characters/zoro.jpg'],
  ['Nami','/characters/nami.jpg'],['Usopp','/characters/usopp.jpg'],
  ['Sanji','/characters/sanji.jpg'],['Chopper','/characters/chopper.jpg'],
  ['Robin','/characters/robin.jpg'],['Franky','/characters/franky.jpg'],
  ['Brook','/characters/brook.png'],['Jinbe','/characters/jinbe.jpg'],
];
const JUJUTSU_KAISEN = [
  ['Satoru Gojo','/characters/gojo.jpg'],['Yuji Itadori','/characters/yuji.jpg'],
  ['Megumi Fushiguro','/characters/megumi.jpg'],['Nobara Kugisaki','/characters/nobara.jpg'],
  ['Kento Nanami','/characters/nanami.jpg'],['Maki Zenin','/characters/maki.jpg'],
  ['Panda','/characters/panda.jpg'],['Aoi Todo','/characters/todo.jpg'],
  ['Toji Fushiguro','/characters/toji.jpg'],['Ryomen Sukuna','/characters/sukuna.jpg'],
];

const makeId = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID().replaceAll('-','').slice(0,16)
  : (Math.random().toString(36).slice(2)+Date.now().toString(36)).slice(0,16));
const readGameId = () => window.location.pathname.match(/\/game\/([a-zA-Z0-9]+)/)?.[1]
  || new URLSearchParams(window.location.search).get('game');
const dataUrl = file => new Promise((resolve,reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function App() {
  const [page,setPage] = useState('home');
  const [theme,setTheme] = useState('one_piece');
  const [gameId,setGameId] = useState(readGameId());
  const [ownerName,setOwnerName] = useState('');
  const [friends,setFriends] = useState(Array.from({length:10},(_,i)=>({name:`Friend ${i+1}`,file:null,preview:'',path:''})));
  const [game,setGame] = useState(null);
  const [matches,setMatches] = useState({});
  const [participant,setParticipant] = useState('');
  const [loading,setLoading] = useState(false);
  const [notice,setNotice] = useState('');
  const [resolvedFriends,setResolvedFriends] = useState([]);
  const [pickedFriend,setPickedFriend] = useState(null);
  const resultRef = useRef(null);

  const characters = useMemo(()=>theme === 'jujutsu_kaisen' ? JUJUTSU_KAISEN : ONE_PIECE,[theme]);
  const shareUrl = gameId ? `${window.location.origin}/game/${gameId}` : '';
  const isConfigured = Boolean(supabase);

  useEffect(()=>{ const id=readGameId(); if(id){setGameId(id);loadGame(id);} },[]); // initial URL only

  async function loadGame(id) {
    if(!supabase){setNotice('Online mode is not configured. Check your Supabase settings.');return;}
    setLoading(true);setNotice('');
    try {
      const {data,error}=await supabase.from('games').select('*').eq('id',id).maybeSingle();
      if(error) throw error;
      if(!data){setNotice('Game not found. Check that the shared link is correct.');return;}
      setGame(data);setGameId(data.id);setTheme(data.theme||'one_piece');setMatches({});setParticipant('');setResolvedFriends([]);setPage('play');
    } catch(e){setNotice(`Could not load the game: ${e.message||'Please try again.'}`);}
    finally{setLoading(false);}
  }

  async function choosePhoto(index,file) {
    if(!file)return;
    if(!file.type.startsWith('image/')){setNotice('Please select an image file.');return;}
    if(file.size>8*1024*1024){setNotice('Each photo must be 8 MB or smaller.');return;}
    try {
      const preview=await dataUrl(file);
      setFriends(prev=>prev.map((f,i)=>i===index?{...f,file,preview}:f));setNotice('');
    } catch {setNotice('Could not open that photo. Please try another.');}
  }

  async function createGame(event) {
    event.preventDefault();
    if(!supabase){setNotice('Supabase is not connected. Check your project environment variables.');return;}
    if(!ownerName.trim()){setNotice('Please enter your name or nickname.');return;}
    if(friends.some(f=>!f.file)){setNotice('Please upload all 10 friends’ photos first.');return;}
    setLoading(true);setNotice('');
    const id=makeId();const uploaded=[];
    try {
      const stored=[];
      for(let i=0;i<friends.length;i++){
        const f=friends[i];
        const ext=(f.file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`${id}/${i+1}-${makeId()}.${ext}`;
        const {error}=await supabase.storage.from('friend-photos').upload(path,f.file,{upsert:false,contentType:f.file.type});
        if(error)throw error;
        uploaded.push(path);stored.push({name:f.name.trim()||`Friend ${i+1}`,path});
      }
      const {error}=await supabase.from('games').insert({id,owner_name:ownerName.trim(),theme,friends:stored});
      if(error)throw error;
      setGameId(id);window.history.pushState({},' ',`/game/${id}`);await loadGame(id);
      setNotice('Game created! Share the link with your friends.');
    } catch(e) {
      if(uploaded.length){try{await supabase.storage.from('friend-photos').remove(uploaded);}catch{}}
      setNotice(`Could not create the game: ${e.message||'Please check your Supabase setup.'}`);
    } finally{setLoading(false);}
  }

  useEffect(()=>{
    let active=true;
    async function resolve(){
      if(!game?.friends||!supabase)return;
      try {
        const list=await Promise.all(game.friends.map(async(f,index)=>{
          const {data}=supabase.storage.from('friend-photos').getPublicUrl(f.path);
          return {...f,index,url:data.publicUrl};
        }));
        if(active)setResolvedFriends(list);
      } catch {if(active)setNotice('Could not load the friends’ photos.');}
    }
    resolve();return()=>{active=false;};
  },[game]);

  const activeFriends=game?resolvedFriends:friends.map((f,index)=>({...f,index,url:f.preview}));
  const used=new Set(Object.values(matches).map(String));
  const availableFriends=activeFriends.filter(f=>!used.has(String(f.index)));

  function assignFriend(characterIndex,friendIndex) {
    if(friendIndex===null||friendIndex===undefined||friendIndex==='')return;
    setMatches(prev=>{
      const next={...prev};
      Object.keys(next).forEach(k=>{if(String(next[k])===String(friendIndex))delete next[k];});
      next[characterIndex]=String(friendIndex);
      return next;
    });
    setPickedFriend(null);setNotice('');
  }
  function dropOn(event,index) {
    event.preventDefault();
    const id=event.dataTransfer.getData('text/plain')||pickedFriend;
    if(id!==null&&id!=='')assignFriend(index,id);
  }
  function tapFriend(index) {
    setPickedFriend(String(index));
    setNotice('Now tap the center square beside the character you want.');
  }
  function tapDrop(index) {
    if(pickedFriend===null){setNotice('First tap a friend on the right, then tap a center square.');return;}
    assignFriend(index,pickedFriend);
  }

  async function submitMatches() {
    if(!participant.trim()){setNotice('Please enter your name or nickname.');return;}
    if(Object.keys(matches).length!==10){setNotice('Please match all 10 characters.');return;}
    if(new Set(Object.values(matches).map(String)).size!==10){setNotice('Each friend can only be matched with one character.');return;}
    if(!supabase){setNotice('The online database is not connected.');return;}
    setLoading(true);setNotice('');
    try {
      const {error}=await supabase.from('submissions').insert({game_id:gameId,participant_name:participant.trim(),matches});
      if(error)throw error;
      setPage('result');setNotice('Your matches have been submitted!');
    } catch(e){setNotice(`Submission failed: ${e.message||'Please try again.'}`);}
    finally{setLoading(false);}
  }

  async function downloadJpg() {
    if(!resultRef.current)return;
    setNotice('Preparing your JPG…');
    try {
      const canvas=await html2canvas(resultRef.current,{useCORS:true,scale:2,backgroundColor:'#07192b'});
      const link=document.createElement('a');link.download=`charamatch-${gameId||'result'}.jpg`;
      link.href=canvas.toDataURL('image/jpeg',.94);link.click();setNotice('JPG downloaded successfully!');
    } catch {setNotice('JPG export failed. Please check your connection and try again.');}
  }
  async function shareLink() {
    if(!shareUrl){setNotice('There is no game link to share yet.');return;}
    try {
      if(navigator.share) await navigator.share({title:'CharaMatch',text:`Match our friends with ${theme==='jujutsu_kaisen'?'Jujutsu Kaisen':'One Piece'} characters!`,url:shareUrl});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(shareUrl);setNotice('Game link copied. Paste it into WhatsApp.');}
      else setNotice(`Copy this game link: ${shareUrl}`);
    } catch {setNotice('Sharing was cancelled or is unavailable.');}
  }

  if(page==='home') return (
    <main className="shell">
      <header className="top"><div className="brand-mark">☠</div><div><div className="eyebrow">CHARAMATCH</div><h1>Match your <span>crew</span></h1></div></header>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">PICK YOUR UNIVERSE</p><h2>Which anime character<br/>is your friend?</h2><p>Upload your crew once, share a game link, and see which characters your friends choose.</p></div><div className="hero-stamp">WANTED<br/><strong>YOUR<br/>CREW</strong><small>FUN ONLY • NO SCORES</small></div></section>
      <form className="panel" onSubmit={createGame}>
        <h3>01 / Create your game</h3>
        <label className="field-label">Your name or nickname<input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Bharat" maxLength="40"/></label>
        <h4>Choose your anime world</h4>
        <div className="themes">
          <button type="button" className={`theme-card ${theme==='one_piece'?'selected':''}`} onClick={()=>setTheme('one_piece')}><span className="theme-icon">🏴‍☠️</span><b>ONE PIECE</b><small>Available now</small></button>
          <button type="button" className={`theme-card ${theme==='jujutsu_kaisen'?'selected':''}`} onClick={()=>setTheme('jujutsu_kaisen')}><span className="theme-icon">👊</span><b>JUJUTSU KAISEN</b><small>{theme==='jujutsu_kaisen'?'Selected ✓':'Choose this world'}</small></button>
        </div>
        <h3>02 / Upload 10 friends</h3>
        <p className="subtle">Choose one photo per friend. Anyone with your game link may be able to view these photos.</p>
        <div className="upload-grid">{friends.map((f,i)=><div className="upload-card" key={i}>
          <label className="photo-pick">{f.preview?<img src={f.preview} alt=""/>:<span className="plus">+</span>}<input type="file" accept="image/*" onChange={e=>choosePhoto(i,e.target.files?.[0])}/><span className="photo-number">{String(i+1).padStart(2,'0')}</span></label>
          <input className="friend-name" value={f.name} maxLength="40" onChange={e=>setFriends(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))} aria-label={`Friend ${i+1} name`}/>
        </div>)}</div>
        <button className="primary" type="submit" disabled={loading}>{loading?'Creating…':'Generate my game link ↗'}</button>
        {!isConfigured&&<p className="warning">Supabase is not configured. Check your project environment variables and SETUP.md.</p>}
      </form>
      {notice&&<div className="notice">{notice}</div>}<footer>BUILT FOR FRIENDS · KEEP IT KIND · NO SCORES</footer>
    </main>
  );

  if(page==='play') return (
    <main className="shell match-shell">
      <header className="top"><div className="brand-mark">☠</div><div><div className="eyebrow">{theme==='jujutsu_kaisen'?'JUJUTSU KAISEN EDITION':'ONE PIECE EDITION'}</div><h1>Match your <span>world</span></h1></div></header>
      <section className="panel match-panel">
        <p className="subtle">Created by {game?.owner_name||'your friend'}. Drag each friend into the square beside the character.</p>
        <label className="field-label">Your name or nickname<input value={participant} onChange={e=>setParticipant(e.target.value)} placeholder="Who is making these matches?" maxLength="40"/></label>
        <p className="drag-help">Drag a friend photo from the right into a center square. On mobile, tap a friend, then tap a square.</p>
        <div className="match-board">
          <div className="board-column character-column"><h3>CHARACTERS</h3>{characters.map(([name,img])=><div className="character-card" key={name}><img className="character-image" src={img} alt={name}/><b>{name}</b></div>)}</div>
          <div className="board-column drop-column"><h3>YOUR MATCH</h3>{characters.map(([name],i)=>{
            const friend=activeFriends.find(f=>String(f.index)===String(matches[i]));
            return <div key={name} className={`drop-zone ${friend?'filled':''} ${pickedFriend!==null?'ready':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>dropOn(e,i)} onClick={()=>tapDrop(i)} role="button" tabIndex={0} aria-label={`Drop a friend for ${name}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapDrop(i);}}}>
              {friend?<div className="dropped-friend"><img src={friend.url} alt={friend.name}/><b>{friend.name}</b><button type="button" className="remove-match" onClick={e=>{e.stopPropagation();setMatches(prev=>{const next={...prev};delete next[i];return next;});setNotice('');}}>×</button></div>:<span className="drop-placeholder">＋<small>Drop here</small></span>}
            </div>;
          })}</div>
          <div className="board-column friends-column"><h3>FRIENDS</h3>{availableFriends.map(f=><button type="button" className={`friend-card ${pickedFriend===String(f.index)?'picked':''}`} key={f.index} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',String(f.index));e.dataTransfer.effectAllowed='move';setPickedFriend(String(f.index));}} onDragEnd={()=>setPickedFriend(null)} onClick={()=>tapFriend(f.index)} aria-label={`Select or drag ${f.name}`}>{f.url?<img className="friend-image" src={f.url} alt={f.name}/>:<span className="friend-image friend-placeholder">?</span>}<b>{f.name}</b></button>)}{availableFriends.length===0&&<p className="all-assigned">All friends matched!</p>}</div>
        </div>
        <button className="primary" onClick={submitMatches} disabled={loading}>{loading?'Submitting…':'Submit my matches ✓'}</button>
        {notice&&<div className="notice">{notice}</div>}
      </section>
      <footer>ONE CREW · MANY OPINIONS</footer>
      <style>{`
        .match-shell{max-width:1200px}.match-panel{overflow:hidden}
        .drag-help{color:#9fb5c9;font-size:.92rem;margin:12px 0 18px}
        .match-board{display:grid;grid-template-columns:minmax(150px,1fr) minmax(135px,.9fr) minmax(150px,1fr);gap:14px;align-items:start;overflow-x:auto;padding:6px 2px 14px}
        .board-column{min-width:0;display:flex;flex-direction:column;gap:12px}
        .board-column>h3{position:sticky;top:0;z-index:1;margin:0;padding:10px 5px;text-align:center;font-size:.78rem;letter-spacing:.12em;color:#a9c4d9;background:#0a2034;border-radius:10px}
        .character-card{min-height:142px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px 6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:13px;text-align:center}
        .character-image{width:105px;height:105px;object-fit:cover;border-radius:10px}
        .character-card b,.friend-card b,.dropped-friend b{font-size:.88rem;line-height:1.2;overflow-wrap:anywhere}
        .drop-zone{min-height:142px;display:flex;align-items:center;justify-content:center;position:relative;padding:8px;border:2px dashed #53738b;border-radius:13px;background:rgba(22,55,78,.35);cursor:pointer;transition:border-color .15s,background .15s}
        .drop-zone.ready{border-color:#f5c76b;background:rgba(245,199,107,.09)}.drop-zone.filled{border-style:solid;border-color:#72c7a6}
        .drop-placeholder{display:flex;flex-direction:column;align-items:center;color:#9ab0c4;font-size:2rem}.drop-placeholder small{font-size:.75rem}
        .dropped-friend{display:flex;width:100%;flex-direction:column;align-items:center;gap:7px}.dropped-friend img{width:105px;height:105px;object-fit:cover;border-radius:10px}
        .remove-match{position:absolute;top:4px;right:4px;border:0;border-radius:50%;width:27px;height:27px;background:#f06b78;color:#fff;font-size:1.2rem;cursor:pointer}
        .friend-card{width:100%;min-height:142px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px 5px;color:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:13px;cursor:grab;text-align:center;touch-action:manipulation}
        .friend-card:active{cursor:grabbing}.friend-card.picked{outline:2px solid #f5c76b;background:rgba(245,199,107,.12)}
        .friend-image{width:105px;height:105px;object-fit:cover;border-radius:10px}.friend-placeholder{display:grid;place-items:center;background:#18364e;color:#c8d8e5;font-size:2rem}
        .all-assigned{text-align:center;color:#72c7a6}
        @media(max-width:600px){.match-board{grid-template-columns:125px 125px 125px;gap:8px}.character-card,.drop-zone,.friend-card{min-height:128px}.character-image,.dropped-friend img,.friend-image{width:92px;height:92px}.board-column>h3{font-size:.68rem}}
      `}</style>
    </main>
  );

  if(page==='result') return (
    <main className="shell">
      <section className="result-card" ref={resultRef}>
        <div className="result-header"><p className="eyebrow">THE CREW HAS SPOKEN</p><h1>My Anime <span>Matches</span></h1><p>Player: {participant}</p></div>
        {characters.map(([name,img],i)=>{const f=activeFriends.find(item=>String(item.index)===String(matches[i]));return <div className="result-row" key={name}><img className="result-character" src={img} alt={name}/><div className="result-info"><small>CHARACTER {String(i+1).padStart(2,'0')}</small><b>{name}</b><span>↔ {f?.name||'Friend'}</span></div>{f?.url&&<img className="result-friend" src={f.url} alt={f.name}/>}</div>;})}
        <div className="result-footer">CHARAMATCH · FOR FUN ONLY</div>
      </section>
      <div className="actions"><button className="primary" onClick={downloadJpg}>Download JPG ↓</button><button className="secondary" onClick={shareLink}>Share game link ↗</button><button className="secondary" onClick={()=>{setMatches({});setParticipant('');setNotice('');setPage('play');}}>Play Again ↻</button><button className="secondary" onClick={()=>{setPage('play');setNotice('');}}>Edit matches</button></div>
      {notice&&<div className="notice">{notice}</div>}
    </main>
  );

  return <main className="shell"><div className="panel"><h2>Loading game…</h2>{notice&&<p>{notice}</p>}</div></main>;
}
