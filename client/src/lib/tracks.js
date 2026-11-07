// RUDRA.ROM original soundtrack — seven chiptune pieces composed for this site,
// in the spirit of 90s racing / platformer / RPG cartridges.
//
// Notation (one token per note, 16th-note grid):
//   'E5:3'  = E5 held for 3 steps      '.:2' = rest for 2 steps      'E5' = 1 step
//   bars are separated with '|' and are validated to fill the bar exactly.
// chords:  one chord per bar, e.g. 'C Am F G'  (qualities: m 7 m7 maj7 sus2 sus4 dim aug)
// bass:    a named pattern from BASS (R root · O octave · F fifth · T third · - hold · . rest)
// drums:   a named pattern from DRUMS (k kick · s snare · h hat · o open hat · x kick+hat · S snare+hat)
// arp:     the chord arpeggio style set per track (up · updown · alberti · stab · waltz)

export const DRUMS = {
  race: 'x.hkS.hxx.hkS.ho',
  basic: 'k.h.s.h.k.h.s.h.',
  chill: 'k..hs..hk.khs.h.',
  calypso: 'k.hhs.hkk.hhs.hh',
  boss: 'kkh.Skh.kkh.Skhs',
  waltz: 'k...h...h...',
  desert: 'k..kS..hk.k.S.hh',
  ballad: 'k...s...k.k.s..h',
};

export const BASS = {
  pump: 'R.O.R.O.R.O.R.O.',
  drive: 'R-R.R-O.R-R.F-O.',
  walk: 'R---..R-F---..O-',
  calypso: 'R..R..F.R..R..F.',
  boss: 'RRO.RRO.RRO.RROO',
  waltz: 'R---........',
  desert: 'R.R.R.RFR.R.R.RO',
  ballad: 'R-------F-------',
};

