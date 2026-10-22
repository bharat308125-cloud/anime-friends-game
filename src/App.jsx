import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_PROJECT')
  ? createClient(supabaseUrl, supabaseKey) : null;

const ONE_PIECE = [
  ['Luffy', '/characters/luffy.jpg'], ['Zoro', '/characters/zoro.jpg'],
  ['Nami', '/characters/nami.jpg'], ['Usopp', '/characters/usopp.jpg'],
  ['Sanji', '/characters/sanji.jpg'], ['Chopper', '/characters/chopper.jpg'],
  ['Robin', '/characters/robin.jpg'], ['Franky', '/characters/franky.jpg'],
  ['Brook', '/characters/brook.png'], ['Jinbe', '/characters/jinbe.jpg']
];
const JUJUTSU_KAISEN = [
  ['Satoru Gojo', '/characters/gojo.jpg'],
  ['Yuji Itadori', '/characters/yuji.jpg'],
  ['Megumi Fushiguro', '/characters/megumi.jpg'],
  ['Nobara Kugisaki', '/characters/nobara.jpg'],
  ['Kento Nanami', '/characters/nanami.jpg'],
  ['Maki Zenin', '/characters/maki.jpg'],
  ['Panda', '/characters/panda.jpg'],
  ['Aoi Todo', '/characters/todo.jpg'],
  ['Toji Fushiguro', '/characters/toji.jpg'],
  ['Ryomen Sukuna', '/characters/sukuna.jpg']
];

