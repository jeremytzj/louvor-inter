const fs = require('fs');

function parseCifras(txtPath) {
    const text = fs.readFileSync(txtPath, 'utf8');
    const lines = text.split('\n').map(l => l.replace('\r', ''));
    
    const songs = [];
    let currentSong = null;
    let seenSections = new Set();
    let currentSection = '';
    
    // Helper to check if a line is just chords
    const isChordLine = (line) => {
        if (!line.trim()) return false;
        // A chord line typically contains only uppercase letters, numbers, m, #, b, /, (, ), -, maj, dim, aug, sus and spaces
        // Let's use a heuristic: if we split by space, are all tokens chords?
        const tokens = line.trim().split(/\s+/);
        for (let token of tokens) {
            token = token.replace(/[()]/g, ''); // ignore parens
            if (!/^[A-G][#b]?(m|maj|dim|aug|sus)?\d*(?:\/[A-G][#b]?)?$/i.test(token) && token !== '|' && token !== ')' && token !== '(' && token !== '-') {
                // Some tokens like "PRA", "IR", "ÚLTIMA" will fail this, which is good
                return false;
            }
        }
        return true;
    };

    let i = 0;
    while (i < lines.length) {
        let line = lines[i];
        
        // Match "Tom: X" to identify a new song context (the line before it is the title)
        if (line.startsWith('Tom: ')) {
            const title = lines[i-1].trim();
            const tom = line.replace('Tom: ', '').trim();
            
            // Format ID
            const id = title.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
                .replace(/[^a-z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '-');
            
            currentSong = {
                id,
                titulo: title,
                tom_original: tom,
                audio_url: `./src/audio/${id}.mp3`, // generic name
                cifra_chordpro: ''
            };
            songs.push(currentSong);
            seenSections = new Set();
            i++;
            continue;
        }

        if (currentSong) {
            // Check for sections
            const sectionMatch = line.match(/^\[(.*?)\]$/);
            if (sectionMatch) {
                let sectionName = sectionMatch[1].trim();
                
                // If we've already seen this section, output a repeat tag and skip until next section
                let normName = sectionName.toLowerCase().replace(/\d+/g, '').trim();
                if (normName === 'solo' || normName === 'intro') {
                    // usually don't repeat skip for solos/intros unless exactly identical, but let's just process them
                } else if (seenSections.has(sectionName)) {
                    currentSong.cifra_chordpro += `{{Repete ${sectionName}}}\n`;
                    // Skip lines until next section
                    i++;
                    while (i < lines.length && !/^\[(.*?)\]$/.test(lines[i].trim()) && !lines[i].startsWith('Tom: ')) {
                        i++;
                    }
                    continue; // we are at the next section or Tom
                } else {
                    seenSections.add(sectionName);
                }
                
                currentSong.cifra_chordpro += `{${sectionName}}\n`;
                i++;
                continue;
            }

            if (isChordLine(line)) {
                // Find all chords and their positions
                const chords = [];
                const regex = /\S+/g;
                let match;
                while ((match = regex.exec(line)) !== null) {
                    chords.push({ chord: match[0], index: match.index });
                }

                // Look ahead to see if the next line is lyrics or more chords/empty
                if (i + 1 < lines.length) {
                    const nextLine = lines[i+1];
                    if (nextLine.trim() !== '' && !isChordLine(nextLine) && !nextLine.startsWith('[')) {
                        // It's a lyric line! We merge them
                        let merged = nextLine;
                        // Insert from right to left to avoid messing up indices
                        for (let j = chords.length - 1; j >= 0; j--) {
                            let { chord, index } = chords[j];
                            // Clean parens from chord if needed, but chordpro uses [Chord]
                            let chordText = `[${chord.replace(/[()]/g, '')}]`;
                            
                            if (index >= merged.length) {
                                // pad with spaces
                                merged += ' '.repeat(index - merged.length) + chordText;
                            } else {
                                merged = merged.substring(0, index) + chordText + merged.substring(index);
                            }
                        }
                        currentSong.cifra_chordpro += merged + '\n';
                        i += 2;
                        continue;
                    }
                }
                
                // If we didn't merge with lyrics, it's a standalone chord line (like intro or solo)
                let chordOnlyStr = '';
                chords.forEach(c => {
                    chordOnlyStr += ` [${c.chord.replace(/[()]/g, '')}|]`;
                });
                currentSong.cifra_chordpro += chordOnlyStr.trim() + '\n';
            } else {
                // Regular line (empty or just text without chords above it)
                if (line.trim() === 'Cresce PRA IR PRA ÚLTIMA' || line.trim() === '(Am  C)') {
                    // special ignore or handle
                } else if (line.trim() !== '') {
                    currentSong.cifra_chordpro += line + '\n';
                }
            }
        }
        i++;
    }
    
    // Clean up trailing newlines
    songs.forEach(s => {
        s.cifra_chordpro = s.cifra_chordpro.replace(/\n+$/, '');
    });
    
    return songs;
}

const parsed = parseCifras('src/cifras.txt');

// Read existing cyphers.json
const existing = JSON.parse(fs.readFileSync('src/cyphers.json', 'utf8'));

// Filter out songs from existing that are to be replaced (from "Eu vou construir" downwards, wait, no: the user said "siga o padrao das musicas Eu vou construir para cima (em ordem alfabetica) do arquivo Json, elas estão prontas. Mantem tudo em ordem alfabética").
// So keep everything from Abba to Eu vou construir.
// Let's identify the index of "Eu vou construir" in existing
let keepExisting = [];
for (let s of existing) {
    if (s.id <= 'eu-vou-construir' || s.titulo.toLowerCase() === 'eu vou construir') {
        keepExisting.push(s);
    }
}

// Add the newly parsed ones
// Avoid duplicates by ID
const finalSongs = [...keepExisting];
for (let s of parsed) {
    if (!finalSongs.find(x => x.id === s.id)) {
        finalSongs.push(s);
    }
}

// Ensure "Ha Poder" etc are replaced by the parsed versions, so we don't keep the bad ones.
// Wait, what if the existing "Ha Poder" is in `keepExisting`? "ha-poder" comes after "eu-vou-construir" alphabetically ("h" > "e"). So it won't be in `keepExisting`.
// Wait! "entrega-tudo-e-teu" comes BEFORE "eu-vou-construir". We must keep "entrega-tudo-e-teu"!
// Let's explicitly keep what the user said is ready: all existing songs up to "Eu vou construir", meaning we should check what's in the parsed vs existing.
// The parsed songs are: Há Poder, Minha Oração, Não Há Amor Igual, Pardal, Reina Em Mim, Santo Espírito, Só Tu És Santo, Sublime, Tua Glória, Tudo é Pra Tua Glória.
// We should replace any existing song if it is in the parsed list.

const finalMap = new Map();
existing.forEach(s => finalMap.set(s.id, s));

parsed.forEach(s => {
    // We override whatever is in existing with the newly parsed one, EXCEPT if the parsed one is somehow before 'eu-vou-construir', but none of them are.
    // Wait, the user said: "siga o padrao das musicas Eu vou construir para cima (em ordem alfabetica) do arquivo Json, elas estão prontas. Mantenha tudo em ordem alfabética"
    finalMap.set(s.id, s);
});

const sortedFinal = Array.from(finalMap.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));

fs.writeFileSync('src/cyphers_new.json', JSON.stringify(sortedFinal, null, 2));
console.log('Done writing src/cyphers_new.json');
