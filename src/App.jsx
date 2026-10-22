import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('YOUR_PROJECT')
    ? createClient(supabaseUrl, supabaseKey)
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

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  }

  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  ).slice(0, 16);
}

function readGameId() {
  const match = window.location.pathname.match(
    /\/game\/([a-zA-Z0-9]+)/
  );

  return (
    match?.[1] ||
    new URLSearchParams(window.location.search).get('game')
  );
}

function dataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error('Could not read the selected photo.')
    );

    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState('one_piece');
  const [gameId, setGameId] = useState(readGameId());

  const [ownerName, setOwnerName] = useState('');

  const [friends, setFriends] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      name: `Friend ${i + 1}`,
      file: null,
      preview: '',
      path: '',
    }))
  );

  const [game, setGame] = useState(null);
  const [matches, setMatches] = useState({});
  const [participant, setParticipant] = useState('');

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [resolvedFriends, setResolvedFriends] = useState([]);

  const resultRef = useRef(null);

  const characters = useMemo(
    () =>
      theme === 'jujutsu_kaisen'
        ? JUJUTSU_KAISEN
        : ONE_PIECE,
    [theme]
  );

  const isConfigured = Boolean(supabase);

  const shareUrl = gameId
    ? `${window.location.origin}/game/${gameId}`
    : '';

  useEffect(() => {
    const id = readGameId();

    if (id) {
      setGameId(id);
      loadGame(id);
    }
  }, []);

  async function loadGame(id) {
    if (!supabase) {
      setNotice(
        'Online mode is not configured. Check your Supabase settings.'
      );
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setNotice(
          'Game not found. Check that the shared link is correct.'
        );
        return;
      }

      setGame(data);
      setGameId(data.id);
      setTheme(data.theme || 'one_piece');
      setMatches({});
      setParticipant('');
      setResolvedFriends([]);
      setPage('play');
    } catch (error) {
      setNotice(
        `Could not load the game: ${error.message || 'Please try again.'}`
      );
    } finally {
      setLoading(false);
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

      setFriends((previous) =>
        previous.map((friend, i) =>
          i === index
            ? { ...friend, file, preview }
            : friend
        )
      );

      setNotice('');
    } catch {
      setNotice('Could not open that photo. Please try another.');
    }
  }

  async function createGame(event) {
    event.preventDefault();

    if (!supabase) {
      setNotice(
        'Supabase is not connected. Check your project environment variables.'
      );
      return;
    }

    if (!ownerName.trim()) {
      setNotice('Please enter your name or nickname.');
      return;
    }

    if (friends.some((friend) => !friend.file)) {
      setNotice('Please upload all 10 friends’ photos first.');
      return;
    }

    setLoading(true);
    setNotice('');

    const id = makeId();

    try {
      const storedFriends = [];

      for (let i = 0; i < friends.length; i++) {
        const friend = friends[i];

        const extension = (
          friend.file.name.split('.').pop() || 'jpg'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'jpg';

        const path = `${id}/${i + 1}-${makeId()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('friend-photos')
          .upload(path, friend.file, {
            upsert: false,
            contentType: friend.file.type,
          });

        if (uploadError) throw uploadError;

        storedFriends.push({
          name: friend.name.trim() || `Friend ${i + 1}`,
          path,
        });
      }

      const { error: insertError } = await supabase
        .from('games')
        .insert({
          id,
          owner_name: ownerName.trim(),
          theme,
          friends: storedFriends,
        });

      if (insertError) throw insertError;

      setGameId(id);
      window.history.pushState({}, '', `/game/${id}`);

      await loadGame(id);

      setNotice(
        'Game created! Share the link with your friends.'
      );
    } catch (error) {
      setNotice(
        `Could not create the game: ${
          error.message || 'Please check your Supabase setup.'
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  async function renderFriend(friend, index) {
    const { data } = supabase.storage
      .from('friend-photos')
      .getPublicUrl(friend.path);

    return {
      ...friend,
      index,
      url: data.publicUrl,
    };
  }

  useEffect(() => {
    let active = true;

    async function resolveFriends() {
      if (!game?.friends || !supabase) return;

      try {
        const list = await Promise.all(
          game.friends.map((friend, index) =>
            renderFriend(friend, index)
          )
        );

        if (active) {
          setResolvedFriends(list);
        }
      } catch {
        if (active) {
          setNotice('Could not load the friends’ photos.');
        }
      }
    }

    resolveFriends();

    return () => {
      active = false;
    };
  }, [game]);

  const activeFriends = game
    ? resolvedFriends
    : friends.map((friend, index) => ({
        ...friend,
        index,
        url: friend.preview,
      }));

  function updateMatch(characterIndex, friendIndex) {
    setMatches((previous) => {
      const updated = { ...previous };

      if (friendIndex === '') {
        delete updated[characterIndex];
      } else {
        updated[characterIndex] = friendIndex;
      }

      return updated;
    });

    setNotice('');
  }

  async function submitMatches() {
    if (!participant.trim()) {
      setNotice('Please enter your name or nickname.');
      return;
    }

    if (Object.keys(matches).length !== 10) {
      setNotice('Please match all 10 characters.');
      return;
    }

    const selectedFriends = Object.values(matches);

    if (new Set(selectedFriends).size !== 10) {
      setNotice(
        'Each friend can only be matched with one character.'
      );
      return;
    }

    if (!supabase) {
      setNotice('The online database is not connected.');
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const { error } = await supabase
        .from('submissions')
        .insert({
          game_id: gameId,
          participant_name: participant.trim(),
          matches,
        });

      if (error) throw error;

      setPage('result');
      setNotice('Your matches have been submitted!');
    } catch (error) {
      setNotice(
        `Submission failed: ${error.message || 'Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
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

      link.download = `charamatch-${gameId || 'result'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.94);
      link.click();

      setNotice('JPG downloaded successfully!');
    } catch {
      setNotice(
        'JPG export failed. Please check your connection and try again.'
      );
    }
  }

  async function shareLink() {
    if (!shareUrl) {
      setNotice('There is no game link to share yet.');
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'CharaMatch',
          text: `Match our friends with ${
            theme === 'jujutsu_kaisen'
              ? 'Jujutsu Kaisen'
              : 'One Piece'
          } characters!`,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setNotice('Game link copied. Paste it into WhatsApp.');
      } else {
        setNotice(`Copy this game link: ${shareUrl}`);
      }
    } catch {
      setNotice('Sharing was cancelled or is unavailable.');
    }
  }

  if (page === 'home') {
    return (
      <main className="shell">
        <header className="top">
          <div className="brand-mark">☠</div>

          <div>
            <div className="eyebrow">CHARAMATCH</div>
            <h1>
              Match your <span>crew</span>
            </h1>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">PICK YOUR UNIVERSE</p>

            <h2>
              Which anime character
              <br />
              is your friend?
            </h2>

            <p>
              Upload your crew once, share a game link, and
              see which characters your friends choose.
            </p>
          </div>

          <div className="hero-stamp">
            WANTED
            <br />
            <strong>
              YOUR
              <br />
              CREW
            </strong>
            <small>FUN ONLY • NO SCORES</small>
          </div>
        </section>

        <form className="panel" onSubmit={createGame}>
          <h3>01 / Create your game</h3>

          <label className="field-label">
            Your name or nickname

            <input
              value={ownerName}
              onChange={(event) =>
                setOwnerName(event.target.value)
              }
              placeholder="e.g. Bharat"
              maxLength="40"
            />
          </label>

          <h4>Choose your anime world</h4>

          <div className="themes">
            <button
              type="button"
              className={`theme-card ${
                theme === 'one_piece' ? 'selected' : ''
              }`}
              onClick={() => setTheme('one_piece')}
            >
              <span className="theme-icon">🏴‍☠️</span>
              <b>ONE PIECE</b>
              <small>Available now</small>
            </button>

            <button
              type="button"
              className={`theme-card ${
                theme === 'jujutsu_kaisen' ? 'selected' : ''
              }`}
              onClick={() => setTheme('jujutsu_kaisen')}
            >
              <span className="theme-icon">👊</span>
              <b>JUJUTSU KAISEN</b>
              <small>
                {theme === 'jujutsu_kaisen'
                  ? 'Selected ✓'
                  : 'Choose this world'}
              </small>
            </button>
          </div>

          <h3>02 / Upload 10 friends</h3>

          <p className="subtle">
            Choose one photo per friend. Anyone with your game
            link may be able to view these photos.
          </p>

          <div className="upload-grid">
            {friends.map((friend, index) => (
              <div className="upload-card" key={index}>
                <label className="photo-pick">
                  {friend.preview ? (
                    <img src={friend.preview} alt="" />
                  ) : (
                    <span className="plus">+</span>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      choosePhoto(
                        index,
                        event.target.files?.[0]
                      )
                    }
                  />

                  <span className="photo-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </label>

                <input
                  className="friend-name"
                  value={friend.name}
                  maxLength="40"
                  onChange={(event) =>
                    setFriends((previous) =>
                      previous.map((item, i) =>
                        i === index
                          ? { ...item, name: event.target.value }
                          : item
                      )
                    )
                  }
                  aria-label={`Friend ${index + 1} name`}
                />
              </div>
            ))}
          </div>

          <button
            className="primary"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Creating…'
              : 'Generate my game link ↗'}
          </button>

          {!isConfigured && (
            <p className="warning">
              Supabase is not configured. Check your project
              environment variables and SETUP.md.
            </p>
          )}
        </form>

        {notice && <div className="notice">{notice}</div>}

        <footer>
          BUILT FOR FRIENDS · KEEP IT KIND · NO SCORES
        </footer>
      </main>
    );
  }

  if (page === 'play') {
    return (
      <main className="shell">
        <header className="top">
          <div className="brand-mark">☠</div>

          <div>
            <div className="eyebrow">
              {theme === 'jujutsu_kaisen'
                ? 'JUJUTSU KAISEN EDITION'
                : 'ONE PIECE EDITION'}
            </div>

            <h1>
              Match your <span>world</span>
            </h1>
          </div>
        </header>

        <section className="panel">
          <p className="subtle">
            Created by {game?.owner_name || 'your friend'}.
            Match every friend to the character that fits them best.
          </p>

          <label className="field-label">
            Your name or nickname

            <input
              value={participant}
              onChange={(event) =>
                setParticipant(event.target.value)
              }
              placeholder="Who is making these matches?"
              maxLength="40"
            />
          </label>

          <div className="match-list">
            {characters.map(([character, image], index) => (
              <div className="match-row" key={character}>
                <div className="character">
                  <img src={image} alt={character} />
                  <b>{character}</b>
                </div>

                <div className="match-arrow">←</div>

                <select
                  value={matches[index] ?? ''}
                  onChange={(event) =>
                    updateMatch(index, event.target.value)
                  }
                  aria-label={`Choose a friend for ${character}`}
                >
                  <option value="">Choose a friend…</option>

                  {activeFriends.map((friend) => {
                    const alreadySelected = Object.entries(
                      matches
                    ).some(
                      ([characterKey, friendIndex]) =>
                        characterKey !== String(index) &&
                        friendIndex === String(friend.index)
                    );

                    return (
                      <option
                        key={friend.index}
                        value={String(friend.index)}
                        disabled={alreadySelected}
                      >
                        {friend.name}
                      </option>
                    );
                  })}
                </select>

                <div className="selected-photo">
                  {matches[index] !== undefined &&
                  activeFriends[Number(matches[index])]?.url ? (
                    <img
                      src={
                        activeFriends[Number(matches[index])].url
                      }
                      alt="Selected friend"
                    />
                  ) : (
                    <span>?</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            className="primary"
            onClick={submitMatches}
            disabled={loading}
          >
            {loading
              ? 'Submitting…'
              : 'Submit my matches ✓'}
          </button>

          {notice && <div className="notice">{notice}</div>}
        </section>

        <footer>ONE CREW · MANY OPINIONS</footer>
      </main>
    );
  }

  if (page === 'result') {
    return (
      <main className="shell">
        <section className="result-card" ref={resultRef}>
          <div className="result-header">
            <p className="eyebrow">THE CREW HAS SPOKEN</p>

            <h1>
              My Anime <span>Matches</span>
            </h1>

            <p>Player: {participant}</p>
          </div>

          {characters.map(([character, image], index) => {
            const friend =
              activeFriends[Number(matches[index])];

            return (
              <div className="result-row" key={character}>
                <img
                  className="result-character"
                  src={image}
                  alt={character}
                />

                <div className="result-info">
                  <small>
                    CHARACTER {String(index + 1).padStart(2, '0')}
                  </small>

                  <b>{character}</b>

                  <span>
                    ↔ {friend?.name || 'Friend'}
                  </span>
                </div>

                {friend?.url && (
                  <img
                    className="result-friend"
                    src={friend.url}
                    alt={friend.name}
                  />
                )}
              </div>
            );
          })}

          <div className="result-footer">
            CHARAMATCH · FOR FUN ONLY
          </div>
        </section>

        <div className="actions">
          <button className="primary" onClick={downloadJpg}>
            Download JPG ↓
          </button>

          <button className="secondary" onClick={shareLink}>
            Share game link ↗
          </button>

          <button
            className="secondary"
            onClick={() => {
              setMatches({});
              setParticipant('');
              setNotice('');
              setPage('play');
            }}
          >
            Play Again ↻
          </button>

          <button
            className="secondary"
            onClick={() => {
              setPage('play');
              setNotice('');
            }}
          >
            Edit matches
          </button>
        </div>

        {notice && <div className="notice">{notice}</div>}
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="panel">
        <h2>Loading game…</h2>

        {notice && <p>{notice}</p>}
      </div>
    </main>
  );
}