function makeId() {
  return (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replaceAll('-', '').slice(0, 16);
}
function readGameId() {
  const match = window.location.pathname.match(/\/game\/([a-zA-Z0-9]+)/);
  return match?.[1] || new URLSearchParams(location.search).get('game');
}
function dataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState('one_piece');
  const [gameId, setGameId] = useState(readGameId());
  const [ownerName, setOwnerName] = useState('');
  const [friends, setFriends] = useState(Array.from({length:10}, (_, i) => ({name:`Friend ${i+1}`, file:null, preview:'', path:''})));
  const [game, setGame] = useState(null);
  const [matches, setMatches] = useState({});
  const [participant, setParticipant] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const resultRef = useRef(null);

  const characters = useMemo(
  () => theme === 'jujutsu_kaisen' ? JUJUTSU_KAISEN : ONE_PIECE,
  [theme]
);
  const isConfigured = Boolean(supabase);
  const shareUrl = gameId ? `${location.origin}/game/${gameId}` : '';

  useEffect(() => {
    const id = readGameId();
    if (id) { setGameId(id); loadGame(id); }
  }, []);

  async function loadGame(id) {
    if (!supabase) {
      setNotice('Online mode is not configured yet. Follow SETUP.md to connect Supabase.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    setLoading(false);
    if (error || !data) { setNotice('Game not found, or it is not available yet. Check the link.'); return; }
    setGame(data);
    setTheme(data.theme || 'one_piece');
    setPage('play');
    setNotice('');
  }

  async function choosePhoto(index, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice('Please choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setNotice('Each photo must be 8 MB or smaller.'); return; }
    const preview = await dataUrl(file);
    setFriends(prev => prev.map((f, i) => i === index ? {...f, file, preview} : f));
  }

  async function createGame(e) {
    e.preventDefault();
    if (!supabase) { setNotice('Before creating a shareable link, connect Supabase using SETUP.md.'); return; }
    if (friends.some(f => !f.file)) { setNotice('Please upload all 10 friends’ photos first.'); return; }
    if (!ownerName.trim()) { setNotice('Enter your name or nickname.'); return; }
    setLoading(true); setNotice('');
    const id = makeId();
    const storedFriends = [];
    try {
      for (let i=0; i<friends.length; i++) {
        const f = friends[i];
        const ext = (f.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
        const path = `${id}/${i+1}-${makeId()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('friend-photos').upload(path, f.file, { upsert: false, contentType: f.file.type });
        if (uploadError) throw uploadError;
        storedFriends.push({name: f.name.trim() || `Friend ${i+1}`, path});
      }
      const { error } = await supabase.from('games').insert({id, owner_name: ownerName.trim(), theme, friends: storedFriends});
      if (error) throw error;
      setGameId(id);
      history.pushState({}, '', `/game/${id}`);
      await loadGame(id);
      setNotice('Game created! Copy the link and send it to your friends.');
    } catch (err) {
      setNotice(`Could not create game: ${err.message || 'Please check your Supabase setup.'}`);
    } finally { setLoading(false); }
  }

  async function publicPhotoUrl(path) {
    const { data } = supabase.storage.from('friend-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function submitMatches() {
    if (!participant.trim()) { setNotice('Enter your name or nickname before submitting.'); return; }
    if (Object.keys(matches).length !== 10) { setNotice('Match all 10 friends before submitting.'); return; }
    setLoading(true); setNotice('');
    const { error } = await supabase.from('submissions').insert({
      game_id: gameId, participant_name: participant.trim(), matches
    });
    setLoading(false);
    if (error) { setNotice(`Submission failed: ${error.message}`); return; }
    setSubmitted(true); setPage('result'); setNotice('Your matches have been submitted.');
  }

  async function downloadJpg() {
    if (!resultRef.current) return;
    setNotice('Preparing your JPG…');
    try {
      const canvas = await html2canvas(resultRef.current, {useCORS:true, scale:2, backgroundColor:'#07192b'});
      const link = document.createElement('a');
      link.download = `anime-friends-${gameId || 'result'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', .94);
      link.click();
      setNotice('JPG downloaded. You can now share it from your phone’s gallery.');
    } catch {
      setNotice('JPG export failed. Check your internet connection and try again.');
    }
  }

async function shareLink() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'CharaMatch',
        text: `Match our friends with ${
          theme === 'jujutsu_kaisen' ? 'Jujutsu Kaisen' : 'One Piece'
        } characters!`,
        url: shareUrl
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setNotice('Game link copied. Paste it into WhatsApp.');
    }
  } catch (error) {
    console.log('Sharing cancelled or unavailable.');
  }
}
  async function renderFriend(f, index) {
    const { data } = supabase.storage.from('friend-photos').getPublicUrl(f.path);
    return {...f, index, url:data.publicUrl};
  }

  const [resolvedFriends, setResolvedFriends] = useState([]);
  useEffect(() => {
    let active = true;
    async function resolve() {
      if (!game?.friends || !supabase) return;
      const list = await Promise.all(game.friends.map((f,i)=>renderFriend(f,i)));
      if (active) setResolvedFriends(list);
    }
    resolve();
    return ()=>{active=false};
  }, [game]);

  const activeFriends = resolvedFriends.length ? resolvedFriends : friends.map((f,index)=>({...f,index,url:f.preview}));

  if (page === 'home') return <main className="shell">
    <header className="top">
  <div className="brand-mark">☠</div>
  <div>
    <div className="eyebrow">
      {theme === 'jujutsu_kaisen' ? 'JUJUTSU KAISEN EDITION' : 'ONE PIECE EDITION'}
    </div>
    <h1>Match your <span>crew</span></h1>
  </div>
</header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">PICK YOUR UNIVERSE</p><h2>Which anime character<br/>is your friend?</h2><p>Upload your crew once, share a game link, and see who your friends match with.</p></div><div className="hero-stamp">WANTED<br/><strong>YOUR<br/>CREW</strong><small>FUN ONLY • NO SCORES</small></div></section>
    <form className="panel" onSubmit={createGame}>
      <h3>01 / Create your game</h3>
      <label className="field-label">Your name or nickname<input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Bharat" maxLength="40"/></label>
      <h4>Choose your anime world</h4>
      <div className="themes">
        <button type="button" className={`theme-card ${theme==='one_piece'?'selected':''}`} onClick={()=>setTheme('one_piece')}><span className="theme-icon">🏴‍☠️</span><b>ONE PIECE</b><small>Available now</small></button>
        <button
  type="button"
  className={`theme-card ${theme === 'jujutsu_kaisen' ? 'selected' : ''}`}
  onClick={() => setTheme('jujutsu_kaisen')}
>
  <span className="theme-icon">👊</span>
  <b>JUJUTSU KAISEN</b>
  <small>
    {theme === 'jujutsu_kaisen' ? 'Selected ✓' : 'Choose this world'}
  </small>
</button>
      <h3>02 / Upload 10 friends</h3>
      <p className="subtle">Choose one photo per friend. These photos are shared with anyone who has your game link.</p>
      <div className="upload-grid">{friends.map((f,i)=><div className="upload-card" key={i}>
        <label className="photo-pick">{f.preview ? <img src={f.preview} alt="" /> : <span className="plus">+</span>}<input type="file" accept="image/*" onChange={e=>choosePhoto(i,e.target.files?.[0])}/><span className="photo-number">{String(i+1).padStart(2,'0')}</span></label>
        <input className="friend-name" value={f.name} maxLength="40" onChange={e=>setFriends(prev=>prev.map((x,j)=>i===j?{...x,name:e.target.value}:x))} aria-label={`Friend ${i+1} name`} />
      </div>)}</div>
      <button className="primary" type="submit" disabled={loading}>{loading?'Creating…':'Generate my game link ↗'}</button>
      {!isConfigured && <p className="warning">Setup required: the online database is not connected yet. See <b>SETUP.md</b> in the project folder.</p>}
    </form>
    {notice && <div className="notice">{notice}</div>}
    <footer>BUILT FOR FRIENDS · KEEP IT KIND · NO SCORES</footer>
  </main>;

  if (page === 'play') return <main className="shell"><div className="eyebrow">
  {theme === 'jujutsu_kaisen'
    ? 'JUJUTSU KAISEN EDITION'
    : 'ONE PIECE EDITION'}
</div>

<h1>Match your <span>world</span></h1></div></header>
    <section className="panel"><p className="subtle">Created by {game?.owner_name || 'your friend'}. Match every friend to the character that fits them best.</p>
      <label className="field-label">Your name or nickname<input value={participant} onChange={e=>setParticipant(e.target.value)} placeholder="Who is making these matches?" maxLength="40"/></label>
      <div className="match-list">{characters.map(([char,img],i)=><div className="match-row" key={char}>
        <div className="character"><img src={img} alt={char}/><b>{char}</b></div><div className="match-arrow">←</div>
        <select value={matches[i] ?? ''} onChange={e=>setMatches(prev=>({...prev,[i]:e.target.value}))} aria-label={`Choose a friend for ${char}`}><option value="">Choose a friend…</option>{activeFriends.map(f=><option key={f.index} value={String(f.index)}>{f.name}</option>)}</select>
        <div className="selected-photo">{matches[i] !== undefined && activeFriends[Number(matches[i])]?.url ? <img src={activeFriends[Number(matches[i])].url} alt="Selected friend"/> : <span>?</span>}</div>
      </div>)}</div>
      <button className="primary" onClick={submitMatches} disabled={loading}>{loading?'Submitting…':'Submit my matches ✓'}</button>
      {notice && <div className="notice">{notice}</div>}
    </section><footer>ONE CREW · MANY OPINIONS</footer>
  </main>;

  if (page === 'result') return <main className="shell">
    <section className="result-card" ref={resultRef}>
      <div className="result-header"><p className="eyebrow">THE CREW HAS SPOKEN</p><h1>My Anime <span>Matches</span></h1><p>Player: {participant}</p></div>
      {characters.map(([char,img],i)=><div className="result-row" key={char}><img className="result-character" src={img} alt={char}/><div className="result-info"><small>CHARACTER {String(i+1).padStart(2,'0')}</small><b>{char}</b><span>↔ {activeFriends[Number(matches[i])]?.name || 'Friend'}</span></div><img className="result-friend" src={activeFriends[Number(matches[i])]?.url} alt="Friend"/></div>)}
      <div className="result-footer">ANIME FRIENDS MATCHER · FOR FUN ONLY</div>
    </section>
    <div className="actions"><button className="primary" onClick={downloadJpg}>Download JPG ↓</button><button className="secondary" onClick={shareLink}>Share game link ↗</button><button className="secondary" onClick={()=>{setPage('play');setSubmitted(false)}}>Edit matches</button></div>
    {notice && <div className="notice">{notice}</div>}
  </main>;
  return <main className="shell"><div className="panel"><h2>Loading game…</h2>{notice && <p>{notice}</p>}</div></main>;
}