export const TRACKS = [
  {
    id: 'neon-kart',
    title: 'NEON KART',
    mood: 'racing',
    bpm: 152,
    spb: 16,
    inst: { lead: { wave: 'p25', vol: 0.2, vib: 0.005 }, arp: { wave: 'p12', vol: 0.06, oct: 4, style: 'up' }, bass: { vol: 0.34 }, drums: 0.9 },
    sections: {
      intro: { chords: 'C C', bass: 'pump', drums: 'race' },
      A: {
        chords: 'C Am F G',
        bass: 'pump',
        drums: 'race',
        lead: 'C5:2 E5:2 G5:3 E5:1 C6:4 G5:2 E5:2 | A5:3 G5:1 E5:2 C5:2 E5:4 .:2 E5:1 G5:1 | F5:2 A5:2 C6:3 A5:1 F5:2 A5:2 G5:2 F5:2 | G5:3 F5:1 E5:2 D5:2 B4:4 D5:2 G5:2',
      },
      A2: {
        chords: 'C Am F G',
        bass: 'pump',
        drums: 'race',
        lead: 'C5:2 E5:2 G5:3 E5:1 C6:4 G5:2 E5:2 | A5:2 C6:2 B5:2 A5:2 G5:4 E5:4 | F5:2 E5:2 F5:2 A5:2 C6:4 A5:2 F5:2 | G5:4 D6:4 B5:4 G5:4',
      },
      B: {
        chords: 'F G Em Am',
        bass: 'drive',
        drums: 'race',
        lead: 'A5:4 .:2 A5:1 A5:1 C6:3 A5:1 G5:2 F5:2 | G5:4 .:2 G5:1 G5:1 B5:3 G5:1 D5:2 G5:2 | E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:2 B5:2 | C6:6 B5:2 A5:6 .:2',
      },
      brk: { chords: 'F G F G', bass: 'drive', drums: 'basic' },
      outro: {
        chords: 'F G C C',
        bass: 'pump',
        drums: 'race',
        lead: 'F5:2 G5:2 A5:2 C6:2 D6:2 C6:2 A5:2 G5:2 | G5:4 B5:4 D6:8 | C6:16 | .:16',
      },
    },
    form: ['intro', 'A', 'A2', 'B', 'A', 'A2', 'brk', 'B', 'A2', 'outro'],
  },
  {
    id: 'pixel-harbor',
    title: 'PIXEL HARBOR',
    mood: 'island',
    bpm: 116,
    spb: 16,
    swing: 0.14,
    inst: { lead: { wave: 'p12', vol: 0.19, pluck: true }, arp: { wave: 'p25', vol: 0.06, oct: 4, style: 'stab' }, bass: { vol: 0.34 }, drums: 0.7 },
    sections: {
      intro: { chords: 'G G', bass: 'calypso', drums: 'calypso' },
      A: {
        chords: 'G C D G',
        bass: 'calypso',
        drums: 'calypso',
        lead: 'B4:2 D5:2 G5:3 D5:1 B4:2 D5:2 E5:2 D5:2 | E5:2 G5:2 C6:3 G5:1 E5:2 G5:2 E5:2 C5:2 | D5:2 F#5:2 A5:3 F#5:1 D5:2 E5:2 F#5:2 A5:2 | G5:6 D5:2 B4:6 .:2',
      },
      B: {
        chords: 'Em C D D',
        bass: 'calypso',
        drums: 'calypso',
        lead: 'G5:3 E5:1 B4:2 E5:2 G5:2 A5:2 B5:4 | A5:3 G5:1 E5:2 C5:2 E5:2 G5:2 A5:4 | F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:2 E5:2 D5:2 | D5:4 E5:4 F#5:4 A5:4',
      },
      brk: { chords: 'G C D G', bass: 'calypso', drums: 'calypso' },
      outro: {
        chords: 'C D G G',
        bass: 'calypso',
        drums: 'calypso',
        lead: 'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 | F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 | G5:16 | .:16',
      },
    },
    form: ['intro', 'A', 'B', 'A', 'brk', 'B', 'A', 'outro'],
  },
  {
    id: 'lab-night',
    title: 'LAB NIGHT',
    mood: 'chill',
    bpm: 86,
    spb: 16,
    swing: 0.2,
    inst: { lead: { wave: 'triangle', vol: 0.3, vib: 0.004 }, arp: { wave: 'p50', vol: 0.045, oct: 4, style: 'updown' }, bass: { vol: 0.32 }, drums: 0.55 },
    sections: {
      intro: { chords: 'Dm7 Bbmaj7 Gm7 A7', bass: 'walk' },
      A: {
        chords: 'Dm7 Bbmaj7 Gm7 A7',
        bass: 'walk',
        drums: 'chill',
        lead: 'A4:4 C5:2 D5:2 F5:6 E5:2 | D5:6 C5:2 A4:4 .:4 | Bb4:2 D5:2 F5:2 A5:4 G5:2 F5:4 | E5:6 C#5:2 A4:8',
      },
      B: {
        chords: 'Dm7 Bbmaj7 Gm7 A7',
        bass: 'walk',
        drums: 'chill',
        lead: 'F5:4 E5:2 D5:2 A5:6 G5:2 | F5:6 D5:2 Bb4:4 C5:4 | D5:2 F5:2 A5:2 C6:4 A5:2 G5:4 | A5:4 G5:2 E5:2 C#5:8',
      },
      brk: { chords: 'Dm7 Bbmaj7 Gm7 A7', bass: 'walk' },
      outro: {
        chords: 'Gm7 A7 Dm7 Dm7',
        bass: 'walk',
        drums: 'chill',
        lead: 'Bb4:4 D5:4 F5:4 A5:4 | G5:4 E5:4 C#5:8 | D5:16 | .:16',
      },
    },
    form: ['intro', 'A', 'B', 'brk', 'A', 'B', 'outro'],
  },
  {
    id: 'boss-rush',
    title: 'BOSS RUSH',
    mood: 'intense',
    bpm: 172,
    spb: 16,
    inst: { lead: { wave: 'p50', vol: 0.15, vib: 0.004 }, arp: { wave: 'p25', vol: 0.055, oct: 4, style: 'up' }, bass: { vol: 0.36 }, drums: 1 },
    sections: {
      intro: { chords: 'Em Em', bass: 'boss', drums: 'boss' },
      A: {
        chords: 'Em C D B',
        bass: 'boss',
        drums: 'boss',
        lead: 'E5:1 F#5:1 G5:1 B5:1 E6:2 B5:2 G5:2 F#5:2 E5:4 | C6:2 B5:2 G5:2 E5:2 G5:1 A5:1 B5:2 C6:4 | D6:2 C6:2 A5:2 F#5:2 A5:1 B5:1 C6:2 D6:4 | D#6:4 B5:2 F#5:2 D#5:4 B4:4',
      },
      B: {
        chords: 'Am Em C B',
        bass: 'boss',
        drums: 'boss',
        lead: 'A5:2 .:1 A5:1 C6:2 E6:2 D6:2 C6:2 B5:2 A5:2 | G5:2 .:1 G5:1 B5:2 E6:2 D6:2 B5:2 G5:2 E5:2 | E6:3 D6:1 C6:2 B5:2 A5:2 G5:2 A5:2 B5:2 | F#5:2 A5:2 B5:2 D#6:2 F#6:4 D#6:4',
      },
      brk: { chords: 'Em C D B', bass: 'boss', drums: 'boss' },
      outro: {
        chords: 'Em Em',
        bass: 'boss',
        drums: 'boss',
        lead: 'E6:2 B5:2 G5:2 E5:2 B4:2 E5:2 G5:2 B5:2 | E6:16',
      },
    },
    form: ['intro', 'A', 'A', 'B', 'brk', 'A', 'B', 'B', 'A', 'outro'],
  },
  {
    id: 'cloud-kingdom',
    title: 'CLOUD KINGDOM',
    mood: 'waltz',
    bpm: 138,
    spb: 12,
    inst: { lead: { wave: 'p12', vol: 0.17, vib: 0.005 }, arp: { wave: 'p25', vol: 0.06, oct: 4, style: 'waltz' }, bass: { vol: 0.32 }, drums: 0.5 },
    sections: {
      intro: { chords: 'F Dm Bb C', bass: 'waltz', drums: 'waltz' },
      A: {
        chords: 'F Dm Bb C',
        bass: 'waltz',
        drums: 'waltz',
        lead: 'F5:4 A5:2 C6:2 F6:4 | E6:4 D6:4 A5:4 | D6:4 C6:2 Bb5:2 F5:4 | G5:6 E5:2 C5:4',
      },
      A2: {
        chords: 'F Am Bb C',
        bass: 'waltz',
        drums: 'waltz',
        lead: 'F5:4 A5:2 C6:2 F6:4 | E6:4 C6:2 A5:2 E6:4 | D6:4 F6:2 D6:2 Bb5:4 | C6:8 .:4',
      },
      B: {
        chords: 'Dm Gm C F',
        bass: 'waltz',
        drums: 'waltz',
        lead: 'D5:2 F5:2 A5:4 F5:4 | D5:2 G5:2 Bb5:4 G5:4 | E5:4 G5:4 E5:2 C5:2 | A4:4 F4:8',
      },
      outro: {
        chords: 'Bb C F F',
        bass: 'waltz',
        drums: 'waltz',
        lead: 'D6:4 C6:2 Bb5:2 F5:4 | G5:6 E5:2 C5:4 | F5:12 | .:12',
      },
    },
    form: ['intro', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A2', 'outro'],
  },
  {
    id: 'desert-circuit',
    title: 'DESERT CIRCUIT',
    mood: 'racing',
    bpm: 144,
    spb: 16,
    inst: { lead: { wave: 'p25', vol: 0.18, vib: 0.007 }, arp: { wave: 'p12', vol: 0.05, oct: 4, style: 'alberti' }, bass: { vol: 0.34 }, drums: 0.85 },
    sections: {
      intro: { chords: 'A A', bass: 'desert', drums: 'desert' },
      A: {
        chords: 'A Bb A Bb',
        bass: 'desert',
        drums: 'desert',
        lead: 'A5:2 Bb5:2 C#6:2 Bb5:2 A5:4 E5:4 | F5:2 E5:2 D5:2 E5:2 F5:4 Bb5:4 | A5:1 Bb5:1 A5:1 G5:1 F5:2 E5:2 F5:2 G5:2 A5:4 | Bb5:4 A5:2 G5:2 F5:4 E5:4',
      },
      B: {
        chords: 'Dm Bb C A',
        bass: 'desert',
        drums: 'desert',
        lead: 'D6:3 C#6:1 D6:2 A5:2 F5:4 D5:4 | D6:3 C6:1 Bb5:2 F5:2 D5:4 F5:4 | E6:3 D6:1 C6:2 G5:2 E5:4 G5:4 | C#6:4 E6:4 E6:2 C#6:2 A5:4',
      },
      brk: { chords: 'A Bb A Bb', bass: 'desert', drums: 'basic' },
      outro: { chords: 'Dm A', bass: 'desert', drums: 'desert', lead: 'D6:4 A5:4 F5:4 D5:4 | A5:16' },
    },
    form: ['intro', 'A', 'A', 'B', 'brk', 'A', 'B', 'A', 'outro'],
  },
  {
    id: 'credits-roll',
    title: 'CREDITS ROLL',
    mood: 'nostalgic',
    bpm: 100,
    spb: 16,
    inst: { lead: { wave: 'p50', vol: 0.15, vib: 0.005 }, arp: { wave: 'p12', vol: 0.05, oct: 4, style: 'updown' }, bass: { vol: 0.32 }, drums: 0.6 },
    sections: {
      intro: { chords: 'D Bm G A', bass: 'ballad' },
      A: {
        chords: 'D Bm G A',
        bass: 'ballad',
        drums: 'ballad',
        lead: 'F#5:4 A5:2 F#5:2 E5:4 D5:4 | D5:2 E5:2 F#5:4 B5:6 A5:2 | G5:4 F#5:2 E5:2 D5:4 B4:4 | C#5:4 E5:4 A5:8',
      },
      A2: {
        chords: 'D F#m G A',
        bass: 'ballad',
        drums: 'ballad',
        lead: 'F#5:4 A5:2 D6:2 C#6:4 A5:4 | A5:2 B5:2 C#6:4 F#6:6 E6:2 | D6:4 B5:2 G5:2 A5:4 B5:4 | A5:12 .:4',
      },
      B: {
        chords: 'Em G A A',
        bass: 'ballad',
        drums: 'ballad',
        lead: 'B5:4 G5:4 E5:4 G5:4 | D6:4 B5:4 G5:4 B5:4 | C#6:4 A5:4 E5:4 A5:4 | E6:6 D6:2 C#6:4 E6:4',
      },
      outro: {
        chords: 'G A D D',
        bass: 'ballad',
        drums: 'ballad',
        lead: 'B5:4 D6:4 G5:4 B5:4 | A5:4 C#6:4 E6:8 | D6:16 | .:16',
      },
    },
    form: ['intro', 'A', 'A2', 'B', 'A', 'A2', 'outro'],
  },
];
