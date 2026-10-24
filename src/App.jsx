import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes('YOUR_PROJECT')
  ? createClient(url, key)
  : null;

const ONE_PIECE = [
  ['Luffy', '/characters/luffy.jpg'],
  ['Zoro', '/characters/zoro.jpg'],
  ['Nami', '/characters/nami.jpg'],
  ['Usopp', '/characters/usopp.jpg'],
  ['Sanji', '/characters/sanji.jpg'],
  ['Chopper', '/characters/chopper.jpg'],
  ['Robin', '/characters/robin.jpg'],
  ['Franky', '/characters/franky.jpg'],
  ['Brook', '/characters/brook.png'],
  ['Jinbe', '/characters/jinbe.jpg'],
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
  ['Ryomen Sukuna', '/characters/sukuna.jpg'],
];

// Paths below use the exact filenames currently present in public/characters.
// Some filenames contain legacy spellings (for example, jethala.jpg); do not rename
// those assets unless every reference is updated too.
const TMKOC = [
  ['Jethalal', '/characters/jethala.jpg'],
  ['Dr. Hathi', '/characters/drhathi.jpg'],
  ['Champaklal', '/characters/champaklal.jpg'],
  ['Daya Ben', '/characters/dayaben.jpg'],
  ['Babita Ji', '/characters/babita.jpg'],
  ['Bagha', '/characters/bagha.jpg'],
  ['Forgotten One', '/characters/forgottenone.jpg'],
  ['Bhide', '/characters/bhide.jpg'],
  ['Popatlal', '/characters/popatlal.jpg'],
  ['Madhuri', '/characters/maduri.jpg'],
];

const MEMES = [
  ['Baburao', '/characters/baburoa.jpg'],
  ['Chota Pandit', '/characters/chotapandit.jpg'],
  ['Chatur', '/characters/chatur.jpg'],
  ['Circuit', '/characters/circuit.jpg'],
  ['Majnu Bhai', '/characters/majnubhai.jpg'],
  ['Kokilaben', '/characters/kokilabhen.jpg'],
  ['Puneet Superstar', '/characters/puneet_superstar.jpg'],
  ['Ravi Kishan', '/characters/ravikishan.png'],
  ['Pari Girl', '/characters/pari_girl.jpg'],
  ['Respectful Image', '/characters/respectful_image.jpg'],
];

const THEMES = {
  one_piece: { label: 'One Piece', icon: '🏴‍☠️', characters: ONE_PIECE },
  jujutsu_kaisen: { label: 'Jujutsu Kaisen', icon: '👊', characters: JUJUTSU_KAISEN },
  tmkoc: { label: 'TMKOC', icon: '📺', characters: TMKOC },
  memes: { label: 'Memes', icon: '😂', characters: MEMES },
};

const newGameId = () => (
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    : (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16)
);

const newShareToken = () => (
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      })
);

const readGameId = () =>
  window.location.pathname.match(/\/game\/([a-zA-Z0-9]+)/)?.[1]
  || new URLSearchParams(window.location.search).get('game');

const readResultToken = () =>
  window.location.pathname.match(/\/result\/([a-fA-F0-9-]{36})/)?.[1]
  || new URLSearchParams(window.location.search).get('result');

const freshFriends = () =>
  Array.from({ length: 10 }, (_, i) => ({
    name: `Friend ${i + 1}`,
    file: null,
    preview: '',
    path: '',
  }));

const dataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function App() {
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState('one_piece');
  const [gameId, setGameId] = useState(readGameId());
  const [ownerName, setOwnerName] = useState('');
  const [friends, setFriends] = useState(freshFriends);
  const [reuseFriends, setReuseFriends] = useState(null);
  const [game, setGame] = useState(null);
  const [matches, setMatches] = useState({});
  const [participant, setParticipant] = useState('');
  const [resultToken, setResultToken] = useState(readResultToken());
  const [isSharedResult, setIsSharedResult] = useState(false);
  const [showPlayOptions, setShowPlayOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [resolvedFriends, setResolvedFriends] = useState([]);
  const [pickedFriend, setPickedFriend] = useState(null);
  const resultRef = useRef(null);

  const characters = useMemo(
    () => THEMES[theme]?.characters || ONE_PIECE,
    [theme]
  );
  const themeLabel = THEMES[theme]?.label || 'One Piece';
  const gameUrl = gameId ? `${window.location.origin}/game/${gameId}` : '';
  const resultUrl = resultToken ? `${window.location.origin}/result/${resultToken}` : '';
  const isConfigured = Boolean(supabase);

  useEffect(() => {
    let alive = true;
    const handleLocation = async () => {
      const token = readResultToken();
      if (token) {
        setResultToken(token);
        await loadResult(token, alive);
        return;
      }
      const id = readGameId();
      if (id) {
        await loadGame(id, alive);
        return;
      }
      if (alive) setPage('home');
    };
    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => {
      alive = false;
      window.removeEventListener('popstate', handleLocation);
    };
  }, []);

  async function loadGame(id, alive = true) {
    if (!supabase) {
      setNotice('Online mode is not configured. Check your Supabase settings.');
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      // The RPC returns only the game identified by this link; the table is not publicly selectable.
      const { data, error } = await supabase.rpc('get_game_by_id', {
        game_id_input: id,
      });
      if (error) throw error;
      const record = Array.isArray(data) ? data[0] : data;
      if (!record) {
        setNotice('Game not found. Check that the shared link is correct.');
        setPage('error');
        return;
      }
      if (!alive) return;
      setGame(record);
      setGameId(record.id);
      setTheme(THEMES[record.theme] ? record.theme : 'one_piece');
      setMatches({});
      setParticipant('');
      setResultToken(null);
      setIsSharedResult(false);
      setShowPlayOptions(false);
      setResolvedFriends([]);
      setPickedFriend(null);
      setPage('play');
    } catch (error) {
      if (alive) {
        setNotice(`Could not load the game: ${error.message || 'Please try again.'}`);
        setPage('error');
      }
    } finally {
      if (alive) setLoading(false);
    }
  }

  async function loadResult(token, alive = true) {
    if (!supabase) {
      setNotice('Online mode is not configured. Check your Supabase settings.');
      setIsSharedResult(true);
      setPage('result');
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      // Result links use a per-submission UUID, so one result cannot overwrite another.
      const { data, error } = await supabase.rpc('get_shared_result', {
        share_token_input: token,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        if (!alive) return;
        setGame(null);
        setIsSharedResult(true);
        setNotice('This result link is invalid or the result is no longer available.');
        setPage('result');
        return;
      }
      if (!alive) return;
      setGame({
        id: row.game_id,
        owner_name: row.owner_name,
        theme: row.theme,
        friends: row.friends,
      });
      setGameId(row.game_id);
      setTheme(THEMES[row.theme] ? row.theme : 'one_piece');
      setMatches(row.matches || {});
      setParticipant(row.participant_name || '');
      setResultToken(row.share_token || token);
      setIsSharedResult(true);
      setShowPlayOptions(false);
      setResolvedFriends([]);
      setPickedFriend(null);
      setPage('result');
    } catch (error) {
      if (alive) {
        setGame(null);
        setIsSharedResult(true);
        setNotice(`Could not load this result: ${error.message || 'Please try again.'}`);
        setPage('result');
      }
    } finally {
      if (alive) setLoading(false);
    }
  }

  async function choosePhoto(index, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Please select an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice('Each photo must be 8 MB or smaller.');
      return;
    }
    try {
      const preview = await dataUrl(file);
      setFriends(prev => prev.map((friend, i) =>
        i === index ? { ...friend, file, preview } : friend
      ));
      setNotice('');
    } catch {
      setNotice('Could not open that photo. Please try another.');
    }
  }

  async function createGame(event) {
    event.preventDefault();
    if (!supabase) {
      setNotice('Supabase is not connected. Check your project environment variables.');
      return;
    }
    if (!ownerName.trim()) {
      setNotice('Please enter your name or nickname.');
      return;
    }
    if (!reuseFriends && friends.some(friend => !friend.file)) {
      setNotice('Please upload all 10 friends’ photos first.');
      return;
    }

    setLoading(true);
    setNotice('');
    const id = newGameId();
    const uploadedPaths = [];
    try {
      let storedFriends;
      if (reuseFriends) {
        // Reuse the original storage paths. Do not upload, overwrite, or delete the originals.
        storedFriends = reuseFriends.map((friend, index) => ({
          name: friend.name || `Friend ${index + 1}`,
          path: friend.path,
        }));
      } else {
        storedFriends = [];
        for (let i = 0; i < friends.length; i++) {
          const friend = friends[i];
          const ext = (friend.file.name.split('.').pop() || 'jpg')
            .toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `${id}/${i + 1}-${newGameId()}.${ext}`;
          const { error } = await supabase.storage
            .from('friend-photos')
            .upload(path, friend.file, {
              upsert: false,
              contentType: friend.file.type,
            });
          if (error) throw error;
          uploadedPaths.push(path);
          storedFriends.push({
            name: friend.name.trim() || `Friend ${i + 1}`,
            path,
          });
        }
      }

      const { error } = await supabase.from('games').insert({
        id,
        owner_name: ownerName.trim(),
        theme,
        friends: storedFriends,
      });
      if (error) throw error;

      setReuseFriends(null);
      setGameId(id);
      window.history.pushState({}, '', `/game/${id}`);
      await loadGame(id);
      setNotice('Game created! You can share the game link from the game page.');
    } catch (error) {
      // Only remove files uploaded by this failed attempt; reused source files are untouched.
      if (uploadedPaths.length) {
        try {
          await supabase.storage.from('friend-photos').remove(uploadedPaths);
        } catch {
          // Preserve the original error message.
        }
      }
      setNotice(`Could not create the game: ${error.message || 'Please check your Supabase setup.'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function resolveFriends() {
      if (!game?.friends || !supabase) {
        setResolvedFriends([]);
        return;
      }
      try {
        const list = await Promise.all(game.friends.map(async (friend, index) => {
          const { data } = supabase.storage
            .from('friend-photos')
            .getPublicUrl(friend.path);
          return { ...friend, index, url: data.publicUrl };
        }));
        if (active) setResolvedFriends(list);
      } catch {
        if (active) setNotice('Could not load the friends’ photos. Please check the storage bucket.');
      }
    }
    resolveFriends();
    return () => { active = false; };
  }, [game]);

  const activeFriends = game
    ? resolvedFriends
    : friends.map((friend, index) => ({ ...friend, index, url: friend.preview }));

  const usedFriends = new Set(Object.values(matches).map(String));
  const availableFriends = activeFriends.filter(friend => !usedFriends.has(String(friend.index)));

  function assignFriend(characterIndex, friendIndex) {
    if (friendIndex === null || friendIndex === undefined || friendIndex === '') return;
    setMatches(previous => {
      const next = { ...previous };
      Object.keys(next).forEach(key => {
        if (String(next[key]) === String(friendIndex)) delete next[key];
      });
      next[characterIndex] = String(friendIndex);
      return next;
    });
    setPickedFriend(null);
    setNotice('');
  }

  function dropOn(event, index) {
    event.preventDefault();
    const friendIndex = event.dataTransfer.getData('text/plain') || pickedFriend;
    if (friendIndex !== null && friendIndex !== '') assignFriend(index, friendIndex);
  }

  function tapFriend(index) {
    setPickedFriend(String(index));
    setNotice('Now tap the square beside the character you want.');
  }

  function tapDrop(index) {
    if (pickedFriend === null) {
      setNotice('First tap a friend on the right, then tap a square.');
      return;
    }
    assignFriend(index, pickedFriend);
  }

  async function submitMatches() {
    if (!participant.trim()) {
      setNotice('Please enter your name or nickname.');
      return;
    }
    if (Object.keys(matches).length !== characters.length) {
      setNotice(`Please match all ${characters.length} characters.`);
      return;
    }
    if (new Set(Object.values(matches).map(String)).size !== characters.length) {
      setNotice('Each friend can only be matched with one character.');
      return;
    }
    if (!supabase || !gameId) {
      setNotice('The online database is not connected or this game is unavailable.');
      return;
    }

    setLoading(true);
    setNotice('');
    const token = newShareToken();
    try {
      const { error } = await supabase.from('submissions').insert({
        game_id: gameId,
        participant_name: participant.trim(),
        matches,
        share_token: token,
      });
      if (error) throw error;

      setResultToken(token);
      setIsSharedResult(false);
      setShowPlayOptions(false);
      window.history.pushState({}, '', `/result/${token}`);
      setPage('result');
      setNotice('Your result has been saved. Share its unique result link!');
    } catch (error) {
      setNotice(`Submission failed: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }

  async function shareUrlValue(shareUrl, title, textValue) {
    if (!shareUrl) {
      setNotice('There is no link available to share yet.');
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title, text: textValue, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setNotice('Link copied. Paste it into WhatsApp or another app.');
      } else {
        setNotice(`Copy this link: ${shareUrl}`);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setNotice(`Sharing is unavailable. Copy this link: ${shareUrl}`);
      }
    }
  }

  function shareGameLink() {
    return shareUrlValue(gameUrl, 'CharaMatch game', `Play ${themeLabel} with our friends!`);
  }

  function shareResultLink() {
    return shareUrlValue(resultUrl, 'CharaMatch result', `${participant || 'A player'}’s ${themeLabel} result`);
  }

  async function downloadJpg() {
    if (!resultRef.current) return;
    setNotice('Preparing your JPG…');
    try {
      const canvas = await html2canvas(resultRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#07192b',
      });
      const link = document.createElement('a');
      link.download = `charamatch-${resultToken || gameId || 'result'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.94);
      link.click();
      setNotice('JPG downloaded successfully!');
    } catch {
      setNotice('JPG export failed. Please check your connection and try again.');
    }
  }

  function startSameFriendsFlow() {
    if (!game?.friends?.length) {
      setNotice('The original friends are unavailable for this result.');
      return;
    }
    setReuseFriends(game.friends.map(friend => ({ name: friend.name, path: friend.path })));
    setFriends(freshFriends());
    setOwnerName('');
    setShowPlayOptions(false);
    setNotice('Choose a category and a name for your new game.');
    setIsSharedResult(false);
    setResultToken(null);
    setMatches({});
    setParticipant('');
    setResolvedFriends([]);
    setGame(null);
    setGameId(null);
    setPage('home');
    window.history.pushState({}, '', '/');
  }

  function startNewFriendsFlow() {
    setReuseFriends(null);
    setFriends(freshFriends());
    setOwnerName('');
    setTheme('one_piece');
    setShowPlayOptions(false);
    setNotice('');
    setIsSharedResult(false);
    setResultToken(null);
    setMatches({});
    setParticipant('');
    setResolvedFriends([]);
    setGame(null);
    setGameId(null);
    setPage('home');
    window.history.pushState({}, '', '/');
  }

  function editCurrentMatches() {
    if (!gameId) return;
    setIsSharedResult(false);
    setNotice('');
    setPage('play');
    window.history.pushState({}, '', `/game/${gameId}`);
  }

  function startPlayOptions() {
    setShowPlayOptions(previous => !previous);
    setNotice('');
  }

  const visibleThemeCards = Object.entries(THEMES);

  if (page === 'home') {
    return (
      <main className="shell">
        <header className="top">
          <div className="brand-mark">☠</div>
          <div>
            <div className="eyebrow">CharaMatch</div>
            <h1>Match your <span>crew</span></h1>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">PICK YOUR UNIVERSE</p>
            <h2>Which anime character<br/>is your friend?</h2>
            <p>Upload your crew once, share a game link, and see which characters your friends choose.</p>
          </div>
          <div className="hero-stamp">WANTED<br/><strong>YOUR<br/>CREW</strong><small>FUN ONLY • NO SCORES</small></div>
        </section>

        <form className="panel" onSubmit={createGame}>
          <h3>01 / Create your game</h3>
          <label className="field-label">
            Your name or nickname
            <input
              value={ownerName}
              onChange={event => setOwnerName(event.target.value)}
              placeholder="e.g. Bharat"
              maxLength="40"
            />
          </label>

          <h4>Choose your character category</h4>
          <div className="themes">
            {visibleThemeCards.map(([keyName, info]) => (
              <button
                type="button"
                key={keyName}
                className={`theme-card ${theme === keyName ? 'selected' : ''}`}
                onClick={() => setTheme(keyName)}
                aria-pressed={theme === keyName}
              >
                <span className="theme-icon">{info.icon}</span>
                <b>{info.label.toUpperCase()}</b>
                <small>{theme === keyName ? 'Selected ✓' : 'Choose category'}</small>
              </button>
            ))}
          </div>

          <h3>{reuseFriends ? '02 / Reuse the same friends' : '02 / Upload 10 friends'}</h3>
          {reuseFriends ? (
            <div className="panel reuse-summary">
              <p className="subtle">This new game will reuse the original photos. No re-uploading or copying files is required.</p>
              <div className="reuse-name-list">
                {reuseFriends.map((friend, index) => (
                  <span key={`${friend.path}-${index}`}>{String(index + 1).padStart(2, '0')} · {friend.name || `Friend ${index + 1}`}</span>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="subtle">Choose one photo per friend. Anyone with the game link may be able to view these photos; only upload photos you have permission to share.</p>
              <div className="upload-grid">
                {friends.map((friend, index) => (
                  <div className="upload-card" key={index}>
                    <label className="photo-pick">
                      {friend.preview ? <img src={friend.preview} alt="" /> : <span className="plus">+</span>}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={event => choosePhoto(index, event.target.files?.[0])}
                      />
                      <span className="photo-number">{String(index + 1).padStart(2, '0')}</span>
                    </label>
                    <input
                      className="friend-name"
                      value={friend.name}
                      maxLength="40"
                      onChange={event => setFriends(previous => previous.map((item, i) =>
                        i === index ? { ...item, name: event.target.value } : item
                      ))}
                      aria-label={`Friend ${index + 1} name`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Creating…' : reuseFriends ? 'Start game with same friends ↗' : 'Generate my game link ↗'}
          </button>
          {!isConfigured && <p className="warning">Supabase is not configured. Check your environment variables and SETUP.md.</p>}
        </form>

        {notice && <div className="notice">{notice}</div>}
        <footer>CharaMatch · EVERY CHARACTER HAS A MATCH · KEEP IT KIND</footer>

        <style>{`
          .reuse-summary{margin-top:12px;padding:14px}
          .reuse-name-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
          .reuse-name-list span{font-size:.82rem;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.05);overflow-wrap:anywhere}
          @media(max-width:520px){.reuse-name-list{grid-template-columns:1fr}}
        `}</style>
      </main>
    );
  }

  if (page === 'play') {
    return (
      <main className="shell match-shell">
        <header className="top">
          <div className="brand-mark">☠</div>
          <div>
            <div className="eyebrow">{themeLabel.toUpperCase()} EDITION</div>
            <h1>Match your <span>world</span></h1>
          </div>
        </header>

        <section className="panel match-panel">
          <p className="subtle">Created by {game?.owner_name || 'your friend'}. Match each character with one friend.</p>
          <label className="field-label">
            Your name or nickname
            <input
              value={participant}
              onChange={event => setParticipant(event.target.value)}
              placeholder="Who is making these matches?"
              maxLength="40"
            />
          </label>
          <p className="drag-help">Drag a friend photo from the right into a center square. On mobile, tap a friend, then tap a square.</p>

          <div className="match-board">
            <div className="board-column character-column">
              <h3>CHARACTERS</h3>
              {characters.map(([name, image]) => (
                <div className="character-card" key={name}>
                  <img className="character-image" src={image} alt={name} loading="lazy" />
                  <b>{name}</b>
                </div>
              ))}
            </div>

            <div className="board-column drop-column">
              <h3>YOUR MATCH</h3>
              {characters.map(([name], index) => {
                const friend = activeFriends.find(item => String(item.index) === String(matches[index]));
                return (
                  <div
                    key={name}
                    className={`drop-zone ${friend ? 'filled' : ''} ${pickedFriend !== null ? 'ready' : ''}`}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => dropOn(event, index)}
                    onClick={() => tapDrop(index)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Drop a friend for ${name}`}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        tapDrop(index);
                      }
                    }}
                  >
                    {friend ? (
                      <div className="dropped-friend">
                        <img src={friend.url} alt={friend.name} />
                        <b>{friend.name}</b>
                        <button
                          type="button"
                          className="remove-match"
                          onClick={event => {
                            event.stopPropagation();
                            setMatches(previous => {
                              const next = { ...previous };
                              delete next[index];
                              return next;
                            });
                            setNotice('');
                          }}
                          aria-label={`Remove ${friend.name} match`}
                        >×</button>
                      </div>
                    ) : <span className="drop-placeholder">＋<small>Drop here</small></span>}
                  </div>
                );
              })}
            </div>

            <div className="board-column friends-column">
              <h3>FRIENDS</h3>
              {availableFriends.map(friend => (
                <button
                  type="button"
                  className={`friend-card ${pickedFriend === String(friend.index) ? 'picked' : ''}`}
                  key={friend.index}
                  draggable
                  onDragStart={event => {
                    event.dataTransfer.setData('text/plain', String(friend.index));
                    event.dataTransfer.effectAllowed = 'move';
                    setPickedFriend(String(friend.index));
                  }}
                  onDragEnd={() => setPickedFriend(null)}
                  onClick={() => tapFriend(friend.index)}
                  aria-label={`Select or drag ${friend.name}`}
                >
                  {friend.url
                    ? <img className="friend-image" src={friend.url} alt={friend.name} />
                    : <span className="friend-image friend-placeholder">?</span>}
                  <b>{friend.name}</b>
                </button>
              ))}
              {availableFriends.length === 0 && <p className="all-assigned">All friends matched!</p>}
            </div>
          </div>

          <div className="actions play-actions">
            <button className="primary" onClick={submitMatches} disabled={loading}>
              {loading ? 'Submitting…' : 'Submit my matches ✓'}
            </button>
            <button className="secondary" type="button" onClick={shareGameLink}>Share game link ↗</button>
          </div>
          {notice && <div className="notice">{notice}</div>}
        </section>

        <footer>CharaMatch · EVERY CHARACTER HAS A MATCH</footer>

        <style>{`
          .match-shell{max-width:1200px}
          .match-panel{overflow:hidden}
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
          .play-actions{margin-top:14px}
          @media(max-width:600px){.match-board{grid-template-columns:125px 125px 125px;gap:8px}.character-card,.drop-zone,.friend-card{min-height:128px}.character-image,.dropped-friend img,.friend-image{width:92px;height:92px}.board-column>h3{font-size:.68rem}}
        `}</style>
      </main>
    );
  }

  if (page === 'result') {
    if (!game) {
      return (
        <main className="shell">
          <header className="top">
            <div className="brand-mark">☠</div>
            <div><div className="eyebrow">CharaMatch</div><h1>Result <span>unavailable</span></h1></div>
          </header>
          <section className="panel">
            <p>{notice || 'This result could not be found.'}</p>
            <button className="primary" onClick={startNewFriendsFlow}>Start a new game</button>
          </section>
        </main>
      );
    }

    return (
      <main className="shell">
        <header className="top result-page-top">
          <div className="brand-mark">☠</div>
          <div><div className="eyebrow">CharaMatch · {themeLabel.toUpperCase()}</div><h1>My <span>{themeLabel}</span> Matches</h1></div>
        </header>

        <section className="result-card" ref={resultRef}>
          <div className="result-header">
            <p className="eyebrow">THE CREW HAS SPOKEN</p>
            <h1>My <span>{themeLabel} Matches</span></h1>
            <p>Player: {participant}</p>
          </div>
          {characters.map(([name, image], index) => {
            const friend = activeFriends.find(item => String(item.index) === String(matches[index]));
            return (
              <div className="result-row" key={name}>
                <img className="result-character" src={image} alt={name} />
                <div className="result-info">
                  <small>CHARACTER {String(index + 1).padStart(2, '0')}</small>
                  <b>{name}</b>
                  <span>↔ {friend?.name || 'Friend'}</span>
                </div>
                {friend?.url && <img className="result-friend" src={friend.url} alt={friend.name} />}
              </div>
            );
          })}
          <div className="result-footer">CharaMatch · EVERY CHARACTER HAS A MATCH · FOR FUN ONLY</div>
        </section>

        <div className="actions">
          <button className="primary" onClick={downloadJpg}>Download JPG ↓</button>
          <button className="secondary" onClick={shareResultLink}>Share result ↗</button>
          <button className="secondary" onClick={startPlayOptions}>Play ↗</button>
          {!isSharedResult && <button className="secondary" onClick={editCurrentMatches}>Edit matches</button>}
        </div>

        {showPlayOptions && (
          <section className="panel play-options">
            <h3>Start a new game</h3>
            <p className="subtle">Choose whether to reuse the friends from this result or upload a new set.</p>
            <div className="actions">
              <button className="primary" onClick={startSameFriendsFlow}>Same Friends</button>
              <button className="secondary" onClick={startNewFriendsFlow}>New Friends</button>
            </div>
          </section>
        )}

        {notice && <div className="notice">{notice}</div>}
        <footer>CharaMatch · KEEP IT KIND · NO SCORES</footer>
        <style>{`
          .play-options{margin-top:18px}
          .play-options h3{margin-top:0}
          .play-options .actions{margin-bottom:0}
        `}</style>
      </main>
    );
  }

  if (page === 'error') {
    return (
      <main className="shell">
        <section className="panel">
          <h2>Unable to open this link</h2>
          <p>{notice || 'The game link may be invalid or temporarily unavailable.'}</p>
          <button className="primary" onClick={startNewFriendsFlow}>Start a new game</button>
        </section>
      </main>
    );
  }

  return <main className="shell"><div className="panel"><h2>{loading ? 'Loading…' : 'Please wait…'}</h2>{notice && <p>{notice}</p>}</div></main>;
}
